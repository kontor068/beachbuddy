import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');

const failures = [];
const warnings = [];
let checks = 0;

const pass = () => {
  checks += 1;
};

const fail = message => {
  checks += 1;
  failures.push(message);
};

const warn = message => {
  warnings.push(message);
};

const exists = async filePath => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readText = async filePath => readFile(filePath, 'utf8');

const decodeEntities = value => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const tagContent = (html, pattern) => {
  const match = html.match(pattern);
  return match ? decodeEntities(match[1]) : '';
};

const titleOf = html => tagContent(html, /<title>([\s\S]*?)<\/title>/i).trim();
const h1Of = html => tagContent(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i).trim();
const metaContent = (html, name) => tagContent(
  html,
  new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']\\s*\\/?>`, 'i')
).trim();
const canonicalOf = html => tagContent(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i).trim();

const stripNoSnippet = html => String(html || '')
  .replace(/<([a-z][\w:-]*)\b(?=[^>]*\bdata-nosnippet(?:=["'][^"']*["'])?)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

const visibleTextOf = html => {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  return decodeEntities(stripNoSnippet(body)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
};

const hasVisibleCurrentConditionData = visibleText => {
  const text = String(visibleText || '');
  return /(?:wind|waves?|άνεμ|κύμα|wellen|vagues|vent|vento|onde)[\s\S]{0,90}\d+(?:[.,]\d+)?\s?(?:bft|beaufort|m\b|km\/h|kn|kts|°c)/i.test(text) ||
    /\d+(?:[.,]\d+)?\s?(?:bft|beaufort|m\b|km\/h|kn|kts|°c)[\s\S]{0,90}(?:wind|waves?|άνεμ|κύμα|wellen|vagues|vent|vento|onde)/i.test(text);
};

const currentDayClaimPattern = /\b(?:today|today's|today’s|heute|oggi)\b|aujourd['’]hui|\bdu jour\b|σημεριν[α-ωά-ώ]*|σήμερα/i;
const calmTodayClaimPattern = /\b(?:calm|calmer|calmest)\b[\s\S]{0,32}\b(?:today|today's|today’s)\b|\b(?:today|today's|today’s)\b[\s\S]{0,32}\b(?:calm|calmer|calmest)\b/i;
const bestTodayClaimPattern = /\b(?:best)\b[\s\S]{0,32}\b(?:today|today's|today’s)\b|\b(?:today|today's|today’s)\b[\s\S]{0,32}\b(?:best)\b/i;
const unsafeAbsolutePattern = /\bsafe(?:st)?\b/i;
const safeCaveatPattern = /\b(?:safety|lifeguard|warning flags?|beach flags?|red flags?|yellow flags?|avoid|caution|does not replace|do not replace|not replace|follow)\b/i;
const guaranteePattern = /\bguarantee(?:d)?\b|garantiert|garanti|garantito|εγγυη/i;
const guaranteeCaveatPattern = /\b(?:not|no|never|without)\s+\w*\s*guarantee|kein(?:en|er)?\s+garant|pas\s+un\s+abri\s+garanti|non\s+un\s+riparo\s+garantito|όχι\s+εγγυη|δεν\s+.*εγγυη/i;
const shelterClaimPattern = /\b(?:sheltered|wind-protected|protected from|fully protected)\b|windgeschützt|abritées?|riparate?|προστατευ|απάνεμ/i;
// de/fr/it comparatives belong here too: the pattern only knew English and
// Greek qualifiers, so ANY German/French/Italian shelter wording was flagged no
// matter how carefully it was hedged — 50-odd cluster region titles sat in the
// warning with no wording that could ever clear it.
const shelterQualifierPattern = /\b(?:usually|often|may|might|can|more|less|available|orientation|oriented|based on|not guaranteed|check|compare|before you go|conditions vary|depending|signal|data|less exposed|more comfortable)\b|\b(?:eher|meist|oft|kann|mehr|weniger|ausrichtung)\b|\b(?:plutôt|souvent|peut|plus|moins|orientation)\b|\b(?:più|meno|spesso|solitamente|può)\b|προσανατολισ|μπορεί|συχν|διαθέσιμ|όχι\s+εγγυη|έλεγξε|σύγκρι|πριν\s+πας|με\s+βάση|δεδομέν|πιο/i;

const riskyClaimFindings = (text, hasCurrentConditionData) => {
  const value = String(text || '');
  if (!value) return [];

  const findings = [];
  if (!hasCurrentConditionData && currentDayClaimPattern.test(value)) {
    findings.push('current-day wording without visible wind/wave values');
  }
  if (!hasCurrentConditionData && calmTodayClaimPattern.test(value)) {
    findings.push('calm-today claim without visible condition data');
  }
  if (!hasCurrentConditionData && bestTodayClaimPattern.test(value)) {
    findings.push('best-today claim without visible ranking data');
  }
  if (unsafeAbsolutePattern.test(value) && !safeCaveatPattern.test(value)) {
    findings.push('absolute safe/safest wording');
  }
  if (guaranteePattern.test(value) && !guaranteeCaveatPattern.test(value)) {
    findings.push('guarantee wording');
  }
  if (!hasCurrentConditionData && shelterClaimPattern.test(value) && !shelterQualifierPattern.test(value)) {
    findings.push('unqualified sheltered/protected wording');
  }
  return Array.from(new Set(findings));
};

const hreflangsOf = html => Array.from(html.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']\s*\/?>/gi))
  .map(match => ({ hreflang: match[1], href: match[2] }));

const parseJsonLd = (html, label) => {
  const blocks = Array.from(html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi));
  if (blocks.length === 0) {
    fail(`${label}: missing JSON-LD`);
    return [];
  }

  const parsed = [];
  for (const [index, block] of blocks.entries()) {
    try {
      const value = JSON.parse(block[1]);
      parsed.push(...(Array.isArray(value) ? value : [value]));
      pass();
    } catch (error) {
      fail(`${label}: invalid JSON-LD block ${index + 1}: ${error.message}`);
    }
  }

  return parsed;
};

const hasJsonLdType = (value, type) => {
  if (!value || typeof value !== 'object') return false;
  const ownType = value['@type'];
  // @type can be a single string or an array of strings (e.g. ['Beach', 'TouristAttraction']).
  if (ownType === type || (Array.isArray(ownType) && ownType.includes(type))) return true;
  if (Array.isArray(value)) return value.some(item => hasJsonLdType(item, type));
  return Object.values(value).some(item => hasJsonLdType(item, type));
};

const distPathForUrl = absoluteUrl => {
  const url = new URL(absoluteUrl);
  const pathname = decodeURIComponent(url.pathname);
  const localPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return localPath ? path.join(distDir, localPath, 'index.html') : path.join(distDir, 'index.html');
};

const urlLocsFromSitemap = sitemap => Array.from(sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/g))
  .map(match => decodeEntities(match[1]).trim());

const imageLocsFromSitemap = sitemap => Array.from(sitemap.matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/g))
  .map(match => decodeEntities(match[1]).trim());

const checkPage = async ({ label, url, requiredTypes, requiredHreflangs = [], recommendedTypes = [], minInternalBeachLinks = 0 }) => {
  const filePath = distPathForUrl(url);
  if (!await exists(filePath)) {
    fail(`${label}: generated file missing at ${filePath}`);
    return;
  }
  pass();

  const html = await readText(filePath);
  const title = titleOf(html);
  const description = metaContent(html, 'description');
  const robots = metaContent(html, 'robots');
  const canonical = canonicalOf(html);
  const ogImage = metaContent(html, 'og:image');
  const jsonLd = parseJsonLd(html, label);
  const hreflangs = hreflangsOf(html);

  if (!title) fail(`${label}: missing title`);
  else pass();
  if (title.length < 20 || title.length > 70) warn(`${label}: title length is ${title.length} chars`);

  if (!description) fail(`${label}: missing meta description`);
  else pass();
  if (description.length < 70 || description.length > 180) warn(`${label}: description length is ${description.length} chars`);

  if (!/index/i.test(robots) || !/follow/i.test(robots) || !/max-image-preview:large/i.test(robots)) {
    fail(`${label}: robots meta should include index, follow, max-image-preview:large`);
  } else {
    pass();
  }

  if (canonical !== url) fail(`${label}: canonical mismatch. Expected ${url}, got ${canonical || '(missing)'}`);
  else pass();

  if (!ogImage.startsWith(`${siteUrl}/`)) fail(`${label}: og:image should be absolute on ${siteUrl}`);
  else pass();

  for (const type of requiredTypes) {
    if (!jsonLd.some(block => hasJsonLdType(block, type))) fail(`${label}: missing JSON-LD type ${type}`);
    else pass();
  }

  for (const type of recommendedTypes) {
    if (!jsonLd.some(block => hasJsonLdType(block, type))) warn(`${label}: missing recommended JSON-LD type ${type}`);
    else pass();
  }

  // FAQPage, when present, must carry real Question/Answer pairs.
  const faqBlock = jsonLd.find(block => hasJsonLdType(block, 'FAQPage'));
  if (faqBlock) {
    const questions = Array.isArray(faqBlock.mainEntity) ? faqBlock.mainEntity : [];
    const wellFormed = questions.length > 0 && questions.every(q => q?.['@type'] === 'Question' && q?.name && q?.acceptedAnswer?.text);
    if (!wellFormed) fail(`${label}: FAQPage has malformed Question/Answer entries`);
    else pass();
  }

  // Crawlability: the page must link out to other beach pages with real anchors
  // (not just self-canonical), so it is not a dead-end for crawlers.
  if (minInternalBeachLinks > 0) {
    const anchorBeachLinks = (html.match(/<a\s[^>]*href=["'][^"']*\/beaches\/[^"']*["']/gi) || []).length;
    if (anchorBeachLinks < minInternalBeachLinks) fail(`${label}: only ${anchorBeachLinks} internal /beaches/ anchor links, expected >= ${minInternalBeachLinks} (crawl dead-end risk)`);
    else pass();
  }

  for (const hreflang of requiredHreflangs) {
    if (!hreflangs.some(link => link.hreflang === hreflang)) fail(`${label}: missing hreflang ${hreflang}`);
    else pass();
  }

  if (/With mild conditions today/i.test(html)) fail(`${label}: volatile recommendation copy leaked into prerendered HTML`);
  else pass();

  if (/<main[^>]*data-nosnippet=["']true["']/i.test(html)) {
    warn(`${label}: main content is fully data-nosnippet; prefer targeted volatile sections only`);
  }
};

const checkImages = async (imageLocs) => {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    warn('sharp is unavailable; skipped image dimension checks');
  }

  const uniqueImages = Array.from(new Set(imageLocs));
  const missingImages = [];
  const smallImages = [];
  const largeImages = [];

  for (const imageUrl of uniqueImages) {
    if (!imageUrl.startsWith(`${siteUrl}/`)) {
      missingImages.push(`${imageUrl} (external or wrong host)`);
      continue;
    }

    const publicPath = decodeURIComponent(new URL(imageUrl).pathname).replace(/^\/+/, '');
    const imagePath = path.join(distDir, publicPath);
    if (!await exists(imagePath)) {
      missingImages.push(imageUrl);
      continue;
    }

    const imageStat = await stat(imagePath);
    if (imageStat.size > 2 * 1024 * 1024) {
      largeImages.push(`${imageUrl} (${Math.round(imageStat.size / 1024)} KB)`);
    }

    if (sharp) {
      try {
        const metadata = await sharp(imagePath).metadata();
        if ((metadata.width || 0) < 600 || (metadata.height || 0) < 315) {
          smallImages.push(`${imageUrl} (${metadata.width || '?'}x${metadata.height || '?'})`);
        }
      } catch (error) {
        warn(`Could not read image metadata for ${imageUrl}: ${error.message}`);
      }
    }
  }

  if (missingImages.length > 0) fail(`Sitemap references missing images: ${missingImages.slice(0, 8).join(', ')}${missingImages.length > 8 ? ` and ${missingImages.length - 8} more` : ''}`);
  else pass();

  if (smallImages.length > 0) warn(`Small sitemap images found: ${smallImages.slice(0, 8).join(', ')}${smallImages.length > 8 ? ` and ${smallImages.length - 8} more` : ''}`);
  if (largeImages.length > 0) warn(`Large sitemap images found: ${largeImages.slice(0, 8).join(', ')}${largeImages.length > 8 ? ` and ${largeImages.length - 8} more` : ''}`);
};

const checkPerformanceBudget = async () => {
  const assetsDir = path.join(distDir, 'assets');
  if (!await exists(assetsDir)) {
    warn('dist/assets missing; skipped asset budget checks');
    return;
  }

  const entries = await readdir(assetsDir, { withFileTypes: true });
  const assetFiles = await Promise.all(entries
    .filter(entry => entry.isFile())
    .map(async entry => {
      const filePath = path.join(assetsDir, entry.name);
      const fileStat = await stat(filePath);
      return { name: entry.name, size: fileStat.size };
    }));

  const jsFiles = assetFiles.filter(file => file.name.endsWith('.js'));
  const cssFiles = assetFiles.filter(file => file.name.endsWith('.css'));
  const largestJs = jsFiles.reduce((largest, file) => (file.size > largest.size ? file : largest), { name: '', size: 0 });
  const totalJs = jsFiles.reduce((total, file) => total + file.size, 0);
  const totalCss = cssFiles.reduce((total, file) => total + file.size, 0);

  if (largestJs.size > 700 * 1024) warn(`Largest JS chunk is ${Math.round(largestJs.size / 1024)} KB (${largestJs.name}); review code splitting for mobile performance`);
  if (totalJs > 2 * 1024 * 1024) warn(`Total JS assets are ${Math.round(totalJs / 1024)} KB; monitor Core Web Vitals after deploy`);
  if (totalCss > 300 * 1024) warn(`Total CSS assets are ${Math.round(totalCss / 1024)} KB; review critical CSS if PageSpeed flags render blocking`);
  pass();
};

// Walk every prerendered index.html and confirm each hreflang alternate points at
// a file that actually exists. A hreflang link to a missing page is the classic
// multilingual SEO failure (Search Console "no return tag" / soft-404), and it is
// easy to introduce when expanding the localized-region set — so this guards the
// whole tree, not just the sampled pages.
const collectHtmlFiles = async (dir, out = []) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectHtmlFiles(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
};

const routeForHtmlFile = filePath => {
  const relative = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  return `/${relative.replace(/\/index\.html$/, '/')}`;
};

const conditionClaimAuditExemptRoutePattern = /^\/(?:[a-z]{2}\/)?(?:terms|privacy)\//i;

const checkRiskyConditionClaims = async () => {
  const htmlFiles = await collectHtmlFiles(distDir);
  const riskyPages = [];

  for (const file of htmlFiles) {
    const route = routeForHtmlFile(file);
    if (conditionClaimAuditExemptRoutePattern.test(route)) continue;

    const html = await readText(file);
    const visibleText = visibleTextOf(html);
    const hasCurrentConditionData = hasVisibleCurrentConditionData(visibleText);
    const contexts = [
      { field: 'title', text: titleOf(html) },
      { field: 'meta description', text: metaContent(html, 'description') },
      { field: 'h1', text: h1Of(html) },
      { field: 'visible copy', text: visibleText },
    ];

    const findings = contexts.flatMap(context =>
      riskyClaimFindings(context.text, hasCurrentConditionData)
        .map(finding => `${context.field}: ${finding}`)
    );

    if (findings.length > 0) {
      riskyPages.push(`${route} (${Array.from(new Set(findings)).slice(0, 3).join('; ')})`);
    }
  }

  if (riskyPages.length > 0) {
    warn(`Risky static SEO condition wording found on ${riskyPages.length} prerendered page(s); review samples: ${riskyPages.slice(0, 8).join(' | ')}${riskyPages.length > 8 ? ` and ${riskyPages.length - 8} more` : ''}`);
  } else {
    pass();
  }
};

// Titles over ~60 chars get truncated by Google. The deterministic tier logic in
// the prerender should keep every title within budget; this warns if a new/long
// name ever slips through so the tiers can be revisited.
const TITLE_MAX = 60;
const checkTitleLengths = async () => {
  const htmlFiles = await collectHtmlFiles(distDir);
  const longTitles = [];

  for (const file of htmlFiles) {
    const html = await readText(file);
    const title = titleOf(html);
    if (title.length > TITLE_MAX) {
      longTitles.push(`${routeForHtmlFile(file)} (${title.length}: "${title}")`);
    }
  }

  if (longTitles.length > 0) {
    warn(`${longTitles.length} prerendered <title>(s) exceed ${TITLE_MAX} chars and may be truncated in the SERP: ${longTitles.slice(0, 8).join(' | ')}${longTitles.length > 8 ? ` and ${longTitles.length - 8} more` : ''}`);
  } else {
    pass();
  }
};

const checkHreflangIntegrity = async () => {
  const htmlFiles = await collectHtmlFiles(distDir);
  let linksChecked = 0;
  const orphans = [];
  for (const file of htmlFiles) {
    const html = await readText(file);
    for (const { hreflang, href } of hreflangsOf(html)) {
      if (hreflang === 'x-default') continue;
      if (!href.startsWith(siteUrl)) { orphans.push(`${href} (non-canonical origin)`); continue; }
      linksChecked += 1;
      const pathname = decodeURIComponent(href.slice(siteUrl.length)).replace(/^\/+/, '');
      const target = path.join(distDir, pathname, 'index.html');
      if (!await exists(target)) orphans.push(`${href} -> missing ${path.relative(distDir, target)}`);
    }
  }
  if (orphans.length > 0) {
    fail(`${orphans.length} hreflang link(s) point to a non-existent page (orphan alternates): ${orphans.slice(0, 5).join('; ')}${orphans.length > 5 ? ' …' : ''}`);
  } else {
    pass();
  }
  console.log(`Hreflang integrity: ${linksChecked} alternate links across ${htmlFiles.length} pages, ${orphans.length} orphans.`);
};

const main = async () => {
  if (!await exists(distDir)) {
    fail(`dist directory missing at ${distDir}. Run npm run build first.`);
    return;
  }
  pass();

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const robotsPath = path.join(distDir, 'robots.txt');
  const redirectsPath = path.join(distDir, '_redirects');

  if (!await exists(sitemapPath)) fail('dist/sitemap.xml is missing');
  else pass();
  if (!await exists(robotsPath)) fail('dist/robots.txt is missing');
  else pass();
  if (!await exists(redirectsPath)) warn('dist/_redirects is missing; legacy URL redirects may not deploy');

  const sitemap = await readText(sitemapPath);
  const robots = await readText(robotsPath);
  const urls = urlLocsFromSitemap(sitemap);
  const imageLocs = imageLocsFromSitemap(sitemap);

  if (urls.length === 0) fail('sitemap.xml has no URLs');
  else pass();
  if (!sitemap.includes('xmlns:image=')) fail('sitemap.xml is missing the image sitemap namespace');
  else pass();
  if (imageLocs.length < urls.length) fail(`sitemap.xml has ${urls.length} URLs but only ${imageLocs.length} image entries`);
  else pass();
  if (urls.some(url => !url.startsWith(`${siteUrl}/`))) fail(`sitemap.xml contains URLs outside ${siteUrl}`);
  else pass();
  if (!/Sitemap:\s*https:\/\/calmbeach\.gr\/sitemap\.xml/i.test(robots)) fail('robots.txt should point to https://calmbeach.gr/sitemap.xml');
  else pass();

  if (await exists(redirectsPath)) {
    const redirects = await readText(redirectsPath);
    const legacyPaths = redirects
      .split(/\r?\n/)
      .map(line => line.trim().split(/\s+/)[0])
      .filter(Boolean);
    const leakedLegacy = legacyPaths.find(legacyPath => urls.some(url => new URL(url).pathname === legacyPath));
    if (leakedLegacy) fail(`sitemap.xml includes legacy redirected URL ${leakedLegacy}`);
    else pass();
  }

  const sampleBeachUrl = urls.find(url => /\/beaches\/milos\/\d+-/.test(new URL(url).pathname))
    || urls.find(url => /\/beaches\/[^/]+\/\d+-/.test(new URL(url).pathname));
  const sampleIntentUrl = urls.find(url => /^\/(sheltered|family)-beaches\/[^/]+\/$/.test(new URL(url).pathname));

  await checkPage({
    label: 'home',
    url: `${siteUrl}/`,
    requiredTypes: ['WebSite'],
    requiredHreflangs: ['en', 'el', 'x-default'],
  });
  await checkPage({
    label: 'Greek home',
    url: `${siteUrl}/el/`,
    requiredTypes: ['WebSite'],
    requiredHreflangs: ['en', 'el', 'x-default'],
  });
  await checkPage({
    label: 'Milos region',
    url: `${siteUrl}/beaches/milos/`,
    requiredTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
    requiredHreflangs: ['en', 'el', 'x-default'],
  });
  await checkPage({
    label: 'Greek Milos region',
    url: `${siteUrl}/el/beaches/milos/`,
    requiredTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
    requiredHreflangs: ['en', 'el', 'x-default'],
  });
  await checkPage({
    label: 'SEO landing page',
    url: `${siteUrl}/best-beaches-greece-today/`,
    requiredTypes: ['WebPage', 'BreadcrumbList'],
    requiredHreflangs: ['en', 'x-default'],
  });

  if (sampleBeachUrl) {
    await checkPage({
      label: 'sample beach detail',
      url: sampleBeachUrl,
      requiredTypes: ['Beach', 'TouristAttraction', 'GeoCoordinates', 'BreadcrumbList'],
      // FAQPage was intentionally dropped from beach pages: the facts render as a
      // definition list, not visible Q&A, so FAQPage markup would not match
      // visible content. It stays on the category/national pages that show Q&A.
      requiredHreflangs: ['en', 'el', 'x-default'],
      minInternalBeachLinks: 2,
    });
  } else {
    fail('No beach detail URL found in sitemap.xml');
  }

  if (sampleIntentUrl) {
    await checkPage({
      label: 'island intent guide',
      url: sampleIntentUrl,
      requiredTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage'],
      requiredHreflangs: ['en', 'el', 'x-default'],
      minInternalBeachLinks: 2,
    });
  } else {
    warn('No per-island intent guide found in sitemap.xml (did any island clear the minimum?)');
  }

  await checkImages(imageLocs);
  await checkRiskyConditionClaims();
  await checkTitleLengths();
  await checkHreflangIntegrity();
  await checkPerformanceBudget();

  const score = Math.max(0, Math.round(100 - failures.length * 10 - warnings.length * 2));
  console.log(`SEO prerender audit: ${checks} checks, ${failures.length} failures, ${warnings.length} warnings`);
  console.log(`SEO readiness estimate from generated output: ${score}%`);

  for (const message of failures) console.error(`FAIL: ${message}`);
  for (const message of warnings) console.warn(`WARN: ${message}`);

  if (failures.length > 0) process.exitCode = 1;
};

main().catch(error => {
  console.error('Failed to audit prerendered SEO output.', error);
  process.exitCode = 1;
});

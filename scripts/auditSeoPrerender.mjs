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
const metaContent = (html, name) => tagContent(
  html,
  new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']\\s*\\/?>`, 'i')
).trim();
const canonicalOf = html => tagContent(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i).trim();

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
  if (value['@type'] === type) return true;
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

const checkPage = async ({ label, url, requiredTypes, requiredHreflangs = [] }) => {
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
      requiredTypes: ['TouristAttraction', 'GeoCoordinates', 'BreadcrumbList'],
      requiredHreflangs: ['en', 'el', 'x-default'],
    });
  } else {
    fail('No beach detail URL found in sitemap.xml');
  }

  await checkImages(imageLocs);
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

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const reportPath = path.join(projectRoot, '.tmp', 'production-seo-smoke-report.json');

const origin = (process.env.PRODUCTION_ORIGIN || process.env.SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');
const originUrl = new URL(origin);
const timeoutMs = Number(process.env.PRODUCTION_SEO_TIMEOUT_MS || 15000);
const maxAssetChecks = Number(process.env.PRODUCTION_SEO_MAX_ASSETS || 30);

const failures = [];
const warnings = [];
const passed = [];

const normalizePath = value => {
  if (!value) return '/';
  const pathname = value.startsWith('/') ? value : `/${value}`;
  return pathname;
};

const absoluteUrl = value => {
  if (/^https?:\/\//i.test(value)) return value;
  return `${origin}${normalizePath(value)}`;
};

const record = (status, message) => {
  if (status === 'fail') failures.push(message);
  else if (status === 'warn') warnings.push(message);
  else passed.push(message);
};

const decodeEntities = value => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const tagContent = (html, pattern) => {
  const match = html.match(pattern);
  return match ? decodeEntities(match[1]).trim() : '';
};

const titleOf = html => tagContent(html, /<title>([\s\S]*?)<\/title>/i);
const canonicalOf = html => tagContent(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i);
const metaContent = (html, name) => tagContent(
  html,
  new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']\\s*\\/?>`, 'i')
);

const parseJsonLd = html => {
  const blocks = Array.from(html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi));
  const parsed = [];
  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]);
      parsed.push(...(Array.isArray(value) ? value : [value]));
    } catch {
      return { parsed, invalid: true };
    }
  }
  return { parsed, invalid: false };
};

const hasJsonLdType = (value, type) => {
  if (!value || typeof value !== 'object') return false;
  if (value['@type'] === type) return true;
  if (Array.isArray(value)) return value.some(item => hasJsonLdType(item, type));
  return Object.values(value).some(item => hasJsonLdType(item, type));
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': 'CalmBeach production SEO smoke audit',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchText = async (url, options = {}) => {
  const response = await fetchWithTimeout(url, {
    redirect: 'follow',
    ...options,
  });
  const text = await response.text();
  return { response, text };
};

const urlLocsFromSitemap = sitemap => Array.from(sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/g))
  .map(match => decodeEntities(match[1]).trim());

const localAssetRefs = html => {
  const refs = [];
  const tagMatches = html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi);
  for (const match of tagMatches) {
    const ref = decodeEntities(match[1]);
    if (ref.startsWith('/')) refs.push(`${origin}${ref}`);
  }

  const socialImages = ['og:image', 'twitter:image']
    .map(name => metaContent(html, name))
    .filter(Boolean)
    .filter(ref => ref.startsWith(origin));

  return [...refs, ...socialImages];
};

const assertStatus = async (label, url, expectedStatus = 200) => {
  try {
    const response = await fetchWithTimeout(url, { redirect: 'manual' });
    if (response.status === expectedStatus) {
      record('pass', `${label}: ${expectedStatus}`);
      return response;
    }
    record('fail', `${label}: expected ${expectedStatus}, got ${response.status}`);
    return response;
  } catch (error) {
    record('fail', `${label}: request failed (${error.message})`);
    return null;
  }
};

const checkRedirect = async (label, fromPath, expectedToPath) => {
  const fromUrl = absoluteUrl(fromPath);
  const response = await assertStatus(label, fromUrl, 301);
  if (!response) return;

  const location = response.headers.get('location') || '';
  const resolvedLocation = location ? new URL(location, fromUrl).href : '';
  const expectedUrl = absoluteUrl(expectedToPath);
  if (resolvedLocation === expectedUrl) {
    record('pass', `${label}: redirects to ${expectedUrl}`);
  } else {
    record('fail', `${label}: expected redirect to ${expectedUrl}, got ${resolvedLocation || '(missing location)'}`);
  }
};

const checkCanonicalHost = async () => {
  if (originUrl.hostname.startsWith('www.')) return;
  const wwwUrl = `${originUrl.protocol}//www.${originUrl.hostname}/`;
  try {
    const response = await fetchWithTimeout(wwwUrl, { redirect: 'follow' });
    if (response.url === `${origin}/` && response.status === 200) {
      record('pass', `www host canonicalizes to ${origin}/`);
    } else {
      record('warn', `www host final URL is ${response.url} with status ${response.status}`);
    }
  } catch (error) {
    record('warn', `www host check failed (${error.message})`);
  }
};

const checkHtmlPage = async ({ label, pathName, requiredCanonical, requiredJsonLdTypes = [], requiredText = [] }) => {
  const url = absoluteUrl(pathName);
  let response;
  let html;
  try {
    ({ response, text: html } = await fetchText(url));
  } catch (error) {
    record('fail', `${label}: request failed (${error.message})`);
    return [];
  }

  if (response.status !== 200) {
    record('fail', `${label}: expected 200, got ${response.status}`);
    return [];
  }
  record('pass', `${label}: 200`);

  const contentType = response.headers.get('content-type') || '';
  if (/text\/html/i.test(contentType)) record('pass', `${label}: HTML content type`);
  else record('warn', `${label}: unexpected content-type ${contentType || '(missing)'}`);

  const title = titleOf(html);
  const description = metaContent(html, 'description');
  const robots = metaContent(html, 'robots');
  const canonical = canonicalOf(html);
  const jsonLd = parseJsonLd(html);

  if (title) record('pass', `${label}: has title`);
  else record('fail', `${label}: missing title`);

  if (description) record('pass', `${label}: has meta description`);
  else record('fail', `${label}: missing meta description`);

  if (/index/i.test(robots) && /follow/i.test(robots)) record('pass', `${label}: indexable robots meta`);
  else record('fail', `${label}: robots meta is not index/follow`);

  if (canonical === requiredCanonical) record('pass', `${label}: canonical OK`);
  else record('fail', `${label}: expected canonical ${requiredCanonical}, got ${canonical || '(missing)'}`);

  if (jsonLd.invalid) record('fail', `${label}: invalid JSON-LD`);
  else if (jsonLd.parsed.length > 0) record('pass', `${label}: JSON-LD parses`);
  else record('fail', `${label}: missing JSON-LD`);

  for (const type of requiredJsonLdTypes) {
    if (jsonLd.parsed.some(block => hasJsonLdType(block, type))) {
      record('pass', `${label}: has JSON-LD ${type}`);
    } else {
      record('fail', `${label}: missing JSON-LD ${type}`);
    }
  }

  for (const text of requiredText) {
    if (html.includes(text)) record('pass', `${label}: contains ${text}`);
    else record('fail', `${label}: missing required text ${text}`);
  }

  return localAssetRefs(html);
};

const checkAsset = async assetUrl => {
  try {
    let response = await fetchWithTimeout(assetUrl, { method: 'HEAD', redirect: 'follow' });
    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(assetUrl, { method: 'GET', redirect: 'follow' });
    }

    if (response.status === 200) {
      record('pass', `asset OK: ${new URL(assetUrl).pathname}`);
    } else {
      record('fail', `asset failed: ${assetUrl} returned ${response.status}`);
    }
  } catch (error) {
    record('fail', `asset failed: ${assetUrl} (${error.message})`);
  }
};

const main = async () => {
  console.log(`Production SEO smoke audit for ${origin}`);

  const robots = await fetchText(`${origin}/robots.txt`).catch(error => {
    record('fail', `robots.txt request failed (${error.message})`);
    return null;
  });
  if (robots) {
    if (robots.response.status === 200) record('pass', 'robots.txt: 200');
    else record('fail', `robots.txt: expected 200, got ${robots.response.status}`);
    if (robots.text.includes(`${origin}/sitemap.xml`)) record('pass', 'robots.txt points to sitemap');
    else record('fail', 'robots.txt does not point to the production sitemap');
  }

  const sitemapResult = await fetchText(`${origin}/sitemap.xml`).catch(error => {
    record('fail', `sitemap.xml request failed (${error.message})`);
    return null;
  });

  const sitemapUrls = sitemapResult ? urlLocsFromSitemap(sitemapResult.text) : [];
  if (sitemapResult) {
    if (sitemapResult.response.status === 200) record('pass', 'sitemap.xml: 200');
    else record('fail', `sitemap.xml: expected 200, got ${sitemapResult.response.status}`);
    if (sitemapUrls.length >= 1000) record('pass', `sitemap.xml has ${sitemapUrls.length} URLs`);
    else record('fail', `sitemap.xml has only ${sitemapUrls.length} URLs`);

    const requiredUrls = [
      `${origin}/`,
      `${origin}/best-beaches-greece-today/`,
      `${origin}/beaches/milos/`,
      `${origin}/el/beaches/milos/`,
    ];
    for (const requiredUrl of requiredUrls) {
      if (sitemapUrls.includes(requiredUrl)) record('pass', `sitemap includes ${requiredUrl}`);
      else record('fail', `sitemap missing ${requiredUrl}`);
    }

    const legacyUrl = sitemapUrls.find(url => /\/best-beaches-milos-today\/?$/.test(new URL(url).pathname));
    if (legacyUrl) record('fail', `sitemap still includes legacy URL ${legacyUrl}`);
    else record('pass', 'sitemap excludes legacy redirected Milos URL');
  }

  const sampleBeachUrl = sitemapUrls.find(url => /\/beaches\/milos\/\d+-/.test(new URL(url).pathname))
    || sitemapUrls.find(url => /\/beaches\/[^/]+\/\d+-/.test(new URL(url).pathname));
  const sampleIntentUrl = sitemapUrls.find(url => /^\/(sheltered|family)-beaches\/[^/]+\/$/.test(new URL(url).pathname));

  const assetRefs = [];
  assetRefs.push(...await checkHtmlPage({
    label: 'home',
    pathName: '/',
    requiredCanonical: `${origin}/`,
    requiredJsonLdTypes: ['WebSite'],
    requiredText: ['Popular beach guides'],
  }));
  assetRefs.push(...await checkHtmlPage({
    label: 'Greek home',
    pathName: '/el/',
    requiredCanonical: `${origin}/el/`,
    requiredJsonLdTypes: ['WebSite'],
  }));
  assetRefs.push(...await checkHtmlPage({
    label: 'best beaches Greece today',
    pathName: '/best-beaches-greece-today/',
    requiredCanonical: `${origin}/best-beaches-greece-today/`,
    requiredJsonLdTypes: ['WebPage', 'BreadcrumbList'],
  }));
  assetRefs.push(...await checkHtmlPage({
    label: 'Milos region',
    pathName: '/beaches/milos/',
    requiredCanonical: `${origin}/beaches/milos/`,
    requiredJsonLdTypes: ['CollectionPage', 'BreadcrumbList'],
  }));
  assetRefs.push(...await checkHtmlPage({
    label: 'Greek Milos region',
    pathName: '/el/beaches/milos/',
    requiredCanonical: `${origin}/el/beaches/milos/`,
    requiredJsonLdTypes: ['CollectionPage', 'BreadcrumbList'],
  }));
  assetRefs.push(...await checkHtmlPage({
    label: 'German Milos region',
    pathName: '/de/beaches/milos/',
    requiredCanonical: `${origin}/de/beaches/milos/`,
    requiredJsonLdTypes: ['CollectionPage', 'BreadcrumbList'],
  }));

  if (sampleBeachUrl) {
    const samplePath = new URL(sampleBeachUrl).pathname;
    assetRefs.push(...await checkHtmlPage({
      label: 'sample beach detail',
      pathName: samplePath,
      requiredCanonical: sampleBeachUrl,
      requiredJsonLdTypes: ['TouristAttraction', 'BreadcrumbList'],
    }));
  } else {
    record('fail', 'could not find a sample beach detail URL in sitemap');
  }

  if (sampleIntentUrl) {
    const samplePath = new URL(sampleIntentUrl).pathname;
    assetRefs.push(...await checkHtmlPage({
      label: 'sample island intent guide',
      pathName: samplePath,
      requiredCanonical: sampleIntentUrl,
      requiredJsonLdTypes: ['CollectionPage', 'BreadcrumbList', 'FAQPage'],
    }));
  } else {
    record('warn', 'could not find a sample island intent guide in sitemap');
  }

  await checkRedirect('region trailing slash redirect', '/beaches/milos', '/beaches/milos/');
  await checkRedirect('legacy Milos landing redirect', '/best-beaches-milos-today/', '/beaches/milos/');
  await checkRedirect('legacy where-to-swim redirect', '/where-to-swim-greece-today/', '/best-beaches-greece-today/');
  await assertStatus('non-published German Paros page stays 404', `${origin}/de/beaches/paros/`, 404);
  await checkCanonicalHost();

  const uniqueAssets = [...new Set(assetRefs)]
    .filter(assetUrl => {
      try {
        const parsed = new URL(assetUrl);
        return parsed.origin === origin;
      } catch {
        return false;
      }
    })
    .filter(assetUrl => /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|json)$/i.test(new URL(assetUrl).pathname))
    .slice(0, maxAssetChecks);

  for (const assetUrl of uniqueAssets) {
    await checkAsset(assetUrl);
  }

  const report = {
    ok: failures.length === 0,
    origin,
    passed: passed.length,
    warnings,
    failures,
    checkedAssets: uniqueAssets.map(assetUrl => new URL(assetUrl).pathname),
    generatedAt: new Date().toISOString(),
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Production SEO smoke audit: ${passed.length} passed, ${warnings.length} warnings, ${failures.length} failures`);
  console.log(`Report: ${path.relative(projectRoot, reportPath).replaceAll(path.sep, '/')}`);

  for (const message of warnings) console.warn(`WARN: ${message}`);
  for (const message of failures) console.error(`FAIL: ${message}`);

  if (failures.length > 0) process.exitCode = 1;
};

main().catch(error => {
  console.error('Production SEO smoke audit crashed.', error);
  process.exitCode = 1;
});

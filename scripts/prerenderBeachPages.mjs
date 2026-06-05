import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');
const indexHtmlPath = path.join(distDir, 'index.html');
const beachIndexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));

const toPublicFilePath = publicPath => path.join(publicDir, publicPath.replace(/^\/+/, ''));

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeXml = escapeHtml;

const normalizeSlug = value => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'beach';
};

const localized = (value, fallback = '') => (
  value?.en || value?.gr || value?.fr || value?.de || value?.it || fallback
);

const regionSlug = (region, island) => normalizeSlug(
  localized(region?.name, '') || localized(island?.name, '') || region?.id
);

const regionPath = (region, island) => `/beaches/${encodeURIComponent(regionSlug(region, island))}/`;

const beachPath = (region, island, beach) => (
  `${regionPath(region, island)}${beach.id}-${normalizeSlug(localized(beach.name, `beach-${beach.id}`))}/`
);

const legacyRegionPath = regionId => `/beaches/${encodeURIComponent(regionId)}/`;

const setOrAppendHeadTag = (html, pattern, tag) => {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
};

const injectBeachHead = (html, meta) => {
  let nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:type" content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType || 'article')}" />`
  );

  const jsonLd = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
  const extraHead = [
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ');

  return nextHtml.replace('</head>', `    ${extraHead}\n  </head>`);
};

const staticBeachFallback = (beach, island, canonicalUrl) => {
  const beachName = localized(beach.name, `Beach ${beach.id}`);
  const islandName = localized(island.name, island.id);
  const description = localized(
    beach.description,
    `${beachName} beach in ${islandName}, Greece. Check today's wind, waves and weather before you go.`
  );
  const amenityLabels = [
    beach.amenities?.organized ? 'Organized beach' : null,
    beach.amenities?.beachBar ? 'Beach bar' : null,
    beach.amenities?.sunbeds ? 'Sunbeds' : null,
    beach.amenities?.parking ? 'Parking' : null,
    beach.amenities?.restaurant || beach.amenities?.taverna ? 'Food nearby' : null,
    beach.environment?.familyFriendly ? 'Family friendly' : null,
    beach.environment?.quiet ? 'Quiet' : null,
    beach.activities?.snorkeling ? 'Snorkeling' : null,
  ].filter(Boolean);

  return `
    <div id="root">
      <main style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">Calm Beach Greece</p>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(beachName)} Beach, ${escapeHtml(islandName)}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(description)}</p>
        <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 14px;margin:0 0 20px;">
          <dt style="font-weight:700;">Region</dt><dd style="margin:0;">${escapeHtml(islandName)}, Greece</dd>
          <dt style="font-weight:700;">Beach type</dt><dd style="margin:0;">${escapeHtml(beach.beachType || 'Unknown')}</dd>
          <dt style="font-weight:700;">Access</dt><dd style="margin:0;">${escapeHtml(beach.staticLabels?.accessType || beach.accessibility || 'Unknown')}</dd>
          <dt style="font-weight:700;">Coordinates</dt><dd style="margin:0;">${escapeHtml(beach.coordinates?.lat)}, ${escapeHtml(beach.coordinates?.lon)}</dd>
        </dl>
        ${amenityLabels.length > 0 ? `<ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;padding:0;list-style:none;">${amenityLabels.map(label => `<li style="border:1px solid #bae6fd;border-radius:999px;padding:6px 10px;background:white;color:#075985;font-weight:700;font-size:13px;">${escapeHtml(label)}</li>`).join('')}</ul>` : ''}
        <p style="margin:0;color:#475569;">Open the app for today's recommendation score, wind exposure, waves, best time of day and nearby alternatives.</p>
        <p style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">View this beach in Calm Beach Greece</a></p>
      </main>
    </div>
  `;
};

const staticRegionFallback = (island, region, canonicalUrl) => {
  const islandName = localized(island.name, region.id);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const beachItems = beaches
    .slice(0, 80)
    .map(beach => {
      const beachName = localized(beach.name, `Beach ${beach.id}`);
      return `
          <li style="margin:0;">
            <a href="${escapeHtml(beachPath(region, island, beach))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
              <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
              <span style="display:block;margin-top:4px;color:#475569;font-size:14px;">${escapeHtml(beach.beachType || 'Beach')} - ${escapeHtml(beach.staticLabels?.accessType || beach.accessibility || 'Access varies')}</span>
            </a>
          </li>
        `;
    })
    .join('');

  return `
    <div id="root">
      <main style="max-width:840px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">Calm Beach Greece</p>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(islandName)} beaches</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">Explore ${escapeHtml(beaches.length)} beaches in ${escapeHtml(islandName)}, Greece. Open the app for today's recommendation score, wind exposure, waves and best time of day.</p>
        ${beachItems ? `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 20px;padding:0;list-style:none;">${beachItems}</ul>` : ''}
        <p style="margin:0;color:#475569;">Weather and sea conditions change during the day. Calm Beach uses the app view for today's live beach recommendations.</p>
        <p style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">View ${escapeHtml(islandName)} in Calm Beach Greece</a></p>
      </main>
    </div>
  `;
};

const buildRegionPage = (baseHtml, island, region) => {
  const pathName = regionPath(region, island);
  const canonicalUrl = `${siteUrl}${pathName}`;
  const islandName = localized(island.name, region.id);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const description = `${islandName} beaches in Greece. Compare ${beaches.length} beaches and open the app for today's wind, waves, weather and beach recommendations.`;
  const title = `${islandName} Beaches | Calm Beach Greece`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${islandName} beaches`,
    description,
    url: canonicalUrl,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: beaches.length,
      itemListElement: beaches.slice(0, 80).map((beach, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: localized(beach.name, `Beach ${beach.id}`),
        url: `${siteUrl}${beachPath(region, island, beach)}`,
      })),
    },
  };

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticRegionFallback(island, region, canonicalUrl));
};

const buildBeachPage = (baseHtml, island, beach, region) => {
  const pathName = beachPath(region, island, beach);
  const canonicalUrl = `${siteUrl}${pathName}`;
  const beachName = localized(beach.name, `Beach ${beach.id}`);
  const islandName = localized(island.name, region.id);
  const description = localized(
    beach.description,
    `${beachName} beach in ${islandName}, Greece. Check today's wind, waves and weather before you go.`
  );
  const title = `${beachName} Beach in ${islandName} | Calm Beach Greece`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: `${beachName} Beach`,
    description,
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GR',
      addressRegion: islandName,
    },
    geo: beach.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: beach.coordinates.lat,
      longitude: beach.coordinates.lon,
    } : undefined,
  };

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticBeachFallback(beach, island, canonicalUrl));
};

const main = async () => {
  const [baseHtml, beachIndex] = await Promise.all([
    readFile(indexHtmlPath, 'utf8'),
    readJson(beachIndexPath),
  ]);

  const sitemapUrls = [`${siteUrl}/`];
  const redirects = [];
  let pageCount = 0;
  let regionPageCount = 0;

  for (const region of beachIndex.regions || []) {
    const summaryPath = region.summaryDataPath || `/data/beaches/app/summary/${region.id}.json`;
    let payload;

    try {
      payload = await readJson(toPublicFilePath(summaryPath));
    } catch {
      payload = await readJson(toPublicFilePath(region.appDataPath || `/data/beaches/app/${region.id}.json`));
    }

    const island = payload.island;
    if (!island?.id || !Array.isArray(island.beaches)) continue;

    const currentRegionPath = regionPath(region, island);
    const currentLegacyRegionPath = legacyRegionPath(region.id);
    if (currentLegacyRegionPath !== currentRegionPath) {
      redirects.push(`${currentLegacyRegionPath} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath.replace(/\/$/, '')} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath}* ${currentRegionPath}:splat 301`);
    }

    const regionOutputDir = path.join(distDir, currentRegionPath.replace(/^\/+/, ''));
    await mkdir(regionOutputDir, { recursive: true });
    await writeFile(path.join(regionOutputDir, 'index.html'), buildRegionPage(baseHtml, island, region), 'utf8');
    sitemapUrls.push(`${siteUrl}${currentRegionPath}`);
    regionPageCount += 1;

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;

      const routePath = beachPath(region, island, beach);
      const outputDir = path.join(distDir, routePath.replace(/^\/+/, ''));
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, 'index.html'), buildBeachPage(baseHtml, island, beach, region), 'utf8');
      sitemapUrls.push(`${siteUrl}${routePath}`);
      pageCount += 1;
    }
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapUrls.map(url => `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
  if (redirects.length > 0) {
    await writeFile(path.join(distDir, '_redirects'), `${redirects.join('\n')}\n`, 'utf8');
  }
  console.log(`Prerendered ${regionPageCount} region pages, ${pageCount} beach pages, ${redirects.length} redirects and sitemap.xml`);
};

main().catch(error => {
  console.error('Failed to prerender beach pages.', error);
  process.exitCode = 1;
});

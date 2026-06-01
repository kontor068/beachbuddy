import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = 'https://pixabay.com/api/';
const SOURCE = 'pixabay';
const ENV_VAR = 'PIXABAY_API_KEY';
const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'beach-images');
const PIXABAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HEADERS = {
  'User-Agent': 'CalmBeachMilosPhotoDiscovery/1.0 (local development; Calm Beach Greece)',
};
const responseMemo = new Map();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const ensureDir = async filePath => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const safeSlug = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'pixabay-image';

const extensionFromContentType = contentType => {
  if (/png/i.test(contentType)) return '.png';
  if (/webp/i.test(contentType)) return '.webp';
  if (/gif/i.test(contentType)) return '.gif';
  return '.jpg';
};

const recordAsset = (stats, key, amount = 1) => {
  if (!stats) return;
  stats[key] = (stats[key] || 0) + amount;
};

const cachePathFor = (cacheDir, url) => {
  const redactedUrl = url.replace(process.env[ENV_VAR] || '', '[PIXABAY_API_KEY]');
  const hash = crypto.createHash('sha256').update(`${SOURCE}:${redactedUrl}`).digest('hex');
  return path.join(cacheDir, SOURCE, `${hash}.json`);
};

const record = (stats, key, amount = 1) => {
  if (!stats) return;
  stats[key] = (stats[key] || 0) + amount;
};

const recordSource = (stats, key, source = SOURCE, amount = 1) => {
  if (!stats) return;
  stats[key] = stats[key] || {};
  stats[key][source] = (stats[key][source] || 0) + amount;
};

const readFreshCache = async cachePath => {
  const stat = await fs.stat(cachePath);
  if (Date.now() - stat.mtimeMs > PIXABAY_CACHE_TTL_MS) return undefined;
  return JSON.parse(await fs.readFile(cachePath, 'utf8'));
};

const cachedJsonFetch = async (url, options = {}) => {
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  const cachePath = cachePathFor(cacheDir, url);
  const stats = options.stats;

  if (responseMemo.has(url)) {
    recordSource(stats, 'cacheHits');
    return responseMemo.get(url);
  }

  try {
    const data = await readFreshCache(cachePath);
    if (data) {
      responseMemo.set(url, data);
      recordSource(stats, 'cacheHits');
      return data;
    }
  } catch {
    // Cache miss or stale cache; fetch below.
  }

  recordSource(stats, 'apiRequestCounts');
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`${SOURCE} request failed ${response.status}`);
  }

  const data = await response.json();
  await ensureDir(cachePath);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
  responseMemo.set(url, data);
  await delay(options.delayMs ?? 350);
  return data;
};

const normalizeCandidate = (raw, searchQueryUsed) => ({
  source: SOURCE,
  providerImageId: raw.id ? String(raw.id) : '',
  fileTitle: raw.tags || '',
  imageUrl: raw.largeImageURL || raw.webformatURL || '',
  thumbnailUrl: raw.webformatURL || raw.previewURL || raw.largeImageURL || '',
  temporaryImageUrl: raw.largeImageURL || raw.webformatURL || '',
  temporaryThumbnailUrl: raw.webformatURL || raw.previewURL || raw.largeImageURL || '',
  requiresLocalDownload: true,
  sourcePageUrl: raw.pageURL || '',
  license: 'Pixabay License',
  licenseUrl: 'https://pixabay.com/service/license-summary/',
  author: raw.user || '',
  attributionText: raw.user ? `Photo by ${raw.user} on Pixabay` : '',
  requiresAttribution: false,
  width: Number(raw.imageWidth) || 0,
  height: Number(raw.imageHeight) || 0,
  dimensions: {
    width: Number(raw.imageWidth) || 0,
    height: Number(raw.imageHeight) || 0,
  },
  candidateText: `${raw.tags || ''} ${raw.user || ''} ${raw.pageURL || ''}`,
  searchQueryUsed,
});

const downloadImageAsset = async (url, outputBasePath, publicBasePath, options = {}) => {
  if (!url) return undefined;

  const existingExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  for (const extension of existingExtensions) {
    const existingPath = `${outputBasePath}${extension}`;
    try {
      await fs.access(existingPath);
      recordAsset(options.stats, 'pixabayAssetCacheHits');
      return `${publicBasePath}${extension}`;
    } catch {
      // Asset is not present with this extension.
    }
  }

  const response = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!response.ok) {
    throw new Error(`Pixabay asset download failed ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Pixabay asset download returned non-image content type: ${contentType || 'unknown'}`);
  }

  const extension = extensionFromContentType(contentType);
  const outputPath = `${outputBasePath}${extension}`;
  await ensureDir(outputPath);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, bytes);
  recordAsset(options.stats, 'pixabayAssetsDownloaded');
  await delay(options.delayMs ?? 350);
  return `${publicBasePath}${extension}`;
};

export const localizePixabayCandidate = async (candidate, options = {}) => {
  if (candidate?.source !== SOURCE) return candidate;

  const assetDir = options.assetDir;
  const publicUrlPrefix = options.publicUrlPrefix;
  if (!assetDir || !publicUrlPrefix) {
    return {
      ...candidate,
      confidence: Math.min(Number(candidate.confidence || 0), 0.39),
      matchReason: `${candidate.matchReason || ''}; capped: Pixabay asset was not localized for static app use`.replace(/^;\s*/, ''),
    };
  }

  try {
    const id = candidate.providerImageId || crypto.createHash('sha1').update(candidate.sourcePageUrl || candidate.imageUrl).digest('hex').slice(0, 12);
    const baseName = `${safeSlug(options.beachName)}-${options.beachId || 'beach'}-${id}`;
    const outputBasePath = path.join(assetDir, baseName);
    const publicBasePath = `${publicUrlPrefix.replace(/\/$/, '')}/${baseName}`;
    const localizedImageUrl = await downloadImageAsset(candidate.temporaryImageUrl || candidate.imageUrl, `${outputBasePath}-large`, `${publicBasePath}-large`, options);
    const localizedThumbnailUrl = await downloadImageAsset(candidate.temporaryThumbnailUrl || candidate.thumbnailUrl, `${outputBasePath}-thumb`, `${publicBasePath}-thumb`, options);

    if (!localizedImageUrl || !localizedThumbnailUrl) {
      throw new Error('missing localized Pixabay image or thumbnail URL');
    }

    return {
      ...candidate,
      imageUrl: localizedImageUrl,
      thumbnailUrl: localizedThumbnailUrl,
      matchReason: `${candidate.matchReason || ''}; Pixabay asset stored locally for static app use`.replace(/^;\s*/, ''),
    };
  } catch (error) {
    if (options.stats) {
      options.stats.errors = options.stats.errors || [];
      options.stats.errors.push({
        source: SOURCE,
        query: candidate.searchQueryUsed,
        message: error.message,
      });
    }

    return {
      ...candidate,
      confidence: Math.min(Number(candidate.confidence || 0), 0.39),
      matchReason: `${candidate.matchReason || ''}; capped: Pixabay asset download failed (${error.message})`.replace(/^;\s*/, ''),
      imageUrl: '',
      thumbnailUrl: '',
    };
  }
};

export const getPixabayStatus = () => ({
  source: SOURCE,
  envVar: ENV_VAR,
  configured: Boolean(process.env[ENV_VAR]),
});

export const searchPixabayImages = async (query, options = {}) => {
  if (!process.env[ENV_VAR]) {
    record(options.stats, 'skippedRequests');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: process.env[ENV_VAR],
      q: query,
      lang: options.lang || 'en',
      image_type: 'photo',
      orientation: 'horizontal',
      category: options.category || 'travel',
      min_width: String(options.minWidth || 800),
      min_height: String(options.minHeight || 500),
      safesearch: 'true',
      order: options.order || 'popular',
      per_page: String(options.perPage || 10),
    });
    const data = await cachedJsonFetch(`${API_URL}?${params.toString()}`, options);
    return (data.hits || [])
      .map(item => normalizeCandidate(item, query))
      .filter(item => item.imageUrl && item.thumbnailUrl && item.sourcePageUrl && item.author);
  } catch (error) {
    if (options.stats) {
      options.stats.errors = options.stats.errors || [];
      options.stats.errors.push({ source: SOURCE, query, message: error.message });
    }
    console.warn(`${SOURCE} skipped for "${query}": ${error.message}`);
    return [];
  }
};

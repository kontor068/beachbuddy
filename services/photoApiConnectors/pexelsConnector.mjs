import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = 'https://api.pexels.com/v1/search';
const SOURCE = 'pexels';
const ENV_VAR = 'PEXELS_API_KEY';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'beach-images');
const DEFAULT_HEADERS = {
  'User-Agent': 'CalmBeachMilosPhotoDiscovery/1.0 (local development; Calm Beach Greece)',
};
const responseMemo = new Map();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const ensureDir = async filePath => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const cachePathFor = (cacheDir, url) => {
  const hash = crypto.createHash('sha256').update(`${SOURCE}:${url}`).digest('hex');
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
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return undefined;
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

  if (!options.refreshCache) {
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
  }

  recordSource(stats, 'apiRequestCounts');
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: process.env[ENV_VAR],
    },
  });

  if (!response.ok) {
    throw new Error(`${SOURCE} request failed ${response.status}`);
  }

  const data = await response.json();
  if (stats) {
    stats.rateLimits = stats.rateLimits || {};
    stats.rateLimits[SOURCE] = {
      limit: response.headers.get('x-ratelimit-limit') || '',
      remaining: response.headers.get('x-ratelimit-remaining') || '',
      reset: response.headers.get('x-ratelimit-reset') || '',
    };
  }
  await ensureDir(cachePath);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
  responseMemo.set(url, data);
  await delay(options.delayMs ?? 350);
  return data;
};

const normalizeCandidate = (raw, searchQueryUsed) => ({
  source: SOURCE,
  providerImageId: raw.id ? String(raw.id) : '',
  altText: raw.alt || '',
  fileTitle: raw.alt || '',
  imageUrl: raw.src?.landscape || raw.src?.large2x || raw.src?.large || raw.src?.original || '',
  thumbnailUrl: raw.src?.medium || raw.src?.small || raw.src?.tiny || raw.src?.large || '',
  sourcePageUrl: raw.url || '',
  license: 'Pexels License',
  licenseUrl: 'https://www.pexels.com/license/',
  author: raw.photographer || '',
  photographer: raw.photographer || '',
  photographerUrl: raw.photographer_url || '',
  attributionText: raw.photographer ? `Photo by ${raw.photographer} on Pexels` : 'Photo on Pexels',
  requiresAttribution: true,
  width: Number(raw.width) || 0,
  height: Number(raw.height) || 0,
  dimensions: {
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
  },
  candidateText: `${raw.alt || ''} ${raw.photographer || ''} ${raw.url || ''}`,
  searchQueryUsed,
});

export const getPexelsStatus = () => ({
  source: SOURCE,
  envVar: ENV_VAR,
  configured: Boolean(process.env[ENV_VAR]),
});

export const searchPexelsImages = async (query, options = {}) => {
  if (!process.env[ENV_VAR]) {
    record(options.stats, 'skippedRequests');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(options.perPage || 10),
      orientation: 'landscape',
      size: options.size || 'large',
      locale: options.locale || 'en-US',
    });
    const data = await cachedJsonFetch(`${API_URL}?${params.toString()}`, options);
    return (data.photos || [])
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

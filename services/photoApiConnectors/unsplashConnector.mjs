import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = 'https://api.unsplash.com/search/photos';
const SOURCE = 'unsplash';
const ENV_VAR = 'UNSPLASH_ACCESS_KEY';
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
      const data = JSON.parse(await fs.readFile(cachePath, 'utf8'));
      responseMemo.set(url, data);
      recordSource(stats, 'cacheHits');
      return data;
    } catch {
      // Cache miss; fetch below.
    }
  }

  recordSource(stats, 'apiRequestCounts');
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Client-ID ${process.env[ENV_VAR]}`,
    },
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
  fileTitle: raw.description || raw.alt_description || '',
  imageUrl: raw.urls?.regular || raw.urls?.full || '',
  thumbnailUrl: raw.urls?.small || raw.urls?.thumb || raw.urls?.regular || '',
  sourcePageUrl: raw.links?.html || '',
  license: 'Unsplash License',
  licenseUrl: 'https://unsplash.com/license',
  author: raw.user?.name || '',
  attributionText: raw.user?.name ? `Photo by ${raw.user.name} on Unsplash` : '',
  requiresAttribution: false,
  width: Number(raw.width) || 0,
  height: Number(raw.height) || 0,
  dimensions: {
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
  },
  candidateText: `${raw.description || ''} ${raw.alt_description || ''} ${raw.user?.name || ''} ${raw.location?.name || ''}`,
  searchQueryUsed,
});

export const getUnsplashStatus = () => ({
  source: SOURCE,
  envVar: ENV_VAR,
  configured: Boolean(process.env[ENV_VAR]),
});

export const searchUnsplashImages = async (query, options = {}) => {
  if (!process.env[ENV_VAR]) {
    record(options.stats, 'skippedRequests');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(options.perPage || 10),
      orientation: 'landscape',
      content_filter: 'high',
    });
    const data = await cachedJsonFetch(`${API_URL}?${params.toString()}`, options);
    return (data.results || [])
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

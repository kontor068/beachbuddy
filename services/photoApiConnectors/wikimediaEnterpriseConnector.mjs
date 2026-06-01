import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'wikimedia_enterprise';
const AUTH_URL = 'https://auth.enterprise.wikimedia.com/v1/login';
const STRUCTURED_CONTENTS_URL = 'https://api.enterprise.wikimedia.com/v2/structured-contents';
const ACCESS_TOKEN_ENV = 'WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN';
const USERNAME_ENV = 'WIKIMEDIA_ENTERPRISE_USERNAME';
const PASSWORD_ENV = 'WIKIMEDIA_ENTERPRISE_PASSWORD';
const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'beach-images');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HEADERS = {
  'User-Agent': 'CalmBeachMilosPhotoDiscovery/1.0 (local development; Calm Beach Greece)',
};
const responseMemo = new Map();
let accessTokenPromise;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const ensureDir = async filePath => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

const cachePathFor = (cacheDir, url, body) => {
  const hash = crypto
    .createHash('sha256')
    .update(`${SOURCE}:${url}:${JSON.stringify(body || {})}`)
    .digest('hex');
  return path.join(cacheDir, SOURCE, `${hash}.json`);
};

const readFreshCache = async cachePath => {
  const stat = await fs.stat(cachePath);
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return undefined;
  return JSON.parse(await fs.readFile(cachePath, 'utf8'));
};

const getAccessToken = async options => {
  if (process.env[ACCESS_TOKEN_ENV]) return process.env[ACCESS_TOKEN_ENV];
  if (accessTokenPromise) return accessTokenPromise;

  const username = process.env[USERNAME_ENV];
  const password = process.env[PASSWORD_ENV];
  if (!username || !password) return '';

  accessTokenPromise = (async () => {
    recordSource(options.stats, 'apiRequestCounts');
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.toLowerCase(), password }),
    });

    if (!response.ok) {
      throw new Error(`${SOURCE} login failed ${response.status}`);
    }

    const data = await response.json();
    return data.access_token || '';
  })();

  return accessTokenPromise;
};

const cachedJsonPost = async (url, body, options = {}) => {
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  const cachePath = cachePathFor(cacheDir, url, body);
  const memoKey = `${url}:${JSON.stringify(body)}`;
  const stats = options.stats;

  if (responseMemo.has(memoKey)) {
    recordSource(stats, 'cacheHits');
    return responseMemo.get(memoKey);
  }

  if (!options.refreshCache) {
    try {
      const data = await readFreshCache(cachePath);
      if (data) {
        responseMemo.set(memoKey, data);
        recordSource(stats, 'cacheHits');
        return data;
      }
    } catch {
      // Cache miss or stale cache; fetch below.
    }
  }

  const accessToken = await getAccessToken(options);
  if (!accessToken) return [];

  recordSource(stats, 'apiRequestCounts');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${SOURCE} request failed ${response.status}`);
  }

  const data = await response.json();
  await ensureDir(cachePath);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
  responseMemo.set(memoKey, data);
  await delay(options.delayMs ?? 350);
  return data;
};

const normalizeImageHint = (article, articleName, projectIdentifier) => {
  const image = article?.image || {};
  const contentUrl = image.content_url || '';
  if (!contentUrl) return null;

  return {
    source: SOURCE,
    contentUrl,
    caption: image.caption || '',
    alternativeText: image.alternative_text || '',
    articleName: article.name || articleName,
    articleUrl: article.url || '',
    projectIdentifier: article.is_part_of?.identifier || projectIdentifier,
    projectName: article.is_part_of?.name || '',
    articleLicense: article.license?.name || '',
    articleLicenseUrl: article.license?.url || '',
  };
};

export const getWikimediaEnterpriseStatus = () => ({
  source: SOURCE,
  envVar: `${ACCESS_TOKEN_ENV} or ${USERNAME_ENV}/${PASSWORD_ENV}`,
  configured: Boolean(process.env[ACCESS_TOKEN_ENV]) || Boolean(process.env[USERNAME_ENV] && process.env[PASSWORD_ENV]),
});

export const lookupWikimediaEnterpriseImageHints = async (articleName, options = {}) => {
  if (!getWikimediaEnterpriseStatus().configured) {
    record(options.stats, 'skippedRequests');
    return [];
  }

  const projects = options.projects || ['enwiki', 'elwiki'];
  const hints = [];

  for (const projectIdentifier of projects) {
    try {
      const url = `${STRUCTURED_CONTENTS_URL}/${encodeURIComponent(articleName.replace(/\s+/g, '_'))}`;
      const body = {
        fields: [
          'name',
          'url',
          'description',
          'image',
          'is_part_of',
          'license',
        ],
        filters: [
          {
            field: 'is_part_of.identifier',
            value: projectIdentifier,
          },
        ],
        limit: 1,
      };
      const data = await cachedJsonPost(url, body, options);
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const hint = normalizeImageHint(row, articleName, projectIdentifier);
        if (hint) hints.push(hint);
      }
    } catch (error) {
      if (options.stats) {
        options.stats.errors = options.stats.errors || [];
        options.stats.errors.push({ source: SOURCE, query: articleName, projectIdentifier, message: error.message });
      }
      console.warn(`${SOURCE} skipped for "${articleName}" (${projectIdentifier}): ${error.message}`);
    }
  }

  return hints;
};

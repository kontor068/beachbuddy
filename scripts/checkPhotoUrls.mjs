/**
 * Find every Commons/wm() photo URL the app renders that is now a 404 (file
 * deleted/renamed on Wikimedia → broken image on a beach card).
 *
 * Inputs (the displayed-photo set + the Milos verified branch):
 *   - reports/photo-coverage/displayed-photos.json  (by-id + name-map URLs)
 *   - src/data/beachImages.milos.json               (verified imageUrl/thumbnailUrl)
 *
 * Method: existence is checked through the Commons **API** (action=query,
 * prop=imageinfo, redirects=1) in batches of 50 titles — one request authoritatively
 * tells us which of 50 files are `missing`. This is fast (~30 requests for the whole
 * set) and, unlike hammering Special:Redirect 1400× , can't be fooled by CDN
 * rate-limiting. The few non-Commons (Flickr) URLs fall back to a throttle-safe HTTP
 * GET. Classification is conservative: only a real `missing` (or HTTP 404/410) is
 * "broken"; transient failures are reported "uncertain", never broken.
 *
 * Output: reports/photo-coverage/broken-urls.json  + console summary.
 * Run:  node scripts/checkPhotoUrls.mjs        (no OSM/Overpass — Wikimedia/Flickr only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const reportDir = path.join(ROOT, 'reports', 'photo-coverage');
const displayedPath = path.join(reportDir, 'displayed-photos.json');
const milosPath = path.join(ROOT, 'src', 'data', 'beachImages.milos.json');
const outPath = path.join(reportDir, 'broken-urls.json');

const UA = 'calmbeach-photo-linkcheck/1.0 (https://calmbeach.gr; marismiltos@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// URL -> Commons File title (or 'flickr' for non-Commons).
// ---------------------------------------------------------------------------
const titleFromUrl = (url) => {
  // wm() / Special:Redirect/file/<name>&width=...
  let m = url.match(/Special:Redirect\/file\/([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  // direct upload.wikimedia.org — .../commons/a/a8/Name.JPG  or
  // .../commons/thumb/a/a8/Name.JPG/960px-Name.JPG  (thumb → real file is 2nd-last seg)
  if (/upload\.wikimedia\.org/.test(url)) {
    const segs = url.split('?')[0].split('/');
    const seg = /\/thumb\//.test(url) ? segs[segs.length - 2] : segs[segs.length - 1];
    return decodeURIComponent(seg);
  }
  return null; // flickr / other
};

// ---------------------------------------------------------------------------
// 1. Collect refs + URL back-map.
// ---------------------------------------------------------------------------
const refs = new Map(); // url -> [{beachId, src, nameGr, nameEn, isl, sourceFile, file}]
const addRef = (url, ref) => {
  if (!url) return;
  if (!refs.has(url)) refs.set(url, []);
  refs.get(url).push(ref);
};

const displayed = JSON.parse(fs.readFileSync(displayedPath, 'utf8'));
for (const d of displayed) {
  const sourceFile =
    d.src === 'by-id' ? 'data/beachPhotosById.generated.json'
    : d.src === 'name-map' ? 'services/beachPhotos.ts'
    : d.src;
  addRef(d.url, {
    beachId: d.beachId, src: d.src, nameGr: d.nameGr, nameEn: d.nameEn,
    isl: d.isl, sourceFile, file: titleFromUrl(d.url) || d.url,
  });
}

const milos = JSON.parse(fs.readFileSync(milosPath, 'utf8'));
for (const e of milos) {
  if (e.imageStatus !== 'verified') continue;
  for (const [field, url] of [['imageUrl', e.imageUrl], ['thumbnailUrl', e.thumbnailUrl]]) {
    if (!url) continue;
    addRef(url, {
      beachId: e.beachId, src: `milos:${field}`, nameGr: e.beachNameEl,
      nameEn: e.beachName, isl: 'Milos',
      sourceFile: 'src/data/beachImages.milos.json', file: e.fileTitle || titleFromUrl(url) || url,
    });
  }
}

const urls = [...refs.keys()];
const commonsUrls = [];
const flickrUrls = [];
for (const u of urls) (titleFromUrl(u) ? commonsUrls : flickrUrls).push(u);
process.stderr.write(
  `Checking ${urls.length} unique URLs (${commonsUrls.length} Commons via API, ${flickrUrls.length} Flickr via HTTP)\n`,
);

// ---------------------------------------------------------------------------
// 2. Commons API existence check (batches of 50).
// ---------------------------------------------------------------------------
const getJson = async (url) => {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue; }
      return null;
    } catch { await sleep(800 * (a + 1)); }
  }
  return null;
};

const present = new Set();   // final page titles that exist
const missing = new Set();   // final page titles flagged missing
const normMap = new Map();   // raw "File:x" -> normalized
const redirMap = new Map();  // normalized -> redirect target

const resolveTitle = (t) => {
  let cur = normMap.get(t) || t;
  for (let i = 0; i < 5 && redirMap.has(cur); i++) cur = redirMap.get(cur);
  return cur;
};

const fileToUrls = new Map(); // "File:title" -> [urls] (a file can back several urls)
for (const u of commonsUrls) {
  const ft = 'File:' + titleFromUrl(u);
  if (!fileToUrls.has(ft)) fileToUrls.set(ft, []);
  fileToUrls.get(ft).push(u);
}
const titleList = [...fileToUrls.keys()];

let apiDone = 0;
for (let i = 0; i < titleList.length; i += 50) {
  const batch = titleList.slice(i, i + 50);
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', redirects: '1',
    prop: 'imageinfo', iiprop: 'url',
    titles: batch.join('|'),
  });
  const d = await getJson(u);
  if (!d) { process.stderr.write(`  batch @${i} failed (will mark uncertain)\n`); await sleep(400); continue; }
  for (const n of d.query?.normalized || []) normMap.set(n.from, n.to);
  for (const rd of d.query?.redirects || []) redirMap.set(rd.from, rd.to);
  for (const p of Object.values(d.query?.pages || {})) {
    if ('missing' in p || p.missing === '') missing.add(p.title);
    else present.add(p.title);
  }
  apiDone += batch.length;
  if (apiDone % 200 === 0 || apiDone >= titleList.length) {
    process.stderr.write(`  API ${apiDone}/${titleList.length}  present=${present.size} missing=${missing.size}\n`);
  }
  await sleep(250);
}

// ---------------------------------------------------------------------------
// 3. Flickr HTTP fallback (small set).
// ---------------------------------------------------------------------------
const httpStatus = async (url) => {
  for (let a = 0; a < 3; a++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA }, signal: ac.signal });
      clearTimeout(to);
      try { await r.body?.cancel(); } catch {}
      if (r.status === 200) return 200;
      if (r.status === 404 || r.status === 410) return r.status;
      await sleep(1000 * (a + 1));
    } catch { clearTimeout(to); await sleep(1000 * (a + 1)); }
  }
  return null;
};
const flickrStatus = new Map();
for (const u of flickrUrls) { flickrStatus.set(u, await httpStatus(u)); await sleep(300); }

// ---------------------------------------------------------------------------
// 4. Classify each URL.
// ---------------------------------------------------------------------------
const broken = [];
const uncertain = [];
let ok = 0;

for (const ft of titleList) {
  const final = resolveTitle(ft);
  let kind;
  if (present.has(final)) kind = 'ok';
  else if (missing.has(final)) kind = 'broken';
  else kind = 'uncertain';
  for (const u of fileToUrls.get(ft)) {
    if (kind === 'ok') ok++;
    else if (kind === 'broken') broken.push({ url: u, status: 'missing', refs: refs.get(u) });
    else uncertain.push({ url: u, status: 'api-no-result', refs: refs.get(u) });
  }
}
for (const u of flickrUrls) {
  const s = flickrStatus.get(u);
  if (s === 200) ok++;
  else if (s === 404 || s === 410) broken.push({ url: u, status: s, refs: refs.get(u) });
  else uncertain.push({ url: u, status: s ?? 'timeout', refs: refs.get(u) });
}

// ---------------------------------------------------------------------------
// 5. Write report + summary.
// ---------------------------------------------------------------------------
const sortByBeach = (a, b) => (a.refs?.[0]?.beachId ?? 0) - (b.refs?.[0]?.beachId ?? 0);
broken.sort(sortByBeach);
uncertain.sort(sortByBeach);

fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalUrls: urls.length, ok,
  brokenCount: broken.length, uncertainCount: uncertain.length,
  broken, uncertain,
}, null, 2), 'utf8');

console.log('');
console.log('================ photo URL 404 scan ================');
console.log(`URLs checked : ${urls.length}`);
console.log(`200 / exists : ${ok}`);
console.log(`BROKEN (404) : ${broken.length}`);
console.log(`uncertain    : ${uncertain.length}`);
console.log('');
if (broken.length) {
  console.log('Broken (file missing on Commons):');
  for (const b of broken) {
    const r = b.refs[0];
    const extra = b.refs.length > 1 ? ` (+${b.refs.length - 1} more refs)` : '';
    console.log(`  [${r.src}] id=${r.beachId} ${r.nameGr || r.nameEn} [${r.isl}] — ${r.file}${extra}`);
  }
}
if (uncertain.length) {
  console.log('');
  console.log('Uncertain (re-run to resolve):');
  for (const b of uncertain) console.log(`  [${b.refs[0].src}] id=${b.refs[0].beachId} ${b.refs[0].file} (${b.status})`);
}
console.log('');
console.log(`Wrote ${path.relative(ROOT, outPath)}`);

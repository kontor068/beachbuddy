/**
 * Wikidata P18 harvester — high-precision curated beach images.
 * Queries Wikidata for Greek beaches (instance of beach, country Greece) that have a
 * P18 image + coordinates, then matches each to a still-MISSING beach by GPS proximity
 * (and/or name token). The P18 image is a Commons file → verified free + added to
 * data/beachPhotosById.generated.json (respects blocklist; dedupes files).
 *
 * Usage: node scripts/harvestWikidata.mjs [maxDistM=400]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data', 'beachPhotosById.generated.json');
const BLOCK = path.join(ROOT, 'data', 'beachPhotoBlocklist.json');
const UA = 'CalmBeachWikidata/1.0 (https://calmbeach.gr; contact dev)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const thumb = file => `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(file)}&width=800`;
const stripA = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripA(String(s || '')).toLowerCase();
const GEN = new Set(['paralia', 'beach', 'plaz', 'ammos', 'agios', 'agia', 'cove', 'bay', 'παραλια', 'akti']);
const toks = s => norm(s).split(/[^a-z0-9α-ω]+/i).filter(t => t.length >= 4 && !GEN.has(t));
const hav = (a, b, c, d) => { const R = 6371000, r = x => x * Math.PI / 180; const dl = r(c - a), dn = r(d - b); const x = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

const main = async () => {
  const MAX = Number(process.argv[2]) || 400;
  const q = `SELECT ?itemLabel ?image ?coord WHERE { ?item wdt:P31/wdt:P279* wd:Q40080 . ?item wdt:P17 wd:Q41 . ?item wdt:P18 ?image . ?item wdt:P625 ?coord . SERVICE wikibase:label { bd:serviceParam wikibase:language "el,en". } }`;
  const d = await (await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })).json();
  const wd = d.results.bindings.map(x => {
    const m = (x.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/) || []);
    return { label: x.itemLabel.value, file: decodeURIComponent(x.image.value.split('/').pop() || '').replace(/_/g, ' '), lon: +m[1], lat: +m[2] };
  }).filter(w => Number.isFinite(w.lat));
  process.stderr.write(`wikidata beaches w/ image+coord: ${wd.length}\n`);

  const result = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {};
  let bl = { ids: [], files: [] }; if (existsSync(BLOCK)) bl = JSON.parse(await readFile(BLOCK, 'utf8'));
  const blockedIds = new Set((bl.ids || []).map(String)), blockedFiles = new Set(bl.files || []);
  const usedFiles = new Set([...Object.values(result).flat().map(u => decodeURIComponent((u.match(/file\/([^&]+)/) || [])[1] || '')), ...blockedFiles]);

  // missing beaches with coords
  const missing = new Set(((await readFile(path.join(ROOT, 'reports/photo-coverage/missing-beaches.csv'), 'utf8')).split('\n').slice(1).filter(Boolean)).map(l => l.split(',')[3]));
  const beaches = [];
  const appDir = path.join(ROOT, 'public/data/beaches/app');
  for (const f of readdirSync(appDir).filter(x => x.endsWith('.json'))) {
    try { const a = JSON.parse(await readFile(path.join(appDir, f), 'utf8')); for (const b of a.island?.beaches || []) {
      if (missing.has(String(b.id)) && !result[b.id] && !blockedIds.has(String(b.id)) && Number.isFinite(b.coordinates?.lat))
        beaches.push({ id: b.id, name: (b.name?.gr || '') + ' ' + (b.name?.en || ''), lat: b.coordinates.lat, lon: b.coordinates.lon });
    } } catch {}
  }

  // license check (Commons) for matched files
  const freeCheck = async file => {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + file)}`;
    const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
    const p = Object.values(j?.query?.pages || {})[0]; const em = p?.imageinfo?.[0]?.extmetadata || {};
    const lk = (em.License?.value || '').toLowerCase(), ls = (em.LicenseShortName?.value || '');
    return /^cc-?(by|by-sa|0|zero|pdm)/.test(lk) || /public domain|cc0|cc by/i.test(ls);
  };

  let added = 0;
  for (const w of wd) {
    if (usedFiles.has(w.file)) continue;
    // nearest missing beach
    let best = null, bestD = Infinity;
    for (const b of beaches) { if (result[b.id]) continue; const dd = hav(w.lat, w.lon, b.lat, b.lon); if (dd < bestD) { bestD = dd; best = b; } }
    if (!best) continue;
    const nameMatch = toks(w.label).some(t => norm(best.name).includes(t));
    if (bestD <= MAX || (nameMatch && bestD <= 1500)) {
      if (!(await freeCheck(w.file))) { await sleep(120); continue; }
      result[best.id] = [thumb(w.file)]; usedFiles.add(w.file); added++;
      console.log(`+ id${best.id} "${best.name.trim()}" <- ${w.label} (${Math.round(bestD)}m) | ${w.file}`);
      await sleep(120);
    }
  }
  await writeFile(OUT, JSON.stringify(result, null, 0) + '\n');
  console.log(`\nDONE. matched ${added} missing beaches via Wikidata P18. total by-id ${Object.keys(result).length}.`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });

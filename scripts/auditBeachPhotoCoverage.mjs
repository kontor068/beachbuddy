/**
 * Beach photo coverage audit.
 *
 * Reports, per region and nationally, how many beaches currently resolve to a
 * real photo in the running app vs how many do not.
 *
 * Truth source: it bundles and calls the SAME resolver the UI uses
 * (`getBeachPhotoLookup` in services/beachPhotos.ts). A beach "has a photo"
 * iff `source === 'exact'` — identical to BeachCard.tsx / BeachDetailPage.tsx.
 *
 * Inputs:
 *   - public/data/beaches/index.json        (regions: id, name, beachCount, appDataPath)
 *   - public/data/beaches/app/<id>.json     (island.beaches[]: id, name.en, name.gr)
 *
 * Outputs:
 *   - reports/photo-coverage/by-region.json
 *   - reports/photo-coverage/by-region.csv
 *   - reports/photo-coverage/missing-beaches.csv
 *   - console summary (national % + per-region table, hot-first)
 *
 * Usage:
 *   node scripts/auditBeachPhotoCoverage.mjs            (full national report)
 *   node scripts/auditBeachPhotoCoverage.mjs santorini  (filter regions by substring)
 */
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const beachesDir = path.join(projectRoot, 'public', 'data', 'beaches');
const indexPath = path.join(beachesDir, 'index.json');
const reportDir = path.join(projectRoot, 'reports', 'photo-coverage');

// Hot-first ordering for the console table. Regions are matched by `group`
// (from index.json) then by descending beach count within a group.
const GROUP_PRIORITY = [
  'cyclades',
  'dodecanese',
  'ionian',
  'crete',
  'sporades',
  'north_aegean',
  'argosaronic',
  'euboea',
  'attica',
  'mainland_macedonia',
  'mainland_thrace',
  'mainland_peloponnese',
  'mainland_central',
  'mainland_epirus',
  'mainland_thessaly',
];

const groupRank = group => {
  const i = GROUP_PRIORITY.indexOf(group);
  return i === -1 ? GROUP_PRIORITY.length : i;
};

// --- Bundle the real resolver (TS -> CJS) so we call exactly what the app calls.
const bundleResolver = async () => {
  const outFile = path.join(projectRoot, '.tmp', 'beachPhotos.bundle.cjs');
  await mkdir(path.dirname(outFile), { recursive: true });
  await build({
    entryPoints: [path.join(projectRoot, 'services', 'beachPhotos.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outFile,
    logLevel: 'error',
    loader: { '.json': 'json' },
  });
  const mod = await import(`file://${outFile}?t=${Date.now()}`);
  return { getBeachPhotoLookup: mod.getBeachPhotoLookup, outFile };
};

const loadJson = async p => JSON.parse(await readFile(p, 'utf8'));

const csvCell = value => {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const main = async () => {
  const filter = (process.argv[2] || '').toLowerCase();

  const { getBeachPhotoLookup, outFile } = await bundleResolver();
  const index = await loadJson(indexPath);
  const regions = index.regions.filter(
    r => !filter || r.id.toLowerCase().includes(filter) || r.name.en.toLowerCase().includes(filter),
  );

  // by-id set, to tag each displayed photo's source for the QA dump
  const byIdPath = path.join(projectRoot, 'data', 'beachPhotosById.generated.json');
  const byId = existsSync(byIdPath) ? await loadJson(byIdPath) : {};
  const byIdSet = new Set(Object.keys(byId).map(String));

  const regionRows = [];
  const missingRows = [];
  const displayedRows = []; // every beach that resolves to a photo (for visual QA)
  let nationalTotal = 0;
  let nationalWith = 0;

  for (const region of regions) {
    const appPath = path.join(projectRoot, 'public', region.appDataPath.replace(/^\/+/, ''));
    if (!existsSync(appPath)) {
      console.warn(`! missing app data: ${region.appDataPath}`);
      continue;
    }
    const appData = await loadJson(appPath);
    const beaches = appData.island?.beaches ?? [];
    const islandName = region.name.en; // what the app passes as islandName

    let withPhoto = 0;
    for (const beach of beaches) {
      const nameGr = beach.name?.gr ?? '';
      const nameEn = beach.name?.en ?? '';
      const lookup = getBeachPhotoLookup(nameGr, nameEn, beach.id, 3, islandName);
      if (lookup.source === 'exact') {
        withPhoto += 1;
        displayedRows.push({
          beachId: beach.id,
          nameGr,
          nameEn,
          isl: region.name.gr || region.name.en,
          regionId: region.id,
          url: (lookup.photos && lookup.photos[0]) || '',
          src: byIdSet.has(String(beach.id)) ? 'by-id' : 'name-map',
        });
      } else {
        missingRows.push({
          regionId: region.id,
          region: region.name.en,
          group: region.group,
          beachId: beach.id,
          nameGr,
          nameEn,
        });
      }
    }

    const total = beaches.length;
    const missing = total - withPhoto;
    const pct = total ? (withPhoto / total) * 100 : 0;
    regionRows.push({
      id: region.id,
      region: region.name.en,
      regionGr: region.name.gr,
      group: region.group,
      total,
      withPhoto,
      missing,
      pct: Number(pct.toFixed(1)),
    });

    nationalTotal += total;
    nationalWith += withPhoto;
  }

  // Sort: hot-first (group priority), then most beaches first within a group.
  regionRows.sort(
    (a, b) => groupRank(a.group) - groupRank(b.group) || b.total - a.total || a.region.localeCompare(b.region),
  );

  const nationalPct = nationalTotal ? Number(((nationalWith / nationalTotal) * 100).toFixed(1)) : 0;

  // --- Write reports
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, 'by-region.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        filter: filter || null,
        national: { total: nationalTotal, withPhoto: nationalWith, missing: nationalTotal - nationalWith, pct: nationalPct },
        regions: regionRows,
      },
      null,
      2,
    )}\n`,
  );

  const csvHeader = 'group,region,regionGr,total,withPhoto,missing,pct';
  const csvBody = regionRows
    .map(r => [r.group, r.region, r.regionGr, r.total, r.withPhoto, r.missing, r.pct].map(csvCell).join(','))
    .join('\n');
  await writeFile(path.join(reportDir, 'by-region.csv'), `${csvHeader}\n${csvBody}\n`);

  const missingHeader = 'group,regionId,region,beachId,nameGr,nameEn';
  const missingBody = missingRows
    .map(m => [m.group, m.regionId, m.region, m.beachId, m.nameGr, m.nameEn].map(csvCell).join(','))
    .join('\n');
  await writeFile(path.join(reportDir, 'missing-beaches.csv'), `${missingHeader}\n${missingBody}\n`);

  await writeFile(
    path.join(reportDir, 'displayed-photos.json'),
    `${JSON.stringify(displayedRows, null, 0)}\n`,
  );

  await rm(outFile, { force: true });

  // --- Console summary
  const bar = pct => {
    const n = Math.round(pct / 5);
    return '█'.repeat(n) + '░'.repeat(20 - n);
  };
  console.log('');
  console.log('============================================================');
  console.log(' BEACH PHOTO COVERAGE' + (filter ? ` (filter: "${filter}")` : ' (national)'));
  console.log('============================================================');
  console.log(
    ` TOTAL: ${nationalWith}/${nationalTotal} beaches have a photo  →  ${nationalPct}%   (${nationalTotal - nationalWith} missing)`,
  );
  console.log('------------------------------------------------------------');
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(` ${pad('Region', 26)} ${padL('with', 5)}/${pad('tot', 5)} ${padL('%', 6)}  bar`);
  console.log('------------------------------------------------------------');
  let lastGroup = null;
  for (const r of regionRows) {
    if (r.group !== lastGroup) {
      console.log(` [${r.group}]`);
      lastGroup = r.group;
    }
    console.log(
      `   ${pad(r.region, 24)} ${padL(r.withPhoto, 5)}/${pad(r.total, 5)} ${padL(r.pct + '%', 6)}  ${bar(r.pct)}`,
    );
  }
  console.log('------------------------------------------------------------');
  console.log(` Reports: reports/photo-coverage/{by-region.json,by-region.csv,missing-beaches.csv}`);
  console.log('');
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

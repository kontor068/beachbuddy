/**
 * Cove oracle RESOLUTION PROBE (read-only, no data writes).
 *
 * Before spending ~2h of API calls validating 223 coves against Open-Meteo's
 * marine model, answer the question that decides whether that run is worth
 * anything at all: does the marine model resolve a cove AT ALL?
 *
 * Open-Meteo's wave grid is order 5-10 km. A 500 m enclosed cove may simply not
 * exist in it — in which case the model reports the open-sea wave for both a
 * cove and the exposed beach next door, and "cove reads rough" would say nothing
 * about the cove and everything about the grid.
 *
 * Method: pick pairs of (enclosed cove, nearby OPEN beach) that sit within a few
 * km of each other on the same coast, and compare the reported wave height at
 * the same hours. If the pair is indistinguishable, the oracle is uninformative
 * and the full run must NOT be presented as validation.
 *
 * Run: node scripts/validation/cove-oracle-probe.mjs
 */

const PAIRS = [
  // Same coast, ~2-3 km apart. Panormos is the verified enclosed cove; Moutsouna
  // and Ligaridia are the open bights the classifier (correctly) refuses.
  { label: 'Naxos E',      cove: { id: 2011, name: 'Πάνορμος',    lat: 36.95854, lon: 25.53871 },
                           open: { id: 2009, name: 'Μουτσούνα',   lat: 37.07796, lon: 25.58698 } },
  { label: 'Naxos E (2)',  cove: { id: 2011, name: 'Πάνορμος',    lat: 36.95854, lon: 25.53871 },
                           open: { id: 2001, name: 'Λιγαρίδια',   lat: 37.07514, lon: 25.58479 } },
  { label: 'Lesvos S',     cove: { id: 1321, name: 'Άγ. Ερμογένης', lat: 39.0725, lon: 26.3406 },
                           open: { id: 1352, name: 'Άναξος',      lat: 39.2436, lon: 26.1236 } },
  { label: 'Messinia',     cove: { id: 1608, name: 'Βοϊδοκοιλιά', lat: 36.95611, lon: 21.66139 },
                           open: { id: 1621, name: 'Λαγκούβαρδος', lat: 37.05271, lon: 21.65224 } },
  { label: 'Kefalonia',    cove: { id: 1131, name: 'Φωκί',        lat: 38.26169, lon: 20.50315 },
                           open: { id: 1124, name: 'Πετανοί',     lat: 38.26749, lon: 20.36248 } },
];

const MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * THE decisive metric, and the one a naive probe misses: how far the API moved
 * the query point to land on a wet grid cell. Comparing two coastal points is
 * meaningless if the model answered about open water kilometres offshore.
 */
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// A cove is order 0.3-1 km across. If the model answered from further than this,
// it is describing different water than the swimmer is standing in.
const SNAP_TOLERANCE_KM = 3;

const fetchWaves = async (lat, lon) => {
  const url = `${MARINE}?latitude=${lat}&longitude=${lon}&hourly=wave_height&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const j = await res.json();
  return {
    gridLat: j.latitude,
    gridLon: j.longitude,
    times: j.hourly?.time || [],
    waves: (j.hourly?.wave_height || []).map((v) => (v === null ? NaN : v)),
  };
};

const main = async () => {
  console.log('Cove oracle resolution probe — does Open-Meteo marine resolve a cove?\n');
  let identicalGrid = 0;
  let identicalWaves = 0;
  let tested = 0;
  let snapped = 0;
  let points = 0;

  for (const p of PAIRS) {
    try {
      const a = await fetchWaves(p.cove.lat, p.cove.lon);
      await sleep(1200);
      const b = await fetchWaves(p.open.lat, p.open.lon);
      await sleep(1200);

      const n = Math.min(a.waves.length, b.waves.length);
      const diffs = [];
      for (let i = 0; i < n; i++) {
        if (Number.isFinite(a.waves[i]) && Number.isFinite(b.waves[i])) {
          diffs.push(a.waves[i] - b.waves[i]);
        }
      }
      const mean = diffs.reduce((s, v) => s + v, 0) / (diffs.length || 1);
      const maxAbs = diffs.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      const sameGrid = a.gridLat === b.gridLat && a.gridLon === b.gridLon;
      const sameWaves = maxAbs < 0.02;

      const snapA = haversineKm(p.cove.lat, p.cove.lon, a.gridLat, a.gridLon);
      const snapB = haversineKm(p.open.lat, p.open.lon, b.gridLat, b.gridLon);
      points += 2;
      if (snapA > SNAP_TOLERANCE_KM) snapped++;
      if (snapB > SNAP_TOLERANCE_KM) snapped++;

      tested++;
      if (sameGrid) identicalGrid++;
      if (sameWaves) identicalWaves++;

      console.log(`[${p.label}] ${p.cove.name} (cove) vs ${p.open.name} (open)`);
      console.log(`   grid cell: ${a.gridLat},${a.gridLon}  vs  ${b.gridLat},${b.gridLon}  ${sameGrid ? '<< SAME CELL' : ''}`);
      console.log(`   SNAP DISTANCE: cove ${snapA.toFixed(1)} km${snapA > SNAP_TOLERANCE_KM ? ' <<< TOO FAR' : ''}, open ${snapB.toFixed(1)} km${snapB > SNAP_TOLERANCE_KM ? ' <<< TOO FAR' : ''}`);
      console.log(`   wave diff (cove - open): mean ${mean.toFixed(3)} m, max |diff| ${maxAbs.toFixed(3)} m  ${sameWaves ? '<< INDISTINGUISHABLE' : ''}`);
      console.log(`   hours compared: ${diffs.length}\n`);
    } catch (err) {
      console.log(`[${p.label}] FAILED: ${err.message}\n`);
    }
  }

  console.log('─'.repeat(70));
  console.log(`pairs tested: ${tested}`);
  console.log(`pairs landing in the SAME grid cell: ${identicalGrid}`);
  console.log(`pairs with indistinguishable waves:  ${identicalWaves}`);
  console.log(`query points snapped >${SNAP_TOLERANCE_KM} km offshore: ${snapped} of ${points}`);
  console.log();
  if (tested === 0) {
    console.log('VERDICT: probe failed (network?) — cannot judge.');
  } else if (snapped >= points * 0.4) {
    console.log('VERDICT: ORACLE CANNOT SEE COVES. The marine grid holds no wet cell at');
    console.log('the shoreline, so the API answers from open water kilometres away. Any');
    console.log('cove-vs-open difference it reports is spatial variation in the OPEN SEA,');
    console.log('not enclosure. Differing wave values are therefore NOT evidence either');
    console.log('way, and a full run would measure the grid, not the classifier.');
    console.log('DO NOT present such a run as validation of cove shelter.');
  } else if (identicalWaves >= tested * 0.6) {
    console.log('VERDICT: ORACLE UNINFORMATIVE for coves. The marine grid does not');
    console.log('resolve enclosure — a cove and the open beach next door read the same.');
  } else {
    console.log('VERDICT: oracle shows real coastal discrimination AND resolves points');
    console.log('near shore — a full run may be informative, but treat magnitudes as');
    console.log('indicative, not ground truth.');
  }
};

main().catch((e) => { console.error(e); process.exit(1); });

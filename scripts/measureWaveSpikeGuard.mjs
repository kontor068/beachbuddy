#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΥΧΝΑ ΧΤΥΠΑΕΙ ΤΟ ΦΡΕΝΟ ΤΟΥ ΗΓΕΤΗ — εθνικά, ζωντανά, πριν βγει live.
 *
 * Ρωτάει και τα δύο μοντέλα κύματος στο marineSamplePoint κάθε παραλίας (δείγμα ανά περιοχή)
 * και μετράει πόσες ώρες θα έπεφταν στον μάρτυρα με τον κανόνα του utils/marineForecastParsing.
 *
 *   node scripts/measureWaveSpikeGuard.mjs [σημεία-ανά-περιοχή]
 */
import fs from 'node:fs';
import path from 'node:path';

const PER_REGION = Number(process.argv[2] || 3);
const DIR = 'public/data/geospatial/exposure';
const BATCH = 40;

const points = [];
for (const f of fs.readdirSync(DIR)) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const profiles = Array.isArray(j.profiles) ? j.profiles : Object.values(j.profiles || {});
  const withPoint = profiles.filter(p => p.marineSamplePoint);
  const step = Math.max(1, Math.floor(withPoint.length / PER_REGION));
  for (let i = 0; i < withPoint.length && points.length % 100000 >= 0; i += step) {
    const p = withPoint[i];
    points.push({ id: p.beachId, name: (p.name && p.name.gr) || '', region: f.replace('.json',''),
                  lat: p.marineSamplePoint.lat, lon: p.marineSamplePoint.lon });
    if (points.filter(x => x.region === f.replace('.json','')).length >= PER_REGION) break;
  }
}
process.stdout.write(`σημεία: ${points.length} σε ${new Set(points.map(p=>p.region)).size} περιοχές\n`);

const GROWTH = 1, MIN_H = 1, RATIO = 0.5;
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

let hoursTotal = 0, hoursBlocked = 0, pointsHit = 0, bothHighHours = 0;
const worst = [];

for (let i = 0; i < points.length; i += BATCH) {
  const chunk = points.slice(i, i + BATCH);
  const url = 'https://marine-api.open-meteo.com/v1/marine'
    + '?latitude=' + chunk.map(p => p.lat).join(',')
    + '&longitude=' + chunk.map(p => p.lon).join(',')
    + '&hourly=wave_height&models=ewam,meteofrance_wave&timezone=Europe/Athens&forecast_days=2';
  let data = null;
  for (let a = 0; a < 4 && !data; a += 1) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      const j = await r.json();
      data = Array.isArray(j) ? j : (j.hourly ? [j] : null);
      if (!data) await new Promise(s => setTimeout(s, 10000));
    } catch { await new Promise(s => setTimeout(s, 10000)); }
  }
  if (!data) { process.stdout.write('!'); continue; }

  data.forEach((entry, k) => {
    const h = entry.hourly; if (!h) return;
    const lead = h.wave_height_ewam || [], wit = h.wave_height_meteofrance_wave || [];
    let inside = false, blocked = 0;
    for (let x = 0; x < lead.length; x += 1) {
      const L = num(lead[x]); if (L === undefined) { inside = false; continue; }
      hoursTotal += 1;
      const W = num(wit[x]);
      if (L >= MIN_H && W !== undefined && W >= L * RATIO) bothHighHours += 1;
      const corr = W === undefined || W >= L * RATIO;
      if (corr || L < MIN_H) { inside = false; continue; }
      if (!inside) {
        const prev = num(lead[x - 1]);
        if (!(prev !== undefined && L - prev > GROWTH)) continue;
        inside = true;
      }
      blocked += 1; hoursBlocked += 1;
      if (worst.length < 400) worst.push({ p: chunk[k], t: h.time[x], lead: L, wit: W });
    }
    if (blocked > 0) pointsHit += 1;
  });
  process.stdout.write('.');
  await new Promise(s => setTimeout(s, 2500));
}

const pc = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '—';
process.stdout.write('\n\n== ΕΘΝΙΚΗ ΜΕΤΡΗΣΗ ΦΡΕΝΟΥ (48 ώρες) ==\n');
process.stdout.write(`ώρες που εξετάστηκαν      : ${hoursTotal}\n`);
process.stdout.write(`ώρες που ΜΠΛΟΚΑΡΙΣΤΗΚΑΝ   : ${hoursBlocked}  (${pc(hoursBlocked, hoursTotal)})\n`);
process.stdout.write(`σημεία με ≥1 μπλοκάρισμα  : ${pointsHit} / ${points.length}  (${pc(pointsHit, points.length)})\n`);
process.stdout.write(`ώρες με ΠΡΑΓΜΑΤΙΚΟ κύμα ≥1μ και τα δύο μοντέλα σύμφωνα (ΔΕΝ αγγίζονται): ${bothHighHours}\n`);
const byRegion = {};
worst.forEach(w => { byRegion[w.p.region] = (byRegion[w.p.region] || 0) + 1; });
const top = Object.entries(byRegion).sort((a,b) => b[1]-a[1]).slice(0, 12);
if (top.length) {
  process.stdout.write('\nπεριοχές με τα περισσότερα:\n');
  top.forEach(([r, n]) => process.stdout.write(`  ${r.padEnd(34)} ${n}\n`));
  process.stdout.write('\nδείγματα:\n');
  worst.slice(0, 10).forEach(w => process.stdout.write(
    `  ${w.p.name.padEnd(22)} ${w.t}  ηγέτης ${w.lead}μ vs μάρτυρας ${w.wit}μ\n`));
}
fs.writeFileSync('reports/quality/wave-spike-guard.json', JSON.stringify(
  { generatedAt: new Date().toISOString(), points: points.length, hoursTotal, hoursBlocked,
    pointsHit, bothHighHours, byRegion, samples: worst.slice(0, 120) }, null, 2));
process.stdout.write('\nγράφτηκε reports/quality/wave-spike-guard.json\n');

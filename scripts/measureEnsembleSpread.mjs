#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΙΓΟΥΡΟΙ ΕΙΜΑΣΤΕ ΓΙΑ ΤΗΝ ΠΑΡΑΣΚΕΥΗ; — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Σήμερα η κάρτα λέει «Καλή» για τη μέρα +5 με ΑΚΡΙΒΩΣ την ίδια σιγουριά που το λέει
 * για σήμερα. Η πρόγνωση όμως δεν είναι το ίδιο πράγμα στις δύο περιπτώσεις: στο +5 τα μοντέλα
 * συχνά διαφωνούν μεταξύ τους κατά δύο Μποφόρ, και εμείς δείχνουμε ένα νούμερο σαν να μη
 * διαφωνούσε κανείς. Το πλάνο Professional (21/08/2026) ξεκλείδωσε το Ensemble API, που τρέχει το
 * ΙΔΙΟ μοντέλο πολλές φορές με ελαφρώς διαφορετική αφετηρία: αν τα 40 «σενάρια» συμφωνούν, η
 * πρόγνωση είναι στέρεη· αν απλώνονται, δεν είναι.
 *
 * ⚠️ ΤΟ ENSEMBLE ΔΕΝ ΕΧΕΙ ΚΥΜΑ. Δίνει μόνο ατμοσφαιρικά (άνεμος, ριπές, βροχή, θερμοκρασία). Άρα
 * ό,τι χτιστεί πάνω του μπορεί να μιλήσει ΜΟΝΟ για τον άνεμο — και αυτό πρέπει να γραφτεί σε κάθε
 * μελλοντικό σχόλιο, αλλιώς κάποιος θα υποθέσει ότι καλύπτει και τη θάλασσα.
 *
 * ΤΙ ΔΕΝ ΘΑ ΓΙΝΕΙ ΠΟΤΕ ΜΕ ΑΥΤΟ, και γράφεται πριν από τη μέτρηση ώστε να μην «ανακαλυφθεί» μετά:
 * ΚΑΝΕΝΑ μόνιμο ταμπελάκι «μέτρια εμπιστοσύνη» στην οθόνη. Η βίβλος το έχει ήδη απορρίψει — ένα
 * μήνυμα αβεβαιότητας που εμφανίζεται συνέχεια διαβάζεται ως «δεν ξέρουμε τι λέμε». Η μόνη
 * επιτρεπτή χρήση είναι ΦΡΕΝΟ: να μη λέμε «Καλή» με σιγουριά όταν τα σενάρια διαφωνούν.
 *
 * ── ΤΑ ΚΑΤΩΦΛΙΑ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΡΕΞΕΙ ────────────────────────────────────────
 * «ΑΒΕΒΑΙΗ ΩΡΑ»  = p10 και p90 απέχουν ≥ GAP_RUNGS Μποφόρ (προεπιλογή 2 — δες την αποτυχία
 *                 της πρώτης εκδοχής παρακάτω). Στις 2 βαθμίδες αλλάζει και χρώμα και λέξη.
 * «ΑΒΕΒΑΙΗ ΜΕΡΑ» = ≥4 αβέβαιες ώρες μέσα στο παράθυρο κολύμβησης (10:00-18:00, 9 ώρες).
 *
 * ⛔ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΑΠΕΤΥΧΕ ΤΗΝ ΙΔΙΑ ΤΗΣ ΤΗΝ ΚΡΙΣΗ, ΚΑΙ ΜΕΝΕΙ ΓΡΑΜΜΕΝΟ (21/08/2026).
 * Το πρώτο κατώφλι ήταν «≥1 βαθμίδα διαφορά» και σε πιλότο 5 περιοχών έβγαλε **100% αβέβαιες
 * περιοχο-ημέρες** — δηλαδή ακριβώς το «>25% = πολύ χαλαρό» που είχε γραφτεί από πριν. Μια
 * διαφορά μιας βαθμίδας ανάμεσα στο 10ό και το 90ό εκατοστημόριο είναι ο ΚΑΝΟΝΑΣ, όχι το σήμα.
 * Το κατώφλι πήγε στις **2 βαθμίδες** — αλλά επειδή αυτό είναι αλλαγή ΜΕΤΑ τη μέτρηση (δηλαδή
 * υποψήφιο overfit), επαληθεύεται υποχρεωτικά σε ΔΕΥΤΕΡΟ, ΔΙΑΦΟΡΕΤΙΚΟ δείγμα περιοχών πριν
 * γραφτεί οποιαδήποτε γραμμή παραγωγής. Ό,τι έδειξε ο πιλότος στις 2 βαθμίδες: 0,0% σήμερα ·
 * 6,3% στο +1 · 8,3% στο +2 · 3,1% στο +3 · 27,1% στο +4 · 37,5% στο +5 · 36,5% στο +6.
 *
 * ΚΡΙΣΗ: αν οι αβέβαιες μέρες είναι <2% στο σύνολο, το φρένο δεν αξίζει τον κόπο — δεν θα
 * πυροδοτούσε ποτέ. Αν είναι >25%, το κατώφλι είναι πολύ χαλαρό και θα γινόταν μόνιμο ταμπελάκι
 * από την πίσω πόρτα. Το ενδιάμεσο είναι το χρήσιμο εύρος.
 *
 * ΜΟΝΟ ΑΝΑΦΟΡΑ. Καμία γραμμή παραγωγής, κανένα κατώφλι, καμία ετυμηγορία δεν αγγίζεται.
 *
 *   OPEN_METEO_API_KEY=… node scripts/measureEnsembleSpread.mjs [--regions=a,b] [--model=icon_eu]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import './lib/paidOpenMeteo.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const regionFilter = argVal('regions', null)?.split(',');
/**
 * `ecmwf_ifs025`: 51 μέλη, 15 ημέρες — το μόνο που καλύπτει ΟΛΟ τον ορίζοντα των 7 ημερών μας.
 * Το `icon_eu` έχει λεπτότερο πλέγμα (13 χλμ) αλλά σταματά στις 5 ημέρες, δηλαδή σιωπά ακριβώς
 * εκεί που η αβεβαιότητα μας ενδιαφέρει περισσότερο.
 */
const MODEL = argVal('model', 'ecmwf_ifs025');
const DAYS = Number(argVal('days', '7'));
/** Πόσες βαθμίδες Μποφόρ πρέπει να απέχουν p10 και p90 για να λέγεται «αβέβαιη» μια ώρα. */
const GAP_RUNGS = Number(argVal('gap', '2'));

/** Το παράθυρο που κρίνει μια μέρα παραλίας. Έξω από αυτό, η διαφωνία δεν αφορά κανέναν. */
const SWIM_START_H = 10;
const SWIM_END_H = 18;
const UNCERTAIN_HOURS_FOR_DAY = 4;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');

const regions = fs.readdirSync(beachDir)
  .filter((n) => n.endsWith('.json') && n !== 'index.json')
  .map((file) => {
    try {
      const app = JSON.parse(fs.readFileSync(path.join(beachDir, file), 'utf8'));
      const c = app.island?.coordinates;
      if (!c || !Number.isFinite(c.lat)) return null;
      return { id: file.replace(/\.json$/, ''), lat: c.lat, lon: c.lon, beaches: (app.island.beaches || []).length };
    } catch { return null; }
  })
  .filter(Boolean)
  .filter((r) => !regionFilter || regionFilter.includes(r.id));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchChunk = async (chunk) => {
  const url = 'https://ensemble-api.open-meteo.com/v1/ensemble'
    + `?latitude=${chunk.map((r) => r.lat).join(',')}`
    + `&longitude=${chunk.map((r) => r.lon).join(',')}`
    + '&hourly=wind_speed_10m,wind_gusts_10m'
    + `&wind_speed_unit=kmh&timezone=Europe%2FAthens&forecast_days=${DAYS}&models=${MODEL}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
};

const run = async () => {
  console.log(`\n🎲 ΔΙΑΣΠΟΡΑ ΣΕΝΑΡΙΩΝ — ${MODEL}, ${DAYS} ημέρες, ${regions.length} περιοχές.`);
  console.log(`   Αβέβαιη ώρα = p10 και p90 απέχουν ≥${GAP_RUNGS} Μποφόρ · αβέβαιη μέρα = ≥${UNCERTAIN_HOURS_FOR_DAY} τέτοιες ώρες στις ${SWIM_START_H}:00-${SWIM_END_H}:00.\n`);

  /** ανά ημέρα πρόγνωσης (0=σήμερα): μετρητές */
  const byLead = Array.from({ length: DAYS }, () => ({
    hours: 0, uncertain: 0, twoRung: 0, days: 0, uncertainDays: 0, spreads: [],
    looksCalmMayNotBe: 0, swimHours: 0,
  }));
  const worstDays = [];
  let memberCount = 0;
  let regionsAnswered = 0;

  const CHUNK = 10;
  for (let i = 0; i < regions.length; i += CHUNK) {
    const chunk = regions.slice(i, i + CHUNK);
    let series;
    try {
      series = await fetchChunk(chunk);
    } catch (err) {
      console.error(`  ⛔ ${chunk[0].id}…: ${err.message}`);
      continue;
    }
    series.forEach((point, k) => {
      const region = chunk[k];
      if (!region) return;
      const h = point.hourly || {};
      const times = h.time || [];
      const speedKeys = Object.keys(h).filter((key) => /^wind_speed_10m(_member\d+)?$/.test(key));
      const gustKeys = Object.keys(h).filter((key) => /^wind_gusts_10m(_member\d+)?$/.test(key));
      if (speedKeys.length < 5) return;
      memberCount = Math.max(memberCount, speedKeys.length);
      regionsAnswered += 1;

      /** ημέρα πρόγνωσης → πόσες αβέβαιες ώρες μέσα στο παράθυρο */
      const uncertainPerDay = new Map();
      const worstPerDay = new Map();

      for (let t = 0; t < times.length; t += 1) {
        const stamp = times[t];
        const hour = Number(stamp.slice(11, 13));
        const lead = Math.floor(t / 24);
        if (lead >= DAYS) continue;

        // Ο άνεμος που ΒΛΕΠΕΙ ο χρήστης: ίδιο δάπεδο ριπής, ίδια κλίμακα Μποφόρ.
        const beauforts = [];
        for (let m = 0; m < speedKeys.length; m += 1) {
          const speed = h[speedKeys[m]]?.[t];
          const gust = h[gustKeys[m]]?.[t];
          if (!Number.isFinite(speed)) continue;
          beauforts.push(getBeaufortLevel(applyGustFloor(speed, gust, 0)));
        }
        if (beauforts.length < 5) continue;
        beauforts.sort((a, b) => a - b);
        const lo = percentile(beauforts, 0.10);
        const hi = percentile(beauforts, 0.90);
        const gap = hi - lo;

        byLead[lead].hours += 1;
        byLead[lead].spreads.push(gap);
        if (gap >= GAP_RUNGS) byLead[lead].uncertain += 1;
        if (gap >= 2) byLead[lead].twoRung += 1;

        /**
         * ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΡΙΝΕΙ ΑΝ ΤΟ ΦΡΕΝΟ ΑΞΙΖΕΙ: «φαίνεται καλή, μπορεί να μην είναι».
         *
         * Η διασπορά από μόνη της δεν λέει τίποτα για τον χρήστη. Μια μέρα όπου τα σενάρια
         * απλώνονται από 6 έως 8 Μποφόρ είναι αβέβαιη ΚΑΙ κακή — δεν θα προτείναμε τίποτα εκεί,
         * άρα το φρένο δεν έχει τι να φρενάρει. Η επικίνδυνη περίπτωση είναι η ΑΝΤΙΘΕΤΗ: το
         * κεντρικό σενάριο λέει «ήσυχα» (≤4 Μποφόρ, εκεί που η κάρτα βγάζει καλή ετυμηγορία) ενώ
         * το 90ό εκατοστημόριο λέει 5+ — δηλαδή προτείνουμε μια μέρα που ένα στα δέκα σενάρια
         * την έχει για μελτέμι. Αυτές μόνο τις ώρες μετράει το `looksCalmMayNotBe`.
         */
        const centre = percentile(beauforts, 0.50);
        if (centre <= 4 && hi >= 5 && hour >= SWIM_START_H && hour < SWIM_END_H) {
          byLead[lead].looksCalmMayNotBe += 1;
        }
        if (hour >= SWIM_START_H && hour < SWIM_END_H) byLead[lead].swimHours += 1;

        if (hour >= SWIM_START_H && hour < SWIM_END_H && gap >= GAP_RUNGS) {
          uncertainPerDay.set(lead, (uncertainPerDay.get(lead) ?? 0) + 1);
          if (gap > (worstPerDay.get(lead)?.gap ?? 0)) {
            worstPerDay.set(lead, { gap, lo, hi, stamp });
          }
        }
      }

      for (let lead = 0; lead < DAYS; lead += 1) {
        if (byLead[lead].hours === 0) continue;
        byLead[lead].days += 1;
        const n = uncertainPerDay.get(lead) ?? 0;
        if (n >= UNCERTAIN_HOURS_FOR_DAY) {
          byLead[lead].uncertainDays += 1;
          const w = worstPerDay.get(lead);
          if (w && worstDays.length < 200) {
            worstDays.push({ region: region.id, beaches: region.beaches, lead, uncertainHours: n, ...w });
          }
        }
      }
    });
    process.stderr.write(`\r  ${Math.min(i + CHUNK, regions.length)}/${regions.length} περιοχές   `);
    await sleep(1500);
  }
  process.stderr.write('\r                                   \r');

  console.log(`Απάντησαν ${regionsAnswered}/${regions.length} περιοχές · ${memberCount} σενάρια ανά ώρα.\n`);
  console.log('── ΠΟΣΟ ΔΙΑΦΩΝΟΥΝ ΤΑ ΣΕΝΑΡΙΑ, ΑΝΑ ΗΜΕΡΑ ΠΡΟΓΝΩΣΗΣ ──────────────────');
  console.log('  ημέρα │ ώρες   │ ≥1 βαθμίδα │ ≥2 βαθμίδες │ αβέβαιες μέρες');
  const table = [];
  for (let lead = 0; lead < DAYS; lead += 1) {
    const b = byLead[lead];
    if (!b.hours) continue;
    const p1 = (100 * b.uncertain / b.hours);
    const p2 = (100 * b.twoRung / b.hours);
    const pd = b.days ? (100 * b.uncertainDays / b.days) : 0;
    const label = lead === 0 ? 'σήμερα' : `+${lead}`;
    console.log(`  ${label.padEnd(6)}│ ${String(b.hours).padStart(6)} │ ${p1.toFixed(1).padStart(9)}% │ ${p2.toFixed(1).padStart(10)}% │ ${pd.toFixed(1).padStart(6)}%  (${b.uncertainDays}/${b.days})`);
    table.push({ lead, hours: b.hours, oneRungPct: Number(p1.toFixed(2)), twoRungPct: Number(p2.toFixed(2)), uncertainDayPct: Number(pd.toFixed(2)), uncertainDays: b.uncertainDays, days: b.days });
  }

  console.log('\n── ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΡΙΝΕΙ: «ΦΑΙΝΕΤΑΙ ΚΑΛΗ, ΜΠΟΡΕΙ ΝΑ ΜΗΝ ΕΙΝΑΙ» ──');
  console.log('  (κεντρικό σενάριο ≤4 Μποφ. ενώ το 90ό εκατοστημόριο λέει 5+, ώρες κολύμβησης)');
  for (let lead = 0; lead < DAYS; lead += 1) {
    const b = byLead[lead];
    if (!b.swimHours) continue;
    const p = (100 * b.looksCalmMayNotBe / b.swimHours);
    const label = lead === 0 ? 'σήμερα' : '+' + lead;
    console.log('  ' + label.padEnd(7) + String(b.looksCalmMayNotBe).padStart(5) + ' / ' + String(b.swimHours).padStart(5) + ' ώρες = ' + p.toFixed(1).padStart(5) + '%');
    const row = table.find(function (r) { return r.lead === lead; });
    if (row) { row.looksCalmMayNotBePct = Number(p.toFixed(2)); row.looksCalmHours = b.looksCalmMayNotBe; }
  }

  const totalDays = byLead.reduce((s, b) => s + b.days, 0);
  const totalUncertain = byLead.reduce((s, b) => s + b.uncertainDays, 0);
  const overallPct = totalDays ? (100 * totalUncertain / totalDays) : 0;

  console.log(`\n── Η ΚΡΙΣΗ (κατώφλι γραμμένο ΠΡΙΝ τη μέτρηση) ────────────────────`);
  console.log(`  αβέβαιες περιοχο-ημέρες συνολικά: ${totalUncertain}/${totalDays} = ${overallPct.toFixed(1)}%`);
  const verdict = overallPct < 2 ? 'ΔΕΝ ΑΞΙΖΕΙ — δεν θα πυροδοτούσε σχεδόν ποτέ'
    : overallPct > 25 ? 'ΠΟΛΥ ΧΑΛΑΡΟ — θα γινόταν μόνιμο ταμπελάκι από την πίσω πόρτα'
      : 'ΧΡΗΣΙΜΟ ΕΥΡΟΣ';
  console.log(`  ➜ ${verdict}`);
  console.log(`     (<2% δεν αξίζει · >25% πολύ χαλαρό)`);

  if (worstDays.length) {
    console.log('\n  Οι πιο αβέβαιες περιοχο-ημέρες:');
    worstDays.sort((a, b) => b.gap - a.gap || b.uncertainHours - a.uncertainHours)
      .slice(0, 8)
      .forEach((w) => console.log(`    ${w.region} ημέρα +${w.lead}: ${w.uncertainHours} αβέβαιες ώρες · χειρότερη ${w.stamp.slice(11, 16)} → σενάρια από ${w.lo} έως ${w.hi} Μποφ.`));
  }

  const outDir = path.join(root, 'reports/quality');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'ensemble-spread.json');
  fs.writeFileSync(file, JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: MODEL,
    members: memberCount,
    forecastDays: DAYS,
    thresholds: {
      uncertainHour: 'p90 - p10 >= ' + GAP_RUNGS + ' Beaufort rungs',
      twoRung: 'p90 - p10 >= 2 Beaufort',
      uncertainDay: `>= ${UNCERTAIN_HOURS_FOR_DAY} uncertain hours between ${SWIM_START_H}:00 and ${SWIM_END_H}:00`,
      judgement: '<2% not worth it, >25% too loose',
    },
    regionsAnswered,
    regionsAsked: regions.length,
    byLead: table,
    overallUncertainDayPct: Number(overallPct.toFixed(2)),
    verdict,
    worst: worstDays.slice(0, 60),
    /**
     * ΟΛΕΣ οι αβέβαιες περιοχο-ημέρες, όχι μόνο οι 60 χειρότερες (§ΑΞ1/Α5, 21/08/2026).
     * Το `worst` είναι για ανάγνωση από άνθρωπο· αυτή η λίστα είναι για ΜΕΤΡΗΣΗ: το
     * scripts/measureEnsembleBrakeImpact.mjs την ενώνει με την απογραφή χρωμάτων για να
     * απαντήσει «πόσες παραλιο-ημέρες θα άλλαζαν αν το φρένο άναβε».
     */
    uncertainRegionDays: worstDays.map(({ region, lead, uncertainHours, gap, lo, hi }) => (
      { region, lead, uncertainHours, gap, lo, hi })),
  }, null, 2), 'utf8');
  console.log(`\n💾 ${path.relative(root, file)}\n`);
};

run().catch((err) => { console.error(err); process.exit(1); });

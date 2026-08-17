#!/usr/bin/env node
/**
 * Η ΠΥΛΗ ΤΩΝ ΟΔΗΓΙΩΝ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΗ — ΜΟΝΟ ΠΡΟΣ ΤΑ ΠΑΝΩ
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Το `nav-fixes-*.json` που βγάζει το auditPlaceResolution.mjs δεν είναι λίστα
 * βελτιώσεων· είναι η γνώμη ΕΝΟΣ σήματος (ψάχνει αν το όνομα βρίσκεται στο Nominatim/OSM).
 * Δοκιμασμένο στη Σκόπελο 17/08/2026, από τις 9 προτάσεις:
 *   · 2 θα ΕΠΑΙΡΝΑΝ το κουμπί «Οδηγίες» από παραλίες που το έχουν και δουλεύει
 *     (Στάφυλος, Αρμενόπετρα: verified με Google placeId → needs-review = μόνο «δες στον χάρτη»),
 *   · 3 θα ΠΕΤΑΓΑΝ επιβεβαιωμένο Google placeId για μια σκέτη συντεταγμένη — το applyNavigationAudit
 *     γράφει `mode = placeId ? 'place' : navMode` και οι γραμμές του ελέγχου ΔΕΝ κουβαλάνε placeId,
 *     οπότε η κάρτα του μέρους χάνεται σιωπηλά,
 *   · 1 ήταν πραγματική βελτίωση (Σπηλιά: καμία κατάσταση → verified/coordinates).
 *
 * ΓΙΑΤΙ Η ΥΠΟΒΑΘΜΙΣΗ ΕΙΝΑΙ ΛΑΘΟΣ ΕΔΩ. «Το OSM δεν ξέρει αυτό το όνομα» δεν σημαίνει «η πινέζα
 * είναι λάθος» — είναι το ίδιο ψευδώς θετικό που έβγαζε 7 «σπασμένες πινέζες» ενώ ήταν μία
 * (reports/quality/pin-adjudication.json, 17/08). Μια παραλία χωρίς κατάσταση ΗΔΗ δίνει οδηγίες
 * προς την πινέζα της (utils/navigation.ts, case 'default'). Το να την κατεβάσουμε σε
 * needs-review αφαιρεί ένα κουμπί που δουλεύει, με μόνο επιχείρημα ότι ο OSM δεν χαρτογράφησε
 * τον όρμο. Η υποβάθμιση θέλει απόδειξη ότι η ΠΙΝΕΖΑ είναι λάθος — δουλειά του ελέγχου πινέζας.
 *
 * ΤΙ ΠΕΡΝΑΕΙ: μόνο γραμμές που ανεβάζουν μια παραλία σε 'verified' ΚΑΙ που δεν πετάνε placeId.
 *
 * Χρήση:  node scripts/filterNavFixesUpgradesOnly.mjs --in <nav-fixes.json> --out <file.json>
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const IN = arg('--in');
const OUT = arg('--out');
if (!IN || !OUT) {
  console.error('usage: --in <nav-fixes.json> --out <filtered.json>');
  process.exit(1);
}

// Current navigation state for every beach, so a proposal can be compared with what ships today.
const navById = new Map();
for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  let rows;
  try { rows = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')); } catch { continue; }
  if (!Array.isArray(rows)) continue;
  for (const b of rows) navById.set(Number(b.id), b.metadata?.googleMapsNavigation || null);
}

const proposals = JSON.parse(readFileSync(path.isAbsolute(IN) ? IN : path.join(rootDir, IN), 'utf8'));
const kept = [];
const rejected = [];
for (const row of proposals) {
  const current = navById.get(Number(row.id));
  const currentVerified = current?.status === 'verified';
  const hasPlaceId = Boolean(current?.placeId);

  if (row.status !== 'verified') {
    rejected.push({ ...row, rejectedBecause: currentVerified || !current
      ? 'υποβάθμιση — δεν αφαιρούμε κουμπί οδηγιών επειδή ο OSM δεν ξέρει το όνομα'
      : 'δεν βελτιώνει τίποτα' });
  } else if (hasPlaceId && row.navMode !== 'place') {
    rejected.push({ ...row, rejectedBecause: 'θα πετούσε επιβεβαιωμένο Google placeId για σκέτη συντεταγμένη' });
  } else if (currentVerified) {
    rejected.push({ ...row, rejectedBecause: 'ήδη verified — καμία αλλαγή' });
  } else {
    kept.push(row);
  }
}

const outPath = path.isAbsolute(OUT) ? OUT : path.join(rootDir, OUT);
writeFileSync(outPath, JSON.stringify(kept, null, 2) + '\n', 'utf8');
console.log(`${proposals.length} προτάσεις → ${kept.length} πέρασαν, ${rejected.length} απορρίφθηκαν`);
for (const r of kept) console.log(`  ✓ #${r.id} ${r.name} → ${r.status}/${r.navMode}`);
for (const r of rejected) console.log(`  · #${r.id} ${r.name}: ${r.rejectedBecause}`);
console.log(`\n→ ${path.relative(rootDir, outPath)}`);

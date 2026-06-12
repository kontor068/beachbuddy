/**
 * Hybrid-nav NON-BOAT ABSENT regression (hard gate). Runs getNavigationUrl over every beach for
 * mobile and desktop and diffs against a baseline. Contract (revised spec, batch-approved
 * 2026-06-12): every NON-BOAT ABSENT beach (no googleMapsNavigation status, not low-confidence,
 * and NOT boat-only access) MUST keep a byte-identical URL — the default place-first flow is
 * unchanged for them. Boat-only ABSENT beaches are EXCLUDED from the gate: the boat-safety rule
 * intentionally converts them place-dir -> coord-locate (a safety improvement, never a route to
 * "the sand"). Run via scripts/navRegressionSnapshot.mjs.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { getNavigationUrl } from '../utils/navigation';
import type { Beach } from '../types';

const mode = process.argv[2]; // 'save' | 'diff'
const SNAP = '.tmp/nav-absent-baseline.json';
const appDir = 'public/data/beaches/app';

const beaches: Array<{ beach: Beach; absent: boolean }> = [];
const BOAT_ONLY = new Set(['boat_only', 'boat_or_difficult_path']);
for (const f of readdirSync(appDir).filter(n => n.endsWith('.json'))) {
  let d: any;
  try { d = JSON.parse(readFileSync(path.join(appDir, f), 'utf8')); } catch { continue; }
  for (const b of d.island?.beaches || []) {
    const nav = b.metadata?.googleMapsNavigation;
    const lowConf = b.metadata?.confidence === 'low';
    const boat = BOAT_ONLY.has(String(b.metadata?.access?.type)) || b.accessibility === 'BOAT_ONLY';
    // NON-BOAT ABSENT = no status, not low-confidence, AND not boat-only access.
    const absent = !nav?.status && !lowConf && !boat;
    beaches.push({ beach: b as Beach, absent });
  }
}

const urlsFor = (b: Beach) => ({
  mobile: getNavigationUrl(b, true) ?? null,
  desktop: getNavigationUrl(b, false) ?? null,
});

if (mode === 'save') {
  const snap: Record<number, { mobile: string | null; desktop: string | null }> = {};
  let absentCount = 0;
  for (const { beach, absent } of beaches) {
    if (!absent) continue;
    absentCount += 1;
    snap[beach.id as number] = urlsFor(beach);
  }
  writeFileSync(SNAP, JSON.stringify(snap, null, 1));
  console.log(`saved ${absentCount} ABSENT beach URL pairs -> ${SNAP}`);
} else if (mode === 'diff') {
  if (!existsSync(SNAP)) { console.error('no baseline at ' + SNAP); process.exit(1); }
  const before = JSON.parse(readFileSync(SNAP, 'utf8'));
  let checked = 0;
  const diffs: string[] = [];
  for (const { beach, absent } of beaches) {
    if (!absent) continue;
    const b = before[beach.id as number];
    if (!b) { diffs.push(`#${beach.id}: ABSENT now but missing from baseline`); continue; }
    const a = urlsFor(beach);
    checked += 1;
    if (a.mobile !== b.mobile) diffs.push(`#${beach.id} ${beach.name?.en} MOBILE: ${b.mobile} -> ${a.mobile}`);
    if (a.desktop !== b.desktop) diffs.push(`#${beach.id} ${beach.name?.en} DESKTOP: ${b.desktop} -> ${a.desktop}`);
  }
  console.log(`ABSENT regression: ${checked} beaches checked (mobile+desktop), ${diffs.length} URL diffs`);
  if (diffs.length > 0) {
    console.log('HARD GATE FAIL — ABSENT URLs changed:');
    diffs.slice(0, 40).forEach(l => console.log('  - ' + l));
    process.exitCode = 1;
  } else {
    console.log('HARD GATE PASS — every ABSENT beach URL is byte-identical (mobile+desktop).');
  }
} else {
  console.error('usage: node scripts/navRegressionSnapshot.mjs save|diff');
  process.exit(1);
}

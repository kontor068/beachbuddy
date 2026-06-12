/**
 * Hybrid-nav named validation (expected declared BEFORE implementation, per the plan). Runs
 * getNavigationAction + getNavigationUrl over the named cases and checks kind/badge/mode vs the
 * pre-registered expected column. Run via scripts/navValidation.mjs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { getNavigationAction, getNavigationUrl } from '../utils/navigation';
import type { Beach } from '../types';

const appDir = 'public/data/beaches/app';
const byId = new Map<number, Beach>();
for (const f of readdirSync(appDir).filter(n => n.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(readFileSync(path.join(appDir, f), 'utf8')); } catch { continue; }
  for (const b of d.island?.beaches || []) byId.set(b.id, b as Beach);
}

type Case = { id: number; label: string; expectKind: 'directions' | 'locate' | 'none'; expectBadge?: string; expectUrlIncludes?: string; note: string };
const cases: Case[] = [
  { id: 2012, label: 'Plaka Naxos', expectKind: 'directions', expectUrlIncludes: '/dir/', note: 'verified/coordinates -> directions to coords (mobile dir)' },
  { id: 1922, label: 'Sarakiniko Milos', expectKind: 'directions', expectUrlIncludes: '/dir/', note: 'verified/coordinates (cross-island collision) -> directions to coords' },
  { id: 1707, label: 'Lefkivari Andros', expectKind: 'directions', note: 'verified/place (ex-low-conf) -> directions place' },
  { id: 1848, label: 'Lakos Kimolos', expectKind: 'directions', expectUrlIncludes: 'Lakos%20Beach', note: 'verified + nav.query -> directions to the explicit query' },
  { id: 2062, label: 'Red Beach Santorini', expectKind: 'locate', expectBadge: 'boat-access', note: 'verified BUT boat_only -> boat rule wins -> locate' },
  { id: 1159, label: 'Egkremni Lefkada', expectKind: 'locate', expectBadge: 'boat-access', note: 'ABSENT(?) boat_only -> locate' },
  { id: 2011, label: 'Panormos Naxos', expectKind: 'locate', expectBadge: 'nav-unavailable', note: 'blocked -> locate + nav-unavailable' },
  { id: 1688, label: 'Agios Petros Andros', expectKind: 'locate', expectBadge: 'nav-unverified', note: 'needs-review + mode=place -> RULE 3 locate branch' },
  { id: 1714, label: 'Bouros Andros', expectKind: 'directions', note: 'needs-review + mode=coordinates -> RULE 3 directions branch' },
  { id: 1113, label: 'Myrtos Kefalonia', expectKind: 'directions', note: 'ABSENT normal access -> directions place (today, UNCHANGED)' },
  { id: 3000, label: 'Kleftiko Milos', expectKind: 'locate', expectBadge: 'boat-access', note: 'verified/coordinates + boat_only -> boat rule -> locate' },
];

let pass = 0; let fail = 0;
for (const c of cases) {
  const beach = byId.get(c.id);
  if (!beach) { console.log(`SKIP #${c.id} ${c.label} (not found)`); continue; }
  const action = getNavigationAction(beach);
  const url = getNavigationUrl(beach, true) ?? '';
  const access = (beach as any).metadata?.access?.type;
  const status = (beach as any).metadata?.googleMapsNavigation?.status ?? ((beach as any).metadata?.confidence === 'low' ? 'low-conf' : 'ABSENT');
  const mode = (beach as any).metadata?.googleMapsNavigation?.mode ?? '-';
  let ok = action.kind === c.expectKind;
  if (c.expectBadge) ok = ok && action.badge === c.expectBadge;
  if (c.expectUrlIncludes) ok = ok && url.includes(c.expectUrlIncludes);
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} #${c.id} ${c.label.padEnd(22)} got kind=${action.kind}${action.badge ? '/' + action.badge : ''} | status=${status} mode=${mode} access=${access}`);
  console.log(`     url: ${url.slice(0, 95)}`);
  console.log(`     expect: ${c.expectKind}${c.expectBadge ? '/' + c.expectBadge : ''} — ${c.note}`);
}
console.log(`\nValidation: ${pass}/${pass + fail} passed.`);
if (fail > 0) process.exitCode = 1;

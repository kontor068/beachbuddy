/**
 * Εξάγει το ΓΕΩΜΕΤΡΙΚΟ K_d (βίβλος §Γ71) ανά παραλία × διεύθυνση κύματος (0..355, βήμα 5°),
 * για τον κριτή αφρού Sentinel-2 (scripts/judgeShoreSurfSentinel2.py).
 *
 * «Γεωμετρικό» = χωρίς την εξαίρεση των μαρτύρων (JUDGE_WITNESSED_ARRIVAL_BEACH_IDS): ο κριτής
 * κρίνει τη ΓΕΩΜΕΤΡΙΑ, όχι το πάτωμα που μπήκε πάνω της. Ίδιο κόλπο με την πύλη
 * shore-shadow-contract Δ0 (`beachId: -1`).
 *
 * Run: node scripts/exportGeometricShadowKd.mjs 2009 1428 …  → .tmp/shadow-kd-geometric.json
 *      node scripts/exportGeometricShadowKd.mjs --all        (κάθε παραλία με προφίλ έκθεσης — πανελλαδικός κριτής)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { resolveShoreShadowDamping, resolveSeaArrivalExposureLevel } = require(path.join(root, 'utils/seaArrival.ts'));
const { shoreSeaStateM } = require(path.join(root, 'utils/waveCharacter.ts'));

// «ΤΙ ΛΕΜΕ» (10/09, πανελλαδικός κριτής): το K_d εφαρμόζεται ΜΟΝΟ όταν η ακτή κερδίζει την έκπτωση —
// τομέας 'protected' και θάλασσα που δεν «πέφτει πάνω» της, ή τσέπη. Αλλιώς η σελίδα τυπώνει όλο το
// ύψος όσο βαθιά σκιά κι αν λέει η γεωμετρία. Άρα η ερώτηση «λέμε ήρεμη;» θέλει το ΚΛΑΣΜΑ που βγάζει
// η ίδια η shoreSeaStateM (το σκέλος της σκιάς, χωρίς ράμπες/δάπεδα/ταβάνια), όχι σκέτο το K_d.
// Ο άνεμος διαβάζεται από τον τομέα της διεύθυνσης του κύματος — όπως στο measureShadowVsBlockedArrival.mjs.
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorLevelAt = (profile, deg) => profile?.sectors?.[SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]]?.level;

const ALL = process.argv.includes('--all');
const wanted = new Set(process.argv.slice(2).map(Number).filter(Number.isFinite));
if (!wanted.size && !ALL) { console.error('Δώσε ids παραλιών ή --all'); process.exit(1); }

const dir = path.join(root, 'public/data/geospatial/exposure');
const out = {};
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const list = Array.isArray(d) ? d : Array.isArray(d?.profiles) ? d.profiles : (d?.profiles ? Object.values(d.profiles) : []);
  for (const p of list) {
    if (typeof p?.beachId !== 'number') continue;
    if (ALL) wanted.add(p.beachId);
    if (!wanted.has(p.beachId)) continue;
    const kd = [];
    const say = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const v = resolveShoreShadowDamping({ ...p, beachId: -1 }, deg);
      kd.push(typeof v === 'number' ? Math.round(v * 1000) / 1000 : null);
      const s = shoreSeaStateM(1, sectorLevelAt(p, deg), resolveSeaArrivalExposureLevel(p, deg), false, v);
      say.push(typeof s === 'number' ? s : null);
    }
    out[p.beachId] = { facingDeg: p.facingDeg ?? null, kd, say };
  }
}
const target = path.join(root, '.tmp/shadow-kd-geometric.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify({ stepDeg: 5, note: 'kd = K_d γεωμετρίας χωρίς εξαίρεση μαρτύρων; say = κλάσμα του ανοιχτού κύματος που τυπώνει η shoreSeaStateM με αυτό το K_d (σκέλος σκιάς); null = δεν κρίνεται', beaches: out }));
const missing = [...wanted].filter((id) => !out[id]);
console.log(`K_d: ${Object.keys(out).length}/${wanted.size} παραλίες → ${path.relative(root, target)}${missing.length ? ` · λείπουν ${missing.join(',')}` : ''}`);

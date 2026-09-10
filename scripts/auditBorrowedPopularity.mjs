/**
 * Which beaches wear another beach's Google rating?
 *
 * THE DEFECT. `metadata.popularity` holds a Google rating + review count, and it decides a lot:
 * the star chips on the card, list order, and the measured «ήσυχη / δημοφιλής» label
 * (`buildBeachRegionData.mjs` — a beach is "quiet" when the review count is under 100). Until the
 * place-card collision was fixed on 09/09/2026, several beaches pointed at a NEIGHBOUR's Google
 * card, so the popularity pass copied that neighbour's numbers onto them. Ψωράρης — a cove — wore
 * the 539 reviews of Κήπος Μιχαλιού next door and was ranked «δημοφιλής» on a number that was
 * never about it. Λακκί wore the 246 of Βοτσαλάκια.
 *
 * THE SIGNAL. A rating is a mean over hundreds of reviews. Two beaches landing on the SAME mean
 * to one decimal AND the SAME review count is not two crowds agreeing — it is one measurement
 * written twice. Restricted to pairs in the same region within `--max-km` of each other, so
 * genuinely unrelated beaches that happen to share round numbers are not swept in.
 *
 * WHO OWNS IT. `reports/place-resolution/google-upgrade.json` is the cached June answer from
 * Google, per beach: which place card that beach's query resolved to, and what that card is
 * called. The owner is the beach whose card name matches its own name; the other one borrowed.
 * When neither matches, or both do, the pair is UNDECIDED and nothing is proposed — the numbers
 * are simply not ours to reassign.
 *
 * WHAT RETRACTION MEANS. `popularity` is deleted, not replaced. The beach then has no rating and
 * no review count, which reads as "unknown" everywhere — deliberately NOT "quiet", because
 * `quiet` is a measured claim and we have no measurement (`buildBeachRegionData.mjs` presumes
 * quiet only behind its own gates). Fewer stars on a card is a smaller lie than another beach's stars.
 *
 * Report-only. Writes reports/quality/borrowed-popularity-<date>.json.
 * `--apply` retracts ONLY the rows the cached card decides, never the UNDECIDED ones.
 *
 * Run:  node scripts/auditBorrowedPopularity.mjs [--max-km 3] [--min-count 20] [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
};
const MAX_KM = Number(arg('--max-km', 3));
const MIN_COUNT = Number(arg('--min-count', 20));
const APPLY = process.argv.includes('--apply');

const beachesPath = path.join(rootDir, 'public', 'greek_beaches.json');
const raw = JSON.parse(fs.readFileSync(beachesPath, 'utf8'));
const beaches = [];
const walk = (node, trail) => {
  if (Array.isArray(node)) {
    node.forEach((b) => { if (b && b.id != null && b.name) beaches.push({ ...b, __trail: trail }); });
    return;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) walk(node[key], trail ? `${trail}/${key}` : key);
  }
};
walk(raw, '');

const upgradePath = path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json');
const upgradeRaw = JSON.parse(fs.readFileSync(upgradePath, 'utf8'));
const upgradeRows = Array.isArray(upgradeRaw) ? upgradeRaw : Object.values(upgradeRaw).find((v) => Array.isArray(v));
const cardById = new Map(upgradeRows.map((r) => [r.id, r]));

const RAD = Math.PI / 180;
const distanceKm = (a, b) => {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Strip the generic words and the accents, so «Παραλία Βοτσαλάκια» and «Βοτσαλάκια» are one
// name and «Φραγκολιμιώνα» is not.
//
// GREEK HOMOPHONES MUST FOLD TOO. Without this, «Βρομόλιθος» and «Βρωμόλιθος» read as two
// different names and the audit would have declared one of them the borrower — when they are the
// same name spelled two ways, and the pair is really a possible duplicate record for a human to
// judge. ο/ω, and ι/η/υ/ει/οι, sound identical in Greek and are written both ways on maps.
//
// `\b` IS ASCII-ONLY IN JAVASCRIPT. Written as /\b(…|παραλια|…)\b/ the Greek alternatives never
// match, so «Παραλία Βρωμόλιθος» kept its prefix while «Βρομόλιθος» did not, and the audit
// decided the owner on the presence of the word «Παραλία» rather than on the name. Strip the
// generic words AFTER the letters-only pass, by position, with no word boundary at all.
const GENERIC = /^(?:παραλια|ακτη|ορμος|κολπος|beach|paralia|akti|ormos)/;
const fold = (value) => {
  let out = String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9α-ωά-ώ]+/g, '')
    .replace(/ει|οι|υι/g, 'ι').replace(/[ηυ]/g, 'ι').replace(/ω/g, 'ο').replace(/αι/g, 'ε');
  // A name may lead with more than one generic word («Όρμος Παραλία …»).
  let previous;
  do { previous = out; out = out.replace(GENERIC, ''); } while (out !== previous && out);
  return out || previous;
};

const live = beaches.filter((b) => !b.metadata?.excludeFromApp && !b.excludeFromApp);
const withPopularity = live.filter((b) => Number(b.metadata?.popularity?.ratingCount) >= MIN_COUNT);

const groups = new Map();
for (const beach of withPopularity) {
  const p = beach.metadata.popularity;
  const key = `${p.rating}|${p.ratingCount}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(beach);
}

const decided = [];
const undecided = [];

for (const [key, members] of groups) {
  if (members.length < 2) continue;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a.__trail !== b.__trail) continue;
      const km = distanceKm(a, b);
      if (km > MAX_KM) continue;

      const describe = (x) => {
        const card = cardById.get(x.id);
        const cardName = card?.top?.name || null;
        return {
          id: x.id,
          name: x.name,
          cardName,
          matchesOwnName: Boolean(cardName) && fold(cardName) === fold(x.name),
        };
      };
      const left = describe(a);
      const right = describe(b);
      const row = {
        region: a.__trail.split('/').pop(),
        sharedRating: key,
        distanceKm: Number(km.toFixed(2)),
        beaches: [left, right],
      };

      const owners = [left, right].filter((x) => x.matchesOwnName);
      if (owners.length === 1) {
        const owner = owners[0];
        const borrower = owner === left ? right : left;
        decided.push({ ...row, owner: owner.id, retract: borrower.id, retractName: borrower.name, ownerName: owner.name });
      } else {
        undecided.push({ ...row, reason: owners.length === 0 ? 'neither card carries the beach own name' : 'both cards match — cannot tell who measured what' });
      }
    }
  }
}

const outDir = path.join(rootDir, 'reports', 'quality');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = path.join(outDir, `borrowed-popularity-${stamp}.json`);
fs.writeFileSync(outPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  maxKm: MAX_KM,
  minCount: MIN_COUNT,
  counts: { decided: decided.length, undecided: undecided.length },
  decided,
  undecided,
}, null, 2)}\n`, 'utf8');

console.log(`Pairs sharing an identical rating AND review count, same region, ≤${MAX_KM} km: ${decided.length + undecided.length}`);
console.log('');
console.log(`DECIDED — the cached Google card names one of the two, the other borrowed: ${decided.length}`);
for (const row of decided) {
  console.log(`  ${row.region} · ${row.sharedRating} · ${row.distanceKm} km`);
  console.log(`     keeps    #${row.owner} ${row.ownerName}  (card «${row.beaches.find((b) => b.id === row.owner).cardName}»)`);
  console.log(`     retract  #${row.retract} ${row.retractName}  (card «${row.beaches.find((b) => b.id === row.retract).cardName || '—'}»)`);
}
console.log('');
console.log(`UNDECIDED — left alone: ${undecided.length}`);
for (const row of undecided) {
  console.log(`  ${row.region} · ${row.sharedRating} · ${row.beaches.map((b) => `#${b.id} ${b.name}`).join(' + ')} — ${row.reason}`);
}
console.log('');
console.log(`→ ${path.relative(rootDir, outPath)}`);

if (!APPLY) {
  console.log('\n(dry run — pass --apply to retract the DECIDED borrowers)');
} else if (!decided.length) {
  console.log('\nNothing to apply.');
} else {
  const toRetract = new Map(decided.map((r) => [r.retract, r]));
  let done = 0;
  const applyWalk = (node) => {
    if (Array.isArray(node)) {
      node.forEach((b) => {
        const row = b && toRetract.get(b.id);
        if (!row || !b.metadata?.popularity) return;
        const was = JSON.stringify(b.metadata.popularity);
        delete b.metadata.popularity;
        if (!Array.isArray(b.metadata.sourceNotes)) {
          b.metadata.sourceNotes = b.metadata.sourceNotes && b.metadata.sourceNotes !== '.' ? [String(b.metadata.sourceNotes)] : [];
        }
        b.metadata.sourceNotes.push(
          `Popularity retracted ${stamp}: ${was} is identical to #${row.owner} ${row.ownerName} ${row.distanceKm} km away, whose own Google card «${row.beaches.find((x) => x.id === row.owner).cardName}» produced it. Borrowed through the place-card collision, not a measurement of this beach. Left unknown — deliberately not "quiet", which is a measured claim.`,
        );
        done += 1;
      });
      return;
    }
    if (node && typeof node === 'object') for (const key of Object.keys(node)) applyWalk(node[key]);
  };
  applyWalk(raw);
  fs.writeFileSync(beachesPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`\nRETRACTED popularity on ${done} beaches. Run: npm run build:beach-data`);
}

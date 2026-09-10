/**
 * Which beaches show a LATIN name to a Greek visitor, and what should they be called?
 *
 * THE DEFECT. 79 beaches we serve carry a Latin-script name in every language, because
 * they were imported from OpenStreetMap under a transliterated name and nobody ever wrote
 * the Greek one. A Greek visitor sees «Achlada» instead of «Αχλάδα» on the card, and —
 * worse — searching «Αχλάδα» does not find the beach at all. It is concentrated in the two
 * regions that matter most: Halkidiki (53 of 133) and Chania (22 of 90).
 *
 * THE MECHANISM ALREADY EXISTS. A raw record may carry an optional `nameGr`; the builder
 * uses it as the Greek display name (scripts/buildBeachRegionData.mjs). #379 «Agios
 * Georgios» already renders as «Άγιος Γεώργιος» that way. The others simply lack the field.
 *
 * THE EVIDENCE. scripts/data/osm-beaches-national.json — the harvest we already paid for —
 * holds each OSM beach's Greek `name` plus `displayName`, its greeklish transliteration.
 * A proposal is only as good as the proof that the Greek name is THIS beach's name and not
 * the neighbouring one's, so every candidate must clear two gates:
 *
 *   1. PROXIMITY  — the OSM object is within --radius (default 150 m) of our pin.
 *   2. IDENTITY   — our Latin name and the OSM transliteration are the same name.
 *
 * Gate 2 is the one that matters. Without it we would have renamed «Kryfos Paradeisos» to
 * «Κρυφός Παράδεισος Παραλία Γυμνιστών» (silently labelling a beach naturist), «Ouranoupoli»
 * to «Καμπούδι / Άκραθως» and «Porto Elea» to «Παραλία Ζωγράφου» — three different beaches.
 *
 * Two tiers, because one transliteration scheme is not the other:
 *   CONFIRMED — the two names are identical once ου/ou/oy, ει/ i, φ/f/ph and a leading
 *               «Παραλία»/«beach» are reconciled. Safe to apply.
 *   REVIEW    — recognisably related but not identical (a genitive, an extra word). A human
 *               decides; we never guess a name, because a wrong name is worse than a Latin one.
 *   REJECTED  — different names. Listed so the pairing is on the record, never applied.
 *
 * SIBLING, NOT A DUPLICATE. scripts/harvestGreekNamesOsm.mjs asks Nominatim the same
 * question and applies the same "it must romanise back to our name" rule. It is the right
 * tool when Nominatim answers; today it does not — a 12-beach run matched 0, reporting
 * «Akti Kalogrias» as "not found nearby" while the harvest on disk holds «Ακτή Καλογριάς»
 * one metre from our pin. This one needs no network and reuses evidence already paid for,
 * so the two together cover more than either alone. Both write the same additive `nameGr`.
 *
 * Writes reports/quality/greek-beach-names-<date>.json. Dry-run by default; `--apply`
 * writes `nameGr` for CONFIRMED rows only — never REVIEW, never REJECTED.
 *
 * Run:  node scripts/auditGreekBeachNames.mjs [--region <substr>] [--radius 150] [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
};

const regionFilter = (arg('--region', '') || '').toLowerCase();
const RADIUS_M = Number(arg('--radius', 150));
const APPLY = process.argv.includes('--apply');

// OSM capitalisation is inconsistent — «Χρυσή αμμουδιά» is tagged with a lowercase second
// word. Our own Greek names are title-cased, and a lowercase word on a card reads as a
// typo. Only lift a word that starts lowercase when the name already has an uppercase
// word, so a deliberately lowercase name is left alone.
const tidyCapitalisation = (name) => {
  const words = String(name).split(' ');
  const hasUpper = words.some((w) => w && w[0] === w[0].toUpperCase() && /[Ͱ-Ͽ]/.test(w[0]));
  if (!hasUpper) return name;
  return words
    .map((w) => (w && /[α-ω]/.test(w[0]) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
};

// --- load ------------------------------------------------------------------------------
const raw = JSON.parse(fs.readFileSync(path.join(rootDir, 'public', 'greek_beaches.json'), 'utf8'));
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

const harvestPath = path.join(rootDir, 'scripts', 'data', 'osm-beaches-national.json');
const harvestRaw = JSON.parse(fs.readFileSync(harvestPath, 'utf8'));
const osm = Array.isArray(harvestRaw) ? harvestRaw : Object.values(harvestRaw).find((v) => Array.isArray(v));

// SECOND EVIDENCE PATH: our own curated Greek story (added 10/09/2026).
// OSM only helps where a mapper wrote a Greek `name`. For Chania it did not: 19 beaches with a
// Latin name, 0 Greek names in the harvest even at 300 m. But we have already written Greek
// prose about many of them — «Η παραλία Αφράτα ανοίγεται σε έναν μικρό βοτσαλωτό κόλπο…» names
// the beach in the first sentence, in Greek, by a human who was writing about THIS beach.
// That is a stronger source than a map tag, and it costs nothing to read.
const storiesById = new Map();
const storiesDir = path.join(rootDir, 'data', 'beachStories');
if (fs.existsSync(storiesDir)) {
  for (const file of fs.readdirSync(storiesDir)) {
    if (!file.endsWith('.json')) continue;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path.join(storiesDir, file), 'utf8')); } catch { continue; }
    const table = parsed.beaches || parsed;
    for (const [id, story] of Object.entries(table)) {
      if (!story || typeof story !== 'object') continue;
      const parts = [story.title?.gr, ...(story.paragraphs?.gr || [])].filter((s) => typeof s === 'string');
      if (parts.length) storiesById.set(String(id), parts.join(' '));
    }
  }
}

// Greek → Latin is deterministic (Latin → Greek is not: an "i" can be ι, η, υ, ει or οι).
// So we never guess a spelling — we transliterate every Greek phrase the story contains and
// keep the one that comes back as the Latin name we already hold.
const GREEK_TO_LATIN = [
  ['ΟΥ', 'OU'], ['ΑΥ', 'AV'], ['ΕΥ', 'EV'], ['ΜΠ', 'B'], ['ΝΤ', 'D'], ['ΓΓ', 'NG'], ['ΤΣ', 'TS'], ['ΤΖ', 'TZ'], ['ΧΡ', 'CHR'],
  ['ου', 'ou'], ['αυ', 'av'], ['ευ', 'ev'], ['μπ', 'b'], ['ντ', 'd'], ['γγ', 'ng'], ['τσ', 'ts'], ['τζ', 'tz'],
  ['α', 'a'], ['ά', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['έ', 'e'], ['ζ', 'z'], ['η', 'i'], ['ή', 'i'],
  ['θ', 'th'], ['ι', 'i'], ['ί', 'i'], ['ϊ', 'i'], ['ΐ', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'],
  ['ο', 'o'], ['ό', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'], ['ύ', 'y'], ['ϋ', 'y'],
  ['ΰ', 'y'], ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'], ['ώ', 'o'],
  ['Α', 'A'], ['Ά', 'A'], ['Β', 'V'], ['Γ', 'G'], ['Δ', 'D'], ['Ε', 'E'], ['Έ', 'E'], ['Ζ', 'Z'], ['Η', 'I'], ['Ή', 'I'],
  ['Θ', 'Th'], ['Ι', 'I'], ['Ί', 'I'], ['Κ', 'K'], ['Λ', 'L'], ['Μ', 'M'], ['Ν', 'N'], ['Ξ', 'X'], ['Ο', 'O'], ['Ό', 'O'],
  ['Π', 'P'], ['Ρ', 'R'], ['Σ', 'S'], ['Τ', 'T'], ['Υ', 'Y'], ['Ύ', 'Y'], ['Φ', 'F'], ['Χ', 'Ch'], ['Ψ', 'Ps'], ['Ω', 'O'], ['Ώ', 'O'],
];
const greekToLatin = (value) =>
  GREEK_TO_LATIN.reduce((text, [from, to]) => text.split(from).join(to), String(value || ''));

// Words that are never the beach's own name, so a phrase made only of them can never win.
const STOPWORDS = /^(ο|η|το|οι|τα|του|της|των|στο|στη|στην|στον|στα|στις|στους|και|με|σε|από|για|παραλία|παραλίας|κόλπος|κόλπο|ακτή|ακτής|χωριό|χωριού|νησί|περιοχή|μια|ένα|ένας|αυτή|αυτό|είναι)$/i;

const findNameInStory = (beachId, ourLatinName) => {
  const text = storiesById.get(String(beachId));
  if (!text) return null;
  const target = foldLatin(ourLatinName);
  if (!target) return null;
  // Every capitalised Greek run of 1-3 words is a candidate; the fold decides.
  const words = text.split(/[^Ά-ώΪ-ΰ]+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    if (!/^[Α-ΩΆΈΉΊΌΎΏ]/.test(words[i])) continue;
    for (let span = 1; span <= 3 && i + span <= words.length; span += 1) {
      const phrase = words.slice(i, i + span).join(' ');
      if (phrase.split(' ').every((w) => STOPWORDS.test(w))) continue;
      if (foldLatin(greekToLatin(phrase)) === target) return phrase;
    }
  }
  return null;
};

// --- name comparison -------------------------------------------------------------------
const HAS_GREEK = /[Ͱ-Ͽ]/;

// Both sides are already Latin here: ours as authored, OSM's as the harvest transliterated
// it. They disagree on scheme, not on the name, so fold the known disagreements away:
// ου is written "ou" by us and "oy" by the harvest, φ is f or ph, β is v or b, and either
// side may or may not carry the word "beach"/"Παραλία".
const foldLatin = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\b(beach|paralia|akti|ormos)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '')
  .replace(/ph/g, 'f')
  .replace(/oy/g, 'ou')
  .replace(/y/g, 'i')
  .replace(/b/g, 'v')
  .replace(/ch/g, 'h')
  .replace(/kk/g, 'k')
  .replace(/ss/g, 's')
  .replace(/ll/g, 'l');

// A genitive ("Πευκοχωρίου" for "Pefkochori") or a dropped article still describes the same
// place, but it is a judgement call, so it lands in REVIEW rather than CONFIRMED.
const isRelated = (a, b) => {
  if (!a || !b) return false;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 4) return false;
  if (long.startsWith(short)) return long.length - short.length <= 3;
  return false;
};

const R = 6371000;
const RAD = Math.PI / 180;
const distanceM = (a, b) => {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// --- candidates ------------------------------------------------------------------------
const candidates = beaches.filter((b) => (
  !b.metadata?.excludeFromApp &&
  !b.excludeFromApp &&
  !HAS_GREEK.test(b.name) &&
  !b.nameGr &&
  (!regionFilter || b.__trail.toLowerCase().includes(regionFilter))
));

const confirmed = [];
const review = [];
const rejected = [];
const noEvidence = [];

for (const beach of candidates) {
  let best = null;
  for (const entry of osm) {
    const c = entry.coordinates;
    if (!c) continue;
    const d = distanceM(beach, { lat: c.lat, lon: c.lon });
    if (d <= RADIUS_M && (!best || d < best.d)) best = { d, entry };
  }
  if (!best || !HAS_GREEK.test(best.entry.name || '')) {
    // No Greek name on the map — ask our own story before giving up.
    const fromStory = findNameInStory(beach.id, beach.name);
    if (fromStory) {
      confirmed.push({
        id: beach.id,
        region: beach.__trail.split('/').pop(),
        ours: beach.name,
        proposedNameGr: tidyCapitalisation(fromStory),
        osmName: null,
        osmTransliteration: greekToLatin(fromStory),
        osmId: 'own-story',
        distanceM: 0,
      });
      continue;
    }
    noEvidence.push({ id: beach.id, name: beach.name, region: beach.__trail.split('/').pop() });
    continue;
  }

  const row = {
    id: beach.id,
    region: beach.__trail.split('/').pop(),
    ours: beach.name,
    proposedNameGr: tidyCapitalisation(best.entry.name),
    osmName: best.entry.name,
    osmTransliteration: best.entry.displayName,
    osmId: best.entry.id,
    distanceM: Math.round(best.d),
  };

  const ourFold = foldLatin(beach.name);
  const osmFold = foldLatin(best.entry.displayName);
  if (ourFold && ourFold === osmFold) confirmed.push(row);
  else if (isRelated(ourFold, osmFold)) review.push(row);
  else rejected.push(row);
}

// --- report ----------------------------------------------------------------------------
const outDir = path.join(rootDir, 'reports', 'quality');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = path.join(outDir, `greek-beach-names-${regionFilter ? `${regionFilter}-` : ''}${stamp}.json`);
fs.writeFileSync(outPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  radiusM: RADIUS_M,
  regionFilter: regionFilter || null,
  partial: Boolean(regionFilter),
  counts: {
    latinNamed: candidates.length,
    confirmed: confirmed.length,
    review: review.length,
    rejected: rejected.length,
    noEvidence: noEvidence.length,
  },
  confirmed,
  review,
  rejected,
  noEvidence,
}, null, 2)}\n`, 'utf8');

const byRegion = {};
for (const row of confirmed) byRegion[row.region] = (byRegion[row.region] || 0) + 1;

console.log(`Beaches shown to Greek visitors under a Latin name: ${candidates.length}`);
console.log('');
console.log(`CONFIRMED — same name, both gates passed: ${confirmed.length}`);
for (const row of confirmed) {
  console.log(`  #${row.id} «${row.ours}» -> «${row.proposedNameGr}»  (${row.distanceM} m, ${row.osmId})`);
}
console.log('');
console.log(`REVIEW — related but not identical, a human decides: ${review.length}`);
for (const row of review) {
  console.log(`  #${row.id} «${row.ours}»  ~  «${row.proposedNameGr}» (${row.osmTransliteration})`);
}
console.log('');
console.log(`REJECTED — the nearby OSM beach carries a DIFFERENT name: ${rejected.length}`);
for (const row of rejected) {
  console.log(`  #${row.id} «${row.ours}»  ≠  «${row.proposedNameGr}»`);
}
console.log('');
console.log(`No Greek name within ${RADIUS_M} m in the harvest: ${noEvidence.length}`);
console.log('');
console.log(`confirmed by region: ${JSON.stringify(byRegion)}`);
console.log(`→ ${path.relative(rootDir, outPath)}`);

// --- apply -----------------------------------------------------------------------------
// `nameGr` is additive: buildBeachRegionData.mjs uses it for the Greek label and for search
// aliases only. `name` — and with it the English label, the slug and every prerendered URL
// — is untouched, so a beach can gain its Greek name without a single page moving.
if (APPLY) {
  if (!confirmed.length) {
    console.log('\nNothing to apply.');
  } else {
    const byId = new Map(confirmed.map((r) => [r.id, r]));
    const stamped = [];
    const applyWalk = (node) => {
      if (Array.isArray(node)) {
        node.forEach((b) => {
          const row = b && byId.get(b.id);
          if (!row || b.nameGr) return;
          b.nameGr = row.proposedNameGr;
          b.metadata = b.metadata || {};
          b.metadata.sourceNotes = Array.isArray(b.metadata.sourceNotes) ? b.metadata.sourceNotes : [];
          b.metadata.sourceNotes.push(
            `Greek display name recovered ${stamp} from the national OSM harvest: ${row.osmId} «${row.osmName}» ${row.distanceM} m from our pin, and its transliteration «${row.osmTransliteration}» is the name we already held («${row.ours}»). Only nameGr was added; the English name, the slug and every URL are unchanged.`,
          );
          stamped.push(row);
        });
        return;
      }
      if (node && typeof node === 'object') for (const key of Object.keys(node)) applyWalk(node[key]);
    };
    applyWalk(raw);
    fs.writeFileSync(path.join(rootDir, 'public', 'greek_beaches.json'), JSON.stringify(raw, null, 2), 'utf8');
    console.log(`\nAPPLIED nameGr to ${stamped.length} beaches. Run: npm run build:beach-data`);
  }
} else {
  console.log('\n(dry run — pass --apply to write nameGr for the CONFIRMED rows)');
}

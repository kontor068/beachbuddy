/**
 * THE QUALITY LEDGER — "when did we last check this island, and what is still open?"
 *
 * The traffic console can already say which regions people actually visit. What it
 * could not say is whether the data behind those regions has been looked at since
 * May. Both halves existed; nothing joined them. This script builds the half that
 * was missing, and netlify/functions/traffic-stats.mjs joins it to the pageviews.
 *
 * WHAT IT READS (nothing is invented — every number traces to a file):
 *   public/data/beaches/index.json          the 110 regions and their Greek names
 *   public/data/beaches/<regionId>.json     every beach's metadata, per region
 *   reports/photo-coverage/beach-photo-presence.json   which beaches have a photo
 *   reports/quality/pin-*.json              beaches whose pin was confirmed wrong
 *   reports/**\/*.json                       every audit we have ever run, dated
 *
 * WHAT IT WRITES:
 *   netlify/functions/lib/qualityLedger.generated.mjs
 *
 * NOT public/. The ledger is a map of our own weak points ("47 beaches here have
 * no photo and unknown access"), and public/ is served to anyone who asks. A JS
 * module inside netlify/functions/lib is bundled INTO the function by esbuild, so
 * the console can read it and a visitor cannot. That is also why it is a .mjs and
 * not a .json: JSON imports need assertions that the bundler treats differently
 * across versions, and a build that silently ships an empty ledger is worse than
 * one that fails.
 *
 * RUN IT LOCALLY, COMMIT THE RESULT. Dates come from file names, then from git,
 * then from the file's own timestamp — and on Netlify's fresh clone every
 * timestamp is the moment of the clone, which would date every audit "today" and
 * quietly make the whole board lie. So this is not in the build chain on purpose.
 *
 *   node scripts/buildQualityLedger.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const reportsDir = path.join(rootDir, 'reports');
const outFile = path.join(rootDir, 'netlify', 'functions', 'lib', 'qualityLedger.generated.mjs');

const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const isoDay = (value) => {
  if (!value) return '';
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

/** The later of two ISO days; '' loses to anything. */
const laterDay = (a, b) => (!a ? b || '' : !b ? a : a >= b ? a : b);

// ─────────────────────────────────────────────────────────────────────────────
// THE SIX THINGS WE CLAIM ABOUT A BEACH
//
// One axis per kind of claim a visitor can be let down by, because "82% checked"
// tells you nothing you can act on and "the pins are fine, the amenities are not"
// tells you what to open tomorrow. Each axis answers ONE question with a yes/no
// per beach, and every rule below leans the same way: when we are not sure, the
// beach counts as NOT covered. A board that flatters us is a board that stops
// being opened.
// ─────────────────────────────────────────────────────────────────────────────
const AXES = [
  { key: 'pin', label: 'Πινέζα στον χάρτη', short: 'Πινέζα' },
  { key: 'nav', label: 'Πλοήγηση («Οδηγίες»)', short: 'Πλοήγηση' },
  { key: 'access', label: 'Πρόσβαση', short: 'Πρόσβαση' },
  { key: 'amenities', label: 'Παροχές', short: 'Παροχές' },
  { key: 'photo', label: 'Φωτογραφία', short: 'Φωτό' },
  { key: 'character', label: 'Χαρακτήρας (άμμος · βάθος · μπροστά πού βλέπει)', short: 'Χαρακτήρας' },
  { key: 'text', label: 'Σιγουριά κειμένου', short: 'Κείμενο' },
];

// ── things that are TRUE OF FEW BEACHES, not gaps ────────────────────────────
// A beach with no shower is not a beach we failed to check. Counting these as
// coverage would report 9% and read as a catastrophe, when the honest sentence
// is "268 beaches have a shower recorded". They get their own panel: what we
// know, not what we owe.
const FEATURES = [
  { key: 'blueFlag', label: 'Γαλάζια σημαία', pick: (m) => m.blueFlag2026?.awarded === true },
  { key: 'shower', label: 'Ντους', pick: (m) => m.hasShower === true },
  { key: 'accessible', label: 'Πρόσβαση ΑμεΑ', pick: (m) => m.seatrac?.hasSeatrac === true },
  { key: 'camping', label: 'Κάμπινγκ κοντά', pick: (m) => Array.isArray(m.nearbyCamping) && m.nearbyCamping.length > 0 },
  { key: 'paid', label: 'Με εισιτήριο', pick: (m) => m.paidEntry?.paid === true },
  { key: 'rating', label: 'Βαθμολογία κόσμου', pick: (m) => Number(m.popularity?.ratingCount) > 0 },
  { key: 'aliases', label: 'Άλλα ονόματα', pick: (m) => Array.isArray(m.aliases) && m.aliases.length > 0 },
];

// ── which beaches a national audit has already proved wrong ──────────────────
// `confirmed` in the pin audits means "we looked and the pin really is off the
// beach" — not "suspect". Only confirmed ones count against a region, so a
// suspect list that has not been adjudicated yet cannot scare the board.
const flaggedPins = new Set();
for (const file of ['pin-placement-audit.json', 'pin-coastline-audit.json']) {
  const data = readJson(path.join(reportsDir, 'quality', file));
  if (!data) continue;
  for (const row of data.confirmed || []) if (row?.id != null) flaggedPins.add(Number(row.id));
  // The coastline audit records its verdict per row instead of in a bucket.
  for (const row of data.results || []) {
    if (row?.id != null && (row.verdict === 'inland' || row.verdict === 'offshore')) {
      flaggedPins.add(Number(row.id));
    }
  }
}

// ── which beaches have a photo ───────────────────────────────────────────────
// From the photo audit rather than from data/beachPhotosById.generated.json,
// because photos also resolve by name and by area; the audit runs the real
// resolution and is the only source that agrees with what a visitor sees.
const photoRows = readJson(path.join(reportsDir, 'photo-coverage', 'beach-photo-presence.json'), []);
const beachesWithPhoto = new Set(
  (Array.isArray(photoRows) ? photoRows : []).filter((r) => r?.hasPhoto).map((r) => Number(r.id))
);
const photoAuditKnows = beachesWithPhoto.size > 0;

// ─────────────────────────────────────────────────────────────────────────────
// DATES — when was each kind of thing last looked at
// ─────────────────────────────────────────────────────────────────────────────

/** Last commit date of a file, or '' when git cannot say (untracked, shallow clone). */
const gitDay = (file) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return isoDay(out.trim());
  } catch {
    return '';
  }
};

/**
 * What kind of check a report file represents, from where it lives. Anything we
 * cannot place lands in 'other' and still counts as "we were in here on that
 * day" — knowing a region was touched is useful even when the topic is unclear.
 */
const auditKind = (relPath) => {
  const p = relPath.replace(/\\/g, '/').toLowerCase();
  if (/access-road|access-verify|dirt|surface/.test(p)) return 'access';
  if (/photo/.test(p)) return 'photo';
  if (/pin-|pin_|coastline|placement/.test(p)) return 'pin';
  if (/place-resolution|google-places|nav|maps-dir/.test(p)) return 'nav';
  if (/amenit|shower|camping|paid|seatrac/.test(p)) return 'amenities';
  if (/wind|exposure|wave|marine|shoreline|map-stability|climat/.test(p)) return 'weather';
  return 'other';
};

const KIND_LABEL = {
  access: 'Πρόσβαση',
  photo: 'Φωτογραφίες',
  pin: 'Πινέζες',
  nav: 'Πλοήγηση',
  amenities: 'Παροχές',
  weather: 'Άνεμος / κύμα / γεωμετρία',
  other: 'Γενικός έλεγχος',
};

/** Every .json under reports/, ignoring caches — a cache is not a check. */
const listReports = (dir, out = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listReports(full, out);
    else if (entry.isFile() && entry.name.endsWith('.json') && !/cache|thumbs/i.test(entry.name)) out.push(full);
  }
  return out;
};

/**
 * Which regions a report is about, and when it ran.
 *
 * Region ids appear in three shapes across the 190-odd report files we have
 * accumulated: in the file name, as `byRegion` keys, and as `regionId` on the
 * rows themselves. Reading all three is what makes this work on reports written
 * long before anything like this ledger existed — the alternative was going back
 * and re-standardising two years of audit output, which nobody was going to do.
 */
const reportFacts = (file, regionIds) => {
  const rel = path.relative(rootDir, file);
  const stat = (() => {
    try {
      return fs.statSync(file);
    } catch {
      return null;
    }
  })();
  // Files this large are datasets, not audit summaries; scanning them all would
  // turn a 10-second script into a two-minute one for no extra truth.
  if (!stat || stat.size > 8 * 1024 * 1024) return null;

  const data = readJson(file);
  if (!data) return null;

  const touched = new Set();
  const base = path.basename(file, '.json');
  for (const id of regionIds) {
    if (rel.includes(id) || base.includes(id)) touched.add(id);
  }

  const top = Array.isArray(data) ? {} : data;
  for (const id of Object.keys(top.byRegion || {})) if (regionIds.has(id)) touched.add(id);
  if (top.params?.regionFilter && regionIds.has(top.params.regionFilter)) touched.add(top.params.regionFilter);
  if (top.regionId && regionIds.has(top.regionId)) touched.add(top.regionId);

  // Rows carrying their own regionId — the common shape for national sweeps.
  const rows = Array.isArray(data) ? data : (top.results || top.all || top.suspects || top.confirmed || []);
  if (Array.isArray(rows)) {
    for (const row of rows.slice(0, 6000)) {
      const id = row?.regionId || row?.regionFile;
      if (id && regionIds.has(id)) touched.add(id);
    }
  }

  if (!touched.size) return null;

  const day =
    isoDay(base) ||
    isoDay(rel) ||
    isoDay(top.generatedAt || top.checkedAt || top.date || top.runAt) ||
    gitDay(rel) ||
    isoDay(stat.mtime.toISOString());

  if (!day) return null;

  const findings =
    (Array.isArray(top.suspects) ? top.suspects.length : 0) +
    (Array.isArray(top.confirmed) ? top.confirmed.length : 0) ||
    (top.totals && (top.totals.suspect ?? top.totals.suspects ?? top.totals.issues)) ||
    0;

  // NATIONAL vs TARGETED — the distinction the whole board rests on.
  //
  // The first version of this file counted both the same way, and every one of
  // the 110 regions came out "checked today" because one national sweep had run
  // that morning. Technically true, completely useless: a machine walking all
  // 2.861 records offline is not the same event as somebody opening Kythnos and
  // going through it. So a report that lands on more than a quarter of the map is
  // a sweep, and only the targeted ones move "when did we last look at THIS one".
  const scope = touched.size > regionIds.size / 4 ? 'national' : 'targeted';

  return {
    day,
    kind: auditKind(rel),
    scope,
    file: rel.replace(/\\/g, '/'),
    findings: Number(findings) || 0,
    touched,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE LAST BUILD SAW — so the board can say what got FIXED
//
// A snapshot of the previous run's percentages, read out of the file we are about
// to overwrite. Without it the board can only ever say what is wrong today; with
// it, it says "Φωτό 34% → 61% since 25/07", which is the difference between a
// list of complaints and a record of work. Kept per region, last 8 builds, and
// only when something actually moved — a rebuild that changes nothing must not
// fill the history with identical rows.
const previousHistory = new Map();
try {
  const previous = await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`);
  for (const region of previous.regions || []) {
    previousHistory.set(region.id, {
      history: region.history || [],
      axes: Object.fromEntries(
        Object.entries(region.axes || {}).map(([k, a]) => [k, a.total ? Math.round((a.ok / a.total) * 100) : 0])
      ),
      at: previous.generatedAt || '',
    });
  }
  console.log(`Προηγούμενη εικόνα: ${previousHistory.size} περιοχές (${previous.generatedAt}).`);
} catch {
  console.log('Δεν υπάρχει προηγούμενο ημερολόγιο — αυτό είναι το πρώτο χτίσιμο.');
}

/**
 * The same slug the app puts in the URL — utils/beachUrls.ts `getRegionUrlSlug`:
 * the readable English name when there is one, otherwise the id with its region-group
 * prefix and a trailing "-mainland" stripped. Duplicated here (and only here) because
 * this is a plain .mjs build script and that module is TypeScript. If the URL rule ever
 * changes, this copy has to change with it — the symptom is silent (the board goes back
 * to "καμία προβολή"), so the slugs are cross-checked against the real recorded section
 * keys of /api/traffic whenever this is touched.
 */
const slugify = (value) => String(value).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const REGION_ID_PREFIXES = [
  'attica-', 'central-greece-', 'central-macedonia-', 'crete-', 'east-macedonia-and-thrace-',
  'epirus-', 'ionian-islands-', 'north-aegean-', 'peloponnese-', 'south-aegean-', 'thessaly-', 'west-greece-',
];
const regionUrlSlug = (region) => {
  const readable = region.name?.en || region.name?.gr || region.name?.fr || region.name?.de || region.name?.it;
  if (readable) return slugify(readable);
  const bare = REGION_ID_PREFIXES.reduce((v, p) => (v.startsWith(p) ? v.slice(p.length) : v), region.id);
  return slugify(bare.replace(/-mainland$/i, ''));
};

const index = readJson(path.join(beachDir, 'index.json'));
if (!index?.regions?.length) {
  console.error('Δεν βρέθηκε το public/data/beaches/index.json — τρέξε πρώτα npm run build:beach-data.');
  process.exit(1);
}

const regionIds = new Set(index.regions.map((r) => r.id));

// One pass over every report, so each region's history is assembled without
// re-reading 190 files per region.
const auditsByRegion = new Map();
for (const id of regionIds) auditsByRegion.set(id, []);
let scannedReports = 0;
for (const file of listReports(reportsDir)) {
  const facts = reportFacts(file, regionIds);
  if (!facts) continue;
  scannedReports += 1;
  for (const id of facts.touched) {
    auditsByRegion.get(id).push({
      at: facts.day,
      kind: facts.kind,
      scope: facts.scope,
      file: facts.file,
      findings: facts.findings,
    });
  }
}

const photoAuditDay =
  gitDay('reports/photo-coverage/beach-photo-presence.json') ||
  isoDay(fs.statSync(path.join(reportsDir, 'photo-coverage', 'beach-photo-presence.json')).mtime.toISOString());
const pinAuditDay = gitDay('reports/quality/pin-placement-audit.json');

const generatedAt = new Date().toISOString().slice(0, 10);
const regions = [];
const totals = { beaches: 0, byAxis: Object.fromEntries(AXES.map((a) => [a.key, { ok: 0, total: 0 }])) };

// ── every beach that is missing something ────────────────────────────────────
// The region board answers "which island next". This answers the sharper
// question underneath it: "which BEACH, of the ones people actually open". The
// console joins these rows to the page-view counts by beach id, so a beach with
// 300 views and no photo stops hiding inside an island average.
//
// Compact on purpose — this rides inside the function bundle. One row is
// [id, name, regionIndex, bitmask], and only beaches with at least one gap are
// written at all: the ~900 complete ones would be a third of the file saying
// "nothing to do here".
const AXIS_BIT = Object.fromEntries(AXES.map((a, i) => [a.key, 1 << i]));
const beachGaps = [];
// Beaches a previous pass explicitly marked as not-yet-trusted.
const flaggedForVerification = [];
const featureTotals = Object.fromEntries(FEATURES.map((f) => [f.key, 0]));

for (const region of index.regions) {
  const beaches = readJson(path.join(beachDir, `${region.id}.json`), []);
  if (!Array.isArray(beaches) || !beaches.length) continue;

  const axes = Object.fromEntries(AXES.map((a) => [a.key, { ok: 0, total: beaches.length, at: '' }]));
  const confidence = { high: 0, medium: 0, low: 0 };
  const openNames = { pin: [], nav: [], access: [], amenities: [], photo: [], character: [], text: [] };
  const features = Object.fromEntries(FEATURES.map((f) => [f.key, 0]));
  let needsVerification = 0;
  // A date stamped on a beach record IS somebody working on that beach — the most
  // targeted evidence there is, and it survives even when the report that produced
  // it was deleted years ago.
  let stampedAt = '';

  for (const beach of beaches) {
    const m = beach.metadata || {};
    const name = beach.name || `#${beach.id}`;
    let mask = 0;

    // 1. PIN — is the marker on the beach it claims to be? Everything not proven
    // wrong counts as fine: the national audits looked at all 2.861 and only 40
    // failed, so treating "not flagged" as "checked" is the honest reading here.
    if (flaggedPins.has(Number(beach.id))) { openNames.pin.push(name); mask |= AXIS_BIT.pin; }
    else axes.pin.ok += 1;
    axes.pin.at = pinAuditDay;

    // 2. NAV — "Οδηγίες" opens the right place. `verified` is written by the nav
    // audit with the date it ran; anything else (missing, needs-review, blocked)
    // is an open item, because a wrong direction is the one mistake a visitor
    // cannot recover from on the road.
    const nav = m.googleMapsNavigation || {};
    if (nav.status === 'verified') {
      axes.nav.ok += 1;
      axes.nav.at = laterDay(axes.nav.at, isoDay(nav.checkedAt));
    } else {
      openNames.nav.push(name);
      mask |= AXIS_BIT.nav;
    }

    // 3. ACCESS — how you get there. `unknown` is the default nobody filled in,
    // and the access audits exist precisely because "Εύκολη πρόσβαση" was often
    // an assumption. So: a known type AND a human-readable label is covered.
    //
    // This used to require `access.notes` as well, which measured the wrong thing.
    // `notes` is free text printed under the access chip, Greek only; the August 2026
    // rechecks emptied it on 100+ beaches precisely BECAUSE it repeated the label or
    // described a different beach. Those records know their access perfectly — the
    // chip says "βατός χωματόδρομος" — yet the board counted them as "άγνωστη
    // πρόσβαση" and Rethymno read 50% right after being cleaned. Deleting robot copy
    // must not look like losing data, or the board argues for putting it back.
    const access = m.access || {};
    if (access.type && access.type !== 'unknown' && access.label) axes.access.ok += 1;
    else { openNames.access.push(name); mask |= AXIS_BIT.access; }

    // 4. AMENITIES — an empty list is a finding, not a fact. A beach with nothing
    // recorded is a beach nobody has been round with a map yet.
    if (Array.isArray(m.amenities) && m.amenities.length) axes.amenities.ok += 1;
    else { openNames.amenities.push(name); mask |= AXIS_BIT.amenities; }
    if (m.showerEvidence?.checkedAt) axes.amenities.at = laterDay(axes.amenities.at, isoDay(m.showerEvidence.checkedAt));

    // 5. PHOTO — a page with no picture is a page people leave. When the photo
    // audit has never run we say so (null) instead of reporting zero coverage.
    if (photoAuditKnows) {
      if (beachesWithPhoto.has(Number(beach.id))) axes.photo.ok += 1;
      else { openNames.photo.push(name); mask |= AXIS_BIT.photo; }
      axes.photo.at = photoAuditDay;
    }

    // 6. TEXT — our own confidence stamp on what the page says.
    const conf = m.confidence === 'high' ? 'high' : m.confidence === 'medium' ? 'medium' : 'low';
    confidence[conf] += 1;
    // 6. CHARACTER — what KIND of beach it is: sand or pebbles, shallow or deep,
    // and which way it looks. The third one is not decoration: the direction the
    // shore faces is what decides whether today's wind hits it or misses it, so a
    // beach without it is a beach the whole site reasons about badly.
    const terrainKnown = Array.isArray(m.terrain?.types) && m.terrain.types.length > 0;
    const depthKnown = Boolean(m.waterDepth?.type);
    const facingKnown = Number.isFinite(Number(m.orientation?.degrees));
    if (terrainKnown && depthKnown && facingKnown) axes.character.ok += 1;
    else { openNames.character.push(name); mask |= AXIS_BIT.character; }

    // 7. TEXT — our own confidence stamp, plus the flag somebody already raised.
    // `needsVerification` is a note a previous pass left behind meaning "do not
    // trust this yet". 170 of them were sitting in the data with nothing surfacing
    // them; an unread flag is the same as no flag.
    if (m.needsVerification === true) flaggedForVerification.push([Number(beach.id), name, region.id]);
    if (conf === 'high' && m.needsVerification !== true) axes.text.ok += 1;
    else { openNames.text.push(name); mask |= AXIS_BIT.text; }

    if (m.popularity?.checkedAt) axes.text.at = laterDay(axes.text.at, isoDay(m.popularity.checkedAt));

    for (const feature of FEATURES) {
      if (feature.pick(m)) { features[feature.key] += 1; featureTotals[feature.key] += 1; }
    }
    if (m.needsVerification === true) needsVerification += 1;

    // The region id, not its index: `regions` is sorted alphabetically further
    // down, and an index captured here would point at whatever region happens to
    // land in that slot afterwards. It cost one round of "Β΄ πλαζ Βούλας, Αγαθονήσι".
    // Rewritten to an index once the order is final.
    if (mask) beachGaps.push([Number(beach.id), name, region.id, mask]);

    for (const stamp of [
      nav.checkedAt,
      m.popularity?.checkedAt,
      m.showerEvidence?.checkedAt,
      m.seatrac?.verifiedAt,
      m.paidEntry?.verifiedAt,
    ]) {
      stampedAt = laterDay(stampedAt, isoDay(stamp));
    }
  }

  // The audit history, newest first, deduplicated by day+kind so ten per-island
  // files from one sweep read as one line ("14/08 — Πρόσβαση") instead of ten.
  const seen = new Set();
  const allAudits = (auditsByRegion.get(region.id) || []).sort((a, b) =>
    a.at < b.at ? 1 : a.at > b.at ? -1 : 0
  );
  const audits = allAudits
    .filter((a) => {
      const k = `${a.at}|${a.kind}|${a.scope}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);

  // Per-axis dates get one more source: the audits themselves. A region whose
  // access was re-checked in August should say August even if no beach record
  // carries a date for it.
  for (const audit of audits) {
    if (axes[audit.kind]) axes[audit.kind].at = laterDay(axes[audit.kind].at, audit.at);
  }

  // The two answers the board needs, kept apart on purpose (see `scope` above).
  const lastTargetedAt = allAudits
    .filter((a) => a.scope === 'targeted')
    .reduce((acc, a) => laterDay(acc, a.at), stampedAt);
  const lastSweepAt = allAudits
    .filter((a) => a.scope === 'national')
    .reduce((acc, a) => laterDay(acc, a.at), '');

  const gaps = [];
  const gapLine = (n, one, many) => {
    if (n > 0) gaps.push(n === 1 ? one : many.replace('{n}', String(n)));
  };
  gapLine(openNames.pin.length, '1 παραλία με πινέζα εκτός παραλίας', '{n} παραλίες με πινέζα εκτός παραλίας');
  gapLine(openNames.nav.length, '1 χωρίς επιβεβαιωμένες οδηγίες', '{n} χωρίς επιβεβαιωμένες οδηγίες');
  gapLine(openNames.access.length, '1 με άγνωστη πρόσβαση', '{n} με άγνωστη πρόσβαση');
  gapLine(openNames.amenities.length, '1 χωρίς καμία παροχή γραμμένη', '{n} χωρίς καμία παροχή γραμμένη');
  gapLine(openNames.photo.length, '1 χωρίς φωτογραφία', '{n} χωρίς φωτογραφία');
  gapLine(
    openNames.character.length,
    '1 χωρίς άμμο/βάθος/κατεύθυνση',
    '{n} χωρίς άμμο, βάθος ή κατεύθυνση'
  );
  gapLine(openNames.text.length, '1 με χαμηλή σιγουριά κειμένου', '{n} με χαμηλή σιγουριά κειμένου');
  gapLine(needsVerification, '1 σημειωμένη «θέλει επαλήθευση»', '{n} σημειωμένες «θέλουν επαλήθευση»');

  // ── what moved since the last build ─────────────────────────────────────────
  const pct = Object.fromEntries(
    AXES.map((a) => [a.key, axes[a.key].total ? Math.round((axes[a.key].ok / axes[a.key].total) * 100) : 0])
  );
  const before = previousHistory.get(region.id);
  const history = before?.history ? [...before.history] : [];
  if (before && Object.keys(pct).some((k) => pct[k] !== before.axes[k])) {
    // Only the axes that actually changed, so a row reads as an event.
    const moved = {};
    for (const key of Object.keys(pct)) {
      if (pct[key] !== before.axes[key]) moved[key] = [before.axes[key] ?? 0, pct[key]];
    }
    history.unshift({ at: generatedAt, from: before.at, moved });
  } else if (!before && !history.length) {
    history.unshift({ at: generatedAt, from: '', moved: null }); // first sighting
  }

  totals.beaches += beaches.length;
  for (const axis of AXES) {
    totals.byAxis[axis.key].ok += axes[axis.key].ok;
    totals.byAxis[axis.key].total += axes[axis.key].total;
  }

  regions.push({
    id: region.id,
    // The URL slug, which is the ONLY name our own pageview counter ever sees:
    // services/pageviewBeacon.ts:103 records segment 1 of /beaches/<slug>/…, i.e.
    // "chania", never "crete-crete-chania". Without this the board looked its
    // regions up by id, found nothing, and printed "καμία προβολή" for all 110 —
    // so its ranking silently dropped the traffic factor entirely.
    slug: regionUrlSlug(region),
    label: region.name?.gr || region.prefecture || region.id,
    group: region.group || '',
    beaches: beaches.length,
    axes,
    confidence,
    pct,
    history: history.slice(0, 8),
    features,
    needsVerification,
    lastTargetedAt,
    lastSweepAt,
    audits,
    gaps,
    // Three names per axis, so "12 χωρίς φωτογραφία" can be opened into "ποιες".
    // Never the whole list: this file rides inside the function bundle.
    examples: Object.fromEntries(Object.entries(openNames).map(([k, v]) => [k, v.slice(0, 3)])),
  });
}

regions.sort((a, b) => a.label.localeCompare(b.label, 'el'));

// Now that the order is fixed, the per-beach rows can carry a plain index.
const regionIndex = new Map(regions.map((r, i) => [r.id, i]));
for (const row of beachGaps) row[2] = regionIndex.get(row[2]) ?? -1;

const body = `// ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — μην το πειράξεις με το χέρι.
// Φτιάχνεται με: node scripts/buildQualityLedger.mjs
// Το διαβάζει η καρτέλα «Ποιότητα» στο /api/traffic.
export const generatedAt = ${JSON.stringify(generatedAt)};
export const axes = ${JSON.stringify(AXES)};
export const kindLabels = ${JSON.stringify(KIND_LABEL)};
export const totals = ${JSON.stringify(totals)};
export const featureList = ${JSON.stringify(FEATURES.map(({ key, label }) => ({ key, label })))};
export const featureTotals = ${JSON.stringify(featureTotals)};
export const needsVerification = ${JSON.stringify(flaggedForVerification.length)};
export const regions = ${JSON.stringify(regions)};
// [beachId, όνομα, δείκτης περιοχής, μάσκα κενών] — μόνο όσες έχουν έστω ένα κενό.
export const axisBits = ${JSON.stringify(AXIS_BIT)};
export const beachGaps = ${JSON.stringify(beachGaps)};
export default {
  generatedAt, axes, kindLabels, totals, regions, axisBits, beachGaps,
  featureList, featureTotals, needsVerification,
};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, body, 'utf8');

const kb = Math.round(Buffer.byteLength(body) / 1024);
const pct = (a) => (a.total ? Math.round((a.ok / a.total) * 100) : 0);
console.log(`Ημερολόγιο ποιότητας: ${regions.length} περιοχές, ${totals.beaches} παραλίες, ${scannedReports} αρχεία ελέγχων.`);
for (const axis of AXES) {
  const t = totals.byAxis[axis.key];
  console.log(`  ${axis.short.padEnd(10)} ${String(pct(t)).padStart(3)}%  (${t.ok}/${t.total})`);
}
const stale = regions.filter((r) => !r.lastTargetedAt).length;
if (stale) console.log(`  ⚠ ${stale} περιοχές που δεν έχουν ποτέ ελεγχθεί στοχευμένα.`);
console.log(
  `  ${beachGaps.length} παραλίες με τουλάχιστον ένα κενό (${totals.beaches - beachGaps.length} πλήρεις).`
);
if (flaggedForVerification.length) {
  console.log(`  ⚑ ${flaggedForVerification.length} σημειωμένες «θέλουν επαλήθευση» από προηγούμενο πέρασμα.`);
}
console.log('  Χαρακτηριστικά που ισχύουν σε λίγες (δεν είναι κενά):');
for (const feature of FEATURES) {
  console.log(`    ${feature.label.padEnd(20)} ${String(featureTotals[feature.key]).padStart(5)}`);
}
console.log(`Γράφτηκε ${path.relative(rootDir, outFile)} (${kb} KB).`);

// ─────────────────────────────────────────────────────────────────────────────
// ΠΟΣΟ ΣΤΕΡΕΗ ΕΙΝΑΙ Η ΠΡΟΓΝΩΣΗ ΤΗΣ ΚΑΘΕ ΗΜΕΡΑΣ — ένας δείκτης ανά ημέρα, τίποτα άλλο.
//
// ΤΟ ΠΡΟΒΛΗΜΑ. Η κάρτα λέει «Καλή» για τη μέρα +5 με ΑΚΡΙΒΩΣ την ίδια σιγουριά που το λέει για
// σήμερα. Μετρήθηκε εθνικά 21/08/2026 (110/110 περιοχές, ecmwf_ifs025, 51 σενάρια — βίβλος §Γ50):
// στις ώρες κολύμβησης του +5, το **22,2%** δείχνει ήσυχη μέρα (κεντρικό σενάριο ≤4 Μποφόρ) ενώ
// το 90ό εκατοστημόριο των σεναρίων λέει 5+. Σήμερα το ίδιο νούμερο είναι **1,4%**.
//
// ⚠️ ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΕΠΕΚΤΑΣΗ ΤΟΥ forecast.mjs. Εκείνο είναι **strict allow-list
// proxy**: προωθεί και δεν μετασχηματίζει ΠΟΤΕ το σώμα. Αυτό εδώ κάνει το αντίθετο — ρωτάει 51
// σενάρια (~200 KB) και επιστρέφει **λιγότερο από 400 bytes**. Αν έμπαινε μέσα στην πύλη, ή θα
// έσπαγε η αρχή της, ή ο επισκέπτης θα κατέβαζε 200 KB σε κινητό για να μάθει 7 ναι/όχι.
//
// ⚠️ ΤΟ ENSEMBLE ΔΕΝ ΕΧΕΙ ΚΥΜΑ. Δίνει μόνο ατμοσφαιρικά. Ό,τι χτιστεί πάνω σε αυτόν τον δείκτη
// μιλάει ΜΟΝΟ για τον άνεμο — ποτέ για τη θάλασσα. Μη γράψεις σχόλιο που υπονοεί το αντίθετο.
//
// ⚠️ ΚΑΝΕΝΑ ΜΟΝΙΜΟ ΤΑΜΠΕΛΑΚΙ «ΜΕΤΡΙΑ ΕΜΠΙΣΤΟΣΥΝΗ». Η βίβλος το έχει ήδη απορρίψει: ένα μήνυμα
// αβεβαιότητας που εμφανίζεται συνέχεια διαβάζεται ως «δεν ξέρουμε τι λέμε». Η μόνη επιτρεπτή
// χρήση αυτού του δείκτη είναι ΦΡΕΝΟ — να μη λέμε «Καλή» με σιγουριά όταν τα σενάρια διαφωνούν.
//
// ΚΟΣΤΟΣ. 110 περιοχές × 4 ενημερώσεις μοντέλου τη μέρα = ~440 κλήσεις/ημέρα upstream, δηλαδή
// ~13.000/μήνα σε πακέτο 5.000.000. Η CDN μνήμη είναι 6 ώρες — όσο ακριβώς και ο κύκλος του
// μοντέλου — ώστε ο αριθμός των ΕΠΙΣΚΕΠΤΩΝ να μην προσθέτει τίποτα.
// ─────────────────────────────────────────────────────────────────────────────

const ENSEMBLE_HOST = 'https://ensemble-api.open-meteo.com';
const CUSTOMER_HOST = 'https://customer-ensemble-api.open-meteo.com';

/**
 * 51 μέλη, 15 ημέρες. Είναι το μόνο που καλύπτει ΟΛΟ τον ορίζοντα των 7 ημερών μας: το `icon_eu`
 * έχει λεπτότερο πλέγμα (13 χλμ) αλλά σταματά στις 5 ημέρες — δηλαδή σιωπά ακριβώς εκεί που η
 * αβεβαιότητα εκρήγνυται (33,6% στο +5, 34,5% στο +6).
 */
const MODEL = 'ecmwf_ifs025';
const FORECAST_DAYS = 7;

/** Ίδιο παράθυρο με τη μέτρηση: έξω από αυτό, η διαφωνία δεν αφορά κανέναν που ψάχνει παραλία. */
const SWIM_START_H = 10;
const SWIM_END_H = 18;
/** Πόσες βαθμίδες Μποφόρ πρέπει να απέχουν p10 και p90 για να λέγεται «αβέβαιη» μια ώρα. */
const GAP_RUNGS = 2;
/** Πόσες τέτοιες ώρες κάνουν μια ΗΜΕΡΑ αβέβαιη. */
const UNCERTAIN_HOURS_FOR_DAY = 4;

const CDN_MAX_AGE_S = 6 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 20000;

/** Ίδια κλίμακα με utils/weatherUtils.getBeaufortLevel. Αντιγράφεται επειδή οι functions δεν
 *  μοιράζονται bundle με το app· η πύλη quality:ensemble-spread-parity το κρατάει σε συμφωνία. */
const beaufort = (kmh) => {
  if (!(kmh >= 1)) return 0;
  if (kmh <= 5) return 1;
  if (kmh <= 11) return 2;
  if (kmh <= 19) return 3;
  if (kmh <= 28) return 4;
  if (kmh <= 38) return 5;
  if (kmh <= 49) return 6;
  if (kmh <= 61) return 7;
  if (kmh <= 74) return 8;
  if (kmh <= 88) return 9;
  if (kmh <= 102) return 10;
  if (kmh <= 117) return 11;
  return 12;
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];

const coord = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
};

const json = (body, status, cacheSeconds) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheSeconds
      ? `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
      : 'no-store',
    'access-control-allow-origin': '*',
  },
});

export default async (request) => {
  const url = new URL(request.url);
  const lat = coord(url.searchParams.get('lat'));
  const lon = coord(url.searchParams.get('lon'));
  if (lat === null || lon === null || lat < 33 || lat > 42 || lon < 18 || lon > 30) {
    return json({ error: 'lat/lon required, inside Greece' }, 400, 0);
  }

  // Ίδια πειθαρχία με το forecast.mjs: το κλειδί ζει ΜΟΝΟ εδώ, ποτέ σε VITE_*, ποτέ στο
  // netlify.toml. Χωρίς κλειδί πέφτουμε στον δωρεάν κόμβο και το site συνεχίζει.
  const key = process.env.OPEN_METEO_API_KEY || '';
  const host = key ? CUSTOMER_HOST : ENSEMBLE_HOST;
  const upstream = `${host}/v1/ensemble?latitude=${lat}&longitude=${lon}`
    + '&hourly=wind_speed_10m'
    + `&wind_speed_unit=kmh&timezone=Europe%2FAthens&forecast_days=${FORECAST_DAYS}&models=${MODEL}`
    + (key ? `&apikey=${encodeURIComponent(key)}` : '');

  let payload;
  try {
    const res = await fetch(upstream, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    payload = await res.json();
  } catch {
    // ΑΠΟΥΣΙΑ ΔΕΝ ΕΙΝΑΙ ΑΒΕΒΑΙΟΤΗΤΑ. Αν το upstream πέσει, επιστρέφουμε ρητό «δεν ξέρω» και ο
    // πελάτης αφήνει την ετυμηγορία ΑΚΡΙΒΩΣ όπως είναι σήμερα. Ένα σιωπηλό «αβέβαιο» θα φρέναρε
    // ολόκληρη τη χώρα κάθε φορά που χαλάει μια σύνδεση.
    return json({ available: false, reason: 'upstream unavailable', days: null }, 200, 300);
  }

  const hourly = payload?.hourly || {};
  const times = hourly.time || [];
  const memberKeys = Object.keys(hourly).filter((k) => /^wind_speed_10m(_member\d+)?$/.test(k));
  if (memberKeys.length < 5 || times.length === 0) {
    return json({ available: false, reason: 'too few members', days: null }, 200, 300);
  }

  const uncertainHours = new Array(FORECAST_DAYS).fill(0);
  const worstGap = new Array(FORECAST_DAYS).fill(0);

  for (let t = 0; t < times.length; t += 1) {
    const lead = Math.floor(t / 24);
    if (lead >= FORECAST_DAYS) break;
    const hour = Number(times[t].slice(11, 13));
    if (hour < SWIM_START_H || hour >= SWIM_END_H) continue;

    const rungs = [];
    for (const k of memberKeys) {
      const v = hourly[k]?.[t];
      if (Number.isFinite(v)) rungs.push(beaufort(v));
    }
    if (rungs.length < 5) continue;
    rungs.sort((a, b) => a - b);
    const gap = percentile(rungs, 0.90) - percentile(rungs, 0.10);
    if (gap >= GAP_RUNGS) uncertainHours[lead] += 1;
    if (gap > worstGap[lead]) worstGap[lead] = gap;
  }

  return json({
    available: true,
    model: MODEL,
    members: memberKeys.length,
    // Ένα ναι/όχι ανά ημέρα πρόγνωσης, 0 = σήμερα. Αυτό είναι ΟΛΟ το ωφέλιμο φορτίο.
    days: uncertainHours.map((n, lead) => ({
      lead,
      uncertain: n >= UNCERTAIN_HOURS_FOR_DAY,
      uncertainHours: n,
      worstGapRungs: worstGap[lead],
    })),
  }, 200, CDN_MAX_AGE_S);
};

// Η δρομολόγηση ζει στο netlify.toml, όπως ΟΛΕΣ οι άλλες functions του project. Δεν μπαίνει
// `export const config` εδώ: δύο μηχανισμοί δρομολόγησης για την ίδια διαδρομή είναι ακριβώς ο
// τρόπος που γεννιούνται οι διπλοεγγραφές που ρίχνουν το deploy χωρίς να τις πιάνει καμία πύλη.

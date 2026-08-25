/**
 * PARSER ΤΩΝ ΜΗΝΙΑΙΩΝ txt ΤΟΥ meteosearch.meteo.gr (ΝΟΑ/meteo.gr).
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ. Το handover §16 (24/08/2026): «meteosearch = Ο ΣΩΣΤΟΣ ΚΡΙΤΗΣ — εκατοντάδες
 * σταθμοί σε χωριά/παραλίες με το ανάγλυφο που λείπει από τα αεροδρόμια … μόνο ο parser των
 * txt λείπει». Το site μπλοκάρει το codespace (Cloudflare challenge)· τα αρχεία τα κατεβάζει
 * άνθρωπος με browser και τα αφήνει στο `.tmp/meteosearch/<σταθμός>/<YYYY-MM>.txt`.
 *
 * Η ΜΟΡΦΗ. Οι σταθμοί του δικτύου είναι Davis, και το meteosearch δίνει το «NOAA monthly
 * climatological summary» του WeatherLink: κεφαλίδα NAME/CITY/STATE, γραμμή ELEV/LAT/LONG,
 * γραμμή μονάδων (TEMPERATURE (°C), RAIN (mm), WIND SPEED (km/hr)), μπλοκ τίτλων στηλών που
 * τελειώνει σε `DAY MEAN TEMP HIGH TIME LOW TIME [HEAT DEG DAYS COOL DEG DAYS] RAIN AVG WIND
 * SPEED HIGH TIME DOM DIR`, μια διακεκομμένη γραμμή, μία γραμμή ανά ημέρα, δεύτερη διακεκομμένη,
 * γραμμή συνόλων. ΗΜΕΡΗΣΙΑ ανάλυση: μέσος άνεμος της ημέρας, μέγιστη ριπή + ώρα, κυρίαρχη
 * διεύθυνση. Όχι ωριαία.
 *
 * ⚠️ ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΕ ΑΠΟ ΕΔΩ (25/08/2026) — κανένα αρχείο δεν περνάει το Cloudflare. Ο parser
 * είναι ΑΝΕΚΤΙΚΟΣ επίτηδες: βρίσκει τις γραμμές ημερών με βάση τη διακεκομμένη, διαβάζει τις
 * στήλες ΑΠΟ ΤΟ ΤΕΛΟΣ (DOM DIR, HIGH TIME, HIGH, AVG, RAIN) ώστε να μην πειράζει αν λείπουν
 * οι στήλες βαθμοημερών, δέχεται `,` και `.` δεκαδικά, `---`/`--`/κενό = λείπει, και γράφει ό,τι
 * δεν κατάλαβε στο `warnings[]`. Η ΠΡΩΤΗ πραγματική εκτέλεση πρέπει να γίνει με
 * `node scripts/measureMeteosearchWindBias.mjs --dry-run` και έλεγχο με το μάτι.
 */

const COMPASS_DEG = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  // Ελληνικές συντομογραφίες, αν κάποιο αρχείο τις δίνει.
  Β: 0, ΒΒΑ: 22.5, ΒΑ: 45, ΑΒΑ: 67.5, Α: 90, ΑΝΑ: 112.5, ΝΑ: 135, ΝΝΑ: 157.5,
  Ν: 180, ΝΝΔ: 202.5, ΝΔ: 225, ΔΝΔ: 247.5, Δ: 270, ΔΒΔ: 292.5, ΒΔ: 315, ΒΒΔ: 337.5,
};

const WIND_UNIT_TO_KMH = { 'km/hr': 1, 'km/h': 1, kmh: 1, 'm/s': 3.6, knots: 1.852, kt: 1.852, mph: 1.609344 };

const num = (token) => {
  if (token === undefined || token === null) return null;
  const t = String(token).trim();
  if (!t || /^-{2,}$/.test(t) || t === 'M' || t === 'NA') return null;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

const isTime = t => /^\d{1,2}:\d{2}$/.test(t);

/** `35° 12' 00" N`, `35°12'N`, `35.20 N`, `35,2N` → δεκαδικές μοίρες. */
const parseCoord = (text) => {
  if (!text) return null;
  const s = text.replace(/,/g, '.').trim();
  const hemi = /[SW]\s*$/i.test(s) ? -1 : 1;
  const dms = s.match(/(-?\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*')?\s*(?:(\d+(?:\.\d+)?)\s*")?/);
  if (dms) {
    const d = Number(dms[1]), m = Number(dms[2] || 0), sec = Number(dms[3] || 0);
    return hemi * (Math.abs(d) + m / 60 + sec / 3600) * (d < 0 ? -1 : 1);
  }
  const dec = s.match(/-?\d+(?:\.\d+)?/);
  return dec ? hemi * Number(dec[0]) : null;
};

export const compassToDeg = (token) => {
  if (!token) return null;
  const key = String(token).trim().toUpperCase();
  return key in COMPASS_DEG ? COMPASS_DEG[key] : null;
};

/**
 * @param {string} text  Το περιεχόμενο ενός μηνιαίου txt.
 * @param {{ stationId?: string, yearMonth?: string }} meta  Ό,τι λέει το όνομα του αρχείου.
 * @returns {{ stationId, month, station: { name, elevM, lat, lon }, unitsWind, rows, warnings }}
 */
export const parseMeteosearchMonthly = (text, meta = {}) => {
  const warnings = [];
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  // ── κεφαλίδα ──
  let month = meta.yearMonth || null;
  const station = { name: null, elevM: null, lat: null, lon: null };
  let unitsWind = 'km/hr';
  for (const line of lines.slice(0, 40)) {
    const m = line.match(/SUMMARY\s+for\s+([A-Za-z]{3})\.?\s+(\d{4})/i);
    if (m && !month) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const idx = months.indexOf(m[1].slice(0, 3).toLowerCase());
      if (idx >= 0) month = `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
    }
    const name = line.match(/NAME:\s*([^\s].*?)(?:\s{2,}|\s+CITY:|$)/i);
    if (name && !station.name) station.name = name[1].trim();
    const elev = line.match(/ELEV:\s*(-?\d+(?:[.,]\d+)?)\s*(m|ft)?/i);
    if (elev) station.elevM = elev[2]?.toLowerCase() === 'ft' ? Number(elev[1].replace(',', '.')) * 0.3048 : Number(elev[1].replace(',', '.'));
    const lat = line.match(/LAT:\s*([^A-Z]*?[NS])\b/i);
    if (lat) station.lat = parseCoord(lat[1]);
    const lon = line.match(/LONG?:\s*([^A-Z]*?[EW])\b/i);
    if (lon) station.lon = parseCoord(lon[1]);
    const unit = line.match(/WIND\s*SPEED\s*\(([^)]+)\)/i);
    if (unit) {
      const key = unit[1].trim().toLowerCase();
      if (key in WIND_UNIT_TO_KMH) unitsWind = key;
      else warnings.push(`άγνωστη μονάδα ανέμου «${unit[1]}» — υποθέτω km/hr`);
    }
  }
  const toKmh = WIND_UNIT_TO_KMH[unitsWind] ?? 1;

  // ── το μπλοκ των ημερών: ανάμεσα στην πρώτη και στη δεύτερη διακεκομμένη γραμμή ──
  const ruleIdx = lines.map((l, i) => (/^\s*-{20,}\s*$/.test(l) ? i : -1)).filter(i => i >= 0);
  let dayLines;
  if (ruleIdx.length >= 2) dayLines = lines.slice(ruleIdx[0] + 1, ruleIdx[1]);
  else if (ruleIdx.length === 1) { dayLines = lines.slice(ruleIdx[0] + 1); warnings.push('μία μόνο διακεκομμένη γραμμή — διαβάζω ως το τέλος'); }
  else { dayLines = lines; warnings.push('καμία διακεκομμένη γραμμή — ψάχνω γραμμές ημερών σε όλο το αρχείο'); }

  const rows = [];
  for (const raw of dayLines) {
    const line = raw.trim();
    if (!line) continue;
    const tok = line.split(/\s+/);
    const day = Number(tok[0]);
    if (!Number.isInteger(day) || day < 1 || day > 31 || tok.length < 8) continue;

    // Από το τέλος: DOM DIR · HIGH TIME · HIGH · AVG · RAIN — ανθεκτικό σε στήλες που λείπουν.
    let end = tok.length - 1;
    let domDir = null;
    if (compassToDeg(tok[end]) !== null || /^-{2,}$/.test(tok[end])) domDir = tok[end], end -= 1;
    else warnings.push(`ημέρα ${day}: δεν αναγνωρίζω κυρίαρχη διεύθυνση «${tok[end]}»`);
    let highWindTime = null;
    if (isTime(tok[end])) highWindTime = tok[end], end -= 1;
    const highWindKmh = num(tok[end]); end -= 1;
    const avgWindKmh = num(tok[end]); end -= 1;
    const rainMm = num(tok[end]); end -= 1;

    // Από την αρχή: DAY · MEAN · HIGH · TIME · LOW · TIME
    const meanTempC = num(tok[1]);
    const highTempC = num(tok[2]);
    const highTempTime = isTime(tok[3] || '') ? tok[3] : null;
    const lowTempC = num(tok[highTempTime ? 4 : 3]);

    if (avgWindKmh === null && highWindKmh === null) { warnings.push(`ημέρα ${day}: χωρίς άνεμο`); }
    rows.push({
      day,
      date: month ? `${month}-${String(day).padStart(2, '0')}` : null,
      meanTempC, highTempC, lowTempC, rainMm,
      avgWindKmh: avgWindKmh === null ? null : avgWindKmh * toKmh,
      highWindKmh: highWindKmh === null ? null : highWindKmh * toKmh,
      highWindTime,
      domDir: domDir && !/^-{2,}$/.test(domDir) ? domDir.toUpperCase() : null,
      domDirDeg: compassToDeg(domDir),
    });
  }
  if (!rows.length) warnings.push('καμία γραμμή ημέρας δεν διαβάστηκε');
  if (!month) warnings.push('δεν βρέθηκε μήνας ούτε στην κεφαλίδα ούτε στο όνομα αρχείου');

  return { stationId: meta.stationId || station.name || null, month, station, unitsWind, rows, warnings };
};

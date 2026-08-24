/**
 * Παράκτια ελληνικά αεροδρόμια με ανεμόμετρο που δημοσιεύει METAR — ο εξωτερικός κριτής του
 * ανέμου μας (10-λεπτος μέσος στα 10 μ., το ίδιο μέγεθος που δίνει το Open-Meteo).
 *
 * Μία λίστα, τρεις αναγνώστες (auditWindAgainstStations, measureFalseCalmAgainstStations,
 * measureWindDecompression). Η ΣΕΙΡΑ έχει σημασία: τα σκριπτ βαθμονόμησης χωρίζουν σε «ζυγά»
 * και «μονά» με βάση τη θέση εδώ, ώστε ένας συντελεστής να βαθμονομείται σε μισούς σταθμούς και
 * να κρίνεται στους άλλους μισούς. Μην αναδιατάξεις χωρίς να ξανατρέξεις τις μετρήσεις.
 */
export const STATIONS = [
  ['LGIR', 'Ηράκλειο', 35.3397, 25.1803], ['LGSA', 'Χανιά', 35.5317, 24.1497],
  ['LGST', 'Σητεία', 35.2161, 26.1013], ['LGRP', 'Ρόδος', 36.4054, 28.0862],
  ['LGKO', 'Κως', 36.7933, 27.0917], ['LGMK', 'Μύκονος', 37.4351, 25.3481],
  ['LGSR', 'Σαντορίνη', 36.3992, 25.4793], ['LGNX', 'Νάξος', 37.0811, 25.3681],
  ['LGPA', 'Πάρος', 37.0103, 25.1281], ['LGSK', 'Σκιάθος', 39.1771, 23.5037],
  ['LGKR', 'Κέρκυρα', 39.6019, 19.9117], ['LGZA', 'Ζάκυνθος', 37.7509, 20.8843],
  ['LGKF', 'Κεφαλονιά', 38.1201, 20.5005], ['LGPZ', 'Άκτιο', 38.9255, 20.7653],
  ['LGLM', 'Λήμνος', 39.9217, 25.2364], ['LGMT', 'Μυτιλήνη', 39.0567, 26.5983],
  ['LGSM', 'Σάμος', 37.6900, 26.9117], ['LGHI', 'Χίος', 38.3432, 26.1406],
  ['LGKL', 'Καλαμάτα', 37.0683, 22.0255], ['LGAL', 'Αλεξανδρούπολη', 40.8559, 25.9563],
  ['LGKV', 'Καβάλα', 40.9133, 24.6192], ['LGTS', 'Θεσσαλονίκη', 40.5197, 22.9709],
  ['LGKC', 'Κύθηρα', 36.2743, 23.0170], ['LGML', 'Μήλος', 36.6969, 24.4769],
  ['LGLE', 'Λέρος', 37.1849, 26.8003], ['LGKP', 'Κάρπαθος', 35.4214, 27.1460],
  ['LGIK', 'Ικαρία', 37.6827, 26.3470], ['LGSY', 'Σκύρος', 38.9676, 24.4872],
  ['LGBL', 'Ν. Αγχίαλος', 39.2196, 22.7943], ['LGRX', 'Άραξος', 38.1511, 21.4256],
];

export const KT_TO_KMH = 1.852;

/**
 * Αρχείο METAR του Iowa State (ASOS) — όχι το ζωντανό aviationweather.gov, που αγνοεί το `hours`
 * πάνω από ~24 και δίνει ένα μόνο καθεστώς καιρού. Επιστρέφει Map «ICAO|YYYY-MM-DDTHH» (UTC) →
 * { kmh, gustKmh|null, dir|null }: η παρατήρηση πιο κοντά στην ακέραιη ώρα.
 */
export const fetchStationHours = async (startMs, endMs) => {
  const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
  const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
  const url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
    + STATIONS.map(s => `station=${s[0]}`).join('&')
    + `&data=sknt&data=drct&data=gust&year1=${y1}&month1=${m1}&day1=${d1}`
    + `&year2=${y2}&month2=${m2}&day2=${d2}`
    + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`αρχείο μετρήσεων: HTTP ${res.status}`);
  const csv = await res.text();
  const observed = new Map();
  for (const line of csv.split('\n').slice(1)) {
    const [icao, valid, sknt, drct, gust] = line.trim().split(',');
    if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
    const kt = Number(sknt);
    if (!Number.isFinite(kt)) continue;
    const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
    const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
    const gap = Math.abs(d.getTime() - rounded.getTime());
    const prev = observed.get(key);
    if (prev && prev.gap <= gap) continue;
    const gk = Number(gust);
    observed.set(key, {
      gap,
      kmh: kt * KT_TO_KMH,
      dir: Number.isFinite(Number(drct)) ? Number(drct) : null,
      gustKmh: Number.isFinite(gk) && gk > 0 ? gk * KT_TO_KMH : null,
    });
  }
  return observed;
};

// ─────────────────────────────────────────────────────────────────────────────
// GEO LOOKUP — shared by the visitor counter (pageview.mjs) and the traffic
// console (traffic-stats.mjs).
//
// Netlify's `x-nf-geo` header usually carries a city + latitude/longitude. When it
// does not (VPNs, some mobile carriers, cached edges) we still want the visitor on
// the world map, so we fall back to a coarse country centroid. A centroid is NOT a
// location claim — it is "somewhere in this country", which is all we ever show.
//
// Nothing here is personal data: the finest thing stored anywhere is a city name.
// ─────────────────────────────────────────────────────────────────────────────

/** Country centroid [lat, lon] — the fallback pin when the edge gives no coords. */
export const COUNTRY_CENTROIDS = {
  GR: [39.0, 22.0], DE: [51.2, 10.4], GB: [54.0, -2.5], US: [39.5, -98.5],
  FR: [46.6, 2.4], IT: [42.8, 12.6], NL: [52.2, 5.5], AT: [47.6, 14.1],
  CH: [46.8, 8.2], BE: [50.6, 4.6], SE: [62.0, 15.0], PL: [52.0, 19.4],
  RO: [45.9, 25.0], BG: [42.7, 25.5], CY: [35.0, 33.2], ES: [40.2, -3.6],
  PT: [39.6, -8.0], CZ: [49.8, 15.5], DK: [56.0, 9.5], NO: [64.5, 12.0],
  FI: [64.5, 26.0], IE: [53.2, -8.0], IL: [31.4, 35.0], TR: [39.0, 35.2],
  RU: [57.0, 40.0], UA: [49.0, 31.5], CA: [56.0, -96.0], AU: [-25.6, 134.4],
  NZ: [-41.5, 172.8], HU: [47.2, 19.4], SK: [48.7, 19.5], SI: [46.1, 14.8],
  HR: [45.1, 15.5], RS: [44.1, 20.9], AL: [41.1, 20.1], MK: [41.6, 21.7],
  BA: [44.0, 17.8], ME: [42.8, 19.3], MT: [35.9, 14.4], LU: [49.8, 6.1],
  EE: [58.7, 25.5], LV: [56.9, 24.9], LT: [55.3, 23.9], IS: [64.9, -18.6],
  JP: [36.5, 138.3], CN: [35.9, 104.2], IN: [22.4, 78.7], KR: [36.4, 127.9],
  SG: [1.35, 103.8], HK: [22.3, 114.2], TH: [15.1, 101.0], AE: [24.0, 54.0],
  SA: [24.0, 45.0], QA: [25.3, 51.2], KW: [29.3, 47.5], EG: [26.8, 30.8],
  ZA: [-29.0, 24.7], BR: [-10.8, -52.9], AR: [-35.4, -65.2], CL: [-35.7, -71.4],
  MX: [23.9, -102.5], CO: [4.1, -73.0], PE: [-9.2, -75.0], UY: [-32.8, -56.0],
  BY: [53.7, 28.0], MD: [47.2, 28.5], GE: [42.2, 43.5], AM: [40.3, 44.9],
  AZ: [40.3, 47.7], KZ: [48.2, 67.0], PH: [12.8, 122.9], MY: [4.1, 109.7],
  ID: [-2.5, 118.0], VN: [16.0, 106.3], TW: [23.8, 121.0], PK: [30.0, 69.4],
  BD: [23.9, 90.3], LK: [7.6, 80.7], MA: [31.8, -7.1], TN: [34.1, 9.6],
  DZ: [28.2, 2.6], NG: [9.6, 8.1], KE: [0.5, 37.9], ET: [8.6, 39.6],
  GH: [7.9, -1.0], LB: [33.9, 35.9], JO: [31.3, 36.8], IQ: [33.2, 43.7],
  IR: [32.4, 53.7], CR: [9.9, -84.0], PA: [8.5, -80.1], DO: [18.7, -70.2],
  CU: [21.6, -79.5], EC: [-1.4, -78.4], VE: [7.1, -66.0], BO: [-16.7, -64.7],
  PY: [-23.4, -58.4], NP: [28.3, 84.1], MM: [21.0, 96.0], KH: [12.6, 104.9],
  UZ: [41.7, 63.1], MN: [46.8, 103.0], LY: [26.3, 17.2], SY: [35.0, 38.5],
  BH: [26.0, 50.5], OM: [21.0, 57.0], YE: [15.5, 47.5],
};

/** Greek country names for the console; unknown codes fall back to the code itself. */
export const COUNTRY_NAMES_EL = {
  GR: 'Ελλάδα', DE: 'Γερμανία', GB: 'Ην. Βασίλειο', US: 'ΗΠΑ', FR: 'Γαλλία',
  IT: 'Ιταλία', NL: 'Ολλανδία', AT: 'Αυστρία', CH: 'Ελβετία', BE: 'Βέλγιο',
  SE: 'Σουηδία', PL: 'Πολωνία', RO: 'Ρουμανία', BG: 'Βουλγαρία', CY: 'Κύπρος',
  ES: 'Ισπανία', PT: 'Πορτογαλία', CZ: 'Τσεχία', DK: 'Δανία', NO: 'Νορβηγία',
  FI: 'Φινλανδία', IE: 'Ιρλανδία', IL: 'Ισραήλ', TR: 'Τουρκία', RU: 'Ρωσία',
  UA: 'Ουκρανία', CA: 'Καναδάς', AU: 'Αυστραλία', NZ: 'Ν. Ζηλανδία',
  HU: 'Ουγγαρία', SK: 'Σλοβακία', SI: 'Σλοβενία', HR: 'Κροατία', RS: 'Σερβία',
  AL: 'Αλβανία', MK: 'Β. Μακεδονία', BA: 'Βοσνία', ME: 'Μαυροβούνιο',
  MT: 'Μάλτα', LU: 'Λουξεμβούργο', EE: 'Εσθονία', LV: 'Λετονία', LT: 'Λιθουανία',
  IS: 'Ισλανδία', JP: 'Ιαπωνία', CN: 'Κίνα', IN: 'Ινδία', KR: 'Ν. Κορέα',
  SG: 'Σιγκαπούρη', HK: 'Χονγκ Κονγκ', TH: 'Ταϊλάνδη', AE: 'Ην. Αραβ. Εμιράτα',
  SA: 'Σ. Αραβία', QA: 'Κατάρ', KW: 'Κουβέιτ', EG: 'Αίγυπτος', ZA: 'Ν. Αφρική',
  BR: 'Βραζιλία', AR: 'Αργεντινή', CL: 'Χιλή', MX: 'Μεξικό', CO: 'Κολομβία',
  PE: 'Περού', UY: 'Ουρουγουάη', BY: 'Λευκορωσία', MD: 'Μολδαβία',
  GE: 'Γεωργία', AM: 'Αρμενία', AZ: 'Αζερμπαϊτζάν', KZ: 'Καζακστάν',
  PH: 'Φιλιππίνες', MY: 'Μαλαισία', ID: 'Ινδονησία', VN: 'Βιετνάμ',
  TW: 'Ταϊβάν', PK: 'Πακιστάν', BD: 'Μπανγκλαντές', LK: 'Σρι Λάνκα',
  MA: 'Μαρόκο', TN: 'Τυνησία', DZ: 'Αλγερία', NG: 'Νιγηρία', KE: 'Κένυα',
  LB: 'Λίβανος', JO: 'Ιορδανία', IR: 'Ιράν', IQ: 'Ιράκ', SY: 'Συρία',
};

/** 🇬🇷 from "GR" — derived, so every country code gets a flag without a table. */
export const countryFlag = (code) => {
  if (!/^[A-Z]{2}$/.test(code || '')) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

/** "🇬🇷 Ελλάδα" — flag + Greek name, or the bare code when we don't know it. */
export const countryLabel = (code) => {
  if (!code || code === '??') return '🏳️ Άγνωστη';
  return `${countryFlag(code)} ${COUNTRY_NAMES_EL[code] || code}`;
};

/**
 * Country + city + coordinates from the edge headers. Coordinates are rounded to
 * 2 decimals (~1 km) — the header itself is only city-accurate, so this keeps the
 * key short without losing anything real.
 */
export const readGeo = (headers) => {
  let country = '??';
  let city = '';
  let lat = null;
  let lon = null;
  let precise = false; // true only when the edge itself gave us coordinates

  const raw = headers['x-nf-geo'];
  if (raw) {
    try {
      const geo = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) || {};
      const code = geo.country && geo.country.code;
      if (code) country = String(code).toUpperCase().slice(0, 2);
      if (geo.city) city = String(geo.city);
      const gLat = geo.latitude ?? (geo.location && geo.location.latitude);
      const gLon = geo.longitude ?? (geo.location && geo.location.longitude);
      if (Number.isFinite(gLat) && Number.isFinite(gLon)) {
        lat = Number(gLat);
        lon = Number(gLon);
        precise = true;
      }
    } catch {
      // fall through to the header fallbacks below
    }
  }

  if (country === '??') {
    const alt = headers['x-country'] || headers['x-nf-country'];
    if (alt) country = String(alt).toUpperCase().slice(0, 2);
  }

  if ((lat === null || lon === null) && COUNTRY_CENTROIDS[country]) {
    [lat, lon] = COUNTRY_CENTROIDS[country];
  }

  return {
    country,
    city,
    lat: lat === null ? null : Number(lat.toFixed(2)),
    lon: lon === null ? null : Number(lon.toFixed(2)),
    // True when the pin is a country centroid, not a real city fix — the console
    // draws those hollow so a made-up precision never reads as measured.
    approx: !precise,
  };
};

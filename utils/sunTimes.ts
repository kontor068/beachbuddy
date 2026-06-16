/**
 * Local sunset/sunrise calculation (NOAA solar position algorithm).
 * Avoids an extra network round-trip — sunset is deterministic from lat/lon/date,
 * so there is no reason to fetch it. Accuracy is within ~1 minute, plenty for
 * "when does the light go" planning on a beach.
 */

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

const dayOfYear = (date: Date): number => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
};

type SunEvent = 'sunset' | 'sunrise';

/**
 * Returns the local Date of sunset (or sunrise) for the given coordinates and day.
 * `utcOffsetMinutes` defaults to the runtime's offset for `date`; pass the beach's
 * own offset if you need wall-clock time independent of the viewer's timezone.
 */
const computeSunEvent = (
  event: SunEvent,
  lat: number,
  lon: number,
  date: Date,
  utcOffsetMinutes: number,
): Date | null => {
  const n = dayOfYear(date);
  const lngHour = lon / 15;
  const t = event === 'sunrise'
    ? n + (6 - lngHour) / 24
    : n + (18 - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(toRad(M)) + 0.020 * Math.sin(toRad(2 * M)) + 282.634;
  L = ((L % 360) + 360) % 360;

  let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
  RA = ((RA % 360) + 360) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;

  const sinDec = 0.39782 * Math.sin(toRad(L));
  const cosDec = Math.cos(Math.asin(sinDec));

  const zenith = 90.833; // official sunrise/sunset
  const cosH = (Math.cos(toRad(zenith)) - sinDec * Math.sin(toRad(lat))) / (cosDec * Math.cos(toRad(lat)));
  if (cosH > 1 || cosH < -1) return null; // sun never rises/sets that day

  let H = event === 'sunrise' ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
  H = H / 15;

  const T = H + RA - 0.06571 * t - 6.622;
  let UT = T - lngHour;
  UT = ((UT % 24) + 24) % 24;

  const localHours = UT + utcOffsetMinutes / 60;
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(Math.round(localHours * 60));
  return result;
};

export const getSunsetTime = (
  lat: number,
  lon: number,
  date: Date,
  utcOffsetMinutes = -date.getTimezoneOffset(),
): Date | null => computeSunEvent('sunset', lat, lon, date, utcOffsetMinutes);

export const getSunriseTime = (
  lat: number,
  lon: number,
  date: Date,
  utcOffsetMinutes = -date.getTimezoneOffset(),
): Date | null => computeSunEvent('sunrise', lat, lon, date, utcOffsetMinutes);

/**
 * ΠΟΥ ΕΙΝΑΙ Ο ΗΛΙΟΣ — για το φως της «παραλίας σε κίνηση» (03/09/2026).
 *
 * Ο κλασικός αλγόριθμος της NOAA σε απλή μορφή: από ημερομηνία/ώρα (απόλυτος χρόνος, UTC) και
 * γεωγραφικό πλάτος/μήκος βγάζει αζιμούθιο (0° = Βορράς, 90° = Ανατολή) και ύψος πάνω από τον
 * ορίζοντα. Ακρίβεια ~0,5°, υπεραρκετή για φωτισμό. Καμία εξάρτηση, καμία κλήση δικτύου.
 */

export type SunPosition = {
  /** Μοίρες από τον Βορρά, δεξιόστροφα. */
  azimuthDeg: number;
  /** Μοίρες πάνω από τον ορίζοντα (αρνητικό = νύχτα). */
  elevationDeg: number;
};

const RAD = Math.PI / 180;

export const sunPosition = (date: Date, lat: number, lon: number): SunPosition => {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const meanLon = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const eclipticLon = (meanLon + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLon), Math.cos(eclipticLon));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLon));
  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24;
  const localSidereal = ((gmstHours + lon / 15) * 15) * RAD;
  const hourAngle = localSidereal - rightAscension;
  const latR = lat * RAD;
  const elevation = Math.asin(
    Math.sin(latR) * Math.sin(declination) + Math.cos(latR) * Math.cos(declination) * Math.cos(hourAngle)
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle),
    Math.tan(declination) * Math.cos(latR) - Math.sin(latR) * Math.cos(hourAngle)
  );
  return {
    azimuthDeg: ((azimuth / RAD) + 360) % 360,
    elevationDeg: elevation / RAD,
  };
};

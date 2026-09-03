/**
 * ΑΝΑΓΛΥΦΟ ΓΥΡΩ ΑΠΟ ΤΙΣ ΠΑΡΑΛΙΕΣ — για την «παραλία σε κίνηση» (πιλοτικά, 03/09/2026).
 *
 * Ένα πλέγμα υψομέτρων ανά περιοχή (`scripts/bakeBeachRelief.mjs` → public/data/relief/), ψημένο από DEM
 * (opentopodata SRTM 30 μ. ή το DEM 90 μ. του Open-Meteo — δηλώνεται στο αρχείο), σε βήμα
 * ~150 μ., με 7 χλμ περιθώριο γύρω από τις παραλίες της περιοχής. Το διαβάζει μόνο ο 3D
 * ζωγράφος για να σηκώσει βουνά, ακρωτήρια και απέναντι ακτές γύρω από την παραλία.
 *
 * Λείπει το αρχείο; Η σκηνή παίζει χωρίς ανάγλυφο (ήπια πλαγιά άμμου), όπως πριν. Καμία
 * απόφαση, χρώμα ή κατάταξη δεν διαβάζει από εδώ — είναι ΜΟΝΟ εικόνα.
 */

export type BeachReliefGrid = {
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  rows: number;
  cols: number;
  stepM: number;
  /** Υψόμετρο (μ.) με διγραμμική παρεμβολή, ή null έξω από το πλέγμα. */
  sample: (lat: number, lon: number) => number | null;
};

type RawRelief = {
  v?: number;
  lat0?: number;
  lon0?: number;
  dLat?: number;
  dLon?: number;
  rows?: number;
  cols?: number;
  stepM?: number;
  /** Int16 little-endian, base64. */
  heights?: string;
};

const cache = new Map<string, Promise<BeachReliefGrid | undefined>>();

const decodeHeights = (base64: string, count: number): Int16Array | undefined => {
  if (typeof atob !== 'function') return undefined;
  const binary = atob(base64);
  if (binary.length < count * 2) return undefined;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const heights = new Int16Array(count);
  for (let i = 0; i < count; i += 1) heights[i] = view.getInt16(i * 2, true);
  return heights;
};

const normalize = (raw: RawRelief): BeachReliefGrid | undefined => {
  const { lat0, lon0, dLat, dLon, rows, cols, stepM, heights } = raw;
  if (
    typeof lat0 !== 'number' || typeof lon0 !== 'number' || typeof dLat !== 'number' || typeof dLon !== 'number'
    || typeof rows !== 'number' || typeof cols !== 'number' || typeof heights !== 'string'
  ) return undefined;
  const data = decodeHeights(heights, rows * cols);
  if (!data) return undefined;

  const sample = (lat: number, lon: number): number | null => {
    const fr = (lat - lat0) / dLat;
    const fc = (lon - lon0) / dLon;
    if (fr < 0 || fc < 0 || fr > rows - 1 || fc > cols - 1) return null;
    const r0 = Math.min(rows - 2, Math.floor(fr));
    const c0 = Math.min(cols - 2, Math.floor(fc));
    const tr = fr - r0;
    const tc = fc - c0;
    const h00 = data[r0 * cols + c0];
    const h01 = data[r0 * cols + c0 + 1];
    const h10 = data[(r0 + 1) * cols + c0];
    const h11 = data[(r0 + 1) * cols + c0 + 1];
    return (h00 * (1 - tc) + h01 * tc) * (1 - tr) + (h10 * (1 - tc) + h11 * tc) * tr;
  };

  return { lat0, lon0, dLat, dLon, rows, cols, stepM: stepM ?? 0, sample };
};

export const loadBeachRelief = (regionId: string): Promise<BeachReliefGrid | undefined> => {
  const cached = cache.get(regionId);
  if (cached) return cached;
  // ΟΧΙ κάτω από /data/coastline/: ο φύλακας του build (scripts/stripBuildInputsFromDist) ρίχνει
  // κάθε κώδικα που ζητά εκείνον τον φάκελο εκτός από τα σχήματα — έριξε το πρώτο deploy (03/09).
  const request = fetch(`/data/relief/${regionId}.json`)
    .then(response => (response.ok ? response.json() : undefined))
    .then(payload => (payload ? normalize(payload as RawRelief) : undefined))
    // Χωρίς αρχείο = χωρίς ανάγλυφο. Κανονική κατάσταση για κάθε περιοχή εκτός πιλότου.
    .catch(() => undefined);
  cache.set(regionId, request);
  return request;
};

/**
 * ΔΟΡΥΦΟΡΙΚΟ ΜΩΣΑΪΚΟ ΓΥΡΩ ΑΠΟ ΜΙΑ ΠΑΡΑΛΙΑ — για να ντυθεί η στεριά της «παραλίας σε κίνηση» με
 * την πραγματική φωτογραφία (03/09/2026, «κάν' τα όλα»).
 *
 * Ο ΙΔΙΟΣ πάροχος με τον δορυφόρο του χάρτη (Esri World Imagery, BeachMap.SATELLITE_TILE_URL),
 * που το CSP ήδη επιτρέπει (img-src https:). Κατεβάζουμε τα 9–16 πλακίδια του zoom 15 (~4,8 μ./
 * pixel) που καλύπτουν ±2 χλμ, τα ράβουμε σε έναν καμβά και τον δίνουμε στο WebGL ως υφή.
 *
 * ΟΡΟΙ: η εικόνα προβάλλεται μέσα στην ίδια εφαρμογή που ήδη τη δείχνει ως χάρτη, με την ίδια
 * αναφορά πηγής («© Esri») ορατή στο HUD. Δεν αποθηκεύεται, δεν ξαναδιανέμεται.
 *
 * Αν ο πάροχος δεν στείλει CORS (crossOrigin) ή κοπεί το δίκτυο, επιστρέφουμε null και η
 * στεριά μένει η διαδικαστική άμμος — τίποτα δεν σπάει.
 */

export type SatelliteMosaic = {
  canvas: HTMLCanvasElement;
  /** Γεωγραφικά όρια του καμβά (Web Mercator, όπως τα πλακίδια). */
  north: number;
  south: number;
  west: number;
  east: number;
  /** (lat, lon) → (u, v) στο [0,1], ή null έξω από το μωσαϊκό. */
  toUv: (lat: number, lon: number) => [number, number] | null;
  attribution: string;
};

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_PX = 256;
const ZOOM = 15;
/**
 * Στο zoom 15 ένα πλακίδιο είναι ~945 μ. στο πλάτος της Ελλάδας. Ακτίνα 1,2 χλμ → 3–4 πλακίδια
 * ανά άξονα, δηλαδή 9–16 (≈150–300 KB). Το ταβάνι είναι δίχτυ ασφαλείας, όχι στόχος: με 20
 * και ακτίνα 2 χλμ έβγαιναν 25 και το μωσαϊκό ακυρωνόταν ΠΑΝΤΑ (Μίλτος, 03/09/2026: «δεν
 * εμφανίζεται δορυφορική φωτογραφία»).
 */
const MAX_TILES = 36;

const lonToX = (lon: number, zoom: number) => ((lon + 180) / 360) * 2 ** zoom;
const latToY = (lat: number, zoom: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** zoom;
};
const xToLon = (x: number, zoom: number) => (x / 2 ** zoom) * 360 - 180;
const yToLat = (y: number, zoom: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const loadTile = (z: number, x: number, y: number): Promise<HTMLImageElement | null> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TILE_URL.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
  });

const cache = new Map<string, Promise<SatelliteMosaic | null>>();

/** Μωσαϊκό γύρω από (lat, lon) με ακτίνα `radiusM` μέτρα. Μία φορά ανά παραλία. */
export const loadSatelliteMosaic = (lat: number, lon: number, radiusM = 1200): Promise<SatelliteMosaic | null> => {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${radiusM}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<SatelliteMosaic | null> => {
    if (typeof document === 'undefined') return null;
    const mPerLat = 111320;
    const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
    const north = lat + radiusM / mPerLat;
    const south = lat - radiusM / mPerLat;
    const west = lon - radiusM / mPerLon;
    const east = lon + radiusM / mPerLon;
    const x0 = Math.floor(lonToX(west, ZOOM));
    const x1 = Math.floor(lonToX(east, ZOOM));
    const y0 = Math.floor(latToY(north, ZOOM));
    const y1 = Math.floor(latToY(south, ZOOM));
    const cols = x1 - x0 + 1;
    const rows = y1 - y0 + 1;
    if (cols * rows > MAX_TILES || cols <= 0 || rows <= 0) return null;

    const tiles = await Promise.all(
      Array.from({ length: cols * rows }, (_, i) => loadTile(ZOOM, x0 + (i % cols), y0 + Math.floor(i / cols)))
    );
    if (tiles.every(tile => tile === null)) return null;

    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_PX;
    canvas.height = rows * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#c9b98f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    tiles.forEach((tile, i) => {
      if (tile) ctx.drawImage(tile, (i % cols) * TILE_PX, Math.floor(i / cols) * TILE_PX);
    });
    // Αν ο πάροχος δεν έδωσε CORS, ο καμβάς είναι «μολυσμένος» και το WebGL θα τον αρνηθεί.
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      return null;
    }

    const mosaicNorth = yToLat(y0, ZOOM);
    const mosaicSouth = yToLat(y1 + 1, ZOOM);
    const mosaicWest = xToLon(x0, ZOOM);
    const mosaicEast = xToLon(x1 + 1, ZOOM);
    const toUv = (plat: number, plon: number): [number, number] | null => {
      const u = (lonToX(plon, ZOOM) - x0) / cols;
      const v = (latToY(plat, ZOOM) - y0) / rows;
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      return [u, v];
    };
    return { canvas, north: mosaicNorth, south: mosaicSouth, west: mosaicWest, east: mosaicEast, toUv, attribution: '© Esri, Maxar, Earthstar Geographics' };
  })().catch(() => null);

  cache.set(key, request);
  return request;
};

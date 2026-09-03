import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Waves, Wind, X } from 'lucide-react';
import type { Beach, LanguageCode, SuitableBeach } from '../types';
import { SHORELINE_BOX, type ShorelineShape } from '../services/shorelineShapeService';
import { useShorelineShape } from './ShorelineThumbnail';
import { createSeaMotionGl, deriveMotion, type SeaMotionGl, type SeaMotionParams } from '../utils/seaMotionGl';
import { loadBeachRelief, type BeachReliefGrid } from '../services/beachReliefService';

/**
 * Η ΠΑΡΑΛΙΑ ΣΕ ΚΙΝΗΣΗ — πειραματικό (03/09/2026, Μίλτος: «όταν πατάω το play να παίζει, όχι από
 * μόνο του· να αναπαράγει τη γεωμετρία της παραλίας και πώς χτυπάει ο άνεμος και το κύμα»).
 *
 * ΤΙ ΕΙΝΑΙ. Ένα μικρό canvas μέσα στο ταμπελάκι της πινέζας που ζωγραφίζει την ΠΡΑΓΜΑΤΙΚΗ
 * ακτογραμμή της παραλίας (το ίδιο σχήμα OSM με τη μινιατούρα της κάρτας, `ShorelineThumbnail`)
 * και πάνω της τα δύο πράγματα που λέει η κάρτα με λέξεις, αλλά σαν εικόνα που κινείται:
 *
 *  • ΤΟ ΚΥΜΑ: κορυφές που έρχονται από τη διεύθυνση του κύματος (`marine.waveDirectionDeg`),
 *    με απόσταση ανάλογη της περιόδου, ύψος ανάλογο της θάλασσας ανοιχτά (`seaStateWaveM`), και
 *    ΟΤΑΝ ΠΛΗΣΙΑΖΟΥΝ ΤΗΝ ΑΚΤΗ στρίβουν για να έρθουν παράλληλα με αυτήν (διάθλαση — αυτό που
 *    κάνει κάθε κύμα σε κάθε παραλία) και σπάνε σε αφρό με ένταση ανάλογη του νερού στην ακτή
 *    (`shoreDisplayWaveM`, το ίδιο νούμερο που τυπώνει η κάρτα).
 *  • Ο ΑΝΕΜΟΣ: ρεύματα που περνούν πάνω από στεριά και θάλασσα προς την κατεύθυνση που
 *    φυσάει, με ταχύτητα ανάλογη των km/h, και ψιλή «τσαλάκωση» στο νερό. Όταν φυσάει ΑΠΟ
 *    ΤΗ ΣΤΕΡΙΑ, το νερό κοντά στην άμμο μένει λείο — η σκιά ανέμου που το app ήδη περιγράφει.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ. Δεν είναι κάμερα και δεν είναι δεύτερο μοντέλο: κάθε νούμερο που το κινεί είναι
 * αυτό που η κάρτα ήδη γράφει, και η λεζάντα από κάτω το λέει ρητά («σχηματική απεικόνιση»).
 * Δεν παίρνει αποφάσεις, δεν αλλάζει χρώματα, δεν μπαίνει σε κατάταξη.
 *
 * ΣΑΝ ΒΙΝΤΕΟ (Μίλτος, 03/09/2026: «σαν video, πολύ high tech φάση»). Η κάμερα μπαίνει με
 * fly-in και περιστρέφεται αργά σαν drone, το νερό καθρεφτίζει τον ουρανό και σπινθηρίζει, η
 * εικόνα έχει βινιέτα και κόκκο, και από πάνω κάθεται ένα HUD: σκούρα γυάλινα πλαίσια με
 * μονοσπασμένους αριθμούς, γωνίες σκοπεύτρου, ένα λεπτό κυανό πλέγμα πάνω στη θάλασσα, και
 * κουμπί που το ανοίγει σε ΠΛΗΡΗ ΟΘΟΝΗ. Όλα «high tech», τίποτα ψεύτικο: το HUD δείχνει
 * μόνο τα νούμερα της ώρας και η λεζάντα λέει ότι δεν είναι κάμερα.
 *
 * ΔΥΟ ΖΩΓΡΑΦΟΙ, ΙΔΙΑ ΦΥΣΙΚΗ. Κανονικά παίζει σε 3D (WebGL, `utils/seaMotionGl`): κάμερα πίσω
 * από την παραλία που κοιτά τη θάλασσα, ανάγλυφη ακτή, κύματα με ύψος και φως, αφρός που
 * σπάει μπροστά στον θεατή. Όπου δεν υπάρχει WebGL, ο 2D ζωγράφος από κάτω (ένας πίνακας
 * 400×200 και ένας βρόχος, ~2–3 ms το καρέ) δείχνει το ίδιο από ψηλά. Και οι δύο διαβάζουν τα
 * ίδια νούμερα από την ίδια `deriveMotion`, ώστε να μη διαφωνούν ποτέ. Σταματά μόλις κλείσει
 * το ταμπελάκι.
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ. Φορτώνεται τεμπέλικα από τον χάρτη (`lazyWithChunkRecovery`) μόνο
 * όταν κάποιος πατήσει το play — ο επισκέπτης που δεν το πατά δεν κατεβάζει ούτε byte.
 */

/* ------------------------------------------------------------------ props */

export type BeachSeaMotionSceneProps = {
  item: SuitableBeach;
  language: LanguageCode;
  /** Η περιοχή της παραλίας — για το σχήμα της ακτής και το ψημένο ανάγλυφο. */
  regionId?: string;
  /** Από πού φυσάει (μετεωρολογικές μοίρες), για ΑΥΤΗ την παραλία αν υπάρχει τοπική ανάγνωση. */
  windFromDeg?: number;
  windSpeedKmh?: number;
  /**
   * 'inline': μέσα στο ταμπελάκι, με κουμπί για πλήρη οθόνη (υπολογιστής). 'fullscreen': ΜΟΝΟ
   * η πλήρης οθόνη — στο κινητό ο χάρτης είναι 214 px και μια σκηνή 108 px μέσα του κάλυπτε
   * την πάνω μπάρα (Μίλτος, 03/09/2026: «κάνει επικάλυψη με στοιχεία του χάρτη»).
   */
  presentation?: 'inline' | 'fullscreen';
  /** Κλείσιμο της πλήρους οθόνης όταν presentation='fullscreen' — το ταμπελάκι ξαναδείχνει play. */
  onClose?: () => void;
};

/* --------------------------------------------------------------- copy */

type SceneCopy = {
  caption: string;
  aria: (name: string) => string;
  noData: string;
  expand: string;
  close: string;
  sim: string;
  wind: string;
  sea: string;
  shore: string;
};

const sceneCopy: Record<LanguageCode, SceneCopy> = {
  gr: {
    caption: 'Προσομοίωση από τα δεδομένα της ώρας, όχι κάμερα',
    aria: name => `Κίνηση κύματος και ανέμου πάνω στην ακτογραμμή της παραλίας ${name}`,
    noData: 'Χωρίς δεδομένα ώρας',
    expand: 'Άνοιξε σε πλήρη οθόνη',
    close: 'Κλείσε την πλήρη οθόνη',
    sim: 'ΠΡΟΣΟΜΟΙΩΣΗ',
    wind: 'ΑΝΕΜΟΣ',
    sea: 'ΘΑΛΑΣΣΑ',
    shore: 'ΑΚΤΗ',
  },
  en: {
    caption: "Simulation from this hour's data, not a camera",
    aria: name => `Wave and wind motion over the shoreline of ${name}`,
    noData: 'No data for this hour',
    expand: 'Open full screen',
    close: 'Close full screen',
    sim: 'SIMULATION',
    wind: 'WIND',
    sea: 'SEA',
    shore: 'SHORE',
  },
  de: {
    caption: 'Simulation aus den Daten dieser Stunde, keine Kamera',
    aria: name => `Wellen- und Windbewegung über der Küstenlinie von ${name}`,
    noData: 'Keine Daten für diese Stunde',
    expand: 'Vollbild öffnen',
    close: 'Vollbild schließen',
    sim: 'SIMULATION',
    wind: 'WIND',
    sea: 'SEE',
    shore: 'UFER',
  },
  fr: {
    caption: "Simulation d'après les données de l'heure, pas une caméra",
    aria: name => `Mouvement de la houle et du vent sur le littoral de ${name}`,
    noData: 'Pas de données pour cette heure',
    expand: 'Ouvrir en plein écran',
    close: 'Fermer le plein écran',
    sim: 'SIMULATION',
    wind: 'VENT',
    sea: 'MER',
    shore: 'RIVAGE',
  },
  it: {
    caption: "Simulazione dai dati dell'ora, non una telecamera",
    aria: name => `Movimento di onda e vento sulla costa di ${name}`,
    noData: 'Nessun dato per questa ora',
    expand: 'Apri a schermo intero',
    close: 'Chiudi schermo intero',
    sim: 'SIMULAZIONE',
    wind: 'VENTO',
    sea: 'MARE',
    shore: 'RIVA',
  },
};

/* ----------------------------------------------------------- geometry */

/** Το παράθυρο του κουτιού 200×120 που δείχνουμε: κόβουμε λίγο ουρανό και λίγη ενδοχώρα. */
const VIEW_Y0 = 8;
const VIEW_H = 100;
/** Εσωτερικά εικονοστοιχεία ανά μονάδα του κουτιού. 2 → 400×200, καθαρό και φθηνό. */
const RES = 2;
const PW = SHORELINE_BOX.width * RES;
const PH = VIEW_H * RES;
const PIXELS = PW * PH;

/** Ευθεία ακτή για τις ~6% παραλίες χωρίς γεωμετρία — ώστε το play να δουλεύει παντού. */
const FALLBACK_POINTS = '-10,74 40,77 100,78 160,77 210,74';

type Point = [number, number];

const parsePoints = (serialized: string): Point[] =>
  serialized
    .split(' ')
    .map(pair => pair.split(',').map(Number) as Point)
    .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));

/** Η ακτογραμμή χτίζεται αριστερά→δεξιά, οπότε το ύψος του νερού σε κάθε x είναι απλή αναζήτηση. */
const makeLandYAt = (points: Point[]) => (x: number): number => {
  if (points.length === 0) return SHORELINE_BOX.pinY;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) {
      if (x2 === x1) return y2;
      return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
  }
  return points[points.length - 1][1];
};

type Field = {
  /** 1 = νερό, 0 = στεριά. */
  sea: Uint8Array;
  /** Απόσταση (μονάδες κουτιού) από την ακτογραμμή. */
  dist: Float32Array;
  /** Το κοντινότερο σημείο της ακτογραμμής, x και y — για να μη «σπάνε» οι κορυφές στη διάθλαση. */
  shoreX: Float32Array;
  shoreY: Float32Array;
  /** Τυχαίος αριθμός 0..1 ανά εικονοστοιχείο: αφρός, σπινθήρες ανέμου. */
  noise: Float32Array;
  /** Το ήσυχο χρώμα κάθε εικονοστοιχείου (θάλασσα κατά βάθος, άμμος κατά απόσταση). */
  base: Uint8ClampedArray;
  points: Point[];
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ένας πολύ φθηνός ντετερμινιστικός «τυχαίος» — ίδια εικόνα σε κάθε άνοιγμα της ίδιας παραλίας. */
const hashNoise = (i: number, seed: number) => {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const buildField = (points: Point[], seed: number): Field => {
  const sea = new Uint8Array(PIXELS);
  const dist = new Float32Array(PIXELS);
  const shoreX = new Float32Array(PIXELS);
  const shoreY = new Float32Array(PIXELS);
  const noise = new Float32Array(PIXELS);
  const base = new Uint8ClampedArray(PIXELS * 3);
  const landYAt = makeLandYAt(points);

  const segments: Array<[number, number, number, number, number]> = [];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    segments.push([x1, y1, dx, dy, dx * dx + dy * dy || 1]);
  }

  for (let py = 0; py < PH; py += 1) {
    const y = VIEW_Y0 + (py + 0.5) / RES;
    for (let px = 0; px < PW; px += 1) {
      const x = (px + 0.5) / RES;
      const i = py * PW + px;
      const landY = landYAt(x);
      const isSea = y < landY;
      sea[i] = isSea ? 1 : 0;

      let best = Infinity;
      let bx = x;
      let by = landY;
      for (const [sx, sy, dx, dy, len2] of segments) {
        let t = ((x - sx) * dx + (y - sy) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = sx + dx * t;
        const cy = sy + dy * t;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 < best) {
          best = d2;
          bx = cx;
          by = cy;
        }
      }
      const d = Math.sqrt(best);
      dist[i] = d;
      shoreX[i] = bx;
      shoreY[i] = by;
      noise[i] = hashNoise(i, seed);

      const o = i * 3;
      if (isSea) {
        // Ρηχά ανοιχτόχρωμα κοντά στην άμμο, βαθύτερο μπλε ανοιχτά — η ίδια παλέτα με τη μινιατούρα.
        // Μισή απόσταση από τη γραμμή, μισή κάθετη: η σκέτη απόσταση από πολύγραμμο κάνει «ακτίνες»
        // στις γωνίες των κόλπων, η κάθετη είναι λεία κατά x.
        const depth = 0.5 * d + 0.5 * Math.max(0, landY - y);
        const t = smooth(clamp01(depth / 55));
        base[o] = mix(191, 74, t);
        base[o + 1] = mix(230, 163, t);
        base[o + 2] = mix(240, 200, t);
      } else if (d < 2.5) {
        // Βρεγμένη άμμος: μια στενή σκούρα λωρίδα στη γραμμή του νερού.
        base[o] = 226;
        base[o + 1] = 214;
        base[o + 2] = 184;
      } else {
        const t = clamp01((y - landY) / 40);
        base[o] = mix(242, 216, t);
        base[o + 1] = mix(231, 204, t);
        base[o + 2] = mix(205, 171, t);
      }
    }
  }

  return { sea, dist, shoreX, shoreY, noise, base, points };
};

/* ------------------------------------------------------------- physics */

/** Το ίδιο σετ παραμέτρων με τον 3D ζωγράφο — δες utils/seaMotionGl. */
type Motion = SeaMotionParams;

type Streak = { x: number; y: number; age: number; life: number; len: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/* ----------------------------------------------------------- rendering */

const renderFrame = (
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  field: Field,
  motion: Motion,
  tSec: number,
  streaks: Streak[],
  dtSec: number
) => {
  const data = image.data;
  const { sea, dist, shoreX, shoreY, noise, base } = field;

  const m = deriveMotion(motion);
  const { tx, ty, arriving, openAmp, shoreAmp, hasWaves, kWave, omega, hasWind, windSpeed, wx, wy, windAmp, offshoreWind, ripSpeed, whitecaps, breakZone, foamStrength } = m;
  const kRip = (2 * Math.PI) / 3.2;

  for (let py = 0; py < PH; py += 1) {
    const y = VIEW_Y0 + (py + 0.5) / RES;
    for (let px = 0; px < PW; px += 1) {
      const i = py * PW + px;
      const o = i * 3;
      const q = i * 4;
      let r = base[o];
      let g = base[o + 1];
      let b = base[o + 2];

      if (sea[i]) {
        const x = (px + 0.5) / RES;
        const d = dist[i];
        const n = noise[i];

        if (hasWaves) {
          const w = arriving ? smooth(clamp01(1 - d / 38)) : 0;
          const far = tx * x + ty * y;
          const farAtShore = tx * shoreX[i] + ty * shoreY[i];
          const travelled = (1 - w) * far + w * (farAtShore - d);
          const phase = kWave * travelled - omega * tSec;
          const v = Math.sin(phase);
          const amp = mix(shoreAmp, openAmp, clamp01(d / 45));
          let shade = v * amp * 30;
          // Λεπτή φωτεινή γραμμή στην κορυφή — αυτό κάνει το κύμα «κύμα» και όχι θόλωμα.
          if (v > 0.72) shade += (v - 0.72) * 3.6 * amp * 34;
          r += shade;
          g += shade;
          b += shade * 0.8;

          // Αφρός εκεί που το κύμα φτάνει στην άμμο, όσο πιο ψηλό το νερό στην ακτή.
          if (arriving && d < breakZone && foamStrength > 0) {
            const f = foamStrength * (0.5 + 0.5 * v) * (1 - d / breakZone);
            const speck = n < f * 0.9 ? 1 : 0;
            const white = clamp01(f * 0.7 + speck * 0.6);
            r = mix(r, 255, white);
            g = mix(g, 255, white);
            b = mix(b, 255, white);
          }
        }

        if (windAmp > 0) {
          // Η τσαλάκωση του ανέμου: ψιλά, γρήγορα, με τυχαίο τρέμουλο (cat's paws).
          const shadow = offshoreWind ? clamp01(d / 34) : 1;
          // Ριπές: αργά κινούμενα μπαλώματα, ώστε η τσαλάκωση να μην είναι ομοιόμορφη ρίγα.
          const gust = 0.55 + 0.45 * Math.sin(0.11 * x + 0.07 * y - 0.8 * tSec) * Math.sin(0.09 * x - 0.13 * y + 0.5 * tSec);
          const ripAmp = windAmp * shadow * gust;
          if (ripAmp > 0) {
            const rip = Math.sin(kRip * (wx * x + wy * y) - kRip * ripSpeed * tSec + n * 6) * (0.45 + 0.55 * n);
            const s = rip * ripAmp * 14;
            r += s;
            g += s;
            b += s;
            if (whitecaps > 0 && rip > 0.6 && n < whitecaps * shadow) {
              r = mix(r, 255, 0.85);
              g = mix(g, 255, 0.85);
              b = mix(b, 255, 0.85);
            }
          }
        }
      }

      data[q] = r;
      data[q + 1] = g;
      data[q + 2] = b;
      data[q + 3] = 255;
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(image, 0, 0);

  // Από εδώ και κάτω ζωγραφίζουμε σε μονάδες κουτιού.
  ctx.setTransform(RES, 0, 0, RES, 0, -VIEW_Y0 * RES);

  // Η ακτογραμμή, όπως στη μινιατούρα.
  ctx.beginPath();
  field.points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(63,139,163,0.6)';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Τα ρεύματα του ανέμου.
  if (hasWind && windAmp > 0) {
    const wanted = Math.min(22, Math.max(3, Math.round(windSpeed / 3)));
    while (streaks.length < wanted) streaks.push(spawnStreak(wx, wy, windSpeed as number, true));
    while (streaks.length > wanted) streaks.pop();
    const speed = 6 + windSpeed * 0.55;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    for (let s = 0; s < streaks.length; s += 1) {
      const streak = streaks[s];
      streak.age += dtSec;
      streak.x += wx * speed * dtSec;
      streak.y += wy * speed * dtSec;
      const out =
        streak.x < -12 || streak.x > SHORELINE_BOX.width + 12 || streak.y < VIEW_Y0 - 12 || streak.y > VIEW_Y0 + VIEW_H + 12;
      if (streak.age > streak.life || out) {
        streaks[s] = spawnStreak(wx, wy, windSpeed as number, false);
        continue;
      }
      const fade = Math.sin((streak.age / streak.life) * Math.PI);
      const overSea = streak.y < makeLandYAtCached(field)(streak.x);
      ctx.strokeStyle = overSea ? `rgba(255,255,255,${(0.75 * fade).toFixed(3)})` : `rgba(96,84,60,${(0.32 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(streak.x - wx * streak.len, streak.y - wy * streak.len);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();
    }
  } else {
    streaks.length = 0;
  }

  // Η πινέζα.
  const { pinX, pinY } = SHORELINE_BOX;
  ctx.beginPath();
  ctx.arc(pinX, pinY, 5.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pinX, pinY, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = '#0e7490';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pinX, pinY, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
};

const landYCache = new WeakMap<Field, (x: number) => number>();
const makeLandYAtCached = (field: Field) => {
  let fn = landYCache.get(field);
  if (!fn) {
    fn = makeLandYAt(field.points);
    landYCache.set(field, fn);
  }
  return fn;
};

/**
 * Ένα ρεύμα γεννιέται «ανάντη» — στην άκρη απ' όπου έρχεται ο άνεμος — ώστε να διασχίσει όλο το
 * κάδρο. Στο πρώτο γέμισμα σκορπίζονται παντού για να μην ξεκινά η σκηνή άδεια.
 */
const spawnStreak = (wx: number, wy: number, speedKmh: number, anywhere: boolean): Streak => {
  const len = Math.min(18, 5 + speedKmh * 0.15);
  const life = rand(1.6, 3.4);
  if (anywhere) {
    return { x: rand(0, SHORELINE_BOX.width), y: rand(VIEW_Y0, VIEW_Y0 + VIEW_H), age: rand(0, life), life, len };
  }
  // Πίσω από το κάδρο, απέναντι από την κατεύθυνση κίνησης, με τυχαία θέση κατά μήκος της άκρης.
  const cx = SHORELINE_BOX.width / 2;
  const cy = VIEW_Y0 + VIEW_H / 2;
  const reach = 130;
  const px = cx - wx * reach + -wy * rand(-120, 120);
  const py = cy - wy * reach + wx * rand(-120, 120);
  return { x: px, y: py, age: 0, life, len };
};

/* ---------------------------------------------------------- component */

const ArrowGlyph: React.FC<{ rotateDeg: number; className?: string }> = ({ rotateDeg, className = '' }) => (
  <svg
    viewBox="0 0 12 12"
    className={`shrink-0 ${className}`}
    style={{ transform: `rotate(${rotateDeg}deg)` }}
    aria-hidden="true"
  >
    <path d="M6 1.2 L6 10.8 M2.6 4.6 L6 1.2 L9.4 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Πού είναι ο Βορράς, και από πού έρχονται άνεμος και κύμα, σε ένα δαχτυλίδι σκοπεύτρου. Το
 * σχήμα κοιτά τη θάλασσα προς τα πάνω, οπότε ο Βορράς γυρίζει κατά -facingDeg· η βελόνα γυρίζει,
 * το γράμμα μένει όρθιο στη μύτη της.
 */
const CompassRing: React.FC<{ facingDeg: number; windFromDeg?: number; waveFromDeg?: number; size: number }> = ({ facingDeg, windFromDeg, waveFromDeg, size }) => {
  const rad = (-facingDeg * Math.PI) / 180;
  const tipX = 16 + 9 * Math.sin(rad);
  const tipY = 16 - 9 * Math.cos(rad);
  const labelX = 16 + 13.2 * Math.sin(rad);
  const labelY = 16 - 13.2 * Math.cos(rad);
  const tick = (fromDeg: number, color: string) => {
    const a = ((fromDeg - facingDeg) * Math.PI) / 180;
    const x = 16 + 11.5 * Math.sin(a);
    const y = 16 - 11.5 * Math.cos(a);
    return <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r="1.7" fill={color} />;
  };
  return (
    <svg viewBox="0 0 32 32" style={{ width: size, height: size }} className="shrink-0" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="rgba(2,12,22,0.55)" stroke="rgba(103,232,249,0.45)" strokeWidth="0.8" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="rgba(103,232,249,0.22)" strokeWidth="0.6" strokeDasharray="1.2 2.4" />
      <path d={`M16 16 L${tipX.toFixed(2)} ${tipY.toFixed(2)}`} stroke="#fb7185" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.3" fill="#e2e8f0" />
      <text x={labelX.toFixed(2)} y={labelY.toFixed(2)} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="900" fill="#f1f5f9">N</text>
      {typeof windFromDeg === 'number' && tick(windFromDeg, '#67e8f9')}
      {typeof waveFromDeg === 'number' && tick(waveFromDeg, '#93c5fd')}
    </svg>
  );
};

const formatMetres = (language: LanguageCode, value: number) =>
  `${value.toFixed(1).replace('.', language === 'en' ? '.' : ',')} m`;

const resolveFacing = (item: SuitableBeach): number | null => {
  const beach: Beach = item.beach;
  const candidates = [item.orientation, beach.orientation?.degrees, beach.windProfile?.beachFacingDirection];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return null;
};

/** Οι τέσσερις γωνίες του σκοπεύτρου — το πιο φθηνό «οθόνη drone» που υπάρχει. */
const ViewfinderCorners: React.FC<{ inset: string; size: string }> = ({ inset, size }) => (
  <>
    {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map(cls => (
      <span key={cls} className={`pointer-events-none absolute ${cls} border-cyan-300/70`} style={{ margin: inset, width: size, height: size }} aria-hidden="true" />
    ))}
  </>
);

/**
 * Το ψημένο ανάγλυφο της περιοχής, αν υπάρχει (πιλοτικά: Θεσπρωτία). Χωρίς αρχείο → undefined
 * και η σκηνή παίζει με ήπια πλαγιά άμμου.
 */
const useBeachRelief = (regionId: string | undefined): BeachReliefGrid | undefined => {
  const [relief, setRelief] = useState<BeachReliefGrid | undefined>(undefined);
  useEffect(() => {
    if (!regionId) {
      setRelief(undefined);
      return undefined;
    }
    let active = true;
    loadBeachRelief(regionId).then(grid => {
      if (active) setRelief(grid);
    });
    return () => {
      active = false;
    };
  }, [regionId]);
  return relief;
};

/**
 * Από μονάδες κουτιού σε γεωγραφικές μοίρες — ο ΑΝΤΙΣΤΡΟΦΟΣ μετασχηματισμός του
 * scripts/buildShorelineThumbs.mjs: το κουτί είναι γυρισμένο ώστε η θάλασσα να κοιτά πάνω
 * (facingDeg) και έχει αρχή το σημείο της ακτογραμμής που είναι πιο κοντά στην πινέζα.
 *
 * ΠΑΡΑΔΟΧΗ: το σχήμα κρατά μόνο την ΑΠΟΣΤΑΣΗ πινέζας–ακτής (pinDistanceM), όχι τη διεύθυνση·
 * παίρνουμε ότι η ακτή είναι προς τη θάλασσα από την πινέζα. Σφάλμα ως ~50 μ., αμελητέο
 * πάνω σε DEM 150 μ.
 */
const makeReliefSampler = (grid: BeachReliefGrid, shape: ShorelineShape, lat: number, lon: number) => {
  const metresPerUnit = shape.frameWidthM / SHORELINE_BOX.width;
  const theta = (shape.facingDeg * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const originE = shape.pinDistanceM * sin;
  const originN = shape.pinDistanceM * cos;
  return (x: number, y: number): number | null => {
    const cross = (x - SHORELINE_BOX.pinX) * metresPerUnit;
    const along = (SHORELINE_BOX.pinY - y) * metresPerUnit;
    const east = cross * cos + along * sin + originE;
    const north = -cross * sin + along * cos + originN;
    return grid.sample(lat + north / mPerLat, lon + east / mPerLon);
  };
};

type SceneViewProps = {
  item: SuitableBeach;
  language: LanguageCode;
  windFromDeg?: number;
  windSpeedKmh?: number;
  shape: ShorelineShape | undefined;
  relief: BeachReliefGrid | undefined;
  variant: 'popup' | 'full';
  onExpand?: () => void;
  onClose?: () => void;
};

/**
 * Η ίδια σκηνή σε δύο μεγέθη: μέσα στο ταμπελάκι (216 px) και σε πλήρη οθόνη. Ο καμβάς
 * παίρνει την ανάλυση της οθόνης στο μεγάλο (ως 1,5× για να μη ζεσταίνει το κινητό), τα HUD
 * μεγαλώνουν, ο ζωγράφος είναι ο ίδιος.
 */
const SceneView: React.FC<SceneViewProps> = ({ item, language, windFromDeg, windSpeedKmh, shape, relief, variant, onExpand, onClose }) => {
  const beach = item.beach;
  const copy = sceneCopy[language] ?? sceneCopy.en;
  const beachName = item.name || beach.name[language] || beach.name.en;
  const full = variant === 'full';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streaksRef = useRef<Streak[]>([]);
  const motionRef = useRef<Motion | null>(null);

  const pointsKey = shape?.points ?? FALLBACK_POINTS;
  /**
   * 3D πρώτα· αν το WebGL λείπει ή σκάσει, ένας ΝΕΟΣ καμβάς (το key) πέφτει στον 2D ζωγράφο —
   * ένας καμβάς που δοκίμασε WebGL δεν δίνει πια 2D context, γι' αυτό ξαναγεννιέται.
   */
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  /**
   * ΚΑΘΕ ΦΟΡΑ ΠΟΥ ΞΑΝΑΣΤΗΝΕΤΑΙ Ο ΖΩΓΡΑΦΟΣ, ΝΕΟΣ ΚΑΜΒΑΣ (03/09/2026, «πατάς play και δείχνει
   * κενό»). Το καθάρισμα του ζωγράφου χάνει ρητά το WebGL context (loseContext) — σωστό για
   * τη μνήμη, αλλά ένας καμβάς με χαμένο context δεν ξαναζωγραφίζει ΠΟΤΕ. Το ταμπελάκι
   * ξαναρεντάρει συνέχεια (ο άνεμος και η ώρα αλλάζουν), το `item.beach` αλλάζει ταυτότητα, το
   * effect ξανάτρεχε πάνω στον ίδιο νεκρό καμβά και η σκηνή έμενε άδεια μέχρι να ξανανοίξει
   * το ταμπελάκι. Λύση: το effect εξαρτάται ΜΟΝΟ από πρωτογενείς τιμές (geometryKey), και ο
   * καμβάς παίρνει το ίδιο key — ό,τι ξαναστήνει τον ζωγράφο ξαναγεννά και τον καμβά. Το ίδιο
   * όταν το ίδιο το κινητό πετάξει το context (webglcontextlost): μετρητής, νέος καμβάς.
   */
  const [lostContexts, setLostContexts] = useState(0);

  const authoredFacing = resolveFacing(item);
  const facingDeg = shape?.facingDeg ?? authoredFacing ?? 0;
  const hasFacing = shape !== undefined || authoredFacing !== null;

  const waveFromDeg = item.marine?.waveDirectionDeg ?? item.marine?.swellWaveDirectionDeg;
  const openWaveM = item.seaStateWaveM ?? item.waveHeightM;
  const shoreWaveM = item.shoreDisplayWaveM ?? item.shoreWaveHeightM ?? openWaveM;
  const periodS = item.seaStatePeriodS ?? item.marine?.wavePeriodS ?? 5;

  motionRef.current = {
    facingDeg,
    windFromDeg,
    windSpeedKmh,
    waveFromDeg,
    openWaveM,
    shoreWaveM,
    periodS: Math.min(14, Math.max(2.5, periodS)),
    metresPerUnit: shape?.frameWidthM ? shape.frameWidthM / SHORELINE_BOX.width : 5,
  };

  const beachLat = beach.coordinates?.lat;
  const beachLon = beach.coordinates?.lon;
  const geometryKey = [
    mode,
    full ? 'full' : 'popup',
    beach.id,
    pointsKey,
    shape ? `${shape.facingDeg}|${shape.frameWidthM}|${shape.pinDistanceM}` : 'noshape',
    relief ? `${relief.lat0}|${relief.lon0}|${relief.rows}x${relief.cols}` : 'norelief',
    typeof beachLat === 'number' && typeof beachLon === 'number' ? `${beachLat},${beachLon}` : 'nocoords',
    lostContexts,
  ].join(':');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const points = parsePoints(pointsKey);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setLostContexts(count => count + 1);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    let gl: SeaMotionGl | null = null;
    let draw2d: ((tSec: number, dtSec: number) => void) | null = null;

    if (mode === '3d') {
      if (full) {
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(320, Math.round(rect.width * dpr));
        canvas.height = Math.max(200, Math.round(rect.height * dpr));
      }
      const metresPerUnit = shape?.frameWidthM ? shape.frameWidthM / SHORELINE_BOX.width : 5;
      const sampler = relief && shape && typeof beachLat === 'number' && typeof beachLon === 'number'
        ? makeReliefSampler(relief, shape, beachLat, beachLon)
        : undefined;
      try {
        gl = createSeaMotionGl(canvas, points, beach.id, { grid: full ? 0.1 : 0.12, relief: sampler, metresPerUnit });
      } catch {
        gl = null;
      }
      if (!gl) {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        setMode('2d');
        return undefined;
      }
    } else {
      canvas.width = PW;
      canvas.height = PH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return undefined;
      const field = buildField(points, beach.id);
      const image = ctx.createImageData(PW, PH);
      draw2d = (tSec, dtSec) => {
        const motion = motionRef.current;
        if (motion) renderFrame(ctx, image, field, motion, tSec, streaksRef.current, dtSec);
      };
    }

    const reduceMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    let frame = 0;
    let last = performance.now();
    const start = last;
    let lastDrawn = -Infinity;
    // 30 καρέ το δευτερόλεπτο φτάνουν για νερό. Αν ένα κινητό αργεί (πάνω από 14 ms το καρέ,
    // μετρημένο), πέφτουμε στα 20 — καλύτερα λίγο πιο αραιά καρέ παρά ζεστό τηλέφωνο.
    let minInterval = 31;
    let slowFrames = 0;

    const draw = (now: number) => {
      const motion = motionRef.current;
      if (motion) {
        const dt = Math.min(0.1, (now - last) / 1000);
        const began = performance.now();
        // Σε reduced-motion η κάμερα στέκεται στην τελική της θέση (t μετά το fly-in).
        const t = reduceMotion ? 3 : (now - start) / 1000;
        if (gl) gl.render(motion, t, dt);
        else if (draw2d) draw2d(t, dt);
        if (performance.now() - began > 14) {
          slowFrames += 1;
          if (slowFrames >= 8) minInterval = 48;
        }
      }
      last = now;
    };

    if (reduceMotion) {
      draw(start);
      return () => {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        gl?.dispose();
      };
    }

    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      if (now - lastDrawn < minInterval) return;
      lastDrawn = now;
      draw(now);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl?.dispose();
    };
    // Το geometryKey συνοψίζει κάθε τιμή που διαβάζει το effect· οι υπόλοιπες αλλαγές
    // (άνεμος, κύμα) περνούν από το motionRef χωρίς να ξαναστήσουν τον ζωγράφο.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey]);

  const hasWind = typeof windSpeedKmh === 'number' && Number.isFinite(windSpeedKmh) && typeof windFromDeg === 'number';
  const showWaveChip = typeof openWaveM === 'number' && Number.isFinite(openWaveM);
  const waveArrowFrom = waveFromDeg ?? windFromDeg ?? facingDeg;
  const shoreDiffers = typeof shoreWaveM === 'number' && typeof openWaveM === 'number' && Math.abs(shoreWaveM - openWaveM) >= 0.05;

  const chip = full
    ? 'flex items-center gap-1.5 whitespace-nowrap rounded-md border border-cyan-300/30 bg-slate-950/60 px-2.5 py-1.5 text-[13px] font-bold leading-none text-cyan-50 backdrop-blur-sm [font-variant-numeric:tabular-nums]'
    : 'flex items-center gap-0.5 whitespace-nowrap rounded border border-cyan-300/30 bg-slate-950/60 px-1 py-0.5 text-[8px] font-bold leading-none text-cyan-50 backdrop-blur-sm [font-variant-numeric:tabular-nums]';
  const chipLabel = full ? 'text-[9px] font-black tracking-[0.18em] text-cyan-300/80' : 'hidden';
  const icon = full ? 'h-4 w-4 shrink-0 text-cyan-300' : 'h-3 w-3 shrink-0 text-cyan-300';
  const arrow = full ? 'h-4 w-4 text-cyan-200' : 'h-3 w-3 text-cyan-200';
  const edge = full ? 'p-3 sm:p-5' : 'p-1';

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 ${full ? 'h-full' : 'h-[6.75rem] rounded-lg'}`}
      role="img"
      aria-label={copy.aria(beachName)}
    >
      <canvas
        key={geometryKey}
        ref={canvasRef}
        width={PW}
        height={PH}
        className="block h-full w-full"
      />
      <ViewfinderCorners inset={full ? '10px' : '4px'} size={full ? '22px' : '9px'} />

      {/* Μικρό: άνεμος αριστερά, θάλασσα δεξιά. Πλήρης οθόνη: όνομα και τα δύο σε στήλη αριστερά,
          ώστε να χωρούν και σε όρθιο κινητό δίπλα στο X. */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start ${full ? 'flex-col gap-1.5 pr-16' : 'justify-between gap-2'} ${edge}`}>
        {full && (
          <p className="max-w-full truncate rounded-md border border-cyan-300/20 bg-slate-950/50 px-3 py-1.5 text-sm font-black text-white backdrop-blur-sm">{beachName}</p>
        )}
        <div className="flex flex-col items-start gap-1">
          {hasWind ? (
            <div className={chip}>
              <Wind className={icon} aria-hidden="true" />
              <span className={chipLabel}>{copy.wind}</span>
              <ArrowGlyph rotateDeg={(windFromDeg as number) + 180 - facingDeg} className={arrow} />
              <span>{Math.round(windSpeedKmh as number)} km/h</span>
            </div>
          ) : null}
        </div>
        <div className={`flex flex-col gap-1 ${full ? 'items-start' : 'items-end'}`}>
          {showWaveChip ? (
            <div className={chip}>
              <Waves className={icon} aria-hidden="true" />
              <span className={chipLabel}>{copy.sea}</span>
              <ArrowGlyph rotateDeg={waveArrowFrom + 180 - facingDeg} className={arrow} />
              <span>
                {full
                  ? `${formatMetres(language, openWaveM as number)}${shoreDiffers ? ` → ~${formatMetres(language, shoreWaveM as number)}` : ''}`
                  : shoreDiffers
                    ? `${formatMetres(language, openWaveM as number).replace(' m', '')}→~${formatMetres(language, shoreWaveM as number)}`
                    : formatMetres(language, openWaveM as number)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {!hasWind && !showWaveChip && (
        <div className={`pointer-events-none absolute inset-x-0 ${full ? 'top-16' : 'top-6'} mx-auto w-fit rounded border border-cyan-300/30 bg-slate-950/60 px-2 py-1 text-[10px] font-bold text-cyan-50`}>
          {copy.noData}
        </div>
      )}

      {/* Κάτω: πυξίδα αριστερά, «ΠΡΟΣΟΜΟΙΩΣΗ» με παλλόμενη κουκκίδα και το κουμπί δεξιά. */}
      <div className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 ${edge}`}>
        <div className="pointer-events-none flex items-end gap-1.5">
          {hasFacing && <CompassRing facingDeg={facingDeg} windFromDeg={hasWind ? windFromDeg : undefined} waveFromDeg={showWaveChip ? waveArrowFrom : undefined} size={full ? 56 : 26} />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`pointer-events-none flex items-center gap-1 rounded border border-cyan-300/30 bg-slate-950/60 ${full ? 'px-2 py-1 text-[10px]' : 'px-1 py-0.5 text-[7px]'} font-black tracking-[0.16em] text-cyan-200 backdrop-blur-sm`}>
            <span className={`${full ? 'h-1.5 w-1.5' : 'h-1 w-1'} animate-pulse rounded-full bg-cyan-300`} aria-hidden="true" />
            {copy.sim}
          </span>
          {!full && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={copy.expand}
              title={copy.expand}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-cyan-300/40 bg-slate-950/70 text-cyan-100 transition hover:bg-slate-900"
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {full && (
        <>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
            className="absolute right-3 top-3 sm:right-5 sm:top-5 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-cyan-300/40 bg-slate-950/70 text-white transition hover:bg-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="pointer-events-none absolute inset-x-0 bottom-[5.5rem] sm:bottom-24 px-4 text-center text-[11px] font-semibold text-cyan-100/70">{copy.caption}</p>
        </>
      )}
    </div>
  );
};

/**
 * Πλήρης οθόνη: portal στο body, πάνω από τον χάρτη και το ταμπελάκι. Κλείνει με το X, με Esc,
 * και κλειδώνει το σκρολ της σελίδας όσο είναι ανοιχτό.
 */
const FullScreenScene: React.FC<Omit<SceneViewProps, 'variant' | 'onExpand'> & { onClose: () => void }> = props => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [props]);

  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-slate-950" style={{ height: '100dvh' }} role="dialog" aria-modal="true">
      <SceneView {...props} variant="full" />
    </div>,
    document.body
  );
};

const BeachSeaMotionScene: React.FC<BeachSeaMotionSceneProps> = ({ item, language, regionId, windFromDeg, windSpeedKmh, presentation = 'inline', onClose }) => {
  const beach = item.beach;
  const homeRegionId = beach.regionId ?? regionId;
  const shape: ShorelineShape | undefined = useShorelineShape(homeRegionId, beach.sourceBeachId ?? beach.id);
  const relief = useBeachRelief(homeRegionId);
  const copy = sceneCopy[language] ?? sceneCopy.en;
  const [fullOpen, setFullOpen] = useState(false);

  if (presentation === 'fullscreen') {
    if (typeof document === 'undefined') return null;
    return (
      <FullScreenScene
        item={item}
        language={language}
        windFromDeg={windFromDeg}
        windSpeedKmh={windSpeedKmh}
        shape={shape}
        relief={relief}
        onClose={() => onClose?.()}
      />
    );
  }

  return (
    <div className="mt-1">
      <SceneView
        item={item}
        language={language}
        windFromDeg={windFromDeg}
        windSpeedKmh={windSpeedKmh}
        shape={shape}
        relief={relief}
        variant="popup"
        onExpand={() => setFullOpen(true)}
      />
      <p className="mt-0.5 text-[8.5px] font-semibold leading-tight text-slate-500">{copy.caption}</p>
      {fullOpen && typeof document !== 'undefined' && (
        <FullScreenScene
          item={item}
          language={language}
          windFromDeg={windFromDeg}
          windSpeedKmh={windSpeedKmh}
          shape={shape}
          relief={relief}
          onClose={() => setFullOpen(false)}
        />
      )}
    </div>
  );
};

export default BeachSeaMotionScene;

import React, { useEffect, useRef, useState } from 'react';
import { Waves, Wind } from 'lucide-react';
import type { Beach, LanguageCode, SuitableBeach } from '../types';
import { SHORELINE_BOX, type ShorelineShape } from '../services/shorelineShapeService';
import { useShorelineShape } from './ShorelineThumbnail';
import { createSeaMotionGl, deriveMotion, type SeaMotionGl, type SeaMotionParams } from '../utils/seaMotionGl';

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
  /** Από πού φυσάει (μετεωρολογικές μοίρες), για ΑΥΤΗ την παραλία αν υπάρχει τοπική ανάγνωση. */
  windFromDeg?: number;
  windSpeedKmh?: number;
};

/* --------------------------------------------------------------- copy */

const sceneCopy: Record<LanguageCode, { caption: string; aria: (name: string) => string; noData: string }> = {
  gr: {
    caption: 'Σχηματική απεικόνιση από τα δεδομένα της ώρας, όχι κάμερα',
    aria: name => `Κίνηση κύματος και ανέμου πάνω στην ακτογραμμή της παραλίας ${name}`,
    noData: 'Χωρίς δεδομένα ώρας',
  },
  en: {
    caption: "Schematic view from this hour's data, not a camera",
    aria: name => `Wave and wind motion over the shoreline of ${name}`,
    noData: 'No data for this hour',
  },
  de: {
    caption: 'Schema aus den Daten dieser Stunde, keine Kamera',
    aria: name => `Wellen- und Windbewegung über der Küstenlinie von ${name}`,
    noData: 'Keine Daten für diese Stunde',
  },
  fr: {
    caption: "Schéma d'après les données de l'heure, pas une caméra",
    aria: name => `Mouvement de la houle et du vent sur le littoral de ${name}`,
    noData: 'Pas de données pour cette heure',
  },
  it: {
    caption: "Schema dai dati dell'ora, non una telecamera",
    aria: name => `Movimento di onda e vento sulla costa di ${name}`,
    noData: 'Nessun dato per questa ora',
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
    className={`h-3 w-3 shrink-0 ${className}`}
    style={{ transform: `rotate(${rotateDeg}deg)` }}
    aria-hidden="true"
  >
    <path d="M6 1.2 L6 10.8 M2.6 4.6 L6 1.2 L9.4 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Πού είναι ο Βορράς. Το σχήμα κοιτά τη θάλασσα προς τα πάνω, οπότε ο Βορράς γυρίζει κατά
 * -facingDeg· η βελόνα γυρίζει, το γράμμα μένει όρθιο στη μύτη της.
 */
const CompassMark: React.FC<{ facingDeg: number }> = ({ facingDeg }) => {
  const rad = (-facingDeg * Math.PI) / 180;
  const tipX = 11 + 6.2 * Math.sin(rad);
  const tipY = 11 - 6.2 * Math.cos(rad);
  const labelX = 11 + 9.6 * Math.sin(rad);
  const labelY = 11 - 9.6 * Math.cos(rad);
  return (
    <svg
      viewBox="0 0 22 22"
      className="absolute bottom-1 left-1 h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.6" fill="rgba(255,255,255,0.85)" />
      <path d={`M11 11 L${tipX.toFixed(2)} ${tipY.toFixed(2)}`} stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="11" r="1.2" fill="#334155" />
      <text x={labelX.toFixed(2)} y={labelY.toFixed(2)} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="900" fill="#334155">N</text>
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

const BeachSeaMotionScene: React.FC<BeachSeaMotionSceneProps> = ({ item, language, windFromDeg, windSpeedKmh }) => {
  const beach = item.beach;
  const shape: ShorelineShape | undefined = useShorelineShape(beach.regionId, beach.sourceBeachId ?? beach.id);
  const copy = sceneCopy[language] ?? sceneCopy.en;
  const beachName = item.name || beach.name[language] || beach.name.en;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streaksRef = useRef<Streak[]>([]);
  const motionRef = useRef<Motion | null>(null);

  const pointsKey = shape?.points ?? FALLBACK_POINTS;
  /**
   * 3D πρώτα· αν το WebGL λείπει ή σκάσει, ένας ΝΕΟΣ καμβάς (το key) πέφτει στον 2D ζωγράφο —
   * ένας καμβάς που δοκίμασε WebGL δεν δίνει πια 2D context, γι' αυτό ξαναγεννιέται.
   */
  const [mode, setMode] = useState<'3d' | '2d'>('3d');

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const points = parsePoints(pointsKey);

    let gl: SeaMotionGl | null = null;
    let draw2d: ((tSec: number, dtSec: number) => void) | null = null;

    if (mode === '3d') {
      try {
        gl = createSeaMotionGl(canvas, points, beach.id);
      } catch {
        gl = null;
      }
      if (!gl) {
        setMode('2d');
        return undefined;
      }
    } else {
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
        if (gl) gl.render(motion, (now - start) / 1000, dt);
        else if (draw2d) draw2d((now - start) / 1000, dt);
        if (performance.now() - began > 14) {
          slowFrames += 1;
          if (slowFrames >= 8) minInterval = 48;
        }
      }
      last = now;
    };

    if (reduceMotion) {
      // Μία ακίνητη εικόνα: η γεωμετρία, οι κορυφές και ο αφρός χωρίς κίνηση.
      draw(start);
      return () => gl?.dispose();
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
      gl?.dispose();
    };
  }, [pointsKey, beach.id, mode]);

  const hasWind = typeof windSpeedKmh === 'number' && Number.isFinite(windSpeedKmh) && typeof windFromDeg === 'number';
  const showWaveChip = typeof openWaveM === 'number' && Number.isFinite(openWaveM);
  const waveArrowFrom = waveFromDeg ?? windFromDeg ?? facingDeg;

  return (
    <div className="mt-1">
      <div
        className="relative h-[6.75rem] w-full overflow-hidden rounded-lg bg-sky-100"
        role="img"
        aria-label={copy.aria(beachName)}
      >
        {/* Νέος καμβάς και όταν αλλάζει το σχήμα: το καθάρισμα του προηγούμενου χάνει ρητά το
            WebGL context, και ένας καμβάς με χαμένο context δεν ξαναζωγραφίζει ποτέ. */}
        <canvas key={`${mode}:${pointsKey}`} ref={canvasRef} width={PW} height={PH} className="block h-full w-full" />

        {hasWind && (
          <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-white/85 px-1 py-0.5 text-[9px] font-black leading-none text-slate-700 shadow-sm">
            <Wind className="h-3 w-3 shrink-0 text-cyan-800" aria-hidden="true" />
            <ArrowGlyph rotateDeg={(windFromDeg as number) + 180 - facingDeg} className="text-cyan-800" />
            <span>{Math.round(windSpeedKmh as number)} km/h</span>
          </div>
        )}

        {showWaveChip && (
          <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-white/85 px-1 py-0.5 text-[9px] font-black leading-none text-slate-700 shadow-sm">
            <Waves className="h-3 w-3 shrink-0 text-sky-700" aria-hidden="true" />
            <ArrowGlyph rotateDeg={waveArrowFrom + 180 - facingDeg} className="text-sky-700" />
            <span>
              {formatMetres(language, openWaveM as number)}
              {typeof shoreWaveM === 'number' && Math.abs(shoreWaveM - (openWaveM as number)) >= 0.05
                ? ` → ~${formatMetres(language, shoreWaveM)}`
                : ''}
            </span>
          </div>
        )}

        {!hasWind && !showWaveChip && (
          <div className="absolute inset-x-0 top-1 mx-auto w-fit rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-black leading-none text-slate-600">
            {copy.noData}
          </div>
        )}

        {hasFacing && <CompassMark facingDeg={facingDeg} />}
      </div>
      <p className="mt-0.5 text-[8.5px] font-semibold leading-tight text-slate-500">{copy.caption}</p>
    </div>
  );
};

export default BeachSeaMotionScene;

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudSun, Maximize2, Moon, Pause, Play, Sun, Volume2, VolumeX, Waves, Wind, X } from 'lucide-react';
import type { Beach, LanguageCode, SuitableBeach } from '../types';
import { SHORELINE_BOX, type ShorelineShape } from '../services/shorelineShapeService';
import { deriveShorelineFeatures, useShorelineShape } from './ShorelineThumbnail';
import { sunPosition } from '../utils/sunPosition';
import { startSeaSound, type SeaSound } from '../utils/seaSound';
import { loadSatelliteMosaic, type SatelliteMosaic } from '../services/satelliteMosaic';
import { toAthensWallClock } from '../utils/athensTime';
import { alignmentKind, approachKind, createSeaMotionGl, deriveMotion, smoothMotion, type AlignmentKind, type ApproachKind, type SeaMotionGl, type SeaMotionLook, type SeaMotionParams } from '../utils/seaMotionGl';
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
  /** Η ώρα που δείχνει ο χάρτης (unix δευτερόλεπτα). Χωρίς αυτήν: τώρα. Δίνει τον ήλιο. */
  atDt?: number | null;
  /**
   * Οι ώρες της ημέρας για το «παίξε τη μέρα»: ΠΕΡΙΟΧΗΣ (το ίδιο σημείο πρόγνωσης με την μπάρα
   * της ώρας), όχι της παραλίας. Η σκηνή κλιμακώνει το κύμα της ακτής με τον λόγο ακτή/ανοιχτά
   * της τρέχουσας ώρας και το λέει με «~».
   */
  hourSeries?: SceneHour[];
};

export type SceneHour = {
  dt: number;
  windKmh?: number;
  windFromDeg?: number;
  waveM?: number;
  waveFromDeg?: number;
  periodS?: number;
  /** 0..1 */
  cloudCover?: number;
};

/* --------------------------------------------------------------- copy */

type SceneCopy = {
  aria: (name: string) => string;
  noData: string;
  expand: string;
  close: string;
  wind: string;
  sea: string;
  shore: string;
  playDay: string;
  stopDay: string;
  soundOn: string;
  soundOff: string;
  region: string;
  /** Ως πού φτάνει το νερό σε έναν άνθρωπο 1,75 μ. */
  reach: (level: 'ankle' | 'knee' | 'waist' | 'chest' | 'neck' | 'over') => string;
  night: string;
  /** Πώς πέφτει το κύμα στην ακτή (γεωμετρία διεύθυνσης προς προσανατολισμό). */
  approach: (kind: ApproachKind) => string;
  /** Άνεμος σε σχέση με το κύμα. */
  alignment: (kind: AlignmentKind) => string;
  /** Η πυξίδα κατευθύνσεων, για τον αναγνώστη οθόνης. */
  rose: string;
  /** Το σύρσιμο για να κοιτάξεις γύρω. */
  look: string;
};

const approachGr = { direct: 'κύμα κατά μέτωπο', oblique: 'κύμα λοξά', parallel: 'κύμα παράλληλα στην ακτή', offshore: 'κύμα από τη στεριά' } as const;
const approachEn = { direct: 'waves head-on', oblique: 'waves at an angle', parallel: 'waves along the shore', offshore: 'waves from the land' } as const;
const approachDe = { direct: 'Wellen frontal', oblique: 'Wellen schräg', parallel: 'Wellen längs der Küste', offshore: 'Wellen vom Land' } as const;
const approachFr = { direct: 'houle de face', oblique: 'houle en biais', parallel: 'houle le long du rivage', offshore: 'houle venant de la terre' } as const;
const approachIt = { direct: 'onde frontali', oblique: 'onde oblique', parallel: 'onde lungo la riva', offshore: 'onde da terra' } as const;
const alignGr = { aligned: 'άνεμος μαζί με το κύμα', crossed: 'άνεμος σταυρωτά στο κύμα', against: 'άνεμος κόντρα στο κύμα' } as const;
const alignEn = { aligned: 'wind with the waves', crossed: 'wind across the waves', against: 'wind against the waves' } as const;
const alignDe = { aligned: 'Wind mit den Wellen', crossed: 'Wind quer zu den Wellen', against: 'Wind gegen die Wellen' } as const;
const alignFr = { aligned: 'vent avec la houle', crossed: 'vent en travers de la houle', against: 'vent contre la houle' } as const;
const alignIt = { aligned: 'vento con le onde', crossed: 'vento di traverso alle onde', against: 'vento contro le onde' } as const;

const reachGr = { ankle: 'ως τον αστράγαλο', knee: 'ως το γόνατο', waist: 'ως τη μέση', chest: 'ως το στήθος', neck: 'ως τον λαιμό', over: 'πάνω από το κεφάλι' } as const;
const reachEn = { ankle: 'ankle-deep', knee: 'knee-high', waist: 'waist-high', chest: 'chest-high', neck: 'neck-high', over: 'overhead' } as const;
const reachDe = { ankle: 'knöcheltief', knee: 'kniehoch', waist: 'hüfthoch', chest: 'brusthoch', neck: 'halshoch', over: 'über Kopf' } as const;
const reachFr = { ankle: 'aux chevilles', knee: 'aux genoux', waist: 'à la taille', chest: 'à la poitrine', neck: 'au cou', over: 'au-dessus de la tête' } as const;
const reachIt = { ankle: 'alla caviglia', knee: 'al ginocchio', waist: 'alla vita', chest: 'al petto', neck: 'al collo', over: 'sopra la testa' } as const;

const sceneCopy: Record<LanguageCode, SceneCopy> = {
  gr: {
    aria: name => `Κίνηση κύματος και ανέμου πάνω στην ακτογραμμή της παραλίας ${name}`,
    noData: 'Χωρίς δεδομένα ώρας',
    expand: 'Άνοιξε σε πλήρη οθόνη',
    close: 'Κλείσε την πλήρη οθόνη',
    wind: 'ΑΝΕΜΟΣ',
    sea: 'ΘΑΛΑΣΣΑ',
    shore: 'ΑΚΤΗ',
    playDay: 'Παίξε τη μέρα',
    stopDay: 'Σταμάτα',
    soundOn: 'Άνοιξε τον ήχο',
    soundOff: 'Κλείσε τον ήχο',
    region: 'περιοχή',
    reach: level => reachGr[level],
    night: 'νύχτα',
    approach: kind => approachGr[kind],
    alignment: kind => alignGr[kind],
    rose: 'Πυξίδα: από πού έρχονται κύμα και άνεμος σε σχέση με την ακτή',
    look: 'Σύρε για να κοιτάξεις γύρω',
  },
  en: {
    aria: name => `Wave and wind motion over the shoreline of ${name}`,
    noData: 'No data for this hour',
    expand: 'Open full screen',
    close: 'Close full screen',
    wind: 'WIND',
    sea: 'SEA',
    shore: 'SHORE',
    playDay: 'Play the day',
    stopDay: 'Stop',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    region: 'region',
    reach: level => reachEn[level],
    night: 'night',
    approach: kind => approachEn[kind],
    alignment: kind => alignEn[kind],
    rose: 'Compass: where waves and wind come from, relative to the shore',
    look: 'Drag to look around',
  },
  de: {
    aria: name => `Wellen- und Windbewegung über der Küstenlinie von ${name}`,
    noData: 'Keine Daten für diese Stunde',
    expand: 'Vollbild öffnen',
    close: 'Vollbild schließen',
    wind: 'WIND',
    sea: 'SEE',
    shore: 'UFER',
    playDay: 'Tag abspielen',
    stopDay: 'Stopp',
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    region: 'Region',
    reach: level => reachDe[level],
    night: 'Nacht',
    approach: kind => approachDe[kind],
    alignment: kind => alignDe[kind],
    rose: 'Kompass: woher Wellen und Wind kommen, relativ zum Ufer',
    look: 'Ziehen, um sich umzusehen',
  },
  fr: {
    aria: name => `Mouvement de la houle et du vent sur le littoral de ${name}`,
    noData: 'Pas de données pour cette heure',
    expand: 'Ouvrir en plein écran',
    close: 'Fermer le plein écran',
    wind: 'VENT',
    sea: 'MER',
    shore: 'RIVAGE',
    playDay: 'Jouer la journée',
    stopDay: 'Arrêter',
    soundOn: 'Activer le son',
    soundOff: 'Couper le son',
    region: 'région',
    reach: level => reachFr[level],
    night: 'nuit',
    approach: kind => approachFr[kind],
    alignment: kind => alignFr[kind],
    rose: 'Boussole : d’où viennent houle et vent par rapport au rivage',
    look: 'Glisser pour regarder autour',
  },
  it: {
    aria: name => `Movimento di onda e vento sulla costa di ${name}`,
    noData: 'Nessun dato per questa ora',
    expand: 'Apri a schermo intero',
    close: 'Chiudi schermo intero',
    wind: 'VENTO',
    sea: 'MARE',
    shore: 'RIVA',
    playDay: 'Riproduci la giornata',
    stopDay: 'Ferma',
    soundOn: 'Attiva audio',
    soundOff: 'Disattiva audio',
    region: 'zona',
    reach: level => reachIt[level],
    night: 'notte',
    approach: kind => approachIt[kind],
    alignment: kind => alignIt[kind],
    rose: 'Bussola: da dove arrivano onde e vento rispetto alla riva',
    look: 'Trascina per guardarti intorno',
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
 * Η ΠΥΞΙΔΑ ΚΑΤΕΥΘΥΝΣΕΩΝ: το ρολόι της σκηνής. Η ακτή είναι η άμμος στο κάτω μέρος του δίσκου
 * (η παραλία «κοιτά» προς τα πάνω, όπως όλη η σκηνή), το κύμα ένα παχύ βέλος που μπαίνει από
 * την άκρη προς το κέντρο, ο άνεμος ένα λεπτό, και ο Βορράς ένα γράμμα στο χείλος. Έτσι, χωρίς
 * αριθμούς, φαίνεται αν το κύμα έρχεται κατά μέτωπο (από πάνω), λοξά, ή παράλληλα στην ακτή
 * (από τα πλάγια) — και αν ο άνεμος πάει μαζί του ή κόντρα.
 */
const DirectionRose: React.FC<{ facingDeg: number; windFromDeg?: number; waveFromDeg?: number; size: number; label?: string }> = ({ facingDeg, windFromDeg, waveFromDeg, size, label }) => {
  const rad = (-facingDeg * Math.PI) / 180;
  const labelX = 16 + 12.4 * Math.sin(rad);
  const labelY = 16 - 12.4 * Math.cos(rad);
  // Ένα βέλος «από» τη διεύθυνση fromDeg προς το κέντρο: σχεδιάζεται σαν να έρχεται από πάνω
  // και γυρίζει ολόκληρο κατά (fromDeg - facingDeg).
  const arrow = (fromDeg: number, color: string, width: number, len: number, head: number) => (
    <g transform={`rotate(${(fromDeg - facingDeg).toFixed(1)} 16 16)`}>
      <path d={`M16 ${(16 - 13.2).toFixed(1)} L16 ${(16 - 13.2 + len).toFixed(1)}`} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${(16 - head).toFixed(1)} ${(16 - 13.2 + len - head * 1.2).toFixed(1)} L16 ${(16 - 13.2 + len + head * 0.4).toFixed(1)} L${(16 + head).toFixed(1)} ${(16 - 13.2 + len - head * 1.2).toFixed(1)} Z`} fill={color} />
    </g>
  );
  return (
    <svg viewBox="0 0 32 32" style={{ width: size, height: size }} className="shrink-0" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="16" cy="16" r="14.5" fill="rgba(2,12,22,0.6)" stroke="rgba(103,232,249,0.45)" strokeWidth="0.8" />
      {/* Η άμμος: το κάτω τμήμα του δίσκου, με τη γραμμή του νερού. */}
      <path d="M2.8 22 A14.5 14.5 0 0 0 29.2 22 Z" fill="rgba(226,201,150,0.5)" />
      <path d="M2.8 22 L29.2 22" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />
      <circle cx="16" cy="16" r="13.2" fill="none" stroke="rgba(103,232,249,0.18)" strokeWidth="0.5" strokeDasharray="1 2.3" />
      {typeof windFromDeg === 'number' && arrow(windFromDeg, '#67e8f9', 1.1, 7.5, 1.6)}
      {typeof waveFromDeg === 'number' && arrow(waveFromDeg, '#bfdbfe', 2.2, 9.5, 2.4)}
      <circle cx="16" cy="16" r="1.1" fill="#f8fafc" />
      <text x={labelX.toFixed(2)} y={labelY.toFixed(2)} textAnchor="middle" dominantBaseline="central" fontSize="5.6" fontWeight="900" fill="#fda4af">N</text>
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
const makeBoxToLatLon = (shape: ShorelineShape, lat: number, lon: number) => {
  const metresPerUnit = shape.frameWidthM / SHORELINE_BOX.width;
  const theta = (shape.facingDeg * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const originE = shape.pinDistanceM * sin;
  const originN = shape.pinDistanceM * cos;
  return (x: number, y: number): [number, number] => {
    const cross = (x - SHORELINE_BOX.pinX) * metresPerUnit;
    const along = (SHORELINE_BOX.pinY - y) * metresPerUnit;
    const east = cross * cos + along * sin + originE;
    const north = -cross * sin + along * cos + originN;
    return [lat + north / mPerLat, lon + east / mPerLon];
  };
};

const makeReliefSampler = (grid: BeachReliefGrid, shape: ShorelineShape, lat: number, lon: number) => {
  const toLatLon = makeBoxToLatLon(shape, lat, lon);
  return (x: number, y: number): number | null => {
    const [plat, plon] = toLatLon(x, y);
    return grid.sample(plat, plon);
  };
};

/** Ως πού φτάνει το νερό σε άνθρωπο 1,75 μ. — ο πιο απλός τρόπος να διαβαστεί ένα ύψος. */
const reachLevel = (metres: number): 'ankle' | 'knee' | 'waist' | 'chest' | 'neck' | 'over' =>
  metres < 0.25 ? 'ankle' : metres < 0.55 ? 'knee' : metres < 1.0 ? 'waist' : metres < 1.4 ? 'chest' : metres < 1.7 ? 'neck' : 'over';

const athensHourLabel = (dt: number) => {
  const wall = toAthensWallClock(new Date(dt * 1000));
  return `${String(wall.getHours()).padStart(2, '0')}:00`;
};

/** Σιλουέτα 1,75 μ. με τη στάθμη του νερού της ακτής πάνω της. */
const PersonScale: React.FC<{ metres: number; size: number }> = ({ metres, size }) => {
  const level = Math.max(0, Math.min(1, metres / 1.75));
  const waterY = 30 - level * 28;
  return (
    <svg viewBox="0 0 16 32" style={{ width: size * 0.5, height: size }} className="shrink-0" aria-hidden="true">
      <rect x="0" y={waterY} width="16" height={32 - waterY} fill="rgba(103,232,249,0.35)" />
      {/* Σιλουέτα: κεφάλι, ώμοι, χέρια ανοιχτά, πόδια — όχι κουτιά. */}
      <circle cx="8" cy="3.6" r="2.6" fill="#f1f5f9" />
      <path d="M8 6.6 C5.4 6.6 4.2 8.2 4 10.2 L2.2 16.4 L3.6 16.9 L5.1 12.2 L5.1 19 L5.6 31 L7.4 31 L8 21.5 L8.6 31 L10.4 31 L10.9 19 L10.9 12.2 L12.4 16.9 L13.8 16.4 L12 10.2 C11.8 8.2 10.6 6.6 8 6.6 Z" fill="#f1f5f9" />
      <path d={`M0 ${waterY} H16`} stroke="#67e8f9" strokeWidth="1.2" />
    </svg>
  );
};

type SceneViewProps = {
  item: SuitableBeach;
  language: LanguageCode;
  windFromDeg?: number;
  windSpeedKmh?: number;
  shape: ShorelineShape | undefined;
  relief: BeachReliefGrid | undefined;
  mosaic: SatelliteMosaic | null;
  mosaicNear: SatelliteMosaic | null;
  atDt?: number | null;
  hourSeries?: SceneHour[];
  variant: 'popup' | 'full';
  onExpand?: () => void;
  onClose?: () => void;
};

/**
 * Η ίδια σκηνή σε δύο μεγέθη: μέσα στο ταμπελάκι (216 px) και σε πλήρη οθόνη. Ο καμβάς
 * παίρνει την ανάλυση της οθόνης στο μεγάλο (ως 1,5× για να μη ζεσταίνει το κινητό), τα HUD
 * μεγαλώνουν, ο ζωγράφος είναι ο ίδιος.
 */
const SceneView: React.FC<SceneViewProps> = ({ item, language, windFromDeg, windSpeedKmh, shape, relief, mosaic, mosaicNear, atDt, hourSeries, variant, onExpand, onClose }) => {
  const beach = item.beach;
  const copy = sceneCopy[language] ?? sceneCopy.en;
  const beachName = item.name || beach.name[language] || beach.name.en;
  const full = variant === 'full';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streaksRef = useRef<Streak[]>([]);
  const motionRef = useRef<Motion | null>(null);
  // Το σύρσιμο του θεατή: πού θέλει να κοιτάξει (μοίρες) και αν κρατά ακόμα το δάχτυλο.
  const lookRef = useRef({ yawDeg: 0, pitchDeg: 0, dragging: false, pointerId: -1, x0: 0, y0: 0, yaw0: 0, pitch0: 0 });
  const onLookStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Να μη σύρει τον χάρτη από κάτω (το popup του Leaflet).
    e.stopPropagation();
    const d = lookRef.current;
    d.dragging = true;
    d.pointerId = e.pointerId;
    d.x0 = e.clientX;
    d.y0 = e.clientY;
    d.yaw0 = d.yawDeg;
    d.pitch0 = d.pitchDeg;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* παλιά WebView */ }
  };
  const onLookMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = lookRef.current;
    if (!d.dragging || e.pointerId !== d.pointerId) return;
    const w = Math.max(200, e.currentTarget.clientWidth);
    // Όλο το πλάτος της οθόνης = 90° στροφή· όριο ±50° ώστε να μη γυρίσει πλάτη στη θάλασσα.
    d.yawDeg = Math.max(-50, Math.min(50, d.yaw0 + ((e.clientX - d.x0) / w) * 90));
    d.pitchDeg = Math.max(-12, Math.min(16, d.pitch0 - ((e.clientY - d.y0) / w) * 60));
  };
  const onLookEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = lookRef.current;
    if (e.pointerId !== d.pointerId) return;
    d.dragging = false;
    d.pointerId = -1;
  };

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

  const baseWaveFromDeg = item.marine?.waveDirectionDeg ?? item.marine?.swellWaveDirectionDeg;
  const baseOpenWaveM = item.seaStateWaveM ?? item.waveHeightM;
  const baseShoreWaveM = item.shoreDisplayWaveM ?? item.shoreWaveHeightM ?? baseOpenWaveM;
  const basePeriodS = item.seaStatePeriodS ?? item.marine?.wavePeriodS ?? 5;
  const metresPerUnit = shape?.frameWidthM ? shape.frameWidthM / SHORELINE_BOX.width : 5;

  const beachLat = beach.coordinates?.lat;
  const beachLon = beach.coordinates?.lon;

  /**
   * «ΠΑΙΞΕ ΤΗ ΜΕΡΑ»: διατρέχει τις ώρες 07:00–21:00 (Αθήνα) της ημέρας του χάρτη, ~1 s η
   * καθεμιά. Οι τιμές είναι της ΠΕΡΙΟΧΗΣ (το σημείο της μπάρας της ώρας)· το κύμα της ακτής
   * κλιμακώνεται με τον λόγο ακτή/ανοιχτά της ώρας που δείχνει ο χάρτης, γι' αυτό «~».
   */
  const dayHours = React.useMemo(() => {
    if (!hourSeries || hourSeries.length === 0) return [] as SceneHour[];
    const anchor = typeof atDt === 'number' ? atDt : hourSeries[0].dt;
    const anchorDay = toAthensWallClock(new Date(anchor * 1000)).getDate();
    return hourSeries.filter(h => {
      const wall = toAthensWallClock(new Date(h.dt * 1000));
      return wall.getDate() === anchorDay && wall.getHours() >= 7 && wall.getHours() <= 21;
    });
  }, [hourSeries, atDt]);
  const [dayPlaying, setDayPlaying] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  useEffect(() => {
    if (!dayPlaying || dayHours.length === 0) return undefined;
    const id = window.setInterval(() => setDayIndex(i => (i + 1) % dayHours.length), 1000);
    return () => window.clearInterval(id);
  }, [dayPlaying, dayHours.length]);
  const playedHour = dayPlaying && dayHours.length > 0 ? dayHours[Math.min(dayIndex, dayHours.length - 1)] : null;
  const shoreRatio = typeof baseOpenWaveM === 'number' && baseOpenWaveM > 0.05 && typeof baseShoreWaveM === 'number'
    ? baseShoreWaveM / baseOpenWaveM
    : 1;

  const effWindFromDeg = playedHour ? playedHour.windFromDeg : windFromDeg;
  const effWindKmh = playedHour ? playedHour.windKmh : windSpeedKmh;
  const effWaveFromDeg = playedHour ? (playedHour.waveFromDeg ?? baseWaveFromDeg) : baseWaveFromDeg;
  const effOpenWaveM = playedHour ? playedHour.waveM : baseOpenWaveM;
  const effShoreWaveM = playedHour
    ? (typeof playedHour.waveM === 'number' ? playedHour.waveM * shoreRatio : undefined)
    : baseShoreWaveM;
  const effPeriodS = playedHour ? (playedHour.periodS ?? basePeriodS) : basePeriodS;
  const effDt = playedHour ? playedHour.dt : atDt;

  // Η ΩΡΑ ΤΟΥ ΗΛΙΟΥ. Απόλυτος χρόνος (UTC) — ο ήλιος δεν ξέρει από ώρα τοίχου.
  const sun = React.useMemo(() => {
    if (typeof beachLat !== 'number' || typeof beachLon !== 'number') return null;
    // athens-clock-exempt: ο ήλιος θέλει την απόλυτη στιγμή (UTC), όχι την ώρα τοίχου Αθήνας.
    const instant = typeof effDt === 'number' ? new Date(effDt * 1000) : new Date();
    return { ...sunPosition(instant, beachLat, beachLon), instant };
  }, [effDt, beachLat, beachLon]);
  const currentHour = React.useMemo(() => {
    if (!hourSeries || typeof effDt !== 'number') return undefined;
    let best: SceneHour | undefined;
    for (const h of hourSeries) if (!best || Math.abs(h.dt - effDt) < Math.abs(best.dt - effDt)) best = h;
    return best;
  }, [hourSeries, effDt]);
  const cloudCover = playedHour?.cloudCover ?? currentHour?.cloudCover ?? 0.1;

  // ΤΟ ΧΡΩΜΑ ΤΟΥ ΝΕΡΟΥ ΑΠΟ ΤΟ ΒΑΘΟΣ ΤΗΣ ΠΑΡΑΛΙΑΣ: ρηχή → πλατιά τιρκουάζ ζώνη, βαθιά → στενή.
  const shallowReach = React.useMemo(() => {
    const depth = deriveShorelineFeatures(beach).depth;
    return depth === 'shallow' ? 180 : depth === 'deep' ? 40 : 110;
  }, [beach]);

  motionRef.current = {
    facingDeg,
    windFromDeg: effWindFromDeg,
    windSpeedKmh: effWindKmh,
    waveFromDeg: effWaveFromDeg,
    openWaveM: effOpenWaveM,
    shoreWaveM: effShoreWaveM,
    periodS: Math.min(14, Math.max(2.5, effPeriodS)),
    metresPerUnit,
    sunAzimuthDeg: sun?.azimuthDeg,
    sunElevationDeg: sun?.elevationDeg,
    cloudCover,
    shallowReach,
  };

  // Ο ΗΧΟΣ: μόνο με πάτημα, σβήνει με τη σκηνή. Παίρνει τα ίδια νούμερα με την εικόνα.
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef<SeaSound | null>(null);
  useEffect(() => {
    if (!soundOn) {
      soundRef.current?.stop();
      soundRef.current = null;
      return undefined;
    }
    const m = motionRef.current;
    const levels = {
      sea: Math.min(1, (m?.shoreWaveM ?? m?.openWaveM ?? 0) / 1.4),
      wind: Math.min(1, (m?.windSpeedKmh ?? 0) / 45),
      periodS: m?.periodS ?? 5,
    };
    soundRef.current = startSeaSound(levels);
    return () => {
      soundRef.current?.stop();
      soundRef.current = null;
    };
  }, [soundOn]);
  useEffect(() => {
    const m = motionRef.current;
    soundRef.current?.update({
      sea: Math.min(1, (m?.shoreWaveM ?? m?.openWaveM ?? 0) / 1.4),
      wind: Math.min(1, (m?.windSpeedKmh ?? 0) / 45),
      periodS: m?.periodS ?? 5,
    });
  }, [effWindKmh, effOpenWaveM, effShoreWaveM, effPeriodS]);
  const geometryKey = [
    mode,
    full ? 'full' : 'popup',
    beach.id,
    pointsKey,
    shape ? `${shape.facingDeg}|${shape.frameWidthM}|${shape.pinDistanceM}` : 'noshape',
    relief ? `${relief.lat0}|${relief.lon0}|${relief.rows}x${relief.cols}` : 'norelief',
    mosaic ? `sat${mosaic.canvas.width}x${mosaic.canvas.height}` : 'nosat',
    mosaicNear ? `near${mosaicNear.canvas.width}x${mosaicNear.canvas.height}` : 'nonear',
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
    let draw2d: ((motion: Motion, tSec: number, dtSec: number) => void) | null = null;

    // Ανάλυση = μέγεθος στην οθόνη × πυκνότητα pixel (ταβάνι 2 στο ταμπελάκι, 1,5 στην πλήρη οθόνη).
    const rect = canvas.getBoundingClientRect();
    const dprCap = full ? 1.5 : 2;
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const baseW = rect.width > 0 ? Math.round(rect.width * dpr) : PW;
    const baseH = rect.height > 0 ? Math.round(rect.height * dpr) : PH;

    if (mode === '3d') {
      canvas.width = baseW;
      canvas.height = baseH;
      const hasCoords = Boolean(shape) && typeof beachLat === 'number' && typeof beachLon === 'number';
      const sampler = relief && shape && hasCoords ? makeReliefSampler(relief, shape, beachLat as number, beachLon as number) : undefined;
      let satelliteUv: ((x: number, y: number) => [number, number] | null) | undefined;
      let satelliteUvNear: ((x: number, y: number) => [number, number] | null) | undefined;
      if (shape && hasCoords) {
        const toLatLon = makeBoxToLatLon(shape, beachLat as number, beachLon as number);
        if (mosaic) {
          satelliteUv = (x, y) => {
            const [plat, plon] = toLatLon(x, y);
            return mosaic.toUv(plat, plon);
          };
        }
        if (mosaicNear) {
          satelliteUvNear = (x, y) => {
            const [plat, plon] = toLatLon(x, y);
            return mosaicNear.toUv(plat, plon);
          };
        }
      }
      try {
        gl = createSeaMotionGl(canvas, points, beach.id, { grid: full ? 0.07 : 0.09, relief: sampler, metresPerUnit, satelliteUv, satelliteUvNear });
        if (gl && mosaic && satelliteUv) gl.setSatellite(mosaic.canvas);
        if (gl && mosaicNear && satelliteUvNear) gl.setSatellite(mosaicNear.canvas, true);
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
      draw2d = (motion, tSec, dtSec) => {
        renderFrame(ctx, image, field, motion, tSec, streaksRef.current, dtSec);
      };
    }

    const reduceMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    let frame = 0;
    let last = performance.now();
    const start = last;
    /**
     * ΟΜΑΛΟΤΗΤΑ = ΣΤΑΘΕΡΑ 60 ΚΑΡΕ, ΟΧΙ ΣΤΑΘΕΡΗ ΑΝΑΛΥΣΗ (Μίλτος, 03/09/2026: «smooth πολύ»).
     * Αντί να κόβουμε καρέ (που φαίνεται σαν κόμπιασμα), μετράμε τον ρυθμό των καρέ: αν πέσει
     * κάτω από ~42 fps για μισό δευτερόλεπτο, η ανάλυση του καμβά πέφτει ένα σκαλί (×0,8, ως
     * 0,45×)· αν κρατάει άνετα 60 για τρία δευτερόλεπτα, ανεβαίνει πάλι. Η κάμερα και το νερό
     * κινούνται πάντα με τον πραγματικό χρόνο, όχι ανά καρέ.
     */
    let scale = 1;
    let interval = 16;
    let stableFrames = 0;
    let pendingResize = false;
    const resample = () => {
      // Η αλλαγή μεγέθους ΑΔΕΙΑΖΕΙ τον καμβά· γίνεται στην αρχή του επόμενου καρέ, ακριβώς
      // πριν ζωγραφιστεί, ώστε η οθόνη να μη δείξει ποτέ κενό ανάμεσα.
      pendingResize = true;
      stableFrames = 0;
      if (import.meta.env.DEV) console.debug(`[seaMotion] scale ${scale.toFixed(2)} (${Math.round(interval)} ms/frame)`);
    };

    // Τα νούμερα που ΔΕΙΧΝΟΥΜΕ πλησιάζουν ομαλά αυτά που ήρθαν (smoothMotion), και το βλέμμα
    // ακολουθεί το δάχτυλο με λίγη αδράνεια και γυρίζει μόνο του στη θάλασσα όταν αφεθεί.
    let shown: Motion | null = null;
    const look: SeaMotionLook = { yawDeg: 0, pitchDeg: 0 };
    const draw = (now: number) => {
      const motion = motionRef.current;
      if (gl && pendingResize) {
        pendingResize = false;
        gl.setSize(baseW * scale, baseH * scale);
      }
      if (motion) {
        const dt = Math.min(0.1, (now - last) / 1000);
        shown = reduceMotion ? motion : smoothMotion(shown, motion, dt);
        // Σε reduced-motion η κάμερα στέκεται στην τελική της θέση (t μετά το fly-in).
        const t = reduceMotion ? 6 : (now - start) / 1000;
        const drag = lookRef.current;
        if (!drag.dragging) {
          const back = 1 - Math.exp(-dt / 1.6);
          drag.yawDeg -= drag.yawDeg * back;
          drag.pitchDeg -= drag.pitchDeg * back;
        }
        const follow = 1 - Math.exp(-dt / 0.18);
        look.yawDeg += (drag.yawDeg - look.yawDeg) * follow;
        look.pitchDeg += (drag.pitchDeg - look.pitchDeg) * follow;
        if (gl) gl.render(shown, t, dt, look);
        else if (draw2d) draw2d(shown, t, dt);
      }
      if (gl && !reduceMotion) {
        interval = interval * 0.9 + (now - last) * 0.1;
        stableFrames += 1;
        if (interval > 24 && scale > 0.45 && stableFrames > 30) {
          scale = Math.max(0.45, scale * 0.8);
          resample();
        } else if (interval < 17.5 && scale < 1 && stableFrames > 180) {
          scale = Math.min(1, scale * 1.2);
          resample();
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

  const windSpeedShown = effWindKmh;
  const windFromShown = effWindFromDeg;
  const openWaveM = effOpenWaveM;
  const shoreWaveM = effShoreWaveM;
  const hasWind = typeof windSpeedShown === 'number' && Number.isFinite(windSpeedShown) && typeof windFromShown === 'number';
  const showWaveChip = typeof openWaveM === 'number' && Number.isFinite(openWaveM);
  const waveArrowFrom = effWaveFromDeg ?? windFromShown ?? facingDeg;
  const shoreDiffers = typeof shoreWaveM === 'number' && typeof openWaveM === 'number' && Math.abs(shoreWaveM - openWaveM) >= 0.05;
  const approx = playedHour ? '~' : '';
  const reach = typeof shoreWaveM === 'number' ? reachLevel(shoreWaveM) : null;
  const isNight = sun ? sun.elevationDeg < -4 : false;
  const hourLabel = typeof effDt === 'number' ? athensHourLabel(effDt) : null;

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
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        title={copy.look}
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
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
              <ArrowGlyph rotateDeg={(windFromShown as number) + 180 - facingDeg} className={arrow} />
              <span>{approx}{Math.round(windSpeedShown as number)} km/h</span>
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
                  ? `${approx}${formatMetres(language, openWaveM as number)}${shoreDiffers ? ` → ~${formatMetres(language, shoreWaveM as number)}` : ''}`
                  : shoreDiffers
                    ? `${approx}${formatMetres(language, openWaveM as number).replace(' m', '')}→~${formatMetres(language, shoreWaveM as number)}`
                    : `${approx}${formatMetres(language, openWaveM as number)}`}
              </span>
            </div>
          ) : null}
          {/* Η ΚΛΙΜΑΚΑ ΤΟΥ ΑΝΘΡΩΠΟΥ: ως πού φτάνει το νερό της ακτής σε 1,75 μ. */}
          {reach && typeof shoreWaveM === 'number' && (
            <div className={chip}>
              <PersonScale metres={shoreWaveM} size={full ? 22 : 14} />
              <span className={chipLabel}>{copy.shore}</span>
              <span>{copy.reach(reach)}</span>
            </div>
          )}
          {/* Η ΩΡΑ ΚΑΙ Ο ΗΛΙΟΣ: πού είναι, ή νύχτα. Στο «παίξε τη μέρα» τρέχει. */}
          {full && hourLabel && sun && (
            <div className={chip}>
              {isNight ? <Moon className={icon} aria-hidden="true" /> : cloudCover > 0.5 ? <CloudSun className={icon} aria-hidden="true" /> : <Sun className={icon} aria-hidden="true" />}
              <span>{hourLabel}</span>
              <span className="opacity-70">{isNight ? copy.night : `☀ ${Math.round(sun.elevationDeg)}°`}</span>
              {playedHour && <span className={chipLabel}>{copy.region}</span>}
            </div>
          )}
          {/* Τι λέει η πυξίδα, με λόγια (μία γραμμή το καθένα): πώς πέφτει το κύμα, και ο άνεμος
              σε σχέση με το κύμα. */}
          {full && hasFacing && showWaveChip && (
            <div className={chip}>
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-200" aria-hidden="true" />
              <span>{copy.approach(approachKind(waveArrowFrom, facingDeg))}</span>
            </div>
          )}
          {full && hasFacing && showWaveChip && hasWind && (
            <div className={chip}>
              <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" />
              <span>{copy.alignment(alignmentKind(windFromShown as number, waveArrowFrom))}</span>
            </div>
          )}
        </div>
      </div>

      {!hasWind && !showWaveChip && (
        <div className={`pointer-events-none absolute inset-x-0 ${full ? 'top-16' : 'top-6'} mx-auto w-fit rounded border border-cyan-300/30 bg-slate-950/60 px-2 py-1 text-[10px] font-bold text-cyan-50`}>
          {copy.noData}
        </div>
      )}

      {/* Κάτω: πυξίδα αριστερά, σήμα BETA με παλλόμενη κουκκίδα και τα κουμπιά δεξιά. */}
      <div className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 ${edge}`}>
        <div className="pointer-events-none flex items-end gap-1.5">
          {hasFacing && <DirectionRose facingDeg={facingDeg} windFromDeg={hasWind ? windFromDeg : undefined} waveFromDeg={showWaveChip ? waveArrowFrom : undefined} size={full ? 60 : 30} label={copy.rose} />}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {full && mosaic && (
            <span className="pointer-events-none hidden whitespace-nowrap rounded bg-slate-950/50 px-1 py-0.5 text-[8px] text-cyan-100/70 sm:inline">{mosaic.attribution}</span>
          )}
          {dayHours.length > 1 && (
            <button
              type="button"
              onClick={() => { setDayPlaying(p => !p); setDayIndex(0); }}
              aria-pressed={dayPlaying}
              aria-label={dayPlaying ? copy.stopDay : copy.playDay}
              title={dayPlaying ? copy.stopDay : copy.playDay}
              className={`flex ${full ? 'h-8 gap-1.5 px-2.5 text-[10px]' : 'h-6 gap-1 px-1.5 text-[8px]'} cursor-pointer items-center whitespace-nowrap rounded border border-cyan-300/40 bg-slate-950/70 font-black tracking-[0.14em] text-cyan-100 transition hover:bg-slate-900`}
            >
              {dayPlaying ? <Pause className={full ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" /> : <Play className={full ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" />}
              {full ? (dayPlaying ? (hourLabel ?? copy.stopDay) : copy.playDay) : (dayPlaying ? hourLabel : null)}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSoundOn(s => !s)}
            aria-pressed={soundOn}
            aria-label={soundOn ? copy.soundOff : copy.soundOn}
            title={soundOn ? copy.soundOff : copy.soundOn}
            className={`flex ${full ? 'h-8 w-8' : 'h-6 w-6'} shrink-0 cursor-pointer items-center justify-center rounded border border-cyan-300/40 bg-slate-950/70 text-cyan-100 transition hover:bg-slate-900`}
          >
            {soundOn ? <Volume2 className={full ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" /> : <VolumeX className={full ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" />}
          </button>
          <span className={`pointer-events-none flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-cyan-300/30 bg-slate-950/60 ${full ? 'px-2 py-1 text-[10px]' : 'px-1 py-0.5 text-[7px]'} font-black tracking-[0.16em] text-cyan-200 backdrop-blur-sm`}>
            <span className={`${full ? 'h-1.5 w-1.5' : 'h-1 w-1'} animate-pulse rounded-full bg-cyan-300`} aria-hidden="true" />
            <span className="rounded bg-amber-300/90 px-1 text-slate-900">BETA</span>
          </span>
          {!full && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={copy.expand}
              title={copy.expand}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border border-cyan-300/40 bg-slate-950/70 text-cyan-100 transition hover:bg-slate-900"
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

/**
 * Η δορυφορική φωτογραφία της στεριάς — φτάνει όταν φτάσει (9–16 πλακίδια), και ως τότε η
 * σκηνή παίζει με την άμμο της. null = δεν ήρθε / δεν επιτράπηκε (CORS) — καμία διαφορά.
 */
const useSatelliteMosaic = (lat: number | undefined, lon: number | undefined, radiusM: number, zoom: number): SatelliteMosaic | null => {
  const [mosaic, setMosaic] = useState<SatelliteMosaic | null>(null);
  useEffect(() => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
    let active = true;
    loadSatelliteMosaic(lat, lon, radiusM, zoom).then(result => {
      if (active) setMosaic(result);
    });
    return () => {
      active = false;
    };
  }, [lat, lon, radiusM, zoom]);
  return mosaic;
};

const BeachSeaMotionScene: React.FC<BeachSeaMotionSceneProps> = ({ item, language, regionId, windFromDeg, windSpeedKmh, presentation = 'inline', onClose, atDt, hourSeries }) => {
  const beach = item.beach;
  const homeRegionId = beach.regionId ?? regionId;
  const shape: ShorelineShape | undefined = useShorelineShape(homeRegionId, beach.sourceBeachId ?? beach.id);
  const relief = useBeachRelief(homeRegionId);
  // Ευρεία εικόνα (1,2 χλμ, zoom 15) και κοντινή υψηλής ανάλυσης (350 μ., zoom 17): ~200–300 KB μαζί.
  const mosaic = useSatelliteMosaic(beach.coordinates?.lat, beach.coordinates?.lon, 1200, 15);
  const mosaicNear = useSatelliteMosaic(beach.coordinates?.lat, beach.coordinates?.lon, 350, 17);
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
        mosaic={mosaic}
        mosaicNear={mosaicNear}
        atDt={atDt}
        hourSeries={hourSeries}
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
        mosaic={mosaic}
        mosaicNear={mosaicNear}
        atDt={atDt}
        hourSeries={hourSeries}
        variant="popup"
        onExpand={() => setFullOpen(true)}
      />
      {mosaic && <p className="mt-0.5 text-[8.5px] font-semibold leading-tight text-slate-500">{mosaic.attribution}</p>}
      {fullOpen && typeof document !== 'undefined' && (
        <FullScreenScene
          item={item}
          language={language}
          windFromDeg={windFromDeg}
          windSpeedKmh={windSpeedKmh}
          shape={shape}
          relief={relief}
          mosaic={mosaic}
          mosaicNear={mosaicNear}
          atDt={atDt}
          hourSeries={hourSeries}
          onClose={() => setFullOpen(false)}
        />
      )}
    </div>
  );
};

export default BeachSeaMotionScene;

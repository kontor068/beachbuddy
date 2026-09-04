/**
 * Η ΠΑΡΑΛΙΑ ΣΕ ΚΙΝΗΣΗ — Ο 3D ΖΩΓΡΑΦΟΣ (WebGL, 03/09/2026, Μίλτος: «θέλω να είναι 3D γραφικά»).
 *
 * Ένα πλέγμα από ~58.000 κορυφές σκεπάζει το κουτί της ακτογραμμής (και πολύ παραέξω, ώστε η
 * θάλασσα να φτάνει ως τον ορίζοντα). Κάθε κορυφή ξέρει την ΑΠΟΣΤΑΣΗ της από την ακτογραμμή
 * (θετική στο νερό, αρνητική στη στεριά) και το κοντινότερο σημείο της ακτής. Ο vertex shader
 * σηκώνει το νερό με το ίδιο ακριβώς μαθηματικό του 2D ζωγράφου —διάθλαση προς την ακτή,
 * ύψος ανοιχτά vs στην ακτή, τσαλάκωση ανέμου με σκιά όταν φυσάει από τη στεριά— και σηκώνει
 * τη στεριά σε ήπιο ανάγλυφο. Ο fragment shader βγάζει τις κλίσεις (dFdx/dFdy) και φωτίζει:
 * ήλιος, γυαλάδα στις κορυφές, αφρός στη ζώνη που σπάει, ομίχλη προς τον ορίζοντα.
 *
 * ΓΙΑΤΙ ΓΥΜΝΟ WebGL ΚΑΙ ΟΧΙ three.js. Το three είναι ~150 KB συμπιεσμένο· εδώ είναι ~300
 * γραμμές, δύο shaders και τρεις buffers. Ο επισκέπτης που πατά play σε κινητό με δεδομένα
 * δεν πληρώνει τίποτα παραπάνω από το κομμάτι της σκηνής.
 *
 * ΧΩΡΙΣ WebGL (σπάνιο, ή σε παλιά WebView) η createSeaMotionGl επιστρέφει null και η σκηνή
 * πέφτει στον 2D ζωγράφο. Τίποτα δεν σπάει, απλώς δεν έχει βάθος.
 */

import { SHORELINE_BOX } from '../services/shorelineShapeService';

export type SeaMotionParams = {
  /** Το σχήμα κοιτά προς τα πάνω· αυτή είναι η μετεωρολογική διεύθυνση εκείνου του «πάνω». */
  facingDeg: number;
  windFromDeg?: number;
  windSpeedKmh?: number;
  waveFromDeg?: number;
  openWaveM?: number;
  shoreWaveM?: number;
  periodS: number;
  /** Μέτρα ανά μονάδα κουτιού — για να μεταφράσουμε την περίοδο σε απόσταση κορυφών. */
  metresPerUnit: number;
  /** Πού είναι ο ήλιος (utils/sunPosition). Χωρίς αυτά: ήλιος απογεύματος από τα δεξιά. */
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
  /** Νεφοκάλυψη 0..1 — πόσα σύννεφα στον ουρανό και πόσο θαμπός ο ήλιος. */
  cloudCover?: number;
  /** Ως πού (μονάδες) απλώνει το τιρκουάζ πριν το βαθύ μπλε — από το πεδίο βάθους της παραλίας. */
  shallowReach?: number;
};

export type Point = [number, number];

export type SeaMotionGl = {
  render: (params: SeaMotionParams, tSec: number, dtSec: number) => void;
  /** Αλλάζει την ανάλυση του καμβά (για την αυτόματη προσαρμογή όταν το κινητό αργεί). */
  setSize: (width: number, height: number) => void;
  /**
   * Δίνει τη δορυφορική φωτογραφία της στεριάς (services/satelliteMosaic), όταν φτάσει.
   * `near` = η υψηλής ανάλυσης για τα ~350 μ. γύρω από την παραλία, αλλιώς η ευρεία.
   */
  setSatellite: (source: TexImageSource | null, near?: boolean) => void;
  dispose: () => void;
};

/* ------------------------------------------------------------- shared */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Μετεωρολογικό «από πού» → μοναδιαίο «προς τα πού» στο κουτί (πάνω = θάλασσα). */
export const travelVector = (fromDeg: number, facingDeg: number): [number, number] => {
  const rel = ((fromDeg + 180 - facingDeg) * Math.PI) / 180;
  return [Math.sin(rel), -Math.cos(rel)];
};

/** 1 = ίσια από τη θάλασσα, -1 = πίσω από τη στεριά. */
export const seawardness = (fromDeg: number, facingDeg: number) =>
  Math.cos(((fromDeg - facingDeg) * Math.PI) / 180);

/**
 * Ύψος θάλασσας → ένταση 0..1,5, ΓΡΑΜΜΙΚΑ (1 = 1,6 μ.). Το ύψος στην οθόνη δεν το «μαγειρεύει»
 * πια κανένας εκθέτης: το κύμα σχεδιάζεται σε πραγματική κλίμακα μέτρων (WAVE_EXAGGERATION)
 * και η κάμερα στέκεται στο ύψος ανθρώπου — εκεί 0,3 μ. ΕΙΝΑΙ γλείψιμο και 1,5 μ. τοίχος
 * (Μίλτος, 03/09/2026, τέταρτη φορά: «στο μικρό κύμα κ πάνω πάλι τα έχεις να φαίνονται
 * μεγαλύτερα απ' ό,τι είναι»).
 */
export const heightToAmp = (h: number | undefined) =>
  typeof h === 'number' && Number.isFinite(h) ? Math.min(1.5, Math.max(0, h) / 1.6) : 0;

export const REFRACTION_UNITS = 38;
export const WIND_SHADOW_UNITS = 34;
/** Υπερβολή ύψους του ανάγλυφου: 1,25× — τα ελληνικά βουνά δίπλα στη θάλασσα είναι ήδη δραματικά. */
const RELIEF_EXAGGERATION = 1.25;
/** Ως πού απλώνει το πλέγμα (και η ομίχλη) όταν υπάρχει ανάγλυφο: απέναντι ακτές ως 16 χλμ. */
const RELIEF_REACH_M = 16000;
/**
 * ΠΡΑΓΜΑΤΙΚΗ ΚΛΙΜΑΚΑ, με μία κοινή μεγέθυνση 1,5× για ΟΛΑ τα κατακόρυφα κοντά στην ακτή: το
 * κύμα, τον άνθρωπο, την ομπρέλα, τις σταγόνες. Έτσι ο λόγος «κύμα προς άνθρωπο» μένει τίμιος
 * ό,τι κι αν δείχνει η οθόνη. Πριν, το 1 μ. κύματος ήταν 1 μονάδα κουτιού = 2–5 μ. στον χώρο,
 * και μάλιστα ως πλάτος (όχι μισό ύψος): 4–10× μεγαλύτερο από την πραγματικότητα — γι' αυτό
 * η ήρεμη θάλασσα έμοιαζε με φουσκοθαλασσιά όσο κι αν κατέβαινε ο εκθέτης.
 */
const WAVE_EXAGGERATION = 1.5;
/** Πλάτος (μισό ύψος) του κύματος σε μονάδες κουτιού για ένταση 1 (= 1,6 μ. ύψος). */
const waveUnitsFor = (metresPerUnit: number) => ((1.6 / 2) * WAVE_EXAGGERATION) / metresPerUnit;

/**
 * Όλα τα νούμερα που αλλάζουν ανά καρέ, υπολογισμένα ΜΙΑ φορά από τα δεδομένα της ώρας — τα
 * μοιράζονται ο 2D και ο 3D ζωγράφος ώστε να μη διαφωνούν ποτέ.
 */
export const deriveMotion = (p: SeaMotionParams) => {
  const waveFrom = p.waveFromDeg ?? p.windFromDeg ?? p.facingDeg;
  const [tx, ty] = travelVector(waveFrom, p.facingDeg);
  const arriving = seawardness(waveFrom, p.facingDeg) > 0.05;
  const openAmp = heightToAmp(p.openWaveM);
  const shoreAmp = heightToAmp(p.shoreWaveM ?? p.openWaveM);
  const realWavelength = (1.56 * p.periodS * p.periodS) / p.metresPerUnit;
  const wavelength = Math.min(34, Math.max(8, realWavelength));
  const kWave = (2 * Math.PI) / wavelength;
  const omega = ((2 * Math.PI) / p.periodS) * 1.4;
  const windSpeed = p.windSpeedKmh;
  const hasWind = typeof windSpeed === 'number' && Number.isFinite(windSpeed) && typeof p.windFromDeg === 'number';
  const [wx, wy] = hasWind ? travelVector(p.windFromDeg as number, p.facingDeg) : [0, 0];
  const windAmp = hasWind ? Math.pow(clamp01((windSpeed as number) / 45), 0.8) : 0;
  const offshoreWind = hasWind && seawardness(p.windFromDeg as number, p.facingDeg) < -0.15;
  const ripSpeed = hasWind ? 4 + (windSpeed as number) * 0.35 : 0;
  // Άσπρες κορφές από ~4 Μπφ (20 km/h), πυκνές στα 6 (40+) — η κλίμακα Μποφόρ, οπτικά.
  const whitecaps = Math.max(0, windAmp - 0.5) * 0.9;
  const breakZone = Math.min(20, 1 + (p.shoreWaveM ?? 0) * 8);
  // Αφρός από τα ~0,3 μ. και πάνω· μια ήρεμη θάλασσα γλείφει την άμμο, δεν σπάει.
  const foamStrength = clamp01(((p.shoreWaveM ?? 0) - 0.3) / 1.0);
  return {
    tx, ty, arriving, openAmp, shoreAmp, hasWaves: openAmp > 0 || shoreAmp > 0,
    kWave, omega, hasWind, windSpeed: hasWind ? (windSpeed as number) : 0, wx, wy, windAmp,
    offshoreWind, ripSpeed, whitecaps, breakZone, foamStrength,
  };
};

/* ---------------------------------------------------------- particles */

export type Streak = { x: number; y: number; z: number; age: number; life: number; len: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Ένα ρεύμα ανέμου γεννιέται ανάντη, ώστε να διασχίσει το κάδρο· στο πρώτο γέμισμα οπουδήποτε. */
export const spawnStreak = (wx: number, wy: number, speedKmh: number, anywhere: boolean, area: { x0: number; x1: number; y0: number; y1: number }, zScale = 1): Streak => {
  const len = Math.min(22, 5 + speedKmh * 0.2);
  const life = rand(1.6, 3.4);
  const z = rand(2, 9) * zScale;
  if (anywhere) {
    return { x: rand(area.x0, area.x1), y: rand(area.y0, area.y1), z, age: rand(0, life), life, len };
  }
  const cx = (area.x0 + area.x1) / 2;
  const cy = (area.y0 + area.y1) / 2;
  const reach = Math.max(area.x1 - area.x0, area.y1 - area.y0) * 0.65;
  const spread = reach * 0.9;
  return { x: cx - wx * reach + -wy * rand(-spread, spread), y: cy - wy * reach + wx * rand(-spread, spread), z, age: 0, life, len };
};

/* ------------------------------------------------------------- shaders */

/** GLSL που μοιράζονται ο ουρανός και το έδαφος: θόρυβος, ο ίδιος ουρανός, το ίδιο tone mapping. */
const SHARED_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}
// Ο ουρανός ως συνάρτηση κατεύθυνσης: βαθύ μπλε στο ζενίθ, αχλή στον ορίζοντα, ήλιος με άλω,
// λίγα σύννεφα. Τον ΙΔΙΟ ουρανό βλέπει το μάτι πάνω από τον ορίζοντα και το νερό στην
// αντανάκλασή του — έτσι ο ήλιος γυαλίζει στο νερό ακριβώς εκεί που πρέπει.
vec3 skyColor(vec3 dir, vec3 light, float time, float dayLight, float cloudCover) {
  float t = clamp(dir.z, 0.0, 1.0);
  // Χαμηλός ήλιος → ζεστός ορίζοντας, ιδίως προς τη μεριά του. Νύχτα → βαθύ μπλε.
  float lowSun = 1.0 - smoothstep(0.05, 0.35, light.z);
  vec3 horizonDay = vec3(0.66, 0.80, 0.92);
  vec3 horizonWarm = vec3(0.98, 0.62, 0.36);
  vec3 zenith = mix(vec3(0.10, 0.32, 0.76), vec3(0.10, 0.22, 0.52), lowSun * 0.6);
  vec3 horizon = mix(horizonDay, horizonWarm, lowSun * 0.45);
  vec3 sky = mix(horizon, zenith, pow(t, 0.38));
  float toward = max(dot(normalize(vec3(dir.xy, 0.0001)), normalize(vec3(light.xy, 0.0001))), 0.0);
  sky = mix(sky, horizonWarm, lowSun * pow(toward, 3.0) * (1.0 - t) * 0.6);
  float s = max(dot(dir, light), 0.0);
  float sunVis = 1.0 - 0.75 * cloudCover;
  sky += vec3(1.0, 0.94, 0.85) * (pow(s, 1400.0) * 9.0 + pow(s, 40.0) * 0.32 + pow(s, 3.0) * 0.07) * sunVis;
  if (dir.z > 0.02) {
    vec2 cp = dir.xy / max(dir.z, 0.08) * 0.32 + vec2(time * 0.012, time * 0.004);
    float cloud = fbm(cp);
    float lo = 0.58 - 0.42 * cloudCover;
    float cover = smoothstep(lo, lo + 0.26, cloud) * smoothstep(0.02, 0.22, dir.z);
    vec3 cloudCol = mix(vec3(0.98), vec3(0.72, 0.75, 0.82), cloudCover);
    sky = mix(sky, cloudCol, cover * 0.85);
  }
  vec3 night = vec3(0.03, 0.05, 0.12) * (0.6 + 0.4 * t);
  return mix(night, sky, dayLight);
}
// Βάθος σε 4 bytes και πίσω — ο χάρτης σκιάς σε WebGL1 χωρίς depth texture.
vec4 packDepth(float v) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  return enc;
}
float unpackDepth(vec4 rgba) {
  return dot(rgba, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}
// ACES: το tone mapping του κινηματογράφου — τα φωτεινά δεν «καίγονται», τα σκούρα κρατούν χρώμα.
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
`;

const TERRAIN_VS = `
precision highp float;
attribute vec2 aPos;
attribute float aDist;
attribute vec2 aShore;
attribute float aNoise;
attribute float aHeight;
attribute vec2 aUv;
attribute vec2 aUv2;
attribute vec3 aNormal;
attribute float aAo;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uLightVP;
uniform float uTime;
uniform vec2 uWaveDir;
uniform float uArriving;
uniform float uK;
uniform float uOmega;
uniform float uOpenAmp;
uniform float uShoreAmp;
// Μονάδες κουτιού ανά ένταση: πλάτος κύματος και κοφτού κύματος ανέμου σε πραγματική κλίμακα.
uniform float uWaveUnits;
uniform float uChopUnits;
uniform float uHasWaves;
uniform vec2 uWindDir;
uniform float uWindAmp;
uniform float uOffshore;
uniform float uRipSpeed;
uniform float uBreakZone;
uniform float uFoam;
varying vec3 vWorld;
varying float vDist;
varying float vNoise;
varying float vFoam;
varying float vRip;
varying float vShadow;
varying float vWave;
varying vec2 vUv;
varying vec2 vUv2;
varying vec3 vNormal;
varying float vAo;
varying vec4 vShadowPos;

void main() {
  float d = aDist;
  float z = 0.0;
  vec2 disp = vec2(0.0);
  vFoam = 0.0;
  vRip = 0.0;
  vShadow = 1.0;
  vWave = 0.0;
  if (d > 0.0) {
    if (uHasWaves > 0.5) {
      float w = uArriving * smoothstep(0.0, 1.0, 1.0 - d / ${REFRACTION_UNITS.toFixed(1)});
      float far = dot(uWaveDir, aPos);
      float farAtShore = dot(uWaveDir, aShore);
      float travelled = mix(far, farAtShore - d, w);
      float phase = uK * travelled - uOmega * uTime;
      float amp = mix(uShoreAmp, uOpenAmp, clamp(d / 45.0, 0.0, 1.0));
      // Όσο ψηλώνει το κύμα, τόσο πιο μυτερή η κορυφή και πιο πλατιά η κοιλάδα (Gerstner).
      float crest = sin(phase) + 0.30 * amp * sin(2.0 * phase + 0.7);
      z = amp * crest * uWaveUnits;
      // Gerstner: το νερό κινείται και οριζόντια — η κορυφή μαζεύεται και γέρνει μπροστά.
      disp += uWaveDir * (amp * cos(phase) * uWaveUnits * 0.8) * (0.5 + 0.5 * w);
      // Δεύτερο, μικρότερο κύμα λίγο λοξά και λίγο πιο κοντό: η θάλασσα δεν είναι ποτέ ΕΝΑ ημίτονο.
      vec2 crossDir = normalize(uWaveDir + vec2(-uWaveDir.y, uWaveDir.x) * 0.42);
      float crossPhase = uK * 1.6 * mix(dot(crossDir, aPos), dot(crossDir, aShore) - d, w) - uOmega * 1.25 * uTime + 1.3;
      z += amp * sin(crossPhase) * 0.6 * uWaveUnits;
      // Για τον fragment shader: η ένταση (0..1,5), όχι τα μέτρα — το φως μέσα από την κορυφή.
      vWave = amp * crest;
      if (uArriving > 0.5 && d < uBreakZone && uFoam > 0.0) {
        vFoam = uFoam * (0.5 + 0.5 * sin(phase)) * (1.0 - d / uBreakZone);
      }
    }
    float shadow = mix(1.0, clamp(d / ${WIND_SHADOW_UNITS.toFixed(1)}, 0.0, 1.0), uOffshore);
    float gust = 0.55 + 0.45 * sin(0.11 * aPos.x + 0.07 * aPos.y - 0.8 * uTime) * sin(0.09 * aPos.x - 0.13 * aPos.y + 0.5 * uTime);
    float ripA = uWindAmp * shadow * gust;
    // Ο άνεμος σηκώνει κοντό «κοφτό» κύμα (μήκος ~7 μονάδες, πάνω από το βήμα του πλέγματος).
    float kChop = 0.9;
    float chop = sin(kChop * dot(uWindDir, aPos) - kChop * uRipSpeed * 0.7 * uTime + aNoise * 4.0);
    z += chop * ripA * uChopUnits;
    vRip = ripA;
    vShadow = shadow;
  } else {
    // Η στεριά: το ύψος ήρθε έτοιμο από τη CPU (ήπια πλαγιά άμμου ή το πραγματικό ανάγλυφο).
    z = aHeight;
  }
  vWorld = vec3(aPos + disp, z);
  vDist = d;
  vNoise = aNoise;
  vUv = aUv;
  vUv2 = aUv2;
  vNormal = aNormal;
  vAo = aAo;
  vShadowPos = uLightVP * vec4(aPos + disp, z, 1.0);
  gl_Position = uProj * uView * vec4(aPos + disp, z, 1.0);
}
`;

const TERRAIN_FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec3 uEye;
uniform vec3 uLight;
uniform float uWhitecaps;
uniform vec2 uWindDir;
uniform float uRipSpeed;
uniform float uTime;
uniform vec2 uResolution;
uniform float uGrid;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogMax;
uniform float uMetresPerUnit;
uniform float uWindAmp;
uniform float uDayLight;
uniform float uCloudCover;
uniform float uShallowReach;
uniform sampler2D uSat;
uniform float uHasSat;
uniform sampler2D uSat2;
uniform float uHasSat2;
uniform sampler2D uShadowMap;
uniform float uHasShadow;
uniform float uShadowTexel;
uniform float uOmega;
uniform float uRunup;
uniform float uOpenAmp;
varying vec2 vUv;
varying vec2 vUv2;
varying vec3 vNormal;
varying float vAo;
varying vec4 vShadowPos;
varying vec3 vWorld;
varying float vDist;
varying float vNoise;
varying float vFoam;
varying float vRip;
varying float vShadow;
varying float vWave;
${SHARED_GLSL}

// Πόσο φως φτάνει εδώ: 0 = σκιά, 1 = ήλιος. 4 δείγματα γύρω από το σημείο (PCF) για μαλακή άκρη.
float sunVisibility(float bias) {
  if (uHasShadow < 0.5) return 1.0;
  vec3 sc = vShadowPos.xyz / vShadowPos.w * 0.5 + 0.5;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  float lit = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i == 1 || i == 3) - 0.5, float(i >= 2) - 0.5) * uShadowTexel * 1.5;
    float d = unpackDepth(texture2D(uShadowMap, sc.xy + o));
    lit += (sc.z - bias) > d ? 0.0 : 1.0;
  }
  return lit * 0.25;
}

void main() {
  // Νερό: κλίση ανά pixel από τη γεωμετρία του καρέ. Στεριά: ομαλή κλίση από τις κορυφές —
  // αυτό είναι που σβήνει το «πολυγωνικό» της παλιάς κονσόλας.
  vec3 n;
  if (vDist > 0.0) {
    n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.z < 0.0) n = -n;
  } else {
    n = normalize(vNormal);
  }
  vec3 v = normalize(uEye - vWorld);
  float dist = length(uEye - vWorld);
  vec2 p = vWorld.xy;
  // Η λεπτομέρεια σβήνει με την απόσταση — μακριά θα γινόταν μόνο τρεμούλιασμα.
  float detail = 1.0 - smoothstep(60.0, 420.0, dist);
  vec3 color;

  if (vDist > 0.0) {
    // ΝΕΡΟ. Κλίσεις ανά εικονοστοιχείο: η τσαλάκωση του ανέμου (cat's paws) + ψιλός θόρυβος
    // που τον σέρνει ο άνεμος. Στη σκιά του ανέμου (vShadow → 0) το νερό μένει λάδι.
    float kRip = 1.96;
    float ph = kRip * dot(uWindDir, p) - kRip * uRipSpeed * uTime + vNoise * 6.0;
    vec2 g = uWindDir * cos(ph) * vRip * 0.35;
    vec2 q = p * 1.7 + uWindDir * uTime * (0.8 + uRipSpeed * 0.15);
    float e = 0.18;
    float n0 = fbm(q);
    g += vec2(fbm(q + vec2(e, 0.0)) - n0, fbm(q + vec2(0.0, e)) - n0) / e * (0.03 + 0.10 * uWindAmp) * vShadow;
    n = normalize(n + vec3(g * detail, 0.0));

    // Το σώμα του νερού: τιρκουάζ στα ρηχά, βαθύ μπλε ανοιχτά, η άμμος να φαίνεται από κάτω.
    float depth = smoothstep(0.0, uShallowReach, vDist);
    vec3 shallow = vec3(0.30, 0.78, 0.78);
    vec3 deep = vec3(0.04, 0.25, 0.50);
    vec3 body = mix(shallow, deep, depth);
    // Ρηχά διάφανα: η άμμος φαίνεται μέσα από το νερό όσο πιο ρηχό είναι (βάθος ~ απόσταση).
    float clarity = exp(-vDist * 0.22);
    body = mix(body, vec3(0.80, 0.76, 0.62) * 0.9, clarity * 0.85);
    float sun = sunVisibility(0.004);
    float diff = max(dot(n, uLight), 0.0) * mix(1.0, sun, 0.8);
    body *= (0.45 + 0.65 * diff) * (0.2 + 0.8 * uDayLight);
    // Φως ΜΕΣΑ από την κορυφή όταν ο ήλιος είναι πίσω της — αυτό το τιρκουάζ λαμπύρισμα.
    float sss = pow(max(dot(v, -uLight), 0.0), 4.0) * max(vWave, 0.0) * 0.55;
    body += vec3(0.05, 0.45, 0.40) * sss;

    // Fresnel: όσο πιο πλάγια κοιτάς, τόσο πιο πολύ το νερό γίνεται καθρέφτης του ουρανού.
    vec3 r = reflect(-v, n);
    r.z = abs(r.z);
    vec3 refl = skyColor(r, uLight, uTime, uDayLight, uCloudCover);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    color = mix(body, refl, clamp(fres, 0.0, 1.0));
    // Γυαλάδα και σπινθηρίσματα του ήλιου.
    vec3 h = normalize(uLight + v);
    // Σπινθηρίσματα ανάλογα με το πόσο ζωντανή είναι η θάλασσα: το λάδι γυαλίζει απαλά, όχι σαν κύμα.
    float liveliness = clamp(uOpenAmp * 2.0 + uWindAmp * 0.6, 0.15, 1.0);
    float spec = pow(max(dot(n, h), 0.0), 900.0);
    color += vec3(1.0, 0.97, 0.9) * spec * 1.1 * liveliness * (0.4 + 0.6 * vnoise(p * 3.0 + uTime * 2.0)) * (1.0 - 0.7 * uCloudCover) * uDayLight * sun;

    // Αφρός με υφή εκεί που σπάει, και άσπρες κορφές που ο άνεμος ξεσηκώνει.
    float fm = fbm(p * 0.9 + vec2(0.0, -uTime * 0.6));
    float foam = smoothstep(0.38, 0.78, fm + vFoam * 0.9) * step(0.001, vFoam);
    foam = max(foam, vFoam * 0.45);
    float capNoise = vnoise(p * 0.8 + uWindDir * uTime * 1.5);
    float caps = smoothstep(0.64, 0.76, capNoise) * step(0.35, sin(ph)) * clamp(uWhitecaps * 1.6, 0.0, 1.0) * vShadow;
    // Σε πολύ αέρα (≥ 6 Μπφ) ο αφρός τεντώνεται σε λωρίδες κατά μήκος του ανέμου.
    vec2 along = vec2(dot(p, uWindDir) * 0.25, dot(p, vec2(-uWindDir.y, uWindDir.x)) * 1.6);
    float streaks = smoothstep(0.72, 0.86, vnoise(along + vec2(-uTime * 0.9, 0.0))) * smoothstep(0.7, 1.0, uWindAmp) * vShadow;
    foam = clamp(foam + caps + streaks * 0.5, 0.0, 1.0);
    vec3 foamCol = vec3(0.96, 0.98, 1.0) * (0.7 + 0.4 * diff) * (0.25 + 0.75 * uDayLight);
    color = mix(color, foamCol, foam * (0.6 + 0.4 * detail));

    // Το λεπτό πλέγμα της προσομοίωσης: κάθε 10 μονάδες, σβήνει με την απόσταση.
    if (uGrid > 0.0) {
      vec2 gp = p / 10.0;
      vec2 gw = abs(fract(gp) - 0.5) / max(fwidth(gp), vec2(1e-4));
      float line = 1.0 - min(min(gw.x, gw.y), 1.0);
      color = mix(color, vec3(0.35, 0.95, 1.0), line * uGrid * detail);
    }
  } else {
    // ΣΤΕΡΙΑ. Με δορυφορική φωτογραφία όπου έφτασε, αλλιώς άμμος με κόκκο και ρυτίδες ανέμου,
    // θάμνοι πιο ψηλά, γυμνός βράχος στα βουνά.
    float grain = mix(vnoise(p * 7.0), vnoise(p * 29.0), 0.5);
    float sun = sunVisibility(0.0015);
    float diff = max(dot(n, uLight), 0.0) * mix(1.0, sun, 0.85);
    bool nearPhoto = uHasSat2 > 0.5 && vUv2.x >= 0.0;
    if (nearPhoto || (uHasSat > 0.5 && vUv.x >= 0.0)) {
      // Κοντά στην παραλία η υψηλής ανάλυσης (~1,2 μ./pixel), πιο πέρα η ευρεία (~4,8 μ./pixel).
      vec3 photo = nearPhoto ? texture2D(uSat2, vUv2).rgb : texture2D(uSat, vUv).rgb;
      // Η φωτογραφία είναι ~5 μ./pixel: κοντά στην κάμερα ο κόκκος της άμμου γεμίζει τα κενά.
      color = photo * (0.92 + 0.16 * grain * detail);
      // Στην άμμο δίπλα στο νερό, η φωτογραφία συχνά δείχνει θάλασσα (η γραμμή του νερού
      // κινείται): σε 2,5 μονάδες από τη γραμμή προτιμάμε άμμο.
      vec3 sand = vec3(0.92, 0.86, 0.72) * (0.88 + 0.24 * grain * detail);
      color = mix(sand, color, smoothstep(-1.0, -6.0, vDist));
    } else {
      vec3 sand = vec3(0.92, 0.86, 0.72);
      sand *= 0.88 + 0.24 * grain * detail;
      float ripples = sin(dot(p, vec2(-uWindDir.y, uWindDir.x)) * 3.5 + vnoise(p * 1.5) * 4.0);
      sand *= 0.97 + 0.03 * ripples * detail;
      vec3 inland = vec3(0.80, 0.74, 0.60);
      color = mix(sand, inland, smoothstep(0.0, 45.0, -vDist));
      float metres = vWorld.z * uMetresPerUnit / ${RELIEF_EXAGGERATION.toFixed(2)};
      vec3 scrub = vec3(0.50, 0.56, 0.36) * (0.85 + 0.3 * vnoise(p * 0.5));
      vec3 rock = vec3(0.62, 0.59, 0.54) * (0.85 + 0.3 * vnoise(p * 0.9));
      color = mix(color, scrub, smoothstep(15.0, 60.0, metres));
      color = mix(color, rock, smoothstep(220.0, 700.0, metres));
    }
    // Κοιλότητες πιο σκούρες (vAo από τη γεωμετρία), φως του ήλιου με σκιά.
    color *= (0.42 + 0.68 * diff) * (0.18 + 0.82 * uDayLight) * vAo;
    // ΤΟ ΓΛΕΙΨΙΜΟ ΤΟΥ ΚΥΜΑΤΟΣ: το νερό ανεβαίνει στην άμμο ως uRunup και υποχωρεί, στον ρυθμό
    // του κύματος. Βρεγμένη ζώνη που καθρεφτίζει τον ουρανό, και μια λεπτή γραμμή αφρού στην άκρη.
    float inland = -vDist;
    float swash = 0.35 + 0.65 * (0.5 + 0.5 * sin(uOmega * uTime * 0.5 + vNoise * 0.6));
    float wetLine = uRunup * swash;
    float wet = smoothstep(uRunup + 1.5, uRunup * 0.2, inland);
    if (wet > 0.0) {
      vec3 r = reflect(-v, n);
      r.z = abs(r.z);
      color = mix(color, color * 0.8 + skyColor(r, uLight, uTime, uDayLight, uCloudCover) * 0.14, wet);
    }
    float film = 1.0 - smoothstep(0.0, 0.6, abs(inland - wetLine));
    color = mix(color, vec3(0.93, 0.96, 0.98) * (0.3 + 0.7 * uDayLight), film * 0.55 * step(inland, uRunup + 0.3));
  }

  // Ομίχλη: το μακρινό λιώνει στον ουρανό της ίδιας κατεύθυνσης, κοντά στον ορίζοντα.
  vec3 hazeDir = normalize(vec3(-v.x, -v.y, max(-v.z, 0.10)));
  float fog = pow(smoothstep(uFogNear, uFogFar, dist), 1.6) * uFogMax;
  color = mix(color, skyColor(hazeDir, uLight, uTime, uDayLight, uCloudCover), fog);

  // Φινίρισμα: έκθεση, ACES, ελαφριά βινιέτα, λίγος κόκκος.
  color = aces(color * 1.15);
  vec2 uv = gl_FragCoord.xy / uResolution;
  float vig = smoothstep(1.0, 0.35, distance(uv, vec2(0.5)));
  color *= 0.78 + 0.22 * vig;
  float grainN = fract(sin(dot(gl_FragCoord.xy + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grainN - 0.5) * 0.022;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Ο χάρτης σκιάς: το έδαφος από τη μεριά του ήλιου, βάθος σε RGBA. */
const DEPTH_FS = `
precision highp float;
${SHARED_GLSL}
void main() {
  gl_FragColor = packDepth(gl_FragCoord.z);
}
`;

/** FXAA: σβήνει τις σκάλες στις ακμές, ιδίως όταν η ανάλυση έχει πέσει για ταχύτητα. */
const FXAA_VS = `
attribute vec2 aClip;
varying vec2 vUv;
void main() {
  vUv = aClip * 0.5 + 0.5;
  gl_Position = vec4(aClip, 0.0, 1.0);
}
`;

const FXAA_FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uInvRes;
varying vec2 vUv;
void main() {
  vec3 luma = vec3(0.299, 0.587, 0.114);
  vec3 rgbNW = texture2D(uTex, vUv + vec2(-1.0, -1.0) * uInvRes).rgb;
  vec3 rgbNE = texture2D(uTex, vUv + vec2(1.0, -1.0) * uInvRes).rgb;
  vec3 rgbSW = texture2D(uTex, vUv + vec2(-1.0, 1.0) * uInvRes).rgb;
  vec3 rgbSE = texture2D(uTex, vUv + vec2(1.0, 1.0) * uInvRes).rgb;
  vec3 rgbM = texture2D(uTex, vUv).rgb;
  float lNW = dot(rgbNW, luma);
  float lNE = dot(rgbNE, luma);
  float lSW = dot(rgbSW, luma);
  float lSE = dot(rgbSE, luma);
  float lM = dot(rgbM, luma);
  float lumaMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lumaMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * uInvRes;
  vec3 rgbA = 0.5 * (texture2D(uTex, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(uTex, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(uTex, vUv + dir * -0.5).rgb + texture2D(uTex, vUv + dir * 0.5).rgb);
  float lB = dot(rgbB, luma);
  gl_FragColor = vec4((lB < lumaMin || lB > lumaMax) ? rgbA : rgbB, 1.0);
}
`;

const SKY_VS = `
attribute vec2 aClip;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform vec2 uTanHalf;
varying vec3 vDir;
void main() {
  // Η ακτίνα κάθε εικονοστοιχείου από τη βάση της κάμερας — γραμμική στον χώρο του clip.
  vDir = uCamFwd + uCamRight * (aClip.x * uTanHalf.x) + uCamUp * (aClip.y * uTanHalf.y);
  gl_Position = vec4(aClip, 0.9999, 1.0);
}
`;

const SKY_FS = `
precision mediump float;
uniform vec3 uLight;
uniform float uTime;
uniform float uDayLight;
uniform float uCloudCover;
varying vec3 vDir;
${SHARED_GLSL}
void main() {
  vec3 dir = normalize(vDir);
  gl_FragColor = vec4(aces(skyColor(dir, uLight, uTime, uDayLight, uCloudCover) * 1.15), 1.0);
}
`;

const LINE_VS = `
attribute vec3 aPos;
attribute float aAlpha;
// Λεπτά παραλληλόγραμμα (δύο τρίγωνα), όχι γραμμές 1 px: οι γραμμές του WebGL δεν έχουν πάχος.
uniform mat4 uProj;
uniform mat4 uView;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}
`;

const LINE_FS = `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha);
}
`;

/**
 * Ο ΑΝΘΡΩΠΟΣ ΚΑΙ Η ΟΜΠΡΕΛΑ — ΚΛΙΜΑΚΑ (Μίλτος: «να φαίνεται πόσο κύμα έχει»). Δύο επίπεδα
 * σκίτσα που κοιτούν πάντα την κάμερα, στο ΙΔΙΟ κατακόρυφο μεγέθυνση με το νερό: ένας
 * άνθρωπος 1,75 μ. στη γραμμή του νερού και μια ομπρέλα 2,2 μ. στην άμμο. Έτσι ένα κύμα
 * 0,8 μ. φτάνει ως τη μέση του, ένα 1,6 μ. ως τον ώμο — χωρίς αριθμούς.
 */
const PROP_VS = `
attribute vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uBase;
uniform vec3 uRight;
uniform vec2 uSize;
varying vec2 vCorner;
void main() {
  vec3 world = uBase + uRight * (aCorner.x * uSize.x * 0.5) + vec3(0.0, 0.0, (aCorner.y * 0.5 + 0.5) * uSize.y);
  vCorner = vec2(aCorner.x, aCorner.y * 0.5 + 0.5);
  gl_Position = uProj * uView * vec4(world, 1.0);
}
`;

const PROP_FS = `
precision mediump float;
uniform float uKind;
uniform float uDayLight;
uniform float uTime;
varying vec2 vCorner;
${SHARED_GLSL}
float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
void main() {
  vec2 p = vCorner;
  float d = 1.0;
  vec3 color = vec3(0.10, 0.12, 0.18);
  if (uKind < 0.5) {
    // Άνθρωπος με μαγιό που χαιρετάει (Μίλτος: «σαν κούτσουρο» — σκούρα σιλουέτα σε 10 px
    // δεν διαβάζεται· δέρμα + μαγιό + άσπρο περίγραμμα + χέρι που κουνιέται, ναι).
    vec3 skin = vec3(0.86, 0.66, 0.50);
    vec3 suit = vec3(0.0, 0.48, 0.51);
    float sway = sin(uTime * 1.3) * 0.015;
    float head = length(p - vec2(sway, 0.905)) - 0.075;
    float torso = capsule(p, vec2(sway, 0.50), vec2(sway * 0.5, 0.80), 0.115);
    float shorts = capsule(p, vec2(sway, 0.42), vec2(sway, 0.55), 0.125);
    float legL = capsule(p, vec2(-0.07, 0.02), vec2(-0.06 + sway, 0.46), 0.052);
    float legR = capsule(p, vec2(0.07, 0.02), vec2(0.06 + sway, 0.46), 0.052);
    float armL = capsule(p, vec2(-0.12 + sway, 0.76), vec2(-0.24, 0.52), 0.04);
    // Το δεξί χέρι ψηλά, κουνιέται: αυτό είναι που λέει «άνθρωπος» από μακριά.
    float wave = sin(uTime * 2.4) * 0.09;
    float armR = capsule(p, vec2(0.12 + sway, 0.76), vec2(0.22 + wave, 0.98), 0.04);
    d = min(min(min(head, torso), min(shorts, min(legL, legR))), min(armL, armR));
    color = skin;
    if (torso < 0.0 && shorts >= 0.0 && p.y > 0.55) color = mix(skin, vec3(0.97), 0.0);
    if (shorts < 0.0) color = suit;
    // Άσπρο περίγραμμα γύρω από όλο το σώμα, για να ξεχωρίζει πάνω στο νερό.
    if (d > 0.0 && d < 0.035) {
      gl_FragColor = vec4(vec3(0.98) * (0.5 + 0.5 * uDayLight), 1.0);
      return;
    }
  } else {
    // Ομπρέλα: κοντάρι και θόλος με ρίγες.
    d = min(d, capsule(p, vec2(0.0, 0.0), vec2(0.0, 0.76), 0.02));
    vec2 q = vec2(p.x / 1.0, (p.y - 0.72) / 0.28);
    float dome = length(q) - 1.0;
    if (p.y < 0.72) dome = 1.0;
    d = min(d, dome);
    float stripe = step(0.5, fract((atan(p.x, max(p.y - 0.72, 0.001)) + 1.6) * 1.6));
    if (dome < 0.0) color = mix(vec3(0.0, 0.48, 0.51), vec3(0.96), stripe);
  }
  if (d > 0.0) discard;
#ifdef SHADOW_PASS
  gl_FragColor = packDepth(gl_FragCoord.z);
#else
  gl_FragColor = vec4(color * (0.35 + 0.65 * uDayLight), 1.0);
#endif
}
`;

/** Σταγονίδια που ξεσηκώνει ο άνεμος από τις άσπρες κορφές, και τα πουλιά — σημεία. */
const POINT_VS = `
attribute vec3 aPos;
attribute float aAlpha;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uPointScale;
varying float vAlpha;
void main() {
  vec4 clip = uProj * uView * vec4(aPos, 1.0);
  gl_Position = clip;
  gl_PointSize = clamp(uPointScale / max(clip.w, 1.0), 1.5, 9.0);
  vAlpha = aAlpha;
}
`;

const POINT_FS = `
precision mediump float;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.55, 1.0, r)) * vAlpha;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}
`;

/* ------------------------------------------------------------ matrices */

const perspective = (fovyDeg: number, aspect: number, near: number, far: number) => {
  const f = 1 / Math.tan((fovyDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
};

const ortho = (l: number, r: number, b: number, t: number, n: number, f: number) => new Float32Array([
  2 / (r - l), 0, 0, 0,
  0, 2 / (t - b), 0, 0,
  0, 0, -2 / (f - n), 0,
  -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1,
]);

const mul4 = (a: Float32Array, b: Float32Array) => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

const lookAt = (eye: number[], target: number[], up: number[]) => {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
};

/* ------------------------------------------------------------- helpers */

const compile = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null => {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

/** Ένας πολύ φθηνός ντετερμινιστικός «τυχαίος» — ίδια εικόνα σε κάθε άνοιγμα της ίδιας παραλίας. */
const hashNoise = (i: number, seed: number) => {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/* ------------------------------------------------------------ geometry */

/**
 * Το πλέγμα: όλο το κουτί συν ουρά προς τον ορίζοντα και στα πλάγια, ώστε η κάμερα να μη βλέπει
 * άκρη. Κοντά στην παραλία βήμα 2 μονάδες· μακριά, λίγες αραιές σειρές ως εκεί που η ομίχλη
 * τα σβήνει όλα. Σύνολο ~37.000 κορυφές, κάτω από το όριο των 65.535 του Uint16.
 */
const GRID = { x0: -130, x1: 330, y0: -140, y1: 132 } as const;
const FAR_ROWS = [-170, -210, -260, -330, -420, -540, -700];
/** Το κάδρο που καλύπτει η ακτογραμμή της μινιατούρας — μέσα του η γραμμή είναι η αλήθεια. */
const FRAME = { x0: -10, x1: 210, y0: -10, y1: 120 } as const;

type ReliefFn = (x: number, y: number) => number | null;

/** Συντεταγμένες πλέγματος: ένα αραιό εξωτερικό (σε μέτρα) γύρω από ένα πυκνό εσωτερικό. */
const axisCoordinates = (inner0: number, inner1: number, innerStep: number, outerUnits: number, outerStep: number): number[] => {
  const out: number[] = [];
  for (let v = inner0 - outerUnits; v < inner0 - outerStep * 0.5; v += outerStep) out.push(v);
  for (let v = inner0; v <= inner1 + 1e-6; v += innerStep) out.push(v);
  for (let v = inner1 + outerStep; v <= inner1 + outerUnits + 1e-6; v += outerStep) out.push(v);
  return out;
};

type UvFn = (x: number, y: number) => [number, number] | null;

const buildMesh = (
  points: Point[],
  seed: number,
  step: number,
  wideIndices: boolean,
  relief: ReliefFn | undefined,
  metresPerUnit: number,
  satelliteUv: UvFn | undefined,
  satelliteUvNear: UvFn | undefined
) => {
  let xs: number[];
  let ys: number[];
  if (relief && wideIndices) {
    // Με ανάγλυφο: 16 χλμ προς τη θάλασσα και στα πλάγια, 2,5 χλμ πίσω από την κάμερα,
    // σε βήμα 150 μ. — αρκετό για βουνά και απέναντι ακτές, όχι για ακτογραμμή (αυτή είναι
    // δουλειά του πυκνού εσωτερικού).
    const outerStep = 150 / metresPerUnit;
    xs = axisCoordinates(GRID.x0, GRID.x1, step, RELIEF_REACH_M / metresPerUnit, outerStep);
    const seaward = RELIEF_REACH_M / metresPerUnit;
    const landward = 2500 / metresPerUnit;
    ys = [];
    for (let v = GRID.y0 - seaward; v < GRID.y0 - outerStep * 0.5; v += outerStep) ys.push(v);
    for (let v = GRID.y0; v <= GRID.y1 + 1e-6; v += step) ys.push(v);
    for (let v = GRID.y1 + outerStep; v <= GRID.y1 + landward + 1e-6; v += outerStep) ys.push(v);
  } else {
    xs = [];
    for (let v = GRID.x0; v <= GRID.x1 + 1e-6; v += step) xs.push(v);
    ys = [...FAR_ROWS];
    for (let v = GRID.y0; v <= GRID.y1 + 1e-6; v += step) ys.push(v);
  }
  const cols = xs.length;
  const rows = ys.length;
  const FLOATS = 15;
  const vertices = new Float32Array(cols * rows * FLOATS);
  const heights = new Float32Array(cols * rows);
  const seaMask = new Uint8Array(cols * rows);

  const segments: Array<[number, number, number, number, number]> = [];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    segments.push([x1, y1, dx, dy, dx * dx + dy * dy || 1]);
  }
  const landYAt = (x: number): number => {
    if (points.length === 0) return SHORELINE_BOX.pinY;
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i += 1) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      if (x <= x2) return x2 === x1 ? y2 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
    return points[points.length - 1][1];
  };
  const smooth01 = (v: number) => {
    const t = v < 0 ? 0 : v > 1 ? 1 : v;
    return t * t * (3 - 2 * t);
  };

  let v = 0;
  for (let r = 0; r < rows; r += 1) {
    const y = ys[r];
    for (let c = 0; c < cols; c += 1) {
      const x = xs[c];
      let best = Infinity;
      let bx = x;
      let by = landYAt(x);
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
      let d = Math.sqrt(best);
      const inFrame = x >= FRAME.x0 && x <= FRAME.x1 && y >= FRAME.y0 && y <= FRAME.y1;
      const reliefM = relief ? relief(x, y) : null;
      // Μέσα στο κάδρο η ακτογραμμή της μινιατούρας αποφασίζει στεριά/θάλασσα· έξω, το DEM
      // (και χωρίς DEM, η γραμμή προεκτείνεται όπως πριν).
      let sea: boolean;
      if (inFrame || !relief) sea = y < landYAt(x);
      else sea = reliefM === null ? true : reliefM <= 0.5;
      // Έξω από το κάδρο η γραμμή δεν λέει τίποτα για τις αποστάσεις — ούτε διάθλαση ούτε αφρός.
      if (!inFrame) d = Math.max(d, 60);

      let height = 0;
      if (!sea) {
        // Χωρίς ανάγλυφο: ήπια αμμουδιά (κλίση ~5 %), ως ~6 μονάδες — όχι λόφος πίσω από κάθε
        // παραλία, και όχι λόφος ΚΑΤΩ από την κάμερα που στέκεται 30 μ. πίσω από το νερό.
        const ramp = Math.min(6, d * 0.05);
        // Λίγο τρέμουλο στην άμμο για να μη γυαλίζει επίπεδη — ΜΟΝΟ στο πυκνό πλέγμα: στα
        // μακρόστενα κελιά του αραιού (1×36 μονάδες) το ίδιο τρέμουλο έβγαινε ρίγες.
        const fine = x >= GRID.x0 && x <= GRID.x1 && y >= GRID.y0 && y <= GRID.y1;
        const jitter = fine ? hashNoise(r * cols + c + 7919, seed) * 0.35 : 0;
        if (reliefM !== null && relief) {
          const demUnits = Math.max(0.3, (reliefM * RELIEF_EXAGGERATION) / metresPerUnit);
          // Στην άμμο μένει η ήπια πλαγιά· 60 μονάδες μέσα το DEM παίρνει το πάνω χέρι.
          height = (inFrame ? ramp + (demUnits - ramp) * smooth01(d / 60) : demUnits) + jitter;
        } else {
          height = ramp + jitter;
        }
      }

      vertices[v++] = x;
      vertices[v++] = y;
      vertices[v++] = sea ? d : -d;
      vertices[v++] = bx;
      vertices[v++] = by;
      vertices[v++] = hashNoise(r * cols + c, seed);
      vertices[v++] = height;
      const uv = !sea && satelliteUv ? satelliteUv(x, y) : null;
      vertices[v++] = uv ? uv[0] : -1;
      vertices[v++] = uv ? uv[1] : -1;
      const uv2 = !sea && satelliteUvNear ? satelliteUvNear(x, y) : null;
      vertices[v++] = uv2 ? uv2[0] : -1;
      vertices[v++] = uv2 ? uv2[1] : -1;
      heights[r * cols + c] = height;
      seaMask[r * cols + c] = sea ? 1 : 0;
      // Κλίση και σκίαση κοιλοτήτων: γεμίζουν στο δεύτερο πέρασμα, όταν ξέρουμε τους γείτονες.
      vertices[v++] = 0; vertices[v++] = 0; vertices[v++] = 1;
      vertices[v++] = 1;
    }
  }
  // Δεύτερο πέρασμα: ομαλή κλίση από τους γείτονες (κεντρικές διαφορές, σε άνισο πλέγμα) και
  // σκίαση κοιλοτήτων — όπου οι γείτονες είναι ψηλότεροι, το φως μπαίνει δύσκολα.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      if (seaMask[i]) continue;
      const cl = Math.max(0, c - 1);
      const cr = Math.min(cols - 1, c + 1);
      const rd = Math.max(0, r - 1);
      const ru = Math.min(rows - 1, r + 1);
      const dzdx = (heights[r * cols + cr] - heights[r * cols + cl]) / Math.max(1e-3, xs[cr] - xs[cl]);
      const dzdy = (heights[ru * cols + c] - heights[rd * cols + c]) / Math.max(1e-3, ys[ru] - ys[rd]);
      const len = Math.hypot(dzdx, dzdy, 1) || 1;
      const avg = (heights[r * cols + cl] + heights[r * cols + cr] + heights[ru * cols + c] + heights[rd * cols + c]) / 4;
      const ao = 1 - Math.min(0.5, Math.max(0, (avg - heights[i]) * 0.12));
      const o = i * FLOATS + 11;
      vertices[o] = -dzdx / len;
      vertices[o + 1] = -dzdy / len;
      vertices[o + 2] = 1 / len;
      vertices[o + 3] = ao;
    }
  }

  const indices = wideIndices
    ? new Uint32Array((cols - 1) * (rows - 1) * 6)
    : new Uint16Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      const b = a + 1;
      const cc = a + cols;
      const dd = cc + 1;
      indices[k++] = a; indices[k++] = cc; indices[k++] = b;
      indices[k++] = b; indices[k++] = cc; indices[k++] = dd;
    }
  }
  return { vertices, indices, count: cols * rows };
};

/* ------------------------------------------------------------- factory */

/**
 * Το σημείο που κοιτά το drone στην αρχή: η θάλασσα μπροστά από την παραλία, λίγο κάτω από
 * την επιφάνεια ώστε το κάδρο να «κρατά» και την ακτή και το ανάγλυφο πίσω της.
 */
const DRONE_TARGET = [100, 22, -4];
/** Διάρκεια της καθόδου από το drone στο ύψος ανθρώπου. */
const INTRO_S = 4.5;

export type CameraRest = { eye: number[]; target: number[] };

/**
 * Η κάμερα ξεκινά ψηλά και μακριά (drone: όλη η μορφολογία, βουνά, απέναντι ακτές) και σε
 * 4,5 s κατεβαίνει και σταματά ΣΤΟ ΥΨΟΣ ΑΝΘΡΩΠΟΥ πάνω στην άμμο, 30 μ. πίσω από το νερό,
 * κοιτώντας τη θάλασσα. Από εκεί το κύμα διαβάζεται σε πραγματική κλίμακα: 0,3 μ. είναι ένα
 * γλείψιμο στην άμμο, 1,5 μ. ένας τοίχος μπροστά στον άνθρωπο. Στο τέλος μένει ένα ελαφρύ
 * «χειρός» λίκνισμα και, με δυνατό άνεμο, ένα τρέμουλο.
 */
const cameraPose = (tSec: number, distanceScale: number, heightScale: number, windShake: number, rest: CameraRest): CameraRest => {
  const intro = Math.min(1, tSec / INTRO_S);
  const ease = intro * intro * (3 - 2 * intro);
  const yaw = Math.sin(tSec * 0.11) * 0.16;
  const radius = 230 * distanceScale;
  const height = 132 * heightScale;
  const droneEye = [DRONE_TARGET[0] + Math.sin(yaw) * radius, DRONE_TARGET[1] + Math.cos(yaw) * radius, DRONE_TARGET[2] + height];
  // Το τρέμουλο του drone είναι μεγάλο (μονάδες)· του ανθρώπου ελάχιστο. Μηδέν ως 22 km/h.
  const shakeAmp = windShake * (0.9 * (1 - ease) + 0.05 * ease);
  const shakeX = (Math.sin(tSec * 7.3) + Math.sin(tSec * 11.1) * 0.5) * shakeAmp;
  const shakeZ = (Math.sin(tSec * 9.7) + Math.sin(tSec * 13.7) * 0.5) * shakeAmp * 0.6;
  // Λίκνισμα χεριού στο τέλος: λίγα εκατοστά, αργά.
  const swayX = (Math.sin(tSec * 0.9) * 0.03 + Math.sin(tSec * 1.7) * 0.015) * ease;
  const swayZ = Math.sin(tSec * 1.3) * 0.02 * ease;
  const mixv = (a: number[], b: number[]) => [a[0] + (b[0] - a[0]) * ease, a[1] + (b[1] - a[1]) * ease, a[2] + (b[2] - a[2]) * ease];
  // Όρθια οθόνη: ένα βήμα πιο πίσω στην άμμο, να χωρά η παραλία.
  const restEye = [rest.eye[0], rest.eye[1] + (distanceScale - 1) * 12, rest.eye[2]];
  const eye = mixv(droneEye, restEye);
  const target = mixv(DRONE_TARGET, rest.target);
  eye[0] += shakeX + swayX;
  eye[2] += shakeZ + swayZ;
  target[0] += swayX;
  target[2] += swayZ;
  return { eye, target };
};

/** Το y της γραμμής του νερού για ένα x του κουτιού (γραμμική παρεμβολή στα σημεία της ακτής). */
const shoreYAt = (points: Point[], x: number): number => {
  if (points.length === 0) return SHORELINE_BOX.pinY;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) return x2 === x1 ? y2 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  }
  return points[points.length - 1][1];
};

/**
 * Το ύψος του εδάφους (μονάδες) στο πιο κοντινό σημείο του πλέγματος σε (x, y) — για να
 * σταθεί η κάμερα, ο άνθρωπος και η ομπρέλα ΠΑΝΩ στην άμμο, όχι μέσα της ή στον αέρα.
 */
const groundZAt = (mesh: { vertices: Float32Array; count: number }, x: number, y: number): number => {
  let best = Infinity;
  let z = 0;
  for (let i = 0; i < mesh.count; i += 1) {
    const o = i * 15;
    const dx = mesh.vertices[o] - x;
    const dy = mesh.vertices[o + 1] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      z = mesh.vertices[o + 6];
    }
  }
  return Number.isFinite(z) ? z : 0;
};
const LIGHT = (() => {
  const l = [-0.35, -0.45, 0.82];
  const n = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

export type SeaMotionGlOptions = {
  /** Ένταση του λεπτού πλέγματος πάνω στη θάλασσα (0 = χωρίς). */
  grid: number;
  /**
   * Ανάγλυφο: υψόμετρο σε ΜΕΤΡΑ για ένα σημείο του κουτιού (x, y σε μονάδες), ή null έξω από
   * το ψημένο πλέγμα (services/beachReliefService). Όταν δίνεται, το πλέγμα της σκηνής
   * απλώνει ~12 χλμ γύρω, η στεριά παίρνει τα πραγματικά της ύψη και η ομίχλη αραιώνει
   * ώστε να φαίνονται βουνά και απέναντι ακτές.
   */
  relief?: (x: number, y: number) => number | null;
  /** Μέτρα ανά μονάδα κουτιού — χρειάζεται για να μεταφραστούν τα ύψη και οι αποστάσεις. */
  metresPerUnit?: number;
  /** (x, y) του κουτιού → (u, v) στη δορυφορική υφή, ή null έξω από αυτήν. */
  satelliteUv?: (x: number, y: number) => [number, number] | null;
  /** Το ίδιο για την υψηλής ανάλυσης υφή κοντά στην παραλία. */
  satelliteUvNear?: (x: number, y: number) => [number, number] | null;
};


export const createSeaMotionGl = (
  canvas: HTMLCanvasElement,
  points: Point[],
  seed: number,
  options: SeaMotionGlOptions = { grid: 0.12 }
): SeaMotionGl | null => {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: false })) as WebGLRenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;
  if (!gl.getExtension('OES_standard_derivatives')) return null;

  const terrain = link(gl, TERRAIN_VS, TERRAIN_FS);
  const sky = link(gl, SKY_VS, SKY_FS);
  const lines = link(gl, LINE_VS, LINE_FS);
  const props = link(gl, PROP_VS, PROP_FS);
  const pointsProgram = link(gl, POINT_VS, POINT_FS);
  const terrainDepth = link(gl, TERRAIN_VS, DEPTH_FS);
  const propsDepth = link(gl, PROP_VS, `#define SHADOW_PASS\n${PROP_FS}`);
  const fxaa = link(gl, FXAA_VS, FXAA_FS);
  if (!terrain || !sky || !lines || !props || !pointsProgram || !terrainDepth || !propsDepth || !fxaa) return null;

  const wideIndices = Boolean(gl.getExtension('OES_element_index_uint'));
  const metresPerUnit = options.metresPerUnit && options.metresPerUnit > 0 ? options.metresPerUnit : 5;
  const waveUnits = waveUnitsFor(metresPerUnit);
  // Κοφτό κύμα ανέμου: ~15 εκ. πλάτος στα 45 km/h, πάνω από το κύμα της θάλασσας.
  const chopUnits = (0.15 * WAVE_EXAGGERATION) / metresPerUnit;
  const relief = wideIndices ? options.relief : undefined;
  const mesh = buildMesh(points, seed, wideIndices ? 1 : 1.5, wideIndices, relief, metresPerUnit, options.satelliteUv, options.satelliteUvNear);
  if (!wideIndices && mesh.count > 65535) return null;
  // Με ανάγλυφο η ομίχλη φτάνει 14 χλμ, ώστε να φαίνονται βουνά και απέναντι ακτές· χωρίς,
  // σβήνει το νερό λίγο πριν την άκρη του πλέγματος.
  // Η άκρη του πλέγματος πέφτει ΑΚΡΙΒΩΣ εκεί που η ομίχλη γίνεται 100% — δεν φαίνεται ποτέ.
  const fogNear = relief ? 260 : 170;
  const fogFar = relief ? RELIEF_REACH_M / metresPerUnit : 520;
  const fogMax = 1.0;

  // Η ΘΕΣΗ ΑΝΑΠΑΥΣΗΣ ΤΗΣ ΚΑΜΕΡΑΣ: πάνω στην άμμο, 8 μ. πίσω από τη γραμμή του νερού (λίγα
  // βήματα από το νερό — από τα 30 μ. η θάλασσα γινόταν μια λωρίδα), στο ύψος ματιού (1,6 μ.,
  // με την κοινή μεγέθυνση 1,5×) πάνω από το έδαφος ΕΚΕΙ — όχι πάνω από τη θάλασσα. Κοιτά προς
  // τα ανοιχτά με 6° κλίση προς τα κάτω: ο ορίζοντας στο πάνω τρίτο, η ζώνη που σπάει το κύμα
  // στη μέση του κάδρου, λίγη άμμος από κάτω.
  const restX = SHORELINE_BOX.pinX;
  const restY = shoreYAt(points, restX) + 8 / metresPerUnit;
  const eyeAbove = (1.6 * WAVE_EXAGGERATION) / metresPerUnit;
  const restEyeZ = groundZAt(mesh, restX, restY) + eyeAbove;
  const lookAhead = 60;
  const cameraRest: CameraRest = {
    eye: [restX, restY, restEyeZ],
    target: [restX, restY - lookAhead, restEyeZ - lookAhead * Math.tan((6 * Math.PI) / 180)],
  };
  // Το κοντινό επίπεδο κοπής ακολουθεί το ύψος του ματιού: η άμμος στο κάτω μέρος του κάδρου
  // απέχει ~1,9× το ύψος (κλίση 27° κάτω από τον ορίζοντα), άρα 1,4× δεν κόβει ποτέ.
  const nearPlane = Math.min(2.5, Math.max(0.7, eyeAbove * 1.4));

  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  const skyVbo = gl.createBuffer();
  const lineVbo = gl.createBuffer();
  const propVbo = gl.createBuffer();
  const pointVbo = gl.createBuffer();
  const satTexture = gl.createTexture();
  const satNearTexture = gl.createTexture();
  if (!vbo || !ibo || !skyVbo || !lineVbo || !propVbo || !pointVbo || !satTexture || !satNearTexture) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, propVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  let hasSat = false;
  let hasSatNear = false;

  // Ο χάρτης σκιάς: 1024² RGBA με βάθος πακεταρισμένο, plus renderbuffer βάθους για το z-test.
  const SHADOW_SIZE = 1024;
  const shadowTexture = gl.createTexture();
  const shadowFbo = gl.createFramebuffer();
  const shadowDepth = gl.createRenderbuffer();
  if (!shadowTexture || !shadowFbo || !shadowDepth) return null;
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindRenderbuffer(gl.RENDERBUFFER, shadowDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_SIZE, SHADOW_SIZE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowDepth);
  const shadowsOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Η σκηνή ζωγραφίζεται σε υφή και περνά από FXAA πριν φτάσει στην οθόνη.
  const sceneTexture = gl.createTexture();
  const sceneFbo = gl.createFramebuffer();
  const sceneDepth = gl.createRenderbuffer();
  if (!sceneTexture || !sceneFbo || !sceneDepth) return null;
  let sceneOk = false;

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const u = (program: WebGLProgram, name: string) => gl!.getUniformLocation(program, name);
  const a = (program: WebGLProgram, name: string) => gl!.getAttribLocation(program, name);

  /** Οι κοινές θέσεις του vertex shader του εδάφους — τις θέλουν και η σκηνή και ο χάρτης σκιάς. */
  const terrainVertexLocations = (program: WebGLProgram) => ({
    aPos: a(program, 'aPos'), aDist: a(program, 'aDist'), aShore: a(program, 'aShore'), aNoise: a(program, 'aNoise'),
    aHeight: a(program, 'aHeight'), aUv: a(program, 'aUv'), aUv2: a(program, 'aUv2'), aNormal: a(program, 'aNormal'), aAo: a(program, 'aAo'),
    uProj: u(program, 'uProj'), uView: u(program, 'uView'), uLightVP: u(program, 'uLightVP'), uTime: u(program, 'uTime'),
    uWaveDir: u(program, 'uWaveDir'), uArriving: u(program, 'uArriving'), uK: u(program, 'uK'), uOmega: u(program, 'uOmega'),
    uOpenAmp: u(program, 'uOpenAmp'), uShoreAmp: u(program, 'uShoreAmp'), uHasWaves: u(program, 'uHasWaves'),
    uWaveUnits: u(program, 'uWaveUnits'), uChopUnits: u(program, 'uChopUnits'),
    uWindDir: u(program, 'uWindDir'), uWindAmp: u(program, 'uWindAmp'), uOffshore: u(program, 'uOffshore'),
    uRipSpeed: u(program, 'uRipSpeed'), uBreakZone: u(program, 'uBreakZone'), uFoam: u(program, 'uFoam'),
  });
  type TerrainVertexLocations = ReturnType<typeof terrainVertexLocations>;
  const TD = terrainVertexLocations(terrainDepth);
  const STRIDE = 15 * 4;
  const bindTerrainAttribs = (L: TerrainVertexLocations) => {
    gl!.bindBuffer(gl!.ARRAY_BUFFER, vbo);
    gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, ibo);
    const attribs: Array<[number, number, number]> = [
      [L.aPos, 2, 0], [L.aDist, 1, 8], [L.aShore, 2, 12], [L.aNoise, 1, 20], [L.aHeight, 1, 24],
      [L.aUv, 2, 28], [L.aUv2, 2, 36], [L.aNormal, 3, 44], [L.aAo, 1, 56],
    ];
    for (const [loc, size, offset] of attribs) {
      if (loc < 0) continue;
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, STRIDE, offset);
    }
  };
  const unbindTerrainAttribs = (L: TerrainVertexLocations) => {
    for (const loc of [L.aPos, L.aDist, L.aShore, L.aNoise, L.aHeight, L.aUv, L.aUv2, L.aNormal, L.aAo]) {
      if (loc >= 0) gl!.disableVertexAttribArray(loc);
    }
  };
  const uploadTerrainVertexUniforms = (L: TerrainVertexLocations, m: ReturnType<typeof deriveMotion>, tSec: number, projM: Float32Array, viewM: Float32Array, lightVP: Float32Array) => {
    gl!.uniformMatrix4fv(L.uProj, false, projM);
    gl!.uniformMatrix4fv(L.uView, false, viewM);
    gl!.uniformMatrix4fv(L.uLightVP, false, lightVP);
    gl!.uniform1f(L.uTime, tSec);
    gl!.uniform2f(L.uWaveDir, m.tx, m.ty);
    gl!.uniform1f(L.uArriving, m.arriving ? 1 : 0);
    gl!.uniform1f(L.uK, m.kWave);
    gl!.uniform1f(L.uOmega, m.omega);
    gl!.uniform1f(L.uOpenAmp, m.openAmp);
    gl!.uniform1f(L.uShoreAmp, m.shoreAmp);
    gl!.uniform1f(L.uHasWaves, m.hasWaves ? 1 : 0);
    gl!.uniform1f(L.uWaveUnits, waveUnits);
    gl!.uniform1f(L.uChopUnits, chopUnits);
    gl!.uniform2f(L.uWindDir, m.wx, m.wy);
    gl!.uniform1f(L.uWindAmp, m.windAmp);
    gl!.uniform1f(L.uOffshore, m.offshoreWind ? 1 : 0);
    gl!.uniform1f(L.uRipSpeed, m.ripSpeed);
    gl!.uniform1f(L.uBreakZone, m.breakZone);
    gl!.uniform1f(L.uFoam, m.foamStrength);
  };

  const T = {
    ...terrainVertexLocations(terrain),
    uEye: u(terrain, 'uEye'), uLight: u(terrain, 'uLight'), uWhitecaps: u(terrain, 'uWhitecaps'),
    uResolution: u(terrain, 'uResolution'), uGrid: u(terrain, 'uGrid'),
    uFogNear: u(terrain, 'uFogNear'), uFogFar: u(terrain, 'uFogFar'), uFogMax: u(terrain, 'uFogMax'), uMetresPerUnit: u(terrain, 'uMetresPerUnit'),
    uDayLight: u(terrain, 'uDayLight'), uCloudCover: u(terrain, 'uCloudCover'), uShallowReach: u(terrain, 'uShallowReach'),
    uSat: u(terrain, 'uSat'), uHasSat: u(terrain, 'uHasSat'), uSat2: u(terrain, 'uSat2'), uHasSat2: u(terrain, 'uHasSat2'),
    uShadowMap: u(terrain, 'uShadowMap'), uHasShadow: u(terrain, 'uHasShadow'), uShadowTexel: u(terrain, 'uShadowTexel'), uRunup: u(terrain, 'uRunup'),
  };
  const PD = {
    aCorner: a(propsDepth, 'aCorner'), uProj: u(propsDepth, 'uProj'), uView: u(propsDepth, 'uView'), uBase: u(propsDepth, 'uBase'),
    uRight: u(propsDepth, 'uRight'), uSize: u(propsDepth, 'uSize'), uKind: u(propsDepth, 'uKind'), uTime: u(propsDepth, 'uTime'),
  };
  const F = { aClip: a(fxaa, 'aClip'), uTex: u(fxaa, 'uTex'), uInvRes: u(fxaa, 'uInvRes') };
  const P = {
    aCorner: a(props, 'aCorner'), uProj: u(props, 'uProj'), uView: u(props, 'uView'), uBase: u(props, 'uBase'),
    uRight: u(props, 'uRight'), uSize: u(props, 'uSize'), uKind: u(props, 'uKind'), uDayLight: u(props, 'uDayLight'),
    uTime: u(props, 'uTime'),
  };
  const Pt = {
    aPos: a(pointsProgram, 'aPos'), aAlpha: a(pointsProgram, 'aAlpha'), uProj: u(pointsProgram, 'uProj'),
    uView: u(pointsProgram, 'uView'), uPointScale: u(pointsProgram, 'uPointScale'),
  };
  // uWindDir, uRipSpeed και uTime διαβάζονται και από τους δύο shaders — μία τοποθεσία ο καθένας.
  const S = {
    aClip: a(sky, 'aClip'), uCamRight: u(sky, 'uCamRight'), uCamUp: u(sky, 'uCamUp'), uCamFwd: u(sky, 'uCamFwd'),
    uTanHalf: u(sky, 'uTanHalf'), uLight: u(sky, 'uLight'), uTime: u(sky, 'uTime'),
    uDayLight: u(sky, 'uDayLight'), uCloudCover: u(sky, 'uCloudCover'),
  };
  const Ln = { aPos: a(lines, 'aPos'), aAlpha: a(lines, 'aAlpha'), uProj: u(lines, 'uProj'), uView: u(lines, 'uView'), uColor: u(lines, 'uColor') };

  let width = canvas.width;
  let height = canvas.height;
  let proj = new Float32Array(16);
  let fovy = 46;
  let distanceScale = 1;
  let heightScale = 1;
  let tanHalfX = 0;
  let tanHalfY = 0;
  // Όρθια οθόνη: το ίδιο κάθετο άνοιγμα θα έκοβε τα πλάγια και θα έφερνε την κάμερα «μέσα» στο
  // κύμα. Ανοίγει λίγο ο φακός και τραβιέται πίσω η κάμερα, ώστε η παραλία να χωρά ολόκληρη.
  const applySize = (w: number, h: number) => {
    width = Math.max(16, Math.round(w));
    height = Math.max(16, Math.round(h));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const aspect = width / height;
    // Φακός 38°–58°: λίγο πιο «κλειστός» από πριν, όπως το βλέμμα που κοιτά τη θάλασσα.
    fovy = Math.min(58, Math.max(38, 38 * Math.sqrt(1.8 / aspect)));
    distanceScale = aspect < 1 ? 1.3 : aspect < 1.6 ? 1.12 : 1;
    heightScale = aspect < 1 ? 0.7 : 1;
    proj = perspective(fovy, aspect, nearPlane, relief ? 40000 : 1400);
    tanHalfY = Math.tan((fovy * Math.PI) / 360);
    tanHalfX = tanHalfY * aspect;
    // Η υφή της σκηνής ακολουθεί το μέγεθος του καμβά.
    gl!.bindTexture(gl!.TEXTURE_2D, sceneTexture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, width, height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.bindRenderbuffer(gl!.RENDERBUFFER, sceneDepth);
    gl!.renderbufferStorage(gl!.RENDERBUFFER, gl!.DEPTH_COMPONENT16, width, height);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, sceneFbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, sceneTexture, 0);
    gl!.framebufferRenderbuffer(gl!.FRAMEBUFFER, gl!.DEPTH_ATTACHMENT, gl!.RENDERBUFFER, sceneDepth);
    sceneOk = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
  };
  applySize(width, height);

  const streaks: Streak[] = [];
  // 30 ρεύματα × 6 κορυφές × (x, y, z, alpha), συν 2 πουλιά × 2 φτερά × 6 κορυφές
  const lineData = new Float32Array((30 + 4) * 6 * 4);
  // Σταγονίδια: ως 160, (x, y, z, vx, vy, vz, age, life)
  const MAX_SPRAY = 160;
  const spray: number[] = [];
  const pointData = new Float32Array(MAX_SPRAY * 4);
  const personHeight = (1.75 * WAVE_EXAGGERATION) / metresPerUnit;
  const umbrellaHeight = (2.2 * WAVE_EXAGGERATION) / metresPerUnit;
  const area = { x0: -40, x1: 240, y0: -90, y1: 125 };
  // Τα κατακόρυφα των μικρών πραγμάτων (ρεύματα ανέμου, σταγόνες) στην ίδια κλίμακα.
  const vScale = WAVE_EXAGGERATION / metresPerUnit;
  // Ο άνθρωπος ΜΕΣΑ στο νερό, 10 μ. από την ακτή, λίγο αριστερά — το μέτρο του κύματος: η
  // θάλασσα του κρύβει τα πόδια ως εκεί που λέει το HUD, και το κύμα ανεβαίνει πάνω του.
  // Στέκεται στον πάτο (~0,35 μ. βάθος)· η επιφάνεια του νερού κρύβει ό,τι είναι από κάτω.
  const personBase = [99.2, shoreYAt(points, 99.2) - 10 / metresPerUnit, -(0.35 * WAVE_EXAGGERATION) / metresPerUnit];
  // Η ομπρέλα στην άμμο δεξιά, λίγο πίσω από την κάμερα: φαίνεται από το drone, όχι στο τέλος.
  const umbrellaBase = [103, shoreYAt(points, 103) + 1.6, 0];
  umbrellaBase[2] = groundZAt(mesh, umbrellaBase[0], umbrellaBase[1]) + 0.05;

  let disposed = false;

  const render = (params: SeaMotionParams, tSec: number, dtSec: number) => {
    if (disposed || !gl) return;
    const m = deriveMotion(params);
    const windShake = clamp01((m.windSpeed - 22) / 30) * 0.9;
    // Ο ήλιος: από αζιμούθιο/ύψος στο πλαίσιο του κουτιού (πάνω = facingDeg). Νύχτα: το φως
    // μένει λίγο πάνω από τον ορίζοντα για τη λάμψη, αλλά το dayLight σβήνει τη σκηνή.
    let light = LIGHT;
    let dayLight = 1;
    if (typeof params.sunAzimuthDeg === 'number' && typeof params.sunElevationDeg === 'number') {
      const el = Math.max(4, params.sunElevationDeg) * (Math.PI / 180);
      const rel = ((params.sunAzimuthDeg - params.facingDeg) * Math.PI) / 180;
      light = [Math.sin(rel) * Math.cos(el), -Math.cos(rel) * Math.cos(el), Math.sin(el)];
      dayLight = clamp01((params.sunElevationDeg + 4) / 18);
    }
    const cloudCover = clamp01(params.cloudCover ?? 0.1);
    const shallowReach = params.shallowReach ?? 110;
    const pose = cameraPose(tSec, distanceScale, heightScale, windShake, cameraRest);
    const eye = pose.eye;
    const view = lookAt(eye, pose.target, [0, 0, 1]);
    // Η βάση της κάμερας για τον ουρανό (ακτίνα ανά εικονοστοιχείο).
    const f = [pose.target[0] - eye[0], pose.target[1] - eye[1], pose.target[2] - eye[2]];
    const fl = Math.hypot(f[0], f[1], f[2]) || 1;
    const fwd = [f[0] / fl, f[1] / fl, f[2] / fl];
    const rgt = [fwd[1], -fwd[0], 0];
    const rl = Math.hypot(rgt[0], rgt[1]) || 1;
    rgt[0] /= rl; rgt[1] /= rl;
    const up = [rgt[1] * fwd[2] - rgt[2] * fwd[1], rgt[2] * fwd[0] - rgt[0] * fwd[2], rgt[0] * fwd[1] - rgt[1] * fwd[0]];

    // Ο ΧΑΡΤΗΣ ΣΚΙΑΣ: το έδαφος, το νερό, ο άνθρωπος και η ομπρέλα από τη μεριά του ήλιου.
    // Ορθογραφική προβολή ±340 μονάδες γύρω από την παραλία — ό,τι βλέπει η κάμερα κοντά.
    const shadowCenter = [100, 20, 0];
    const lightEye = [shadowCenter[0] + light[0] * 700, shadowCenter[1] + light[1] * 700, shadowCenter[2] + light[2] * 700];
    const lightUp = Math.abs(light[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
    const lightView = lookAt(lightEye, shadowCenter, lightUp);
    const lightProj = ortho(-340, 340, -340, 340, 200, 1300);
    const lightVP = mul4(lightProj, lightView);
    const personHalfW = personHeight * 0.35;
    // Σκιά μόνο με ήλιο πάνω από τον ορίζοντα· τη νύχτα δεν υπάρχει.
    const useShadows = shadowsOk && dayLight > 0.05;
    if (useShadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.clearColor(1, 1, 1, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(terrainDepth);
      bindTerrainAttribs(TD);
      uploadTerrainVertexUniforms(TD, m, tSec, lightProj, lightView, lightVP);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, wideIndices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
      unbindTerrainAttribs(TD);
      // Ο άνθρωπος και η ομπρέλα κοιτούν τον ήλιο στη σκιά, ώστε να ρίξουν ολόκληρη σιλουέτα.
      const lr = [-light[1], light[0], 0];
      const lrl = Math.hypot(lr[0], lr[1]) || 1;
      gl.useProgram(propsDepth);
      gl.bindBuffer(gl.ARRAY_BUFFER, propVbo);
      gl.enableVertexAttribArray(PD.aCorner);
      gl.vertexAttribPointer(PD.aCorner, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(PD.uProj, false, lightProj);
      gl.uniformMatrix4fv(PD.uView, false, lightView);
      gl.uniform3f(PD.uRight, lr[0] / lrl, lr[1] / lrl, 0);
      gl.uniform1f(PD.uTime, tSec);
      gl.uniform3f(PD.uBase, personBase[0], personBase[1], personBase[2]);
      gl.uniform2f(PD.uSize, personHalfW * 2, personHeight);
      gl.uniform1f(PD.uKind, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform3f(PD.uBase, umbrellaBase[0], umbrellaBase[1], umbrellaBase[2]);
      gl.uniform2f(PD.uSize, umbrellaHeight, umbrellaHeight);
      gl.uniform1f(PD.uKind, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(PD.aCorner);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Η ΣΚΗΝΗ ζωγραφίζεται στην υφή της (για το FXAA), αλλιώς κατευθείαν στον καμβά.
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneOk ? sceneFbo : null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);

    // Ουρανός: γεμίζει το κάδρο πίσω από όλα.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(sky);
    gl.uniform3f(S.uCamRight, rgt[0], rgt[1], rgt[2]);
    gl.uniform3f(S.uCamUp, up[0], up[1], up[2]);
    gl.uniform3f(S.uCamFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform2f(S.uTanHalf, tanHalfX, tanHalfY);
    gl.uniform3f(S.uLight, light[0], light[1], light[2]);
    gl.uniform1f(S.uTime, tSec);
    gl.uniform1f(S.uDayLight, dayLight);
    gl.uniform1f(S.uCloudCover, cloudCover);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
    gl.enableVertexAttribArray(S.aClip);
    gl.vertexAttribPointer(S.aClip, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(S.aClip);

    // Θάλασσα και στεριά.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(terrain);
    bindTerrainAttribs(T);
    uploadTerrainVertexUniforms(T, m, tSec, proj, view, lightVP);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, satTexture);
    gl.uniform1i(T.uSat, 0);
    gl.uniform1f(T.uHasSat, hasSat ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, satNearTexture);
    gl.uniform1i(T.uSat2, 1);
    gl.uniform1f(T.uHasSat2, hasSatNear ? 1 : 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.uniform1i(T.uShadowMap, 2);
    gl.uniform1f(T.uHasShadow, useShadows ? 1 : 0);
    gl.uniform1f(T.uShadowTexel, 1 / SHADOW_SIZE);
    // Ως πού ανεβαίνει το νερό στην άμμο, σε μέτρα οριζόντια (2 μ. + 10 μ. ανά μέτρο κύματος).
    gl.uniform1f(T.uRunup, (2 + (params.shoreWaveM ?? params.openWaveM ?? 0) * 10) / metresPerUnit);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(T.uDayLight, dayLight);
    gl.uniform1f(T.uCloudCover, cloudCover);
    gl.uniform1f(T.uShallowReach, shallowReach);

    gl.uniform3f(T.uEye, eye[0], eye[1], eye[2]);
    gl.uniform2f(T.uResolution, width, height);
    gl.uniform1f(T.uGrid, options.grid);
    gl.uniform1f(T.uFogNear, fogNear);
    gl.uniform1f(T.uFogFar, fogFar);
    gl.uniform1f(T.uFogMax, fogMax);
    gl.uniform1f(T.uMetresPerUnit, metresPerUnit);
    gl.uniform3f(T.uLight, light[0], light[1], light[2]);
    gl.uniform1f(T.uWhitecaps, m.whitecaps);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, wideIndices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    unbindTerrainAttribs(T);

    // Ο άνθρωπος στη γραμμή του νερού και η ομπρέλα στην άμμο — κλίμακα με ένα βλέμμα.
    gl.useProgram(props);
    gl.bindBuffer(gl.ARRAY_BUFFER, propVbo);
    gl.enableVertexAttribArray(P.aCorner);
    gl.vertexAttribPointer(P.aCorner, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(P.uProj, false, proj);
    gl.uniformMatrix4fv(P.uView, false, view);
    gl.uniform3f(P.uRight, rgt[0], rgt[1], rgt[2]);
    gl.uniform1f(P.uDayLight, dayLight);
    gl.uniform1f(P.uTime, tSec);
    // Στη γραμμή του νερού, ολόκληρος: το κύμα ανεβαίνει ως εκεί που λέει το HUD.
    gl.uniform3f(P.uBase, personBase[0], personBase[1], personBase[2]);
    gl.uniform2f(P.uSize, personHalfW * 2, personHeight);
    gl.uniform1f(P.uKind, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.uniform3f(P.uBase, umbrellaBase[0], umbrellaBase[1], umbrellaBase[2]);
    gl.uniform2f(P.uSize, umbrellaHeight, umbrellaHeight);
    gl.uniform1f(P.uKind, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(P.aCorner);

    // Τα ρεύματα του ανέμου, λίγο πάνω από το νερό.
    if (m.hasWind && m.windAmp > 0) {
      const wanted = Math.min(30, Math.max(2, Math.round(m.windSpeed / 2.2)));
      while (streaks.length < wanted) streaks.push(spawnStreak(m.wx, m.wy, m.windSpeed, true, area, vScale * 0.5));
      while (streaks.length > wanted) streaks.pop();
      const speed = 8 + m.windSpeed * 0.6;
      let n = 0;
      for (let s = 0; s < streaks.length; s += 1) {
        const streak = streaks[s];
        streak.age += dtSec;
        streak.x += m.wx * speed * dtSec;
        streak.y += m.wy * speed * dtSec;
        const out = streak.x < area.x0 - 20 || streak.x > area.x1 + 20 || streak.y < area.y0 - 20 || streak.y > area.y1 + 20;
        if (streak.age > streak.life || out) {
          streaks[s] = spawnStreak(m.wx, m.wy, m.windSpeed, false, area, vScale * 0.5);
          continue;
        }
        const fade = Math.sin((streak.age / streak.life) * Math.PI) * (0.5 + 0.45 * m.windAmp);
        // Ουρά διάφανη, κεφαλή φωτεινή· πάχος ~1 μ. κάθετα στην κίνηση.
        const hw = 0.7 * vScale;
        const px = -m.wy * hw;
        const py = m.wx * hw;
        const tailX = streak.x - m.wx * streak.len;
        const tailY = streak.y - m.wy * streak.len;
        const z = streak.z;
        const put = (x: number, y: number, alpha: number) => {
          lineData[n++] = x; lineData[n++] = y; lineData[n++] = z; lineData[n++] = alpha;
        };
        put(tailX + px, tailY + py, 0);
        put(tailX - px, tailY - py, 0);
        put(streak.x + px, streak.y + py, fade);
        put(tailX - px, tailY - py, 0);
        put(streak.x - px, streak.y - py, fade);
        put(streak.x + px, streak.y + py, fade);
      }
      if (n > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(lines);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
        gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(Ln.aPos);
        gl.vertexAttribPointer(Ln.aPos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(Ln.aAlpha);
        gl.vertexAttribPointer(Ln.aAlpha, 1, gl.FLOAT, false, 16, 12);
        gl.uniformMatrix4fv(Ln.uProj, false, proj);
        gl.uniformMatrix4fv(Ln.uView, false, view);
        gl.uniform3f(Ln.uColor, 1, 1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, n / 4);
        gl.disableVertexAttribArray(Ln.aPos);
        gl.disableVertexAttribArray(Ln.aAlpha);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    } else {
      streaks.length = 0;
    }

    // Δύο γλάροι που παλεύουν με τον αέρα (πιο γρήγορο φτερούγισμα όσο φυσάει).
    {
      let n = 0;
      const flap = Math.sin(tSec * (5 + m.windSpeed * 0.1));
      for (let b = 0; b < 2; b += 1) {
        const phase = tSec * 0.12 + b * 2.1;
        const cx = 100 + Math.cos(phase) * (40 + b * 25) - m.wx * 10;
        const cy = 30 + Math.sin(phase * 0.7) * 25 - m.wy * 10;
        const cz = 24 + b * 6 + Math.sin(tSec * 0.9 + b) * 2;
        const span = 2.6;
        const put = (x: number, y: number, z: number, alpha: number) => {
          lineData[n++] = x; lineData[n++] = y; lineData[n++] = z; lineData[n++] = alpha;
        };
        for (const side of [-1, 1]) {
          const tipX = cx + rgt[0] * span * side;
          const tipY = cy + rgt[1] * span * side;
          const tipZ = cz + flap * 1.1;
          const hw = 0.28;
          put(cx, cy, cz + hw, 0.9); put(cx, cy, cz - hw, 0.9); put(tipX, tipY, tipZ, 0.9);
          put(cx, cy, cz - hw, 0.9); put(tipX, tipY, tipZ - hw * 0.5, 0.9); put(tipX, tipY, tipZ, 0.9);
        }
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lines);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
      gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, n), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(Ln.aPos);
      gl.vertexAttribPointer(Ln.aPos, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(Ln.aAlpha);
      gl.vertexAttribPointer(Ln.aAlpha, 1, gl.FLOAT, false, 16, 12);
      gl.uniformMatrix4fv(Ln.uProj, false, proj);
      gl.uniformMatrix4fv(Ln.uView, false, view);
      gl.uniform3f(Ln.uColor, 0.16, 0.17, 0.2);
      gl.drawArrays(gl.TRIANGLES, 0, n / 4);
      gl.disableVertexAttribArray(Ln.aPos);
      gl.disableVertexAttribArray(Ln.aAlpha);
      gl.disable(gl.BLEND);
    }

    // Σταγονίδια από τις άσπρες κορφές: γεννιούνται στο νερό μπροστά από την κάμερα, τα
    // παίρνει ο άνεμος, πέφτουν. Πλήθος ανάλογο του ανέμου πάνω από ~4 Μπφ.
    if (m.whitecaps > 0) {
      const born = Math.min(6, Math.round(m.whitecaps * 14));
      for (let i = 0; i < born && spray.length < MAX_SPRAY * 8; i += 1) {
        const x = rand(40, 160);
        const y = rand(-40, 70);
        // Ταχύτητες σε μονάδες/s από μέτρα: ο άνεμος (km/h → m/s) και μια εκτόξευση 3–6 μ./s.
        const windU = ((m.windSpeed / 3.6) * 0.8) / metresPerUnit;
        spray.push(x, y, 0.4 * vScale, m.wx * windU + rand(-0.5, 0.5) * vScale, m.wy * windU + rand(-0.5, 0.5) * vScale, rand(3, 6) * vScale, 0, rand(0.6, 1.3));
      }
    }
    {
      let n = 0;
      for (let i = 0; i < spray.length; i += 8) {
        spray[i + 6] += dtSec;
        if (spray[i + 6] > spray[i + 7]) {
          spray.splice(i, 8);
          i -= 8;
          continue;
        }
        spray[i] += spray[i + 3] * dtSec;
        spray[i + 1] += spray[i + 4] * dtSec;
        spray[i + 5] -= 9.8 * vScale * dtSec;
        spray[i + 2] += spray[i + 5] * dtSec;
        const fade = 1 - spray[i + 6] / spray[i + 7];
        pointData[n++] = spray[i]; pointData[n++] = spray[i + 1]; pointData[n++] = Math.max(0.1 * vScale, spray[i + 2]); pointData[n++] = 0.75 * fade;
      }
      if (n > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(pointsProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointVbo);
        gl.bufferData(gl.ARRAY_BUFFER, pointData.subarray(0, n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(Pt.aPos);
        gl.vertexAttribPointer(Pt.aPos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(Pt.aAlpha);
        gl.vertexAttribPointer(Pt.aAlpha, 1, gl.FLOAT, false, 16, 12);
        gl.uniformMatrix4fv(Pt.uProj, false, proj);
        gl.uniformMatrix4fv(Pt.uView, false, view);
        gl.uniform1f(Pt.uPointScale, height * 0.9);
        gl.drawArrays(gl.POINTS, 0, n / 4);
        gl.disableVertexAttribArray(Pt.aPos);
        gl.disableVertexAttribArray(Pt.aAlpha);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    }

    // FXAA: από την υφή της σκηνής στον καμβά, με τις ακμές εξομαλυμένες.
    if (sceneOk) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(fxaa);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.uniform1i(F.uTex, 0);
      gl.uniform2f(F.uInvRes, 1 / width, 1 / height);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
      gl.enableVertexAttribArray(F.aClip);
      gl.vertexAttribPointer(F.aClip, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(F.aClip);
      gl.depthMask(true);
    }
  };

  const setSatellite = (source: TexImageSource | null, near = false) => {
    if (disposed || !gl) return;
    if (!source) {
      if (near) hasSatNear = false;
      else hasSat = false;
      return;
    }
    try {
      gl.bindTexture(gl.TEXTURE_2D, near ? satNearTexture : satTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (near) hasSatNear = true;
      else hasSat = true;
    } catch {
      if (near) hasSatNear = false;
      else hasSat = false;
    }
  };

  const dispose = () => {
    if (disposed || !gl) return;
    disposed = true;
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
    gl.deleteBuffer(skyVbo);
    gl.deleteBuffer(lineVbo);
    gl.deleteBuffer(propVbo);
    gl.deleteBuffer(pointVbo);
    gl.deleteTexture(satTexture);
    gl.deleteTexture(satNearTexture);
    gl.deleteTexture(shadowTexture);
    gl.deleteFramebuffer(shadowFbo);
    gl.deleteRenderbuffer(shadowDepth);
    gl.deleteTexture(sceneTexture);
    gl.deleteFramebuffer(sceneFbo);
    gl.deleteRenderbuffer(sceneDepth);
    gl.deleteProgram(terrainDepth);
    gl.deleteProgram(propsDepth);
    gl.deleteProgram(fxaa);
    gl.deleteProgram(terrain);
    gl.deleteProgram(sky);
    gl.deleteProgram(lines);
    gl.deleteProgram(props);
    gl.deleteProgram(pointsProgram);
    // Ένα ταμπελάκι ανοιγοκλείνει πολλές φορές: το context απελευθερώνεται ρητά, όχι στον GC.
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  };

  const setSize = (w: number, h: number) => {
    if (disposed) return;
    applySize(w, h);
  };

  return { render, setSize, setSatellite, dispose };
};

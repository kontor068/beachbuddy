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
};

export type Point = [number, number];

export type SeaMotionGl = {
  render: (params: SeaMotionParams, tSec: number, dtSec: number) => void;
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

/** Ύψος θάλασσας → ένταση 0..1, με ρίζα ώστε τα 0,3 μ. να φαίνονται και τα 2 μ. να μη σβήνουν. */
export const heightToAmp = (h: number | undefined) =>
  typeof h === 'number' && Number.isFinite(h) ? clamp01(Math.sqrt(Math.max(0, h) / 1.6)) : 0;

export const REFRACTION_UNITS = 38;
export const WIND_SHADOW_UNITS = 34;
/** Υπερβολή ύψους του ανάγλυφου: 1,25× — τα ελληνικά βουνά δίπλα στη θάλασσα είναι ήδη δραματικά. */
const RELIEF_EXAGGERATION = 1.25;
/** Ως πού απλώνει το πλέγμα (και η ομίχλη) όταν υπάρχει ανάγλυφο: απέναντι ακτές ως 16 χλμ. */
const RELIEF_REACH_M = 16000;

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
  const wavelength = Math.min(34, Math.max(12, realWavelength));
  const kWave = (2 * Math.PI) / wavelength;
  const omega = ((2 * Math.PI) / p.periodS) * 1.4;
  const windSpeed = p.windSpeedKmh;
  const hasWind = typeof windSpeed === 'number' && Number.isFinite(windSpeed) && typeof p.windFromDeg === 'number';
  const [wx, wy] = hasWind ? travelVector(p.windFromDeg as number, p.facingDeg) : [0, 0];
  const windAmp = hasWind ? Math.pow(clamp01((windSpeed as number) / 45), 0.8) : 0;
  const offshoreWind = hasWind && seawardness(p.windFromDeg as number, p.facingDeg) < -0.15;
  const ripSpeed = hasWind ? 4 + (windSpeed as number) * 0.35 : 0;
  const whitecaps = Math.max(0, windAmp - 0.55) * 0.5;
  const breakZone = Math.min(20, 2 + (p.shoreWaveM ?? 0) * 9);
  const foamStrength = clamp01((p.shoreWaveM ?? 0) / 1.0);
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
export const spawnStreak = (wx: number, wy: number, speedKmh: number, anywhere: boolean, area: { x0: number; x1: number; y0: number; y1: number }): Streak => {
  const len = Math.min(18, 5 + speedKmh * 0.15);
  const life = rand(1.6, 3.4);
  const z = rand(2, 9);
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

const TERRAIN_VS = `
precision highp float;
attribute vec2 aPos;
attribute float aDist;
attribute vec2 aShore;
attribute float aNoise;
attribute float aHeight;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
uniform vec2 uWaveDir;
uniform float uArriving;
uniform float uK;
uniform float uOmega;
uniform float uOpenAmp;
uniform float uShoreAmp;
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
varying float vRipPhase;
varying float vShadow;
varying float vClipY;

void main() {
  float d = aDist;
  float z = 0.0;
  vFoam = 0.0;
  vRip = 0.0;
  vRipPhase = 0.0;
  vShadow = 1.0;
  if (d > 0.0) {
    if (uHasWaves > 0.5) {
      float w = uArriving * smoothstep(0.0, 1.0, 1.0 - d / ${REFRACTION_UNITS.toFixed(1)});
      float far = dot(uWaveDir, aPos);
      float farAtShore = dot(uWaveDir, aShore);
      float travelled = mix(far, farAtShore - d, w);
      float phase = uK * travelled - uOmega * uTime;
      float amp = mix(uShoreAmp, uOpenAmp, clamp(d / 45.0, 0.0, 1.0));
      // Λίγο πιο μυτερή κορυφή, πιο πλατιά κοιλάδα — όπως στέκει ένα πραγματικό κύμα.
      z = amp * (sin(phase) + 0.28 * sin(2.0 * phase + 0.7)) * 3.6;
      // Δεύτερο, μικρότερο κύμα λίγο λοξά και λίγο πιο κοντό: η θάλασσα δεν είναι ποτέ ΕΝΑ ημίτονο.
      vec2 crossDir = normalize(uWaveDir + vec2(-uWaveDir.y, uWaveDir.x) * 0.42);
      float crossPhase = uK * 1.6 * mix(dot(crossDir, aPos), dot(crossDir, aShore) - d, w) - uOmega * 1.25 * uTime + 1.3;
      z += amp * sin(crossPhase) * 0.9;
      if (uArriving > 0.5 && d < uBreakZone && uFoam > 0.0) {
        vFoam = uFoam * (0.5 + 0.5 * sin(phase)) * (1.0 - d / uBreakZone);
      }
    }
    float shadow = mix(1.0, clamp(d / ${WIND_SHADOW_UNITS.toFixed(1)}, 0.0, 1.0), uOffshore);
    float gust = 0.55 + 0.45 * sin(0.11 * aPos.x + 0.07 * aPos.y - 0.8 * uTime) * sin(0.09 * aPos.x - 0.13 * aPos.y + 0.5 * uTime);
    float ripA = uWindAmp * shadow * gust;
    // Ο άνεμος σηκώνει και λίγο κοντό «κοφτό» κύμα (μήκος ~7 μονάδες, πάνω από το βήμα του
    // πλέγματος για να μη βγαίνει σκαλοπάτια)· η ψιλή τσαλάκωση γίνεται στον fragment shader.
    float kChop = 0.9;
    float chop = sin(kChop * dot(uWindDir, aPos) - kChop * uRipSpeed * 0.7 * uTime + aNoise * 4.0);
    z += chop * ripA * 0.45;
    vRip = ripA;
    vRipPhase = chop;
    vShadow = shadow;
  } else {
    // Η στεριά: το ύψος ήρθε έτοιμο από τη CPU (ήπια πλαγιά άμμου, ή το πραγματικό ανάγλυφο
    // όπου υπάρχει ψημένο), με λίγο τυχαίο τρέμουλο για να μη γυαλίζει επίπεδη.
    z = aHeight;
  }
  vWorld = vec3(aPos, z);
  vDist = d;
  vNoise = aNoise;
  gl_Position = uProj * uView * vec4(aPos, z, 1.0);
  vClipY = gl_Position.y / max(gl_Position.w, 0.001);
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
varying vec3 vWorld;
varying float vDist;
varying float vNoise;
varying float vFoam;
varying float vRip;
varying float vRipPhase;
varying float vShadow;
varying float vClipY;

// Ίδια συνάρτηση με τον ουρανό: η ομίχλη παίρνει ΑΚΡΙΒΩΣ το χρώμα του ουρανού στο ίδιο ύψος
// της οθόνης, ώστε η άκρη του πλέγματος να μη φαίνεται ποτέ.
vec3 skyAt(float y) {
  vec3 top = vec3(0.30, 0.58, 0.88);
  vec3 horizon = vec3(0.80, 0.90, 0.96);
  return mix(horizon, top, smoothstep(0.05, 1.0, y));
}

void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.z < 0.0) n = -n;
  if (vDist > 0.0 && vRip > 0.0) {
    // Η τσαλάκωση του ανέμου (cat's paws) ως κλίση ανά εικονοστοιχείο: γυαλίζει, δεν σκαλοπατιάζει.
    float kRip = 1.96;
    float ph = kRip * dot(uWindDir, vWorld.xy) - kRip * uRipSpeed * uTime + vNoise * 6.0;
    n = normalize(n + vec3(uWindDir * cos(ph) * vRip * 0.55, 0.0));
  }
  vec3 v = normalize(uEye - vWorld);
  float diffuse = max(dot(n, uLight), 0.0);
  vec3 skyColor = vec3(0.62, 0.80, 0.94);
  vec3 color;
  if (vDist > 0.0) {
    // Ρηχά ανοιχτόχρωμα, βαθύτερα σκούρο μπλε — η παλέτα της μινιατούρας, με βάθος.
    float depth = smoothstep(0.0, 60.0, vDist);
    vec3 shallow = vec3(0.55, 0.85, 0.90);
    vec3 deep = vec3(0.12, 0.42, 0.66);
    color = mix(shallow, deep, depth);
    // Στα πολύ ρηχά φαίνεται η άμμος μέσα από το νερό.
    color = mix(color, vec3(0.80, 0.78, 0.66), smoothstep(7.0, 0.0, vDist) * 0.55);
    // Φως: κοιλάδες πιο σκούρες, κορυφές πιο φωτεινές.
    color *= 0.55 + 0.55 * diffuse;
    // Fresnel: όσο πιο πλάγια κοιτάς το νερό, τόσο περισσότερο καθρεφτίζει τον ουρανό.
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    color = mix(color, skyColor, clamp(fresnel, 0.0, 1.0) * 0.65);
    // Γυαλάδα του ήλιου, και σπινθηρίσματα που τρεμοπαίζουν στις κορυφές.
    vec3 r = reflect(-uLight, n);
    float spec = pow(max(dot(r, v), 0.0), 48.0);
    color += vec3(1.0, 0.98, 0.9) * spec * (0.35 + 0.4 * vRip);
    float sparkle = pow(max(dot(r, v), 0.0), 420.0) * (0.5 + 0.5 * sin(uTime * 7.0 + vNoise * 41.0)) * step(0.45, vNoise);
    color += vec3(1.0) * sparkle * 1.6;
    // Το λεπτό πλέγμα της προσομοίωσης: κάθε 10 μονάδες, σβήνει με την απόσταση.
    if (uGrid > 0.0) {
      vec2 gp = vWorld.xy / 10.0;
      vec2 g = abs(fract(gp) - 0.5) / max(fwidth(gp), vec2(1e-4));
      float line = 1.0 - min(min(g.x, g.y), 1.0);
      color = mix(color, vec3(0.35, 0.95, 1.0), line * uGrid);
    }
    // Αφρός εκεί που σπάει, και μικρές άσπρες κορφές σε δυνατό αέρα.
    float speck = step(vNoise, vFoam * 0.9);
    float white = clamp(vFoam * 0.75 + speck * 0.6, 0.0, 1.0);
    if (uWhitecaps > 0.0 && vRipPhase > 0.6 && vNoise < uWhitecaps * vShadow) white = max(white, 0.8);
    color = mix(color, vec3(1.0), white);
  } else {
    vec3 sand = vec3(0.95, 0.90, 0.80);
    vec3 inland = vec3(0.84, 0.79, 0.66);
    color = mix(sand, inland, smoothstep(0.0, 45.0, -vDist));
    // Πιο ψηλά: θάμνοι και ελιές, μετά γυμνός βράχος — ανά πραγματικό μέτρο ύψους.
    float metres = vWorld.z * uMetresPerUnit / ${RELIEF_EXAGGERATION.toFixed(2)};
    vec3 scrub = vec3(0.56, 0.60, 0.42);
    vec3 rock = vec3(0.64, 0.61, 0.56);
    color = mix(color, scrub, smoothstep(6.0, 40.0, metres));
    color = mix(color, rock, smoothstep(220.0, 700.0, metres));
    // Βρεγμένη άμμος στη γραμμή του νερού.
    if (vDist > -2.5) color = vec3(0.87, 0.83, 0.71);
    color *= 0.6 + 0.45 * diffuse;
  }
  // Ομίχλη προς τον ορίζοντα: το μακρινό νερό χάνεται στον ουρανό.
  float dist = length(uEye - vWorld);
  // Καμπύλη 1,6: η θολούρα μαζεύεται στο τέλος, ώστε ένα βουνό στα 10 χλμ να διαβάζεται ακόμα.
  float fog = pow(smoothstep(uFogNear, uFogFar, dist), 1.6) * uFogMax;
  color = mix(color, skyAt(vClipY), fog);
  // Κινηματογραφικό φινίρισμα: ελαφριά βινιέτα, λίγος κόκκος, λίγο πιο ζεστό φως.
  vec2 uv = gl_FragCoord.xy / uResolution;
  float vig = smoothstep(0.98, 0.35, distance(uv, vec2(0.5)));
  color *= 0.72 + 0.28 * vig;
  float grain = fract(sin(dot(gl_FragCoord.xy + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.03;
  color = mix(color, color * vec3(1.06, 1.0, 0.94), 0.35);
  gl_FragColor = vec4(color, 1.0);
}
`;

const SKY_VS = `
attribute vec2 aClip;
varying float vY;
void main() {
  vY = aClip.y;
  gl_Position = vec4(aClip, 0.9999, 1.0);
}
`;

const SKY_FS = `
precision mediump float;
varying float vY;
void main() {
  // Ο ορίζοντας έχει ΑΚΡΙΒΩΣ το χρώμα της ομίχλης του νερού, ώστε θάλασσα και ουρανός να
  // λιώνουν ο ένας στον άλλο αντί να φαίνεται μια άκρη.
  vec3 top = vec3(0.30, 0.58, 0.88);
  vec3 horizon = vec3(0.80, 0.90, 0.96);
  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.05, 1.0, vY)), 1.0);
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
varying float vAlpha;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
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

const buildMesh = (
  points: Point[],
  seed: number,
  step: number,
  wideIndices: boolean,
  relief: ReliefFn | undefined,
  metresPerUnit: number
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
  const vertices = new Float32Array(cols * rows * 7);

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
        const ramp = Math.min(10, d * 0.24);
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
 * Η κάμερα στέκεται πίσω από την παραλία, λίγο ψηλά — όπως κάποιος σε λόφο πάνω από την άμμο —
 * και κοιτά προς τη θάλασσα. Το κύμα έρχεται ΠΡΟΣ τον θεατή και σπάει μπροστά του.
 */
const TARGET = [100, 22, -4];

/**
 * Η κάμερα ΔΕΝ είναι καρφωμένη: μπαίνει με ένα αργό fly-in (2,8 s, από πιο ψηλά και πιο
 * μακριά) και μετά περιστρέφεται ήπια γύρω από την παραλία, με λίγο ανεβοκατέβασμα — όπως
 * ένα drone που κρατά στόχο. Αυτό είναι που κάνει την εικόνα «βίντεο» αντί για διάγραμμα.
 */
const cameraEye = (tSec: number, distanceScale: number, heightScale: number): number[] => {
  const intro = Math.min(1, tSec / 2.8);
  const ease = intro * intro * (3 - 2 * intro);
  const yaw = Math.sin(tSec * 0.11) * 0.16;
  const radius = (150 + (1 - ease) * 95) * distanceScale;
  const height = (66 + (1 - ease) * 70) * heightScale + Math.sin(tSec * 0.17) * 3;
  return [TARGET[0] + Math.sin(yaw) * radius, TARGET[1] + Math.cos(yaw) * radius, TARGET[2] + height];
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
  if (!terrain || !sky || !lines) return null;

  const wideIndices = Boolean(gl.getExtension('OES_element_index_uint'));
  const metresPerUnit = options.metresPerUnit && options.metresPerUnit > 0 ? options.metresPerUnit : 5;
  const relief = wideIndices ? options.relief : undefined;
  const mesh = buildMesh(points, seed, wideIndices ? 1 : 1.5, wideIndices, relief, metresPerUnit);
  if (!wideIndices && mesh.count > 65535) return null;
  // Με ανάγλυφο η ομίχλη φτάνει 14 χλμ, ώστε να φαίνονται βουνά και απέναντι ακτές· χωρίς,
  // σβήνει το νερό λίγο πριν την άκρη του πλέγματος.
  // Η άκρη του πλέγματος πέφτει ΑΚΡΙΒΩΣ εκεί που η ομίχλη γίνεται 100% — δεν φαίνεται ποτέ.
  const fogNear = relief ? 260 : 170;
  const fogFar = relief ? RELIEF_REACH_M / metresPerUnit : 520;
  const fogMax = 1.0;

  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  const skyVbo = gl.createBuffer();
  const lineVbo = gl.createBuffer();
  if (!vbo || !ibo || !skyVbo || !lineVbo) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const u = (program: WebGLProgram, name: string) => gl!.getUniformLocation(program, name);
  const a = (program: WebGLProgram, name: string) => gl!.getAttribLocation(program, name);

  const T = {
    aPos: a(terrain, 'aPos'), aDist: a(terrain, 'aDist'), aShore: a(terrain, 'aShore'), aNoise: a(terrain, 'aNoise'), aHeight: a(terrain, 'aHeight'),
    uProj: u(terrain, 'uProj'), uView: u(terrain, 'uView'), uTime: u(terrain, 'uTime'),
    uWaveDir: u(terrain, 'uWaveDir'), uArriving: u(terrain, 'uArriving'), uK: u(terrain, 'uK'), uOmega: u(terrain, 'uOmega'),
    uOpenAmp: u(terrain, 'uOpenAmp'), uShoreAmp: u(terrain, 'uShoreAmp'), uHasWaves: u(terrain, 'uHasWaves'),
    uWindDir: u(terrain, 'uWindDir'), uWindAmp: u(terrain, 'uWindAmp'), uOffshore: u(terrain, 'uOffshore'),
    uRipSpeed: u(terrain, 'uRipSpeed'), uBreakZone: u(terrain, 'uBreakZone'), uFoam: u(terrain, 'uFoam'),
    uEye: u(terrain, 'uEye'), uLight: u(terrain, 'uLight'), uWhitecaps: u(terrain, 'uWhitecaps'),
    uResolution: u(terrain, 'uResolution'), uGrid: u(terrain, 'uGrid'),
    uFogNear: u(terrain, 'uFogNear'), uFogFar: u(terrain, 'uFogFar'), uFogMax: u(terrain, 'uFogMax'), uMetresPerUnit: u(terrain, 'uMetresPerUnit'),
  };
  // uWindDir, uRipSpeed και uTime διαβάζονται και από τους δύο shaders — μία τοποθεσία ο καθένας.
  const S = { aClip: a(sky, 'aClip') };
  const Ln = { aPos: a(lines, 'aPos'), aAlpha: a(lines, 'aAlpha'), uProj: u(lines, 'uProj'), uView: u(lines, 'uView') };

  const width = canvas.width;
  const height = canvas.height;
  // Όρθια οθόνη: το ίδιο κάθετο άνοιγμα θα έκοβε τα πλάγια και θα έφερνε την κάμερα «μέσα» στο
  // κύμα. Ανοίγει λίγο ο φακός και τραβιέται πίσω η κάμερα, ώστε η παραλία να χωρά ολόκληρη.
  const aspect = width / height;
  const fovy = Math.min(62, Math.max(46, 46 * Math.sqrt(2 / aspect)));
  const distanceScale = aspect < 1 ? 1.3 : aspect < 1.6 ? 1.12 : 1;
  const heightScale = aspect < 1 ? 0.8 : 1;
  const proj = perspective(fovy, aspect, 4, relief ? 40000 : 1400);

  const streaks: Streak[] = [];
  // 22 ρεύματα × 6 κορυφές × (x, y, z, alpha)
  const lineData = new Float32Array(22 * 6 * 4);
  const area = { x0: -40, x1: 240, y0: -90, y1: 125 };

  let disposed = false;

  const render = (params: SeaMotionParams, tSec: number, dtSec: number) => {
    if (disposed || !gl) return;
    const m = deriveMotion(params);
    const eye = cameraEye(tSec, distanceScale, heightScale);
    const view = lookAt(eye, TARGET, [0, 0, 1]);

    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);

    // Ουρανός: γεμίζει το κάδρο πίσω από όλα.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(sky);
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
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const stride = 7 * 4;
    gl.enableVertexAttribArray(T.aPos);
    gl.vertexAttribPointer(T.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(T.aDist);
    gl.vertexAttribPointer(T.aDist, 1, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(T.aShore);
    gl.vertexAttribPointer(T.aShore, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(T.aNoise);
    gl.vertexAttribPointer(T.aNoise, 1, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(T.aHeight);
    gl.vertexAttribPointer(T.aHeight, 1, gl.FLOAT, false, stride, 24);

    gl.uniformMatrix4fv(T.uProj, false, proj);
    gl.uniformMatrix4fv(T.uView, false, view);
    gl.uniform1f(T.uTime, tSec);
    gl.uniform2f(T.uWaveDir, m.tx, m.ty);
    gl.uniform1f(T.uArriving, m.arriving ? 1 : 0);
    gl.uniform1f(T.uK, m.kWave);
    gl.uniform1f(T.uOmega, m.omega);
    gl.uniform1f(T.uOpenAmp, m.openAmp);
    gl.uniform1f(T.uShoreAmp, m.shoreAmp);
    gl.uniform1f(T.uHasWaves, m.hasWaves ? 1 : 0);
    gl.uniform2f(T.uWindDir, m.wx, m.wy);
    gl.uniform1f(T.uWindAmp, m.windAmp);
    gl.uniform1f(T.uOffshore, m.offshoreWind ? 1 : 0);
    gl.uniform1f(T.uRipSpeed, m.ripSpeed);
    gl.uniform1f(T.uBreakZone, m.breakZone);
    gl.uniform1f(T.uFoam, m.foamStrength);
    gl.uniform3f(T.uEye, eye[0], eye[1], eye[2]);
    gl.uniform2f(T.uResolution, width, height);
    gl.uniform1f(T.uGrid, options.grid);
    gl.uniform1f(T.uFogNear, fogNear);
    gl.uniform1f(T.uFogFar, fogFar);
    gl.uniform1f(T.uFogMax, fogMax);
    gl.uniform1f(T.uMetresPerUnit, metresPerUnit);
    gl.uniform3f(T.uLight, LIGHT[0], LIGHT[1], LIGHT[2]);
    gl.uniform1f(T.uWhitecaps, m.whitecaps);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, wideIndices ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(T.aPos);
    gl.disableVertexAttribArray(T.aDist);
    gl.disableVertexAttribArray(T.aShore);
    gl.disableVertexAttribArray(T.aNoise);
    gl.disableVertexAttribArray(T.aHeight);

    // Τα ρεύματα του ανέμου, λίγο πάνω από το νερό.
    if (m.hasWind && m.windAmp > 0) {
      const wanted = Math.min(22, Math.max(3, Math.round(m.windSpeed / 3)));
      while (streaks.length < wanted) streaks.push(spawnStreak(m.wx, m.wy, m.windSpeed, true, area));
      while (streaks.length > wanted) streaks.pop();
      const speed = 6 + m.windSpeed * 0.55;
      let n = 0;
      for (let s = 0; s < streaks.length; s += 1) {
        const streak = streaks[s];
        streak.age += dtSec;
        streak.x += m.wx * speed * dtSec;
        streak.y += m.wy * speed * dtSec;
        const out = streak.x < area.x0 - 20 || streak.x > area.x1 + 20 || streak.y < area.y0 - 20 || streak.y > area.y1 + 20;
        if (streak.age > streak.life || out) {
          streaks[s] = spawnStreak(m.wx, m.wy, m.windSpeed, false, area);
          continue;
        }
        const fade = Math.sin((streak.age / streak.life) * Math.PI) * 0.85;
        // Ουρά διάφανη, κεφαλή φωτεινή· πάχος 0,45 μονάδες κάθετα στην κίνηση.
        const hw = 0.45;
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
        gl.drawArrays(gl.TRIANGLES, 0, n / 4);
        gl.disableVertexAttribArray(Ln.aPos);
        gl.disableVertexAttribArray(Ln.aAlpha);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    } else {
      streaks.length = 0;
    }
  };

  const dispose = () => {
    if (disposed || !gl) return;
    disposed = true;
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
    gl.deleteBuffer(skyVbo);
    gl.deleteBuffer(lineVbo);
    gl.deleteProgram(terrain);
    gl.deleteProgram(sky);
    gl.deleteProgram(lines);
    // Ένα ταμπελάκι ανοιγοκλείνει πολλές φορές: το context απελευθερώνεται ρητά, όχι στον GC.
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  };

  return { render, dispose };
};

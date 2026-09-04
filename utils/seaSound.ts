/**
 * Ο ΗΧΟΣ ΤΗΣ ΘΑΛΑΣΣΑΣ — συνθετικός, χωρίς αρχείο (03/09/2026, «κάν' τα όλα»).
 *
 * Καφέ θόρυβος (φιλτραρισμένος λευκός) που ανεβοκατεβαίνει αργά σαν κύμα, με δεύτερη ψιλή
 * στρώση για τον αέρα. Η ένταση και ο ρυθμός βγαίνουν από τα ΙΔΙΑ νούμερα με την εικόνα: ύψος
 * θάλασσας, περίοδος, ταχύτητα ανέμου. Ξεκινά ΜΟΝΟ με πάτημα (οι browsers το απαιτούν), ποτέ
 * από μόνος του, και σβήνει μαζί με τη σκηνή.
 */

export type SeaSoundLevels = {
  /** 0..1 — πόσο δυνατό το κύμα. */
  sea: number;
  /** 0..1 — πόσο δυνατός ο αέρας. */
  wind: number;
  /** Δευτερόλεπτα ανάμεσα σε δύο κύματα. */
  periodS: number;
};

export type SeaSound = {
  update: (levels: SeaSoundLevels) => void;
  stop: () => void;
};

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export const startSeaSound = (levels: SeaSoundLevels): SeaSound | null => {
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }

  // 4 δευτερόλεπτα καφέ θόρυβου σε βρόχο.
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }

  const makeLayer = (cutoffHz: number) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return { source, filter, gain };
  };

  const surf = makeLayer(600);
  const wind = makeLayer(2400);
  // Το κύμα ανεβοκατεβαίνει: ένας ταλαντωτής πολύ χαμηλής συχνότητας κουνάει την ένταση.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  const lfoGain = ctx.createGain();
  lfo.connect(lfoGain);
  lfoGain.connect(surf.gain.gain);
  lfo.start();

  const apply = (l: SeaSoundLevels) => {
    const now = ctx.currentTime;
    const seaGain = 0.03 + 0.28 * Math.min(1, l.sea);
    const windGain = 0.12 * Math.min(1, l.wind);
    surf.gain.gain.setTargetAtTime(seaGain, now, 0.4);
    lfoGain.gain.setTargetAtTime(seaGain * 0.7, now, 0.4);
    lfo.frequency.setTargetAtTime(1 / Math.max(2.5, l.periodS), now, 0.4);
    wind.gain.gain.setTargetAtTime(windGain, now, 0.4);
    wind.filter.frequency.setTargetAtTime(1200 + 2400 * Math.min(1, l.wind), now, 0.4);
  };
  apply(levels);

  return {
    update: apply,
    stop: () => {
      try {
        surf.source.stop();
        wind.source.stop();
        lfo.stop();
        void ctx.close();
      } catch {
        /* ήδη κλειστό */
      }
    },
  };
};

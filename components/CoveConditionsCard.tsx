import React, { useState } from 'react';
import { Waves, Wind, Compass, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';
import type { LanguageCode } from '../types';
import { trackEvent } from '../services/analyticsService';
import { getWindIncidence, getWindIncidenceWord } from '../utils/windIncidence';

/**
 * "Νερό & Αέρας" — the two-dimensional conditions card. DISPLAY ONLY: it reads values the app
 * already derives and writes nothing to scoring, level, colour, filters or ranking.
 *
 * It renders only in the DECOUPLING case: a genuinely enclosed cove (blocked shore, short fetch —
 * so the fetch-limited wave is small) under a strong wind. There the single exposure colour reads
 * "breezy" while the water itself is flat; this card hands the user the two facts separately —
 * "calm water, strong wind" — instead of collapsing them into one misleading verdict. It never
 * says "go" or "don't go". The 👍/👎 is the revealed-preference measurement that the eventual
 * classifier redesign is waiting for.
 */

type Copy = Record<LanguageCode, string>;
const pick = (c: Copy, l: LanguageCode): string => c[l] ?? c.en;

const T = {
  title: { en: 'Water & wind', gr: 'Νερό & Αέρας', de: 'Wasser & Wind', it: 'Acqua & vento', fr: 'Eau & vent' } as Copy,
  wave: { en: 'Wave height', gr: 'Ύψος κύματος', de: 'Wellenhöhe', it: 'Altezza onde', fr: 'Hauteur des vagues' } as Copy,
  wind: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' } as Copy,
  fetch: { en: 'Fetch', gr: 'Απόσταση κύματος', de: 'Fetch', it: 'Fetch', fr: 'Fetch' } as Copy,
  shelters: { en: 'the cove shelters you from the wave', gr: 'ο κόλπος σε προστατεύει από το κύμα', de: 'die Bucht schützt dich vor den Wellen', it: 'la baia ti ripara dalle onde', fr: 'la crique vous abrite des vagues' } as Copy,
  calmWater: { en: 'Calm water.', gr: 'Ήρεμο νερό.', de: 'Ruhiges Wasser.', it: 'Acqua calma.', fr: 'Eau calme.' } as Copy,
  mildWater: { en: 'Mild chop.', gr: 'Ήπιο κυματάκι.', de: 'Leichte Wellen.', it: 'Onde leggere.', fr: 'Petit clapot.' } as Copy,
  strongWind: { en: 'Strong wind.', gr: 'Δυνατός αέρας.', de: 'Starker Wind.', it: 'Vento forte.', fr: 'Vent fort.' } as Copy,
  explain: {
    en: 'The water stays flat because the cove cuts the fetch — but the wind hits hard. Good for a dip in flat water; not for a still, sheltered day on the sand.',
    gr: 'Το νερό μένει επίπεδο γιατί ο κόλπος κόβει το κύμα — ο αέρας όμως χτυπά δυνατά. Καλό για βουτιά σε ήρεμο νερό· όχι για ήσυχη μέρα στην άμμο.',
    de: 'Das Wasser bleibt flach, weil die Bucht den Fetch bricht — der Wind aber ist kräftig. Gut zum Schwimmen in ruhigem Wasser, nicht für einen windstillen Tag am Sand.',
    it: 'L\'acqua resta piatta perché la baia taglia il fetch — ma il vento è forte. Bene per un bagno in acqua calma, non per una giornata riparata sulla sabbia.',
    fr: 'L\'eau reste plate car la crique coupe le fetch — mais le vent souffle fort. Bien pour une baignade en eau calme, pas pour une journée abritée sur le sable.',
  } as Copy,
  // Classic coastal-safety hazard (HM Coastguard / NOAA): an offshore wind leaves the
  // cove's water deceptively flat while it pushes floats, SUPs and weak swimmers away
  // from shore. Shown exactly where we make the "calm water" claim under offshore wind.
  drift: {
    en: 'The wind blows away from shore: it can push inflatables, SUPs and swimmers seaward — stay close to the beach.',
    gr: 'Ο αέρας φυσάει από τη στεριά προς τα ανοιχτά: μπορεί να παρασύρει φουσκωτά, SUP και κολυμβητές — μείνε κοντά στην ακτή.',
    de: 'Der Wind weht ablandig: Er kann Luftmatratzen, SUPs und Schwimmer aufs Meer hinaustreiben — bleib nah am Ufer.',
    it: 'Il vento soffia da terra verso il largo: può trascinare gonfiabili, SUP e nuotatori — resta vicino alla riva.',
    fr: 'Le vent souffle de la terre vers le large : il peut emporter bouées, paddles et nageurs — restez près du rivage.',
  } as Copy,
  // onshore / cross / offshore moved to utils/windIncidence — the beach page now prints the same
  // classification above the wave graphic, and two copies of one ladder is how the eleven private
  // ladders on this page came to exist.
  helpful: { en: 'Useful?', gr: 'Χρήσιμο;', de: 'Nützlich?', it: 'Utile?', fr: 'Utile ?' } as Copy,
  thanks: { en: 'Thanks!', gr: 'Ευχαριστούμε!', de: 'Danke!', it: 'Grazie!', fr: 'Merci !' } as Copy,
  toward: { en: 'toward', gr: 'προς', de: 'nach', it: 'verso', fr: 'vers' } as Copy,
};

export interface CoveConditionsCardProps {
  beachId: number;
  waveHeightM: number;
  windSpeedKmh: number;
  windBeaufort: number;
  /** Onshore component in [-1,1] at the live wind (from the same geometry the wave uses). */
  onshore: number;
  fetchKm: number;
  /** Localized compass label for the direction the wind blows from / the fetch faces. */
  fetchDirectionLabel: string;
  language: LanguageCode;
}

export const CoveConditionsCard: React.FC<CoveConditionsCardProps> = ({
  beachId, waveHeightM, windSpeedKmh, windBeaufort, onshore, fetchKm, fetchDirectionLabel, language,
}) => {
  const [feedback, setFeedback] = useState<null | 'up' | 'down'>(null);

  const send = (value: 'up' | 'down') => {
    if (feedback) return;
    setFeedback(value);
    trackEvent('cove_conditions_feedback', beachId, {
      helpful: value === 'up',
      wave_height_m: Number(waveHeightM.toFixed(2)),
      wind_kmh: Math.round(windSpeedKmh),
      beaufort: windBeaufort,
      fetch_km: Number(fetchKm.toFixed(2)),
    });
  };

  const windRel = getWindIncidenceWord(getWindIncidence(onshore), language);
  const waterWord = waveHeightM < 0.3 ? pick(T.calmWater, language) : pick(T.mildWater, language);

  return (
    <div className="rounded-control border border-sky-100 bg-gradient-to-b from-sky-50/70 to-white p-4" data-nosnippet="true">
      <div className="mb-3 flex items-center gap-2">
        <Compass className="h-4 w-4 text-sky-600" />
        <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-sky-800">{pick(T.title, language)}</h4>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-slate-500"><Waves className="h-4 w-4 text-cyan-500" />{pick(T.wave, language)}</dt>
          <dd className="font-bold text-slate-900">~{waveHeightM.toFixed(2)} m</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-slate-500"><Wind className="h-4 w-4 text-blue-500" />{pick(T.wind, language)}</dt>
          <dd className="font-bold text-slate-900">{windSpeedKmh.toFixed(0)} km/h · {windRel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-slate-500"><Compass className="h-4 w-4 text-slate-400" />{pick(T.fetch, language)}</dt>
          <dd className="text-right font-semibold text-slate-700">{fetchKm.toFixed(1)} km {pick(T.toward, language)} {fetchDirectionLabel}</dd>
        </div>
      </dl>
      <p className="mt-1 text-right text-xs italic text-slate-400">{pick(T.shelters, language)}</p>

      <div className="mt-3 rounded-control bg-surface px-3 py-2.5">
        <p className="font-heading text-base font-extrabold text-slate-900">
          {waterWord} <span className="text-amber-600">{pick(T.strongWind, language)}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{pick(T.explain, language)}</p>
        {onshore < 0.15 && windBeaufort >= 4 && (
          <p className="mt-1.5 rounded-control bg-amber-50/80 px-2 py-1.5 text-xs font-semibold leading-relaxed text-amber-700">
            {pick(T.drift, language)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {feedback ? (
          <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />{pick(T.thanks, language)}</span>
        ) : (
          <>
            <span className="mr-1 text-xs text-slate-400">{pick(T.helpful, language)}</span>
            <button type="button" aria-label="useful" onClick={() => send('up')} className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-control border border-emerald-100 text-emerald-600 transition-all hover:bg-emerald-50 active:scale-95"><ThumbsUp className="h-4 w-4" /></button>
            <button type="button" aria-label="not useful" onClick={() => send('down')} className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-control border border-line text-slate-500 transition-all hover:bg-slate-50 active:scale-95"><ThumbsDown className="h-4 w-4" /></button>
          </>
        )}
      </div>
    </div>
  );
};

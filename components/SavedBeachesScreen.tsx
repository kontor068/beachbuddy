import React, { useMemo } from 'react';
import { ArrowLeft, Compass, Heart, MapPin, Sparkles, User } from 'lucide-react';
import { BeachCard } from './BeachCard';
import { LanguageCode, Translation, SuitableBeach, Beach } from '../types';
import { describeSimpleWindSuitability } from '../utils/windExposureCopy';

/**
 * Saved Beaches — the returning visitor's own screen.
 *
 * A persistent, one-tap home for "my coves — do they work today?". Each saved
 * beach in the active island is rendered with the SAME today verdict the home
 * cards use (BeachCard + the scored SuitableBeach), so calm/rough is scanned at a
 * glance instead of opened one by one. Google has no per-user list of obscure
 * coves it re-evaluates daily against per-cove shelter geometry. Saved beaches in
 * other (not-currently-loaded) islands are surfaced as an honest count, because a
 * verdict is only shown where we actually hold that island's forecast.
 *
 * TWO RULES THIS SCREEN OBEYS, both learned the hard way elsewhere in this app:
 *
 * 1. IT NEVER INVENTS A VERDICT. There is no "3 of yours are calm today" summary
 *    here, however tempting: that would be a second severity ladder living beside
 *    the one on the cards, and two ladders drifting apart unseen is the defect
 *    class this project keeps paying for. The screen counts and it orders; the
 *    cards judge.
 *
 * 2. "BEST OF YOURS" IS EARNED, NOT AUTOMATIC. The top card is only labelled when
 *    that beach's own signals allow a calm claim. On a day when every saved beach
 *    is rough, the label simply does not appear — a crown on the least-bad rough
 *    beach reads as a recommendation to go there.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Saved beaches',
  gr: 'Αποθηκευμένες παραλίες',
  de: 'Gespeicherte Strände',
  it: 'Spiagge salvate',
  fr: 'Plages enregistrées',
};

const SUBTITLE: Copy = {
  en: "Today's conditions for your coves, at a glance.",
  gr: 'Οι σημερινές συνθήκες στους όρμους σου, με μια ματιά.',
  de: 'Die heutigen Bedingungen deiner Buchten auf einen Blick.',
  it: 'Le condizioni di oggi delle tue cale, a colpo d’occhio.',
  fr: "Les conditions du jour de vos criques, en un coup d'œil.",
};

const BACK: Copy = {
  en: 'Back',
  gr: 'Πίσω',
  de: 'Zurück',
  it: 'Indietro',
  fr: 'Retour',
};

// ── Empty state ──────────────────────────────────────────────────────────────
// A lone card floating in white space told the visitor what to do but never why
// it was worth doing. This version answers the question the screen exists for.

const EMPTY_TITLE: Copy = {
  en: 'Build your own list',
  gr: 'Φτιάξε τη δική σου λίστα',
  de: 'Bau dir deine eigene Liste',
  it: 'Crea la tua lista',
  fr: 'Composez votre liste',
};

const EMPTY_WHY: Copy = {
  en: 'Tap the heart on any beach you like the look of. After that you stop checking them one by one: this screen puts today’s conditions for all of them in one place, and the wind changes the answer every day.',
  gr: 'Πάτα την καρδιά σε όποια παραλία σου αρέσει. Μετά σταματάς να τις ελέγχεις μία-μία: εδώ τις βλέπεις όλες μαζί με τις σημερινές συνθήκες τους, και ο αέρας αλλάζει την απάντηση κάθε μέρα.',
  de: 'Tippe bei jedem Strand, der dir gefällt, auf das Herz. Danach musst du sie nicht mehr einzeln durchgehen: hier stehen sie alle mit den heutigen Bedingungen, und der Wind ändert die Antwort täglich.',
  it: 'Tocca il cuore su ogni spiaggia che ti piace. Poi smetti di controllarle una per una: qui le vedi tutte insieme con le condizioni di oggi, e il vento cambia la risposta ogni giorno.',
  fr: "Touchez le cœur sur chaque plage qui vous plaît. Ensuite vous ne les vérifiez plus une par une : cet écran les réunit avec les conditions du jour, et le vent change la réponse chaque jour.",
};

const STEPS: Record<LanguageCode, [string, string, string]> = {
  en: ['Find a beach', 'Tap the heart', 'Check it here each morning'],
  gr: ['Βρες μια παραλία', 'Πάτα την καρδιά', 'Δες τη εδώ κάθε πρωί'],
  de: ['Finde einen Strand', 'Tippe auf das Herz', 'Schau jeden Morgen hier nach'],
  it: ['Trova una spiaggia', 'Tocca il cuore', 'Controlla qui ogni mattina'],
  fr: ['Trouvez une plage', 'Touchez le cœur', 'Regardez ici chaque matin'],
};

const EMPTY_CTA: Copy = {
  en: 'Browse the beaches',
  gr: 'Δες τις παραλίες',
  de: 'Strände ansehen',
  it: 'Sfoglia le spiagge',
  fr: 'Voir les plages',
};

// ── Signed-out nudge ─────────────────────────────────────────────────────────
// Shown only to someone who ALREADY has saved beaches: they have demonstrated the
// habit, and the risk of losing it to a cleared browser is real and specific.

const LOCAL_ONLY_TITLE: Copy = {
  en: 'These live only in this browser',
  gr: 'Αυτές ζουν μόνο σε αυτόν τον browser',
  de: 'Diese leben nur in diesem Browser',
  it: 'Queste vivono solo in questo browser',
  fr: 'Elles vivent seulement dans ce navigateur',
};

const LOCAL_ONLY_BODY: Copy = {
  en: 'Sign in with Google and you will find them on your phone too — and they survive clearing your browser.',
  gr: 'Μπες με Google και θα τις βρίσκεις και από το κινητό σου — και δεν χάνονται αν καθαρίσεις τον browser.',
  de: 'Melde dich mit Google an, dann findest du sie auch auf dem Handy — und sie überleben das Löschen des Browsers.',
  it: 'Accedi con Google e le ritroverai anche sul telefono — e non si perdono se pulisci il browser.',
  fr: 'Connectez-vous avec Google pour les retrouver aussi sur votre téléphone — elles survivent au nettoyage du navigateur.',
};

const SIGN_IN: Copy = {
  en: 'Sign in with Google',
  gr: 'Σύνδεση με Google',
  de: 'Mit Google anmelden',
  it: 'Accedi con Google',
  fr: 'Se connecter avec Google',
};

const SYNCED: Copy = {
  en: 'Saved to your account',
  gr: 'Αποθηκευμένες στον λογαριασμό σου',
  de: 'In deinem Konto gespeichert',
  it: 'Salvate nel tuo account',
  fr: 'Enregistrées sur votre compte',
};

const BEST_OF_YOURS: Copy = {
  en: 'The calmest of yours today',
  gr: 'Η πιο ήρεμη από τις δικές σου σήμερα',
  de: 'Die ruhigste von deinen heute',
  it: 'La più calma delle tue oggi',
  fr: 'La plus calme des vôtres aujourd’hui',
};

const countLabel = (count: number, language: LanguageCode): string => ({
  en: count === 1 ? '1 saved beach' : `${count} saved beaches`,
  gr: count === 1 ? '1 αποθηκευμένη παραλία' : `${count} αποθηκευμένες παραλίες`,
  de: count === 1 ? '1 gespeicherter Strand' : `${count} gespeicherte Strände`,
  it: count === 1 ? '1 spiaggia salvata' : `${count} spiagge salvate`,
  fr: count === 1 ? '1 plage enregistrée' : `${count} plages enregistrées`,
}[language]);

const hereLabel = (count: number, islandName: string, language: LanguageCode): string => ({
  en: `${count} on ${islandName}`,
  gr: `${count} σε ${islandName}`,
  de: `${count} auf ${islandName}`,
  it: `${count} a ${islandName}`,
  fr: `${count} à ${islandName}`,
}[language]);

const otherIslandsNote = (count: number, language: LanguageCode): string => ({
  en: `+${count} saved on other islands. Open that island to see today's conditions for them.`,
  gr: `+${count} αποθηκευμένες σε άλλα νησιά. Άνοιξε το αντίστοιχο νησί για να δεις τις σημερινές συνθήκες τους.`,
  de: `+${count} auf anderen Inseln gespeichert. Öffne die jeweilige Insel, um ihre heutigen Bedingungen zu sehen.`,
  it: `+${count} salvate in altre isole. Apri quell'isola per vederne le condizioni di oggi.`,
  fr: `+${count} enregistrées sur d'autres îles. Ouvrez l'île concernée pour voir leurs conditions du jour.`,
}[language]);

interface SavedBeachesScreenProps {
  language: LanguageCode;
  t: Translation;
  items: SuitableBeach[];
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  onOpenBeach: (beach: Beach) => void;
  onClose: () => void;
  selectedDate?: Date;
  selectedHour?: number;
  windSpeed?: number;
  temperature?: number;
  islandName: string;
  regionId?: string;
  otherIslandsCount: number;
  /** Accounts. All optional — with none of them the screen is exactly as before. */
  authAvailable?: boolean;
  isSignedIn?: boolean;
  onSignIn?: () => void;
}

export const SavedBeachesScreen: React.FC<SavedBeachesScreenProps> = ({
  language,
  t,
  items,
  favorites,
  onToggleFavorite,
  onOpenBeach,
  onClose,
  selectedDate,
  selectedHour,
  windSpeed = 0,
  temperature,
  islandName,
  regionId,
  otherIslandsCount,
  authAvailable = false,
  isSignedIn = false,
  onSignIn,
}) => {
  const isEmpty = items.length === 0 && otherIslandsCount === 0;
  const totalSaved = items.length + otherIslandsCount;

  // Best-first, so the answer is at the top of the screen rather than wherever
  // this beach happened to be saved. Ordering only — the verdict stays on the card.
  const ordered = useMemo(
    () => [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [items],
  );

  // The label is earned: only when the leader's own signals allow a calm claim.
  // Otherwise a rough day would crown its least-rough beach and read as advice.
  const showBestLabel = ordered.length > 1 && ordered[0]?.seaCalmClaimAllowed === true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={pick(BACK, language)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-slate-950">
              <Heart className="h-5 w-5 flex-shrink-0 fill-rose-500 text-rose-500" aria-hidden="true" />
              {pick(TITLE, language)}
            </h1>
            <p className="truncate text-xs font-semibold text-slate-600">{pick(SUBTITLE, language)}</p>
          </div>
          {!isEmpty && authAvailable && isSignedIn && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100 sm:inline-flex">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              {pick(SYNCED, language)}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        {isEmpty ? (
          <div className="mx-auto max-w-xl">
            <div className="rounded-3xl border border-white/70 bg-white/80 px-6 py-8 text-center shadow-sm shadow-sky-900/5 ring-1 ring-white/60 sm:px-8 sm:py-10">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
                <Heart className="h-7 w-7 text-rose-400" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-extrabold text-slate-950">
                {pick(EMPTY_TITLE, language)}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-600">
                {pick(EMPTY_WHY, language)}
              </p>

              <ol className="mx-auto mt-6 grid max-w-md gap-2 text-left sm:grid-cols-3 sm:gap-3">
                {STEPS[language].map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-2xl bg-sky-50/70 px-3 py-2.5 ring-1 ring-white/60 sm:flex-col sm:items-start sm:gap-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#007a83] ring-1 ring-cyan-100">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold leading-snug text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#007a83] px-5 text-sm font-extrabold text-white transition hover:bg-[#00646c] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/40"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                {pick(EMPTY_CTA, language)}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Counts, not judgements. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-white/60">
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-hidden="true" />
                {countLabel(totalSaved, language)}
              </span>
              {items.length > 0 && otherIslandsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {hereLabel(items.length, islandName, language)}
                </span>
              )}
            </div>

            {/* Someone with saved beaches and no account is one cleared browser
                away from losing them. Say so once, here, where it is true. */}
            {authAvailable && !isSignedIn && onSignIn && (
              <div className="flex flex-col gap-3 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3.5 shadow-sm ring-1 ring-white/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{pick(LOCAL_ONLY_TITLE, language)}</p>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-600">
                    {pick(LOCAL_ONLY_BODY, language)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#007a83] px-4 text-sm font-extrabold text-white transition hover:bg-[#00646c] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/40"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  {pick(SIGN_IN, language)}
                </button>
              </div>
            )}

            {ordered.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-6">
                {ordered.map((item, index) => (
                  <div key={item.beach.id} className="relative flex">
                    {index === 0 && showBestLabel && (
                      <span className="pointer-events-none absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#007a83] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {pick(BEST_OF_YOURS, language)}
                      </span>
                    )}
                    <BeachCard
                      beach={{ ...item.beach, distance: item.distance }}
                      isExposed={item.isExposed}
                      language={language}
                      t={t}
                      isCalm={item.seaCalmClaimAllowed === true}
                      windSpeed={windSpeed}
                      beachWindSpeedKmph={item.windSpeedKmph}
                      temperature={temperature}
                      waveHeightM={item.waveHeightM}
                      shoreWaveHeightM={item.shoreWaveHeightM}
                      shoreDisplayWaveM={item.shoreDisplayWaveM}
                      seaTemperatureC={item.seaTemperatureC}
                      favorites={favorites}
                      onToggleFavorite={onToggleFavorite}
                      islandName={islandName}
                      regionId={regionId}
                      onClick={() => onOpenBeach(item.beach)}
                      todayScore={item.score}
                      selectedDate={selectedDate}
                      selectedHour={selectedHour}
                      exposureLevel={item.exposureLevel}
                      warnings={item.warnings}
                      confidence={item.confidence}
                      swimmingComfort={item.swimmingComfort}
                      canClaimWindProtection={item.canClaimWindProtection}
                      enclosedCove={item.enclosedCove}
                      seaCalmClaimAllowed={item.seaCalmClaimAllowed}
                      bestBeachTime={item.bestBeachTime}
                      windSuitabilityText={describeSimpleWindSuitability(item.simpleWindSuitability, language)}
                      windSuitabilityColor={item.simpleWindSuitability?.suitabilityColor}
                      forceTodayScoreBadge
                    />
                  </div>
                ))}
              </div>
            )}

            {otherIslandsCount > 0 && (
              <p className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-center text-sm font-semibold leading-relaxed text-slate-600">
                {otherIslandsNote(otherIslandsCount, language)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

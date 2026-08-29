import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from '../utils/i18n';
import { sendAppRating, trackEvent } from '../services/analyticsService';

// A deliberately low-key "rate the app" card, same posture as InstallPrompt: it appears only
// for a visitor who has come back on several DIFFERENT days (a returning user has an opinion;
// a first-timer only has a first impression), waits until they are actually using the page,
// is one-tap dismissible, backs off for weeks after a dismissal, and never asks again once
// answered. Two 1–10 scores (ease of use, forecast accuracy) plus an optional free-text box;
// the submission rides the existing feedback-email → Telegram pipe.

const STORE_KEY = 'cb_app_rating_v1';

// Distinct calendar days the app was opened before we are allowed to ask. Days, not page
// loads: this is a "which beach today?" site, so one real usage unit is one morning check —
// a single long session with many page views is still one use.
const MIN_USAGE_DAYS = 5;
// …and even then, not the instant the page loads: the card would cover the very content the
// visitor came for. Same reasoning as InstallPrompt's engagement delay.
const REVEAL_DELAY_MS = 20_000;
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000; // back off ~2 months after a dismissal
const MAX_DISMISSALS = 2; // after the user says no twice, stop asking for good
const MAX_MESSAGE_LENGTH = 800;

type PromptState = {
  /** Count of distinct local calendar days the app was opened. */
  days?: number;
  /** The visitor's own local day (YYYY-MM-DD) of the last counted open. */
  lastDay?: string;
  dismissedAt?: number;
  dismissCount?: number;
  submittedAt?: number;
};

const readState = (): PromptState => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as PromptState) : {};
  } catch {
    return {};
  }
};

const writeState = (next: PromptState): void => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled — fail silently, just don't persist */
  }
};

// The VISITOR's calendar day, on purpose — this measures their habit ("came back another
// day"), not anything about Greek forecast time, so their own clock is the honest one.
const localDayKey = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** Bump the distinct-day counter (at most once per local day) and return the new state. */
const recordUsageDay = (): PromptState => {
  const state = readState();
  const today = localDayKey();
  if (state.lastDay === today) return state;
  const next = { ...state, days: (state.days ?? 0) + 1, lastDay: today };
  writeState(next);
  return next;
};

const allowedToAsk = (state: PromptState): boolean => {
  if (state.submittedAt) return false;
  if ((state.dismissCount ?? 0) >= MAX_DISMISSALS) return false;
  if (state.dismissedAt && Date.now() - state.dismissedAt < COOLDOWN_MS) return false;
  return (state.days ?? 0) >= MIN_USAGE_DAYS;
};

type Copy = {
  title: string;
  subtitle: string;
  ease: string;
  accuracy: string;
  commentPlaceholder: string;
  send: string;
  sending: string;
  thanks: string;
  error: string;
  close: string;
};

const COPY: LocalizedCopy<Copy> = {
  en: {
    title: 'How are we doing?',
    subtitle: 'Two quick taps — rate us from 1 to 10.',
    ease: 'Ease of use',
    accuracy: 'Forecast accuracy',
    commentPlaceholder: 'Anything else? What you liked, what bugged you, ideas… (optional)',
    send: 'Send',
    sending: 'Sending…',
    thanks: 'Thank you — it really helps!',
    error: 'Something went wrong. Please try again.',
    close: 'Close',
  },
  gr: {
    title: 'Πώς τα πάμε;',
    subtitle: 'Δύο γρήγορα πατήματα — βαθμολόγησέ μας από το 1 έως το 10.',
    ease: 'Ευκολία χρήσης',
    accuracy: 'Ακρίβεια πρόβλεψης',
    commentPlaceholder: 'Θες να προσθέσεις κάτι; Τι σου άρεσε, τι σε δυσκόλεψε, ιδέες… (προαιρετικό)',
    send: 'Αποστολή',
    sending: 'Στέλνεται…',
    thanks: 'Ευχαριστούμε — βοηθάει πραγματικά!',
    error: 'Κάτι πήγε στραβά. Δοκίμασε ξανά.',
    close: 'Κλείσιμο',
  },
  fr: {
    title: 'Comment nous trouvez-vous ?',
    subtitle: 'Deux gestes rapides — notez-nous de 1 à 10.',
    ease: 'Facilité d’utilisation',
    accuracy: 'Précision des prévisions',
    commentPlaceholder: 'Un mot de plus ? Ce qui vous a plu, gêné, vos idées… (facultatif)',
    send: 'Envoyer',
    sending: 'Envoi…',
    thanks: 'Merci — cela nous aide vraiment !',
    error: 'Une erreur est survenue. Réessayez.',
    close: 'Fermer',
  },
  de: {
    title: 'Wie gefällt dir Calm Beach?',
    subtitle: 'Zwei kurze Taps — bewerte uns von 1 bis 10.',
    ease: 'Benutzerfreundlichkeit',
    accuracy: 'Genauigkeit der Vorhersage',
    commentPlaceholder: 'Noch etwas? Was dir gefällt, was stört, Ideen… (optional)',
    send: 'Senden',
    sending: 'Wird gesendet…',
    thanks: 'Danke — das hilft uns wirklich!',
    error: 'Etwas ist schiefgelaufen. Versuch es noch einmal.',
    close: 'Schließen',
  },
  it: {
    title: 'Come ti sembra Calm Beach?',
    subtitle: 'Due tocchi rapidi — dacci un voto da 1 a 10.',
    ease: 'Facilità d’uso',
    accuracy: 'Precisione delle previsioni',
    commentPlaceholder: 'Vuoi aggiungere qualcosa? Cosa ti è piaciuto, cosa no, idee… (facoltativo)',
    send: 'Invia',
    sending: 'Invio…',
    thanks: 'Grazie — ci aiuta davvero!',
    error: 'Qualcosa è andato storto. Riprova.',
    close: 'Chiudi',
  },
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ScoreRow: React.FC<{
  label: string;
  value: number | null;
  onChange: (score: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="mt-3">
    <div className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{label}</div>
    <div role="radiogroup" aria-label={label} className="mt-1.5 grid grid-cols-10 gap-1">
      {SCORES.map(score => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          aria-label={`${label}: ${score}/10`}
          onClick={() => onChange(score)}
          className={`h-8 touch-manipulation cursor-pointer rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
            value === score
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  </div>
);

export const AppRatingPrompt: React.FC<{ language: LanguageCode }> = ({ language }) => {
  const [stage, setStage] = useState<null | 'form' | 'thanks'>(null);
  const [visible, setVisible] = useState(false); // drives the slide-up transition
  const [easeOfUse, setEaseOfUse] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const usageDaysRef = useRef(0);
  const copy = getLocalizedCopy(language, COPY);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Counting happens on every load, even when we won't ask — that's how the
    // fifth distinct day can ever arrive.
    const state = recordUsageDay();
    usageDaysRef.current = state.days ?? 0;
    if (!allowedToAsk(state)) return;

    const timer = window.setTimeout(() => {
      // Never stack on top of another dialog (install prompt, a photo sheet, a modal).
      // Losing one opportunity is fine — the visitor is coming back anyway, that is
      // the very reason we're asking them.
      if (document.querySelector('[role="dialog"]')) return;
      if (!allowedToAsk(readState())) return;
      setStage('form');
      requestAnimationFrame(() => setVisible(true));
      trackEvent('app_rating_prompt_shown', undefined, { usageDays: usageDaysRef.current });
    }, REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    // Let the slide-out finish before unmounting.
    window.setTimeout(() => setStage(null), 220);
  }, []);

  const handleDismiss = useCallback(() => {
    const state = readState();
    writeState({ ...state, dismissedAt: Date.now(), dismissCount: (state.dismissCount ?? 0) + 1 });
    trackEvent('app_rating_prompt_dismissed', undefined, { usageDays: usageDaysRef.current });
    close();
  }, [close]);

  const handleSubmit = useCallback(async () => {
    if (easeOfUse === null || accuracy === null || sending) return;
    setSending(true);
    setFailed(false);

    const delivered = await sendAppRating({
      easeOfUse,
      accuracy,
      message: message.trim().slice(0, MAX_MESSAGE_LENGTH),
      usageDays: usageDaysRef.current,
      language,
    });

    setSending(false);
    if (!delivered) {
      // Keep the form as filled in — the visitor's taps are not thrown away on a
      // network hiccup, and a second «Αποστολή» is the whole retry story.
      setFailed(true);
      return;
    }

    writeState({ ...readState(), submittedAt: Date.now() });
    trackEvent('app_rating_submitted', undefined, {
      easeOfUse,
      accuracy,
      hasMessage: message.trim().length > 0,
      usageDays: usageDaysRef.current,
    });
    setStage('thanks');
    window.setTimeout(close, 2200);
  }, [easeOfUse, accuracy, message, sending, language, close]);

  if (!stage) return null;

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 transition-all duration-300 ease-out bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-100/80 bg-white/95 p-4 shadow-lg shadow-sky-900/10 ring-1 ring-white/60 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        {stage === 'thanks' ? (
          <div className="py-2 text-center text-sm font-bold text-slate-800 dark:text-slate-100">
            💙 {copy.thanks}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">{copy.title}</div>
                <div className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">{copy.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label={copy.close}
                className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ScoreRow label={copy.ease} value={easeOfUse} onChange={setEaseOfUse} />
            <ScoreRow label={copy.accuracy} value={accuracy} onChange={setAccuracy} />

            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder={copy.commentPlaceholder}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            {failed && (
              <p className="mt-1.5 text-[12px] font-medium text-rose-600 dark:text-rose-400" role="alert">
                {copy.error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={easeOfUse === null || accuracy === null || sending}
              className="mt-3 min-h-11 w-full touch-manipulation cursor-pointer rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {sending ? copy.sending : copy.send}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

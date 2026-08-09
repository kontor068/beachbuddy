import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from '../utils/i18n';
import { trackEvent } from '../services/analyticsService';

// A deliberately low-key "add to home screen" nudge. It appears as soon as the browser can offer
// an install action (or clear manual steps on iOS Safari, where no programmatic install exists),
// is one-tap dismissible, and backs off for weeks after a dismissal — capped so we never nag.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORE_KEY = 'cb_install_prompt_v1';
const COOLDOWN_MS = 45 * 24 * 60 * 60 * 1000; // back off ~6 weeks after a dismissal
const MAX_DISMISSALS = 2; // after the user says no twice, stop asking for good
const ENGAGEMENT_DELAY_MS = 0; // show the install message immediately when eligible

type InstallMode = 'android' | 'ios';

type PromptState = { dismissedAt?: number; dismissCount?: number; installed?: boolean };

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

const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const isIosSafari = (): boolean => {
  const ua = window.navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  // Exclude in-app browsers (FB/IG/Chrome-iOS) where "Add to Home Screen" isn't available.
  const safari = /safari/i.test(ua) && !/crios|fxios|edgios|fbav|fban|instagram|line/i.test(ua);
  return iOS && safari;
};

const allowedToAsk = (state: PromptState): boolean => {
  if (state.installed) return false;
  if ((state.dismissCount ?? 0) >= MAX_DISMISSALS) return false;
  if (state.dismissedAt && Date.now() - state.dismissedAt < COOLDOWN_MS) return false;
  return true;
};

type Copy = {
  title: string;
  bodyAndroid: string;
  bodyIos: string;
  install: string;
  dismiss: string;
  iosBefore: string;
  iosAfter: string;
  iosGuideCta: string;
  iosGuideTitle: string;
  iosGuideIntro: string;
  iosStepOne: string;
  iosStepTwo: string;
  iosStepThree: string;
  back: string;
  close: string;
};

const COPY: LocalizedCopy<Copy> = {
  en: {
    title: 'Install Calm Beach',
    bodyAndroid: 'Add it to your home screen for one-tap access — no app store.',
    bodyIos: 'Keep it one tap away from your home screen.',
    install: 'Install',
    dismiss: 'Not now',
    iosBefore: 'Tap',
    iosAfter: 'then “Add to Home Screen”.',
    iosGuideCta: 'Show steps',
    iosGuideTitle: 'Install on iPhone',
    iosGuideIntro: 'In Safari, install Calm Beach in three quick steps.',
    iosStepOne: 'Tap the Share button in Safari.',
    iosStepTwo: 'Scroll down and tap “Add to Home Screen”.',
    iosStepThree: 'Tap “Add” to finish.',
    back: 'Back',
    close: 'Dismiss',
  },
  gr: {
    iosGuideCta: '\\u0394\\u03b5\\u03c2 \\u03c4\\u03b1 \\u03b2\\u03ae\\u03bc\\u03b1\\u03c4\\u03b1',
    iosGuideTitle: '\\u0395\\u03b3\\u03ba\\u03b1\\u03c4\\u03ac\\u03c3\\u03c4\\u03b1\\u03c3\\u03b7 \\u03c3\\u03b5 iPhone',
    iosGuideIntro: '\\u03a3\\u03c4\\u03bf Safari, \\u03b5\\u03b3\\u03ba\\u03b1\\u03c4\\u03ad\\u03c3\\u03c4\\u03b7\\u03c3\\u03b5 \\u03c4\\u03bf Calm Beach \\u03c3\\u03b5 3 \\u03b3\\u03c1\\u03ae\\u03b3\\u03bf\\u03c1\\u03b1 \\u03b2\\u03ae\\u03bc\\u03b1\\u03c4\\u03b1.',
    iosStepOne: '\\u03a0\\u03ac\\u03c4\\u03b1 \\u03c4\\u03bf \\u03ba\\u03bf\\u03c5\\u03bc\\u03c0\\u03af \\u039a\\u03bf\\u03b9\\u03bd\\u03bf\\u03c0\\u03bf\\u03af\\u03b7\\u03c3\\u03b7\\u03c2 \\u03c3\\u03c4\\u03bf Safari.',
    iosStepTwo: '\\u039a\\u03ac\\u03bd\\u03b5 \\u03ba\\u03cd\\u03bb\\u03b9\\u03c3\\u03b7 \\u03c0\\u03c1\\u03bf\\u03c2 \\u03c4\\u03b1 \\u03ba\\u03ac\\u03c4\\u03c9 \\u03ba\\u03b1\\u03b9 \\u03c0\\u03ac\\u03c4\\u03b1 \\u00ab\\u03a0\\u03c1\\u03bf\\u03c3\\u03b8\\u03ae\\u03ba\\u03b7 \\u03c3\\u03c4\\u03b7\\u03bd \\u0391\\u03c1\\u03c7\\u03b9\\u03ba\\u03ae \\u03bf\\u03b8\\u03cc\\u03bd\\u03b7\\u00bb.',
    iosStepThree: '\\u03a0\\u03ac\\u03c4\\u03b1 \\u00ab\\u03a0\\u03c1\\u03bf\\u03c3\\u03b8\\u03ae\\u03ba\\u03b7\\u00bb \\u03b3\\u03b9\\u03b1 \\u03bf\\u03bb\\u03bf\\u03ba\\u03bb\\u03ae\\u03c1\\u03c9\\u03c3\\u03b7.',
    back: '\\u03a0\\u03af\\u03c3\\u03c9',
    title: 'Εγκατάστησε το Calm Beach',
    bodyAndroid: 'Πρόσθεσέ το στην αρχική οθόνη για άμεση πρόσβαση — χωρίς app store.',
    bodyIos: 'Έχε το ένα άγγιγμα μακριά, από την αρχική οθόνη.',
    install: 'Εγκατάσταση',
    dismiss: 'Όχι τώρα',
    iosBefore: 'Πάτα',
    iosAfter: 'και μετά «Πρόσθεση στην Αρχική οθόνη».',
    close: 'Κλείσιμο',
  },
  fr: {
    iosGuideCta: 'Voir les \\u00e9tapes',
    iosGuideTitle: 'Installer sur iPhone',
    iosGuideIntro: 'Dans Safari, installez Calm Beach en trois \\u00e9tapes.',
    iosStepOne: 'Appuyez sur le bouton Partager dans Safari.',
    iosStepTwo: 'Faites d\\u00e9filer puis appuyez sur « Sur l\\u2019\\u00e9cran d\\u2019accueil ».',
    iosStepThree: 'Appuyez sur « Ajouter » pour terminer.',
    back: 'Retour',
    title: 'Installer Calm Beach',
    bodyAndroid: 'Ajoutez-le à votre écran d’accueil pour un accès en un geste — sans app store.',
    bodyIos: 'Gardez-le à portée de doigt, sur votre écran d’accueil.',
    install: 'Installer',
    dismiss: 'Plus tard',
    iosBefore: 'Appuyez sur',
    iosAfter: 'puis « Sur l’écran d’accueil ».',
    close: 'Fermer',
  },
  de: {
    iosGuideCta: 'Schritte ansehen',
    iosGuideTitle: 'Auf dem iPhone installieren',
    iosGuideIntro: 'Installiere Calm Beach in Safari in drei Schritten.',
    iosStepOne: 'Tippe in Safari auf die Teilen-Taste.',
    iosStepTwo: 'Scrolle nach unten und tippe auf „Zum Home-Bildschirm“.',
    iosStepThree: 'Tippe zum Abschluss auf „Hinzuf\\u00fcgen“.',
    back: 'Zur\\u00fcck',
    title: 'Calm Beach installieren',
    bodyAndroid: 'Füge es zum Startbildschirm hinzu — Zugriff mit einem Tipp, ohne App Store.',
    bodyIos: 'Behalte es mit einem Tipp auf dem Startbildschirm.',
    install: 'Installieren',
    dismiss: 'Später',
    iosBefore: 'Tippe auf',
    iosAfter: 'dann „Zum Home-Bildschirm“.',
    close: 'Schließen',
  },
  it: {
    iosGuideCta: 'Vedi i passaggi',
    iosGuideTitle: 'Installa su iPhone',
    iosGuideIntro: 'In Safari, installa Calm Beach in tre passaggi.',
    iosStepOne: 'Tocca il pulsante Condividi in Safari.',
    iosStepTwo: 'Scorri verso il basso e tocca “Aggiungi a Home”.',
    iosStepThree: 'Tocca “Aggiungi” per terminare.',
    back: 'Indietro',
    title: 'Installa Calm Beach',
    bodyAndroid: 'Aggiungilo alla schermata Home per un accesso immediato — senza app store.',
    bodyIos: 'Tienilo a un tocco dalla schermata Home.',
    install: 'Installa',
    dismiss: 'Non ora',
    iosBefore: 'Tocca',
    iosAfter: 'poi “Aggiungi a Home”.',
    close: 'Chiudi',
  },
};

export const InstallPrompt: React.FC<{ language: LanguageCode }> = ({ language }) => {
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [visible, setVisible] = useState(false); // drives the slide-up transition
  const [showIosGuide, setShowIosGuide] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const engagedRef = useRef(false);
  const copy = getLocalizedCopy(language, COPY);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || !allowedToAsk(readState())) return;

    // Reveal once both conditions hold: the quiet engagement delay has passed AND we have something
    // to offer (a captured Android/desktop prompt, or iOS Safari where we show manual steps).
    const reveal = (next: InstallMode) => {
      if (!engagedRef.current) return;
      if (!allowedToAsk(readState())) return;
      setMode(next);
      // Next frame so the element mounts hidden, then transitions in.
      requestAnimationFrame(() => setVisible(true));
      trackEvent('install_prompt_shown', undefined, { platform: next });
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // suppress the browser's default mini-infobar; we drive our own UI
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      reveal('android');
    };

    const onInstalled = () => {
      writeState({ ...readState(), installed: true });
      setVisible(false);
      setMode(null);
      trackEvent('app_installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const timer = window.setTimeout(() => {
      engagedRef.current = true;
      if (deferredPrompt.current) reveal('android');
      else if (isIosSafari()) reveal('ios');
    }, ENGAGEMENT_DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setShowIosGuide(false);
    // Let the slide-out finish before unmounting.
    window.setTimeout(() => setMode(null), 220);
  }, []);

  const handleDismiss = useCallback(() => {
    const state = readState();
    writeState({ ...state, dismissedAt: Date.now(), dismissCount: (state.dismissCount ?? 0) + 1 });
    trackEvent('install_prompt_dismissed', undefined, { platform: mode ?? 'unknown' });
    close();
  }, [mode, close]);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      trackEvent(outcome === 'accepted' ? 'install_prompt_accepted' : 'install_prompt_dismissed', undefined, { platform: 'android' });
      if (outcome === 'accepted') {
        writeState({ ...readState(), installed: true });
      } else {
        const state = readState();
        writeState({ ...state, dismissedAt: Date.now(), dismissCount: (state.dismissCount ?? 0) + 1 });
      }
    } catch {
      /* prompt can only be used once; ignore double-invoke errors */
    } finally {
      deferredPrompt.current = null;
      close();
    }
  }, [close]);

  if (!mode) return null;

  const isIosGuide = mode === 'ios' && showIosGuide;

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 transition-all duration-300 ease-out bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-100/80 bg-white/95 p-3 shadow-lg shadow-sky-900/10 ring-1 ring-white/60 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 ${
          isIosGuide ? 'block' : 'flex items-center gap-3'
        }`}
      >
        {isIosGuide ? (
          <div>
            <div className="flex items-center gap-3">
              <img src="/pwa-192.png" alt="" aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl shadow-sm" />
              <div className="min-w-0 flex-1 text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">{copy.iosGuideTitle}</div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label={copy.close}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm font-medium leading-snug text-slate-600 dark:text-slate-300">{copy.iosGuideIntro}</p>
            <ol className="mt-3 space-y-2 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">1</span><span>{copy.iosStepOne} <Share className="-mt-0.5 inline h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" /></span></li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">2</span><span>{copy.iosStepTwo}</span></li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">3</span><span>{copy.iosStepThree}</span></li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-4 min-h-11 w-full touch-manipulation cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {copy.back}
            </button>
          </div>
        ) : (
          <>
            <img src="/pwa-192.png" alt="" aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl shadow-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">{copy.title}</div>
              {mode === 'ios' ? (
                <div className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">
                  {copy.bodyIos}{' '}
                  <span className="whitespace-nowrap">{copy.iosBefore} <Share className="-mt-0.5 inline h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" /> {copy.iosAfter}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">{copy.bodyAndroid}</div>
              )}
            </div>
            <button
              type="button"
              onClick={mode === 'android' ? handleInstall : () => setShowIosGuide(true)}
              aria-label={mode === 'ios' ? copy.iosGuideCta : undefined}
              className="min-h-11 min-w-11 shrink-0 touch-manipulation cursor-pointer rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              {mode === 'ios' ? copy.iosGuideCta : copy.install}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={copy.close}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from '../utils/i18n';
import { trackEvent } from '../services/analyticsService';

// A deliberately low-key "add to home screen" nudge. It appears as soon as the browser can offer
// an install action, only appears when the browser says the app is installable
// (or on iOS Safari, which has no programmatic prompt), is one-tap dismissible, and backs off for
// weeks after a dismissal — capped so we never nag.

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
    close: 'Dismiss',
  },
  gr: {
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

  const handleIosInstall = useCallback(async () => {
    // iOS Safari does not expose beforeinstallprompt. Opening the native share
    // sheet from the user's tap is the closest supported action; the inline
    // instructions still explain the final "Add to Home Screen" step.
    if (typeof navigator.share !== 'function') return;

    try {
      await navigator.share({
        title: copy.title,
        url: window.location.href,
      });
    } catch (error) {
      // Cancelling the share sheet is expected. Other failures are also safe to
      // ignore because the manual iOS instructions remain visible.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }, [copy.title]);

  if (!mode) return null;

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 transition-all duration-300 ease-out bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cyan-100/80 bg-white/95 p-3 shadow-lg shadow-sky-900/10 ring-1 ring-white/60 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <img
          src="/pwa-192.png"
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">{copy.title}</div>
          {mode === 'ios' ? (
            <div className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">
              {copy.bodyIos}{' '}
              <span className="whitespace-nowrap">
                {copy.iosBefore}{' '}
                <Share className="-mt-0.5 inline h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />{' '}
                {copy.iosAfter}
              </span>
            </div>
          ) : (
            <div className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500 dark:text-slate-400">{copy.bodyAndroid}</div>
          )}
        </div>

        {mode === 'android' ? (
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-11 min-w-11 shrink-0 touch-manipulation cursor-pointer rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            {copy.install}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleIosInstall}
            aria-label={copy.install}
            className="min-h-11 min-w-11 shrink-0 touch-manipulation cursor-pointer rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            {copy.install}
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={copy.close}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:hover:bg-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

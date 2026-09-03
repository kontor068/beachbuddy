import React from 'react';

const CHUNK_RELOAD_KEY = 'calmBeachChunkReloadAttemptedAt';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module')
  );
};

/** Η εκκαθάριση δεν επιτρέπεται να κρατήσει τη σελίδα όμηρο: `registration.update()`
 *  κάνει δικτυακή κλήση και σε νεκρό 4G μπορεί να μην απαντήσει ΠΟΤΕ — και τότε το
 *  reload από κάτω δεν έφτανε ποτέ και ο επισκέπτης έμενε στην οθόνη φόρτωσης. */
const withDeadline = <T,>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>(resolve => window.setTimeout(() => resolve(undefined), ms)),
  ]);

const clearAppRuntimeCaches = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith('beach-buddy-') || cacheName.startsWith('calm-beach-'))
        .map(cacheName => caches.delete(cacheName))
    );
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.update().catch(() => undefined)));
  }
};

export const recoverFromChunkLoadError = async (error: unknown, source: string): Promise<never> => {
  if (!isChunkLoadError(error)) {
    throw error;
  }

  const now = Date.now();
  const lastAttempt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);

  if (Number.isFinite(lastAttempt) && now - lastAttempt < CHUNK_RELOAD_COOLDOWN_MS) {
    throw error;
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  console.warn('[Calm Beach] Missing app chunk; clearing runtime cache and reloading.', { source, error });

  try {
    await withDeadline(clearAppRuntimeCaches(), 2_000);
  } finally {
    window.location.reload();
  }

  return new Promise<never>(() => undefined);
};

/**
 * ΜΙΑ ΔΕΥΤΕΡΗ ΠΡΟΣΠΑΘΕΙΑ ΠΡΙΝ ΤΟ ΣΚΛΗΡΟ RELOAD (20/08/2026).
 *
 * Μέχρι σήμερα η ΜΟΝΗ αντίδραση σε ένα κομμάτι κώδικα που δεν κατέβηκε ήταν πλήρης
 * επαναφόρτωση της σελίδας. Για ένα iPhone σε νησιώτικο 4G που έχασε ΕΝΑ αίτημα αυτό
 * είναι σφυρί: ο επισκέπτης βλέπει τη σελίδα να ξαναφορτώνει από την αρχή, και αν η
 * δεύτερη προσπάθεια πέσει μέσα στα 10 δευτ. της αναμονής, βλέπει οθόνη σφάλματος.
 *
 * Μια απλή επανάληψη μετά από μισό δευτερόλεπτο σβήνει τα περισσότερα από αυτά χωρίς
 * να το καταλάβει κανείς. Ισχύει ΜΟΝΟ όταν το κατέβασμα απέτυχε πραγματικά: αν το
 * αρχείο «κατέβηκε αλλά ήρθε άδειο», ο browser το έχει ήδη κρατήσει στη μνήμη του και
 * μια δεύτερη κλήση θα έδινε το ίδιο άδειο αποτέλεσμα — εκεί μόνο το reload βοηθάει.
 */
const RETRY_DELAY_MS = 500;

const importWithOneRetry = <T,>(loader: () => Promise<T>): Promise<T> => loader().catch(error => {
  if (!isChunkLoadError(error)) throw error;
  return new Promise<T>((resolve, reject) => {
    window.setTimeout(() => { loader().then(resolve, reject); }, RETRY_DELAY_MS);
  });
});

export const lazyWithChunkRecovery = <T extends React.ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  source: string
) => React.lazy(() => importWithOneRetry(loader)
  .then(module => {
    // A chunk can "load" and still hand back nothing. Reported from a real iPhone
    // on 31/07/2026: `undefined is not an object (evaluating 'e.BeachDetailPage')`
    // on /it/beaches/heraklion/625-kommos/ — the dynamic import resolved, so the
    // catch below never ran, and then reading the named export off `undefined`
    // threw a plain TypeError. That is not a message isChunkLoadError recognises,
    // so no recovery happened and the visitor got the error screen instead of the
    // beach.
    //
    // Rewriting it as a chunk-load failure routes it into the existing recovery
    // (clear caches, reload once, with a cooldown) — which is the correct response,
    // because an empty module means the code never arrived.
    if (!module || typeof module.default === 'undefined') {
      throw new Error(`Failed to fetch dynamically imported module: ${source} resolved empty`);
    }
    return module;
  })
  .catch(error => recoverFromChunkLoadError(error, source)));

/**
 * Pull a named export out of a lazily-imported module, failing loudly if it is not
 * there. `import(...).then(m => ({ default: m.Thing }))` reads `Thing` off whatever
 * came back — and if that is undefined, the TypeError names a minified variable and
 * tells you nothing. This throws a message the chunk-recovery path understands.
 */
export const pickLazyExport = <T,>(name: string, source: string) => (module: Record<string, T> | undefined) => {
  const component = module?.[name];
  if (component) return { default: component };

  // 03/09/2026 — «LandingView is missing export LandingView», iPhone Safari 26.6, live
  // build e6cd326, ΚΑΙ μετά την επαναφόρτωση της ανάκαμψης. Το dist του ίδιου κώδικα
  // τελειώνει με `export{Gt as LandingView,Gt as default}`, οπότε το αρχείο δεν έφταιγε:
  // κάτι έφτασε στον browser ως module χωρίς τα exports του. Δύο μικρά μαθήματα από αυτό:
  //
  // 1. Όταν το module κουβαλάει `default` (LandingView, TripPlanner, AddBeachPhotoSheet
  //    εξάγουν και τα δύο), το default ΕΙΝΑΙ το ίδιο component — δείξ' το, αντί να
  //    ρίξεις τον επισκέπτη σε επαναφόρτωση για ένα όνομα.
  // 2. Το μήνυμα λέει τι ΒΡΗΚΕ. «Λείπει το X» δεν ξεχωρίζει το άδειο module (το αρχείο
  //    δεν ήρθε ποτέ ολόκληρο — θέμα δικτύου/cache) από module με άλλα exports (θέμα
  //    build). Την επόμενη φορά η ειδοποίηση θα λέει από μόνη της ποιο από τα δύο ήταν.
  //
  // Το πρόθεμα «Failed to fetch dynamically imported module:» μένει απαράλλαχτο: πάνω
  // του πατούν isChunkLoadError εδώ, το φίλτρο του services/errorReporter.ts και η
  // κατηγοριοποίηση 🟠 στο netlify/functions/client-error.mjs.
  const fallback = module?.default;
  if (fallback) return { default: fallback };

  const seen = module ? Object.keys(module) : [];
  const detail = module
    ? (seen.length ? `module has only: ${seen.join(', ')}` : 'module arrived empty')
    : 'module is undefined';
  throw new Error(`Failed to fetch dynamically imported module: ${source} is missing export ${name} (${detail})`);
};

export const registerChunkLoadErrorHandler = () => {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();
    const preloadEvent = event as Event & { payload?: unknown; detail?: unknown };
    void recoverFromChunkLoadError(preloadEvent.payload ?? preloadEvent.detail ?? event, 'vite:preloadError');
  });
};

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
    await clearAppRuntimeCaches();
  } finally {
    window.location.reload();
  }

  return new Promise<never>(() => undefined);
};

export const lazyWithChunkRecovery = <T extends React.ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  source: string
) => React.lazy(() => loader()
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
  if (!component) {
    throw new Error(`Failed to fetch dynamically imported module: ${source} is missing export ${name}`);
  }
  return { default: component };
};

export const registerChunkLoadErrorHandler = () => {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();
    const preloadEvent = event as Event & { payload?: unknown; detail?: unknown };
    void recoverFromChunkLoadError(preloadEvent.payload ?? preloadEvent.detail ?? event, 'vite:preloadError');
  });
};

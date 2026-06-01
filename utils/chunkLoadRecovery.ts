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
) => React.lazy(() => loader().catch(error => recoverFromChunkLoadError(error, source)));

export const registerChunkLoadErrorHandler = () => {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();
    const preloadEvent = event as Event & { payload?: unknown; detail?: unknown };
    void recoverFromChunkLoadError(preloadEvent.payload ?? preloadEvent.detail ?? event, 'vite:preloadError');
  });
};

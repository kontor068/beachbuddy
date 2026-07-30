// ─────────────────────────────────────────────────────────────────────────────
// Client-side crash reporting — the sending half of netlify/functions/client-error.mjs.
//
// Before this existed, a crash on a visitor's phone left no trace anywhere. ~86% of
// the audience is mobile, mostly tourists on island 4G: the people least likely to
// report a white screen and most likely to close the tab and use Google instead.
//
// Rules this file keeps:
//   • Never send anything that identifies a person. Message, stack, path, build id.
//     The page PATH only — not the query string, which can carry `?near=1` and
//     coordinates the user chose to share with their browser and not with us.
//   • Never break the page it is reporting on. Every path is guarded and silent.
//   • Never become the problem: identical errors are collapsed in-session, and the
//     function collapses them again per day.
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = '/.netlify/functions/client-error';

/** Signatures already sent by THIS page view. A render loop can throw the same error
 *  hundreds of times a second; the server dedups per day, but there is no reason to
 *  spend the visitor's bandwidth finding that out. */
const sentThisSession = new Set<string>();
const MAX_PER_SESSION = 5;

const trimmed = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

/** Path without query or hash: `?near=1` and friends can carry location intent. */
const currentPath = (): string => {
  try {
    return window.location.pathname.slice(0, 200);
  } catch {
    return '';
  }
};

const buildId = (): string => {
  try {
    return document.querySelector('meta[name="cb-build"]')?.getAttribute('content')?.slice(0, 60) || '';
  } catch {
    return '';
  }
};

export const reportClientError = (
  error: unknown,
  context?: { source?: string; line?: number },
): void => {
  try {
    if (import.meta.env?.DEV) return; // dev noise stays in the console

    const err = error as { message?: string; stack?: string } | undefined;
    const message = trimmed(err?.message, 300) || trimmed(error as string, 300) || 'Unknown error';
    const source = trimmed(context?.source, 200);
    const line = Number.isFinite(context?.line) ? Number(context?.line) : 0;

    const signature = `${message}|${source}|${line}`;
    if (sentThisSession.has(signature) || sentThisSession.size >= MAX_PER_SESSION) return;
    sentThisSession.add(signature);

    const payload = JSON.stringify({
      message,
      source,
      line,
      stack: trimmed(err?.stack, 1400),
      page: currentPath(),
      buildId: buildId(),
    });

    // keepalive so the report survives the navigation away from a broken page.
    // sendBeacon would be tidier but cannot set Content-Type: application/json,
    // and the function needs to tell a crash from a CSP report by its body shape.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* reporting must never surface an error of its own */ });
  } catch {
    /* never throw from the error reporter */
  }
};

/**
 * Catch what React's error boundary cannot: throws outside the component tree, and
 * rejected promises nobody handled. Both are how a fetch/parse bug actually shows up.
 */
export const installGlobalErrorReporting = (): void => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', event => {
    // Failed <img>/<script> loads also fire this with no `error` object. A dead
    // Wikimedia photo is not a crash, and reporting them would drown the channel.
    if (!event.error) return;
    reportClientError(event.error, { source: event.filename, line: event.lineno });
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    reportClientError(
      reason instanceof Error ? reason : { message: String(reason), stack: '' },
      { source: 'unhandledrejection' },
    );
  });
};

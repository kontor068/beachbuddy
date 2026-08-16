/**
 * ROUTE A MEASUREMENT SCRIPT THROUGH THE PAID OPEN-METEO PLAN.
 *
 * WHY THIS EXISTS. On 16/08/2026 a day of national measuring exhausted Open-Meteo's FREE daily
 * allowance (~10k point-calls) and stopped the work mid-run — while the paid subscription bought on
 * 09/08 (1 million calls a month) sat completely unused. Every measurement script hits
 * `marine-api.open-meteo.com` / `api.open-meteo.com`, the free hosts. Only
 * netlify/functions/forecast.mjs knew about the customer hosts and the key.
 *
 * ⚠️ WHY IT IS A FETCH PATCH AND NOT A CHANGE TO THE PROVIDER. services/forecast/openMeteoProvider
 * .ts builds those URLs and it RUNS IN THE BROWSER. Teaching it to read a key would put a paid
 * credential one bundling mistake away from every visitor — the exact trap that killed the Gemini
 * feature (VITE_GEMINI_API_KEY). The measurement scripts must also keep running THE CODE THAT
 * SHIPS rather than a copy of it, so the provider cannot be forked either. Patching `fetch` inside
 * the script process satisfies both: shipped code is untouched and unaware, and the key never
 * exists anywhere a bundler can see it.
 *
 * THE KEY IS NEVER WRITTEN DOWN. It is read from the environment — normally piped straight from
 * `netlify env:get` into the same shell command that runs the measurement — and this module never
 * logs it, never returns it, and strips it out of any URL that reaches an error message.
 *
 * Usage — importing it IS the switch, because a script that imports this and forgets to call it
 * would silently spend the free allowance and look identical while doing so:
 *
 *     import './lib/paidOpenMeteo.mjs';
 *
 * and to run it:
 *
 *     OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" node scripts/…
 *
 * With no key in the environment it does nothing at all and the script runs on the free hosts
 * exactly as before, so nothing here can break an offline or unauthenticated run.
 */

/** Free host → paid host. Same paths, same parameters, plus `apikey`. */
const CUSTOMER_HOST = {
  'api.open-meteo.com': 'customer-api.open-meteo.com',
  'marine-api.open-meteo.com': 'customer-marine-api.open-meteo.com',
  'air-quality-api.open-meteo.com': 'customer-air-quality-api.open-meteo.com',
};

/** Never let a key reach a log line, an error message or a cache key. */
export const stripKey = (url) => String(url).replace(/([?&])apikey=[^&]*/g, '$1apikey=***');

let enabled = false;

/**
 * Returns true when the patch is active. Safe to call more than once.
 */
export const enablePaidOpenMeteo = ({ quiet = false } = {}) => {
  if (enabled) return true;
  const key = process.env.OPEN_METEO_API_KEY;
  if (!key) {
    if (!quiet) {
      console.log('  Open-Meteo: FREE hosts (no OPEN_METEO_API_KEY in the environment).');
      console.log('  A national sweep can exhaust the free daily allowance. To use the paid plan:');
      console.log('    OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" node …');
    }
    return false;
  }

  const nativeFetch = globalThis.fetch;
  if (typeof nativeFetch !== 'function') return false;

  globalThis.fetch = (input, init) => {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (typeof raw === 'string') {
        const url = new URL(raw);
        const paidHost = CUSTOMER_HOST[url.hostname];
        if (paidHost) {
          url.hostname = paidHost;
          // Set rather than append: a retry of an already-rewritten URL must not stack keys.
          url.searchParams.set('apikey', key);
          return nativeFetch(url.toString(), init);
        }
      }
    } catch {
      // A URL we cannot parse is a URL we do not touch.
    }
    return nativeFetch(input, init);
  };

  enabled = true;
  if (!quiet) console.log(`  Open-Meteo: PAID hosts (key length ${key.length}, never logged).`);
  return true;
};

// Importing this module is the switch. Deliberately a side effect: a script that imported it and
// forgot the call would burn the free allowance while looking exactly like one that had not.
enablePaidOpenMeteo();

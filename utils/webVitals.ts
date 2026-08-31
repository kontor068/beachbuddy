import { trackEvent } from '../services/analyticsService';

/**
 * Core Web Vitals, measured on real visitors.
 *
 * Until now the project measured 71 analytics events and not one of them carried a timing:
 * no PerformanceObserver anywhere, no LCP, no INP, no CLS. Page weight was governed by a
 * budget script that CI never ran, and the only speed number in existence was Netlify's own
 * RUM beacon, which reports to Netlify and not to us. So "is the site fast on a mid-range
 * Android on 4G at a beach" had no answer at all — it was the largest unmeasured thing in
 * the product, on a site where 88,7% of clicks are mobile.
 *
 * Three metrics, chosen because they are the three Google ranks on and the three a visitor
 * feels: LCP (when the main thing appears), INP (how long a tap takes to do something), CLS
 * (how much the page moves under your thumb).
 *
 * SAMPLE, NOT POPULATION. This reports through trackEvent, which stops at the consent gate,
 * so these numbers describe consenting visitors only. The first-party beacon would cover
 * everyone, but its wire is a deliberately tiny fixed vocabulary with no value field
 * (pageviewBeacon.ts ACTION_BY_EVENT) — carrying a number there means changing the wire, the
 * function and the 190 KB stats reader. Worth doing if the GA4 sample and the field data
 * ever disagree; not worth doing before there is any number at all.
 *
 * Read it as p75, split by device, exactly as Google does — never as an average. One slow
 * phone in a small sample moves a mean and moves nothing real.
 */

type Metric = { name: string; value: number; rating: string; navigationType?: string };

const report = ({ name, value, rating, navigationType }: Metric): void => {
  trackEvent('web_vital', undefined, {
    metric: name,
    // CLS is a unitless ratio in the 0-1 range; the other two are milliseconds. Rounding a
    // ratio to an integer would report every good page as 0, so keep three decimals there.
    value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
    rating,
    navigation_type: navigationType,
  });
};

let started = false;

/**
 * Loaded dynamically and only after the page has settled, so the library is a separate chunk
 * and never competes with first paint — measuring the load must not be part of the load.
 */
export const startWebVitals = (): void => {
  if (started || typeof window === 'undefined') return;
  started = true;

  const begin = () => {
    import('web-vitals')
      .then(({ onCLS, onINP, onLCP }) => {
        onCLS(report);
        onINP(report);
        onLCP(report);
      })
      // A missing chunk must never take the page with it; this is instrumentation.
      .catch(() => {});
  };

  if (document.readyState === 'complete') {
    begin();
  } else {
    window.addEventListener('load', begin, { once: true });
  }
};

import { LEGAL_OPERATOR } from './legalContent';

/**
 * "Something wrong here?" — the correction channel for the beach dataset.
 *
 * The dataset is OSM-derived and unverified field by field: 483 records carry
 * `metadata.confidence: 'low'` and 334 an access type of `'unknown'`. The person standing
 * on the beach is the cheapest ground truth we can get, and until now they had nowhere to
 * put it — the landing form is the sixth band of the landing page (which a beach page never
 * mounts), and the two footer addresses give no hint that a data correction is welcome.
 *
 * A mailto rather than the form, deliberately: it works from every page type, with no JS,
 * and with no new endpoint. The context rides in the body so the report says which page —
 * and, on a beach page, which record — it came from, without asking the visitor to explain.
 * The static footer emitted by scripts/prerenderBeachPages.mjs builds the same link for the
 * pre-hydration page; keep the two in step.
 */
export const buildReportProblemMailto = (subject: string, context: string): string => {
  const body = context ? `\n\n---\n${context}` : '';
  return `mailto:${LEGAL_OPERATOR.contactEmail}?subject=${encodeURIComponent(subject)}`
    + (body ? `&body=${encodeURIComponent(body)}` : '');
};

/** Path of the page being viewed, read at call time — the SPA changes it without remounting. */
export const currentPagePath = (): string => (
  typeof window !== 'undefined' ? window.location.pathname : '/'
);

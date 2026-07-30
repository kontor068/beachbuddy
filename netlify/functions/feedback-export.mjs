// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK EXPORT — the read side of the durable condition-feedback log.
//
// feedback-email.mjs writes every beach-attached "how was it really?" verdict to
// Netlify Blobs (store 'feedback-log') as well as pushing it to Telegram. This
// endpoint dumps that store as the JSON array scripts/calibrateFromFeedback.mjs
// expects, replacing the old manual GA4/BigQuery export step:
//
//   curl "https://calmbeach.gr/api/feedback-export?key=YOUR_KEY" -o .tmp/feedback-export.json
//   node scripts/calibrateFromFeedback.mjs --input .tmp/feedback-export.json
//
// Private: gated by a secret key so raw feedback is never public (unset ⇒ 403).
// See docs/feedback-calibration.md.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

const FEEDBACK_STORE = 'feedback-log';

export const handler = async (event) => {
  const key = process.env.FEEDBACK_EXPORT_KEY || '';
  const given = (event.queryStringParameters || {}).key || '';
  if (!key || given !== key) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Forbidden' };
  }

  const params = event.queryStringParameters || {};
  // Optional window: only list days on/after this UTC day (YYYY-MM-DD).
  const since = /^\d{4}-\d{2}-\d{2}$/.test(params.since || '') ? params.since : null;

  try {
    connectLambda(event);
    const store = getStore(FEEDBACK_STORE);

    const records = [];
    for await (const page of store.list({ prefix: 'f/', paginate: true })) {
      for (const blob of page.blobs) {
        const dayKey = blob.key.slice('f/'.length, 'f/'.length + 10);
        if (since && dayKey < since) continue;
        const record = await store.get(blob.key, { type: 'json' });
        if (record) records.push(record);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(records, null, 2),
    };
  } catch (error) {
    // 500, not 200: scripts/calibrateFromFeedback.mjs reads this endpoint's body
    // straight into its input file. A 200 carrying an error string would be
    // silently "calibrated" as zero feedback instead of stopping the run. Stack
    // stays in the logs, not in the response.
    console.error('feedback-export failed.', error && error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: `feedback-export error: ${error && error.name}: ${error && error.message}`,
    };
  }
};

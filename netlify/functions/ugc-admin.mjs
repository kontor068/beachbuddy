// ─────────────────────────────────────────────────────────────────────────────
// UGC ADMIN — the moderation queue, as a plain web page.
//
//   https://calmbeach.gr/api/ugc-admin?key=YOUR_KEY
//
// NOT THE MAIN DOOR ANY MORE (11/08/2026). The same queue now lives inside the
// traffic console — /api/traffic?key=…&tab=photos — because an admin page you
// have to remember separately is an admin page you do not open. That is where
// the Telegram alert links and where the pending count is visible without
// asking for it. This file stays as a fallback that depends on nothing except
// Supabase: no map, no blobs day-scan, no traffic key. If the console ever
// breaks, moderation still has a door.
//
// Set UGC_ADMIN_KEY in the Netlify env to enable it (unset ⇒ 403, never open) —
// the same gate as /api/traffic. Deliberately built BEFORE anything can be
// uploaded: a moderation queue that arrives after the content it moderates means
// a window where unreviewed photos have nowhere to be reviewed.
//
// No JavaScript, no fetch, no framework — two <form> posts. That is not
// minimalism for its own sake: it means the page still works on a phone with a
// bad connection, and there is nothing here for the site's CSP to fight with.
//
// Every decision goes through lib/ugcModeration.mjs, which is also what the
// Telegram buttons call. One implementation, two doors.
// ─────────────────────────────────────────────────────────────────────────────

import {
  clearPendingPublish,
  isConfigured,
  isKnownKind,
  listPending,
  moderate,
  readPendingPublish,
  signPendingPhoto,
} from './lib/ugcModeration.mjs';

// ── Publishing costs build minutes, so a human decides when to spend them ─────
// Netlify's free plan includes a fixed number of build minutes per month, and a
// full CalmBeach build prerenders ~9.500 pages. An automatic rebuild on every
// approval would quietly burn that allowance; a nightly cron would burn it more
// predictably but still without anyone asking for it.
//
// So there is no cron and no automatic trigger. Approvals accumulate behind the
// flag and go live free of charge on the next ordinary code push. The button
// below exists for when that is too slow — one tap, one build, chosen on purpose.
// It only appears if NETLIFY_BUILD_HOOK_URL is set.
const triggerBuild = async (event) => {
  const hook = process.env.NETLIFY_BUILD_HOOK_URL || '';
  if (!hook) return 'Δεν υπάρχει build hook ρυθμισμένο (NETLIFY_BUILD_HOOK_URL).';
  const response = await fetch(hook, { method: 'POST', body: '{}' });
  if (!response.ok) return `Το χτίσιμο δεν ξεκίνησε (${response.status}).`;
  await clearPendingPublish(event);
  return 'Ξεκίνησε το χτίσιμο του site. Σε λίγα λεπτά τα εγκεκριμένα θα είναι στις δημόσιες σελίδες.';
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const html = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    // A moderation queue must never be indexed or linked-to from anywhere.
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  },
  body,
});

const forbidden = () => ({
  statusCode: 403,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  body: 'Forbidden',
});

/** Form bodies arrive urlencoded; the key travels in the body so it stays out of logs. */
const parseForm = (event) => {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  return Object.fromEntries(new URLSearchParams(raw));
};

const formatWhen = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('el-GR', { timeZone: 'Europe/Athens', dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(value).slice(0, 16);
  }
};

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { opacity: .65; font-size: 13px; margin-bottom: 20px; }
  .note { border-left: 3px solid #f59e0b; padding: 8px 12px; margin: 0 0 20px; background: rgba(245,158,11,.08); font-size: 14px; }
  .ok { border-left-color: #10b981; background: rgba(16,185,129,.08); }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  .card { border: 1px solid rgba(128,128,128,.35); border-radius: 12px; padding: 12px; margin-bottom: 14px; max-width: 640px; }
  .card img { width: 100%; max-width: 420px; height: auto; border-radius: 8px; display: block; margin-bottom: 10px; background: rgba(128,128,128,.15); }
  .meta { font-size: 13px; opacity: .75; margin-bottom: 10px; }
  .meta b { opacity: 1; }
  .body { white-space: pre-wrap; margin-bottom: 10px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  button { font: inherit; padding: 10px 18px; border-radius: 999px; border: 0; cursor: pointer; color: #fff; }
  .yes { background: #059669; }
  .no  { background: #b91c1c; }
  .empty { opacity: .6; }
  .stars { letter-spacing: 2px; }
`;

const renderPhoto = (item, signedUrl, key) => `
  <div class="card">
    ${signedUrl ? `<img src="${escapeHtml(signedUrl)}" alt="">` : '<div class="empty">— η εικόνα δεν φορτώνει —</div>'}
    <div class="meta">
      <b>Παραλία:</b> ${escapeHtml(item.region_id)} #${escapeHtml(item.beach_id)} ·
      <b>Μέγεθος:</b> ${item.bytes ? Math.round(item.bytes / 1024) + ' KB' : '—'} ·
      <b>Διαστάσεις:</b> ${item.width && item.height ? `${item.width}×${item.height}` : '—'} ·
      <b>Ανέβηκε:</b> ${escapeHtml(formatWhen(item.created_at))}
    </div>
    ${item.caption ? `<div class="body">${escapeHtml(item.caption)}</div>` : ''}
    ${actions('photo', item.id, key)}
  </div>`;

const renderReview = (item, key) => `
  <div class="card">
    <div class="meta">
      <b>Παραλία:</b> ${escapeHtml(item.region_id)} #${escapeHtml(item.beach_id)} ·
      <span class="stars">${'★'.repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)))}${'☆'.repeat(5 - Math.max(0, Math.min(5, Number(item.rating) || 0)))}</span> ·
      <b>Γράφτηκε:</b> ${escapeHtml(formatWhen(item.created_at))}
    </div>
    <div class="body">${escapeHtml(item.body || '— χωρίς κείμενο —')}</div>
    ${actions('review', item.id, key)}
  </div>`;

const actions = (kind, id, key) => `
  <form method="post" class="row">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="kind" value="${escapeHtml(kind)}">
    <input type="hidden" name="id" value="${escapeHtml(id)}">
    <button class="yes" name="action" value="approve">✅ Δημοσίευση</button>
    <button class="no"  name="action" value="reject">🚫 Απόρριψη</button>
  </form>`;

const renderPage = async (key, flash, event) => {
  if (!isConfigured()) {
    return html(200, `<!doctype html><meta charset="utf-8"><title>Ουρά έγκρισης</title><style>${STYLE}</style>
      <h1>Ουρά έγκρισης</h1>
      <p class="note">Η Supabase δεν είναι ρυθμισμένη ακόμα. Λείπουν τα <code>SUPABASE_URL</code> /
      <code>SUPABASE_SERVICE_ROLE_KEY</code> από τις μεταβλητές του Netlify. Μέχρι τότε δεν υπάρχει
      τίποτα να εγκριθεί — αυτό είναι φυσιολογικό, όχι σφάλμα.</p>`);
  }

  const [photos, reviews, pending] = await Promise.all([
    listPending('photo').catch((error) => ({ error })),
    listPending('review').catch((error) => ({ error })),
    readPendingPublish(event).catch(() => null),
  ]);

  const problem = photos?.error || reviews?.error;
  const photoList = Array.isArray(photos) ? photos : [];
  const reviewList = Array.isArray(reviews) ? reviews : [];

  // Thumbnails are minted server-side, one signed URL per pending photo. The
  // bucket stays private — the page holds the only links, and they die in an hour.
  const signed = await Promise.all(photoList.map((item) => (
    item.storage_path ? signPendingPhoto(item.storage_path, 3600).catch(() => '') : Promise.resolve('')
  )));

  return html(200, `<!doctype html><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Ουρά έγκρισης · CalmBeach</title>
    <style>${STYLE}</style>
    <h1>Ουρά έγκρισης</h1>
    <div class="sub">Φωτογραφίες και κριτικές επισκεπτών που περιμένουν. Τίποτα εδώ δεν είναι ορατό στο κοινό.</div>
    ${flash ? `<p class="note ok">${escapeHtml(flash)}</p>` : ''}
    ${problem ? `<p class="note">Πρόβλημα ανάγνωσης: ${escapeHtml(problem.message || problem)}</p>` : ''}
    ${pending?.count ? `<div class="note">
      Υπάρχουν <b>${escapeHtml(pending.count)}</b> εγκεκριμένα που δεν έχουν βγει ακόμα στις δημόσιες σελίδες.
      Θα βγουν <b>δωρεάν</b> στο επόμενο κανονικό ανέβασμα κώδικα — δεν χρειάζεται να κάνεις τίποτα.
      ${process.env.NETLIFY_BUILD_HOOK_URL ? `
      <form method="post" class="row" style="margin-top:10px">
        <input type="hidden" name="key" value="${escapeHtml(key)}">
        <button class="yes" name="action" value="publish">🚀 Δημοσίευσε τώρα (ξοδεύει ένα χτίσιμο)</button>
      </form>` : ''}
    </div>` : ''}

    <h2>Φωτογραφίες (${photoList.length})</h2>
    ${photoList.length
      ? photoList.map((item, index) => renderPhoto(item, signed[index], key)).join('')
      : '<p class="empty">Καμία φωτογραφία σε αναμονή.</p>'}

    <h2>Κριτικές (${reviewList.length})</h2>
    ${reviewList.length
      ? reviewList.map((item) => renderReview(item, key)).join('')
      : '<p class="empty">Καμία κριτική σε αναμονή.</p>'}
  `);
};

export const handler = async (event) => {
  const key = process.env.UGC_ADMIN_KEY || '';
  if (!key) return forbidden();

  if (event.httpMethod === 'POST') {
    const form = parseForm(event);
    // Constant-time-ish: length check first, then compare. The key is long and
    // random; this endpoint is also not discoverable, but neither is a reason to
    // leave the door open.
    if (form.key !== key) return forbidden();

    const { kind, id, action } = form;

    // "Publish now" carries no item — it spends a build, nothing else.
    if (action === 'publish') {
      try {
        return await renderPage(key, await triggerBuild(event), event);
      } catch (error) {
        console.error('Build trigger failed.', error && error.message);
        return await renderPage(key, `Το χτίσιμο δεν ξεκίνησε: ${error.message || 'άγνωστο σφάλμα'}.`, event);
      }
    }

    if (!isKnownKind(kind) || !id || (action !== 'approve' && action !== 'reject')) {
      return html(400, '<!doctype html><meta charset="utf-8"><p>Λάθος αίτημα.</p>');
    }

    try {
      const result = await moderate({ kind, id, action, event });
      const what = kind === 'photo' ? 'Η φωτογραφία' : 'Η κριτική';
      const flash = result.alreadyDone
        ? `${what} είχε ήδη κριθεί (${result.status}) — δεν έγινε τίποτα δεύτερη φορά.`
        : (result.status === 'approved'
          ? `${what} εγκρίθηκε. Θα εμφανιστεί στη δημόσια σελίδα στο επόμενο χτίσιμο.`
          : `${what} απορρίφθηκε και το αρχείο διαγράφηκε.`);
      return renderPage(key, flash, event);
    } catch (error) {
      console.error('Moderation failed.', error && error.message);
      return html(error.statusCode || 500, `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>
        <h1>Δεν έγινε</h1><p class="note">${escapeHtml(error.message || 'Άγνωστο σφάλμα.')}</p>
        <p><a href="/api/ugc-admin?key=${encodeURIComponent(key)}">← πίσω στην ουρά</a></p>`);
    }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { Allow: 'GET, POST' }, body: 'Method not allowed' };
  }

  const given = (event.queryStringParameters || {}).key || '';
  if (given !== key) return forbidden();

  try {
    return await renderPage(key, '', event);
  } catch (error) {
    console.error('Could not render the moderation queue.', error && error.message);
    return html(500, `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>
      <h1>Ουρά έγκρισης</h1><p class="note">${escapeHtml(error.message || 'Άγνωστο σφάλμα.')}</p>`);
  }
};

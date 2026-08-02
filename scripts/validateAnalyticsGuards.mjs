/**
 * THE VISITOR COUNTER ONLY COUNTS OUR OWN VISITORS — gate.
 *
 * `/api/hit` is unauthenticated and same-origin-only by design, but it is reachable by anyone who
 * reads the bundle. On 02/08/2026 it reported 6.937 unique visitors and 1.008 new ones for a day
 * GA4 measured at 82 users in total: uniqueness is only ip+UA+day and the UA is chosen by the
 * caller, so a script manufactures as many "unique" visitors as it likes.
 *
 * Two guards were added — same-origin and a per-IP burst limit — and this gate is what keeps them
 * honest, because NOTHING ELSE COVERS THE NETLIFY FUNCTIONS. There is no build step over them, no
 * type check that reaches them, and the critical gate set never opened one until today. They ship
 * straight to production on push.
 *
 * WHY IT DRIVES THE PREDICATES AND NOT THE HANDLER. The handler answers 204 for every outcome —
 * accepted, refused, or storage error — on purpose, so a probing script cannot tell which header
 * it is missing. That is the right behaviour and it makes the handler useless as a test surface:
 * every case looks the same from outside. Measured before this gate existed: calling the handler
 * with a hostile origin returned 204, and calling it with a legitimate one returned 204 as well,
 * because Blobs is unavailable off-platform and the catch swallows it. A test built on that would
 * have passed with both guards deleted.
 *
 * Run: node scripts/validateAnalyticsGuards.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = await import(pathToFileURL(path.join(root, 'netlify/functions/pageview.mjs')).href);
const { isTrustedOrigin, isRateLimited, handler } = mod;

const failures = [];
const check = (name, actual, expected) => {
  if (actual !== expected) failures.push(`${name}: got ${actual}, expected ${expected}`);
};

// ── 1. Same-origin ───────────────────────────────────────────────────────────
// The real client always sends Origin (fetch) or Referer (sendBeacon on some browsers), so the
// only traffic this turns away is a direct scripted hit or a third-party page embedding the
// beacon. Deploy previews and branch deploys live on *.netlify.app and MUST keep working, or the
// counter goes silent on every preview and nobody notices until production.
if (typeof isTrustedOrigin !== 'function') {
  failures.push('pageview.mjs no longer exports isTrustedOrigin — the same-origin guard is gone or renamed.');
} else {
  check('own origin', isTrustedOrigin({ origin: 'https://calmbeach.gr' }), true);
  check('www', isTrustedOrigin({ origin: 'https://www.calmbeach.gr/' }), true);
  check('deploy preview', isTrustedOrigin({ origin: 'https://deploy-preview-12--calmbeach.netlify.app' }), true);
  check('localhost dev', isTrustedOrigin({ origin: 'http://localhost:5173' }), true);
  check('referer fallback', isTrustedOrigin({ referer: 'https://calmbeach.gr/beaches/x' }), true);
  check('capitalised header', isTrustedOrigin({ Origin: 'https://calmbeach.gr' }), true);

  check('hostile origin', isTrustedOrigin({ origin: 'https://evil.example' }), false);
  check('no headers at all', isTrustedOrigin({}), false);
  check('empty origin', isTrustedOrigin({ origin: '' }), false);
  check('garbage origin', isTrustedOrigin({ origin: 'not a url' }), false);
  // The lookalike domain is the one a suffix check would wave through — this is why the guard
  // compares the whole hostname and not `endsWith('calmbeach.gr')`.
  check('lookalike domain', isTrustedOrigin({ origin: 'https://calmbeach.gr.evil.example' }), false);
  check('netlify lookalike', isTrustedOrigin({ origin: 'https://netlify.app.evil.example' }), false);
  // Origin wins over Referer: a hostile page can set its own Referer but not forge Origin.
  check('hostile origin beats good referer',
    isTrustedOrigin({ origin: 'https://evil.example', referer: 'https://calmbeach.gr/' }), false);
}

// ── 2. Per-IP burst limit ────────────────────────────────────────────────────
// Generous on purpose: one visitor legitimately fires several hits a minute, and a café wifi or
// mobile CGNAT shares one IP across many people. The limit exists to stop a flood, not to police
// ordinary browsing — a false positive here silently loses real traffic from a whole building.
if (typeof isRateLimited !== 'function') {
  failures.push('pageview.mjs no longer exports isRateLimited — the burst guard is gone or renamed.');
} else {
  const ipHeaders = ip => ({ 'x-nf-client-connection-ip': ip });

  // A normal visitor: a burst of ordinary page views must never be refused.
  let normalRefused = 0;
  for (let i = 0; i < 30; i += 1) if (isRateLimited(ipHeaders('198.51.100.7'))) normalRefused += 1;
  check('30 hits from one real visitor', normalRefused, 0);

  // A flood from a single IP must be cut off.
  let floodRefused = 0;
  for (let i = 0; i < 400; i += 1) if (isRateLimited(ipHeaders('203.0.113.9'))) floodRefused += 1;
  if (floodRefused === 0) failures.push('400 hits from one IP were all accepted — the burst limit does not fire.');

  // A flood from ONE address must not lock out everybody else: the counter is keyed per IP, and
  // a shared limiter would let one attacker mute the whole site's analytics.
  check('a different IP after the flood', isRateLimited(ipHeaders('192.0.2.55')), false);

  // No usable IP means no limiting — refusing here would drop every hit whose proxy chain we
  // cannot read, which is a worse failure than not limiting those.
  check('unknown IP', isRateLimited({}), false);
}

// ── 3. The handler still refuses GET ─────────────────────────────────────────
// GET needed no Origin and no body, so it was an unauthenticated pixel anyone could embed in a
// page to inflate the count. This check runs through the real handler because the method test
// sits above the storage call and therefore genuinely reaches it.
{
  const res = await handler({ httpMethod: 'GET', headers: {} });
  check('GET is refused', res?.statusCode, 204);
  const src = await import('node:fs').then(fs => fs.readFileSync(path.join(root, 'netlify/functions/pageview.mjs'), 'utf8'));
  if (!/event\.httpMethod !== 'POST'/.test(src)) {
    failures.push('pageview.mjs no longer restricts the method to POST — the embeddable-pixel hole is back.');
  }
}

console.log('Visitor-counter guards — same-origin, per-IP burst, POST-only\n');

if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} guard problem(s).`);
  failures.forEach(f => console.error('  - ' + f));
  console.error('\nThe counter would start accepting hits from anywhere again, and nothing else');
  console.error('watches these functions — they ship straight to production on push.');
  process.exit(1);
}

console.log('PASSED: the counter refuses foreign origins, cuts off floods per IP, and takes POST only.');

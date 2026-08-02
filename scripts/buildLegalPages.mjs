// Generates the crawlable static legal pages (public/{terms,privacy,cookies}/index.html)
// from the single source of truth data/legalContent.json — the SAME data the in-app
// modals render (components/LegalDocument.tsx), so the two surfaces can never drift.
//
// Runs as the first step of `npm run build` so vite copies the fresh pages from public/
// into dist/ (and from there into the native app assets via `cap sync`).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const data = JSON.parse(readFileSync(join(ROOT, 'data', 'legalContent.json'), 'utf8'));
const op = data.operator;

const SLUGS = { terms: 'terms', privacy: 'privacy', cookies: 'cookies' };
const HREF = { terms: '/terms/', privacy: '/privacy/', cookies: '/cookies/' };
const TOKEN_LABEL = {
  gr: { terms: 'Όροι Χρήσης', privacy: 'Πολιτική Απορρήτου', cookies: 'Πολιτική Cookies' },
  en: { terms: 'Terms of Use', privacy: 'Privacy Policy', cookies: 'Cookie Policy' },
};
const UPDATED_LABEL = { gr: 'Τελευταία ενημέρωση', en: 'Last updated' };
const BACK_LABEL = { gr: 'Επιστροφή στην εφαρμογή', en: 'Back to the app' };

const esc = (str) =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const anchor = (href, label, external) =>
  `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a>`;

const renderInline = (text, lang) => {
  let html = esc(text);
  const tokens = {
    terms: anchor(HREF.terms, TOKEN_LABEL[lang].terms),
    privacy: anchor(HREF.privacy, TOKEN_LABEL[lang].privacy),
    cookies: anchor(HREF.cookies, TOKEN_LABEL[lang].cookies),
    privacyEmail: anchor(`mailto:${op.privacyEmail}`, op.privacyEmail),
    contactEmail: anchor(`mailto:${op.contactEmail}`, op.contactEmail),
    phone: anchor(`tel:${op.phoneTel}`, op.phone),
    website: anchor(`https://${op.website}/`, op.website, true),
    dpa: anchor(`https://${op.dpaUrl}`, op.dpaUrl, true),
  };
  for (const [name, replacement] of Object.entries(tokens)) {
    html = html.split(`{${name}}`).join(replacement);
  }
  return html;
};

const renderBlock = (block, lang) => {
  if ('h' in block) return `<h2>${esc(block.h)}</h2>`;
  if ('note' in block) return `<div class="operator">${renderInline(block.note, lang)}</div>`;
  if ('ul' in block) return `<ul>${block.ul.map((i) => `<li>${renderInline(i, lang)}</li>`).join('')}</ul>`;
  if ('table' in block) {
    const head = block.table.head.map((c) => `<th>${esc(c)}</th>`).join('');
    const rows = block.table.rows
      .map((row) => `<tr>${row.map((c) => `<td>${renderInline(c, lang)}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return `<p>${renderInline(block.p, lang)}</p>`;
};

const renderDoc = (doc, lang) =>
  [
    `<h1>${esc(doc.title)}</h1>`,
    `<p class="updated">${UPDATED_LABEL[lang]}: ${esc(data.updated[lang])}</p>`,
    ...doc.blocks.map((b) => renderBlock(b, lang)),
  ].join('\n    ');

const BRAND_SVG =
  '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><path d="M85.5 56.3 A36 36 0 1 0 40.7 84.8" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/><path d="M38 48 q6 -7 12 0 q6 7 12 0" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><path d="M40 60 q5 -5.5 10 0 q5 5.5 10 0" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity="0.55"/></svg>';

const footNav = (kind) => {
  const others = Object.keys(SLUGS).filter((k) => k !== kind);
  const links = others
    .map((k) => `${anchor(HREF[k], TOKEN_LABEL.gr[k])} / ${anchor(HREF[k], TOKEN_LABEL.en[k])}`)
    .join(' &nbsp;·&nbsp; ');
  return `${links} &nbsp;·&nbsp; ${anchor('/', `${BACK_LABEL.gr} / ${BACK_LABEL.en}`)}`;
};

const page = (kind, { archived = false } = {}) => {
  const gr = data.docs[kind].gr;
  const en = data.docs[kind].en;
  // Google truncates around 60 chars. The full bilingual title runs to 109 on
  // /privacy/ ("Πολιτική Απορρήτου & Προστασίας Προσωπικών Δεδομένων — Calm
  // Beach / Privacy & Personal Data Protection Policy"), so the entire English
  // half was cut off in the result. Fall back to the short labels that already
  // name these documents in the footer; both languages then survive.
  // Archived snapshots keep the exact title they shipped with: they are a record
  // of what the user agreed to, they are noindex, and rewriting them would make
  // the archive disagree with itself. Only the live page gets shortened.
  const fullTitle = `${gr.title} — Calm Beach / ${en.title}`;
  const title = archived || fullTitle.length <= 60
    ? fullTitle
    : `${TOKEN_LABEL.gr[kind]} — Calm Beach / ${TOKEN_LABEL.en[kind]}`;
  const archivedBanner = archived
    ? `<div class="operator" style="border-color:#fbbf24;background:#fffbeb">Αρχειοθετημένη έκδοση v${esc(data.version)}. Δείτε την <a href="/${SLUGS[kind]}/">τρέχουσα έκδοση</a>. / Archived version — see the <a href="/${SLUGS[kind]}/">current version</a>.</div>`
    : '';
  return `<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0d9488" />
  <meta name="robots" content="${archived ? 'noindex, nofollow' : 'index, follow'}" />
  <title>${esc(title)}${archived ? ` (v${esc(data.version)})` : ''}</title>
  <meta name="description" content="${esc(gr.title)} — Calm Beach. ${esc(en.title)}." />
  <link rel="canonical" href="https://calmbeach.gr/${SLUGS[kind]}/" />
  <link rel="icon" type="image/svg+xml" href="/calmbeach-mark.svg" />
  <style>
    :root { --teal:#0d9488; --teal-d:#0f766e; --ink:#0C4A6E; --bg:#F0F9FF; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:#1f2937; font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 24px 20px 72px; }
    header.brand { display:flex; align-items:center; gap:12px; padding:18px 0 8px; }
    header.brand svg { width:40px; height:40px; flex:0 0 auto; }
    header.brand b { color:var(--teal-d); font-size:20px; }
    h1 { color:var(--ink); font-size:26px; margin:22px 0 4px; }
    h2 { color:var(--teal-d); font-size:18px; margin:28px 0 6px; border-bottom:2px solid #cbeae6; padding-bottom:6px; }
    p { margin:6px 0 10px; }
    ul { margin:6px 0 12px; padding-left:22px; }
    li { margin:4px 0; }
    a { color:var(--teal-d); }
    .updated { color:#64748b; font-size:14px; }
    .lang { display:inline-block; background:#cbeae6; color:var(--teal-d); font-weight:600; font-size:13px; padding:3px 10px; border-radius:999px; margin:40px 0 0; }
    .operator { background:#fff; border:1px solid #cbeae6; border-radius:12px; padding:12px 14px; margin:12px 0; font-size:14px; }
    .tablewrap { overflow-x:auto; margin:10px 0 14px; }
    table { border-collapse:collapse; width:100%; font-size:14px; }
    th, td { border:1px solid #cbeae6; padding:8px 10px; text-align:left; vertical-align:top; }
    th { background:#e9f7f5; color:var(--ink); }
    nav.foot { margin-top:40px; padding-top:18px; border-top:1px solid #cbeae6; font-size:14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="brand">
      ${BRAND_SVG}
      <b>Calm Beach</b>
    </header>

    ${archivedBanner}
    ${renderDoc(gr, 'gr')}

    <span class="lang">English</span>
    ${renderDoc(en, 'en')}

    <nav class="foot">${footNav(kind)}</nav>
  </div>
</body>
</html>
`;
};

// Immutable, timestamped archive of every published version (point 5: "τήρηση αρχείου
// προηγούμενων εκδόσεων"). Snapshots are noindex and committed to git, so each prior
// version stays retrievable at /legal-archive/v<version>/<kind>.html after the next bump.
const archiveDir = join(ROOT, 'public', 'legal-archive', `v${data.version}`);
mkdirSync(archiveDir, { recursive: true });

for (const kind of Object.keys(SLUGS)) {
  const dir = join(ROOT, 'public', SLUGS[kind]);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(kind), 'utf8');
  writeFileSync(join(archiveDir, `${SLUGS[kind]}.html`), page(kind, { archived: true }), 'utf8');
  console.log(`✓ public/${SLUGS[kind]}/index.html  (+ archive v${data.version})`);
}

# i18n / canonical / hreflang architecture audit — calmbeach.gr

Date: 2026-07-03. Diagnostic pass run before scaling to more languages. Read the
routing/locale setup, the prerender `<head>` generator (canonical + hreflang),
the sitemap generator, every redirect source, and the Netlify config — then
cross-checked against the real `dist/` output (canonical/hreflang on root vs
/el vs /de, `sitemap.xml`, `_redirects`).

**Verdict: the architecture is healthy. Do not change it structurally.** Only one
low-risk hardening (Fix #3) was applied; the rest are gated (see below).

---

## Confirmed architecture (do NOT swap or redirect)

- **Root = English.** The `en` locale has `pathPrefix: ''`
  (`scripts/prerenderBeachPages.mjs:47`), so `calmbeach.gr/beaches/...` is the
  **English** page. `getInitialLanguage()` boots `'en'` at the root with no
  browser-language autodetect (`utils/i18n.ts:43`).
- **Greek = `/el/`.** The `el` locale has `pathPrefix: '/el'`
  (`scripts/prerenderBeachPages.mjs:58`). The correct Greek URL is
  `calmbeach.gr/el/beaches/...`.
- **de/fr/it = `/de|fr|it/`, Milos pilot only** (`LOCALIZED_REGIONS`,
  `scripts/prerenderBeachPages.mjs:106`).
- **Every page is self-canonical** (`canonicalUrlFor` → self,
  `scripts/prerenderBeachPages.mjs:239`; injected at `:1369-1373`).
- **hreflang is a correct bidirectional cluster.** Each page lists every locale
  it was generated in plus `x-default → en (root)`
  (`alternateUrlsFor`, `scripts/prerenderBeachPages.mjs:250-259`). Non-Milos
  pages emit only `en` + `el` (never de/fr/it → no hreflang to a 404).
- This is the standard "default language at root, others prefixed" pattern.
  Root(en) and /el(gr) are **different languages, not duplicates.**

Real `dist/` evidence (Sarakiniko):

| URL | html-lang | canonical | hreflang set |
|---|---|---|---|
| `/beaches/milos/1922-sarakiniko/` | en | self (root) | en→root, el→/el, de/fr/it→/xx, x-default→root |
| `/el/beaches/milos/1922-sarakiniko/` | el | self (/el) | same cluster, reciprocal |
| `/de/beaches/milos/1922-sarakiniko/` | de | self (/de) | same cluster |
| `/beaches/kefalonia/` (non-Milos) | en | self | **only** en + el + x-default |

Why NOT "make root Greek" or "root → /el/ 301": both would 301 thousands of
English root URLs that already rank (beach-name / transliteration queries) and
invalidate x-default. High risk, wrong direction. The suspected duplication does
not exist. **Keep root=en self-canonical, /el=gr self-canonical.**

---

## Findings by severity

| # | Severity | Issue | Location | Status |
|---|---|---|---|---|
| — | premise | Root is **English**, not Greek; correct Greek URL is `/el/` | `utils/i18n.ts:43`, `prerenderBeachPages.mjs:47/58` | clarified |
| 1 | warning | Trailing-slash 301 only covers root `/beaches/…` — not `/el/`, `/de\|fr\|it/`, category (`/family-beaches/…`), or landings | `netlify.toml:5-13` | **GATED** (see below) |
| 2 | warning | Up to 3-hop redirect chains for the oldest URLs (old `region.id` + old slug + no-slash) — 784 combos | `prerenderBeachPages.mjs:3060` + `3077-3079` + `netlify.toml:6` | **GATED** (see below) |
| 3 | warning | Client canonical override used raw `pathname` (no trailing-slash normalize) | `App.tsx:2373-2390` | **FIXED** |
| 4 | info | `x-default → en (root)` — a strategic choice for a Greek-first audience | `prerenderBeachPages.mjs:255-258` | keep en |
| 5 | info | de/fr/it client-nav to a non-Milos beach lands on the root (English) URL | `utils/beachUrls.ts:82-86` | matters only at rollout |
| 6 | info | Root language depends on stored preference (a returning gr-preference user sees Greek at the English root; Googlebot has no localStorage → always en) | `utils/i18n.ts:36-43` | no SEO impact |

**No critical issues.** The foundation is sound.

### Confirmed healthy (evidence)
- **Canonical**: every page self-canonical; no root↔/el cross-canonicalization.
- **hreflang**: bidirectional everywhere, x-default present, non-Milos emits only
  en+el → **0 orphans** (verified against real dist, matches `seo:audit`).
- **Sitemap**: 6,617 URLs, **0 duplicates**, **100% trailing-slash**,
  canonical-only (no region.id / legacy / redirect-source leaks); symmetric
  en/el (3,235 each) + Milos de/fr/it (49 each). Only `canonicalUrlFor(...)` is
  emitted (`prerenderBeachPages.mjs:3087`).
- **Redirects**: 1,126, all 301, **0 loops**, 0 direct 1-hop-to-another-source
  chains apart from the splat+legacy class in #2. `landingRedirects` all target
  canonical pages (`prerenderBeachPages.mjs:1160-1164`).
- **Client nav** builds URLs with a trailing slash + correct prefix
  (`utils/beachUrls.ts:115/120`). robots: `index, follow`, sitemap referenced.

---

## Fix #3 — applied (client canonical trailing-slash normalize)

`App.tsx` (detail/region/home SEO effect). Category/landing pages are static-only
(no SPA route) so this effect never touches them; it only affects SPA views,
whose builders already use the slash form. The normalize closes the
external-no-slash-link edge and keeps the client canonical identical to the
prerendered (slash) canonical.

```js
const canonicalPath = typeof window !== 'undefined'
  ? (window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`)
  : '/';
const canonicalUrl = typeof window !== 'undefined'
  ? `${window.location.origin}${canonicalPath}`
  : 'https://calmbeach.gr/';
```

---

## Gated fixes — do NOT apply unless GSC says so

Both are low-severity hygiene that only matter if Search Console reports the
specific symptom. Applying them speculatively adds redirect bulk / config
surface for no confirmed benefit.

### Fix #1 — trailing-slash coverage for locale/category/landing paths
**Trigger: apply ONLY if GSC Coverage (Page indexing) reports non-slash
"Duplicate" / "Alternate page with proper canonical tag" on `/el/…`, `/de|fr|it/…`,
category or landing URLs.**

Today Netlify's built-in "Pretty URLs" 301s `/path` → `/path/` for directories,
and the canonical tag dedupes regardless — which is why no non-slash duplicates
appear. If the symptom shows up:
- Preferred: rely on the Netlify default uniformly and delete the now-partial
  explicit beach-only rules at `netlify.toml:5-13` (they cover only root
  `/beaches/…`).
- Or add explicit rules for the missing prefixes (`/el/*`, `/de|fr|it/*`) and
  category/landing paths.

### Fix #2 — flatten the 784 potential redirect chains
**Trigger: apply ONLY if GSC Coverage reports "Redirect chain" / "Page with
redirect" warnings, or the redirect count becomes a measured problem.**

Old URLs that combine the old `region.id` path AND an old beach slug chain:
`region.id → slug` (splat, `prerenderBeachPages.mjs:3060`) then
`old-slug → new-slug` (`:3077-3079`), plus a leading netlify.toml slash-add hop
for the no-slash form — up to 3 hops. Only the doubly-old URLs are affected;
Google tolerates ≤5 hops and consolidates. If it must be flattened, emit a direct
1-hop from the fully-old URL in the beach loop (`prerenderBeachPages.mjs:3077`):

```js
const oldRegionBase = legacyRegionPath(region.id);
const underOldRegion = slug => `${oldRegionBase}${beach.id}-${slug}/`;
if (oldRegionBase !== regionPath(region, island)) {
  const currentSlug = normalizeSlug(displayName(beach.name, `beach-${beach.id}`, 'en'));
  for (const s of [currentSlug, ...(beach.legacySlugs || []).map(normalizeSlug)]) {
    redirects.push(`${underOldRegion(s)} ${routePath} 301`);
    redirects.push(`${underOldRegion(s).replace(/\/$/, '')} ${routePath} 301`);
  }
}
```
Trade-off: ~+1.5k redirect lines. Default stance: **accept** and monitor.

### Decision #4 — x-default (strategic, not a bug)
`x-default → en (root)` (`prerenderBeachPages.mjs:257`). For a Greek-first
audience some sites point x-default at `/el`. Recommendation: **keep en**
(consistent with the English root UX). Reversible one-liner; if changed, test it
on its own, not bundled with a language rollout.

---

## Before adding languages — checklist

1. The gating pattern is correct: add the locale to `prerenderLocales` and the
   regions to `LOCALIZED_REGIONS`; `emittedLocales` + `alternateUrlsFor` keep
   hreflang emitted only where the page exists.
2. Ship **real translated** content before making a language indexable. The
   de/fr/it Milos pilot is template-composed and already borderline — do not mass
   -expand it without genuine translation (thin/duplicate-content risk).
3. Add the new `/xx` prefix to the trailing-slash coverage (Fix #1) when you move
   off "Netlify default".
4. Re-run `npm run seo:audit` and keep **0 failures / 0 hreflang orphans** — the
   audit checks reciprocity and orphan alternates.
5. Do NOT touch root=en / el=gr / self-canonical / x-default while adding
   languages — changing canonical strategy on live ranking URLs is the one
   high-risk move to avoid.

/**
 * The design system for the fully-static, no-JS pages (island-intent guide
 * articles, SEO landings, the guides hub).
 *
 * Why a stylesheet and not inline styles: these pages were built entirely from
 * `style="..."` attributes, which cannot express :hover, :focus-visible, media
 * queries or prefers-reduced-motion — so the articles had no interaction
 * feedback, no responsive behaviour beyond auto-fit grids, and no accessible
 * focus ring. One small inline <style> block fixes all of that AND is smaller
 * than repeating the same declarations on every element.
 *
 * Hard constraint: this ships inline in every static page, so it must stay
 * small and must never pull an external font or asset (the pages currently do
 * ZERO subresource requests apart from images — see stripClientScripts).
 * System font stack only.
 */

// Brand-consistent with the React app (teal 0E7490 / cyan wash) so a guide
// article reads as the same product, warmed with a sand tone so it stops
// looking like a clinical slate-50 document.
export const STATIC_ARTICLE_CSS = `
:root{
--cb-ink:#0B2027;--cb-ink-soft:#41565F;--cb-muted:#5C7480;
--cb-brand:#0E7490;--cb-brand-deep:#075985;--cb-wash:#ECFEFF;
--cb-line:#DCE9EE;--cb-sand:#FAF6EF;--cb-sand-line:#EADFCB;--cb-bg:#FBFAF8;
--cb-accent:#B45309;--cb-r:14px;--cb-maxw:1060px;
--cb-sans:ui-rounded,"SF Pro Rounded","Nunito","Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--cb-bg);color:var(--cb-ink);font-family:var(--cb-sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%;height:auto}
a{color:var(--cb-brand)}
a:focus-visible,button:focus-visible{outline:3px solid var(--cb-brand);outline-offset:3px;border-radius:6px}

.cb-wrap{max-width:var(--cb-maxw);margin:0 auto;padding:0 20px}
.cb-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0}
.cb-logo{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:var(--cb-brand-deep);font-weight:800;font-size:17px;letter-spacing:-.01em}
.cb-openapp{display:inline-flex;align-items:center;min-height:40px;border:1px solid var(--cb-line);border-radius:999px;padding:8px 15px;background:#fff;color:var(--cb-brand);text-decoration:none;font-weight:700;font-size:14px;transition:background-color .2s,border-color .2s}
.cb-openapp:hover{background:var(--cb-wash);border-color:var(--cb-brand)}

/* ---- Hero: the single biggest change. A real photograph, an honest gradient,
   and the headline sitting on it instead of a bare <h1> on grey. ---- */
/* The base gradient is what shows when a region has no photograph of its own
   and none of its beaches do either — a deliberate deep-sea panel, not a gap. */
.cb-hero{position:relative;border-radius:var(--cb-r);overflow:hidden;background:linear-gradient(150deg,#0E7490,#0B2027 70%);min-height:clamp(300px,44vw,430px);display:flex;align-items:flex-end;isolation:isolate}
.cb-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.cb-hero::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(6,26,34,.15) 0%,rgba(6,26,34,.55) 45%,rgba(6,26,34,.88) 100%)}
.cb-hero-body{position:relative;z-index:2;padding:clamp(20px,4vw,34px);width:100%;color:#fff}
.cb-crumb{margin:0 0 12px;font-size:13px;font-weight:700;color:rgba(255,255,255,.82)}
.cb-crumb a{color:rgba(255,255,255,.92);text-decoration:none;border-bottom:1px solid rgba(255,255,255,.35)}
.cb-crumb a:hover{border-bottom-color:#fff}
.cb-crumb span{color:rgba(255,255,255,.6)}
.cb-eyebrow{display:inline-block;margin:0 0 10px;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.cb-h1{margin:0;font-size:clamp(28px,5.4vw,48px);line-height:1.06;letter-spacing:-.025em;font-weight:800;text-wrap:balance}
.cb-hero-sub{margin:12px 0 0;font-size:clamp(15px,2.2vw,18px);line-height:1.55;color:rgba(255,255,255,.9);max-width:52ch}

/* Facts pulled from the geospatial model — the thing no competitor can copy,
   so it belongs above the fold, not buried in paragraph three. */
.cb-stats{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}
.cb-stat{display:flex;flex-direction:column;gap:1px;padding:8px 13px;border-radius:11px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.26);backdrop-filter:blur(4px)}
.cb-stat b{font-size:19px;font-weight:800;line-height:1.1}
.cb-stat span{font-size:11.5px;font-weight:600;letter-spacing:.03em;color:rgba(255,255,255,.82);text-transform:uppercase}
/* Attribution: collapsed so it never competes with the content, but always
   present and always naming author + licence (CC BY / CC BY-SA require it). */
.cb-credits{margin:12px 0 0;font-size:12px;color:var(--cb-muted)}
.cb-credits summary{cursor:pointer;font-weight:700;padding:4px 0}
.cb-credits ul{margin:6px 0 0;padding:0 0 0 16px;display:grid;gap:3px}
.cb-credits li{line-height:1.45}
.cb-credits a{color:var(--cb-muted)}

/* ---- Prose ---- */
.cb-prose{margin:clamp(22px,4vw,34px) 0 0;max-width:66ch}
.cb-prose p{margin:0 0 17px;font-size:17.5px;line-height:1.72;color:var(--cb-ink-soft)}
.cb-prose p:first-child{font-size:19.5px;line-height:1.62;color:var(--cb-ink)}
.cb-prose p:first-child::first-letter{float:left;font-size:3.05em;line-height:.86;font-weight:800;color:var(--cb-brand);padding:2px 10px 0 0}

.cb-h2{margin:0 0 10px;font-size:clamp(20px,2.9vw,26px);line-height:1.2;letter-spacing:-.015em;font-weight:800;color:var(--cb-brand-deep);text-wrap:balance}
.cb-rule{display:flex;align-items:center;gap:12px;margin:clamp(30px,5vw,44px) 0 16px}
.cb-rule h2{margin:0;font-size:clamp(19px,2.7vw,24px);line-height:1.2;font-weight:800;letter-spacing:-.015em;color:var(--cb-ink);white-space:nowrap}
.cb-rule::after{content:"";flex:1;height:1px;background:var(--cb-sand-line)}

/* ---- Beach cards ---- */
.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:14px;margin:0;padding:0;list-style:none}
.cb-card{position:relative;border:1px solid var(--cb-line);border-radius:var(--cb-r);background:#fff;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,border-color .2s}
.cb-card:hover{border-color:#9ED4E3;box-shadow:0 12px 28px -16px rgba(11,32,39,.45)}
.cb-card:focus-within{border-color:var(--cb-brand)}
.cb-fig{position:relative;margin:0;aspect-ratio:4/3;overflow:hidden;background:linear-gradient(140deg,#CFE9F1,#9FD3E2 55%,#E8DCC6)}
.cb-fig img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.cb-card:hover .cb-fig img{transform:scale(1.04)}
/* No photo yet: a calm tinted panel with a wave motif, never a broken frame. */
.cb-fig-none{display:flex;align-items:flex-end;background:linear-gradient(160deg,#BFE3EE,#8FC9DC 60%,#E4D6BC)}
.cb-fig-none svg{width:100%;height:52%;display:block;fill:rgba(255,255,255,.42)}
/* No photo but we DO know the coast: the beach's own shoreline, inlined. The
   drawing is 200x120 in a 4:3 frame, so it is cropped left/right (never top or
   bottom) — xMidYMid keeps the pin, which sits dead centre, always in view. */
.cb-fig-shore svg{display:block;width:100%;height:100%}
.cb-card-body{padding:12px 13px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.cb-card-name{font-size:16.5px;font-weight:800;letter-spacing:-.01em;color:var(--cb-brand-deep);text-decoration:none}
.cb-card a.cb-card-name::after{content:"";position:absolute;inset:0}
.cb-card:hover .cb-card-name{color:var(--cb-brand)}
.cb-tags{display:flex;flex-wrap:wrap;gap:5px;margin:0;padding:0;list-style:none}
.cb-tag{font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--cb-wash);color:var(--cb-brand-deep);border:1px solid #CDEAF2}
.cb-tag-warn{background:var(--cb-sand);color:var(--cb-accent);border-color:var(--cb-sand-line)}
.cb-blurb{margin:0;font-size:14px;line-height:1.55;color:var(--cb-ink-soft)}

/* ---- Editorial Q&A ---- */
.cb-qa{display:grid;gap:12px;margin:0}
.cb-qa-item{border:1px solid var(--cb-sand-line);border-radius:var(--cb-r);background:var(--cb-sand);padding:15px 17px}
.cb-qa-item h2{margin:0 0 7px;font-size:17px;line-height:1.3;font-weight:800;color:var(--cb-ink)}
.cb-qa-item p{margin:0;font-size:15.5px;line-height:1.62;color:var(--cb-ink-soft)}

/* ---- CTA ---- */
.cb-cta{display:flex;flex-wrap:wrap;align-items:center;gap:14px;justify-content:space-between;margin:clamp(28px,5vw,40px) 0 0;padding:20px 22px;border-radius:var(--cb-r);background:linear-gradient(135deg,var(--cb-brand-deep),var(--cb-brand));color:#fff}
.cb-cta p{margin:0;font-size:16.5px;line-height:1.5;font-weight:700;max-width:46ch}
.cb-cta a{display:inline-flex;align-items:center;min-height:46px;padding:12px 22px;border-radius:11px;background:#fff;color:var(--cb-brand-deep);text-decoration:none;font-weight:800;font-size:15.5px;transition:transform .2s,box-shadow .2s}
.cb-cta a:hover{box-shadow:0 10px 22px -10px rgba(0,0,0,.5)}
.cb-cta a:focus-visible{outline-color:#fff}

.cb-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.cb-chip{display:inline-block;min-height:38px;line-height:22px;border:1px solid var(--cb-line);border-radius:999px;padding:7px 14px;background:#fff;color:var(--cb-brand-deep);text-decoration:none;font-weight:700;font-size:14px;transition:background-color .2s,border-color .2s}
.cb-chip:hover{background:var(--cb-wash);border-color:var(--cb-brand)}
.cb-chip-lead{background:var(--cb-wash);border-color:var(--cb-brand);color:var(--cb-brand);font-weight:800}
.cb-note{margin:26px 0 0;padding:0 0 40px;color:var(--cb-muted);font-size:13px;line-height:1.55}

@media (max-width:640px){
  .cb-prose p:first-child::first-letter{font-size:2.6em}
  .cb-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px}
  .cb-stat b{font-size:17px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-duration:.01ms !important;animation-duration:.01ms !important}
  .cb-card:hover .cb-fig img{transform:none}
}
`.replace(/\n\s*/g, '\n').trim();

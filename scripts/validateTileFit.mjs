/**
 * THE ANSWER CARD MUST NOT CLIP A WORD — browser gate.
 *
 * The hero on a beach page packs four instruments and four practical facts into two rows of
 * four tiles. On a 320 px phone that leaves ~66 px per tile, and a single long word ("Χωμάτινος",
 * "Handhabbare", "Παπούτσια") does not wrap — it gets cut, and the reader is told half a fact.
 *
 * This measurement already existed: `components/BeachAnswerHero.tsx:143-148` describes it in
 * detail and the component still carries the `data-tilefit` attributes it was written against.
 * The probe itself was never committed, so from the day it was run the constraint has been
 * enforced by nothing at all — and on 05/08/2026, when the tile LABELS were raised off 9 px for
 * legibility, there was no way to answer "did that break the fit?" other than writing the probe
 * again. This is that probe, committed this time.
 *
 * It asserts the narrow thing only: no text node inside a tile is horizontally clipped, at
 * 320 / 360 / 390 / 430 px, in all five languages. It does NOT assert line counts — a label
 * wrapping onto two lines is fine and always was; a word being cut in half is not.
 *
 * EXTENDED 11/08/2026 to the fixed bottom bar, which became a tab bar the same day:
 * navigation plus up to three jump tabs now share one row, which is the same
 * four-things-on-a-320px-phone shape that clipped words in the hero. It rides this
 * script's server and browser rather than paying for its own. Two checks the tiles do
 * not need: the row must not overflow the viewport (controls can each fit and still
 * push the row wide), and every control must clear the 44 px touch minimum. Then, once,
 * the tabs are CLICKED — fitting and working are different failures, and the landing
 * depends on a `scroll-mt` that has to stay in step with the sticky header's height.
 *
 * Needs Chromium and a build-free vite dev server, like validateBeachPageContradictions.mjs.
 *
 * Run: node scripts/validateTileFit.mjs
 */
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PORT = 4191;
const BASE = `http://127.0.0.1:${PORT}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const waitForUrl = async (url, timeoutMs = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await wait(500);
  }
  throw new Error('dev server never came up: ' + url);
};

// The narrowest phone still in use, the two common sizes, and a large one. 320 is the case that
// matters: everything fits at 390, which is why this kept shipping broken.
const WIDTHS = [320, 360, 390, 430];

// Greek and English on the same beach (so the only variable is the language), plus the three
// localised languages on a beach that actually HAS them — Milos is in LOCALIZED_REGIONS, Corfu
// is not, and asking for /de/beaches/corfu/… silently returns a page with no hero to measure.
// That mistake cost a whole clean run: 15 labels in Greek, 0 in German, and the report said PASS.
const PAGES = [
  ['gr', '/el/beaches/corfu/965-kanali-tou-erota/'],
  ['en', '/beaches/corfu/965-kanali-tou-erota/'],
  ['de', '/de/beaches/milos/1900-agios-sostis/'],
  ['fr', '/fr/beaches/milos/1900-agios-sostis/'],
  ['it', '/it/beaches/milos/1900-agios-sostis/'],
];

const vite = path.join('node_modules', 'vite', 'bin', 'vite.js');

// PRE-BUILD THE DEPENDENCIES BEFORE ANYTHING IS MEASURED — added 13/08/2026.
//
// A vite dev server bundles the app's dependencies the first time a page asks for them, and
// when it discovers one it had not planned for it re-does the job and tells every open page to
// reload — cancelling whatever was in flight. On a laptop the cache from the last run is
// already on disk and this never happens. On a CI runner, which starts from `npm ci` with no
// cache at all, it happens somewhere in the first minute, and the page that was mid-load comes
// back with nothing on it — which this gate then reported as «no tiles: nothing was measured».
// That is a false red: nothing is wrong with the layout, the server moved under it.
//
// Doing the work up front, before the browser exists, removes the event entirely rather than
// waiting it out.
spawnSync(process.execPath, [vite, 'optimize', '--force'], { stdio: 'ignore', env: process.env });

/**
 * Η ΠΙΑΣΜΕΝΗ ΘΥΡΑ ΝΑ ΛΕΓΕΤΑΙ ΠΙΑΣΜΕΝΗ ΘΥΡΑ — Μίλτος, 14/08/2026.
 *
 * Με `--strictPort` (σωστά: αλλιώς μετράμε ζόμπι server με χθεσινό κώδικα) μια δεύτερη
 * ταυτόχρονη εκτέλεση σκότωνε την πύλη με «Port 4191 is already in use» μέσα σε stack trace
 * της vite — που στον runner διαβάζεται σαν αποτυχία της σελίδας, ενώ η σελίδα δεν έχει καν
 * φορτώσει. Ο έλεγχος γίνεται πλέον ΠΡΙΝ ξοδευτεί ένα δευτερόλεπτο σε browser, και λέει τι να
 * κάνει ο άνθρωπος. ΔΕΝ αλλάζουμε θύρα και ΔΕΝ πέφτουμε σε άλλη: το να μετρήσουμε ό,τι τυχαία
 * ακούει εκεί είναι το χειρότερο δυνατό αποτέλεσμα.
 */
const portBusy = await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) })
  .then(() => true)
  .catch(() => false);
if (portBusy) {
  console.error(`\nΗ θύρα ${PORT} είναι ήδη πιασμένη — τρέχει άλλη εκτέλεση αυτής της πύλης ή έμεινε ζόμπι dev server.`);
  console.error('Κλείσε τον και ξανατρέξε· δεν μετράμε ό,τι ακούει ήδη εκεί, γιατί μπορεί να είναι παλιός κώδικας.');
  process.exit(1);
}

const server = spawn(
  process.execPath,
  // --strictPort: without it a leftover dev server on this port silently becomes what we measure —
  // stale code reported as today's. See validateBeachPageContradictions.mjs.
  [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'ignore', 'inherit'], env: process.env },
);

const failures = [];
const fontsSeen = new Set();
let measured = 0;
try {
  await waitForUrl(BASE + '/');
  const browser = await chromium.launch();

  /**
   * ΠΡΟΘΕΡΜΑΝΣΗ ΚΑΘΕ ΔΙΑΔΡΟΜΗΣ ΠΡΙΝ ΜΕΤΡΗΘΕΙ ΟΤΙΔΗΠΟΤΕ — 16/08/2026.
   *
   * Η ΤΡΙΤΗ απόπειρα να σταματήσει το ίδιο «false red», και η πρώτη που δεν προσπαθεί να το
   * ΠΕΡΙΜΕΝΕΙ. Στις 11/08 μπήκε ένα reload, στις 13/08 δεύτερο, και στις 16/08 η πύλη έπεφτε
   * ακόμη — τρεις εκτελέσεις, τρία ΔΙΑΦΟΡΕΤΙΚΑ θύματα (en @320 Κέρκυρα · fr @390 Μήλος · μία
   * καθαρή). Πάντα «no [data-tilefit] tiles — nothing was measured», ποτέ κομμένη λέξη.
   *
   * Το `vite optimize --force` παραπάνω προ-δεσμεύει τις ΕΞΑΡΤΗΣΕΙΣ, αλλά ο dev server
   * μεταγλωττίζει κάθε ΔΙΑΔΡΟΜΗ την πρώτη φορά που τη ζητάει κάποιος, και μπορεί να ανακαλύψει
   * εκεί εξάρτηση που δεν είχε προβλέψει — οπότε ξαναδεσμεύει και στέλνει full-reload σε ό,τι
   * είναι στον αέρα. Με 5 διαδρομές × 4 πλάτη, η πρώτη επίσκεψη κάθε διαδρομής ήταν πάντα μέσα
   * στη μέτρηση· γι' αυτό το θύμα άλλαζε κάθε φορά.
   *
   * Εδώ κάθε διαδρομή ζητιέται μία φορά ΠΡΙΝ αρχίσει η μέτρηση, σε δικό της παράθυρο που
   * πετιέται. Ό,τι είναι να ξανα-δεσμευτεί, ξανα-δεσμεύεται τώρα. Δεν χαμηλώνει κανένα κατώφλι
   * και δεν αγγίζει ούτε μία μέτρηση — απλώς η μέτρηση δεν είναι πια η πρώτη επίσκεψη.
   */
  {
    const warm = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Athens' });
    const page = await warm.newPage();
    for (const [, route] of PAGES) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
      await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).catch(() => {});
    }
    await warm.close();
    console.log(`  προθερμάνθηκαν ${PAGES.length} διαδρομές πριν τη μέτρηση`);
  }

  for (const [lang, route] of PAGES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        timezoneId: 'Europe/Athens',
      });
      const page = await ctx.newPage();
      // An empty card has two possible authors — a broken page or a server that moved under
      // it — and until 13/08/2026 the gate could not tell them apart: it said «nothing was
      // measured» and left whoever read it to guess. Now the page's own complaints are kept,
      // so the failure names its cause.
      const pageSaid = new Set();
      page.on('pageerror', error => pageSaid.add(`page error: ${error.message.split('\n')[0]}`));
      page.on('requestfailed', request => pageSaid.add(`request failed: ${request.url().replace(BASE, '')} (${request.failure()?.errorText})`));
      page.on('response', response => {
        if (response.status() >= 400 && response.url().startsWith(BASE)) {
          pageSaid.add(`${response.status()} on ${response.url().replace(BASE, '')}`);
        }
      });
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      // Wait for the tiles themselves, not for a stopwatch. A cold vite server compiles the
      // first route on demand and the first two viewports came back empty on a fixed 4 s wait —
      // which this gate would then have reported as a layout failure. Measure or say why not.
      //
      // The `.catch(() => {})` used to end it there, and on 11/08/2026 that produced a red gate
      // on a run where nothing was wrong: one viewport out of twenty (en @320) came back with
      // zero tiles while the other nineteen measured clean. A gate that cries wolf once every
      // few runs gets ignored on the run that matters, so a missed render now costs a reload and
      // a second look before it is allowed to be a failure — never a lowered bar, just a
      // refusal to report a timing miss as a layout defect.
      // One reload was not enough: on 13/08/2026 the CI run came back with gr @390px empty
      // after its retry, on a run where all nineteen other viewports measured clean and no
      // word was clipped anywhere. Two reloads, because the thing being outlasted is a server
      // event that happens once — not a layout that would fail identically every time.
      let appeared = await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).then(() => true, () => false);
      for (let retry = 1; retry <= 2 && !appeared; retry += 1) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
        appeared = await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).then(() => true, () => false);
        console.log(`  (retry ${retry} after empty first paint: ${lang} @${width}px → ${appeared ? 'rendered' : 'still empty'})`);
      }
      await wait(1200);

      const found = await page.evaluate(() => {
        // WHICH FONT THIS WAS MEASURED IN — added 13/08/2026.
        //
        // Clipping is a question about metrics, and metrics belong to whatever font the
        // machine actually owns. index.css asks for ui-rounded / SF Pro Rounded / Nunito /
        // Inter / system-ui, and a Linux CI runner owns none of them: it answers with its own
        // default, whose Greek is wider than any phone's. So a verdict here is only readable
        // next to the name of the font that produced it — otherwise "clipped by 3px" cannot
        // be told apart from "measured in a font no visitor will ever see".
        const fontInUse = (() => {
          const ctx2d = document.createElement('canvas').getContext('2d');
          const sample = 'Πληροφορίες Handhabbare';
          const widthOf = family => { ctx2d.font = `20px ${family}`; return ctx2d.measureText(sample).width; };

          // What the page is really drawing with: the whole stack, resolved by the browser.
          const actual = widthOf(getComputedStyle(document.body).fontFamily);
          // Named against the fonts a real device answers with, plus the three a bare Linux
          // box falls back to. Matching by width identifies the winner without asking the
          // browser a question it has no API for.
          const candidates = ['SF Pro Rounded', 'Nunito', 'Inter', 'Roboto', 'Segoe UI', 'Noto Sans', 'DejaVu Sans', 'Liberation Sans', 'FreeSans'];
          for (const family of candidates) {
            if (Math.abs(widthOf(`"${family}", "NoSuchFamily-CalmBeach"`) - actual) < 0.5) return family;
          }
          return `unrecognised (the sample measures ${Math.round(actual)}px here; none of the fonts a phone uses match)`;
        })();

        const tiles = Array.from(document.querySelectorAll('[data-tilefit]'));
        const nodes = [];
        for (const tile of tiles) {
          for (const n of tile.querySelectorAll('p, span')) {
            if (n.children.length || !(n.textContent || '').trim()) continue;
            nodes.push({
              text: n.textContent.trim(),
              overflowPx: Math.round(n.scrollWidth - n.clientWidth),
              fontSize: getComputedStyle(n).fontSize,
            });
          }
        }

        // The fixed bottom bar, added 11/08/2026: navigation plus up to three jump tabs
        // sharing one row. Same clipping question as the tiles, so it rides the same
        // browser rather than paying for a second one. Two things are checked that the
        // tiles do not need: the ROW itself must not overflow the viewport (four
        // controls can fit individually and still push the row wide), and every control
        // must clear the 44 px touch minimum the 05/08 decision put on this page.
        const bar = document.querySelector('[data-tabfit]');
        const barNodes = [];
        const barTouching = [];
        let barOverflowPx = 0;
        if (bar) {
          barOverflowPx = Math.round(bar.scrollWidth - bar.clientWidth);
          const labelBoxes = [];
          for (const control of bar.querySelectorAll('button')) {
            const box = control.getBoundingClientRect();
            for (const n of control.querySelectorAll('span')) {
              if (n.children.length || !(n.textContent || '').trim()) continue;
              const r = n.getBoundingClientRect();
              barNodes.push({
                text: n.textContent.trim(),
                overflowPx: Math.round(n.scrollWidth - n.clientWidth),
                fontSize: getComputedStyle(n).fontSize,
                heightPx: Math.round(box.height),
              });
              labelBoxes.push({ text: n.textContent.trim(), left: r.left, right: r.right });
            }
          }
          // Neighbours must not touch. Overflow and clipping both said "fine" while
          // «Πληροφορίες» and «Εναλλακτικές» sat flush against each other at 320 px and
          // read as one 24-letter word — each label fitted its own box perfectly, and the
          // row fitted the screen; what was missing was the space BETWEEN them. Measuring
          // one box at a time can never see that.
          labelBoxes.sort((a, b) => a.left - b.left);
          for (let i = 1; i < labelBoxes.length; i += 1) {
            const gap = Math.round(labelBoxes[i].left - labelBoxes[i - 1].right);
            if (gap < 4) barTouching.push({ a: labelBoxes[i - 1].text, b: labelBoxes[i].text, gap });
          }
        }
        return { tiles: tiles.length, nodes, bar: Boolean(bar), barOverflowPx, barNodes, barTouching, fontInUse };
      });

      await ctx.close();

      // A page that rendered no tiles proves nothing, and silence is how the German run passed
      // while measuring an empty page. Treat it as a failure of the gate, not of the layout.
      if (found.tiles === 0) {
        const why = pageSaid.size
          ? ` · the page said: ${[...pageSaid].slice(0, 3).join(' | ')}`
          : ' · the page reported no error of its own, so look at the dev server, not the card';
        failures.push(`${lang} @${width}px: no [data-tilefit] tiles on ${route} — nothing was measured${why}`);
        continue;
      }
      measured += found.nodes.length;
      for (const n of found.nodes) {
        if (n.overflowPx > 1) {
          failures.push(`${lang} @${width}px: «${n.text}» is clipped by ${n.overflowPx}px at ${n.fontSize}`);
        }
      }

      // Same treatment as `tiles === 0`: a bar that never rendered proves nothing, and a
      // silent skip is exactly how the German run once passed on an empty page.
      if (!found.bar) {
        failures.push(`${lang} @${width}px: no [data-tabfit] bottom bar on ${route} — nothing was measured`);
      } else {
        measured += found.barNodes.length;
        if (found.barOverflowPx > 1) {
          failures.push(`${lang} @${width}px: the bottom bar row overflows by ${found.barOverflowPx}px`);
        }
        for (const t of found.barTouching) {
          failures.push(`${lang} @${width}px: bottom-bar «${t.a}» and «${t.b}» are ${t.gap}px apart — they read as one word`);
        }
        for (const n of found.barNodes) {
          if (n.overflowPx > 1) {
            failures.push(`${lang} @${width}px: bottom-bar «${n.text}» is clipped by ${n.overflowPx}px at ${n.fontSize}`);
          }
          if (n.heightPx < 44) {
            failures.push(`${lang} @${width}px: bottom-bar «${n.text}» sits in a ${n.heightPx}px control, under the 44px minimum`);
          }
        }
      }

      fontsSeen.add(found.fontInUse);
      console.log(`${lang} @${width}px  tiles=${found.tiles}  texts=${found.nodes.length}  clipped=${found.nodes.filter(n => n.overflowPx > 1).length}  bar=${found.barNodes.length} labels, overflow=${found.barOverflowPx}px  font=${found.fontInUse}`);
    }
  }

  // ---- The tabs must LAND, not just fit ----
  //
  // Fitting in the bar and working are different failures. The one that will actually
  // happen: the header is `sticky top-0` and was measured at 77 px, so each target
  // carries `scroll-mt-24` (96 px) to clear it. Change the header's padding, its font
  // or its icon size and every tab silently starts dropping its heading UNDERNEATH the
  // header — the visitor jumps and lands on a paragraph that begins mid-sentence, with
  // nothing on screen saying where they are. Nothing else in the suite would notice.
  //
  // Clicked for real, at one width in Greek: this asks a question about geometry and
  // wiring, not about translation, so repeating it 20 times would buy nothing.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Athens',
    });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGES[0][1], { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-tabfit]', { timeout: 60000 }).catch(() => {});
    await wait(2000);

    const headerH = await page.evaluate(() => {
      const h = document.querySelector('header');
      return h ? Math.round(h.getBoundingClientRect().height) : 0;
    });

    let landed = 0;
    for (const [label, id] of [['Κύμα', 'today-conditions'], ['Πληροφορίες', 'beach-story'], ['Εναλλακτικές', 'nearby-beaches']]) {
      if (!(await page.$('#' + id))) continue;
      // Send it back to the top first, so a pass can never be an accident of where the
      // previous jump happened to leave us.
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(400);
      await page.getByRole('button', { name: label, exact: true }).click();
      await wait(1400);

      /**
       * ΤΟ ΤΜΗΜΑ ΜΠΟΡΕΙ ΝΑ ΜΗΝ ΕΙΝΑΙ ΕΚΕΙ ΟΤΑΝ ΠΡΟΣΓΕΙΩΝΟΜΑΣΤΕ — Μίλτος, 14/08/2026.
       *
       * Αυτό ήταν `el.getBoundingClientRect()` χωρίς έλεγχο, και έριχνε ΟΛΟΚΛΗΡΗ την πύλη με
       * «Cannot read properties of null». Μετρήθηκε την ίδια μέρα: ίδιος κώδικας, run 1 PASS /
       * run 2 FAIL — το τμήμα υπάρχει στη γραμμή 295 όταν το ελέγχουμε, και λείπει 1.400 ms
       * αργότερα, γιατί το κλικ προκαλεί re-render και το React το ξαναστήνει.
       *
       * Το κακό δεν ήταν η αστάθεια αλλά το ΣΧΗΜΑ της: ένα crash βγαίνει από τη διαδικασία με
       * exit 1 και stack trace, δηλαδή **δυσδιάκριτο από πραγματικό εύρημα** — και μια πύλη που
       * κοκκινίζει τυχαία σταματά να διαβάζεται, ακριβώς όταν έχει να πει κάτι αληθινό.
       *
       * Οπότε: περιμένουμε να ξαναϋπάρξει (το re-render είναι νόμιμο, δεν είναι σφάλμα), και αν
       * όντως δεν εμφανιστεί το γράφουμε ως ΕΥΡΗΜΑ με λόγια — «το κουμπί οδηγεί σε τμήμα που δεν
       * υπάρχει» είναι πραγματικό bug για τον επισκέπτη, όχι θόρυβος. Καμία χαλάρωση: το
       * κατώφλι κάτω από τη σταθερή κεφαλίδα μένει ακριβώς ίδιο.
       */
      const settled = await page.waitForFunction(
        sel => Boolean(document.querySelector(sel)),
        '#' + id,
        { timeout: 5000 },
      ).then(() => true).catch(() => false);

      if (!settled) {
        failures.push(`tab «${label}» was clicked but #${id} was gone 5 s later — the jump control points at a section that is not on the page`);
        continue;
      }

      const r = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), focused: document.activeElement === el };
      }, '#' + id);

      landed += 1;
      if (r.top < headerH) {
        failures.push(`tab «${label}» landed #${id} at ${r.top}px, UNDER the ${headerH}px sticky header`);
      } else if (r.top > headerH + 40) {
        failures.push(`tab «${label}» landed #${id} at ${r.top}px, ${r.top - headerH}px below a ${headerH}px header — overshot`);
      }
      // A jump control that only scrolls leaves keyboard focus at the top of the page,
      // so the visitor's next Tab throws them back where they started.
      if (!r.focused) {
        failures.push(`tab «${label}» scrolled to #${id} but focus stayed behind — the next Tab returns to the top`);
      }
      console.log(`tab «${label}» -> #${id}  top=${r.top}px (header ${headerH}px)  focused=${r.focused}`);
    }
    if (landed === 0) {
      failures.push('no jump tab could be clicked on ' + PAGES[0][1] + ' — the landing check measured nothing');
    }
    await ctx.close();
  }

  // ---- The podium card's «why» row (added 13/08/2026) ----
  //
  // The row is two columns on a phone, and on 13/08 the open-water figure stopped being a bare
  // «1,5 μ.» and started carrying its word — «1,5 μ. ανοιχτά» — because without it the number
  // read as the water at the sand (Μαραθώνας 1,5 μ. beside Σχινιάς 0,1 μ., 4 km apart). That is
  // eight more characters in a fixed-width chip, in five languages, and a word cut in half is
  // worse than no word: «1,5 μ. ανοιχ…» claims nothing and costs the space the number needed.
  //
  // ⚠️ 13/08, ΒΡΑΔΥ — Η ΕΝΕΣΗ ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗ ΛΕΞΗ. Λίγες ώρες αργότερα η κάρτα έπαψε να δείχνει
  // τη θάλασσα του ανοιχτού: τυπώνει πλέον ΠΑΝΤΑ το νερό της ακτής, σκέτο, χωρίς ετικέτα («στο
  // mobile έχει πολύ κείμενο» — Μίλτος· και αυτό εδώ το αρχείο έκοβε τη λέξη στα 390 px). Με ένα
  // μόνο σχήμα στην οθόνη δεν υπάρχει «λάθος περίπτωση» να αποφύγεις με ένεση: το φυσικό
  // περιεχόμενο του chip ΕΙΝΑΙ η χειρότερη περίπτωση. Μετριέται όπως ζωγραφίζεται.
  //
  // Η ένεση δεν διαγράφεται από το ιστορικό επίτηδες: αν ξαναμπεί ποτέ λέξη δίπλα στον αριθμό,
  // αυτό το μπλοκ πρέπει να ξαναγίνει injection — αλλιώς θα μετράει 20 φορές τη σύντομη μορφή.
  //
  // ✅ 22/08/2026 — Η ΕΝΕΣΗ ΞΑΝΑΜΠΗΚΕ, ΑΚΡΙΒΩΣ ΟΠΩΣ ΤΟ ΖΗΤΟΥΣΕ Η ΠΑΡΑΠΑΝΩ ΠΑΡΑΓΡΑΦΟΣ. Τα νούμερα
  // έφυγαν από την κάρτα και στη θέση τους έμεινε Η ΛΕΞΗ. Οι λέξεις ΔΕΝ έχουν σταθερό πλάτος
  // όπως τα νούμερα: το ζωντανό fixture (Πάρος, βοριάς 5 Μπφ) ζωγραφίζει «Πολύς αέρας» και μία
  // μόνο λέξη κύματος, ενώ η χειρότερη περίπτωση του λεξιλογίου είναι η γαλλική «presque pas de
  // vagues» — 21 χαρακτήρες, σχεδόν διπλάσιοι. Χωρίς ένεση αυτή η πύλη θα μετρούσε 40 φορές τη
  // σύντομη μορφή και θα έλεγε «πράσινο» για λέξη που κόβεται.
  //
  // Οι λέξεις είναι αντίγραφο του `utils/conditionsFeelPhrase.ts` (FEEL_VOCABULARY). Δεν
  // εισάγονται: αυτό το αρχείο τρέχει σε Playwright χωρίς transpiler για .ts. Το ξεσυγχρόνισμα
  // το πιάνει το `validateConditionsFeelPhrase.ts`, που κόβει κάθε λέξη πάνω από 21 χαρακτήρες
  // ακριβώς επειδή δεν θα τη μετρούσε κανείς εδώ.
  const WORST_CASE_WORDS = {
    gr: 'σχεδόν χωρίς κύμα',
    en: 'noticeable waves',
    fr: 'presque pas de vagues',
    de: 'spürbare Wellen',
    it: 'quasi senza onde',
  };
  {
    const PODIUM_ROUTES = [['gr', '/el/'], ['en', '/'], ['de', '/de/'], ['fr', '/fr/'], ['it', '/it/']];
    let podiumMeasured = 0;
    for (const [lang, route] of PODIUM_ROUTES) {
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Athens',
        });
        const page = await ctx.newPage();
        // The fixture is what makes the podium exist at all: without a committed region the
        // homepage shows the national landing, which has no cards to measure.
        await page.goto(`${BASE}${route}?bbWeatherFixture=Paros_N_5BFT`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        const there = await page.waitForSelector('[data-tilefit="podium-why-wave"]', { timeout: 60000 })
          .then(() => true, () => false);
        if (!there) {
          failures.push(`${lang} @${width}px: no podium wave chip on ${route} — the row was not measured`);
          await ctx.close();
          continue;
        }
        await wait(1200);
        // ΚΑΙ ΤΑ ΔΥΟ ΚΕΛΙΑ: από τις 22/08 και ο άνεμος κρατά λέξη («Δυνατός αέρας»), όχι «6 Μπφ».
        // Μέχρι τότε το κελί του ανέμου δεν μετρήθηκε ποτέ — δεν είχε τι να κοπεί.
        for (const cell of ['wind', 'wave']) {
          const probe = await page.evaluate(([key, injected]) => {
            const chip = document.querySelector(`[data-tilefit="podium-why-${key}"]`);
            if (!chip) return null;
            const spans = chip.querySelectorAll('span');
            const textSpan = spans[spans.length - 1];
            const natural = (textSpan.textContent || '').trim();
            const read = () => ({
              chipScroll: chip.scrollWidth, chipClient: chip.clientWidth,
              textScroll: textSpan.scrollWidth, textClient: textSpan.clientWidth,
              rowScroll: chip.parentElement.scrollWidth, rowClient: chip.parentElement.clientWidth,
              height: textSpan.getBoundingClientRect().height,
            });
            const live = read();
            // Η ΕΝΕΣΗ: η μακρύτερη λέξη που μπορεί να παραχθεί στη γλώσσα, στο ΙΔΙΟ κελί.
            textSpan.textContent = injected;
            const worst = read();
            textSpan.textContent = natural;
            return { natural, injected, live, worst };
          }, [cell, WORST_CASE_WORDS[lang]]);

          if (!probe) {
            failures.push(`${lang} @${width}px: no podium ${cell} chip — nothing was measured`);
            continue;
          }
          // Το chip πρέπει να έχει ΚΑΤΙ μέσα: ένα άδειο span δεν ξεχειλίζει ποτέ και θα περνούσε.
          if (!probe.natural) {
            failures.push(`${lang} @${width}px: the podium ${cell} chip is empty — nothing was measured`);
          }
          // Η ΛΕΞΗ, ΟΧΙ ΝΟΥΜΕΡΟ: αν το κελί ξαναρχίσει να τυπώνει «6 Μπφ» ή «~0,1 μ.», η απόφαση
          // της 22/08 έχει γυρίσει πίσω σιωπηλά και καμία άλλη πύλη δεν θα το έπιανε.
          if (/[0-9]/.test(probe.natural)) {
            failures.push(`${lang} @${width}px: the podium ${cell} chip prints a figure again — «${probe.natural}»`);
          }
          podiumMeasured += 1;
          measured += 1;
          for (const [what, m] of [['live', probe.live], ['worst-case', probe.worst]]) {
            const text = what === 'live' ? probe.natural : probe.injected;
            if (m.textScroll > m.textClient + 1
              || m.chipScroll > m.chipClient + 1
              || m.rowScroll > m.rowClient + 1) {
              failures.push(
                `${lang} @${width}px: the podium ${cell} chip cannot hold the ${what} «${text}» `
                + `(text ${m.textScroll}/${m.textClient}px · chip ${m.chipScroll}/${m.chipClient}px `
                + `· row ${m.rowScroll}/${m.rowClient}px). The word would be cut.`
              );
            }
            // Το `line-clamp-2` κόβει ΣΙΩΠΗΛΑ στην τρίτη σειρά: δεν ξεχειλίζει, άρα ο έλεγχος
            // πλάτους από πάνω δεν θα το έπιανε ποτέ. Κείμενο 11 px σε δύο σειρές ≈ 26 px.
            if (m.height > 30) {
              failures.push(
                `${lang} @${width}px: the podium ${cell} chip needs ${Math.round(m.height)}px for the `
                + `${what} «${text}» — that is a third line, and line-clamp-2 eats it silently.`
              );
            }
          }
        }
        await ctx.close();
      }
    }
    if (podiumMeasured === 0) {
      failures.push('the podium «why» row was never measured — a pass here would mean nothing');
    } else {
      console.log(`podium wave chip: ${podiumMeasured} measurements of the string the card actually paints`);
    }
  }

  await browser.close();
} finally {
  /**
   * ΣΤΑ WINDOWS ΤΟ `.kill()` ΑΦΗΝΕΙ ΤΑ ΠΑΙΔΙΑ ΖΩΝΤΑΝΑ — και ένας vite που επιβιώνει είναι ο
   * λόγος που η ΕΠΟΜΕΝΗ εκτέλεση βρίσκει τη θύρα πιασμένη. Το `taskkill /T` κατεβάζει όλο το
   * δέντρο· αν αποτύχει (άλλο λειτουργικό, ήδη νεκρή διεργασία) πέφτουμε πίσω στο `.kill()`.
   */
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  }
  server.kill();
}

console.log(`\nMeasured ${measured} tile and bar text nodes · ${PAGES.length} languages × ${WIDTHS.length} widths, plus the tab landings and the podium row`);
if (failures.length > 0) {
  // On stderr on purpose: the gate runner shows the failing check's stderr, and a list of
  // clipped words without the font that clipped them cannot be acted on.
  console.error(`\nMeasured in: ${[...fontsSeen].join(' · ') || 'unknown'}`);
  console.error(`FAILED: ${failures.length} problem(s).\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS — no tile or tab clips a word at any tested width in any language, and every tab lands its section clear of the header.');

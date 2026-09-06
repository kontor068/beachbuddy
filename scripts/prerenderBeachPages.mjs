import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { sitemapContentFingerprint } from '../utils/sitemapFingerprint.mjs';
import { sizedPhotoUrl } from '../utils/photoSizing.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { amenityTextIncludesAny, SNACK_CANTEEN_AMENITY_TERMS } from '../utils/amenityMatching.js';
import { localWindLabelFor, getRegionWindContext, localWindSectorsFor, localWindSectionFor, LOCAL_WIND_ATOMS, LOCAL_WIND_LABEL } from '../utils/localWindContext.mjs';
import { withSeaSeasonSection } from '../utils/seaSeasonProfile.mjs';
import { withWaterSeasonSection } from '../utils/waterSeasonProfile.mjs';
import { STATIC_ARTICLE_CSS } from './staticArticleTheme.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');
const indexHtmlPath = path.join(distDir, 'index.html');
const beachIndexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');
const defaultOgImagePath = '/milos-sarakiniko-bg.jpg';
const homeOgImagePath = '/og-image.png';
const defaultRobotsContent = 'index, follow, max-image-preview:large';

const regionOgImageOverrides = new Map([
  ['attica-athens-area-mainland', '/attica-athens-coast-bg.jpg'],
  ['attica-east-attica-mainland', '/attica-east-bg.jpg'],
  ['attica-kythira', '/attica-kythira-bg.jpg'],
  ['attica-piraeus-area', '/attica-piraeus-coast-bg.jpg'],
  ['attica-west-attica-mainland', '/attica-west-bg.jpg'],
  ['central-greece-evia', '/euboea-evia-bg.jpg'],
  ['crete-gavdos', '/crete-chania-bg.jpg'],
  ['south-aegean-milos', defaultOgImagePath],
  ['south-aegean-polyaigos', defaultOgImagePath],
]);

const ogImageGroupPrefixes = new Map([
  ['argosaronic', 'saronic'],
  ['attica', 'attica'],
  ['crete', 'crete'],
  ['cyclades', 'cyclades'],
  ['dodecanese', 'dodecanese'],
  ['euboea', 'euboea'],
  ['ionian', 'ionian'],
  ['sporades', 'sporades'],
]);

const prerenderLocales = [
  {
    id: 'en',
    language: 'en',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    pathPrefix: '',
    homeTitle: 'Which Greek Beach Is Calm Today? Wind & Waves | CalmBeach',
    homeDescription: "See which Greek beaches have calm water today: live wind, waves, and the shelter each coastline's own shape gives.",
    homeImageAlt: 'CalmBeach Greece beach recommendations by wind and waves',
  },
  {
    id: 'el',
    language: 'gr',
    htmlLang: 'el',
    hreflang: 'el',
    ogLocale: 'el_GR',
    pathPrefix: '/el',
    homeTitle: 'Πού έχει ήρεμη θάλασσα σήμερα στην Ελλάδα | CalmBeach',
    homeDescription: 'Δες ποιες ελληνικές παραλίες έχουν ήρεμη θάλασσα σήμερα: ζωντανός άνεμος, κύμα και η προστασία που δίνει το σχήμα της κάθε ακτής.',
    homeImageAlt: 'Calm Beach Greece προτάσεις παραλιών',
  },
  {
    id: 'de',
    language: 'de',
    htmlLang: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    pathPrefix: '/de',
    homeTitle: 'Wo ist das Meer heute ruhig? Griechenland | CalmBeach',
    homeDescription: 'Sieh, welche griechischen Strände heute ruhiges Wasser haben: Wind und Wellen live, plus der Schutz durch die Form der Küste.',
    homeImageAlt: 'CalmBeach Griechenland – Strandempfehlungen nach Wind und Wellen',
  },
  {
    id: 'fr',
    language: 'fr',
    htmlLang: 'fr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    pathPrefix: '/fr',
    homeTitle: 'Quelle plage grecque est calme aujourd’hui ? | CalmBeach',
    homeDescription: 'Voyez quelles plages grecques ont une mer calme aujourd’hui : vent et vagues en direct, et l’abri qu’offre la forme de la côte.',
    homeImageAlt: 'CalmBeach Grèce – recommandations de plages selon le vent et les vagues',
  },
  {
    id: 'it',
    language: 'it',
    htmlLang: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    pathPrefix: '/it',
    homeTitle: 'Quale spiaggia greca è calma oggi? | CalmBeach',
    homeDescription: 'Scopri quali spiagge greche hanno mare calmo oggi: vento e onde in tempo reale e il riparo dato dalla forma della costa.',
    homeImageAlt: 'CalmBeach Grecia – consigli sulle spiagge in base a vento e onde',
  },
];

// --- Multilingual pilot gating -------------------------------------------------
// SEO penalty risk: emitting de/fr/it hreflang on a page that has no de/fr/it
// file points search engines at 404s. So extra locales are emitted ONLY for
// regions in LOCALIZED_REGIONS, and every page's hreflang lists ONLY the locales
// that page was actually generated in (see localesForRegion + alternateUrlsFor).
// en + el stay national and byte-identical; rollout = add region ids here.
const BASE_LOCALE_IDS = new Set(['en', 'el']);
const baseLocales = prerenderLocales.filter(locale => BASE_LOCALE_IDS.has(locale.id));
// hreflang x-default = English (reverted to English on 06/08/2026; see below).
//
// x-default is ONLY consulted for a visitor whose language matches none of our hreflang
// entries — not English, Greek, German, French or Italian. By definition that is a foreign
// tourist (Spanish, Dutch, Polish, Nordic…), and Google's own definition of the value is
// "the URL where you want your users to land if your site doesn't support their language"
// (developers.google.com/search/docs/specialty/international/localized-versions, read
// 06/08/2026). For that person English is the useful landing page and Greek is a dead end.
// A Greek speaker is unaffected either way: they match hreflang="el" directly.
//
// Why it was Greek in between: commit 341f95f6 (17/07/2026) switched it to el to kill a GSC
// "wrong_audience" signal — English pages appearing to Greek searchers. That signal was then
// investigated on 19/07 and found to be a false alarm: it was a country-only heuristic
// counting legitimate brand and Latin-script beach-name queries as "wrong", and the verdict
// was explicitly "no serving fix warranted". The fix had already shipped two days earlier and
// nobody reverted it. This is that revert, with the reason recorded so it does not flip again.
const xDefaultLocale = prerenderLocales.find(locale => locale.id === 'en') ?? prerenderLocales[0];
// Multilingual rollout by foreign demand. MUST stay 1:1 in sync with
// LOCALIZED_REGION_SLUGS in utils/beachUrls.ts (full region id here, bare URL
// slug there) — a drift makes the client emit /de|fr|it links to pages that were
// never prerendered (404 on reload).
const LOCALIZED_REGIONS = new Set([
  'south-aegean-milos',   // pilot
  // Wave 1 — Cyclades core
  'south-aegean-naxos',
  'south-aegean-paros',
  'south-aegean-mykonos',
  'south-aegean-santorini',
  'south-aegean-ios',
  'south-aegean-sifnos',
  // Wave 2 — top foreign-tourist destinations (Crete + Dodecanese majors + Ionian)
  // Rolled out 2026-07-15 after Wave 1 held healthy for 4 days (de/fr/it impressions
  // rising, de→Germany targeting 0.65, zero errors). Slugs mirror LOCALIZED_REGION_SLUGS.
  'crete-crete-chania',
  'crete-crete-heraklion',
  'crete-crete-rethymno',
  'crete-crete-lasithi',
  'south-aegean-rhodes',
  'south-aegean-kos',
  'ionian-islands-corfu',
  'ionian-islands-zakynthos',
  'ionian-islands-kefalonia',
  'ionian-islands-lefkada',
]);
const localesForRegion = regionId =>
  LOCALIZED_REGIONS.has(regionId) ? prerenderLocales : baseLocales;

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));

// Curated per-beach editorial stories (geology/history/character). Single source
// of truth shared with the runtime (data/beachStories.ts), shaped as
// { regionId: { beachId: { title, paragraphs } } }; authored only in en/gr. We
// bake them into the static beach pages so this unique content is crawlable
// (otherwise it lives only in the client-only React detail page and search
// engines never see it).
const beachStories = await readJson(path.join(projectRoot, 'data', 'beachStories.data.json'));

// Returns { title, paragraphs[] } for a beach, or null. Scoped by region id
// (ids are unique only within a region) and to the locales the story is actually
// authored in (en/gr) so we never leak English onto /de, /fr, /it.
const getBeachStory = (region, beach, language) => {
  if (!region) return null;
  if (language !== 'en' && language !== 'gr') return null;
  const regionStories = beachStories[region.id];
  if (!regionStories) return null;
  const story = regionStories[String(beach.id)];
  const paragraphs = story?.paragraphs?.[language];
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return null;
  return { title: story.title?.[language] || '', paragraphs };
};

const toPublicFilePath = publicPath => path.join(publicDir, publicPath.replace(/^\/+/, ''));

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeXml = escapeHtml;

const normalizeSlug = value => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'beach';
};

const toAbsolutePublicUrl = publicPath => `${siteUrl}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;

const toSitemapImageUrl = (imageUrl, publicAssets) => {
  const url = new URL(imageUrl);
  const publicPath = url.pathname;
  const webpPath = publicPath.replace(/\.(jpe?g)$/i, '.webp');

  return webpPath !== publicPath && publicAssets.has(webpPath)
    ? toAbsolutePublicUrl(webpPath)
    : imageUrl;
};

const imageTypeFromPath = publicPath => (
  publicPath.endsWith('.webp')
    ? 'image/webp'
    : publicPath.endsWith('.jpg') || publicPath.endsWith('.jpeg')
      ? 'image/jpeg'
      : undefined
);

const listRootPublicAssets = async () => {
  const entries = await readdir(publicDir, { withFileTypes: true });
  return new Set(entries
    .filter(entry => entry.isFile())
    .map(entry => `/${entry.name}`));
};

const uniqueCandidateSlugs = (...values) => Array.from(new Set(values
  .map(value => normalizeSlug(String(value || '').replace(/\s*\([^)]*\)\s*/g, ' ')))
  .filter(Boolean)));

const firstAvailablePublicAsset = (candidates, publicAssets) => (
  candidates.find(candidate => candidate && publicAssets.has(candidate)) || defaultOgImagePath
);

const resolveRegionOgImagePath = (region, island, publicAssets) => {
  const override = regionOgImageOverrides.get(region?.id) || regionOgImageOverrides.get(island?.id);
  const groupPrefix = ogImageGroupPrefixes.get(region?.group || island?.group);
  const slugs = uniqueCandidateSlugs(
    localized(island?.name, ''),
    localized(region?.name, ''),
    region?.prefecture,
    region?.id,
    island?.id,
  );

  const candidates = [
    override,
    ...slugs.flatMap(slug => [
      groupPrefix ? `/${groupPrefix}-${slug}-bg.jpg` : null,
      groupPrefix ? `/${groupPrefix}-${slug}-bg.webp` : null,
      `/${slug}-bg.jpg`,
      `/${slug}-bg.webp`,
    ]),
    defaultOgImagePath,
  ];

  return firstAvailablePublicAsset(Array.from(new Set(candidates.filter(Boolean))), publicAssets);
};

const localized = (value, fallback = '', language = 'en') => {
  if (typeof value === 'string') return value;

  return value?.[language] || value?.en || value?.gr || value?.fr || value?.de || value?.it || fallback;
};

// Per-language string/value picker for prerender copy. Falls back to English for
// any locale that has not been authored, so partial translations never break.
const pickLang = (language, map) => map[language] ?? map.en;

// Place names (beaches, islands) are TRANSLITERATED, never translated: a German
// or French visitor searches "Sarakiniko", and signage/ferries/Maps use the Latin
// form. The data's fr/de/it name fields are Greek copies, so for every non-Greek
// locale we use the romanized English form (which the slug also uses). Greek keeps
// the Greek name. en/gr behaviour is unchanged.
const placeNameLang = language => (language === 'gr' ? 'gr' : 'en');
const displayName = (nameObj, fallback, language) => localized(nameObj, fallback, placeNameLang(language));

const localizedPath = (pathName, locale) => {
  const suffix = pathName.startsWith('/') ? pathName : `/${pathName}`;
  return `${locale.pathPrefix}${suffix}`;
};

const canonicalUrlFor = (pathName, locale) => `${siteUrl}${localizedPath(pathName, locale)}`;

// The home page is only prerendered for the base locales (en, el). de/fr/it
// cluster pages therefore point their breadcrumb "home" at the root home, so the
// link and its JSON-LD never reference a non-existent /de//fr//it/ home. en/gr
// resolve to exactly the same URL as before.
const homePathForLocale = locale => (baseLocales.includes(locale) ? localizedPath('/', locale) : '/');
const homeUrlForLocale = locale => `${siteUrl}${homePathForLocale(locale)}`;

// `locales` MUST be the exact set this page was generated in, so we never emit an
// hreflang link to a file that does not exist. Defaults to the national en+el set.
const alternateUrlsFor = (pathName, locales = baseLocales) => [
  ...locales.map(locale => ({
    hreflang: locale.hreflang,
    href: canonicalUrlFor(pathName, locale),
  })),
  {
    hreflang: 'x-default',
    href: canonicalUrlFor(pathName, xDefaultLocale),
  },
];

// Each landing page targets a distinct search intent and is generated in every
// locale that provides content. Greek versions live under /el and reciprocate
// hreflang with their English counterpart. Link hrefs are stored as base
// (English) paths and localized at render time, so a Greek page links to Greek
// pages without duplicating the link table.
const seoLandingPages = [
  {
    // A general site FAQ. kind 'info' → no dynamic beach/region block; the Q&A renders
    // visibly AND becomes FAQPage JSON-LD (buildSeoLandingPage adds it from content.faq).
    pathName: '/faq/',
    kind: 'info',
    locales: {
      en: {
        title: 'Frequently Asked Questions | CalmBeach Greece',
        description: 'Common questions about CalmBeach: how reliable the forecast is, what wind exposure means, how wave height is worked out, where the data comes from and swimming safety.',
        h1: 'Frequently asked questions',
        intro: 'CalmBeach helps you compare Greek beaches by wind, waves, weather, exposure and access before you choose where to swim. Here are the questions people ask most.',
        sections: [],
        faq: [
          {
            q: 'How reliable is the CalmBeach forecast?',
            a: 'Wind, waves and temperature are a live weather forecast, not an on-the-spot measurement. It shows what is likely, so it is more accurate closer to the day than a week ahead. We present it as honestly as we can — for example a wave-height range instead of a false single number — and you should always double-check with your own eyes when you arrive.',
          },
          {
            q: 'What does wind exposure mean and how do you find less exposed beaches?',
            a: 'For each beach we look at shoreline orientation and surrounding terrain to estimate whether wind is likely to blow onshore or whether nearby land may reduce exposure. This helps compare beaches that may feel more manageable with beaches that are likely to pick up chop.',
          },
          {
            q: 'How do you work out the wave height, and what does the graphic show?',
            a: 'We combine the marine forecast with a physical model of how much wave the wind can build at each beach, based on how much open water lies in front of it. The graphic shows a real-scale person (about 1.75 m) and how high the water reaches them, so you grasp the wave size at a glance. The stated height is the average of the bigger waves — occasional sets run higher.',
          },
          {
            q: 'Is CalmBeach free?',
            a: 'Yes, CalmBeach is completely free to use.',
          },
          {
            q: 'How often is the data updated?',
            a: 'The weather and sea forecast is live and refreshes several times a day. Beach details such as location, facilities and access are updated periodically.',
          },
          {
            q: 'Where does the data come from?',
            a: 'Weather and sea conditions come from the Open-Meteo forecast service. Beach details come from open data (OpenStreetMap) plus our own curation and checks. Accessible sea-access (Seatrac) points come from the official seatrac.gr directory.',
          },
          {
            q: 'How many beaches does CalmBeach cover?',
            a: 'CalmBeach covers over 2,500 beaches across Greece, and we keep adding and refining them.',
          },
          {
            q: 'Can I rely on it for swimming safety?',
            a: 'It gives a good sense of how calm or rough the sea will be, but it does not replace your own judgement or a lifeguard. Always watch the waves, currents and local signs — even small waves can create dangerous rip currents.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/how-we-measure-wind-shelter/', label: 'How we measure wind shelter at each beach' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
          { href: '/dogs-on-beaches-greece/', label: 'Dogs on Greek beaches: what the law says' },
        ],
      },
      el: {
        title: 'Συχνές ερωτήσεις | CalmBeach Greece',
        description: 'Συχνές ερωτήσεις για το CalmBeach: πόσο αξιόπιστη είναι η πρόγνωση, τι σημαίνει έκθεση σε άνεμο, πώς υπολογίζεται το κύμα, από πού είναι τα δεδομένα και ασφάλεια στο μπάνιο.',
        h1: 'Συχνές ερωτήσεις',
        intro: 'Το CalmBeach σε βοηθά να συγκρίνεις ελληνικές παραλίες με βάση άνεμο, κύμα, καιρό, έκθεση και πρόσβαση πριν διαλέξεις πού θα κολυμπήσεις. Εδώ είναι οι πιο συχνές ερωτήσεις.',
        sections: [],
        faq: [
          {
            q: 'Πόσο αξιόπιστη είναι η πρόγνωση του CalmBeach;',
            a: 'Ο άνεμος, το κύμα και η θερμοκρασία είναι ζωντανή μετεωρολογική πρόγνωση, όχι μέτρηση επί τόπου. Δείχνει τι είναι πιθανό να επικρατεί, γι\' αυτό είναι πιο ακριβής κοντά στη μέρα παρά μία βδομάδα μπροστά. Την παρουσιάζουμε όσο πιο τίμια γίνεται — π.χ. εύρος κύματος αντί για ένα δήθεν «σίγουρο» νούμερο — και καλό είναι να την ελέγχεις πάντα και με τα μάτια σου φτάνοντας.',
          },
          {
            q: 'Τι σημαίνει «έκθεση σε άνεμο» και πώς βρίσκετε τις πιο ήρεμες παραλίες;',
            a: 'Για κάθε παραλία κοιτάμε τον προσανατολισμό της ακτής και το γύρω ανάγλυφο, ώστε να εκτιμήσουμε αν ο άνεμος πιθανόν τη χτυπάει πιο άμεσα ή αν η στεριά μπορεί να μειώνει την έκθεση. Έτσι συγκρίνουμε παραλίες που μπορεί να είναι πιο διαχειρίσιμες με παραλίες που πιθανόν πιάνουν περισσότερο κύμα.',
          },
          {
            q: 'Πώς υπολογίζετε το ύψος κύματος και τι δείχνει το γραφικό;',
            a: 'Συνδυάζουμε τη θαλάσσια πρόγνωση με ένα φυσικό μοντέλο που εκτιμά πόσο κύμα μπορεί να χτίσει ο άνεμος σε κάθε παραλία, ανάλογα με το πόσο ανοιχτή θάλασσα έχει μπροστά της. Το γραφικό δείχνει έναν άνθρωπο σε πραγματική κλίμακα (περίπου 1,75 μ.) και μέχρι πού του φτάνει το νερό, ώστε να καταλαβαίνεις το μέγεθος του κύματος με μια ματιά. Το αναγραφόμενο ύψος είναι ο μέσος όρος των μεγαλύτερων κυμάτων — κατά διαστήματα κάποια σετ είναι ψηλότερα.',
          },
          {
            q: 'Είναι δωρεάν το CalmBeach;',
            a: 'Ναι, το CalmBeach είναι εντελώς δωρεάν.',
          },
          {
            q: 'Κάθε πότε ανανεώνονται τα δεδομένα;',
            a: 'Η πρόγνωση καιρού και θάλασσας είναι ζωντανή και ανανεώνεται πολλές φορές μέσα στην ημέρα. Τα στοιχεία των παραλιών (τοποθεσία, παροχές, πρόσβαση) ενημερώνονται περιοδικά.',
          },
          {
            q: 'Από πού προέρχονται τα δεδομένα;',
            a: 'Ο καιρός και η θάλασσα από την υπηρεσία πρόγνωσης Open-Meteo. Τα στοιχεία των παραλιών από ανοιχτά δεδομένα (OpenStreetMap) και δική μας επιμέλεια και έλεγχο. Τα σημεία πρόσβασης ΑμεΑ στη θάλασσα (Seatrac) από την επίσημη λίστα του seatrac.gr.',
          },
          {
            q: 'Πόσες παραλίες καλύπτει το CalmBeach;',
            a: 'Το CalmBeach καλύπτει πάνω από 2.500 παραλίες σε όλη την Ελλάδα, και συνεχώς προσθέτουμε και βελτιώνουμε.',
          },
          {
            q: 'Μπορώ να βασιστώ σε αυτό για ασφάλεια στο μπάνιο;',
            a: 'Δίνει καλή εικόνα του πόσο ήρεμη ή αγριεμένη θα είναι η θάλασσα, αλλά δεν αντικαθιστά την κρίση σου ή τον ναυαγοσώστη. Πρόσεχε πάντα τα κύματα, τα ρεύματα και τις τοπικές πινακίδες — ακόμη και μικρά κύματα μπορούν να δημιουργήσουν επικίνδυνα ρεύματα επαναφοράς.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach' },
          { href: '/how-we-measure-wind-shelter/', label: 'Πώς υπολογίζουμε την προστασία από τον άνεμο' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
          { href: '/accessible-beaches-greece/', label: 'Προσβάσιμες παραλίες ΑμεΑ' },
          { href: '/dogs-on-beaches-greece/', label: 'Σκύλοι στην παραλία: τι λέει ο νόμος' },
        ],
      },
    },
  },
  {
    // The methodology page. It exists because the one thing no competitor can copy —
    // a per-beach shelter reading measured from the shape of the coastline, checked
    // nationally — was invisible: it lived in the model, never in a page a visitor or
    // a journalist could read. DELIBERATE LIMIT ON WHAT THIS SAYS: it explains WHAT we
    // measure and THAT we check ourselves, never the thresholds, sector rules or curated
    // overrides. Those are the part that took two summers; the description of the idea
    // is not the moat and was already half-public in the FAQ.
    pathName: '/how-we-measure-wind-shelter/',
    kind: 'info',
    locales: {
      en: {
        title: 'How We Measure Wind Shelter at Each Beach | CalmBeach',
        description: 'Every Greek beach on CalmBeach carries a shelter reading built from the shape of its own coastline, not from a single regional forecast. Here is how it is made and where it stops.',
        h1: 'How we measure wind shelter at each beach',
        intro: 'Most weather sites give you one wind figure for a whole island. That figure is often right and still useless: on the same afternoon, one bay is flat and the bay behind the headland is unswimmable. CalmBeach exists to answer the harder question — what the wind does at THIS beach — so this page explains how that answer is built, and where we stop trusting it.',
        sections: [
          {
            heading: 'The question a forecast alone cannot answer',
            body: 'A marine forecast is calculated on a grid of cells several kilometres across. One cell can cover an entire small island, so it cannot see that a cove faces away from the wind while the coast opposite takes it head-on. That is not a flaw in the forecast — it is a limit of its resolution. Every beach we describe sits inside such a cell, so the forecast is where our work starts, not where it ends.',
          },
          {
            heading: 'What we measure for every single beach',
            body: 'For each of the beaches in our dataset we work out, direction by direction, how much open water lies in front of the shore and how much land stands behind it. A beach with a long stretch of open sea to the north will build waves when the wind comes from the north; the same beach can be completely calm in a southerly. This is geometry, computed from coastline data rather than typed in by hand, and it is why two beaches ten minutes apart can get different readings on the same day.',
          },
          {
            heading: 'Where the numbers come from',
            body: 'Live wind, wave and temperature forecasts come from Open-Meteo. Coastline shapes and much of the beach information come from OpenStreetMap and its contributors. On top of both sits our own curation: corrected pin positions, verified amenities, and per-beach overrides where the automatic reading was wrong. Sources and licences are credited on every page.',
          },
          {
            heading: 'We test it, and we test it in the direction that can hurt you',
            body: 'A model like this can fail in two directions: it can call a beach rougher than it is, which costs you a good afternoon, or it can call it calmer than it is, which is the one that matters. We run the model against thousands of real beach-hours of live data before we change anything, and our automatic checks are written to catch both directions before a change reaches the site. When a check and a nice-looking idea disagree, the check wins.',
          },
          {
            heading: 'What we deliberately do not claim',
            body: 'We do not promise calm water, and we do not tell you a beach is safe — no forecast can. Very light winds, sudden gusts falling off steep terrain, and conditions inside very small enclosed coves are all cases where we stay cautious on purpose and say less rather than more. Our wording follows that: "usually sheltered" is a seasonal tendency, not a statement about this afternoon.',
          },
          {
            heading: 'What to do with all this',
            body: 'Use the shelter reading to choose which side of the island to drive to, and the live conditions to choose the day and the hour. Then use your eyes when you arrive: local flags, the lifeguard, and how the water actually looks always outrank anything a website told you.',
          },
        ],
        faq: [
          {
            q: 'Why does CalmBeach sometimes disagree with a general weather app?',
            a: 'A general app usually reports the wind for a region or a nearby town. We start from the same forecast and then account for the shape of the coastline at the specific beach, so a beach in the wind shadow of the land can read differently from the island average. The two are not measuring the same thing.',
          },
          {
            q: 'Is the shelter reading about today or about the season?',
            a: 'Both, separately. The wording "usually sheltered when the meltemi blows" describes how a beach tends to behave in the region\'s dominant summer wind, which is useful weeks ahead. Today\'s colour and conditions come from the live forecast and change through the day.',
          },
          {
            q: 'Do you visit the beaches?',
            a: 'Some of them, and those carry a visited-and-verified mark. The rest are built from open data plus our own corrections. We would rather tell you a beach is unverified than imply a personal visit that never happened.',
          },
          {
            q: 'Can I trust this for swimming safety?',
            a: 'No website can carry that. Treat everything here as planning information: it helps you pick a likely-comfortable beach and a likely-comfortable hour. Warning flags, lifeguards, local signage and your own judgement at the water\'s edge come first.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach beach search' },
          { href: '/sheltered-beaches-meltemi/', label: 'Beaches usually better with Meltemi winds' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/faq/', label: 'Frequently asked questions' },
        ],
      },
      el: {
        title: 'Πώς Υπολογίζουμε την Προστασία από τον Άνεμο | CalmBeach',
        description: 'Κάθε παραλία στο CalmBeach έχει δική της εκτίμηση προστασίας, από το σχήμα της ίδιας της ακτογραμμής της και όχι από μία πρόγνωση για όλο το νησί. Πώς φτιάχνεται και πού σταματά.',
        h1: 'Πώς υπολογίζουμε την προστασία από τον άνεμο',
        intro: 'Τα περισσότερα site δίνουν έναν αριθμό ανέμου για ολόκληρο το νησί. Συχνά είναι σωστός και ταυτόχρονα άχρηστος: το ίδιο απόγευμα, ο ένας όρμος είναι λάδι και ο διπλανός δεν κολυμπιέται. Το CalmBeach υπάρχει για το δυσκολότερο ερώτημα — τι κάνει ο άνεμος σε ΑΥΤΗ την παραλία. Εδώ εξηγούμε πώς βγαίνει αυτή η απάντηση, και πού σταματάμε να την εμπιστευόμαστε.',
        sections: [
          {
            heading: 'Τι δεν μπορεί να απαντήσει μια πρόγνωση μόνη της',
            body: 'Η θαλάσσια πρόγνωση υπολογίζεται σε κελιά μερικών χιλιομέτρων. Ένα κελί μπορεί να καλύπτει ολόκληρο μικρό νησί, οπότε δεν βλέπει ότι ένας όρμος κοιτάζει αντίθετα από τον άνεμο ενώ η απέναντι ακτή τον τρώει κατάμουτρα. Δεν είναι ελάττωμα της πρόγνωσης· είναι όριο της ανάλυσής της. Κάθε παραλία που περιγράφουμε βρίσκεται μέσα σε τέτοιο κελί, γι\' αυτό η πρόγνωση είναι η αρχή της δουλειάς μας και όχι το τέλος της.',
          },
          {
            heading: 'Τι μετράμε για κάθε ξεχωριστή παραλία',
            body: 'Για κάθε παραλία υπολογίζουμε, κατεύθυνση προς κατεύθυνση, πόση ανοιχτή θάλασσα απλώνεται μπροστά στην ακτή και πόση στεριά στέκεται από πίσω. Μια παραλία με πολλά ανοιχτά μίλια προς τον βορρά θα χτίσει κύμα όταν φυσά βοριάς· η ίδια παραλία μπορεί να είναι εντελώς ήρεμη με νοτιά. Είναι γεωμετρία, υπολογισμένη από δεδομένα ακτογραμμής και όχι γραμμένη στο χέρι, και γι\' αυτό δύο παραλίες δέκα λεπτά μακριά μπορεί να διαβάζονται διαφορετικά την ίδια μέρα.',
          },
          {
            heading: 'Από πού έρχονται τα νούμερα',
            body: 'Ο ζωντανός άνεμος, το κύμα και οι θερμοκρασίες έρχονται από το Open-Meteo. Τα σχήματα των ακτών και μεγάλο μέρος των στοιχείων κάθε παραλίας από το OpenStreetMap και τους συνεισφέροντές του. Πάνω σε αυτά κάθεται η δική μας επιμέλεια: διορθωμένες θέσεις πινέζας, επαληθευμένες παροχές, και χειροκίνητες διορθώσεις όπου η αυτόματη ανάγνωση έβγαινε λάθος. Οι πηγές και οι άδειες αναφέρονται σε κάθε σελίδα.',
          },
          {
            heading: 'Το ελέγχουμε — και το ελέγχουμε προς την κατεύθυνση που σε βλάπτει',
            body: 'Ένα τέτοιο μοντέλο μπορεί να αστοχήσει με δύο τρόπους: να πει μια παραλία αγριότερη απ\' ό,τι είναι, που σου κοστίζει ένα καλό απόγευμα, ή να την πει ηρεμότερη, που είναι το σοβαρό. Δοκιμάζουμε το μοντέλο σε χιλιάδες πραγματικές ώρες-παραλίας με ζωντανά δεδομένα πριν αλλάξουμε οτιδήποτε, και οι αυτόματοι έλεγχοί μας είναι γραμμένοι ώστε να πιάνουν και τις δύο κατευθύνσεις πριν φτάσει η αλλαγή στο site. Όταν ένας έλεγχος διαφωνεί με μια ωραία ιδέα, κερδίζει ο έλεγχος.',
          },
          {
            heading: 'Τι σκόπιμα δεν ισχυριζόμαστε',
            body: 'Δεν υποσχόμαστε ήρεμο νερό και δεν σου λέμε ότι μια παραλία είναι ασφαλής — καμία πρόγνωση δεν μπορεί. Οι πολύ ασθενείς άνεμοι, τα ξαφνικά ριπίσματα που πέφτουν από απότομες πλαγιές και οι συνθήκες μέσα σε πολύ μικρούς κλειστούς όρμους είναι περιπτώσεις όπου μένουμε επίτηδες συντηρητικοί και λέμε λιγότερα αντί για περισσότερα. Η διατύπωση το δείχνει: το «συνήθως προστατευμένη» περιγράφει εποχική τάση με βάση τον προσανατολισμό, όχι το σημερινό απόγευμα.',
          },
          {
            heading: 'Πώς να το χρησιμοποιήσεις',
            body: 'Χρησιμοποίησε την εκτίμηση προστασίας για να διαλέξεις σε ποια πλευρά του νησιού θα οδηγήσεις, και τις ζωντανές συνθήκες για να διαλέξεις μέρα και ώρα. Και μετά χρησιμοποίησε τα μάτια σου όταν φτάσεις: οι σημαίες, ο ναυαγοσώστης και το πώς δείχνει όντως το νερό υπερισχύουν πάντα από ό,τι σου είπε μια ιστοσελίδα.',
          },
        ],
        faq: [
          {
            q: 'Γιατί το CalmBeach διαφωνεί μερικές φορές με μια γενική εφαρμογή καιρού;',
            a: 'Μια γενική εφαρμογή δίνει συνήθως τον άνεμο για μια περιοχή ή για κοντινή πόλη. Εμείς ξεκινάμε από την ίδια πρόγνωση και μετά λαμβάνουμε υπόψη το σχήμα της ακτογραμμής στη συγκεκριμένη παραλία, οπότε μια παραλία στη σκιά της στεριάς μπορεί να διαβάζεται αλλιώς από τον μέσο όρο του νησιού. Τα δύο δεν μετρούν το ίδιο πράγμα.',
          },
          {
            q: 'Η εκτίμηση προστασίας αφορά τη σημερινή μέρα ή την εποχή;',
            a: 'Και τα δύο, χωριστά. Το «συνήθως μένει προστατευμένη όταν φυσά μελτέμι» περιγράφει πώς τείνει να συμπεριφέρεται μια παραλία στον κυρίαρχο καλοκαιρινό άνεμο της περιοχής, και είναι χρήσιμο εβδομάδες πριν. Το σημερινό χρώμα και οι συνθήκες βγαίνουν από τη ζωντανή πρόγνωση και αλλάζουν μέσα στη μέρα.',
          },
          {
            q: 'Επισκέπτεστε τις παραλίες;',
            a: 'Κάποιες, και αυτές έχουν σήμανση ότι τις έχουμε δει από κοντά. Οι υπόλοιπες χτίζονται από ανοιχτά δεδομένα και τις δικές μας διορθώσεις. Προτιμάμε να σου πούμε ότι μια παραλία δεν είναι επιβεβαιωμένη, παρά να υπονοήσουμε επίσκεψη που δεν έγινε.',
          },
          {
            q: 'Μπορώ να το εμπιστευτώ για την ασφάλειά μου στο μπάνιο;',
            a: 'Καμία ιστοσελίδα δεν σηκώνει αυτό το βάρος. Δες τα πάντα εδώ ως πληροφορία σχεδιασμού: σε βοηθά να διαλέξεις μια πιθανόν άνετη παραλία και μια πιθανόν άνετη ώρα. Οι σημαίες, οι ναυαγοσώστες, η τοπική σήμανση και η δική σου κρίση στην άκρη του νερού προηγούνται.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε την αναζήτηση CalmBeach' },
          { href: '/sheltered-beaches-meltemi/', label: 'Παραλίες που βολεύουν με μελτέμι' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
          { href: '/faq/', label: 'Συχνές ερωτήσεις' },
        ],
      },
    },
  },
  {
    pathName: '/best-beaches-greece-today/',
    kind: 'regionHub',
    locales: {
      en: {
        title: 'Compare Greek Beaches by Wind, Waves & Shelter | CalmBeach',
        description: 'Compare Greek beaches by wind, waves, weather, exposure and shelter, then open any beach for live conditions before you choose where to swim.',
        h1: 'Compare Greek beaches by wind, waves and protection',
        intro: 'CalmBeach helps you compare beach options across Greece using the conditions that matter before you swim: wind, waves, weather, exposure, access and beach type.',
        sections: [
          {
            heading: 'How CalmBeach compares beaches',
            body: 'The app combines forecast conditions with static beach information so you can quickly see which beaches may be more suitable for your plans. It avoids treating a famous beach as the obvious choice when wind or waves make another option more practical.',
          },
          {
            heading: 'What to check before you go',
            body: 'Look at the current wind direction, wind strength, wave height, beach exposure, access and amenities. Conditions can vary locally, so CalmBeach keeps recommendations cautious instead of promising perfect conditions.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach beach search' },
          { href: '/family-beaches-greece/', label: 'Family beaches in Greece' },
          { href: '/sheltered-beaches-meltemi/', label: 'Beaches usually better with Meltemi winds' },
          { href: '/faq/', label: 'How CalmBeach works (FAQ)' },
        ],
      },
      el: {
        title: 'Σύγκριση Παραλιών στην Ελλάδα: Άνεμος & Κύμα | CalmBeach',
        description: 'Σύγκρινε ελληνικές παραλίες με άνεμο, κύμα, καιρό, έκθεση και προστασία, και άνοιξε κάθε παραλία για live συνθήκες πριν διαλέξεις πού θα κολυμπήσεις.',
        h1: 'Σύγκριση ελληνικών παραλιών με άνεμο, κύμα και προστασία',
        intro: 'Το CalmBeach σε βοηθά να συγκρίνεις παραλίες σε όλη την Ελλάδα με βάση αυτά που μετράνε πριν το μπάνιο: άνεμος, κύμα, καιρός, έκθεση, πρόσβαση και τύπος παραλίας.',
        sections: [
          {
            heading: 'Πώς συγκρίνει τις παραλίες το CalmBeach',
            body: 'Η εφαρμογή συνδυάζει τις προγνώσεις με σταθερά στοιχεία κάθε παραλίας, ώστε να βλέπεις γρήγορα ποιες ταιριάζουν καλύτερα για τη μέρα. Δεν θεωρεί αυτόματα καλύτερη μια διάσημη παραλία όταν ο άνεμος ή το κύμα κάνουν μια άλλη πιο πρακτική.',
          },
          {
            heading: 'Τι να ελέγξεις πριν πας',
            body: 'Δες την κατεύθυνση και την ένταση του ανέμου, το ύψος κύματος, την έκθεση της παραλίας, την πρόσβαση και τις παροχές. Οι συνθήκες αλλάζουν τοπικά, γι\' αυτό οι προτάσεις μένουν προσεκτικές και δεν υπόσχονται τέλειες συνθήκες.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε την αναζήτηση CalmBeach' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες' },
          { href: '/sheltered-beaches-meltemi/', label: 'Επιλογές με μελτέμι' },
          { href: '/faq/', label: 'Συχνές ερωτήσεις' },
        ],
      },
    },
  },
  {
    pathName: '/sheltered-beaches-meltemi/',
    kind: 'regionHub',
    locales: {
      en: {
        title: 'More Sheltered Greek Beaches for the Meltemi | CalmBeach',
        description: 'Find Greek beaches oriented away from northerly Meltemi winds, then open any beach for live wind and waves before you go.',
        h1: 'Beaches usually better with Meltemi winds',
        intro: 'In July and August the Meltemi can blow strong from the north across the Aegean. A more comfortable beach is usually one with less exposure to that wind direction, not simply the most popular one.',
        sections: [
          {
            heading: 'Which coasts are often more comfortable',
            body: 'When the Meltemi blows from the north, south and southwest-facing bays may be more protected, while exposed north coasts often pick up wind and chop. The better side changes with wind direction, so check wind and waves before you go.',
          },
          {
            heading: 'A cautious recommendation',
            body: 'CalmBeach treats protection as a cautious signal based on beach orientation, exposure and available data. On strong wind days it prefers caution and reminds you to follow local flags and lifeguard guidance.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach beach search' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Πιο Απάνεμες Παραλίες στο Μελτέμι — Ελλάδα | CalmBeach',
        description: 'Βρες ελληνικές παραλίες με προσανατολισμό μακριά από το βόρειο μελτέμι, και άνοιξε κάθε παραλία για live άνεμο και κύμα πριν πας.',
        h1: 'Παραλίες που συχνά βολεύουν με μελτέμι',
        intro: 'Τον Ιούλιο και τον Αύγουστο το μελτέμι φυσά δυνατά από τον βορρά στο Αιγαίο. Μια πιο άνετη παραλία είναι συνήθως αυτή με μικρότερη έκθεση σε αυτή την κατεύθυνση ανέμου, όχι απλώς η πιο δημοφιλής.',
        sections: [
          {
            heading: 'Ποιες ακτές είναι συχνά πιο άνετες',
            body: 'Όταν το μελτέμι φυσά βόρεια, οι νότιοι και νοτιοδυτικοί κόλποι μπορεί να είναι πιο προστατευμένοι, ενώ οι εκτεθειμένες βόρειες ακτές συχνά πιάνουν αέρα και κύμα. Η καλύτερη πλευρά αλλάζει με την κατεύθυνση, γι\' αυτό έλεγξε τις συνθήκες πριν πας.',
          },
          {
            heading: 'Προσεκτική πρόταση',
            body: 'Το CalmBeach χαρακτηρίζει μια παραλία πιο υπήνεμη μόνο όταν το επιτρέπουν η έκθεση και η πρόγνωση. Σε μέρες με δυνατό αέρα προτιμά την προσοχή και θυμίζει να ακολουθείς τις τοπικές σημαίες και τον ναυαγοσώστη.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε την αναζήτηση CalmBeach' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
          { href: '/beach-camping-greece/', label: 'Παραλίες με camping' },
        ],
      },
    },
  },
  {
    pathName: '/accessible-beaches-greece/',
    kind: 'beachList',
    category: 'accessible',
    locales: {
      en: {
        title: 'Accessible Beaches in Greece with Seatrac | CalmBeach',
        description: 'Greek beaches with accessible facilities and Seatrac sea-access ramps where available. Open any beach for live wind & waves, and confirm access locally.',
        h1: 'Accessible Beaches in Greece',
        intro: 'Find beaches in Greece with easier access information, wheelchair-friendly facilities, ramps, accessible paths or Seatrac-style access where this information is available. CalmBeach helps you compare beach conditions before you choose where to go.',
        trustNote: 'Accessibility information can change by season and municipality. Always check local signage or official local sources before visiting.',
        faqHeading: 'Accessible beaches FAQ',
        faq: [
          {
            q: 'How does CalmBeach identify accessible beaches?',
            a: 'CalmBeach uses accessibility-related fields already present in the current beach dataset, especially active Seatrac sea-access records and listed supporting amenities where available.',
          },
          {
            q: 'Are all accessible beaches in Greece listed here?',
            a: 'No. This guide only shows beaches with accessibility information currently available in CalmBeach, so the list may be incomplete.',
          },
          {
            q: 'Can accessibility information change?',
            a: 'Yes. Accessible equipment and facilities can change by season, municipality or maintenance status, so always confirm locally when accessibility is critical.',
          },
          {
            q: 'Can I also check wind and sea conditions?',
            a: 'Yes. Each beach card links to its CalmBeach detail page where available conditions, wind, waves and beach exposure help you decide whether it fits your visit.',
          },
        ],
        sections: [
          {
            heading: 'What the cards show',
            body: 'Cards highlight only accessibility details already stored for that beach, such as an online Seatrac sea-access ramp, accessible parking, a boardwalk to the water, accessible WC, changing room or shower when those fields are available.',
          },
          {
            heading: 'Conditions still matter',
            body: 'Even when access information looks useful, wind and waves can change comfort at the beach. Open a beach page to compare wind, waves, weather and exposure before you go.',
          },
        ],
        links: [
          { href: '#accessible-beach-list', label: 'Explore accessible beaches' },
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/family-beaches-greece/', label: 'Family-friendly beaches' },
          { href: '/beaches/milos/', label: 'Browse Milos beaches' },
        ],
      },
      el: {
        title: 'Προσβάσιμες Παραλίες ΑμεΑ στην Ελλάδα (Seatrac) | CalmBeach',
        description: 'Ελληνικές παραλίες με υποδομές ΑμεΑ και συστήματα Seatrac όπου υπάρχουν. Άνοιξε κάθε παραλία για live άνεμο & κύμα και επιβεβαίωσε τοπικά πριν πας.',
        h1: 'Προσβάσιμες παραλίες ΑμεΑ',
        intro: 'Κάποιες ελληνικές παραλίες διαθέτουν υποδομές προσβασιμότητας, όπως ράμπες, προσβάσιμο πάρκινγκ ή συστήματα Seatrac για αυτόνομη πρόσβαση στη θάλασσα. Το CalmBeach σε βοηθά να τις βρεις και να δεις τον καιρό για τη μέρα.',
        sections: [
          {
            heading: 'Τι μπορεί να σημαίνει προσβασιμότητα',
            body: 'Η προσβασιμότητα διαφέρει ανά παραλία: πρόσβαση χωρίς σκαλιά, προσβάσιμο πάρκινγκ, διάδρομοι και συσκευές Seatrac που βοηθούν χρήστες αμαξιδίου να φτάσουν στο νερό. Επιβεβαίωσε πάντα ότι ο εξοπλισμός λειτουργεί πριν ταξιδέψεις.',
          },
          {
            heading: 'Οι συνθήκες πάλι μετράνε',
            body: 'Ακόμη και σε προσβάσιμη παραλία, ο άνεμος και το κύμα αλλάζουν την άνεση. Το CalmBeach συνδυάζει τις πληροφορίες προσβασιμότητας με άνεμο, κύμα και έκθεση, ώστε να συγκρίνεις πριν πας.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες με ήρεμα νερά' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
        ],
      },
    },
  },
  {
    pathName: '/family-beaches-greece/',
    kind: 'beachList',
    category: 'family',
    locales: {
      en: {
        title: 'Family Beaches in Greece with Shallow Water | CalmBeach',
        description: 'Family-friendly Greek beaches with shallow water and easier access. Open any beach for live wind & waves before you go.',
        h1: 'Family beaches in Greece',
        intro: 'For young children, shallow water and easy access often matter more than a famous name. CalmBeach helps you find family-friendly options and check conditions before you go.',
        sections: [
          {
            heading: 'What makes a beach family-friendly',
            body: 'Helpful features include shallow, gently shelving water, sand underfoot, shade or amenities nearby and easy access without a difficult path. CalmBeach surfaces these alongside wind and sea information.',
          },
          {
            heading: 'Check wind and waves first',
            body: 'Small waves and gusts that are fine for adults can be tiring for children. CalmBeach checks wind, waves and exposure so you can compare less exposed beaches and more comfortable visiting times.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Παραλίες για Οικογένειες & Παιδιά στην Ελλάδα | CalmBeach',
        description: 'Οικογενειακές ελληνικές παραλίες με ρηχά νερά και εύκολη πρόσβαση. Άνοιξε κάθε παραλία για live άνεμο & κύμα πριν πας.',
        h1: 'Οικογενειακές παραλίες με ρηχά νερά',
        intro: 'Για μικρά παιδιά, μια πιο ήρεμη παραλία με ρηχά νερά και εύκολη πρόσβαση συχνά μετράει περισσότερο από ένα διάσημο όνομα. Το CalmBeach σε βοηθά να βρεις οικογενειακές επιλογές και να δεις τις συνθήκες της μέρας.',
        sections: [
          {
            heading: 'Τι κάνει μια παραλία κατάλληλη για οικογένειες',
            body: 'Βοηθούν τα ρηχά νερά με ομαλό βυθό, η άμμος, η σκιά ή οι κοντινές παροχές και η εύκολη πρόσβαση χωρίς δύσκολο μονοπάτι. Το CalmBeach τα δείχνει μαζί με πληροφορίες ανέμου και θάλασσας.',
          },
          {
            heading: 'Διάλεξε πιο ήρεμη μέρα',
            body: 'Μικρά κύματα και ριπές που δεν ενοχλούν τους ενήλικες μπορεί να κουράζουν τα παιδιά. Το CalmBeach ελέγχει άνεμο, κύμα και έκθεση, ώστε να διαλέξεις πιο υπήνεμη παραλία ή πιο ήρεμη ώρα.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/accessible-beaches-greece/', label: 'Προσβάσιμες παραλίες ΑμεΑ' },
          { href: '/beach-camping-greece/', label: 'Παραλίες με camping' },
        ],
      },
    },
  },
  {
    // "beaches near me" / «παραλίες κοντά μου»: 52 distinct queries, 135
    // impressions and 3 clicks in the 28d to 2026-07-24, landing on the bare
    // home page at position 15-20 because nothing on the site targeted them.
    // The app HAS the feature (cross-region "Κοντά μου"), so the honest page is
    // one that explains it and hands you to it — a static page can never list
    // "beaches near you", and this one never pretends to. The CTA carries
    // ?near=1, which App.tsx consumes once and strips.
    pathName: '/beaches-near-me/',
    kind: 'info',
    locales: {
      en: {
        title: 'Beaches Near Me in Greece — Wind & Waves | CalmBeach',
        description: 'Find the beaches closest to you anywhere in Greece, each with its own wind, wave and exposure reading. Your position never leaves your device.',
        h1: 'Beaches near me',
        intro: 'Wherever you are in Greece, the beaches closest to you are rarely all in the same region — and on a windy day the nearest one is often the wrong one. CalmBeach finds the beaches physically nearest to you, ignoring administrative borders, and shows you how exposed each one is to the wind that is actually blowing.',
        sections: [
          {
            heading: 'How it works',
            body: 'Tap the button above and allow location access. CalmBeach gathers the beaches within roughly 40 km of you — crossing region and island boundaries, so a beach 12 km away in the next prefecture still counts — and lists them nearest first, each with its own wind, wave and exposure reading for the day. If there are too few beaches that close, the radius widens until the list is useful.',
          },
          {
            heading: 'Nearest is not always best',
            body: 'Two beaches ten minutes apart can have completely different days if one faces the wind and the other sits behind a headland. That is why the list is not only sorted by distance: each beach carries its own exposure reading, so you can trade five extra minutes of driving for a swim that is actually pleasant.',
          },
          {
            heading: 'Your location stays on your device',
            body: 'The nearest-beach calculation runs entirely in your browser, against beach data already downloaded to it. Your coordinates are never sent to us, never stored, and are explicitly blocked from analytics. Close the tab and nothing about where you were remains.',
          },
          {
            heading: 'No location access? Start from a city',
            body: 'If you would rather not share your position, pick the coast nearest to where you are staying and browse it directly — the same wind and wave information is on every beach page.',
          },
        ],
        faq: [
          { q: 'Do I have to allow location access?', a: 'Only if you want the automatic list. Without it you can pick any region or island manually and get exactly the same per-beach conditions.' },
          { q: 'Does it work outside the big islands?', a: 'Yes. The search runs over the whole Greek coastline in CalmBeach, mainland included, and crosses region borders — it looks for the nearest beaches, not the nearest ones inside your current region.' },
          { q: 'What if I am not in Greece?', a: 'The dataset covers Greek beaches only, so from abroad the result will not be meaningful. Browse by island or region instead and plan ahead.' },
          { q: 'Why is the nearest beach not first in my list?', a: 'The list leads with distance but also carries each beach\'s exposure to the wind, so a slightly further beach that is out of the wind can be the better call on the day. Both numbers are shown, and the choice stays yours.' },
          { q: 'How accurate is the distance?', a: 'It is straight-line distance from your device position, not driving distance, so a bay across a headland can be closer on the map than by road. Use it to shortlist, then check the route.' },
        ],
        links: [
          { href: '/?near=1', label: 'Find beaches near me now' },
          { href: '/beaches/athens-area/', label: 'Beaches near Athens' },
          { href: '/beaches/thessaloniki-area/', label: 'Beaches near Thessaloniki' },
          { href: '/beaches/heraklion/', label: 'Beaches near Heraklion' },
          { href: '/beaches/achaia/', label: 'Beaches near Patras' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
        ],
      },
      el: {
        title: 'Παραλίες Κοντά Μου — Άνεμος & Κύμα | CalmBeach',
        description: 'Βρες τις πιο κοντινές σου παραλίες σε όλη την Ελλάδα, με άνεμο, κύμα και έκθεση για την καθεμιά. Η θέση σου δεν φεύγει από τη συσκευή σου.',
        h1: 'Παραλίες κοντά μου',
        intro: 'Οι πιο κοντινές σου παραλίες σπάνια ανήκουν όλες στον ίδιο νομό — και τη μέρα που φυσάει, η πιο κοντινή συχνά είναι η λάθος επιλογή. Το CalmBeach βρίσκει τις παραλίες που είναι όντως κοντά σου, αγνοώντας τα διοικητικά όρια, και δείχνει πόσο εκτεθειμένη είναι η καθεμιά στον άνεμο που φυσάει.',
        sections: [
          {
            heading: 'Πώς δουλεύει',
            body: 'Πάτα το κουμπί και δώσε πρόσβαση στην τοποθεσία. Το CalmBeach μαζεύει τις παραλίες σε ακτίνα περίπου 40 χλμ. — περνώντας όρια νομών και νησιών, ώστε μια παραλία 12 χλμ. μακριά στον διπλανό νομό να μετράει κανονικά — και τις δείχνει με τη σειρά απόστασης, με άνεμο, κύμα και έκθεση για την κάθε μία. Αν είναι πολύ λίγες τόσο κοντά, η ακτίνα ανοίγει μέχρι να βγει χρήσιμη λίστα.',
          },
          {
            heading: 'Η πιο κοντινή δεν είναι πάντα η καλύτερη',
            body: 'Δύο παραλίες δέκα λεπτά απόσταση μπορεί να έχουν εντελώς διαφορετική μέρα, αν η μία κοιτάει τον άνεμο και η άλλη κάθεται πίσω από ένα ακρωτήρι. Γι\' αυτό η λίστα δεν είναι μόνο κατά απόσταση: κάθε παραλία κουβαλάει τη δική της έκθεση, ώστε να μπορείς να ανταλλάξεις πέντε λεπτά δρόμο με ένα μπάνιο που αξίζει.',
          },
          {
            heading: 'Η θέση σου μένει στη συσκευή σου',
            body: 'Ο υπολογισμός γίνεται εξ ολοκλήρου στον browser σου, πάνω σε δεδομένα παραλιών που έχουν ήδη κατέβει. Οι συντεταγμένες σου δεν στέλνονται σε εμάς, δεν αποθηκεύονται πουθενά και είναι ρητά αποκλεισμένες από τα analytics. Κλείνεις την καρτέλα και δεν μένει τίποτα.',
          },
          {
            heading: 'Χωρίς τοποθεσία; Ξεκίνα από μια πόλη',
            body: 'Αν δεν θέλεις να μοιραστείς τη θέση σου, διάλεξε την ακτή που είναι πιο κοντά εκεί που μένεις — οι ίδιες πληροφορίες για άνεμο και κύμα υπάρχουν σε κάθε σελίδα παραλίας.',
          },
        ],
        faq: [
          { q: 'Πρέπει οπωσδήποτε να δώσω πρόσβαση στην τοποθεσία;', a: 'Μόνο αν θέλεις την αυτόματη λίστα. Χωρίς αυτήν διαλέγεις περιοχή ή νησί με το χέρι και βλέπεις ακριβώς τις ίδιες συνθήκες ανά παραλία.' },
          { q: 'Δουλεύει και εκτός των μεγάλων νησιών;', a: 'Ναι. Η αναζήτηση τρέχει σε όλη την ελληνική ακτογραμμή που έχει το CalmBeach, ηπειρωτική Ελλάδα συμπεριλαμβανομένη, και περνάει τα όρια των περιοχών — ψάχνει τις πιο κοντινές παραλίες, όχι τις πιο κοντινές μέσα στην περιοχή που βλέπεις.' },
          { q: 'Κι αν δεν είμαι στην Ελλάδα;', a: 'Τα δεδομένα καλύπτουν μόνο ελληνικές παραλίες, οπότε από το εξωτερικό το αποτέλεσμα δεν βγάζει νόημα. Δες με νησί ή περιοχή και σχεδίασε από πριν.' },
          { q: 'Γιατί η πιο κοντινή παραλία δεν είναι πρώτη στη λίστα μου;', a: 'Η λίστα ξεκινά από την απόσταση, αλλά κουβαλάει και την έκθεση κάθε παραλίας στον άνεμο — έτσι μια λίγο πιο μακρινή που είναι πιο υπήνεμη μπορεί να βγαίνει καλύτερη επιλογή για τη μέρα. Φαίνονται και τα δύο· η απόφαση μένει δική σου.' },
          { q: 'Πόσο ακριβής είναι η απόσταση;', a: 'Είναι ευθεία απόσταση από τη θέση της συσκευής, όχι απόσταση οδήγησης — ένας κόλπος πίσω από ακρωτήρι μπορεί να φαίνεται πιο κοντά στον χάρτη απ\' ό,τι είναι με το αυτοκίνητο. Χρησιμοποίησέ την για προεπιλογή και μετά δες τη διαδρομή.' },
        ],
        links: [
          // Base paths only — the renderer localizes every href per locale.
          { href: '/?near=1', label: 'Βρες παραλίες κοντά μου τώρα' },
          { href: '/beaches/athens-area/', label: 'Παραλίες κοντά στην Αθήνα' },
          { href: '/beaches/thessaloniki-area/', label: 'Παραλίες κοντά στη Θεσσαλονίκη' },
          { href: '/beaches/heraklion/', label: 'Παραλίες κοντά στο Ηράκλειο' },
          { href: '/beaches/achaia/', label: 'Παραλίες κοντά στην Πάτρα' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
        ],
      },
    },
  },
  {
    pathName: '/beach-camping-greece/',
    kind: 'beachList',
    category: 'camping',
    locales: {
      en: {
        title: 'Beaches with Campsites Nearby in Greece | CalmBeach',
        description: 'Greek beaches with an official campsite nearby. Open any beach for live wind, waves and exposure to plan your stay before you go.',
        h1: 'Beaches with camping nearby',
        intro: 'If you are travelling with a tent or campervan, a beach with a campsite nearby can shape the whole trip. CalmBeach links beaches to nearby campsites and helps you check wind and sea conditions before you go.',
        sections: [
          {
            heading: 'Camping close to the sea',
            body: 'CalmBeach connects beaches to organised campsites within a short distance, so you can plan where to stay and swim together. It focuses on proper campsites rather than informal or prohibited spots.',
          },
          {
            heading: 'Check conditions before pitching',
            body: 'Exposed beaches can be windy for tents and choppy for swimming. Looking at wind direction, strength and exposure helps you pick a less exposed base for your stay.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/family-beaches-greece/', label: 'Family-friendly beaches' },
          { href: '/dogs-on-beaches-greece/', label: 'Dogs on Greek beaches: what the law says' },
        ],
      },
      el: {
        title: 'Παραλίες με Κάμπινγκ Κοντά — Ελλάδα | CalmBeach',
        description: 'Ελληνικές παραλίες με κάμπινγκ κοντά. Άνοιξε κάθε παραλία για live άνεμο, κύμα και έκθεση για να σχεδιάσεις τη διαμονή σου πριν πας.',
        h1: 'Παραλίες με camping κοντά',
        intro: 'Αν ταξιδεύεις με σκηνή ή τροχόσπιτο, μια παραλία με κάμπινγκ κοντά μπορεί να καθορίσει όλο το ταξίδι. Το CalmBeach συνδέει παραλίες με κοντινά κάμπινγκ και δείχνει τις συνθήκες της θάλασσας για τη μέρα.',
        sections: [
          {
            heading: 'Κάμπινγκ δίπλα στη θάλασσα',
            body: 'Το CalmBeach συνδέει παραλίες με οργανωμένα κάμπινγκ σε μικρή απόσταση, ώστε να σχεδιάζεις μαζί πού θα μείνεις και πού θα κολυμπήσεις. Εστιάζει σε κανονικά κάμπινγκ, όχι σε άτυπες ή απαγορευμένες θέσεις.',
          },
          {
            heading: 'Έλεγξε τις συνθήκες πριν στήσεις',
            body: 'Οι εκτεθειμένες παραλίες μπορεί να έχουν αέρα για τις σκηνές και κύμα για το μπάνιο. Κοιτώντας κατεύθυνση, ένταση ανέμου και έκθεση, διαλέγεις πιο υπήνεμη βάση για τη μέρα.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες με ήρεμα νερά' },
          { href: '/dogs-on-beaches-greece/', label: 'Σκύλοι στην παραλία: τι λέει ο νόμος' },
        ],
      },
    },
  },
  {
    // The one beach question Greeks ask every summer that we had no answer for.
    // Deliberately NOT a per-beach verdict and NOT a per-region guide: open data
    // carries a `dog` tag for EIGHT beaches in the whole country (measured
    // 31/08/2026 across scripts/data/osm-beaches-national.json and
    // showers-osm-raw.json), and our own Search Console shows the `dogs` intent
    // at 2 queries / 3 impressions in 28 days. A guide promising dog-friendly
    // beaches we cannot identify is the same mistake the live-camera guide was
    // refused for (see the note above the 'sandy' intent).
    //
    // What we CAN state is the national rule, because it keys off `organized` —
    // a required boolean present on all 2.926 records — plus blueFlag2026. So
    // the page explains the law and points at filters, and says outright that we
    // do not publish a per-beach verdict and why.
    pathName: '/dogs-on-beaches-greece/',
    kind: 'info',
    locales: {
      en: {
        title: 'Dogs on Greek Beaches: What the Law Says | CalmBeach',
        description: 'Greek law 4830/2021 on dogs at the beach: what is allowed on unorganised, organised and Blue Flag beaches, and what local rules can change.',
        h1: 'Dogs on Greek beaches: what the law allows',
        intro: 'Greece has one national rule for dogs at the beach — article 19 of law 4830/2021 — and it turns on a single question: whether the beach is organised. This page explains that line in plain language, and where a municipality or port authority can still add its own restrictions.',
        trustNote: 'This page summarises national legislation as we read it. It is information, not legal advice, and it does not replace the signage at the beach: municipalities and port authorities issue their own local regulations, and the concession holder decides for the area it runs.',
        sections: [],
        faq: [
          {
            q: 'Can I take my dog to the beach in Greece?',
            a: 'On beaches that are not organised, yes. Article 19 of law 4830/2021 allows companion animals onto unorganised beaches, including into the sea. Out of the water the animal must be on a lead and under the supervision of the person responsible for it, who must also clean up after it. Organised beaches are the exception — see the next question.',
          },
          {
            q: 'What counts as an organised beach, and what changes there?',
            a: 'An organised beach is one run as a business or under a concession — sunbeds, umbrellas, a beach bar or a similar service. There, article 19 permits only assistance and therapy dogs as defined by the law, unless the operator has put up clearly visible signage allowing dogs. If there is no such sign, assume dogs are not admitted and ask the operator. More than half of the beaches recorded in CalmBeach are not marked as organised, so on most of the coast it is the first rule that applies.',
          },
          {
            q: 'Are dogs allowed on Blue Flag beaches?',
            a: 'No. Beaches awarded the Blue Flag do not admit dogs, with the exception of assistance dogs. That is a condition of the award itself, and it applies wherever the flag is flying, organised or not. In the CalmBeach app, Blue Flag beaches carry a badge on the beach card and you can filter for them.',
          },
          {
            q: 'Does my dog have to be on a lead?',
            a: 'Yes, out of the water. The law requires the animal to be on a lead and supervised while it is on land. In the sea itself, on an unorganised beach, the lead requirement does not apply — but the person responsible for the animal still is.',
          },
          {
            q: 'Can a municipality ban dogs from a beach anyway?',
            a: 'Yes. National law sets the baseline; municipal councils and port authorities can issue local regulations for particular beaches or particular hours, and those are binding. What the sign at the entrance says is what applies on the spot — if a sign contradicts this page, follow the sign.',
          },
          {
            q: 'Why does CalmBeach not mark each beach as dog-friendly?',
            a: 'Because we would be guessing. Open map data carries a dogs tag for only a handful of Greek beaches, and the rule also depends on signage and local decisions that change from one season to the next. What each beach page does state is whether that beach is recorded as organised, which is the question the law turns on. We would rather say that, and say it accurately, than publish a verdict for nearly three thousand beaches that we cannot stand behind.',
          },
          {
            q: 'Where does this come from?',
            a: 'Law 4830/2021 "New framework for the welfare of companion animals", article 19 (Government Gazette A′ 169/18.09.2021), and the award conditions of the Blue Flag programme, run in Greece by the Hellenic Society for the Protection of Nature. Local regulations are issued by each municipality and port authority; the beach itself is the only place they are always posted.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/beach-camping-greece/', label: 'Beaches with campsites nearby' },
          { href: '/faq/', label: 'CalmBeach FAQ' },
          { href: '/beach-guides/', label: 'All beach guides' },
        ],
      },
      el: {
        title: 'Σκύλοι στην παραλία: τι λέει ο νόμος | CalmBeach',
        description: 'Ν. 4830/2021, άρθρο 19: πού επιτρέπονται οι σκύλοι στην παραλία — μη οργανωμένες, οργανωμένες, Γαλάζια Σημαία — και τι αλλάζουν οι τοπικές διατάξεις.',
        h1: 'Σκύλοι στην παραλία: τι επιτρέπει ο νόμος',
        intro: 'Στην Ελλάδα ο κανόνας για τους σκύλους στην παραλία είναι ένας και εθνικός — το άρθρο 19 του ν. 4830/2021 — και κρέμεται από μία ερώτηση: αν η παραλία είναι οργανωμένη ή όχι. Εδώ εξηγούμε αυτή τη γραμμή σε απλά λόγια, και πού μπορεί ένας δήμος ή ένα λιμεναρχείο να βάλει δικούς του περιορισμούς.',
        trustNote: 'Η σελίδα συνοψίζει την εθνική νομοθεσία όπως τη διαβάζουμε εμείς. Είναι ενημέρωση, όχι νομική συμβουλή, και δεν αντικαθιστά τη σήμανση στην παραλία: δήμοι και λιμεναρχεία εκδίδουν δικές τους τοπικές κανονιστικές αποφάσεις, και για τον χώρο που εκμεταλλεύεται αποφασίζει ο υπεύθυνος λειτουργίας.',
        sections: [],
        faq: [
          {
            q: 'Μπορώ να πάω τον σκύλο μου στην παραλία;',
            a: 'Σε μη οργανωμένη παραλία, ναι. Το άρθρο 19 του ν. 4830/2021 επιτρέπει την πρόσβαση ζώων συντροφιάς σε μη οργανωμένες παραλίες, καθώς και μέσα στη θάλασσα. Εκτός θαλάσσης το ζώο πρέπει να είναι δεμένο με λουρί και υπό την επίβλεψη του υπευθύνου του, ο οποίος οφείλει και να μαζεύει τα περιττώματά του. Οι οργανωμένες παραλίες είναι η εξαίρεση — δες την επόμενη ερώτηση.',
          },
          {
            q: 'Τι θεωρείται οργανωμένη παραλία και τι αλλάζει εκεί;',
            a: 'Οργανωμένη είναι η παραλία που λειτουργεί ως επιχείρηση ή με παραχώρηση — ομπρέλες, ξαπλώστρες, beach bar ή αντίστοιχη υπηρεσία. Εκεί το άρθρο 19 επιτρέπει μόνο σκύλους βοηθείας και θεραπείας, όπως ορίζονται στον νόμο, ή εφόσον ο υπεύθυνος λειτουργίας έχει τοποθετήσει ευδιάκριτη ένδειξη που επιτρέπει τα ζώα. Αν δεν υπάρχει τέτοια ένδειξη, θεώρησε ότι δεν επιτρέπονται και ρώτησε τον υπεύθυνο. Πάνω από τις μισές παραλίες που καταγράφουμε δεν είναι σημειωμένες ως οργανωμένες, οπότε στο μεγαλύτερο μέρος της ακτής ισχύει ο πρώτος κανόνας.',
          },
          {
            q: 'Επιτρέπονται σκύλοι σε παραλίες με Γαλάζια Σημαία;',
            a: 'Όχι. Στις βραβευμένες με Γαλάζια Σημαία παραλίες δεν επιτρέπονται σκύλοι, με εξαίρεση τους σκύλους βοηθείας. Είναι όρος του ίδιου του βραβείου και ισχύει όσο κυματίζει η σημαία, οργανωμένη ή όχι η παραλία. Στην εφαρμογή CalmBeach οι παραλίες με Γαλάζια Σημαία έχουν σχετικό σήμα στην κάρτα τους και υπάρχει φίλτρο γι’ αυτές.',
          },
          {
            q: 'Χρειάζεται λουρί;',
            a: 'Ναι, εκτός θαλάσσης. Ο νόμος ζητά το ζώο να είναι δεμένο και υπό επίβλεψη όσο βρίσκεται στην ξηρά. Μέσα στη θάλασσα, σε μη οργανωμένη παραλία, δεν ισχύει η υποχρέωση του λουριού — η ευθύνη του συνοδού όμως ισχύει πάντα.',
          },
          {
            q: 'Μπορεί ένας δήμος να απαγορεύσει τους σκύλους σε μια παραλία;',
            a: 'Ναι. Ο εθνικός νόμος βάζει τη βάση· δημοτικά συμβούλια και λιμενικές αρχές μπορούν να εκδώσουν τοπικές κανονιστικές αποφάσεις ή λιμενικές διατάξεις για συγκεκριμένες παραλίες ή συγκεκριμένες ώρες, και αυτές είναι δεσμευτικές. Ό,τι γράφει η πινακίδα στην είσοδο είναι αυτό που ισχύει επί τόπου· αν η πινακίδα λέει άλλα από αυτή τη σελίδα, ακολούθησε την πινακίδα.',
          },
          {
            q: 'Γιατί το CalmBeach δεν σημειώνει κάθε παραλία ως φιλική σε σκύλους;',
            a: 'Γιατί θα μαντεύαμε. Τα ανοιχτά δεδομένα χαρτών έχουν σχετική ένδειξη για ελάχιστες ελληνικές παραλίες, και ο κανόνας εξαρτάται επιπλέον από τη σήμανση και από τοπικές αποφάσεις που αλλάζουν από σεζόν σε σεζόν. Αυτό που γράφει η σελίδα κάθε παραλίας είναι αν είναι καταγεγραμμένη ως οργανωμένη — δηλαδή ακριβώς η ερώτηση από την οποία κρέμεται ο νόμος. Προτιμούμε να λέμε αυτό, και να το λέμε σωστά, παρά να δημοσιεύσουμε ετυμηγορία για σχεδόν τρεις χιλιάδες παραλίες που δεν μπορούμε να στηρίξουμε.',
          },
          {
            q: 'Από πού προκύπτουν όλα αυτά;',
            a: 'Από τον ν. 4830/2021 «Νέο πλαίσιο για την ευζωία των ζώων συντροφιάς», άρθρο 19 (ΦΕΚ Α′ 169/18.09.2021), και από τους όρους του βραβείου Γαλάζια Σημαία, που στην Ελλάδα το τρέχει η Ελληνική Εταιρία Προστασίας της Φύσης. Τις τοπικές κανονιστικές τις εκδίδει ο κάθε δήμος και το κατά τόπον λιμεναρχείο· η ίδια η παραλία είναι το μόνο μέρος όπου είναι πάντα αναρτημένες.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach' },
          { href: '/beach-camping-greece/', label: 'Παραλίες με camping κοντά' },
          { href: '/faq/', label: 'Συχνές ερωτήσεις' },
          { href: '/beach-guides/', label: 'Όλοι οι οδηγοί παραλιών' },
        ],
      },
    },
  },
  {
    // Top-of-funnel editorial guide (EN). kind 'info' → no dynamic beach block; pure
    // long-form. Copy is hedged by design (orientation, not a forecast; check before
    // you go) so it never hand-writes a per-beach "calm" claim. Written to earn links
    // on our un-copyable wind/shelter angle; internally linked to the sibling guides.
    pathName: '/where-to-swim-in-greece-when-the-meltemi-blows/',
    kind: 'info',
    locales: {
      en: {
        title: 'Where to Swim in Greece When the Meltemi Blows | CalmBeach',
        description: 'The Meltemi can ruin a Greek beach day — or barely touch you, if you know which side of the island to pick. A practical, wind-first guide.',
        h1: 'Where to Swim in Greece When the Meltemi Blows',
        intro: `You've planned the perfect beach day, driven forty minutes to a photo you saved months ago, and arrived to find whitecaps, a wall of wind, and sand blasting your legs. The beach isn't broken — it's just facing the wrong way today. The single skill that separates a great Greek summer from a frustrating one isn't finding beautiful beaches; it's knowing which beautiful beach will be sheltered on the day you actually go.`,
        sections: [
          { heading: 'What the Meltemi actually is', body: `The Meltemi is a strong, dry northerly wind that dominates the Aegean through high summer, typically strongest from mid-July through August. It generally blows from the north or northeast, and it can arrive under a completely clear blue sky — which is exactly why it catches visitors out. There's no storm to warn you: the forecast says "sunny", you head to the coast, and the water is churning. Its strength varies enormously day to day — a pleasant breeze on a calm spell, hard enough on a peak day to close ferry routes and flatten umbrellas. And because it funnels and accelerates between islands, two beaches an hour apart can have completely different conditions at the same moment. The core insight is simple: the Meltemi is directional and local, so shelter is something you find, not something you hope for.` },
          { heading: 'Why wind — not waves — makes or breaks the day', body: `People instinctively check for big waves, but on most Greek beaches the waves are a symptom; the cause is wind, and it affects your swim three ways at once. First, chop: onshore wind pushes surface water toward the shore and builds short, messy waves that make swimming tiring and snorkelling pointless. Second, comfort: even out of the water, a stiff onshore wind means blowing sand, umbrellas that won't stay up, and a towel that becomes a kite. Third, clarity: churned-up water near the shoreline goes cloudy, which matters if you came for fish or that famous turquoise colour. A sheltered beach gives you the opposite on all three counts — but "sheltered" is never a permanent property of a place. It depends entirely on where the wind comes from that day relative to how the beach faces.` },
          { heading: 'The one idea that fixes everything: the lee side', body: `Carry this mental model for your whole trip. When wind hits an island, headland, or hill, the far side — the side facing away from the wind — sits in the "lee": the land blocks and calms the air, and the water there tends to be far more protected. So during a classic northerly Meltemi, south- and southeast-facing shores are often on the sheltered lee side; north- and northeast-facing shores take the wind head-on and tend to be exposed; and bays, coves and beaches tucked behind a headland or cliff get extra protection because the landform breaks the wind before it reaches the water. This is why locals seem to magically know where to go — they're not consulting a list of good beaches, they're reading the wind direction and picking the opposite coast. A beach that's glorious in a north wind can be unusable in a rare south wind, and vice versa. Orientation is the lens; wind direction is what you point it at.` },
          { heading: 'How to read an island before you go', body: `You can plan a surprising amount just by looking at a map with wind in mind. Note the island's shape: a long island oriented north–south has a clear windward coast and a clear sheltered coast in a northerly, while a rounder island or one with deep bays gives you more options because some cove will usually be tucked out of the wind. Islands with tall interior mountains — the bigger Cyclades or the Dodecanese — cast large wind shadows over their leeward beaches. Then check the specific beach's exposure: a wide-open beach facing straight into open sea has nothing to hide behind, while a beach at the back of a bay, or one with a headland to its north, has built-in shelter. On a windy Meltemi day, "small, tucked-in and facing south" beats "famous, wide and facing north" almost every time, regardless of reputation.` },
          { heading: 'Building a flexible beach plan', body: `The traveller's mistake is committing to one beach in advance. The fix is to plan by region and choose the exact beach on the morning of, once you can see the wind. Shortlist three or four beaches on different-facing coasts of your island — ideally one facing roughly south, one east, one west — then let the wind pick for you: a strong northerly means head south; a rare southerly means the northern coves come into play. With the shortlist ready, a windy forecast becomes a simple reroute instead of a ruined day. This is also the honest limit of any static guide, including this one: no article can promise a named beach will be calm on your specific date, because it depends on that day's wind. What you can do is check the live conditions.` },
          { heading: 'Where live data comes in', body: `This is exactly the gap CalmBeach is built to fill. Rather than guessing from a general forecast, you can look up a specific beach and a specific date and see how sheltered it's modelled to be — because the site combines live wind and wave data with each beach's real orientation and the surrounding coastline. It's the difference between "the wind is northerly today" and "this cove, facing this way, behind that headland, is likely to be in the lee right now". Use the wind knowledge above to build your shortlist, then use the live model to choose the winner on the day.` },
          { heading: 'Before you go', body: `The Meltemi doesn't have to dictate your holiday — it just has to be respected. Learn the lee-side rule, plan by region instead of by single beach, and let the wind choose the coast on the day. Then don't guess: check the live wind and waves for your specific beach and date on CalmBeach before you set off — it's the difference between a saved photo and a great swim.` },
        ],
        faq: [
          { q: 'When is the Meltemi strongest?', a: `It's typically most persistent and strongest from mid-July through August, though it can appear across the wider summer season. Strength varies day to day, so a windy week can still contain calmer mornings.` },
          { q: 'Is it ever too windy to swim safely?', a: `It can be. Strong onshore wind, visible whitecaps and choppy water are signs to be cautious or pick a sheltered coast instead. Always judge conditions on arrival and don't swim where the water looks rough or there are strong currents.` },
          { q: 'Are mornings calmer than afternoons?', a: `Often, yes — the Meltemi frequently builds through the day and eases overnight, so early swims can be noticeably calmer. But this is a tendency, not a rule, so it's still worth checking.` },
          { q: 'Which coast should I aim for in a northerly wind?', a: `Generally the south- or southeast-facing shores, and beaches tucked behind a headland. They tend to sit in the sheltered lee while north-facing beaches take the wind directly.` },
          { q: 'Do all Greek islands get the Meltemi?', a: `It's an Aegean phenomenon, so the Cyclades and Dodecanese feel it most. The Ionian islands, on Greece's west side, have a different wind pattern entirely.` },
          { q: 'Can an app tell me if a beach will be calm?', a: `It can tell you how sheltered a beach is modelled to be for a given day using live wind and orientation — the useful, honest version of the question. Actual conditions always need a final look on arrival.` },
        ],
        links: [
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/best-sheltered-beaches-cyclades/', label: 'Sheltered beaches in the Cyclades' },
          { href: '/calm-family-friendly-beaches-greece/', label: 'Calm, family-friendly beaches' },
          { href: '/best-snorkeling-beaches-greece/', label: 'Best snorkelling beaches in Greece' },
          { href: '/sunset-beaches-greece-open-sea/', label: 'Sunset beaches that face the open sea' },
        ],
      },
    },
  },
  {
    pathName: '/best-sheltered-beaches-cyclades/',
    kind: 'info',
    locales: {
      en: {
        title: 'Best Sheltered Beaches in the Cyclades | CalmBeach',
        description: `The Cyclades sit right in the Meltemi's path. How to read each island's shape and wind to find a sheltered swim — whatever the day throws at you.`,
        h1: 'Best Sheltered Beaches in the Cyclades (and How to Choose by Wind)',
        intro: `The Cyclades are what most people picture when they imagine Greece — white villages, deep blue water, that impossible light. They're also planted directly in the path of the Meltemi, the strong northerly summer wind. The result is a paradox every visitor eventually meets: the most famous beaches can be the windiest, and the perfect swim is often a short drive away on a coast nobody photographed. This guide is about reading that wind instead of fighting it.`,
        sections: [
          { heading: 'Why the Cyclades feel windier than the rest of Greece', body: `The Cyclades sit in the central Aegean, the corridor the Meltemi funnels straight through in high summer. Because the islands are scattered close together, the wind accelerates in the gaps between them — the same effect as air speeding up through a narrowing valley — which is why conditions can differ sharply between two islands you can see across the water from each other, and even between two coasts of the same island. The practical upshot is liberating rather than discouraging: on almost any Cycladic island, on almost any day, some coast is sheltered. The job isn't to find "the calm island"; it's to find the lee side of the island you're on, on the day you're there.` },
          { heading: 'The lee-side rule, applied to the Cyclades', body: `When a northerly Meltemi hits an island, the land itself becomes a windbreak, and the side facing away from the wind — the lee — is where the air calms and the water tends to settle. As a working rule for a classic northerly: south- and southeast-facing coasts are often the sheltered side; north- and northwest-facing coasts take the wind head-on and tend to be exposed and choppy; and beaches tucked behind a headland, or at the back of a deep bay, get extra protection because the landform breaks the wind before it reaches the water. None of this makes any named beach permanently calm — a rare southerly flips the whole picture, and the sheltered coast becomes the exposed one. Orientation is the lens; the day's wind direction is what you point it at.` },
          { heading: `Island by island: how each one's shape behaves in the Meltemi`, body: `Think about each island's silhouette rather than its beach rankings. Naxos and Paros are large, with tall interior mountains that cast long wind shadows; in a northerly, their western and southwestern coasts often sit in the lee of the high ground, while the exposed northern shores are better known to windsurfers than to anyone hoping for a still swim. Mykonos is lower and rounder, so it offers less of a mountain shadow, but its scalloped coastline of small coves means there's usually a bay facing away from the wind on any given day — the trick is picking the cove by orientation, not name recognition. Milos is a geological oddity: a huge, near-enclosed bay bitten into its north coast plus a wildly indented shoreline, creating many pockets that face different directions, which is why locals hop coasts depending on the wind. Ios, Sifnos, Serifos and the smaller islands each have a windward and a leeward side that flips with the wind direction, so the south-facing bays are the natural place to look first in a northerly. Santorini is a special case: the caldera side is a cliff, not a swimming coast, and most beaches sit on the outer south and east shores, so exposure depends heavily on the specific bay and rewards checking rather than assuming. The pattern across all of them is the same — bigger islands with mountains give you wind shadows, indented islands give you coves, and either way you're choosing a coast, not a beach.` },
          { heading: 'What "sheltered" does and doesn\'t mean', body: `It's worth being precise, because the word gets over-promised. A sheltered beach means the wind and the chop it produces are reduced — calmer surface water, less blowing sand, clearer water near the shore, umbrellas that stay upright. It does not mean guaranteed flat, glassy water every hour of the day. Shelter is relative and live: it shifts with wind direction, wind strength and time of day, and the same cove can be a millpond at 9am and rippling by 3pm as the Meltemi builds. That's not a flaw in the beach — it's the nature of wind, and it's exactly why a static "best sheltered beaches" list can never be the whole answer.` },
          { heading: 'How to actually choose, on the day', body: `Here's the method that turns all of this into a plan. The night before, note the forecast wind direction, not just the speed. Then shortlist three or four beaches on differently-facing coasts of your island — ideally one facing roughly south, one east, one west. In the morning, let the wind pick the winner: a strong northerly sends you to the southern coves; a rare southerly opens up the north. This "plan by region, choose by wind" habit is the single biggest upgrade to a Cyclades beach trip — it turns a windy forecast from a ruined day into a five-minute reroute, because you were never committed to one beach in the first place.` },
          { heading: 'Where the live model comes in', body: `This is the exact problem CalmBeach is built for. Instead of guessing from a general island forecast, you can look up a specific Cycladic beach on a specific date and see how sheltered it's modelled to be — because the site combines live wind and wave data with each beach's real orientation and the coastline around it. That's the difference between knowing "the Meltemi is northerly today" and knowing "this south-facing cove, behind that headland, is likely in the lee right now". Use the island shapes above to build your shortlist; use the live model to choose the winner.` },
          { heading: 'Before you go', body: `The Cyclades reward travellers who think in coasts and wind, not in beach rankings. Learn the lee-side rule, read your island's shape, keep a shortlist facing different directions, and let the day's wind choose. Then don't guess: check the live wind and waves for your specific Cycladic beach and date on CalmBeach before you set off — the sheltered coast is only sheltered until the wind turns.` },
        ],
        faq: [
          { q: 'Which Cyclades island is the most sheltered?', a: `There isn't one — sheltered is a property of a coast on a given day, not an island. Larger islands with mountains (like Naxos and Paros) simply give you more sheltered options to reroute to.` },
          { q: 'Which coast should I aim for in a Meltemi?', a: `Usually the south- or southeast-facing coasts, plus beaches tucked behind a headland or at the back of a deep bay. North-facing beaches take the wind directly.` },
          { q: 'When is the Meltemi worst in the Cyclades?', a: `It's typically most persistent from mid-July through August, though it can appear across the wider summer. Strength varies day to day, so even a windy week has calmer windows.` },
          { q: 'Are the famous beaches the windiest?', a: `Sometimes, yes — several well-known Cycladic beaches face open water or north, which is great for windsurfing and harder for a still swim. Fame and shelter are unrelated.` },
          { q: 'Can I still find a good swim on a very windy day?', a: `Usually. The scattered, indented Cycladic coastlines almost always leave some cove in the lee. The task is finding it, not hoping the whole island calms down.` },
          { q: 'Do the Cyclades get the Meltemi more than other islands?', a: `Yes — sitting in the central Aegean corridor, they feel it more than most, and far more than the Ionian islands on Greece's west side.` },
        ],
        links: [
          { href: '/where-to-swim-in-greece-when-the-meltemi-blows/', label: 'Where to swim when the Meltemi blows' },
          { href: '/sheltered-beaches-meltemi/', label: 'Sheltered beaches across Greece' },
          { href: '/beaches/naxos/', label: 'Browse Naxos beaches' },
          { href: '/beaches/paros/', label: 'Browse Paros beaches' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
        ],
      },
    },
  },
  {
    pathName: '/calm-family-friendly-beaches-greece/',
    kind: 'info',
    locales: {
      en: {
        title: 'Family-Friendly Beaches in Greece: A Wind Guide | CalmBeach',
        description: 'Shallow water, gentle entry and shade matter for kids — but wind decides the day. A practical, honest guide to choosing a calmer family beach in Greece.',
        h1: 'Calm, Family-Friendly Beaches in Greece: How to Pick One',
        intro: `Choosing a beach with children is a different problem to choosing one for yourself. You're not chasing the most dramatic scenery — you're after gentle water, an easy walk in, some shade, and no nasty surprises when you arrive with a car full of tired kids. The frustrating part is that a beach can tick every box on paper and still be unusable on the day, because of one factor most guides skip: the wind. This guide shows you what to look for, and how to think about the thing that actually makes or breaks a family beach day.`,
        sections: [
          { heading: 'What families actually need from a beach', body: `Before wind, get the fundamentals right, because these properties don't change day to day. Look for a gentle, shallow gradient — water that stays shallow a long way out, so small children can paddle without a sudden drop-off. Look for soft sand rather than pebbles or rocks for little feet and inevitable tumbles. Look for shade, whether natural (tamarisk trees) or organised (loungers and umbrellas), because the midday Greek sun is fierce and toddlers overheat fast. And look for facilities within reach — toilets, a taverna, easy parking, a short flat walk from car to sand rather than a goat track down a cliff. These are real, stable filters and worth applying first — but none of them matters if the water is churning when you get there.` },
          { heading: 'Why wind is the hidden variable for families', body: `For a family, wind is more consequential than it is for a solo swimmer, and in more ways. Onshore wind builds short, messy chop — small waves that are no threat to an adult but genuinely knock a small child off their feet and frighten them out of the water. It also drags cloudy, churned-up water across the shallows, so you lose the clear, see-the-bottom paddling that makes kids feel safe. On land, a stiff onshore wind means sand blasting into faces, snacks and eyes, umbrellas that won't hold, and a picnic that becomes a battle. And wind is why a beach can be idyllic in the brochure and miserable at 2pm — nothing about the sand or facilities changed; the wind simply turned onshore. So the honest version of "is this a good family beach?" is really two questions: does it have the right features, and will it be sheltered on the day and time we go? The first is fixed; the second changes.` },
          { heading: 'The lee-side rule, for parents', body: `Here's the single idea that helps most. When the summer Meltemi — the strong northerly Aegean wind — hits an island or headland, the far side sits in the lee, where the land blocks the wind and the water tends to settle. For families in a classic northerly, that means south- and southeast-facing beaches are often the more sheltered choice; beaches at the back of a deep bay, or tucked behind a headland, get extra protection, and bays also tend to have the gentle, gradually-deepening water families want; while wide, open, north-facing beaches — however beautiful — take the wind head-on and are more likely to be choppy and gusty. A useful bonus: the enclosed bays that shelter you from wind are frequently the same ones with calmer gradients and less swell, exactly the geography a family swim wants. Just remember it's never permanent — a rare southerly flips which coast is sheltered.` },
          { heading: 'Reading a beach before you commit', body: `You can screen a lot of this from a map and a couple of photos. A beach set deep inside a bay, with land wrapping around it, has built-in wind protection and usually gentler water than an exposed strand facing open sea. Check which way it faces relative to north, and look for a headland or hill on its windward side that could act as a shield. Look at the shoreline in photos, too — a beach where people are standing far out in shallow water is telling you about its gradient, which matters as much as anything for young children. On a windy Meltemi day, the honest trade is often "small, shallow, tucked-in bay facing south" over "famous wide beach facing north", even when the famous one has the better reputation. Reputation doesn't shelter you from wind.` },
          { heading: 'Build a shortlist, not a fixed plan', body: `The mistake parents make is promising the kids one specific beach the night before; if the wind turns, you're committed to a bad day or a meltdown-inducing change of plan. Instead, plan by area and keep a shortlist of three or four family-suitable beaches on differently-facing coasts — ideally one facing roughly south, one east, one west. Then let the morning's wind choose: a strong northerly sends you to the sheltered southern bays, a calm day opens everything up. With a shortlist ready, a windy forecast becomes a simple reroute rather than a ruined outing — and you can promise the kids "a beach", not gamble on a specific one.` },
          { heading: 'Safety first, every time', body: `A few non-negotiables that no beach feature guarantees. Always judge conditions on arrival — if the water looks rough, choppy, or there's visible whitecapping, choose a sheltered coast or come back another time. Never rely on a beach being calm just because it usually is; the wind decides. Watch for currents and sudden depth changes, keep young children within arm's reach, and prefer beaches with lifeguards where you can find them (they're not universal in Greece). Mornings are often — not always — calmer than afternoons, so early trips can be a smart default with kids.` },
          { heading: 'Where live conditions come in', body: `This is precisely the gap CalmBeach is built to close. Rather than gambling on a general forecast, you can look up a specific beach and a specific date and see how sheltered it's modelled to be — because the site combines live wind and wave data with each beach's real orientation and surrounding coastline. For a family, that turns "I hope it's calm" into a genuinely useful check: is this south-facing bay, behind that headland, likely to be in the lee at the time we're going? Use the family filters above to build your shortlist; use the live model to pick the day's winner.` },
          { heading: 'Before you go', body: `A great family beach day is mostly about matching the right features to the right coast for that day's wind. Get the fundamentals right — shallow, sandy, shaded, easy access — then keep a shortlist facing different directions and let the wind choose. Then don't guess: check the live wind and waves for your specific beach and date on CalmBeach before you set off — with kids in the car, a five-minute check beats a two-hour drive to a windy shore.` },
        ],
        faq: [
          { q: 'Which is the best family beach in Greece?', a: `There's no single answer, because the best one depends on the day's wind as much as its features. Aim for a sheltered, shallow, bay-type beach on a coast facing away from the wind, and confirm conditions before you go.` },
          { q: 'How do I know if a beach will be calm for the kids?', a: `You can't know it statically — calmness changes daily with the wind. You can check the live, modelled shelter for a specific beach and date, then make the final call on arrival.` },
          { q: 'Are mornings better with children?', a: `Often, yes. The Meltemi frequently builds through the day, so morning water tends to be calmer — a sensible default for young kids, though not a guarantee.` },
          { q: 'Sandy or pebbly for families?', a: `Soft sand is usually kinder for small feet and falls, and shallow sandy bays tend to have the gentle gradient toddlers need. Pebbles can mean cooler, clearer water but trickier footing.` },
          { q: 'Do Greek beaches have lifeguards?', a: `Some organised beaches do, but many don't. Never assume one is present — supervise children closely and judge the water yourself.` },
          { q: 'Which coast is calmer for families in summer?', a: `In a typical northerly Meltemi, south- and southeast-facing bays and beaches behind headlands tend to be the more sheltered choice for a family swim.` },
        ],
        links: [
          { href: '/family-beaches-greece/', label: 'Family beaches with calmer water' },
          { href: '/where-to-swim-in-greece-when-the-meltemi-blows/', label: 'Where to swim when the Meltemi blows' },
          { href: '/best-sheltered-beaches-cyclades/', label: 'Sheltered beaches in the Cyclades' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
        ],
      },
    },
  },
  {
    pathName: '/best-snorkeling-beaches-greece/',
    kind: 'info',
    locales: {
      en: {
        title: 'Best Snorkelling Beaches in Greece: A Wind Guide | CalmBeach',
        description: 'Clear water is everything for snorkelling — and wind is what clouds it. How to read orientation and shelter to find the calm, clear water fish need.',
        h1: 'Best Snorkelling Beaches in Greece (and Why Calm Water Matters)',
        intro: `Greece should be a snorkeller's dream: warm, clear, calm seas full of rocky coves, seagrass meadows and little fish. And it often is — right up until the wind turns onshore and the water you drove to see goes cloudy, choppy and blank. For snorkelling more than any other beach activity, the difference between a magical hour and a wasted trip comes down to one variable most guides ignore: how sheltered the water is on the day you go. This guide is about finding that clear, settled water on purpose.`,
        sections: [
          { heading: 'Why calm water is non-negotiable for snorkelling', body: `Snorkelling asks more of the sea than swimming does. Visibility is everything, and wind destroys it: when onshore wind builds chop, it stirs up sand and sediment in the shallows — precisely where you snorkel — and turns clear water milky, so you can be floating over a beautiful rocky reef and see almost nothing. Chop makes the mechanics miserable, too — waves slap over your snorkel, water gets in your mask, and you spend the whole time fighting the surface instead of watching the bottom. And surge, the back-and-forth push of water near rocks in a swell, bumps you into things and makes it hard to hold position over anything interesting. Calm, sheltered water fixes all three at once: clear visibility, an easy surface to breathe through, and stable position over the reef. That's why "where can I snorkel in Greece?" is really the question "where will the water be calm and clear on my date?"` },
          { heading: `What makes good snorkelling terrain (the part that doesn't change)`, body: `Separate the fixed features from the daily conditions. Look for rocky or mixed rock-and-sand shorelines rather than long flat sandy beaches — rocks and boulders give fish somewhere to live, so there's actually something to see. Look for seagrass (Posidonia) meadows, the underwater fields that shelter marine life and signal a healthy spot. Look for structure — headlands, submerged rocks, small caves and drop-offs concentrate fish. And look for entry points: a beach where you can wade in over sand and swim out to rocks is easier and safer than clambering over slippery boulders. Rocky coves and the edges of bays, where sand meets rock, are classic Greek snorkelling terrain — but even the best terrain is useless in churned-up water, which is where wind comes back in.` },
          { heading: 'The lee-side rule, for clear water', body: `When the summer Meltemi — the strong northerly Aegean wind — hits an island or headland, the sheltered lee side sits out of the wind, and the water there tends to stay settled and clear. For snorkelling in a typical northerly: south- and southeast-facing coves are often the more sheltered, clearer choice; water tucked behind a headland or inside a deep bay stays calmer and clearer because the land breaks the wind and the chop before it reaches you; and north- and northwest-facing shores take the wind head-on — great for windsurfers, poor for visibility. The happy overlap for snorkellers is that sheltered rocky coves often combine the two things you want, interesting terrain and protection from the chop that would otherwise cloud it. Just remember shelter is never permanent — a rare southerly flips which coast is clear.` },
          { heading: 'How to pick a snorkelling spot before you go', body: `You can screen most of this from a map, satellite view and a few photos. On satellite imagery, darker patches offshore in otherwise pale, sandy shallows usually mean rock or seagrass — the structure fish like. Check which way the cove faces relative to north, and whether a headland sits on its windward side to act as a shield. And favour smaller, enclosed coves over wide open beaches: they shelter faster, cloud less, and concentrate marine life along their rocky edges. On a windy Meltemi day, the honest choice for a snorkeller is almost always "small, rocky, tucked-in cove facing south" over "famous wide beach facing open sea" — because clarity beats fame every single time underwater.` },
          { heading: 'Timing and technique for the clearest water', body: `Two habits noticeably improve your odds. Go early: the Meltemi frequently builds through the day and eases overnight, so morning water is often calmer and clearer before the wind has had time to stir the shallows — an early snorkel is one of the best simple tricks there is. And give the sea time to settle after a windy spell: even once the wind drops, it can take a while for stirred-up sediment to clear and visibility to return, so a calm morning after a windy afternoon is often better than the windy afternoon itself. None of this is a guarantee — no static list can promise a named cove will be clear on your date, because clarity follows the wind. What you can do is check.` },
          { heading: 'Where the live model comes in', body: `This is exactly what CalmBeach is built for. Instead of guessing from a general forecast, you can look up a specific beach on a specific date and see how sheltered it's modelled to be — because the site combines live wind and wave data with each beach's real orientation and the coastline around it. For a snorkeller, shelter is a strong proxy for clarity: a cove modelled as well-sheltered for your date is far more likely to give you the settled, see-the-bottom water you came for. Use the terrain features above to shortlist rocky, structured coves; use the live model to pick the one likely to be clear on the day.` },
          { heading: 'Before you go', body: `Great snorkelling in Greece is the overlap of two things: the right terrain — rocky, structured, seagrass-rich coves — and calm, sheltered water on the day. Screen for the terrain from a map, then let the wind choose which sheltered cove wins. Then don't guess: check the live wind and waves for your specific beach and date on CalmBeach before you set off — clear water is worth a five-minute check.` },
        ],
        faq: [
          { q: 'Where is the best snorkelling in Greece?', a: `There's no single best spot, because visibility depends on the day's wind as much as the terrain. Look for sheltered rocky coves with seagrass, on a coast facing away from the wind, and confirm conditions before you go.` },
          { q: 'Why does the water look cloudy when I snorkel?', a: `Almost always wind. Onshore chop stirs sediment in the shallows and clouds the water. A sheltered, lee-side cove — or an early start before the wind builds — usually means clearer visibility.` },
          { q: 'Are mornings better for snorkelling?', a: `Often, yes. The Meltemi tends to build through the day, so morning water is frequently calmer and clearer. It's a tendency, not a rule, so it's still worth checking.` },
          { q: 'Rocky or sandy beaches for snorkelling?', a: `Rocky or mixed shorelines almost always beat plain sandy beaches — rocks and seagrass give marine life somewhere to live, so there's more to see. Sandy stretches tend to be empty underwater.` },
          { q: 'Should I snorkel right after a windy day?', a: `It's often worth waiting. Even once the wind eases, stirred-up sediment can take time to settle, so visibility may still be poor. A calm morning after a windy spell is usually the sweet spot.` },
          { q: 'How do I know a cove will be clear on my date?', a: `You can't know it statically — clarity follows the wind and changes daily. You can check the live, modelled shelter for a specific beach and date, then confirm on arrival.` },
        ],
        links: [
          { href: '/where-to-swim-in-greece-when-the-meltemi-blows/', label: 'Where to swim when the Meltemi blows' },
          { href: '/best-sheltered-beaches-cyclades/', label: 'Sheltered beaches in the Cyclades' },
          { href: '/snorkeling-beaches/syros/', label: 'Snorkelling beaches on Syros' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/faq/', label: 'How CalmBeach works (FAQ)' },
        ],
      },
    },
  },
  {
    pathName: '/sunset-beaches-greece-open-sea/',
    kind: 'info',
    locales: {
      en: {
        title: 'Sunset Beaches in Greece That Face the Open Sea | CalmBeach',
        description: 'West-facing sunset beaches catch the light — and often the wind. How to plan a Greek sunset swim around the Meltemi instead of being surprised by it.',
        h1: 'Sunset Beaches in Greece That Face the Open Sea',
        intro: `There's a particular kind of magic to a Greek sunset seen from the water: the sky goes molten, the sea turns to liquid metal, and for a few minutes everything is perfect. To get it, you need a beach facing west, out over open sea. But here's the catch nobody mentions — the same open, west-facing orientation that gives you the horizon and the light can also leave a beach exposed to the wind. This guide is about chasing that sunset without getting caught out, by understanding how the light and the wind interact.`,
        sections: [
          { heading: 'Why sunset beaches face a specific way', body: `The requirement is simple and non-negotiable: to watch the sun drop into the sea, the beach has to face roughly west or northwest, with an open horizon and no land in the way. East-facing beaches get sunrise; a beach hemmed in by a headland to its west gets a sunset hidden behind rock. So sunset chasers are, by definition, drawn to the open western coasts of islands. That's lovely for the view — but it sets up a tension with everything the wind logic teaches, because "open and west-facing" is often the opposite of "sheltered".` },
          { heading: 'The honest tension: open sea vs. shelter', body: `The advice for a calm swim in a northerly Meltemi is to seek the sheltered lee — usually the south- and southeast-facing coasts tucked behind land. Sunset beaches pull you the other way, toward open west-facing shores, and those two goals don't always align. Depending on the exact wind direction on the day, a west-facing beach may be fairly sheltered — if the wind is coming from the north or northeast, a due-west-facing beach can sit at an angle to it and stay reasonably calm — or exposed, if the wind has any westerly component or wraps around the coast, so that open horizon means open water and chop rolling straight in. A sunset beach isn't automatically windy, then, but it's more exposed to the possibility of wind than a tucked-away southern cove. The skill is reading which kind of evening you're getting.` },
          { heading: 'How the Meltemi behaves at sunset', body: `Here's the good news for sunset chasers, and it's genuinely useful: the Meltemi very often builds through the afternoon and eases in the evening and overnight. That means the wind that made a west-facing beach choppy at 3pm has frequently softened by the time the sun is actually setting, so the classic frustrating midday beach can become a calm, glowing evening one. A west-facing sunset swim is frequently more comfortable than a west-facing midday swim on the same day, precisely because of how the wind fades. That said, "often" isn't "always": some evenings stay breezy, and a westerly wind won't ease just because the sun is going down. It's a tendency to plan around, not a promise.` },
          { heading: 'Choosing a sunset beach that is not a wind trap', body: `You can stack the odds by reading the coastline, not just the compass. Favour a west-facing beach that still has some side protection — a headland or hill to its north can block a northerly Meltemi while leaving the western horizon open for the sunset. That combination, open to the west but shielded to the north, is the sweet spot: you keep the view and lose some of the wind. Be more cautious with wide, fully-open west-facing beaches with no land nearby in any direction — they give the most dramatic, unobstructed horizon and the least shelter if the wind has any westerly angle, glorious on a calm evening and rough on a windy one, so exactly the kind of beach to check before committing to the drive. And think about what you actually want from the evening: if it's a sunset swim, shelter matters and you'll want calmer water; if it's a sunset view with your feet in the sand and a drink in hand, a bit of evening breeze is often no problem at all, and can even be pleasant after a hot day.` },
          { heading: 'Reading the island for a sunset', body: `A quick map habit helps enormously. Islands generally have their sunset action on their western and northwestern coasts — that's where to point your search. Note which of those west-facing beaches have a headland to the north for a bit of Meltemi shelter, and which are wide open. Long north–south islands tend to have a clear western sunset coast; rounder or indented islands may offer a west-facing cove that combines the view with some tuck-in protection. On a windy day, the honest move is to favour the west-facing cove with a sheltering headland over the wide-open west-facing strand — you'll still get the sunset, with a calmer evening around it.` },
          { heading: 'Timing your evening', body: `Two practical habits. Arrive with time in hand, before the sun is low, so you can see the actual conditions and still reroute to a nearby alternative if your first choice is blowing — a shortlist of two or three west-facing options on the same coast turns a windy surprise into an easy switch. And lean into the evening softening: if the day has been windy, don't write off a west-facing swim, because the wind often eases as sunset approaches and the beach that was unusable at 3pm may be calm and golden by 8pm. Checking the forecast trend through the evening, not just a single midday reading, is what separates a planned sunset from a lucky one.` },
          { heading: 'Where the live model comes in', body: `This is exactly the kind of judgement CalmBeach is built to support. Rather than guessing whether your west-facing sunset beach will be exposed, you can look up a specific beach on a specific date and see how sheltered it's modelled to be — because the site combines live wind and wave data with each beach's real orientation and surrounding coastline. For a sunset swim, that lets you check the evening specifically: is this west-facing cove, with that headland to the north, likely to be settled by the time the sun sets? Use the coastline logic above to shortlist your sunset spots; use the live model to check the evening conditions before you drive out.` },
          { heading: 'Before you go', body: `A great Greek sunset beach is a balance: open enough to the west for the light, sheltered enough from the north for comfort. Favour west-facing spots with side protection, lean on the evening softening of the Meltemi, and keep a couple of alternatives ready. Then don't guess: check the live wind and waves for your specific beach and date on CalmBeach before you set off — a five-minute check is what turns a hoped-for sunset into a perfect one.` },
        ],
        faq: [
          { q: 'Why do sunset beaches face west?', a: `To watch the sun set into the sea you need an open horizon to the west or northwest, with no land in the way. That orientation is what gives you the light — and also what can leave a beach open to the wind.` },
          { q: 'Are west-facing sunset beaches always windy?', a: `No — it depends on the day's wind direction. A northerly Meltemi may leave a due-west beach reasonably calm, while any westerly component makes it more exposed. It varies, so it's worth checking.` },
          { q: 'Is sunset a calmer time to swim?', a: `Often. The Meltemi frequently builds through the afternoon and eases in the evening, so a west-facing beach that was choppy at midday can settle by sunset. It's a strong tendency, not a guarantee.` },
          { q: 'How do I get the view and calmer water?', a: `Look for a west-facing beach with a headland or hill to its north — open to the west for the sunset, shielded from a northerly wind. That combination is the sweet spot.` },
          { q: 'View or swim — does it change what I should pick?', a: `Yes. For a sunset swim you'll want more shelter and calmer water. For a sunset view from the sand, a light evening breeze is usually no problem and can be pleasant.` },
          { q: 'How do I know if my sunset beach will be exposed?', a: `You can't know it statically — it depends on that evening's wind. You can check the live, modelled shelter for a specific beach and date and time, then confirm on arrival.` },
        ],
        links: [
          { href: '/where-to-swim-in-greece-when-the-meltemi-blows/', label: 'Where to swim when the Meltemi blows' },
          { href: '/best-sheltered-beaches-cyclades/', label: 'Sheltered beaches in the Cyclades' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/faq/', label: 'How CalmBeach works (FAQ)' },
        ],
      },
    },
  },
];

// Programmatic per-island intent pages. Each (island × intent) page is generated
// ONLY when the island has at least ISLAND_INTENT_MIN matching beaches, so we
// never ship near-empty doorway pages. Copy is islandName-specific and the beach
// list is real, so each page is distinct from the national guide and from one
// another. `match` uses static, defensible signals (no live data on a static
// page): sheltered = oriented away from the northerly Meltemi; family = the
// curated family-friendly flag.
const ISLAND_INTENT_MIN = 5;
// Snorkeling drops to 3. It is by a distance the highest-yield guide family we
// publish — Search Console, 28 days to 2026-07-27: 290 clicks from 95 URLs
// (3.05 per page) against 0.22 for a beach page — and the flat ≥5 gate was
// keeping Paros and Santorini out over a single beach. Three verified
// rocky-seabed beaches is still a real list; two is not, so this stops at 3.
// The selection signal behind it was audited on 2026-07-30: of the 743 beaches
// flagged `activities.snorkeling`, 731 (98.4%) carry rocks/large_stones in
// their terrain — this is a derived data field, not the `surfing` hash that
// once invented 543 spots.
const ISLAND_INTENT_MIN_BY_KEY = { snorkeling: 3 };
const intentMinFor = key => ISLAND_INTENT_MIN_BY_KEY[key] ?? ISLAND_INTENT_MIN;
const ISLAND_INTENT_CAP = 40;
const NORTHERLY = ['North', 'Northeast', 'Northwest'];
const WESTERLY = ['West', 'Northwest', 'Southwest'];

// Category (per-island guide) titles, en/gr only. Static articles — NO live/
// today wording. Editorial "Best/Καλύτερες" is allowed on snorkeling (it is the
// literal query pattern, backed by a visible curated list); "More sheltered /
// Πιο Απάνεμες" is a comparative, orientation-based claim (protectedFrom), which
// the honesty guards accept via the "more"/"πιο" qualifier. de/fr/it titles stay
// as authored in each intent's copy (honest, Milos pilot only).
// { main } carries island + keyword; { tail } is the droppable qualifier.
//
// The count in `main` is a CTR lever, not decoration (Search Console 28d to
// 2026-07-24): sunset earned 0.4% CTR and secluded 0.7% at pos ~10-11, against
// our own measured 1.2% baseline for those positions — while snorkeling (3.0%)
// and organized/family (2.0%) beat it. The losers promised a property
// ("Facing West"); the winners promised something countable and concrete. So
// only the underperformers get the count; the winners are left untouched.
// The count is rebuild-fresh, so it never goes stale the way "σήμερα" would.
const CATEGORY_TITLE = {
  sheltered:  { en: { main: (islandName, count) => `${count} Sheltered Beaches in ${islandName}`, tail: 'for the Meltemi' }, gr: { main: (islandName, count) => `${islandName}: ${count} Πιο Απάνεμες Παραλίες`, tail: 'στο Μελτέμι' } },
  // EN family reordered 21/08/2026, measured on Search Console (28d to 16/08,
  // page dimension). English demand for the family intent is ~120 impressions;
  // the 47 EN family guides drew 4.695 and converted at 1,64% — the worst large
  // group on the site, against 6,41% for EN snorkeling at the same position. The
  // impressions do not come from family queries at all: they come from `preveza
  // beaches`, `kavala beach`, `lemnos beaches`. The old title opened with the two
  // words "Family Beaches", so a generic searcher discarded it on sight. Nothing
  // new is claimed here — the shallow-water phrasing and the audience are both
  // still present, only demoted behind the count and the place, and "for Families"
  // is now the droppable tail. Wording checked against all 53 built pages: this
  // shape keeps the brand suffix on 36 of them and never exceeds 60 characters,
  // where "N Beaches in X with Shallow Water" kept the brand on 1 and overflowed
  // on Larissa Coast. GR is untouched: it gets real intent queries
  // (`ευβοια παραλιες για παιδια`, 280 impressions) and converts 2,2x better.
  family:     { en: { main: (islandName, count) => `${count} Shallow-Water Beaches in ${islandName}`, tail: 'for Families' }, gr: { main: islandName => `${islandName}: Παραλίες για Οικογένειες`, tail: '& Παιδιά' } },
  snorkeling: { en: { main: islandName => `Best Snorkeling Beaches in ${islandName}`, tail: '' },               gr: { main: islandName => `${islandName}: Οι Καλύτερες Παραλίες για Snorkeling`, tail: '' } },
  organized:  { en: { main: islandName => `Organized Beaches in ${islandName}`, tail: 'with Sunbeds' },         gr: { main: islandName => `${islandName}: Οργανωμένες Παραλίες`, tail: 'με Ξαπλώστρες' } },
  // "Best sunset in {island}" is a literal query pattern in GSC, so EN reclaims
  // the editorial "Best" (spec §3.1 allows it on sunset); GR sunset queries are
  // bare "ηλιοβασίλεμα {νησί}", so GR spends the characters on the count instead.
  secluded:   { en: { main: (islandName, count) => `${count} Secluded Beaches in ${islandName}`, tail: 'Away from Crowds' },     gr: { main: (islandName, count) => `${islandName}: ${count} Απομονωμένες Παραλίες`, tail: 'χωρίς Κόσμο' } },
  sunset:     { en: { main: islandName => `Best Sunset Beaches in ${islandName}`, tail: count => `— ${count} Facing West` },     gr: { main: (islandName, count) => `${islandName}: ${count} Παραλίες για Ηλιοβασίλεμα`, tail: '(Δυτικές)' } },
  // Added 16/08/2026 from measured, entirely unserved demand (28 days to 13/08):
  // "sandy" queries drew 168 impressions and ZERO clicks, "beach bar" 111 and
  // ZERO — both landed on beach detail pages because no guide existed to answer
  // them. These are the only two of the three unserved intents we can answer
  // honestly; the third ("live camera", 118 impressions) needs data we do not have.
  // No qualifier tail here on purpose. "…Sandy Beaches in Naxos Not Pebbles" and
  // "…Παραλίες με Άμμο όχι Βότσαλο" both read as a missing comma in the SERP; the
  // sand-versus-pebbles distinction belongs in the description, where it has room
  // to be a sentence.
  sandy:      { en: { main: (islandName, count) => `${count} Sandy Beaches in ${islandName}`, tail: '' },                       gr: { main: (islandName, count) => `${islandName}: ${count} Παραλίες με Άμμο`, tail: '' } },
  beachbar:   { en: { main: (islandName, count) => `${count} Beaches with a Beach Bar in ${islandName}`, tail: '' },            gr: { main: (islandName, count) => `${islandName}: ${count} Παραλίες με Beach Bar`, tail: '' } },
};
// Same deterministic tiers as beach titles: T1 full → T2 drop brand → T3 drop
// qualifier tail → T4 bare "{island}: {keyword}".
const categoryTitleFor = (key, islandName, language, count) => {
  const spec = CATEGORY_TITLE[key]?.[language];
  if (!spec) return null;
  const main = spec.main(islandName, count);
  const tail = typeof spec.tail === 'function' ? spec.tail(count) : spec.tail;
  const withTail = tail ? `${main} ${tail}` : main;
  const max = language === 'gr' ? 58 : 60;
  const tiers = [`${withTail} | CalmBeach`, withTail, main];
  for (const tier of tiers) if (tier.length <= max) return tier;
  return main;
};

// Category meta, en/gr only (spec §3.2): "{count} {phrase} — {island}: {basis}.
// {live CTA as a pointer to the per-beach pages}". The count is rebuild-fresh
// (never stale like "today"); the basis is the honest selection reason.
// de/fr/it were added 2026-08-02. Measured cause: of the 267 guide pages in
// those three locales, 0% carried a count in the description, against 99% for
// en/gr — the one CTR lever this project has actually measured was never
// extended past the two original languages. Italy is the proof: position 9.7
// (better than Greek) with 2.4% CTR, the worst of any locale, on 2.590
// impressions. The phrases below are the existing hand-written copy, unchanged
// in meaning; only the countable head and the CTA are new.
const CATEGORY_META = {
  sheltered:  { en: { phrase: 'sheltered picks',          basis: 'oriented away from northerly Meltemi winds' }, gr: { phrase: 'πιο απάνεμες επιλογές',     basis: 'με προσανατολισμό μακριά από το βόρειο μελτέμι' } },
  family:     { en: { phrase: 'shallow, organised beaches', basis: 'all with easy access, picked for young children' },       gr: { phrase: 'οικογενειακές παραλίες',    basis: 'με ρηχά νερά και ευκολότερη πρόσβαση' },
              de: { phrase: 'familienfreundliche Strände', basis: 'mit flacherem Wasser und einfacherem Zugang' }, fr: { phrase: 'plages familiales',       basis: 'à eau généralement peu profonde et accès plus facile' }, it: { phrase: 'spiagge per famiglie',   basis: 'con acqua bassa e accesso più facile' } },
  snorkeling: { en: { phrase: 'snorkeling beaches',       basis: 'with clearer water and rocky seabed' },        gr: { phrase: 'παραλίες για snorkeling',   basis: 'με καθαρότερα νερά και βραχώδη βυθό' },
              de: { phrase: 'Schnorchelstrände',           basis: 'mit klarerem Wasser und felsigem Grund' },      fr: { phrase: 'plages de snorkeling',    basis: "à l'eau plus claire et au fond rocheux" },              it: { phrase: 'spiagge per snorkeling', basis: 'con acqua più limpida e fondale roccioso' } },
  organized:  { en: { phrase: 'organized beaches',        basis: 'with sunbeds, umbrellas and facilities' },     gr: { phrase: 'οργανωμένες παραλίες',      basis: 'με ξαπλώστρες, ομπρέλες και παροχές' },
              de: { phrase: 'organisierte Strände',        basis: 'mit Liegen, Sonnenschirmen und Einrichtungen' }, fr: { phrase: 'plages aménagées',       basis: 'avec transats, parasols et services' },                  it: { phrase: 'spiagge attrezzate',     basis: 'con lettini, ombrelloni e servizi' } },
  secluded:   { en: { phrase: 'secluded beaches',         basis: 'quieter and harder to reach' },                gr: { phrase: 'απομονωμένες παραλίες',     basis: 'πιο ήσυχες και δύσκολες στην πρόσβαση' },
              de: { phrase: 'abgelegene Strände',          basis: 'ruhiger und schwerer zu erreichen' },           fr: { phrase: 'plages isolées',          basis: "plus calmes et plus difficiles d'accès" },               it: { phrase: 'spiagge isolate',        basis: 'più tranquille e difficili da raggiungere' } },
  sunset:     { en: { phrase: 'west-facing beaches',      basis: 'that look out toward the sunset' },            gr: { phrase: 'δυτικές παραλίες',          basis: 'με θέα στο ηλιοβασίλεμα' },
              de: { phrase: 'nach Westen ausgerichtete Strände', basis: 'mit Blick auf den Sonnenuntergang' },     fr: { phrase: "plages orientées à l'ouest", basis: 'avec vue sur le coucher de soleil' },                 it: { phrase: 'spiagge esposte a ovest', basis: 'con vista sul tramonto' } },
  sandy:      { en: { phrase: 'sandy beaches',            basis: 'with sand underfoot rather than pebbles' },    gr: { phrase: 'παραλίες με άμμο',          basis: 'με άμμο αντί για βότσαλο' },
              de: { phrase: 'Sandstrände',                 basis: 'mit Sand statt Kies' },                         fr: { phrase: 'plages de sable',         basis: 'avec du sable plutôt que des galets' },                  it: { phrase: 'spiagge di sabbia',      basis: 'con sabbia invece di ciottoli' } },
  beachbar:   { en: { phrase: 'beaches with a beach bar', basis: 'with a bar on the beach itself' },             gr: { phrase: 'παραλίες με beach bar',     basis: 'με bar πάνω στην παραλία' },
              de: { phrase: 'Strände mit Beachbar',        basis: 'mit Bar direkt am Strand' },                    fr: { phrase: 'plages avec bar',         basis: 'avec un bar sur la plage même' },                        it: { phrase: 'spiagge con beach bar',  basis: 'con bar sulla spiaggia stessa' } },
};
const CATEGORY_META_CTA = {
  long:  { en: 'Check live wind & waves for each beach on CalmBeach before you go.', gr: 'Δες live άνεμο & κύμα για κάθε παραλία στο CalmBeach πριν πας.',
           de: 'Prüfe Wind und Wellen für jeden Strand auf CalmBeach, bevor du losfährst.', fr: "Vérifiez le vent et les vagues pour chaque plage sur CalmBeach avant d'y aller.", it: 'Controlla vento e onde per ogni spiaggia su CalmBeach prima di andare.' },
  short: { en: 'Check live wind & waves on CalmBeach.',                              gr: 'Δες live άνεμο & κύμα στο CalmBeach.',
           de: 'Prüfe Wind und Wellen auf CalmBeach.',                                      fr: 'Vérifiez le vent et les vagues sur CalmBeach.',                                    it: 'Controlla vento e onde su CalmBeach.' },
};
// The head reads with each language's own preposition instead of forcing the
// Greek em-dash onto German, French and Italian. en/gr keep the exact wording
// they were measured with.
const CATEGORY_META_HEAD = {
  en: (count, phrase, islandName, basis) => `${count} ${phrase} in ${islandName}: ${basis}. `,
  gr: (count, phrase, islandName, basis) => `${count} ${phrase} — ${islandName}: ${basis}. `,
  de: (count, phrase, islandName, basis) => `${count} ${phrase} auf ${islandName}: ${basis}. `,
  fr: (count, phrase, islandName, basis) => `${count} ${phrase} à ${islandName} : ${basis}. `,
  it: (count, phrase, islandName, basis) => `${count} ${phrase} a ${islandName}: ${basis}. `,
};
const categoryMetaFor = (key, islandName, count, language) => {
  const spec = CATEGORY_META[key]?.[language];
  if (!spec) return null;
  const buildHead = CATEGORY_META_HEAD[language] || CATEGORY_META_HEAD.en;
  const head = buildHead(count, spec.phrase, islandName, spec.basis);
  for (const cta of [CATEGORY_META_CTA.long[language], CATEGORY_META_CTA.short[language]]) {
    const candidate = `${head}${cta}`;
    if (candidate.length <= 155) return candidate;
  }
  return truncateForMeta(`${head}${CATEGORY_META_CTA.short[language]}`, 155);
};

const islandIntents = [
  {
    key: 'sheltered',
    pathPrefix: '/sheltered-beaches',
    // NOTE: the loop special-cases 'sheltered' to use the geospatial meltemi set
    // (getMeltemiShelteredIds), so this per-beach match is a defensive fallback only.
    match: beach => Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d)),
    // Wind-aware copy: `regionId` selects the regime word (meltemi / βοριάς /
    // Vardaris). de/fr/it stay on "meltemi" — only Aegean regions are localized.
    copy: (islandName, count, regionId = '') => {
      const w = windWordsFor(regionId);
      // de/fr/it used to hard-code "Meltemi" AND the Aegean lee ("south and
      // west-facing bays"). Both are false in the Ionian — and Corfu, Zakynthos,
      // Kefalonia and Lefkada are all in LOCALIZED_REGIONS, so those pages were
      // actually shipping it. Name the real regime and drop the fixed lee arc.
      const a = LOCAL_WIND_ATOMS[getRegionWindContext(regionId)];
      const prep = regionPrepGr(regionId, islandName);
      const enMain = `${count} Sheltered Beaches in ${islandName}`;
      const enWithTail = `${enMain} for ${w.en}`;
      const enTitle = pickUnderLimit([`${enWithTail} | CalmBeach`, enWithTail, enMain], 60);
      const grMain = `${islandName}: ${count} Πιο Απάνεμες Παραλίες`;
      const grWithTail = `${grMain} ${w.elIn}`;
      const grTitle = pickUnderLimit([`${grWithTail} | CalmBeach`, grWithTail, grMain], 58);
      return {
      en: {
        title: enTitle,
        description: truncateForMeta(`${count} sheltered beaches in ${islandName}, oriented away from ${w.en}. Check live wind & waves on CalmBeach before you go.`, 155),
        h1: `Beaches in ${islandName} usually better when ${w.enSubject} blows`,
        intro: `When ${w.enSubject} blows, more comfortable beaches in ${islandName} are often bays oriented away from it. These ${count} beaches sit away from it based on the geospatial exposure model — still check live conditions before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} may be better when ${w.enSubject} blows?`, body: `The bays listed here are shielded from ${w.en} in the exposure model, so they may be more comfortable when it blows. Local conditions still vary, so confirm wind and waves before you go.` },
          { heading: 'Does this guarantee low waves?', body: 'No. Shelter shows which coasts are shielded from a wind direction, not guaranteed calm or low waves. On strong-wind days follow local flags and check live wind and waves in the app.' },
        ],
      },
      gr: {
        title: grTitle,
        description: truncateForMeta(`${count} πιο απάνεμες παραλίες ${prep}, προστατευμένες ${w.elFrom}. Δες live άνεμο & κύμα στο CalmBeach πριν πας.`, 155),
        h1: `Παραλίες ${prep} που μένουν πιο υπήνεμες ${w.elIn}`,
        intro: `Όταν φυσά ${w.elNom}, πιο άνετες επιλογές ${prep} είναι συχνά οι κόλποι που προστατεύονται ${w.elFrom}. Αυτές οι ${count} παραλίες είναι υπήνεμες με βάση το γεωχωρικό μοντέλο έκθεσης — έλεγξε ζωντανά τις συνθήκες πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες μένουν πιο υπήνεμες ${w.elIn};`, body: `Οι κόλποι της λίστας προστατεύονται ${w.elFrom} σύμφωνα με το μοντέλο έκθεσης, οπότε μπορεί να είναι πιο άνετοι όταν φυσά. Οι συνθήκες αλλάζουν τοπικά, γι' αυτό έλεγξε άνεμο και κύμα πριν πας.` },
          { heading: 'Σημαίνει σίγουρα χαμηλό κύμα;', body: 'Όχι. Η προστασία δείχνει ποιες ακτές είναι υπήνεμες σε μια κατεύθυνση ανέμου, όχι εγγυημένη γαλήνη ή χαμηλό κύμα. Σε μέρες με δυνατό αέρα ακολούθησε τις τοπικές σημαίες και έλεγξε live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Strände auf ${islandName}, die oft besser beim ${a.word.de} liegen | CalmBeach`,
        description: truncateForMeta(`${count} eher windgeschützte Strände auf ${islandName}, ${w.de} abgewandt. Prüfe Wind und Wellen, bevor du losfährst.`, 155),
        h1: `Strände auf ${islandName}, die oft besser beim ${a.word.de} liegen`,
        intro: `Wenn der ${a.word.de} weht, sind auf ${islandName} oft Buchten angenehmer, die von ihm abgewandt liegen. Diese ${count} Strände liegen laut Ausrichtungsdaten von ${a.dir.de}-Winden abgewandt – prüfe trotzdem die Bedingungen, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} können beim ${a.word.de} besser passen?`, body: `Die hier gelisteten Buchten liegen abgewandt von ${a.dir.de}-Winden und können beim ${a.word.de} angenehmer sein. Die Bedingungen ändern sich örtlich, prüfe also Wind und Wellen, bevor du losfährst.` },
          { heading: 'Ist das Meer an diesen Stränden immer ruhig?', body: 'Nein. Die Ausrichtung zeigt, wohin eine Küste blickt, keinen garantierten Schutz und keine niedrigen Wellen. An windigen Tagen folge den örtlichen Flaggen und prüfe Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages souvent plus confortables à ${islandName} par ${a.word.fr} | CalmBeach`,
        description: truncateForMeta(`${count} plages plus abritées à ${islandName}, orientées à l'opposé ${w.fr}. Vérifiez le vent et les vagues avant d'y aller.`, 155),
        h1: `Plages à ${islandName} souvent plus confortables par ${a.word.fr}`,
        intro: `Quand le ${a.word.fr} souffle, les baies orientées à l'opposé peuvent être plus confortables à ${islandName}. Ces ${count} plages sont listées selon les données d'orientation disponibles — vérifiez quand même les conditions avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} peuvent mieux convenir par ${a.word.fr} ?`, body: `Les baies listées ici sont tournées à l'opposé des vents de ${a.dir.fr} et peuvent être plus confortables quand le ${a.word.fr} souffle. Les conditions varient localement, vérifiez donc le vent et les vagues avant d'y aller.` },
          { heading: 'La mer est-elle toujours calme sur ces plages ?', body: "Non. L'orientation indique vers où la côte est tournée, pas un abri garanti ni des vagues faibles. Les jours de vent fort, suivez les drapeaux locaux et vérifiez le vent et les vagues en direct dans l'application." },
        ],
      },
      it: {
        title: `Spiagge a ${islandName} spesso migliori con ${a.word.it} | CalmBeach`,
        description: truncateForMeta(`${count} spiagge più riparate a ${islandName}, orientate lontano ${w.it}. Controlla vento e onde prima di andare.`, 155),
        h1: `Spiagge a ${islandName} spesso migliori con ${a.word.it}`,
        intro: `Quando soffia il ${a.word.it}, a ${islandName} possono essere più comode le insenature orientate dalla parte opposta. Queste ${count} spiagge sono elencate in base ai dati di orientamento disponibili — controlla comunque le condizioni prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} possono andare meglio con ${a.word.it}?`, body: `Le insenature elencate qui sono orientate lontano dai venti da ${a.dir.it}, quindi possono essere più comode quando soffia il ${a.word.it}. Le condizioni variano localmente, controlla vento e onde prima di andare.` },
          { heading: 'Il mare è sempre calmo in queste spiagge?', body: "No. L'orientamento indica verso dove guarda la costa, non un riparo garantito o onde basse. Nei giorni di vento forte segui le bandiere locali e controlla vento e onde in tempo reale nell'app." },
        ],
      },
      };
    },
  },
  {
    key: 'family',
    pathPrefix: '/family-beaches',
    match: beach => beach.environment?.familyFriendly === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('family', islandName, 'en', count),
        description: categoryMetaFor('family', islandName, count, 'en'),
        h1: `Family beaches in ${islandName}`,
        // The intro used to assert that these beaches "tend to have shallower
        // water" — a property, stated as known. It is not known. Measured on
        // 29/07/2026 against EMODnet bathymetry (scripts/auditWaterDepth.mjs),
        // our `waterDepth` label separates real seabeds with a common-language
        // effect size of 0,607, where 0,500 is a coin flip. Real, but weak.
        // So the copy now names the three criteria the list is actually built
        // from — organised, not hard to reach, recorded as shallow — instead of
        // promising the water. This is specificity, not hedging: no "we are not
        // sure" badge, which the project has ruled out. Titles and meta keep the
        // shallow-water phrasing, because that is the search intent and the page
        // body is where the basis belongs.
        intro: `Travelling with young children in ${islandName}? We picked these ${count} beaches because they are organised, not hard to reach, and recorded as shallow. How quickly the water deepens varies from beach to beach, so check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are family-friendly?`, body: 'Every beach on this list meets three criteria: it is organised, it has no difficult access, and our data records its water as shallow. How fast the seabed drops away underfoot is not something any map can guarantee — for small children, pick a calm, sheltered day as well.' },
          { heading: 'How do I compare sea conditions?', body: 'CalmBeach checks wind, waves and exposure, so you can compare less exposed beaches and more comfortable visiting times.' },
        ],
      },
      gr: {
        title: categoryTitleFor('family', islandName, 'gr', count),
        description: categoryMetaFor('family', islandName, count, 'gr'),
        h1: `Παραλίες για παιδιά — ${islandName}`,
        intro: `Ταξιδεύεις με μικρά παιδιά; Διαλέξαμε αυτές τις ${count} παραλίες (${islandName}) επειδή είναι οργανωμένες, χωρίς δύσκολη πρόσβαση, και στα δεδομένα μας καταγράφονται ως ρηχές. Το πόσο γρήγορα βαθαίνει το νερό αλλάζει από παραλία σε παραλία — δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για οικογένειες;`, body: 'Κάθε παραλία της λίστας πληροί τρία κριτήρια: είναι οργανωμένη, δεν έχει δύσκολη πρόσβαση, και στα δεδομένα μας καταγράφεται ως ρηχή. Το πόσο απότομα βαθαίνει ο βυθός δεν το εγγυάται κανένας χάρτης — για μικρά παιδιά, διάλεξε και ήρεμη, υπήνεμη μέρα.' },
          { heading: 'Πώς ξέρω ότι η θάλασσα θα είναι αρκετά ήρεμη;', body: 'Το CalmBeach ελέγχει άνεμο, κύμα και έκθεση για τη μέρα, ώστε να διαλέξεις πιο υπήνεμη παραλία ή πιο ήρεμη ώρα.' },
        ],
      },
      de: {
        title: `Familienfreundliche Strände auf ${islandName} | CalmBeach`,
        description: categoryMetaFor('family', islandName, count, 'de'),
        h1: `Familienstrände auf ${islandName}`,
        intro: `Unterwegs mit kleinen Kindern auf ${islandName}? Wir haben diese ${count} Strände ausgewählt, weil sie organisiert und gut erreichbar sind und in unseren Daten als flach verzeichnet stehen. Wie schnell das Wasser tiefer wird, ist von Strand zu Strand verschieden — prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind familienfreundlich?`, body: 'Jeder Strand dieser Liste erfüllt drei Kriterien: organisiert, ohne schwierigen Zugang, und in unseren Daten als flaches Wasser verzeichnet. Wie steil der Grund abfällt, kann keine Karte garantieren — wähle für kleine Kinder zusätzlich einen ruhigen, windgeschützten Tag.' },
          { heading: 'Wie vergleiche ich die Meeresbedingungen?', body: 'CalmBeach prüft Wind, Wellen und Lage, sodass du weniger exponierte Strände und angenehmere Besuchszeiten vergleichen kannst.' },
        ],
      },
      fr: {
        title: `Plages familiales à ${islandName} à l'eau peu profonde | CalmBeach`,
        description: categoryMetaFor('family', islandName, count, 'fr'),
        h1: `Plages familiales à ${islandName}`,
        intro: `Vous voyagez avec de jeunes enfants à ${islandName} ? Nous avons retenu ces ${count} plages parce qu'elles sont aménagées, faciles d'accès, et enregistrées comme peu profondes dans nos données. La vitesse à laquelle l'eau devient profonde varie d'une plage à l'autre — vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} conviennent aux familles ?`, body: "Chaque plage de cette liste remplit trois critères : elle est aménagée, son accès n'est pas difficile, et nos données l'enregistrent comme peu profonde. Aucune carte ne peut garantir la pente du fond — pour les jeunes enfants, choisissez aussi une journée calme et abritée." },
          { heading: 'Comment comparer les conditions de mer ?', body: "CalmBeach vérifie le vent, les vagues et l'exposition pour comparer les plages moins exposées et les moments plus confortables." },
        ],
      },
      it: {
        title: `Spiagge per famiglie a ${islandName} con acqua bassa | CalmBeach`,
        description: categoryMetaFor('family', islandName, count, 'it'),
        h1: `Spiagge per famiglie a ${islandName}`,
        intro: `Viaggi con bambini piccoli a ${islandName}? Abbiamo scelto queste ${count} spiagge perché sono attrezzate, facili da raggiungere e registrate come basse nei nostri dati. Quanto rapidamente l'acqua diventa profonda cambia da spiaggia a spiaggia — controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono adatte alle famiglie?`, body: 'Ogni spiaggia di questo elenco soddisfa tre criteri: è attrezzata, non ha accesso difficile, e nei nostri dati risulta con acqua bassa. Nessuna mappa può garantire quanto ripido sia il fondale — per i bambini piccoli scegli anche una giornata calma e riparata.' },
          { heading: 'Come confronto le condizioni del mare?', body: 'CalmBeach controlla vento, onde ed esposizione, così puoi confrontare spiagge meno esposte e orari più comodi.' },
        ],
      },
    }),
  },
  {
    key: 'snorkeling',
    pathPrefix: '/snorkeling-beaches',
    match: beach => beach.activities?.snorkeling === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('snorkeling', islandName, 'en', count),
        description: categoryMetaFor('snorkeling', islandName, count, 'en'),
        h1: `Snorkeling beaches in ${islandName}`,
        intro: `Want clear water and rocks to explore in ${islandName}? These ${count} beaches are good for snorkeling, usually with clearer water and a rocky or mixed seabed. Visibility is often better on low-wind days — check wind and waves in CalmBeach first.`,
        sections: [
          { heading: `Which beaches in ${islandName} are good for snorkeling?`, body: 'The beaches listed here have rockier seabed and clearer water, where you are more likely to see fish and underwater life. Conditions vary, so check the forecast before you go.' },
          { heading: 'When is snorkeling more comfortable?', body: 'Snorkel close to shore when conditions are mild and avoid strong wind, waves or currents. Check live wind and waves in the app and follow any local flags.' },
        ],
      },
      gr: {
        title: categoryTitleFor('snorkeling', islandName, 'gr', count),
        description: categoryMetaFor('snorkeling', islandName, count, 'gr'),
        h1: `Παραλίες για snorkeling — ${islandName}`,
        intro: `Ψάχνεις καθαρά νερά και βράχια για εξερεύνηση; Αυτές οι ${count} παραλίες εδώ (${islandName}) είναι καλές για snorkeling, συνήθως με πιο καθαρά νερά και βραχώδη ή μικτό βυθό. Η ορατότητα είναι συχνά καλύτερη σε μέρες με λίγο αέρα — δες πρώτα άνεμο και κύμα στο CalmBeach.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για snorkeling;`, body: 'Οι παραλίες της λίστας έχουν πιο βραχώδη βυθό και καθαρότερα νερά, όπου είναι πιο πιθανό να δεις ψάρια και υποθαλάσσια ζωή. Οι συνθήκες αλλάζουν, γι\' αυτό έλεγξε την πρόγνωση πριν πας.' },
          // Was "Πότε είναι ασφαλέστερο το snorkeling;" — our own honesty guard
          // flags an unqualified safety claim, and it was right to: we cannot
          // rank days by safety. The question now asks what to watch for, which
          // is what the answer actually delivers.
          { heading: 'Τι να προσέχω όταν κάνω snorkeling;', body: 'Κάνε snorkeling κοντά στην ακτή σε ήρεμες μέρες και απόφυγε δυνατό αέρα, κύμα ή ρεύματα. Έλεγξε live άνεμο και κύμα στην εφαρμογή και ακολούθησε τυχόν τοπικές σημαίες.' },
        ],
      },
      de: {
        title: `Schnorchelstrände auf ${islandName} | Klares Wasser & Felsen | CalmBeach`,
        description: categoryMetaFor('snorkeling', islandName, count, 'de'),
        h1: `Schnorchelstrände auf ${islandName}`,
        intro: `Du suchst klares Wasser und Felsen zum Erkunden auf ${islandName}? Diese ${count} Strände eignen sich zum Schnorcheln, meist mit klarerem Wasser und felsigem oder gemischtem Grund. Die Sicht ist oft an windarmen Tagen besser – prüfe zuerst Wind und Wellen in CalmBeach.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} eignen sich zum Schnorcheln?`, body: 'Die hier gelisteten Strände haben felsigeren Grund und klareres Wasser, wo du eher Fische und Unterwasserleben siehst. Die Bedingungen ändern sich, prüfe also die Vorhersage vor dem Besuch.' },
          { heading: 'Wann ist Schnorcheln angenehmer?', body: 'Schnorchle ufernah, wenn die Bedingungen mild sind, und meide starken Wind, Wellen oder Strömungen. Prüfe Wind und Wellen live in der App und folge örtlichen Flaggen.' },
        ],
      },
      fr: {
        title: `Plages de snorkeling à ${islandName} | Eau claire & rochers | CalmBeach`,
        description: categoryMetaFor('snorkeling', islandName, count, 'fr'),
        h1: `Plages de snorkeling à ${islandName}`,
        intro: `Vous cherchez une eau claire et des rochers à explorer à ${islandName} ? Ces ${count} plages se prêtent au snorkeling, généralement avec une eau plus claire et un fond rocheux ou mixte. La visibilité est souvent meilleure les jours peu ventés — vérifiez d'abord le vent et les vagues dans CalmBeach.`,
        sections: [
          { heading: `Quelles plages de ${islandName} se prêtent au snorkeling ?`, body: "Les plages listées ici ont un fond plus rocheux et une eau plus claire, où vous avez plus de chances de voir des poissons et la vie sous-marine. Les conditions varient, vérifiez le vent et les vagues avant d'y aller." },
          { heading: 'Quand le snorkeling est-il plus confortable ?', body: 'Faites du snorkeling près du rivage quand les conditions sont douces et évitez vent fort, vagues ou courants. Vérifiez le vent et les vagues en direct dans l\'application et suivez les drapeaux locaux.' },
        ],
      },
      it: {
        title: `Spiagge per snorkeling a ${islandName} | Acqua limpida e scogli | CalmBeach`,
        description: categoryMetaFor('snorkeling', islandName, count, 'it'),
        h1: `Spiagge per snorkeling a ${islandName}`,
        intro: `Cerchi acqua limpida e scogli da esplorare a ${islandName}? Queste ${count} spiagge sono adatte allo snorkeling, di solito con acqua più limpida e fondale roccioso o misto. La visibilità è spesso migliore nei giorni poco ventosi — controlla prima vento e onde in CalmBeach.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono adatte allo snorkeling?`, body: 'Le spiagge elencate qui hanno fondale più roccioso e acqua più limpida, dove è più probabile vedere pesci e vita sottomarina. Le condizioni variano, controlla le previsioni prima di andare.' },
          { heading: 'Quando lo snorkeling è più comodo?', body: 'Fai snorkeling vicino alla riva quando le condizioni sono miti ed evita vento forte, onde o correnti. Controlla vento e onde in tempo reale nell\'app e segui le bandiere locali.' },
        ],
      },
    }),
  },
  {
    key: 'organized',
    pathPrefix: '/organized-beaches',
    match: beach => beach.amenities?.organized === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('organized', islandName, 'en', count),
        description: categoryMetaFor('organized', islandName, count, 'en'),
        h1: `Organized beaches in ${islandName}`,
        intro: `Prefer sunbeds, umbrellas and a beach bar in ${islandName}? These ${count} organized beaches usually have facilities and easier access. Check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are organized?`, body: 'The beaches listed here are marked as organized, usually with sunbeds, umbrellas and food or a beach bar nearby. Facilities can change by season, so confirm locally.' },
          { heading: 'Are organized beaches less windy?', body: 'Not necessarily. Facilities do not change the wind or waves — check live conditions in the app and compare less exposed beaches on windy days.' },
        ],
      },
      gr: {
        title: categoryTitleFor('organized', islandName, 'gr', count),
        description: categoryMetaFor('organized', islandName, count, 'gr'),
        h1: `Οργανωμένες παραλίες — ${islandName}`,
        intro: `Προτιμάς ξαπλώστρες, ομπρέλες και beach bar; Αυτές οι ${count} οργανωμένες παραλίες εδώ (${islandName}) έχουν συνήθως παροχές και ευκολότερη πρόσβαση. Δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οργανωμένες;`, body: 'Οι παραλίες της λίστας είναι σημειωμένες ως οργανωμένες, συνήθως με ξαπλώστρες, ομπρέλες και φαγητό ή beach bar κοντά. Οι παροχές αλλάζουν ανά εποχή, γι\' αυτό επιβεβαίωσε επιτόπου.' },
          { heading: 'Είναι πιο ήρεμες οι οργανωμένες παραλίες;', body: 'Όχι απαραίτητα. Οι παροχές δεν αλλάζουν τον άνεμο ή το κύμα — έλεγξε live συνθήκες στην εφαρμογή και διάλεξε πιο υπήνεμη παραλία τις μέρες με αέρα.' },
        ],
      },
      de: {
        title: `Organisierte Strände auf ${islandName} mit Liegen | CalmBeach`,
        description: categoryMetaFor('organized', islandName, count, 'de'),
        h1: `Organisierte Strände auf ${islandName}`,
        intro: `Du bevorzugst Liegen, Sonnenschirme und eine Beach Bar auf ${islandName}? Diese ${count} organisierten Strände bieten meist Einrichtungen und einfacheren Zugang. Prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind organisiert?`, body: 'Die hier gelisteten Strände sind als organisiert markiert, meist mit Liegen, Sonnenschirmen und Essen oder einer Beach Bar in der Nähe. Die Einrichtungen ändern sich je nach Saison, bestätige sie vor Ort.' },
          { heading: 'Sind organisierte Strände weniger windig?', body: 'Nicht unbedingt. Einrichtungen ändern Wind oder Wellen nicht – prüfe die Live-Bedingungen in der App und vergleiche an windigen Tagen weniger exponierte Strände.' },
        ],
      },
      fr: {
        title: `Plages aménagées à ${islandName} avec transats et services | CalmBeach`,
        description: categoryMetaFor('organized', islandName, count, 'fr'),
        h1: `Plages aménagées à ${islandName}`,
        intro: `Vous préférez transats, parasols et un bar de plage à ${islandName} ? Ces ${count} plages aménagées offrent généralement des services et un accès plus facile. Vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont aménagées ?`, body: 'Les plages listées ici sont marquées comme aménagées, généralement avec transats, parasols et restauration ou un bar de plage à proximité. Les services changent selon la saison, confirmez sur place.' },
          { heading: 'Les plages aménagées sont-elles moins ventées ?', body: 'Pas forcément. Les services ne changent ni le vent ni les vagues — vérifiez les conditions en direct dans l\'application et comparez les plages moins exposées les jours de vent.' },
        ],
      },
      it: {
        title: `Spiagge attrezzate a ${islandName} con lettini e servizi | CalmBeach`,
        description: categoryMetaFor('organized', islandName, count, 'it'),
        h1: `Spiagge attrezzate a ${islandName}`,
        intro: `Preferisci lettini, ombrelloni e un beach bar a ${islandName}? Queste ${count} spiagge attrezzate hanno di solito servizi e un accesso più facile. Controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono attrezzate?`, body: 'Le spiagge elencate qui sono indicate come attrezzate, di solito con lettini, ombrelloni e ristoro o un beach bar nelle vicinanze. I servizi cambiano con la stagione, conferma sul posto.' },
          { heading: 'Le spiagge attrezzate sono meno ventose?', body: 'Non necessariamente. I servizi non cambiano vento o onde — controlla le condizioni in tempo reale nell\'app e confronta spiagge meno esposte nei giorni ventosi.' },
        ],
      },
    }),
  },
  {
    key: 'secluded',
    pathPrefix: '/secluded-beaches',
    match: beach => beach.environment?.remote === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('secluded', islandName, 'en', count),
        description: categoryMetaFor('secluded', islandName, count, 'en'),
        h1: `Secluded beaches in ${islandName}`,
        intro: `Looking to escape the crowds in ${islandName}? These ${count} remote beaches are quieter and harder to reach — often by dirt road, on foot or by boat. Bring water and shade, and check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are the most secluded?`, body: 'The beaches listed here are remote and usually have no facilities. Access can be rough — a dirt track, a hike or boat-only — so plan ahead and bring supplies.' },
          { heading: 'What should I know before swimming at remote beaches?', body: 'Remote beaches have no lifeguards or services. Avoid strong wind, big waves and swimming alone, and check live wind and waves in the app first.' },
        ],
      },
      gr: {
        title: categoryTitleFor('secluded', islandName, 'gr', count),
        description: categoryMetaFor('secluded', islandName, count, 'gr'),
        h1: `Απομονωμένες παραλίες — ${islandName}`,
        intro: `Θες να ξεφύγεις από τον κόσμο; Αυτές οι ${count} απομακρυσμένες παραλίες εδώ (${islandName}) είναι πιο ήσυχες και πιο δύσκολες στην πρόσβαση — συχνά με χωματόδρομο, με τα πόδια ή με σκάφος. Φέρε νερό και σκιά, και δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οι πιο απομονωμένες;`, body: 'Οι παραλίες της λίστας είναι απομακρυσμένες και συνήθως χωρίς παροχές. Η πρόσβαση μπορεί να είναι δύσκολη — χωματόδρομος, πεζοπορία ή μόνο με σκάφος — οπότε προγραμμάτισε και φέρε προμήθειες.' },
          { heading: 'Είναι ασφαλές το μπάνιο σε απομονωμένες παραλίες;', body: 'Οι απομονωμένες παραλίες δεν έχουν ναυαγοσώστη ή υπηρεσίες. Κολύμπησε μόνο σε ήρεμες συνθήκες, ποτέ μόνος σε μεγάλο κύμα, και έλεγξε πρώτα live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Abgelegene Strände auf ${islandName} abseits der Menschenmengen | CalmBeach`,
        description: categoryMetaFor('secluded', islandName, count, 'de'),
        h1: `Abgelegene Strände auf ${islandName}`,
        intro: `Du möchtest den Menschenmengen auf ${islandName} entkommen? Diese ${count} abgelegenen Strände sind ruhiger und schwerer erreichbar – oft über Schotterpiste, zu Fuß oder per Boot. Bring Wasser und Schatten mit und prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind am abgelegensten?`, body: 'Die hier gelisteten Strände sind abgelegen und haben meist keine Einrichtungen. Der Zugang kann rau sein – Schotterpiste, Wanderung oder nur per Boot – plane also voraus und bring Vorräte mit.' },
          { heading: 'Was sollte ich vor dem Schwimmen an abgelegenen Stränden wissen?', body: 'Abgelegene Strände haben keine Rettungsschwimmer oder Dienste. Meide starken Wind, hohe Wellen und Alleinschwimmen, und prüfe zuerst Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages isolées à ${islandName} loin de la foule | CalmBeach`,
        description: categoryMetaFor('secluded', islandName, count, 'fr'),
        h1: `Plages isolées à ${islandName}`,
        intro: `Vous voulez échapper à la foule à ${islandName} ? Ces ${count} plages isolées sont plus difficiles d'accès — souvent par piste, à pied ou en bateau. Apportez eau et ombre, et vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont les plus isolées ?`, body: 'Les plages listées ici sont isolées et généralement sans services. L\'accès peut être difficile — piste, randonnée ou bateau uniquement — alors prévoyez et apportez des provisions.' },
          { heading: 'À savoir avant de se baigner sur les plages isolées', body: 'Les plages isolées n\'ont ni surveillants ni services. Évitez vent fort, grosses vagues et baignade seul, et vérifiez d\'abord le vent et les vagues en direct dans l\'application.' },
        ],
      },
      it: {
        title: `Spiagge isolate a ${islandName} lontano dalla folla | CalmBeach`,
        description: categoryMetaFor('secluded', islandName, count, 'it'),
        h1: `Spiagge isolate a ${islandName}`,
        intro: `Vuoi sfuggire alla folla a ${islandName}? Queste ${count} spiagge isolate sono più difficili da raggiungere — spesso su strada sterrata, a piedi o in barca. Porta acqua e ombra e controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono le più isolate?`, body: 'Le spiagge elencate qui sono isolate e di solito senza servizi. L\'accesso può essere difficile — sterrato, sentiero o solo in barca — quindi pianifica e porta provviste.' },
          { heading: 'Cosa sapere prima di nuotare nelle spiagge isolate', body: 'Le spiagge isolate non hanno bagnini o servizi. Evita vento forte, onde alte e il nuoto da solo, e controlla prima vento e onde in tempo reale nell\'app.' },
        ],
      },
    }),
  },
  {
    key: 'sunset',
    pathPrefix: '/sunset-beaches',
    match: beach => Array.isArray(beach.orientation?.faces) && WESTERLY.some(d => beach.orientation.faces.includes(d)),
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('sunset', islandName, 'en', count),
        description: categoryMetaFor('sunset', islandName, count, 'en'),
        h1: `Sunset beaches in ${islandName}`,
        intro: `Want to watch the sun go down over the sea in ${islandName}? These ${count} west-facing beaches look out toward the sunset. Time your visit for late afternoon — and check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} face the sunset?`, body: 'The beaches listed here face west or southwest, so the sun sets over the water in front of you. Arrive before sunset to find a spot and enjoy the light.' },
          { heading: 'Anything to know for an evening visit?', body: 'Wind can pick up or drop in the evening, and remote beaches have no lights. Check live wind and waves in the app and bring a torch for the walk back.' },
        ],
      },
      gr: {
        title: categoryTitleFor('sunset', islandName, 'gr', count),
        description: categoryMetaFor('sunset', islandName, count, 'gr'),
        h1: `Παραλίες για ηλιοβασίλεμα — ${islandName}`,
        intro: `Θες να δεις τον ήλιο να δύει στη θάλασσα; Αυτές οι ${count} δυτικές παραλίες εδώ (${islandName}) κοιτούν προς το ηλιοβασίλεμα. Προγραμμάτισε την επίσκεψη αργά το απόγευμα — και δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες έχουν το καλύτερο ηλιοβασίλεμα;`, body: 'Οι παραλίες της λίστας κοιτούν δυτικά ή νοτιοδυτικά, οπότε ο ήλιος δύει πάνω από τη θάλασσα μπροστά σου. Έλα πριν τη δύση για να βρεις θέση και να απολαύσεις το φως.' },
          { heading: 'Τι να προσέξω για βραδινή επίσκεψη;', body: 'Ο αέρας μπορεί να δυναμώσει ή να πέσει το βράδυ, και οι απομακρυσμένες παραλίες δεν έχουν φωτισμό. Έλεγξε live άνεμο και κύμα στην εφαρμογή και πάρε φακό για την επιστροφή.' },
        ],
      },
      de: {
        title: `Sonnenuntergangsstrände auf ${islandName} nach Westen | CalmBeach`,
        description: categoryMetaFor('sunset', islandName, count, 'de'),
        h1: `Sonnenuntergangsstrände auf ${islandName}`,
        intro: `Du möchtest die Sonne über dem Meer auf ${islandName} untergehen sehen? Diese ${count} nach Westen ausgerichteten Strände blicken zum Sonnenuntergang. Plane deinen Besuch für den späten Nachmittag – und prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} haben die schönsten Sonnenuntergänge?`, body: 'Die hier gelisteten Strände sind nach Westen oder Südwesten ausgerichtet, sodass die Sonne über dem Wasser vor dir untergeht. Komm vor Sonnenuntergang, um einen Platz zu finden und das Licht zu genießen.' },
          { heading: 'Was sollte ich für einen Besuch am Abend wissen?', body: 'Der Wind kann abends auffrischen oder nachlassen, und abgelegene Strände haben kein Licht. Prüfe Wind und Wellen live in der App und bring eine Taschenlampe für den Rückweg mit.' },
        ],
      },
      fr: {
        title: `Plages de coucher de soleil à ${islandName} face à l'ouest | CalmBeach`,
        description: categoryMetaFor('sunset', islandName, count, 'fr'),
        h1: `Plages de coucher de soleil à ${islandName}`,
        intro: `Envie de voir le soleil se coucher sur la mer à ${islandName} ? Ces ${count} plages orientées à l'ouest donnent vers le coucher de soleil. Prévoyez votre visite en fin d'après-midi — et vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} offrent les plus beaux couchers de soleil ?`, body: 'Les plages listées ici sont orientées à l\'ouest ou au sud-ouest, le soleil se couche donc sur l\'eau devant vous. Arrivez avant le coucher pour trouver une place et profiter de la lumière.' },
          { heading: 'À savoir pour une visite en soirée ?', body: 'Le vent peut se lever ou tomber le soir, et les plages isolées n\'ont pas d\'éclairage. Vérifiez le vent et les vagues en direct dans l\'application et emportez une lampe pour le retour.' },
        ],
      },
      it: {
        title: `Spiagge per il tramonto a ${islandName} esposte a ovest | CalmBeach`,
        description: categoryMetaFor('sunset', islandName, count, 'it'),
        h1: `Spiagge per il tramonto a ${islandName}`,
        intro: `Vuoi vedere il sole tramontare sul mare a ${islandName}? Queste ${count} spiagge esposte a ovest guardano verso il tramonto. Programma la visita nel tardo pomeriggio — e controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} hanno i tramonti più belli?`, body: 'Le spiagge elencate qui sono esposte a ovest o sud-ovest, così il sole tramonta sull\'acqua davanti a te. Arriva prima del tramonto per trovare posto e goderti la luce.' },
          { heading: 'Cosa sapere per una visita serale?', body: 'Il vento può rinforzare o calare la sera, e le spiagge isolate non hanno illuminazione. Controlla vento e onde in tempo reale nell\'app e porta una torcia per il ritorno.' },
        ],
      },
    }),
  },
  // ── Two intents added 16/08/2026 to answer demand we were measurably losing ──
  //
  // Search Console, 28 days to 13/08: "sandy" queries drew 168 impressions and
  // ZERO clicks; "beach bar" queries 111 impressions and ZERO clicks. Both were
  // landing on individual beach pages ("φιλιατρο ιθακη beach bar" → the Filiatro
  // detail page, position 11.3) because there was no list page to answer "which
  // beaches HERE have this". Every other intent with that shape already has one.
  //
  // Coverage measured before writing a line: sandy 934 beaches over 53 regions
  // (median list 14), beach bar 605 over 41 regions (median 11) — both well clear
  // of the ≥5 gate, both producing a list short enough to be a choice rather than
  // a dump.
  //
  // The third unserved intent found in the same pass — "live camera", 118
  // impressions — is deliberately NOT here: we hold no webcam data, and a guide
  // page promising cameras we cannot show would be the one thing this project
  // refuses to do.
  {
    key: 'sandy',
    pathPrefix: '/sandy-beaches',
    // Strictly beachType 'sandy'. 'sandy-pebbles' is deliberately excluded even
    // though it would nearly double the list (1.953 vs 934): someone searching
    // "παραλίες με άμμο" is choosing sand OVER pebbles, and a mixed shore in that
    // list is the answer they were trying to avoid.
    match: beach => beach.beachType === 'sandy',
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('sandy', islandName, 'en', count),
        description: categoryMetaFor('sandy', islandName, count, 'en'),
        h1: `Sandy beaches in ${islandName}`,
        intro: `Looking for sand rather than pebbles in ${islandName}? These ${count} beaches are recorded as sandy, so they are easier on bare feet and better for children playing. Check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are sandy?`, body: 'The beaches listed here are recorded as sand rather than pebbles or rock. Shorelines shift with storms and seasons, so the mix can change from year to year.' },
          { heading: 'Does sand mean shallow water?', body: 'Not always. Sand describes the shore, not the depth — some sandy beaches drop away quickly. Open a beach to see its recorded depth, and check live wind and waves before you swim.' },
        ],
      },
      gr: {
        title: categoryTitleFor('sandy', islandName, 'gr', count),
        description: categoryMetaFor('sandy', islandName, count, 'gr'),
        h1: `Παραλίες με άμμο — ${islandName}`,
        intro: `Ψάχνεις άμμο και όχι βότσαλο; Αυτές οι ${count} παραλίες (${islandName}) είναι καταγεγραμμένες ως αμμώδεις, οπότε είναι πιο βολικές ξυπόλητος και για παιδιά που παίζουν. Δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες έχουν άμμο;`, body: 'Οι παραλίες της λίστας είναι καταγεγραμμένες με άμμο, όχι με βότσαλο ή βράχο. Η ακτογραμμή αλλάζει με τις φουρτούνες και τις εποχές, γι\' αυτό η σύσταση μπορεί να διαφέρει από χρονιά σε χρονιά.' },
          { heading: 'Η άμμος σημαίνει ρηχά νερά;', body: 'Όχι πάντα. Η άμμος περιγράφει την ακτή, όχι το βάθος — κάποιες αμμουδιές βαθαίνουν απότομα. Άνοιξε μια παραλία για να δεις το καταγεγραμμένο βάθος και έλεγξε άνεμο και κύμα πριν μπεις.' },
        ],
      },
      de: {
        title: `Sandstrände auf ${islandName} statt Kies | CalmBeach`,
        description: categoryMetaFor('sandy', islandName, count, 'de'),
        h1: `Sandstrände auf ${islandName}`,
        intro: `Du suchst Sand statt Kies auf ${islandName}? Diese ${count} Strände sind als Sandstrände erfasst – angenehmer für bloße Füße und besser für spielende Kinder. Prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} haben Sand?`, body: 'Die hier gelisteten Strände sind als Sand erfasst, nicht als Kies oder Fels. Küsten verändern sich durch Stürme und Jahreszeiten, die Zusammensetzung kann also wechseln.' },
          { heading: 'Bedeutet Sand flaches Wasser?', body: 'Nicht immer. Sand beschreibt das Ufer, nicht die Tiefe – manche Sandstrände fallen schnell ab. Öffne einen Strand für die erfasste Tiefe und prüfe Wind und Wellen vor dem Schwimmen.' },
        ],
      },
      fr: {
        title: `Plages de sable à ${islandName} plutôt que galets | CalmBeach`,
        description: categoryMetaFor('sandy', islandName, count, 'fr'),
        h1: `Plages de sable à ${islandName}`,
        intro: `Vous cherchez du sable plutôt que des galets à ${islandName} ? Ces ${count} plages sont enregistrées comme sableuses : plus agréables pieds nus et mieux pour les enfants qui jouent. Vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont de sable ?`, body: 'Les plages listées ici sont enregistrées comme sable, et non galets ou rocher. Le littoral évolue avec les tempêtes et les saisons, la composition peut donc changer.' },
          { heading: 'Sable veut-il dire eau peu profonde ?', body: "Pas toujours. Le sable décrit le rivage, pas la profondeur — certaines plages de sable plongent vite. Ouvrez une plage pour voir la profondeur enregistrée et vérifiez le vent et les vagues avant de nager." },
        ],
      },
      it: {
        title: `Spiagge di sabbia a ${islandName} invece di ciottoli | CalmBeach`,
        description: categoryMetaFor('sandy', islandName, count, 'it'),
        h1: `Spiagge di sabbia a ${islandName}`,
        intro: `Cerchi sabbia invece di ciottoli a ${islandName}? Queste ${count} spiagge sono registrate come sabbiose, più comode a piedi nudi e migliori per i bambini che giocano. Controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono di sabbia?`, body: 'Le spiagge elencate qui sono registrate come sabbia, non ciottoli o roccia. La costa cambia con le mareggiate e le stagioni, quindi la composizione può variare.' },
          { heading: 'Sabbia significa acqua bassa?', body: 'Non sempre. La sabbia descrive la riva, non la profondità — alcune spiagge sabbiose degradano rapidamente. Apri una spiaggia per vedere la profondità registrata e controlla vento e onde prima di nuotare.' },
        ],
      },
    }),
  },
  {
    key: 'beachbar',
    pathPrefix: '/beach-bars',
    // `beachBar` only, NOT the taverna/restaurant fields. They are different
    // questions: "is there food nearby" versus "can I get a drink without
    // leaving the sand", and the query that goes unanswered is the second one.
    match: beach => beach.amenities?.beachBar === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('beachbar', islandName, 'en', count),
        description: categoryMetaFor('beachbar', islandName, count, 'en'),
        h1: `Beaches with a beach bar in ${islandName}`,
        intro: `Want a drink without leaving the sand in ${islandName}? These ${count} beaches are recorded as having a beach bar. Opening months and hours vary, so confirm locally — and check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} have a beach bar?`, body: 'The beaches listed here are recorded as having a bar on the beach itself, not only a taverna in the village. Bars are seasonal and change hands, so confirm before making the trip.' },
          { heading: 'Is a beach bar the same as an organized beach?', body: 'No. An organized beach has sunbeds and umbrellas, which a beach bar does not always come with — and some quiet beaches have a bar and nothing else. Open a beach to see exactly what it is recorded as having.' },
        ],
      },
      gr: {
        title: categoryTitleFor('beachbar', islandName, 'gr', count),
        description: categoryMetaFor('beachbar', islandName, count, 'gr'),
        h1: `Παραλίες με beach bar — ${islandName}`,
        intro: `Θες ποτό χωρίς να φύγεις από την παραλία; Αυτές οι ${count} παραλίες (${islandName}) είναι καταγεγραμμένες με beach bar. Οι μήνες και οι ώρες λειτουργίας αλλάζουν, γι' αυτό επιβεβαίωσε επιτόπου — και δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες έχουν beach bar;`, body: 'Οι παραλίες της λίστας είναι καταγεγραμμένες με bar πάνω στην παραλία, όχι μόνο ταβέρνα στο χωριό. Τα bar είναι εποχικά και αλλάζουν χέρια, γι\' αυτό επιβεβαίωσε πριν κάνεις τον δρόμο.' },
          { heading: 'Beach bar σημαίνει οργανωμένη παραλία;', body: 'Όχι. Η οργανωμένη έχει ξαπλώστρες και ομπρέλες, που δεν συνοδεύουν πάντα ένα beach bar — και κάποιες ήσυχες παραλίες έχουν bar και τίποτα άλλο. Άνοιξε μια παραλία για να δεις τι ακριβώς είναι καταγεγραμμένο.' },
        ],
      },
      de: {
        title: `Strände auf ${islandName} mit Beachbar | CalmBeach`,
        description: categoryMetaFor('beachbar', islandName, count, 'de'),
        h1: `Strände auf ${islandName} mit Beachbar`,
        intro: `Ein Getränk, ohne den Strand zu verlassen auf ${islandName}? Diese ${count} Strände sind mit Beachbar erfasst. Saison und Öffnungszeiten wechseln, bestätige also vor Ort – und prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} haben eine Beachbar?`, body: 'Die hier gelisteten Strände sind mit einer Bar am Strand selbst erfasst, nicht nur mit einer Taverne im Ort. Bars sind saisonal und wechseln den Betreiber – bestätige es vor der Fahrt.' },
          { heading: 'Ist eine Beachbar dasselbe wie ein organisierter Strand?', body: 'Nein. Ein organisierter Strand hat Liegen und Sonnenschirme, die zu einer Beachbar nicht immer gehören – und manche ruhigen Strände haben nur eine Bar. Öffne einen Strand, um zu sehen, was genau erfasst ist.' },
        ],
      },
      fr: {
        title: `Plages avec bar de plage à ${islandName} | CalmBeach`,
        description: categoryMetaFor('beachbar', islandName, count, 'fr'),
        h1: `Plages avec bar de plage à ${islandName}`,
        intro: `Envie d'un verre sans quitter le sable à ${islandName} ? Ces ${count} plages sont enregistrées avec un bar de plage. Les mois et horaires d'ouverture varient, confirmez sur place — et vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} ont un bar de plage ?`, body: "Les plages listées ici sont enregistrées avec un bar sur la plage même, pas seulement une taverne au village. Les bars sont saisonniers et changent de mains, confirmez avant de faire la route." },
          { heading: 'Un bar de plage, est-ce une plage aménagée ?', body: "Non. Une plage aménagée a transats et parasols, ce qui n'accompagne pas toujours un bar de plage — et certaines plages tranquilles n'ont qu'un bar. Ouvrez une plage pour voir ce qui est exactement enregistré." },
        ],
      },
      it: {
        title: `Spiagge con beach bar a ${islandName} | CalmBeach`,
        description: categoryMetaFor('beachbar', islandName, count, 'it'),
        h1: `Spiagge con beach bar a ${islandName}`,
        intro: `Vuoi bere qualcosa senza lasciare la spiaggia a ${islandName}? Queste ${count} spiagge sono registrate con un beach bar. Mesi e orari di apertura variano, quindi conferma sul posto — e controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} hanno un beach bar?`, body: 'Le spiagge elencate qui sono registrate con un bar sulla spiaggia stessa, non solo con una taverna in paese. I bar sono stagionali e cambiano gestione, quindi conferma prima di metterti in viaggio.' },
          { heading: 'Beach bar significa spiaggia attrezzata?', body: 'No. Una spiaggia attrezzata ha lettini e ombrelloni, che non accompagnano sempre un beach bar — e alcune spiagge tranquille hanno solo un bar. Apri una spiaggia per vedere cosa è registrato esattamente.' },
        ],
      },
    }),
  },
];

// Hand-written, per-region visible intro + H1 for targeted family-beaches pages
// (GR only). These regions have real search demand ("{περιοχή} παραλίες για
// παιδιά") but middling positions; the copy references the page's real beaches
// and explains suitability through our wind-exposure angle. Keyed by region id.
// Every state claim is qualified ("με βάση τον προσανατολισμό / πιο") so it
// passes the honesty guards; only stable, always-true traits are asserted.
// The <h2> family Q&A sections from islandIntents still render below the intro.
const FAMILY_INTRO_OVERRIDES = {
  'thessaly-skopelos': {
    h1: 'Παραλίες για παιδιά στη Σκόπελο',
    intro: `Ψάχνεις παραλίες για παιδιά στη Σκόπελο; Το νησί, καταπράσινο μέχρι τη θάλασσα, κρύβει μια σειρά από μικρούς, οργανωμένους όρμους στη νοτιοανατολική του πλευρά που ταιριάζουν σε οικογένειες με μικρά παιδιά. Ο Στάφυλος και το διπλανό Βελανιό είναι κλειστοί κολπίσκοι με ρηχά νερά, ομαλό βυθό, ξαπλώστρες και beach bar — βολικοί για μια μέρα με παιδιά που θέλουν σκιά και φαγητό κοντά. Λίγο πιο πέρα, η Μηλιά απλώνεται σε μια μεγάλη αμμοβοτσαλώδη ακτή με πάρκινγκ, ενώ το Λιμνονάρι είναι ο μοναδικός πραγματικά αμμώδης, μικρός και κλειστός όρμος — ιδανικός για νήπια που κάνουν τα πρώτα τους μπάνια. Το Γλυστέρι, πιο βόρεια, είναι επίσης οργανωμένο και ρηχό, αλλά κοιτάει προς άλλη κατεύθυνση, οπότε βολεύει άλλες μέρες. Κοινό χαρακτηριστικό όλων: το πευκοδάσος φτάνει σχεδόν ως την ακτή και δίνει φυσική σκιά — κάτι που μετράει όταν τα παιδιά περνούν ώρες στην παραλία — ενώ και οι πέντε απέχουν λίγα λεπτά με το αυτοκίνητο από τη Χώρα, χωρίς κουραστική μετακίνηση με μικρά.

Αυτό που ξεχωρίζει την επιλογή μας δεν είναι η φήμη κάθε παραλίας, αλλά ο προσανατολισμός της. Οι περισσότεροι από αυτούς τους όρμους βλέπουν νοτιοανατολικά και, με βάση τον προσανατολισμό τους, μένουν πιο υπήνεμοι όταν φυσά το μελτέμι από τον βορρά — κάτι που μετράει πολύ όταν κολυμπάνε παιδιά. Η κατάταξη εδώ προκύπτει από πραγματικά δεδομένα έκθεσης στον άνεμο ανά ακτή, όχι από γενικές τουριστικές λίστες.

Πριν ξεκινήσεις, άνοιξε τη σελίδα της παραλίας και δες τον ζωντανό δείκτη ανέμου και κύματος. Αν ο άνεμος γυρίσει νότιος, η πιο προστατευμένη πλευρά αλλάζει, οπότε μια βόρεια επιλογή όπως το Γλυστέρι μπορεί να αποδειχθεί πιο βολική εκείνη τη μέρα. Έτσι διαλέγεις με στοιχεία, όχι στην τύχη.`,
  },
  'ionian-islands-paxos': {
    h1: 'Παραλίες για παιδιά στους Παξούς',
    intro: `Οι Παξοί είναι από τα λίγα μέρη στο Ιόνιο όπου «παραλίες για παιδιά» σημαίνει διάφανα, ρηχά νερά πάνω από λευκό βότσαλο. Το μικρό αυτό νησί δεν έχει πολλές αμμουδιές, γι' αυτό ο πιο οικογενειακός προορισμός του ξεχωρίζει: το Μογγονήσι, στο νότιο άκρο, είναι ένας κλειστός, αμμώδης και πολύ ρηχός όρμος, ενωμένος με τους Παξούς με μια μικρή γέφυρα — από τα λίγα σημεία με άμμο και ομαλό βυθό, ό,τι πρέπει για νήπια. Ο Γιάννας, επίσης οργανωμένος και ρηχός, προσφέρει άμμο με βότσαλο και πάρκινγκ, ενώ το Κανόνι και το Χαράμι, κοντά στον Γάιο, έχουν ξαπλώστρες και εύκολη είσοδο στο νερό για μεγαλύτερα παιδιά. Η Κακή Λαγκάδα κλείνει τη λίστα με beach bar και πάρκινγκ. Καλό είναι να ξέρεις ότι οι Παξοί δεν έχουν αεροδρόμιο· φτάνεις με πλοίο από την Κέρκυρα ή, το καλοκαίρι, από την Πάργα. Κι επειδή οι περισσότερες ακτές είναι βοτσαλωτές, ένα ζευγάρι παπουτσάκια θαλάσσης κάνει την είσοδο στο νερό πιο εύκολη για τα παιδιά.

Το δικό μας κριτήριο δεν είναι απλώς αν μια παραλία είναι «γνωστή», αλλά πώς στέκεται απέναντι στον άνεμο. Στο Ιόνιο κυριαρχεί το καλοκαίρι το απογευματινό βορειοδυτικό μαϊστράλι· όρμοι όπως ο Γιάννας και το Μογγονήσι, με βάση τον προσανατολισμό τους, μένουν πιο υπήνεμοι σε αυτό, ενώ το Χαράμι και το Κανόνι, που βλέπουν βορειοδυτικά, πιάνουν πιο εύκολα το απογευματινό αεράκι. Η κατάταξη προκύπτει από πραγματικά δεδομένα έκθεσης ανά ακτή, όχι από τουριστικές κοινοτοπίες.

Η πρακτική συμβουλή για γονείς: πριν φύγεις, δες τον ζωντανό δείκτη ανέμου στη σελίδα κάθε παραλίας. Αν το μαϊστράλι έχει σηκωθεί το απόγευμα, διάλεξε μια νότια ή ανατολική επιλογή όπως το Μογγονήσι — τα μικρά κουράζονται πιο γρήγορα με το κύμα και τον αέρα απ' ό,τι οι μεγάλοι.`,
  },
  'central-macedonia-pieria-mainland': {
    h1: 'Παραλίες για παιδιά στην Πιερία',
    intro: `«Παραλίες Πιερίας για παιδιά» είναι σχεδόν συνώνυμο με μεγάλες, επίπεδες αμμουδιές που μπαίνουν στο νερό με πολύ ρηχό, ομαλό βυθό — το ιδανικό σκηνικό για οικογένειες. Η ακτή κάτω από τον Όλυμπο είναι στρωμένη με οργανωμένες, αμμώδεις παραλίες που φτάνεις εύκολα με το αυτοκίνητο. Η Ολυμπιακή Ακτή και η Παραλία Κατερίνης είναι οι πιο πολυσύχναστες, με ξαπλώστρες, beach bar, πάρκινγκ και ρηχά νερά που κρατάνε για δεκάδες μέτρα — τα παιδιά περπατάνε πολλή ώρα πριν βαθύνει. Πιο ήσυχες αλλά εξίσου αμμώδεις και ρηχές είναι η Αλυκή, η Πύδνα και οι Αλυκές Κίτρους, όλες οργανωμένες, ενώ η Σκοτίνα δίνει μια πιο χαλαρή εναλλακτική. Είναι από τους πιο βολικούς οικογενειακούς προορισμούς για όποιον ξεκινά από τη Θεσσαλονίκη ή τη βόρεια Ελλάδα — λίγη ώρα δρόμος, με φόντο τον Όλυμπο και παραλίες που πατάς κατευθείαν από το πάρκινγκ. Η αμμώδης, πολύ σταδιακά βαθαίνουσα ακτή είναι ακριβώς το είδος βυθού που ψάχνει ένας γονιός με μικρά.

Εδώ το δικό μας κριτήριο μετράει διπλά. Όλες αυτές οι παραλίες βλέπουν στον ανοιχτό Θερμαϊκό, οπότε η άνεση εξαρτάται από την κατεύθυνση του ανέμου εκείνη τη μέρα. Με βάση τον προσανατολισμό της κάθε ακτής, η Ολυμπιακή Ακτή προστατεύεται περισσότερο από τους βόρειους ανέμους, ενώ η Αλυκή και η Πύδνα κρατούν καλύτερα όταν φυσά από τον νότο. Η κατάταξη δεν βγαίνει από φήμη, αλλά από πραγματικά δεδομένα έκθεσης στον άνεμο ανά σημείο.

Το κλειδί για μια καλή μέρα με παιδιά εδώ είναι η κατεύθυνση του ανέμου. Δες τον ζωντανό δείκτη ανέμου και κύματος στη σελίδα της παραλίας πριν ξεκινήσεις: αν έχει σηκωθεί ο Βαρδάρης —ο βόρειος άνεμος της περιοχής— μια πιο νότια επιλογή θα έχει λιγότερο κύμα στην ακτή, κι ένα ρηχό, πιο μαζεμένο σημείο κάνει τη διαφορά όταν κολυμπάνε μικρά παιδιά.`,
  },
  'central-greece-evia': {
    h1: 'Παραλίες για παιδιά στην Εύβοια',
    intro: `Για οικογένειες από την Αθήνα, η Εύβοια είναι η πιο κοντινή απάντηση στο «παραλίες για παιδιά» — και η βόρεια πλευρά της κρύβει μια ολόκληρη σειρά από ρηχές, οργανωμένες αμμουδιές. Η Παραλία Πευκί είναι η πιο δημοφιλής: μεγάλη, με άμμο και βότσαλο, ξαπλώστρες, beach bar και πάρκινγκ, με ρηχά νερά που βολεύουν παιδιά κάθε ηλικίας. Δίπλα, το Ψαροπούλι (Βασιλικά) και η Χρυσή Ακτή δίνουν παρόμοια εικόνα — αμμώδεις, οργανωμένες, με ομαλό βυθό. Ξεχωριστή περίπτωση το Γρεγολίμανο: ένας κλειστός, ρηχός και οργανωμένος όρμος — από τα πιο μαζεμένα σημεία για νήπια. Αν θέλεις κάτι πιο ήσυχο, η Λευκή Ακτή, οι Αλυκές και η Ψιλή Άμμος δίνουν εξίσου ρηχές, οικογενειακές επιλογές. Η απόσταση διαφέρει και αξίζει να τη μετρήσεις όταν ταξιδεύεις με μικρά: η Χαλκίδα είναι μόλις μία ώρα από την Αθήνα, ενώ το Πευκί και ο βορράς του νησιού θέλουν περίπου τρεις. Στις αμμοβοτσαλωτές, όπως το Πευκί, τα παπουτσάκια θαλάσσης βοηθούν τα παιδικά πόδια.

Αυτό που κάνει τη λίστα μας διαφορετική είναι το κριτήριο πίσω της. Δεν διαλέγουμε με βάση τη φήμη, αλλά με βάση τον προσανατολισμό και την έκθεση κάθε ακτής στον άνεμο. Πολλές από αυτές, όπως το Γρεγολίμανο και η Χρυσή Ακτή, με βάση τον προσανατολισμό τους μένουν πιο υπήνεμες στους βόρειους ανέμους, ενώ άλλες, όπως η Λευκή Ακτή, βολεύουν καλύτερα όταν ο άνεμος γυρίζει. Η κατάταξη στηρίζεται σε πραγματικά δεδομένα, όχι σε γενικές τουριστικές προτάσεις.

Η συμβουλή για τον γονιό: λίγο πριν φύγεις, άνοιξε τη σελίδα της παραλίας και δες τον ζωντανό δείκτη ανέμου. Με τα παιδιά, ένα ρηχό σημείο με λιγότερο κύμα αξίζει περισσότερο από ένα διάσημο όνομα — και η πιο βολική πλευρά της Εύβοιας αλλάζει ανάλογα με τον άνεμο της ημέρας.`,
  },
};

const islandIntentPath = (intent, region, island) => `${intent.pathPrefix}/${encodeURIComponent(regionSlug(region, island))}/`;

// Short chip labels for each guide topic, used in the "beach guides" link blocks
// on region and guide pages (the page <h1>s are too long to use as nav labels).
const INTENT_NAV_LABELS = {
  family:     { en: 'Family beaches',  gr: 'Οικογενειακές',     de: 'Familienstrände',  fr: 'Plages familiales',  it: 'Per famiglie' },
  // `sheltered` is intentionally absent: its label names the region's actual wind
  // regime and is built per-region by `intentNavLabel` below.
  snorkeling: { en: 'Snorkeling',      gr: 'Για snorkeling',    de: 'Schnorcheln',      fr: 'Snorkeling',         it: 'Snorkeling' },
  organized:  { en: 'Organized',       gr: 'Οργανωμένες',       de: 'Organisiert',      fr: 'Aménagées',          it: 'Attrezzate' },
  secluded:   { en: 'Secluded',        gr: 'Απομονωμένες',      de: 'Abgelegen',        fr: 'Isolées',            it: 'Isolate' },
  sunset:     { en: 'Sunset',          gr: 'Για ηλιοβασίλεμα',  de: 'Sonnenuntergang',  fr: 'Coucher de soleil',  it: 'Tramonto' },
  // Added 16/08/2026 WITH the two new guides. Adding an intent without adding it
  // here does not fail anything — `intentNavLabel` falls back to the topic KEY,
  // so every region and guide page silently linked the new articles as "sandy"
  // and "beachbar". Caught by reading the built HTML, not by a gate.
  sandy:      { en: 'Sandy',           gr: 'Με άμμο',           de: 'Sandstrände',      fr: 'De sable',           it: 'Di sabbia' },
  beachbar:   { en: 'Beach bars',      gr: 'Με beach bar',      de: 'Mit Beachbar',     fr: 'Avec bar',           it: 'Con beach bar' },
};

// The meltemi is an AEGEAN wind. Labelling the Ionian / Ambracian / Thermaic
// sheltered guides "meltemi options" was plain wrong — Arta, Ithaca, Corfu and
// the rest run on the NW maistros, and their article bodies already say so
// (windWordsFor). Only the nav labels were still hard-coded, so the chip
// contradicted the page it linked to. Built from the same LOCAL_WIND_* tables.
const shelteredNavLabel = (regionId, language) => {
  // Greek needs the inflected form ("στον μαΐστρο"), not the nominative.
  if (language === 'gr') return `Επιλογές ${localWindLabelFor(regionId).elIn}`;
  const atoms = LOCAL_WIND_ATOMS[getRegionWindContext(regionId)];
  const word = atoms.word[language] || atoms.word.en;
  if (language === 'de') return `${word}-Optionen`;
  if (language === 'fr') return `Options ${word}`;
  if (language === 'it') return `Opzioni ${word}`;
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} options`;
};

// Every intent except `sheltered` (whose label is built per-region) MUST have an
// entry in INTENT_NAV_LABELS. Adding a guide topic and forgetting the label used
// to fall through to the topic KEY, which shipped "sandy" and "beachbar" as the
// visible link text on every region and beach page on 16/08/2026. A missing label
// is a build error now, not a silently ugly link: this runs once per build and
// costs nothing, and there is no correct page to publish without it.
for (const intent of islandIntents) {
  if (intent.key === 'sheltered') continue;
  if (!INTENT_NAV_LABELS[intent.key]) {
    throw new Error(
      `Guide topic "${intent.key}" has no INTENT_NAV_LABELS entry. Every region and beach page ` +
        `would link it with the raw key as its visible text. Add all five languages.`
    );
  }
}

const intentNavLabel = (intentKey, regionId, language) => {
  if (intentKey === 'sheltered') return shelteredNavLabel(regionId, language);
  return INTENT_NAV_LABELS[intentKey]?.[language] || INTENT_NAV_LABELS[intentKey]?.en || intentKey;
};

// The guide articles that were actually generated for this island (same ≥MIN
// gate as the page generation), so region/guide pages only link to pages that
// exist. `excludeKey` drops the current page from a "more guides" cross-link.
// Whether a guide page WILL be built for this island+intent. Must stay identical
// to the generation loop in main(), or a link points at a 404 (too few guides
// linked is the milder failure, and that is exactly what happened): the loop
// scores `sheltered` off the baked `shelteredFromLocalWind` flag with a
// proportional 25% gate, while this function used `intent.match` — the defensive
// `protectedFrom` fallback — with the flat minimum. The two disagreed on 9
// regions (Arki, Arta, Donousa, Erikoussa, Mathraki, Othonoi, Polyaigos,
// Pserimos, Xanthi), whose sheltered guide was built and then linked from
// nowhere on its own parent page. Found 05/08/2026 by scripts/auditRegionPages.mjs.
const intentPredicateFor = intent =>
  intent.key === 'sheltered'
    ? (beach => beach.shelteredFromLocalWind === true)
    : (beach => intent.match(beach));

const islandIntentQualifies = (intent, beaches) => {
  const valid = beaches.filter(b => Number.isInteger(b.id) && b.name);
  const matched = valid.filter(intentPredicateFor(intent));
  if (matched.length === 0) return false;
  const min = intentMinFor(intent.key);
  if (intent.key === 'sheltered') {
    return matched.length >= min || (valid.length > 0 && matched.length / valid.length >= 0.25);
  }
  return Math.min(matched.length, ISLAND_INTENT_CAP) >= min;
};

// `beach` (optional): on a beach page, the guides THIS beach belongs to come first
// and are marked — a Rhodes snorkeling beach now links its own snorkeling guide
// up front instead of the same five region-level chips every beach page shows.
// Same predicates as page generation, so a marked chip never points at a guide
// the beach is absent from.
const getIslandGuides = (island, region, locale, excludeKey = null, beach = null) => {
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const guides = islandIntents
    .filter(intent => intent.key !== excludeKey)
    .filter(intent => islandIntentQualifies(intent, beaches))
    .map(intent => ({
      key: intent.key,
      href: localizedPath(islandIntentPath(intent, region, island), locale),
      label: intentNavLabel(intent.key, region.id, locale.language),
      matches: beach ? intentPredicateFor(intent)(beach) === true : false,
    }));
  return beach ? guides.sort((a, b) => Number(b.matches) - Number(a.matches)) : guides;
};

// A chip-list "beach guides" block linking to the island's guide articles —
// gives users a clickable way in and threads internal link equity to the guides
// (they were sitemap-only before). Returns '' when the island has no guides.
// Label for the chip that leads to the national guides hub — the one entry point
// present on every page that renders this block, so no guide is more than two
// clicks from anywhere on the site.
const ALL_GUIDES_LABEL = { en: 'All beach guides →', gr: 'Όλοι οι οδηγοί →' };

const renderIslandGuides = (island, region, locale, excludeKey, heading, beach = null) => {
  const guides = getIslandGuides(island, region, locale, excludeKey, beach);
  const items = guides.map(g => g.matches
    ? `<li style="margin:0;"><a href="${escapeHtml(g.href)}" style="display:inline-block;border:1px solid #0e7490;border-radius:999px;padding:7px 13px;background:#ecfeff;color:#0e7490;text-decoration:none;font-weight:800;font-size:14px;">✓ ${escapeHtml(g.label)}</a></li>`
    : `<li style="margin:0;"><a href="${escapeHtml(g.href)}" style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;padding:7px 13px;background:white;color:#075985;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(g.label)}</a></li>`
  ).join('');
  // The hub link renders even for islands with no guides of their own — that is
  // exactly the page where a reader has nowhere else to go. But the hub itself is
  // en + el only, so /de//fr//it/ pages must not link to a URL that was never
  // written (same rule as NATIONAL_GUIDE_LINKS).
  const hubLabel = ALL_GUIDES_LABEL[locale.language] || ALL_GUIDES_LABEL.en;
  const hubItem = BASE_LOCALE_IDS.has(locale.id)
    ? `<li style="margin:0;"><a href="${escapeHtml(localizedPath(GUIDES_HUB_PATH, locale))}" style="display:inline-block;border:1px solid #0e7490;border-radius:999px;padding:7px 13px;background:#ecfeff;color:#0e7490;text-decoration:none;font-weight:800;font-size:14px;">${escapeHtml(hubLabel)}</a></li>`
    : '';
  if (guides.length === 0 && !hubItem) return '';
  return `
        <section style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">${items}${hubItem}</ul>
        </section>`;
};

// One sentence per guide, so the region page states what each child page is FOR
// instead of dropping five unexplained chips. Chips stay on the guide pages
// (there the reader already knows the vocabulary); the region page is the entry
// point, and until 05/08/2026 it linked its own guides once, in passing, while
// every guide linked back to it four times. That asymmetry is part of why Google
// read the guides as the primary pages for "{region} beaches".
const INTENT_SECTION_BLURB = {
  sheltered: {
    en: 'The coves that face away from the prevailing wind — the shortlist for a windy day.',
    gr: 'Οι ακτές που κοιτούν μακριά από τον άνεμο που επικρατεί — η μικρή λίστα για μέρα με αέρα.',
    de: 'Die Buchten, die vom vorherrschenden Wind abgewandt liegen — die Auswahl für einen windigen Tag.',
    fr: 'Les criques tournées à l\'opposé du vent dominant — la liste courte pour un jour de vent.',
    it: 'Le insenature orientate lontano dal vento dominante — la lista breve per una giornata ventosa.',
  },
  family: {
    en: 'Organised, not hard to reach, and recorded as shallow in our data.',
    gr: 'Οργανωμένες, χωρίς δύσκολη πρόσβαση, και καταγεγραμμένες ως ρηχές στα δεδομένα μας.',
    de: 'Bewirtschaftet, gut erreichbar und in unseren Daten als flach erfasst.',
    fr: 'Aménagées, faciles d\'accès et enregistrées comme peu profondes dans nos données.',
    it: 'Attrezzate, facili da raggiungere e registrate come basse nei nostri dati.',
  },
  snorkeling: {
    en: 'Rockier seabed and clearer water, where there is something to look at underwater.',
    gr: 'Πιο βραχώδης βυθός και καθαρότερο νερό, εκεί που έχει κάτι να δεις από κάτω.',
    de: 'Felsiger Grund und klareres Wasser, wo es unter Wasser etwas zu sehen gibt.',
    fr: 'Fond plus rocheux et eau plus claire, là où il y a quelque chose à voir sous l\'eau.',
    it: 'Fondale più roccioso e acqua più limpida, dove sott\'acqua c\'è qualcosa da vedere.',
  },
  organized: {
    en: 'Sunbeds, umbrellas and somewhere to eat or drink nearby.',
    gr: 'Ξαπλώστρες, ομπρέλες και κάτι για φαγητό ή ποτό κοντά.',
    de: 'Liegen, Sonnenschirme und etwas zu essen oder trinken in der Nähe.',
    fr: 'Transats, parasols et de quoi manger ou boire à proximité.',
    it: 'Lettini, ombrelloni e qualcosa da mangiare o bere nelle vicinanze.',
  },
  secluded: {
    en: 'Quieter and harder to reach — dirt track, a walk, or boat only.',
    gr: 'Πιο ήσυχες και πιο δύσκολες — χωματόδρομος, με τα πόδια ή μόνο με σκάφος.',
    de: 'Ruhiger und schwerer erreichbar — Schotterpiste, zu Fuß oder nur per Boot.',
    fr: 'Plus calmes et plus difficiles d\'accès — piste, à pied ou seulement en bateau.',
    it: 'Più tranquille e più difficili da raggiungere — sterrato, a piedi o solo in barca.',
  },
  sunset: {
    en: 'West-facing, so the sun goes down over the water in front of you.',
    gr: 'Βλέπουν δυτικά, οπότε ο ήλιος δύει πάνω από το νερό μπροστά σου.',
    de: 'Nach Westen ausgerichtet, die Sonne geht vor dir über dem Wasser unter.',
    fr: 'Orientées à l\'ouest : le soleil se couche sur l\'eau devant vous.',
    it: 'Esposte a ovest: il sole tramonta sull\'acqua davanti a te.',
  },
};

const REGION_GUIDE_SECTION = {
  en: { heading: 'Pick by what you are looking for', hub: 'All beach guides' },
  gr: { heading: 'Διάλεξε με το τι ψάχνεις', hub: 'Όλοι οι οδηγοί παραλιών' },
  de: { heading: 'Wähle nach dem, was du suchst', hub: 'Alle Strandführer' },
  fr: { heading: 'Choisissez selon ce que vous cherchez', hub: 'Tous les guides plages' },
  it: { heading: 'Scegli in base a cosa cerchi', hub: 'Tutte le guide' },
};

const renderRegionGuideSection = (island, region, locale) => {
  const guides = getIslandGuides(island, region, locale);
  const language = locale.language;
  const copy = REGION_GUIDE_SECTION[language] || REGION_GUIDE_SECTION.en;
  const items = guides.map(g => {
    const blurb = INTENT_SECTION_BLURB[g.key]?.[language] || INTENT_SECTION_BLURB[g.key]?.en || '';
    return `
            <li style="margin:0;">
              <a href="${escapeHtml(g.href)}" style="color:#075985;font-weight:800;text-decoration:none;font-size:16px;">${escapeHtml(g.label)}</a>
              ${blurb ? `<p style="margin:2px 0 0;font-size:14.5px;line-height:1.55;color:#475569;">${escapeHtml(blurb)}</p>` : ''}
            </li>`;
  }).join('');
  // The hub is en + el only, so /de//fr//it/ must not link a page never written
  // (same rule as renderIslandGuides and NATIONAL_GUIDE_LINKS).
  const hubItem = BASE_LOCALE_IDS.has(locale.id)
    ? `
            <li style="margin:0;"><a href="${escapeHtml(localizedPath(GUIDES_HUB_PATH, locale))}" style="color:#0e7490;font-weight:800;text-decoration:none;font-size:16px;">${escapeHtml(copy.hub)} →</a></li>`
    : '';
  if (!items && !hubItem) return '';
  return `
        <section style="margin:0 0 26px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(copy.heading)}</h2>
          <ul style="display:grid;gap:12px;margin:0;padding:0;list-style:none;">${items}${hubItem}</ul>
        </section>`;
};

// Greece-wide guide backlinks for individual beach pages. Each beach page only
// linked up to its own region's guides, never to the national landing pages
// (so national intent -> beach was one-directional). Only emitted for locales
// where those pages exist (en root + el); /de//fr//it would 404.
const NATIONAL_GUIDE_LINKS = [
  { path: '/best-beaches-greece-today/', label: { en: 'Compare beach conditions', gr: 'Σύγκριση συνθηκών' } },
  // The one national guide that is about a specific regional wind. It is correct
  // about itself, but offering it on an Ionian or Thermaic beach page pushes a
  // wind that never blows there — `aegeanOnly` keeps it where it applies.
  { path: '/sheltered-beaches-meltemi/', label: { en: 'Meltemi wind options', gr: 'Επιλογές με μελτέμι' }, aegeanOnly: true },
  { path: '/family-beaches-greece/', label: { en: 'Family beaches', gr: 'Οικογενειακές' } },
  { path: '/accessible-beaches-greece/', label: { en: 'Accessible (Seatrac)', gr: 'Προσβάσιμες ΑμεΑ' } },
  { path: '/beach-camping-greece/', label: { en: 'Beach camping', gr: 'Κάμπινγκ σε παραλίες' } },
];
// `regionId` omitted (e.g. the national hub) keeps every link.
const nationalGuideLinksFor = regionId =>
  NATIONAL_GUIDE_LINKS.filter(g => !g.aegeanOnly || !regionId || getRegionWindContext(regionId) === 'aegean');

const renderNationalGuides = (locale, heading, regionId) => {
  if (!BASE_LOCALE_IDS.has(locale.id)) return '';
  const items = nationalGuideLinksFor(regionId).map(g =>
    `<li style="margin:0;"><a href="${escapeHtml(localizedPath(g.path, locale))}" style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;padding:7px 13px;background:white;color:#075985;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(g.label[locale.language] || g.label.en)}</a></li>`
  ).join('');
  return `
        <section style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Pages that used to exist as thin generic gateways and were consolidated into a
// kept, useful page. 301 so the already-submitted URLs never 404; they are also
// excluded from the sitemap (they are simply absent from seoLandingPages now).
const landingRedirects = [
  { from: '/where-to-swim-greece-today/', to: '/best-beaches-greece-today/' },
  { from: '/calm-beaches-greece-windy-day/', to: '/sheltered-beaches-meltemi/' },
  { from: '/best-beaches-milos-today/', to: '/beaches/milos/' },
];

const breadcrumbJsonLd = items => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

// FAQPage from {q, a} pairs. Answers must restate facts already visible on the
// page (dl, amenity chips, narrative, landing sections) — never volatile data.
const faqJsonLd = pairs => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: pairs.map(pair => ({
    '@type': 'Question',
    name: pair.q,
    acceptedAnswer: { '@type': 'Answer', text: pair.a },
  })),
});

const outputDirForRoute = routePath => path.join(distDir, routePath.replace(/^\/+/, ''));

const beachTypeLabels = new Map([
  ['sandy', { en: 'Sandy', gr: 'Αμμώδης', de: 'Sandig', fr: 'Sablonneuse', it: 'Sabbiosa' }],
  ['pebbles', { en: 'Pebbles', gr: 'Βότσαλα', de: 'Kiesel', fr: 'Galets', it: 'Ciottoli' }],
  ['sandy-pebbles', { en: 'Sand & pebbles', gr: 'Άμμος & βότσαλα', de: 'Sand & Kiesel', fr: 'Sable et galets', it: 'Sabbia e ciottoli' }],
  ['rocky', { en: 'Rocky', gr: 'Βραχώδης', de: 'Felsig', fr: 'Rocheuse', it: 'Rocciosa' }],
]);

const accessTypeLabels = new Map([
  ['asphalt_road', { en: 'Easy road access', gr: 'Πρόσβαση με άσφαλτο', de: 'Einfache Zufahrt (Asphalt)', fr: 'Accès facile (route goudronnée)', it: 'Accesso facile (asfalto)' }],
  ['passable_dirt_road', { en: 'Passable dirt road', gr: 'Χωματόδρομος (βατός)', de: 'Befahrbarer Feldweg', fr: 'Piste praticable', it: 'Sterrato percorribile' }],
  ['difficult_dirt_road', { en: 'Difficult dirt road', gr: 'Δύσκολος χωματόδρομος', de: 'Schwieriger Feldweg', fr: 'Piste difficile', it: 'Sterrato difficile' }],
  ['4x4_only', { en: '4x4 access', gr: 'Πρόσβαση με 4x4', de: 'Nur mit 4x4', fr: 'Uniquement en 4x4', it: 'Solo con 4x4' }],
  ['hiking_path_easy', { en: 'Easy path', gr: 'Εύκολο μονοπάτι', de: 'Einfacher Fußweg', fr: 'Sentier facile', it: 'Sentiero facile' }],
  ['hiking_path_difficult', { en: 'Difficult access (path)', gr: 'Δύσκολη πρόσβαση (μονοπάτι)', de: 'Schwieriger Zugang (Pfad)', fr: 'Accès difficile (sentier)', it: 'Accesso difficile (sentiero)' }],
  ['boat_only', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος', de: 'Nur per Boot', fr: 'Accès uniquement en bateau', it: 'Solo in barca' }],
]);

const accessibilityLabels = new Map([
  ['EASY', { en: 'Easy access', gr: 'Εύκολη πρόσβαση', de: 'Einfacher Zugang', fr: 'Accès facile', it: 'Accesso facile' }],
  ['MODERATE', { en: 'Moderate access', gr: 'Μέτρια πρόσβαση', de: 'Mittlerer Zugang', fr: 'Accès modéré', it: 'Accesso moderato' }],
  ['DIFFICULT', { en: 'Difficult access', gr: 'Δύσκολη πρόσβαση', de: 'Schwieriger Zugang', fr: 'Accès difficile', it: 'Accesso difficile' }],
  ['BOAT_ONLY', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος', de: 'Nur per Boot', fr: 'Accès uniquement en bateau', it: 'Solo in barca' }],
]);

const readableLabel = (labels, language) => labels?.[language] || labels?.en;

const readableBeachType = (beach, language = 'en') => readableLabel(beachTypeLabels.get(beach?.beachType), language);

const readableAccess = (beach, language = 'en') => (
  readableLabel(accessTypeLabels.get(beach?.staticLabels?.accessType), language) ||
  readableLabel(accessibilityLabels.get(beach?.accessibility), language)
);

const renderDefinitionRow = (term, description) => (
  description
    ? `<dt style="font-weight:700;">${escapeHtml(term)}</dt><dd style="margin:0;">${escapeHtml(description)}</dd>`
    : ''
);

// --- Article imagery -----------------------------------------------------------
// Beach photos live outside the beach records, in a flat id -> [url] map. The
// flat keying is safe: beach ids are globally unique (verified 2842 ids, 0
// cross-region collisions), unlike the per-region keying beachStories needs.
const beachPhotosById = await readJson(path.join(projectRoot, 'data', 'beachPhotosById.generated.json'));
const beachPhotoBlocklist = new Set(
  (await readJson(path.join(projectRoot, 'data', 'beachPhotoBlocklist.json'))).ids || [],
);
// Photos our own visitors sent and we approved (scripts/syncApprovedPhotos.mjs,
// which runs earlier in `npm run build`). Read defensively: a fresh checkout has
// an empty map, and the file is regenerated on every build rather than hand-kept.
const beachPhotosUgc = await readJson(path.join(projectRoot, 'data', 'beachPhotosUgc.generated.json')) || {};

// Wave climatology (scripts/buildWaveClimatology.py) — how often the sea in front of each
// beach is actually calm, month by month, from 10 years of Copernicus reanalysis.
//
// OPTIONAL ON PURPOSE. The file is produced by a Python script that needs a Copernicus
// account, so a fresh clone, a CI box and Netlify's builder will not have it. Missing file
// means the guides simply omit that one section — it must never break a build that has
// nothing to do with it. `withSeaSeasonSection` returns the content untouched when the
// climatology is null, so there is exactly one behaviour to reason about.
const waveClimatology = await readJson(
  path.join(projectRoot, 'data', 'waveClimatology.generated.json'),
).catch(() => null);
if (!waveClimatology) {
  console.warn('  (no waveClimatology.generated.json — guides will omit the season section)');
}
// Water temperature per beach, per month (scripts/buildWaterClimatology.py). Optional for the
// same reason as the wave file: it needs a Copernicus account to produce, and a clone or a
// CI box has neither. Missing file simply drops that one paragraph.
const waterClimatology = await readJson(
  path.join(projectRoot, 'data', 'waterClimatology.generated.json'),
).catch(() => null);
if (!waterClimatology) {
  console.warn('  (no waterClimatology.generated.json — guides will omit the water section)');
}

// Cards are ~230px wide, so requesting the 800px original for every one of them
// would be the single heaviest thing on the page. Wikimedia's Special:Redirect
// takes a width param, so ask for what we actually paint (2x for retina).
// Moved to utils/photoSizing.mjs on 30/08/2026 so the React app can size photos the same
// way instead of asking for width=800 everywhere; imported at the top of this file.

// CC BY / CC BY-SA REQUIRE author + licence + a link to the source file page.
// The photo map stores only the URL, so join it to the generated credit block in
// public/IMAGE_CREDITS.txt ("File: <name> | <author> | <licence> | <url>").
// A photo we cannot attribute is simply not rendered — the licence is not
// optional, and a blanket credits page does not satisfy CC BY on its own.
const CREDIT_WAIVED = /(public\s*domain|^cc0|\bcc0\b)/i;

// Same URL -> Commons file-title extraction as scripts/checkPhotoUrls.mjs.
const commonsFileTitle = url => {
  const redirect = url.match(/Special:Redirect\/file\/([^&]+)/);
  if (redirect) return decodeURIComponent(redirect[1]);
  if (/upload\.wikimedia\.org/.test(url)) {
    const segs = url.split('?')[0].split('/');
    return decodeURIComponent(/\/thumb\//.test(url) ? segs[segs.length - 2] : segs[segs.length - 1]);
  }
  return null;
};

const photoCreditsByFile = new Map(
  (await readFile(path.join(projectRoot, 'public', 'IMAGE_CREDITS.txt'), 'utf8'))
    .split('\n')
    .map(line => line.match(/^File:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\S+)\s*$/))
    .filter(Boolean)
    .map(([, file, author, license, sourceUrl]) => [file, { author, license, sourceUrl }]),
);

// A visitor's own photo, credited to them by name. Checked BEFORE the Commons
// library for the same reason the app checks it first: it is newer, it is
// verifiably of this beach, and a contributor promised their photo would appear
// on the card has to find it there — including on the static page Google reads.
//
// The credit is built here rather than looked up in photoCredit.ts because the
// prerenderer is plain Node and cannot import the app's TypeScript.
const UGC_PHOTO_WORD = { en: 'Photo', gr: 'Φωτογραφία', de: 'Foto', fr: 'Photo', it: 'Foto' };
const UGC_VISITOR = {
  en: 'from a visitor', gr: 'από επισκέπτη', de: 'von einem Besucher',
  fr: 'd’un visiteur', it: 'da un visitatore',
};

const beachUgcCardPhoto = (beach, language = 'en') => {
  const id = String(beach?.id ?? '');
  if (!id || beachPhotoBlocklist.has(id)) return null;
  const entry = Array.isArray(beachPhotosUgc[id]) ? beachPhotosUgc[id].find(item => item && item.url) : null;
  if (!entry) return null;

  const word = UGC_PHOTO_WORD[language] || UGC_PHOTO_WORD.en;
  const name = entry.credit || UGC_VISITOR[language] || UGC_VISITOR.en;
  return {
    // Already 1600px and under 550 KB when it was uploaded — there is no resize
    // parameter to add, and no second size to offer.
    src: entry.url,
    src2x: entry.url,
    credit: { author: name, license: '', sourceUrl: '' },
    creditLabel: `${word}: ${name}`,
    creditRequired: true,
    isUgc: true,
  };
};

const beachCardPhoto = (beach, language = 'en') => {
  const ugc = beachUgcCardPhoto(beach, language);
  if (ugc) return ugc;

  const id = String(beach?.id ?? '');
  if (!id || beachPhotoBlocklist.has(id)) return null;
  const urls = beachPhotosById[id];
  const url = Array.isArray(urls) ? urls.find(Boolean) : null;
  if (!url) return null;
  const credit = photoCreditsByFile.get(commonsFileTitle(url) || '') || null;
  // No credit record -> we cannot attribute it -> we do not publish it.
  if (!credit) return null;
  return {
    src: sizedPhotoUrl(url, 400),
    src2x: sizedPhotoUrl(url, 800),
    credit,
    creditRequired: !CREDIT_WAIVED.test(credit.license || ''),
  };
};

// The region hero. resolveRegionOgImagePath only knows about .jpg/.webp because
// og:image needs a universally-decodable format, but the build also emits .avif
// derivatives — serve those first and let <picture> fall back.
const heroSourcesFor = (imagePath, publicAssets) => {
  const base = String(imagePath || '').replace(/\.(jpe?g|webp|avif)$/i, '');
  const pick = ext => (publicAssets.has(`${base}.${ext}`) ? `${base}.${ext}` : null);
  return { avif: pick('avif'), webp: pick('webp'), jpg: pick('jpg') || imagePath };
};

// Only 74 regions have a -bg photo, and everything else silently resolved to
// defaultOgImagePath — i.e. Sarakiniko on Milos. That put a Milos cliff at the
// top of the Halkidiki, Lemnos and Samos articles, which is exactly the kind of
// "close enough" image this project refuses everywhere else. So: use the region
// photo only when it really is the region's, otherwise promote one of the
// article's OWN beach photos, and if there is neither, run the hero with no
// photograph at all rather than a borrowed one.
// Careful: Milos and Polyaigos map to defaultOgImagePath *deliberately* —
// Sarakiniko IS their coastline. A bare `!== defaultOgImagePath` test would
// strip the one island the default legitimately belongs to, so an explicit
// override always counts as region-specific.
const heroIsRegionSpecific = (imagePath, region, island) => (
  imagePath !== defaultOgImagePath
  || regionOgImageOverrides.get(region?.id) === imagePath
  || regionOgImageOverrides.get(island?.id) === imagePath
);

const renderHeroPicture = (sources, alt) => {
  if (!sources) return '';
  if (sources.remote) {
    return `<img class="cb-hero-img" src="${escapeHtml(sources.remote)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" width="1200" height="630" fetchpriority="high" decoding="async">`;
  }
  return `
          <picture>
            ${sources.avif ? `<source srcset="${escapeHtml(sources.avif)}" type="image/avif">` : ''}
            ${sources.webp ? `<source srcset="${escapeHtml(sources.webp)}" type="image/webp">` : ''}
            <img class="cb-hero-img" src="${escapeHtml(sources.jpg)}" alt="${escapeHtml(alt)}" width="1200" height="630" fetchpriority="high" decoding="async">
          </picture>`;
};

// A hero drawn from the article's own beaches, used when the region has no
// background photo of its own.
const heroFromBeaches = beaches => {
  for (const beach of beaches) {
    const photo = beachCardPhoto(beach);
    if (photo) return { remote: sizedPhotoUrl(photo.src, 1200), credit: photo.credit, beach };
  }
  return null;
};

/**
 * The share/preview image for ONE beach: its own photo when we have one.
 *
 * Every beach page used to advertise the regional background instead, and for the
 * 36 regions with no `-bg` asset that resolved to defaultOgImagePath — so a beach
 * in Achaia offered a cliff on Milos to Facebook, WhatsApp, Google Discover and the
 * sitemap's <image:loc>. The picture a link preview shows is most of the reason
 * anyone taps it, and ours was of somewhere else entirely.
 *
 * 1200px because that is what the social crawlers want; the same photo is already
 * on the page at 400/800 (renderBeachPhotoFigure), so this adds no new source and
 * no new licence question — beachCardPhoto has already refused anything we cannot
 * attribute. Regions keep the regional background: a region page is about the
 * region, and picking one of its beaches to represent it would be a choice we
 * cannot defend.
 */
const beachOgImage = beach => {
  const photo = beachCardPhoto(beach);
  return photo ? sizedPhotoUrl(photo.src, 1200) : null;
};

// Honest, computed facts for the hero chips — counted from the very beaches the
// page lists, so they can never drift from the content below them.
const heroStatLabels = {
  beaches:   { en: 'beaches', gr: 'παραλίες', de: 'Strände', fr: 'plages', it: 'spiagge' },
  easyAcces: { en: 'easy access', gr: 'εύκολη πρόσβαση', de: 'leicht erreichbar', fr: 'accès facile', it: 'accesso facile' },
  organized: { en: 'organized', gr: 'οργανωμένες', de: 'organisiert', fr: 'aménagées', it: 'attrezzate' },
  withPhoto: { en: 'with photos', gr: 'με φωτογραφία', de: 'mit Fotos', fr: 'avec photos', it: 'con foto' },
};

const heroStatsFor = (beaches, language) => {
  const stat = (value, key) => (value > 0
    ? `<li class="cb-stat"><b>${value}</b><span>${escapeHtml(heroStatLabels[key][language] || heroStatLabels[key].en)}</span></li>`
    : '');
  const easy = beaches.filter(b => b.staticLabels?.accessType === 'EASY_WALK' || b.accessibility === 'easy').length;
  const organized = beaches.filter(b => b.amenities?.organized === true).length;
  const photos = beaches.filter(b => beachCardPhoto(b)).length;
  return [
    stat(beaches.length, 'beaches'),
    stat(easy, 'easyAcces'),
    stat(organized, 'organized'),
    stat(photos, 'withPhoto'),
  ].filter(Boolean).join('');
};

const renderBeachSummaryMeta = (beach, language = 'en') => {
  const labels = [
    readableBeachType(beach, language),
    readableAccess(beach, language),
  ].filter(Boolean);

  return labels.length > 0
    ? `<span style="display:block;margin-top:4px;color:#475569;font-size:14px;">${escapeHtml(labels.join(' - '))}</span>`
    : '';
};

const regionSlug = (region, island) => normalizeSlug(
  localized(region?.name, '', 'en') || localized(island?.name, '', 'en') || region?.id
);

const regionPath = (region, island) => `/beaches/${encodeURIComponent(regionSlug(region, island))}/`;

const beachPath = (region, island, beach) => (
  `${regionPath(region, island)}${beach.id}-${normalizeSlug(displayName(beach.name, `beach-${beach.id}`, 'en'))}/`
);

const legacyBeachPaths = (region, island, beach) => {
  const currentPath = beachPath(region, island, beach);
  const slugs = Array.isArray(beach.legacySlugs) ? beach.legacySlugs : [];

  return Array.from(new Set(slugs
    .map(slug => `${regionPath(region, island)}${beach.id}-${normalizeSlug(slug)}/`)
    .filter(pathName => pathName !== currentPath)));
};

const legacyRegionPath = regionId => `/beaches/${encodeURIComponent(regionId)}/`;

const setOrAppendHeadTag = (html, pattern, tag) => {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
};

const injectBeachHead = (html, meta) => {
  let nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  if (meta.htmlLang) {
    nextHtml = nextHtml.replace(/<html\b([^>]*)>/i, (match, attrs) => {
      if (/\slang="[^"]*"/i.test(attrs)) {
        return match.replace(/\slang="[^"]*"/i, ` lang="${escapeHtml(meta.htmlLang)}"`);
      }

      return `<html lang="${escapeHtml(meta.htmlLang)}"${attrs}>`;
    });
  }

  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="robots" content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${escapeHtml(meta.robots || defaultRobotsContent)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:type" content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType || 'article')}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:locale" content="[^"]*"\s*\/?>/i,
    `<meta property="og:locale" content="${escapeHtml(meta.ogLocale || 'en_US')}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );

  if (meta.imageUrl) {
    const imageType = imageTypeFromPath(meta.imageUrl);
    const imageAlt = meta.imageAlt || meta.title;

    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image:secure_url" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(meta.imageUrl)}" />`
    );
    if (imageType) {
      nextHtml = setOrAppendHeadTag(
        nextHtml,
        /<meta property="og:image:type" content="[^"]*"\s*\/?>/i,
        `<meta property="og:image:type" content="${escapeHtml(imageType)}" />`
      );
    }
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image:alt" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:card" content="[^"]*"\s*\/?>/i,
      '<meta name="twitter:card" content="summary_large_image" />'
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:image" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
    );
  }

  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`
  );
  nextHtml = nextHtml.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+"\s*\/?>/gi, '');
  nextHtml = nextHtml.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  const jsonLd = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
  const extraHead = [
    ...(meta.alternateUrls || []).map(alternate => (
      `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}" />`
    )),
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ');

  return nextHtml.replace('</head>', `    ${extraHead}\n  </head>`);
};

const staticFallbackCopy = {
  en: {
    brand: 'CalmBeach Greece',
    region: 'Region',
    beachType: 'Beach type',
    access: 'Access',
    coordinates: 'Coordinates',
    webcam: 'Live webcam',
    webcamNote: 'third-party camera, opens in a new tab',
    organizedBeach: 'Organized beach',
    beachBar: 'Beach bar',
    sunbeds: 'Sunbeds',
    parking: 'Parking',
    foodNearby: 'Food nearby',
    snackCanteen: 'Canteen',
    familyFriendly: 'Family friendly',
    quiet: 'Quiet',
    snorkeling: 'Snorkeling',
    openAppBeach: "Open the app for live recommendation score, wind exposure, waves, best time of day and nearby alternatives.",
    openAppRegion: "Weather and sea conditions change. CalmBeach uses the app view for live beach recommendations.",
    viewBeach: 'View this beach in CalmBeach Greece',
    viewRegion: islandName => `View ${islandName} in CalmBeach Greece`,
    regionHeading: islandName => `${islandName} beaches`,
    regionDescription: (islandName, count) => `Compare ${count} beaches in ${islandName}, Greece by wind, waves, weather, beach exposure, access and beach type before you choose where to swim.`,
    home: 'Greek beaches',
    nearbyHeading: islandName => `Other beaches in ${islandName}`,
    aboutHeading: 'About this beach',
  },
  gr: {
    brand: 'Calm Beach Greece',
    region: 'Περιοχή',
    beachType: 'Τύπος παραλίας',
    access: 'Πρόσβαση',
    coordinates: 'Συντεταγμένες',
    webcam: 'Live κάμερα',
    webcamNote: 'κάμερα τρίτου, ανοίγει σε νέα καρτέλα',
    organizedBeach: 'Οργανωμένη παραλία',
    beachBar: 'Beach bar',
    sunbeds: 'Ξαπλώστρες',
    parking: 'Parking',
    foodNearby: 'Φαγητό κοντά',
    snackCanteen: 'Καντίνα',
    familyFriendly: 'Κατάλληλη για οικογένειες',
    quiet: 'Πιο ήσυχη',
    snorkeling: 'Snorkeling',
    openAppBeach: 'Άνοιξε την εφαρμογή για live σκορ, άνεμο, κύμα, καλύτερη ώρα και κοντινές εναλλακτικές.',
    openAppRegion: 'Ο καιρός και η θάλασσα αλλάζουν μέσα στη μέρα. Το Calm Beach δείχνει live προτάσεις παραλιών μέσα στην εφαρμογή.',
    viewBeach: 'Δες την παραλία στο Calm Beach Greece',
    viewRegion: islandName => `Δες τις παραλίες για ${islandName} στο Calm Beach Greece`,
    regionHeading: islandName => `Παραλίες: ${islandName}`,
    regionDescription: (islandName, count) => `Σύγκρινε ${count} παραλίες σε ${islandName} με βάση άνεμο, κύμα, καιρό, έκθεση, πρόσβαση και τύπο παραλίας πριν διαλέξεις πού να κολυμπήσεις.`,
    home: 'Παραλίες Ελλάδας',
    nearbyHeading: islandName => `Άλλες παραλίες σε ${islandName}`,
    aboutHeading: 'Σχετικά με την παραλία',
  },
  de: {
    brand: 'CalmBeach Griechenland',
    region: 'Region',
    beachType: 'Strandtyp',
    access: 'Zugang',
    coordinates: 'Koordinaten',
    webcam: 'Live-Webcam',
    webcamNote: 'Kamera eines Drittanbieters, öffnet in neuem Tab',
    organizedBeach: 'Organisierter Strand',
    beachBar: 'Beach Bar',
    sunbeds: 'Liegen',
    parking: 'Parkplatz',
    foodNearby: 'Essen in der Nähe',
    snackCanteen: 'Kantine',
    familyFriendly: 'Familienfreundlich',
    quiet: 'Ruhiger',
    snorkeling: 'Schnorcheln',
    openAppBeach: 'Öffne die App für Live-Empfehlungsbewertung, Windexposition, Wellen, beste Tageszeit und Alternativen in der Nähe.',
    openAppRegion: 'Wetter und Meeresbedingungen ändern sich im Tagesverlauf. CalmBeach zeigt Live-Empfehlungen in der App-Ansicht.',
    viewBeach: 'Diesen Strand in CalmBeach Griechenland ansehen',
    viewRegion: islandName => `${islandName} in CalmBeach Griechenland ansehen`,
    regionHeading: islandName => `Strände: ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Griechenland – vergleiche ${count} Strände nach heutigem Wind, Wellen, Wetter, Lage, Zugang und Strandtyp, bevor du entscheidest, wo du schwimmen gehst.`,
    home: 'Strände in Griechenland',
    nearbyHeading: islandName => `Weitere Strände – ${islandName}`,
    aboutHeading: 'Über diesen Strand',
  },
  fr: {
    brand: 'CalmBeach Grèce',
    region: 'Région',
    beachType: 'Type de plage',
    access: 'Accès',
    coordinates: 'Coordonnées',
    webcam: 'Webcam en direct',
    webcamNote: 'caméra tierce, s’ouvre dans un nouvel onglet',
    organizedBeach: 'Plage aménagée',
    beachBar: 'Bar de plage',
    sunbeds: 'Transats',
    parking: 'Parking',
    foodNearby: 'Restauration à proximité',
    snackCanteen: 'Buvette',
    familyFriendly: 'Adaptée aux familles',
    quiet: 'Plus calme',
    snorkeling: 'Snorkeling',
    openAppBeach: "Ouvrez l'application pour la note de recommandation en direct, l'exposition au vent, les vagues, les créneaux utiles et les alternatives à proximité.",
    openAppRegion: "La météo et l'état de la mer changent. CalmBeach affiche les recommandations en direct dans l'application.",
    viewBeach: 'Voir cette plage sur CalmBeach Grèce',
    viewRegion: islandName => `Voir ${islandName} sur CalmBeach Grèce`,
    regionHeading: islandName => `Plages : ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grèce – comparez ${count} plages selon le vent, les vagues, la météo, l'exposition, l'accès et le type de plage avant de choisir où vous baigner.`,
    home: 'Plages de Grèce',
    nearbyHeading: islandName => `Autres plages – ${islandName}`,
    aboutHeading: 'À propos de cette plage',
  },
  it: {
    brand: 'CalmBeach Grecia',
    region: 'Regione',
    beachType: 'Tipo di spiaggia',
    access: 'Accesso',
    coordinates: 'Coordinate',
    webcam: 'Webcam in diretta',
    webcamNote: 'telecamera di terzi, si apre in una nuova scheda',
    organizedBeach: 'Spiaggia attrezzata',
    beachBar: 'Beach bar',
    sunbeds: 'Lettini',
    parking: 'Parcheggio',
    foodNearby: 'Ristoro nelle vicinanze',
    snackCanteen: 'Chiosco',
    familyFriendly: 'Adatta alle famiglie',
    quiet: 'Più tranquilla',
    snorkeling: 'Snorkeling',
    openAppBeach: "Apri l'app per il punteggio consigliato in tempo reale, l'esposizione al vento, le onde, il momento migliore della giornata e le alternative vicine.",
    openAppRegion: "Il meteo e le condizioni del mare cambiano durante la giornata. CalmBeach mostra consigli in tempo reale nella vista app.",
    viewBeach: 'Vedi questa spiaggia su CalmBeach Grecia',
    viewRegion: islandName => `Vedi ${islandName} su CalmBeach Grecia`,
    regionHeading: islandName => `Spiagge: ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grecia - confronta ${count} spiagge in base a vento, onde, meteo, esposizione, accesso e tipo di spiaggia prima di scegliere dove fare il bagno.`,
    home: 'Spiagge della Grecia',
    nearbyHeading: islandName => `Altre spiagge – ${islandName}`,
    aboutHeading: 'Informazioni su questa spiaggia',
  },
};

const getStaticFallbackCopy = language => staticFallbackCopy[language] || staticFallbackCopy.en;

// The regions the landing puts on screen, so the crawler sees the same paths in
// the raw HTML that the app renders after hydration. Before this the home page
// linked to guides only, and the 271 region pages got no link from our
// highest-authority page at all.
//
// MUST MIRROR the POINTS list in services/nationalConditions.ts.
const HOME_REGION_IDS = [
  'ionian-islands-corfu',
  'ionian-islands-lefkada',
  'ionian-islands-kefalonia',
  'central-macedonia-halkidiki-mainland',
  'thessaly-magnesia-mainland---pelion',
  'attica-east-attica-mainland',
  'north-aegean-lemnos',
  'north-aegean-lesvos',
  'south-aegean-paros',
  'south-aegean-naxos',
  'south-aegean-patmos',
  'south-aegean-rhodes',
  'crete-crete-chania',
];

// ── Static legal footer ──────────────────────────────────────────────────────
// The React <LegalFooter> (components/LegalFooter.tsx, mounted once in App.tsx)
// opens Terms/Privacy/Cookies as MODALS, so before this existed the crawled HTML
// of all ~9.500 pages contained no <footer>, no safety disclaimer and zero links
// to /terms/, /privacy/ or /cookies/ — everything appeared only after hydration.
// Verified 30/07/2026 across five page types: `<footer` = 0, legal hrefs = 0.
//
// This emits the same three things as static markup INSIDE #root, so it is part
// of what Google indexes and what a visitor sees before the JS lands. Living
// inside #root matters: React wipes the container on mount, so the client footer
// replaces this one instead of rendering a second copy underneath it.
//
// It also carries the ODbL notice for the beach dataset, which is a derivative of
// OpenStreetMap and was credited nowhere in the product.
const FOOTER_COPY = {
  en: {
    note: 'Calm Beach is an informational beach guide. Always check local conditions, warning flags, lifeguards and official advice before swimming.',
    legal: 'Legal',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    faq: 'FAQ',
    method: 'How we measure shelter',
    guides: 'Beach guides',
    report: 'Something wrong here?',
    reportSubject: 'Wrong data on CalmBeach',
    data: 'Beach data derived from OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License (ODbL). Weather and marine forecasts by Open-Meteo (CC BY 4.0).',
  },
  gr: {
    note: 'Το Calm Beach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, τις σημαίες, τους ναυαγοσώστες και τις επίσημες οδηγίες.',
    legal: 'Νομικά',
    terms: 'Όροι Χρήσης',
    privacy: 'Πολιτική Απορρήτου',
    cookies: 'Πολιτική Cookies',
    faq: 'Συχνές ερωτήσεις',
    method: 'Πώς μετράμε την προστασία',
    guides: 'Οδηγοί παραλιών',
    report: 'Κάτι δεν πάει καλά εδώ;',
    reportSubject: 'Λάθος στοιχείο στο CalmBeach',
    data: 'Τα δεδομένα παραλιών προέρχονται από το OpenStreetMap, © συνεισφέροντες OpenStreetMap, με άδεια Open Database License (ODbL). Οι προγνώσεις καιρού και θάλασσας από το Open-Meteo (CC BY 4.0).',
  },
  de: {
    note: 'Calm Beach ist ein informativer Strandführer. Prüfe vor dem Schwimmen immer die örtlichen Bedingungen, Warnflaggen, Rettungsschwimmer und offiziellen Hinweise.',
    legal: 'Rechtliches',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutzerklärung',
    cookies: 'Cookie-Richtlinie',
    faq: 'FAQ',
    method: 'Wie wir Windschutz messen',
    guides: 'Strandführer',
    report: 'Stimmt hier etwas nicht?',
    reportSubject: 'Falsche Angabe auf CalmBeach',
    data: 'Stranddaten abgeleitet aus OpenStreetMap, © OpenStreetMap-Mitwirkende, verfügbar unter der Open Database License (ODbL). Wetter- und Seegangsvorhersagen von Open-Meteo (CC BY 4.0).',
  },
  fr: {
    note: "Calm Beach est un guide de plages à titre informatif. Vérifiez toujours les conditions locales, les drapeaux, les sauveteurs et les consignes officielles avant de nager.",
    legal: 'Mentions légales',
    terms: "Conditions d'utilisation",
    privacy: 'Politique de confidentialité',
    cookies: 'Politique de cookies',
    faq: 'FAQ',
    method: "Comment nous mesurons l'abri",
    guides: 'Guides des plages',
    report: "Une erreur sur cette page ?",
    reportSubject: 'Donnée erronée sur CalmBeach',
    data: 'Données de plages dérivées d’OpenStreetMap, © les contributeurs OpenStreetMap, disponibles sous Open Database License (ODbL). Prévisions météo et marines par Open-Meteo (CC BY 4.0).',
  },
  it: {
    note: 'Calm Beach è una guida informativa alle spiagge. Prima di nuotare controlla sempre le condizioni locali, le bandiere di avvertimento, i bagnini e le indicazioni ufficiali.',
    legal: 'Note legali',
    terms: 'Termini di utilizzo',
    privacy: 'Informativa sulla privacy',
    cookies: 'Politica sui cookie',
    faq: 'FAQ',
    method: 'Come misuriamo il riparo',
    guides: 'Guide alle spiagge',
    report: "C'è qualcosa di sbagliato?",
    reportSubject: 'Dato errato su CalmBeach',
    data: 'Dati delle spiagge derivati da OpenStreetMap, © contributori OpenStreetMap, disponibili con licenza Open Database License (ODbL). Previsioni meteo e marine di Open-Meteo (CC BY 4.0).',
  },
};

// Same single source of truth the legal pages and the in-app modals read
// (data/legalMeta.json -> scripts/buildLegalPages.mjs:18), so the address can never
// drift between the static footer and everything else that prints it.
const CONTACT_EMAIL = JSON.parse(
  readFileSync(path.join(projectRoot, 'data', 'legalMeta.json'), 'utf8')
).operator.contactEmail;

// The beach dataset is OSM-derived and unverified field by field, so the visitor standing
// on the beach is the cheapest correction we can get. A mailto works from every one of the
// ~9.500 pages with no JS, and the path rides in the body so the report says which page it
// came from. Mirrored by components/LegalFooter.tsx, which replaces this footer on mount
// and reads the path from window.location instead.
const reportProblemMailto = (c, pagePath) => {
  const body = pagePath ? `\n\n---\n${pagePath}` : '';
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(c.reportSubject)}`
    + (body ? `&body=${encodeURIComponent(body)}` : '');
};

const staticLegalFooter = (locale = prerenderLocales[0], pagePath = '') => {
  const c = FOOTER_COPY[locale.language] || FOOTER_COPY.en;
  // Legal documents are single bilingual pages at the root; the FAQ and the guides
  // hub are the only two that exist per locale (en + el only — de/fr/it fall back
  // to English, exactly like getGuidesHubLink does in the app).
  const localePrefix = locale.language === 'gr' ? '/el' : '';
  const link = (href, label) =>
    `<li style="margin:0;"><a href="${escapeHtml(href)}" style="color:#0e7490;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></li>`;

  return `
      <footer style="margin:32px 0 0;border-top:1px solid #e2e8f0;padding:20px 0 0;font-size:13px;line-height:1.6;color:#475569;">
        <p style="margin:0 0 12px;">${escapeHtml(c.note)}</p>
        <nav aria-label="${escapeHtml(c.legal)}">
          <ul style="display:flex;flex-wrap:wrap;gap:8px 16px;margin:0 0 12px;padding:0;list-style:none;">
            ${link('/terms/', c.terms)}
            ${link('/privacy/', c.privacy)}
            ${link('/cookies/', c.cookies)}
            ${link(`${localePrefix}/faq/`, c.faq)}
            ${link(`${localePrefix}/how-we-measure-wind-shelter/`, c.method)}
            ${link(`${localePrefix}/beach-guides/`, c.guides)}
            ${link(reportProblemMailto(c, pagePath), c.report)}
          </ul>
        </nav>
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${escapeHtml(c.data)}</p>
        <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 Calm Beach</p>
      </footer>`;
};

// Drop the static footer into a finished page. Every static builder emits exactly
// one </main> inside #root, and the app shell (dist/index.html) has none, so the
// first match is always the right seam. String.replace with a string pattern
// replaces the first occurrence only — that is the intent here.
//
// NOT applied to island-intent guide pages: those already carry
// renderArticleLegalStrip(), which says something different per intent. Applying
// both gave them two <footer> elements (caught in the build output, 30/07).
const withStaticFooter = (html, locale) => {
  // Read the path back off the canonical this page already carries rather than threading it
  // through six call sites; the canonical is written before the footer is appended and is
  // self-referential on every page type, so it is the page's own address by definition.
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  const pagePath = canonical ? canonical[1].replace(siteUrl, '') : '';
  return html.replace('</main>', `</main>${staticLegalFooter(locale, pagePath)}`);
};

const staticHomeFallback = (canonicalUrl, locale = prerenderLocales[0], regionLinks = []) => {
  const isGreek = locale.language === 'gr';
  // The <title> carries the " | CalmBeach" suffix because a search result needs the
  // brand; an <h1> does not — a heading with a pipe in it reads like a page title
  // pasted into the body, which is exactly what it was until 05/08/2026. Same string,
  // brand stripped, so the two can never drift apart.
  const homeHeading = String(locale.homeTitle).split(' | ')[0];
  // What the visitor GETS, not what the app HAS. These used to be a feature list
  // ("Map and beach detail pages"), which describes software rather than answering
  // the question the heading above them just asked.
  const features = isGreek
    ? [
      'Ποιες παραλίες είναι απάνεμες σήμερα',
      'Άνεμος και κύμα ανά ώρα, για κάθε παραλία',
      'Η προστασία που δίνει το σχήμα της κάθε ακτής',
      'Χάρτης με τη σημερινή εικόνα κάθε παραλίας',
    ]
    : [
      'Which beaches are sheltered today',
      'Wind and waves hour by hour, per beach',
      'The shelter each coastline’s own shape gives',
      'A map showing today’s picture for every beach',
    ];
  const guideLinks = seoLandingPages
    .filter(landing => landing.locales[locale.id])
    .map(landing => ({
      href: localizedPath(landing.pathName, locale),
      label: landing.locales[locale.id].h1,
    }));
  const guidesHeading = isGreek ? 'Δημοφιλείς οδηγοί παραλιών' : 'Popular beach guides';
  const regionsHeading = isGreek ? 'Περιοχές' : 'Regions';

  return `
    <div id="root">
      <main data-static-fallback style="max-width:860px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:800;">Calm Beach Greece</p>
        <h1 style="margin:0 0 14px;font-size:36px;line-height:1.08;">${escapeHtml(homeHeading)}</h1>
        <p style="margin:0 0 22px;font-size:18px;line-height:1.55;color:#334155;">${escapeHtml(locale.homeDescription)}</p>
        <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 24px;padding:0;list-style:none;">
          ${features.map(feature => `<li style="border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#075985;font-weight:700;">${escapeHtml(feature)}</li>`).join('')}
        </ul>
        ${guideLinks.length > 0 ? `
        <nav aria-label="${escapeHtml(guidesHeading)}" style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:18px;color:#075985;">${escapeHtml(guidesHeading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">
            ${guideLinks.map(link => `<li><a href="${escapeHtml(link.href)}" style="display:inline-flex;border:1px solid #bae6fd;border-radius:999px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:800;font-size:13px;">${escapeHtml(link.label)}</a></li>`).join('')}
          </ul>
        </nav>
        ` : ''}
        ${regionLinks.length > 0 ? `
        <nav aria-label="${escapeHtml(regionsHeading)}" style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:18px;color:#075985;">${escapeHtml(regionsHeading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">
            ${regionLinks.map(link => `<li><a href="${escapeHtml(link.href)}" style="display:inline-flex;border:1px solid #bae6fd;border-radius:999px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:800;font-size:13px;">${escapeHtml(link.label)}</a></li>`).join('')}
          </ul>
        </nav>
        ` : ''}
        ${/* This block is what a visitor sees before the JavaScript lands, and what
              anyone browsing without it sees permanently. Until 05/08/2026 it said
              "open the app" above a link pointing at `canonicalUrl` — i.e. AT THIS
              VERY PAGE. With JS the React app has already replaced this markup, so
              nobody ever clicked it; without JS it reloaded the same dead page. A
              self-referential link is not navigation, so it now points at the guides
              hub: a real, fully static destination that works with JS switched off,
              and the page family that earns most of our search clicks. */''}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(isGreek
          ? 'Δεν φορτώνει ο χάρτης; Οι οδηγοί παραλιών διαβάζονται κανονικά χωρίς αυτόν.'
          : 'Map not loading? The beach guides read fine without it.')}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(localizedPath(GUIDES_HUB_PATH, locale))}" style="color:#0e7490;font-weight:800;">${escapeHtml(isGreek ? 'Όλοι οι οδηγοί παραλιών' : 'All beach guides')} →</a></p>
      </main>
    </div>
  `;
};

// Compass direction labels. `face` describes which way the shore looks;
// `wind` is the accusative plural used in "cover from X winds".
// `face` describes which way the shore looks (used as "faces {face}"); `wind` is
// the form used in "cover from {wind} winds". de/fr/it forms are chosen to fit
// the per-language sentences composed in buildBeachNarrative.
const compassFace = new Map([
  ['North', { en: 'north', gr: 'βόρεια', de: 'Norden', fr: 'le nord', it: 'nord' }],
  ['South', { en: 'south', gr: 'νότια', de: 'Süden', fr: 'le sud', it: 'sud' }],
  ['East', { en: 'east', gr: 'ανατολικά', de: 'Osten', fr: "l'est", it: 'est' }],
  ['West', { en: 'west', gr: 'δυτικά', de: 'Westen', fr: "l'ouest", it: 'ovest' }],
  ['Northeast', { en: 'north-east', gr: 'βορειοανατολικά', de: 'Nordosten', fr: 'le nord-est', it: 'nord-est' }],
  ['Northwest', { en: 'north-west', gr: 'βορειοδυτικά', de: 'Nordwesten', fr: 'le nord-ouest', it: 'nord-ovest' }],
  ['Southeast', { en: 'south-east', gr: 'νοτιοανατολικά', de: 'Südosten', fr: 'le sud-est', it: 'sud-est' }],
  ['Southwest', { en: 'south-west', gr: 'νοτιοδυτικά', de: 'Südwesten', fr: 'le sud-ouest', it: 'sud-ovest' }],
]);
const compassWind = new Map([
  ['North', { en: 'northerly', gr: 'βόρειους', de: 'nördlichen', fr: 'de nord', it: 'da nord' }],
  ['South', { en: 'southerly', gr: 'νότιους', de: 'südlichen', fr: 'de sud', it: 'da sud' }],
  ['East', { en: 'easterly', gr: 'ανατολικούς', de: 'östlichen', fr: "d'est", it: 'da est' }],
  ['West', { en: 'westerly', gr: 'δυτικούς', de: 'westlichen', fr: "d'ouest", it: 'da ovest' }],
  ['Northeast', { en: 'north-easterly', gr: 'βορειοανατολικούς', de: 'nordöstlichen', fr: 'de nord-est', it: 'da nord-est' }],
  ['Northwest', { en: 'north-westerly', gr: 'βορειοδυτικούς', de: 'nordwestlichen', fr: 'de nord-ouest', it: 'da nord-ovest' }],
  ['Southeast', { en: 'south-easterly', gr: 'νοτιοανατολικούς', de: 'südöstlichen', fr: 'de sud-est', it: 'da sud-est' }],
  ['Southwest', { en: 'south-westerly', gr: 'νοτιοδυτικούς', de: 'südwestlichen', fr: 'de sud-ouest', it: 'da sud-ovest' }],
]);
const surfaceWord = new Map([
  ['sandy', { en: 'sand', gr: 'άμμο', de: 'Sand', fr: 'du sable', it: 'sabbia' }],
  ['pebbles', { en: 'pebbles', gr: 'βότσαλα', de: 'Kiesel', fr: 'des galets', it: 'ciottoli' }],
  ['sandy-pebbles', { en: 'sand and pebbles', gr: 'άμμο και βότσαλα', de: 'Sand und Kiesel', fr: 'du sable et des galets', it: 'sabbia e ciottoli' }],
  ['rocky', { en: 'rock', gr: 'βράχια', de: 'Felsen', fr: 'des rochers', it: 'rocce' }],
]);

const listJoin = (parts, language) => {
  const clean = parts.filter(Boolean);
  if (clean.length <= 1) return clean.join('');
  const conj = pickLang(language, { en: ' and ', gr: ' και ', de: ' und ', fr: ' et ', it: ' e ' });
  return `${clean.slice(0, -1).join(', ')}${conj}${clean[clean.length - 1]}`;
};

// Compose 1-3 short, unique paragraphs from verified structured fields so the
// 2.740 beach pages stop sharing the same templated description. Each sentence
// is emitted ONLY when its data exists (no filler) and wind wording stays
// cautious: orientation records shore facing, not confirmed shelter.
// Mirrors utils/beachCopy.ts beachSentenceName: when a template supplies its own
// beach noun («Η παραλία …»), strip the noun already embedded in the proper name so
// «Παραλία Άναξου» doesn't render as «Η παραλία Παραλία Άναξου».
const sentenceName = (name, language) => {
  const trimmed = (name || '').trim();
  if (language === 'gr') return trimmed.replace(/^παραλία\s+/iu, '') || trimmed;
  if (language === 'en') return trimmed.replace(/\s+beach$/i, '') || trimmed;
  return trimmed;
};

// The measured seasonal-shelter verdict, stated in the static page. Reads the baked
// `localWindStatus` (bakeLocalWindShelter → summarizeLocalWindBehavior, the ONE
// curated-aware computation) and prints the SAME five-language sentences the app's
// "Usually in the meltemi" section shows (LOCAL_WIND_SECTION.status) — so the static
// word and the app can never diverge. Until 06/08/2026 this layer only offered
// orientation-with-disclaimer and deferred the verdict to "the app": the crawler and
// any first-time visitor saw a promise where the product's actual answer exists.
// The tail deliberately contains no today-words and carries the hedge/check tokens
// hasUnsupportedStaticConditionCopy expects of honest shelter copy.
const MEASURED_SHELTER_TAIL = {
  en: 'That comes from the measured shape of the coastline around it and our curated wind records — a seasonal picture, not a live forecast, so check live wind and waves before you go.',
  gr: 'Το συμπέρασμα βγαίνει από το μετρημένο σχήμα της ακτογραμμής γύρω από το σημείο και τα επιμελημένα δεδομένα ανέμου μας — εποχική εικόνα, όχι ζωντανή πρόγνωση· έλεγξε ζωντανά άνεμο και κύμα πριν πας.',
  de: 'Das ergibt sich aus der vermessenen Form der Küstenlinie ringsum und unseren kuratierten Winddaten — ein saisonales Bild, keine Live-Vorhersage; prüfe daher Wind und Wellen live, bevor du losfährst.',
  fr: 'Ce constat vient de la forme mesurée du littoral alentour et de nos données de vent vérifiées — une image saisonnière, pas une prévision en direct ; vérifiez donc le vent et les vagues en direct avant de partir.',
  it: 'Questo giudizio nasce dalla forma misurata della costa circostante e dai nostri dati sul vento curati — un quadro stagionale, non una previsione in tempo reale; controlla vento e onde dal vivo prima di andare.',
};
// Subject phrasing mirrors components/LocalWindShelterSection.tsx beachSubject:
// Greek boat-only spots take the neuter article + the neuter statusBoatGr predicates.
const measuredShelterSubject = (beachName, language, isBoat) => {
  if (language === 'gr') return isBoat ? `Το ${beachName}` : `Η παραλία ${sentenceName(beachName, 'gr')}`;
  if (language === 'de') return `Der Strand ${beachName}`;
  if (language === 'fr') return `La plage ${beachName}`;
  if (language === 'it') return `La spiaggia ${beachName}`;
  return beachName;
};

const buildBeachNarrative = (beach, island, region, language) => {
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const pick = variants => variants[(beach.id ?? 0) % variants.length];
  const paragraphs = [];

  const localWindStatus = ['protected', 'partial', 'exposed'].includes(beach.localWindStatus)
    ? beach.localWindStatus
    : null;
  if (localWindStatus) {
    const section = localWindSectionFor(region?.id);
    const isBoat = (beach.staticLabels?.accessType ?? beach.metadata?.access?.type) === 'boat_only';
    const statusSentence = (isBoat && language === 'gr')
      ? section.statusBoatGr[localWindStatus]
      : pickLang(language, section.status[localWindStatus]);
    const subject = measuredShelterSubject(beachName, language, isBoat);
    paragraphs.push(`${subject} ${statusSentence} ${pickLang(language, MEASURED_SHELTER_TAIL)}`);
  }

  const faces = Array.isArray(beach.orientation?.faces) ? beach.orientation.faces : [];
  const protectedFrom = Array.isArray(beach.protectedFrom) ? beach.protectedFrom : [];
  const faceWords = listJoin(faces.map(f => readableLabel(compassFace.get(f), language)), language);
  if (faceWords) {
    // Drop directions the shore itself faces (a bay cannot shelter from the way
    // it opens) and cap the list so the prose stays readable and not overstated.
    // Keep the inflected noun and leave the proper name in nominative apposition
    // (gr/de/fr/it) so grammar holds for any beach-name gender. Wind wording stays
    // cautious: orientation = shore facing, not confirmed shelter.
    const protList = protectedFrom.filter(d => !faces.includes(d)).slice(0, 3);
    const protWords = listJoin(protList.map(f => readableLabel(compassWind.get(f), language)), language);
    const orient = pickLang(language, {
      en: {
        leads: [
          `The shoreline at ${beachName} faces ${faceWords}`,
          `${beachName} is oriented towards the ${faceWords}`,
          `The bay at ${beachName} opens to the ${faceWords}`,
        ],
        prot: w => `, so it usually has natural cover from ${w} winds`,
        tail: `. Orientation only reflects which way the coast faces, not confirmed shelter, so check wind and waves in the app before you go.`,
      },
      gr: {
        leads: [
          `Η παραλία ${sentenceName(beachName, 'gr')} κοιτάζει ${faceWords}`,
          `Ο προσανατολισμός της παραλίας ${sentenceName(beachName, 'gr')} είναι ${faceWords}`,
          `Η παραλία ${sentenceName(beachName, 'gr')} βλέπει ${faceWords}`,
        ],
        prot: w => `, οπότε έχει συνήθως φυσική κάλυψη από ${w} ανέμους`,
        tail: `. Ο προσανατολισμός δείχνει μόνο την πλευρά της ακτής, όχι επιβεβαιωμένη προστασία· έλεγξε άνεμο και κύμα στην εφαρμογή πριν πας.`,
      },
      de: {
        leads: [
          `Der Strand ${beachName} ist nach ${faceWords} ausgerichtet`,
          `${beachName} öffnet sich nach ${faceWords}`,
          `Die Bucht von ${beachName} ist nach ${faceWords} orientiert`,
        ],
        prot: w => `, bietet also meist natürlichen Schutz vor ${w} Winden`,
        tail: `. Die Ausrichtung zeigt nur, wohin die Küste blickt, keinen gesicherten Schutz – prüfe vor dem Besuch Wind und Wellen in der App.`,
      },
      fr: {
        leads: [
          `Le rivage de ${beachName} est orienté vers ${faceWords}`,
          `${beachName} s'ouvre vers ${faceWords}`,
          `La baie de ${beachName} donne vers ${faceWords}`,
        ],
        prot: w => `, et bénéficie donc le plus souvent d'un abri naturel contre les vents ${w}`,
        tail: `. L'orientation indique seulement vers où la côte est tournée, pas un abri garanti — vérifiez le vent et les vagues dans l'application avant d'y aller.`,
      },
      it: {
        leads: [
          `La spiaggia ${beachName} è orientata verso ${faceWords}`,
          `${beachName} si apre verso ${faceWords}`,
          `La baia di ${beachName} guarda verso ${faceWords}`,
        ],
        prot: w => `, quindi di solito ha riparo naturale dai venti ${w}`,
        tail: `. L'orientamento indica solo verso dove guarda la costa, non un riparo garantito: controlla vento e onde nell'app prima di andare.`,
      },
    });
    const lead = pick(orient.leads);
    // When the measured verdict paragraph is present it already carries the
    // epistemics and the live-check pointer; repeating "not confirmed shelter,
    // check the app" under a stated verdict would read as the page doubting itself.
    const tail = localWindStatus ? '.' : orient.tail;
    paragraphs.push(`${lead}${protWords ? orient.prot(protWords) : ''}${tail}`);
  }

  const surface = readableLabel(surfaceWord.get(beach.beachType), language);
  const shallow = beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow';
  const deep = beach.characteristics?.deepWaters === true || beach.waterDepth === 'deep';
  const family = beach.environment?.familyFriendly === true;
  if (surface || shallow || deep) {
    if (language === 'gr') {
      const familyClause = (shallow && family) ? ' — βολικό για οικογένειες με μικρά παιδιά' : '';
      if (surface) {
        const depthClause = shallow ? ' με ρηχά, ομαλά νερά' : deep ? ' με νερά που βαθαίνουν κοντά στην ακτή' : '';
        paragraphs.push(`Η παραλία έχει ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? 'Τα νερά είναι ρηχά και ομαλά' : 'Τα νερά βαθαίνουν κοντά στην ακτή';
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'de') {
      const familyClause = (shallow && family) ? ' – praktisch für Familien mit kleinen Kindern' : '';
      if (surface) {
        const depthClause = shallow ? ' mit flachem, sanft abfallendem Wasser' : deep ? ' mit Wasser, das nahe am Ufer tief wird' : '';
        paragraphs.push(`${beachName} hat ${surface} unter den Füßen${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? 'Das Wasser ist flach und fällt sanft ab' : 'Das Wasser wird nahe am Ufer tief';
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'fr') {
      const familyClause = (shallow && family) ? ' — pratique pour les familles avec de jeunes enfants' : '';
      if (surface) {
        const depthClause = shallow ? ' avec une eau peu profonde en pente douce' : deep ? ' avec une eau qui devient profonde près du rivage' : '';
        paragraphs.push(`${beachName} présente ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? "L'eau est peu profonde et en pente douce" : "L'eau devient profonde près du rivage";
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'it') {
      const familyClause = (shallow && family) ? ' — comodo per famiglie con bambini piccoli' : '';
      if (surface) {
        const depthClause = shallow ? ' con acqua bassa e digradante' : deep ? ' con acqua che diventa profonda vicino alla riva' : '';
        paragraphs.push(`${beachName} ha ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? "L'acqua è bassa e digradante" : "L'acqua diventa profonda vicino alla riva";
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else {
      const surfaceClause = surface ? `${beachName} has ${surface} underfoot` : `${beachName}`;
      const depthClause = shallow ? ' with shallow, gently shelving water' : deep ? ' with water that deepens close to shore' : '';
      const familyClause = (shallow && family) ? ' — handy for families with young children' : '';
      paragraphs.push(`${surfaceClause}${depthClause}${familyClause}.`);
    }
  }

  // Amenities + accessibility + camping. Mirror only what the app already shows
  // (chips / dl), so prose adds no claim the UI does not already make.
  const amen = [
    beach.amenities?.organized ? pickLang(language, { en: 'an organised beach', gr: 'οργάνωση', de: 'einen organisierten Strand', fr: 'une plage aménagée', it: 'una spiaggia attrezzata' }) : null,
    beach.amenities?.beachBar ? pickLang(language, { en: 'a beach bar', gr: 'beach bar', de: 'eine Beach Bar', fr: 'un bar de plage', it: 'un beach bar' }) : null,
    beach.amenities?.sunbeds ? pickLang(language, { en: 'sunbeds', gr: 'ξαπλώστρες', de: 'Liegen', fr: 'des transats', it: 'lettini' }) : null,
    beach.amenities?.naturalShade ? pickLang(language, { en: 'natural shade', gr: 'φυσική σκιά', de: 'natürlichen Schatten', fr: "de l'ombre naturelle", it: 'ombra naturale' }) : null,
    beach.amenities?.parking ? pickLang(language, { en: 'parking nearby', gr: 'πάρκινγκ κοντά', de: 'Parkplätze in der Nähe', fr: 'un parking à proximité', it: 'parcheggio nelle vicinanze' }) : null,
    (beach.amenities?.restaurant || beach.amenities?.taverna) ? pickLang(language, { en: 'food nearby', gr: 'φαγητό κοντά', de: 'Essen in der Nähe', fr: 'de la restauration à proximité', it: 'ristoro nelle vicinanze' }) : null,
  ].filter(Boolean);
  const sentences = [];
  if (amen.length) {
    sentences.push(pickLang(language, {
      en: `For amenities, ${beachName} has ${listJoin(amen, language)}.`,
      gr: `Σε παροχές, η παραλία έχει ${listJoin(amen, language)}.`,
      de: `An Ausstattung bietet ${beachName} ${listJoin(amen, language)}.`,
      fr: `Côté équipements, ${beachName} propose ${listJoin(amen, language)}.`,
      it: `Per i servizi, ${beachName} offre ${listJoin(amen, language)}.`,
    }));
  }
  const seatrac = beach.seatrac ?? beach.metadata?.seatrac;
  if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') {
    sentences.push(pickLang(language, {
      en: 'It has a Seatrac assisted-access unit for accessibility — confirm it is in service before travelling.',
      gr: 'Διαθέτει σύστημα Seatrac για προσβασιμότητα ΑμεΑ — επιβεβαίωσε ότι λειτουργεί πριν πας.',
      de: 'Es gibt eine Seatrac-Anlage für barrierefreien Zugang – bestätige vor der Anreise, dass sie in Betrieb ist.',
      fr: "Elle dispose d'un dispositif Seatrac pour l'accès assisté — confirmez qu'il est en service avant de vous déplacer.",
      it: "Dispone di un sistema Seatrac per l'accesso assistito: verifica che sia in funzione prima di partire.",
    }));
  }
  if (Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) {
    const nearest = beach.nearbyCamping.reduce((a, b) => (b.distanceMeters < a.distanceMeters ? b : a));
    const campName = (language !== 'gr' && nearest.nameEn) ? nearest.nameEn : nearest.name;
    sentences.push(pickLang(language, {
      en: `There is a campsite nearby (${campName}, ~${nearest.distanceMeters} m).`,
      gr: `Κοντά υπάρχει κάμπινγκ (${campName}, ~${nearest.distanceMeters} m).`,
      de: `In der Nähe gibt es einen Campingplatz (${campName}, ~${nearest.distanceMeters} m).`,
      fr: `Un camping se trouve à proximité (${campName}, ~${nearest.distanceMeters} m).`,
      it: `Nelle vicinanze c'è un campeggio (${campName}, ~${nearest.distanceMeters} m).`,
    }));
  }
  if (sentences.length) paragraphs.push(sentences.join(' '));

  return paragraphs;
};

const renderBeachNarrative = (beach, island, region, language, heading) => {
  const paragraphs = buildBeachNarrative(beach, island, region, language);
  if (!paragraphs.length) return '';
  return `
        <section style="margin:0 0 22px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          ${paragraphs.map(p => `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`).join('')}
        </section>`;
};

// Visible breadcrumb with real <a href> so crawlers (and users without JS) can
// climb back to the region and home; the JSON-LD BreadcrumbList mirrors it.
const renderBeachBreadcrumb = (region, island, beachName, language, locale) => {
  const copy = getStaticFallbackCopy(language);
  const homeHref = homePathForLocale(locale);
  const regionHref = localizedPath(regionPath(region, island), locale);
  const islandName = displayName(island.name, region.id, language);
  const sep = '<span style="color:#94a3b8;"> › </span>';
  return `
        <nav aria-label="breadcrumb" style="margin:0 0 14px;font-size:13px;font-weight:700;">
          <a href="${escapeHtml(homeHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.home)}</a>${sep}<a href="${escapeHtml(regionHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.regionHeading(islandName))}</a>${sep}<span style="color:#475569;">${escapeHtml(beachName)}</span>
        </nav>`;
};

// Up to 8 sibling beaches on the same island, ranked by popularity, as real
// links so each beach page funnels equity instead of being a crawl dead-end.
const renderNearbyBeaches = (beach, island, region, language, locale) => {
  const copy = getStaticFallbackCopy(language);
  const siblings = (Array.isArray(island.beaches) ? island.beaches : [])
    .filter(other => other.id !== beach.id && Number.isInteger(other.id) && other.name)
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, 8);
  if (!siblings.length) return '';
  const islandName = displayName(island.name, region.id, language);
  const items = siblings.map(other => {
    const otherName = displayName(other.name, `Beach ${other.id}`, language);
    return `
            <li style="margin:0;">
              <a href="${escapeHtml(localizedPath(beachPath(region, island, other), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
                <strong style="color:#0e7490;">${escapeHtml(otherName)}</strong>
                ${renderBeachSummaryMeta(other, language)}
              </a>
            </li>`;
  }).join('');
  return `
        <section style="margin:22px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(copy.nearbyHeading(islandName))}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// "Calmer alternative nearby" as crawlable links: nearby beaches in the same
// region oriented away from the northerly Meltemi (the same static signal the
// sheltered guides use). We deliberately do NOT claim "calmer today" — a static
// page has no live wind — so the copy stays on the durable orientation fact.
const renderShelteredNearby = (beach, island, region, language, locale) => {
  const sheltered = (Array.isArray(island.beaches) ? island.beaches : [])
    .filter(other => other.id !== beach.id && Number.isInteger(other.id) && other.name)
    .filter(other => Array.isArray(other.protectedFrom) && NORTHERLY.some(d => other.protectedFrom.includes(d)))
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, 6);
  if (sheltered.length < 2) return '';
  const heading = pickLang(language, {
    en: 'Nearby beaches oriented away from the Meltemi',
    gr: 'Κοντινές επιλογές μακριά από το μελτέμι',
    de: 'Nahegelegene Strände mit Meltemi-Ausrichtung',
    fr: 'Plages proches orientées contre le meltemi',
    it: 'Spiagge vicine orientate lontano dal meltemi',
  });
  const items = sheltered.map(other => {
    const otherName = displayName(other.name, `Beach ${other.id}`, language);
    return `
            <li style="margin:0;">
              <a href="${escapeHtml(localizedPath(beachPath(region, island, other), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
                <strong style="color:#0e7490;">${escapeHtml(otherName)}</strong>
                ${renderBeachSummaryMeta(other, language)}
              </a>
            </li>`;
  }).join('');
  return `
        <section style="margin:22px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Q/A pairs for FAQPage structured data. Each answer restates a fact already
// shown on the page (dl row, amenity chip or narrative sentence) and only
// positive, stable facts are emitted — so the set differs per beach and never
// claims something the page does not display.
const buildBeachFaqPairs = (beach, island, region, language) => {
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const pairs = [];

  // "Does it get windy there?" is the question this whole product exists to answer,
  // and it was the one question the page never asked out loud. The answer REUSES the
  // exact verdict sentence printed in the narrative above (same baked localWindStatus,
  // same LOCAL_WIND_SECTION copy) so the FAQ can never drift from the page or the app.
  const faqWindStatus = ['protected', 'partial', 'exposed'].includes(beach.localWindStatus)
    ? beach.localWindStatus
    : null;
  if (faqWindStatus) {
    const section = localWindSectionFor(region?.id);
    const isBoat = (beach.staticLabels?.accessType ?? beach.metadata?.access?.type) === 'boat_only';
    const verdict = (isBoat && language === 'gr')
      ? section.statusBoatGr[faqWindStatus]
      : pickLang(language, section.status[faqWindStatus]);
    const subject = measuredShelterSubject(beachName, language, isBoat);
    const windName = pickLang(language, LOCAL_WIND_ATOMS[getRegionWindContext(region?.id)].word);
    pairs.push(pickLang(language, {
      en: { q: `Does ${beachName} beach get windy?`, a: `${subject} ${verdict} That is based on the measured shape of its coastline against the ${windName}; check live wind and waves before you go.` },
      gr: { q: `Έχει αέρα η παραλία ${sentenceName(beachName, 'gr')};`, a: `${subject} ${verdict} Βασίζεται στο μετρημένο σχήμα της ακτογραμμής της απέναντι στο ${windName === 'μελτέμι' ? 'μελτέμι' : windName}· έλεγξε ζωντανά άνεμο και κύμα πριν πας.` },
      de: { q: `Ist es am Strand ${beachName} windig?`, a: `${subject} ${verdict} Grundlage ist die vermessene Form der Küstenlinie gegenüber dem ${windName}; prüfe Wind und Wellen live, bevor du losfährst.` },
      fr: { q: `Y a-t-il du vent à la plage ${beachName} ?`, a: `${subject} ${verdict} Cela repose sur la forme mesurée de son littoral face au ${windName} ; vérifiez le vent et les vagues en direct avant de partir.` },
      it: { q: `C'è vento alla spiaggia ${beachName}?`, a: `${subject} ${verdict} Si basa sulla forma misurata della sua costa rispetto al ${windName}; controlla vento e onde dal vivo prima di andare.` },
    }));
  }

  const access = readableAccess(beach, language);
  if (access) {
    pairs.push(pickLang(language, {
      en: { q: `How do you get to ${beachName} beach?`, a: `Access is ${access.toLowerCase()}. See the coordinates and map on CalmBeach.` },
      gr: { q: `Πώς πάω στην παραλία ${sentenceName(beachName, 'gr')};`, a: `Η πρόσβαση είναι: ${access}. Δες τις συντεταγμένες και τον χάρτη στο CalmBeach.` },
      de: { q: `Wie kommt man zum Strand ${beachName}?`, a: `${access}. Koordinaten und Karte findest du in CalmBeach.` },
      fr: { q: `Comment se rendre à la plage ${beachName} ?`, a: `${access}. Retrouvez les coordonnées et la carte sur CalmBeach.` },
      it: { q: `Come si arriva alla spiaggia ${beachName}?`, a: `${access}. Coordinate e mappa su CalmBeach.` },
    }));
  }

  const type = readableBeachType(beach, language);
  const shallow = beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow';
  const deep = beach.characteristics?.deepWaters === true || beach.waterDepth === 'deep';
  if (type || shallow || deep) {
    const depth = pickLang(language, {
      en: shallow ? ' with shallow water' : deep ? ' with deep water' : '',
      gr: shallow ? ' με ρηχά νερά' : deep ? ' με βαθιά νερά' : '',
      de: shallow ? ' mit flachem Wasser' : deep ? ' mit tiefem Wasser' : '',
      fr: shallow ? ' avec une eau peu profonde' : deep ? ' avec une eau profonde' : '',
      it: shallow ? ' con acqua bassa' : deep ? ' con acqua profonda' : '',
    });
    pairs.push(pickLang(language, {
      en: { q: `What is ${beachName} beach like?`, a: `${type ? `A ${type.toLowerCase()} beach${depth}.` : `A beach${depth}.`}`.trim() },
      gr: { q: `Πώς είναι η παραλία ${sentenceName(beachName, 'gr')};`, a: `${type ? `${type}${depth}.` : `Παραλία${depth}.`}`.trim() },
      de: { q: `Wie ist der Strand ${beachName}?`, a: `${type ? `Strandtyp: ${type}${depth}.` : `Strand${depth}.`}`.trim() },
      fr: { q: `À quoi ressemble la plage ${beachName} ?`, a: `${type ? `Plage ${type.toLowerCase()}${depth}.` : `Plage${depth}.`}`.trim() },
      it: { q: `Com'è la spiaggia ${beachName}?`, a: `${type ? `Spiaggia ${type.toLowerCase()}${depth}.` : `Spiaggia${depth}.`}`.trim() },
    }));
  }

  const amen = [
    beach.amenities?.organized ? pickLang(language, { en: 'an organised beach', gr: 'οργάνωση', de: 'einen organisierten Strand', fr: 'une plage aménagée', it: 'una spiaggia attrezzata' }) : null,
    beach.amenities?.beachBar ? pickLang(language, { en: 'a beach bar', gr: 'beach bar', de: 'eine Beach Bar', fr: 'un bar de plage', it: 'un beach bar' }) : null,
    beach.amenities?.sunbeds ? pickLang(language, { en: 'sunbeds', gr: 'ξαπλώστρες', de: 'Liegen', fr: 'des transats', it: 'lettini' }) : null,
    beach.amenities?.parking ? pickLang(language, { en: 'parking nearby', gr: 'πάρκινγκ κοντά', de: 'Parkplätze in der Nähe', fr: 'un parking à proximité', it: 'parcheggio nelle vicinanze' }) : null,
    (beach.amenities?.restaurant || beach.amenities?.taverna) ? pickLang(language, { en: 'food nearby', gr: 'φαγητό κοντά', de: 'Essen in der Nähe', fr: 'de la restauration à proximité', it: 'ristoro nelle vicinanze' }) : null,
  ].filter(Boolean);
  if (amen.length) {
    pairs.push(pickLang(language, {
      en: { q: `What facilities does ${beachName} beach have?`, a: `It has ${listJoin(amen, language)}.` },
      gr: { q: `Τι παροχές έχει η παραλία ${sentenceName(beachName, 'gr')};`, a: `Έχει ${listJoin(amen, language)}.` },
      de: { q: `Welche Ausstattung hat der Strand ${beachName}?`, a: `Es gibt ${listJoin(amen, language)}.` },
      fr: { q: `Quels équipements y a-t-il à la plage ${beachName} ?`, a: `Il y a ${listJoin(amen, language)}.` },
      it: { q: `Quali servizi offre la spiaggia ${beachName}?`, a: `Ci sono ${listJoin(amen, language)}.` },
    }));
  }

  const seatrac = beach.seatrac ?? beach.metadata?.seatrac;
  if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') {
    pairs.push(pickLang(language, {
      en: { q: `Is ${beachName} beach wheelchair accessible?`, a: 'It has a Seatrac assisted-access unit for reaching the water. Confirm it is in service before visiting.' },
      gr: { q: `Είναι προσβάσιμη για ΑμεΑ η παραλία ${sentenceName(beachName, 'gr')};`, a: 'Διαθέτει σύστημα Seatrac για αυτόνομη πρόσβαση στο νερό. Επιβεβαίωσε ότι λειτουργεί πριν πας.' },
      de: { q: `Ist der Strand ${beachName} barrierefrei?`, a: 'Er hat eine Seatrac-Anlage für den selbstständigen Zugang zum Wasser. Bestätige vor dem Besuch, dass sie in Betrieb ist.' },
      fr: { q: `La plage ${beachName} est-elle accessible aux personnes à mobilité réduite ?`, a: "Elle dispose d'un dispositif Seatrac pour accéder à l'eau. Confirmez qu'il est en service avant votre visite." },
      it: { q: `La spiaggia ${beachName} è accessibile alle persone con disabilità?`, a: "Dispone di un sistema Seatrac per raggiungere l'acqua. Verifica che sia in funzione prima della visita." },
    }));
  }

  return pairs;
};

// The FAQ as VISIBLE markup — each question an <h2>, each answer a <p> — which is
// what lets the beach page carry FAQPage JSON-LD at all: Google's rule is that the
// structured data must describe content the visitor can actually see. Until
// 06/08/2026 `buildBeachFaqPairs` existed but was called from nowhere, so beach
// pages shipped neither the visible Q&A nor the markup.
const BEACH_FAQ_HEADING = {
  en: 'Good to know',
  gr: 'Καλό να ξέρεις',
  de: 'Gut zu wissen',
  fr: 'Bon à savoir',
  it: 'Buono a sapersi',
};
const renderBeachFaq = (pairs, language) => {
  if (!pairs.length) return '';
  return `
        <section style="margin:22px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(pickLang(language, BEACH_FAQ_HEADING))}</h2>
          ${pairs.map(pair => `
          <div style="margin:0 0 14px;">
            <h3 style="margin:0 0 5px;font-size:16px;line-height:1.3;color:#0f172a;">${escapeHtml(pair.q)}</h3>
            <p style="margin:0;font-size:15.5px;line-height:1.6;color:#334155;">${escapeHtml(pair.a)}</p>
          </div>`).join('')}
        </section>`;
};

// Shared beach <title>/<h1>/description builders. NOTE on description: the
// beach.description data field is authored only in en/gr; its fr/de/it entries
// are English copies (and accessNotes are Greeklish), so for de/fr/it we compose
// from the localized template instead of leaking English/Greeklish onto /de etc.
// en/gr keep using the authored data exactly as before.
const beachFallbackDescription = (beachName, islandName, language) => pickLang(language, {
  en: `See practical info for ${beachName} in ${islandName}, including location, beach type, wind exposure, map and tips to help you decide when to visit.`,
  gr: `Δες πρακτικές πληροφορίες για ${beachName} σε ${islandName}, όπως τοποθεσία, τύπο παραλίας, έκθεση στον άνεμο, χάρτη και χρήσιμες συμβουλές.`,
  de: `Strand ${beachName}, ${islandName} (Griechenland). Prüfe vor dem Besuch Wind, Wellen, Wetter und die Lage des Strandes.`,
  fr: `Plage ${beachName}, ${islandName} (Grèce). Vérifiez le vent, les vagues, la météo et l'exposition de la plage avant d'y aller.`,
  it: `Spiaggia ${beachName}, ${islandName} (Grecia). Controlla vento, onde, meteo ed esposizione della spiaggia prima di andare.`,
});
const hasUnsupportedStaticConditionCopy = text => {
  const value = String(text || '');
  if (!value) return false;
  if (/\b(today|today's|today’s|heute|oggi)\b|aujourd['’]hui|\bdu jour\b|\u03c3\u03ae\u03bc\u03b5\u03c1\u03b1|\u03c3\u03b7\u03bc\u03b5\u03c1\u03b9\u03bd/i.test(value)) return true;
  if (/(?:\bsafe(?:st)?\b|\u03b1\u03c3\u03c6\u03b1\u03bb)/i.test(value) && !/\b(safety|lifeguard|warning flags?|beach flags?|red flags?|yellow flags?|avoid|caution|does not replace|do not replace|not replace|follow)\b/i.test(value)) return true;
  if (/\bguarantee(?:d)?\b/i.test(value) && !/\b(?:not|no|never|without)\s+\w*\s*guarantee/i.test(value)) return true;
  if (/\b(calm|calmer|calmest)\b|\u03ae\u03c1\u03b5\u03bc|\u03b3\u03b1\u03bb\u03ae\u03bd|\u03bd\u03b7\u03bd\u03b5\u03bc/i.test(value) && !/\b(not|avoid|conditions?|mild|low-wind|wind and waves|check)\b|\u03ad\u03bb\u03b5\u03b3\u03be\u03b5|\u03c3\u03c5\u03bd\u03b8\u03ae\u03ba/i.test(value)) return true;
  // NOTE (08/08/2026): the hedge list carried English "usually" but not its Greek
  // equivalent \u03c3\u03c5\u03bd\u03ae\u03b8\u03c9\u03c2 \u2014 an asymmetry, not a policy. 05/08 settled that
  // \u03c3\u03c5\u03bd\u03ae\u03b8\u03c9\u03c2 is THE word this project uses to mark a seasonal tendency
  // (see LOCAL_WIND_SECTION: "EVERY TITLE SAYS USUALLY"), so a sentence carrying
  // it is hedged by construction. Without this, the meta verdict below could not
  // reuse the same vocabulary the page body already prints.
  if (/\b(sheltered|wind-protected|protected from|fully protected)\b|\u03c0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c4\u03b5\u03c5|\u03b1\u03c0\u03ac\u03bd\u03b5\u03bc|\u03c5\u03c0\u03ae\u03bd\u03b5\u03bc/i.test(value) && !/\b(usually|often|may|might|can|more|less|available|orientation|oriented|based on|not guaranteed|check|compare|before you go|conditions vary|depending|signal|data|less exposed|more comfortable)\b|\u03bc\u03c0\u03bf\u03c1\u03b5\u03af|\u03c3\u03c5\u03c7\u03bd|\u03c3\u03c5\u03bd\u03ae\u03b8|\u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc|\u03c0\u03c1\u03bf\u03c3\u03b1\u03bd\u03b1\u03c4\u03bf\u03bb|\u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd|\u03c0\u03c1\u03b9\u03bd\s+\u03c0\u03b1\u03c2|\u03c0\u03b9\u03bf/i.test(value)) return true;
  return false;
};

const beachDescriptionFor = (beach, beachName, islandName, language) => {
  const fallback = beachFallbackDescription(beachName, islandName, language);
  if (language !== 'en' && language !== 'gr') return fallback;
  const authored = localized(beach.description, '', language);
  return authored && !hasUnsupportedStaticConditionCopy(authored) ? authored : fallback;
};

// Trim a sentence to a meta-description length without cutting a word in half.
const truncateForMeta = (text, max = 160) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // Strip trailing punctuation/spaces so we never render "… —…", "…,…" or the
  // "νερά.…" that a sentence boundary landing exactly on the cut produced.
  const trimmed = slice.slice(0, lastSpace > 80 ? lastSpace : max).replace(/[\s—–,.·-]+$/u, '').trim();
  return `${trimmed}…`;
};

// Hand-written meta-description overrides for specific beach pages, keyed by
// `${region.id}#${beach.id}`. These pages rank well in Search Console but earn
// almost no clicks: the generated description (built/area template) is identical
// across beaches and gives no reason to click. Each override states the beach's
// own durable, data-backed traits (type, shelter orientation, amenities) plus
// the live-conditions value prop — en/gr only, ≤155 chars. This is the only
// per-page lever that does NOT touch beach data: the SERP description otherwise
// comes from the generated `description` field (or the Milos curated story).
const SEO_META_DESCRIPTION_OVERRIDES = {
  // Milos (override sits ahead of the curated story so the meta leads with a
  // conditions hook; the full editorial story still renders in the page body).
  'south-aegean-milos#1932': {
    en: 'Pollonia, Milos: a sandy fishing-village beach with sunbeds, parking and tavernas, good for families. Check wind and waves before you go.',
    gr: 'Πολλώνια Μήλου: αμμώδης παραλία σε ψαροχώρι, με ξαπλώστρες, πάρκινγκ και ταβέρνες, καλή για οικογένειες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-milos#1924': {
    en: 'Triades, Milos: remote sand-and-pebble coves on the wild west coast, good for snorkeling.',
    gr: 'Τριάδες Μήλου: τρεις απομακρυσμένοι όρμοι με άμμο και βότσαλο στη δυτική ακτή, καλοί για snorkeling.',
  },
  'north-aegean-lemnos#1455': {
    en: 'Mikro Fanaraki, Lemnos: organised sandy beach with sunbeds, a bar and parking.',
    gr: 'Μικρό Φαναράκι, Λήμνος: οργανωμένη αμμώδης παραλία με ξαπλώστρες, bar και πάρκινγκ.',
  },
  'peloponnese-korinthia-mainland#1528': {
    en: 'Lychnari, Korinthia: a quiet pebble beach, good for snorkeling.',
    gr: 'Λυχνάρι Κορινθίας: ήσυχη παραλία με βότσαλο, καλή για snorkeling.',
  },
  'peloponnese-korinthia-mainland#1523': {
    en: 'Kalogerolimano, Korinthia: a pebble cove, good for snorkeling.',
    gr: 'Καλογερολίμανο Κορινθίας: όρμος με βότσαλο, καλός για snorkeling.',
  },
  'west-greece-ileia-mainland#2568': {
    en: 'Kounoupeli, Ileia: a quiet, family-friendly sand-and-pebble beach with sunbeds. Check wind and waves before you go.',
    gr: 'Κουνουπέλι Ηλείας: ήσυχη, οικογενειακή παραλία με άμμο, βότσαλο και ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'thessaly-magnesia-mainland---pelion#2721': {
    en: 'Fakistra, Pelion: a secluded pebble cove with clear water, good for snorkeling. Check wind and waves before you go.',
    gr: 'Φακίστρα Πηλίου: απομακρυσμένος όρμος με βότσαλο και καθαρά νερά, καλός για snorkeling. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-paros#2029': {
    en: 'Kalogeros, Paros: a sand-and-pebble beach, good for snorkeling.',
    gr: 'Καλόγερος Πάρου: παραλία με άμμο και βότσαλο, καλή για snorkeling.',
  },
  'crete-crete-chania#574': {
    en: 'Platanias, Chania: a long organised sandy beach near Chania with sunbeds. Check wind and waves before you go.',
    gr: 'Πλατανιάς Χανίων: μεγάλη οργανωμένη αμμώδης παραλία κοντά στα Χανιά, με ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  // Ranks well (~pos 9) with impressions but near-zero clicks: no traits/story in
  // data, so the generated meta is the bare live-CTA template. The durable, verified
  // hook the template can't see is the adjacent Diros Caves (Vlychada) in Mani.
  'peloponnese-lakonia-mainland#3071': {
    en: 'Diros Beach, Mani: a pebble cove with clear water right beside the Diros Caves in Laconia. Check live wind & waves before you go.',
    gr: 'Παραλία Διρού, Μάνη: όρμος με βότσαλα και καθαρά νερά, ακριβώς δίπλα στα Σπήλαια Διρού. Δες live άνεμο & κύμα πριν πας.',
  },
  // Same pattern (impressions, ~zero clicks, empty traits): the honest hook is a
  // quiet, natural beach with clear water and tavernas nearby, an easy Saronic
  // escape from Athens — none of which the generated template surfaces.
  'attica-salamina#3056': {
    en: 'Kaki Vigla, Salamina: a quiet natural beach with clear water and tavernas nearby, an easy escape from Athens. Check live wind & waves.',
    gr: 'Κακή Βίγλα, Σαλαμίνα: ήσυχη φυσική παραλία με καθαρά νερά και ταβέρνες δίπλα, κοντά στην Αθήνα. Δες live άνεμο & κύμα πριν πας.',
  },
  // Zero-click rescue (2026-07-21): high-impression pages stuck ~pos 9 with 0 clicks
  // in GSC because the generated meta is the bare template. Each hook below is a
  // verified, data-backed trait (type/amenities/orientation) — reliability first,
  // no invented claims; the 3 OSM-only bleeders (Porto Fino, Perani, Nopigia) are
  // left on the template since their data carries no honest distinguishing hook.
  'south-aegean-lipsi#2373': {
    en: 'Katsadia, Lipsi: an organised sandy beach with sunbeds and a taverna.',
    gr: 'Κατσαδιά, Λειψοί: οργανωμένη αμμώδης παραλία με ξαπλώστρες και ταβέρνα.',
  },
  'attica-west-attica-mainland#191': {
    en: 'Prosili, West Attica: a quiet pebble beach in Aigosthena bay, good for snorkeling, with a taverna nearby. Check live wind & waves before you go.',
    gr: 'Προσήλι, Δυτική Αττική: ήσυχη παραλία με βότσαλο στον όρμο Αιγοσθένων, καλή για snorkeling, με ταβέρνα κοντά. Δες live άνεμο & κύμα πριν πας.',
  },
  'south-aegean-milos#1900': {
    en: 'Agios Sostis, Milos: a sandy beach with shallow water, parking and a taverna nearby.',
    gr: 'Άγιος Σώστης, Μήλος: αμμώδης παραλία με ρηχά νερά, πάρκινγκ και ταβέρνα κοντά.',
  },
  'south-aegean-milos#1905': {
    en: 'Gerania, Milos: a quiet sand-and-pebble beach with shallow water and parking, reached by a dirt road with few facilities. Check live wind & waves.',
    gr: 'Γερανιά, Μήλος: ήσυχη παραλία με άμμο και βότσαλο, ρηχά νερά και πάρκινγκ, πρόσβαση από χωματόδρομο με λίγες παροχές. Δες live άνεμο & κύμα.',
  },
  'south-aegean-symi#2465': {
    en: 'Nos, Symi: an organised sandy beach with sunbeds, a short walk from Symi town and the harbour at Gialos. Check live wind & waves before you go.',
    gr: 'Νος, Σύμη: οργανωμένη αμμώδης παραλία με ξαπλώστρες, λίγα λεπτά με τα πόδια από τη Σύμη και το λιμάνι στον Γιαλό. Δες live άνεμο & κύμα.',
  },
};

// The live-conditions CTA that closes a beach-page meta description. Allowed
// ONLY on beach pages (they hydrate into the SPA and show live wind/waves) — a
// functional, truthful promise, never on the static category/national articles.
const BEACH_META_CTA = {
  long: {
    en: 'Check live wind, waves and weather before you go — map, access and nearby beaches.',
    gr: 'Δες live άνεμο, κύμα και καιρό πριν πας — χάρτης, πρόσβαση και κοντινές παραλίες.',
    de: 'Prüfe Wind, Wellen und Wetter live, bevor du losfährst — Karte, Zufahrt und Strände in der Nähe.',
    fr: 'Vérifiez le vent, les vagues et la météo en direct avant de partir — carte, accès et plages voisines.',
    it: 'Controlla vento, onde e meteo in diretta prima di partire — mappa, accesso e spiagge vicine.',
  },
  short: {
    en: 'Check live wind, waves and weather before you go.',
    gr: 'Δες live άνεμο, κύμα και καιρό πριν πας.',
    de: 'Prüfe Wind, Wellen und Wetter live, bevor du losfährst.',
    fr: 'Vérifiez le vent, les vagues et la météo en direct avant de partir.',
    it: 'Controlla vento, onde e meteo in diretta prima di partire.',
  },
  tiny: {
    en: 'Check live weather, wind & waves.',
    gr: 'Δες live καιρό, άνεμο & κύμα.',
    de: 'Wetter, Wind & Wellen live prüfen.',
    fr: 'Météo, vent et vagues en direct.',
    it: 'Meteo, vento e onde in diretta.',
  },
  story: {
    en: 'Check live weather, wind & waves.',
    gr: 'Δες live καιρό, άνεμο & κύμα.',
    de: 'Wetter, Wind & Wellen live prüfen.',
    fr: 'Météo, vent et vagues en direct.',
    it: 'Meteo, vento e onde in diretta.',
  },
};

// Comma-joined, data-backed trait clause for the beach meta template (en/gr).
// Priority: type → 1–2 amenities → snorkeling → northerly shelter (qualified).
// Shelter uses "often more / συχνά πιο" so it passes the honesty guards and the
// audit (it is a comparative, orientation-based claim, not a state promise).
const BEACH_TYPE_TRAIT = {
  sandy:           { en: 'Sandy beach',            gr: 'Αμμώδης παραλία',            de: 'Sandstrand',              fr: 'Plage de sable',            it: 'Spiaggia di sabbia' },
  pebbles:         { en: 'Pebble beach',           gr: 'Παραλία με βότσαλο',         de: 'Kiesstrand',              fr: 'Plage de galets',           it: 'Spiaggia di ciottoli' },
  'sandy-pebbles': { en: 'Sand & pebble beach',    gr: 'Παραλία με άμμο & βότσαλο',  de: 'Sand- und Kiesstrand',    fr: 'Plage de sable et galets',  it: 'Spiaggia di sabbia e ciottoli' },
  rocky:           { en: 'Rocky beach',            gr: 'Βραχώδης παραλία',           de: 'Felsstrand',              fr: 'Plage rocheuse',            it: 'Spiaggia rocciosa' },
};
// The traits that go in the snippet, in all five languages. This used to be
// en/gr only, and de/fr/it fell through to a template that said the same
// sentence on every page with only the name changed. Search Console, 28 days to
// 2026-07-27, is unusually clean about what that cost: Italian beach pages sit
// at average position **9.5 — the same as Greek (9.5)** — and earn **1.37% CTR
// against Greek 2.63%**. Same rank, half the clicks. Position does not explain
// it; the snippet does. (French looks fine at 2.51% but that is 6 clicks — noise,
// not evidence.)
//
// Wording note for the shelter trait: fr/it must carry a hedge ("souvent/plus",
// "spesso/più") or our own audit flags them, and it is right to — orientation is
// a tendency, not a promise.
const TRAIT_PHRASES = {
  organisedWithSunbeds: { en: 'organised with sunbeds', gr: 'οργανωμένη με ξαπλώστρες', de: 'organisiert mit Liegen', fr: 'aménagée avec transats', it: 'attrezzata con lettini' },
  organised:            { en: 'organised',              gr: 'οργανωμένη',                de: 'organisiert',            fr: 'aménagée',               it: 'attrezzata' },
  sunbeds:              { en: 'with sunbeds',           gr: 'με ξαπλώστρες',             de: 'mit Liegen',             fr: 'avec transats',          it: 'con lettini' },
  parking:              { en: 'with parking',           gr: 'με πάρκινγκ',               de: 'mit Parkplatz',          fr: 'avec parking',           it: 'con parcheggio' },
  food:                 { en: 'with food nearby',       gr: 'με φαγητό κοντά',           de: 'mit Essen in der Nähe',  fr: 'restauration à proximité', it: 'con ristoro vicino' },
  family:               { en: 'family-friendly',        gr: 'οικογενειακή',              de: 'familienfreundlich',     fr: 'familiale',              it: 'adatta alle famiglie' },
  snorkeling:           { en: 'good for snorkeling',    gr: 'καλή για snorkeling',       de: 'gut zum Schnorcheln',    fr: 'bien pour le snorkeling', it: 'buona per lo snorkeling' },
  northerly:            { en: 'often more sheltered in northerly winds', gr: 'συχνά πιο απάνεμη σε βόρειους ανέμους', de: 'bei Nordwind oft ruhiger gelegen', fr: 'souvent plus abritée par vent du nord', it: 'spesso più riparata con venti da nord' },
  // Added 08/08/2026. These three fields were already in every beach record and
  // were the strongest remaining separators between look-alike snippets:
  // shallow water 1.427 beaches, quiet 594, remote 375. Shallow also happens to
  // be the one modifier with measured search demand ("παραλίες για παιδιά",
  // 551 impressions/28d — every other modifier is under 320).
  shallow:              { en: 'shallow water',          gr: 'ρηχά νερά',                 de: 'flaches Wasser',         fr: 'eau peu profonde',       it: 'acqua bassa' },
  quiet:                { en: 'quiet',                  gr: 'ήσυχη',                     de: 'ruhig',                  fr: 'tranquille',             it: 'tranquilla' },
  remote:               { en: 'secluded',               gr: 'απομονωμένη',               de: 'abgelegen',              fr: 'isolée',                 it: 'isolata' },
  // Added 16/08/2026. Seven fields that were already in every beach record and
  // that the snippet never read. Measured coverage across the 2.862 records:
  // naturalShade 42%, deepWaters 25%, beachBar 21%, nearbyCamping 14%,
  // accessibility DIFFICULT 9% / BOAT_ONLY 4%, shower 9%.
  //
  // WHY: with only the ten phrases above, the composer could emit just 399
  // distinct trait signatures for 2.862 beaches — 56 pages shared the sentence
  // "Sand & pebble beach, organised with sunbeds. Usually a sheltered shore in
  // the meltemi." word for word. Beach pages sit at the same position band as
  // the guide articles (4–10, 47.349 vs 35.085 impressions in the 28 days to
  // 13/08) and earn 3,0% CTR against the guides' 4,7%. Rank does not explain
  // that; the guides say something specific per page and these did not.
  //
  // beachBar is deliberately separate from `food`: "beach bar" is a query people
  // actually type (111 impressions / 0 clicks in the same window) and it means
  // something different from a taverna to the person choosing a beach.
  beachBar:             { en: 'with a beach bar',       gr: 'με beach bar',              de: 'mit Beachbar',           fr: 'avec bar de plage',      it: 'con beach bar' },
  shade:                { en: 'with natural shade',     gr: 'με φυσική σκιά',            de: 'mit natürlichem Schatten', fr: 'avec ombre naturelle', it: 'con ombra naturale' },
  camping:              { en: 'campsite nearby',        gr: 'με κάμπινγκ κοντά',         de: 'Campingplatz in der Nähe', fr: 'camping à proximité',  it: 'campeggio nelle vicinanze' },
  shower:               { en: 'with showers',           gr: 'με ντουζ',                  de: 'mit Duschen',            fr: 'avec douches',           it: 'con docce' },
  deep:                 { en: 'deep water',             gr: 'βαθιά νερά',                de: 'tiefes Wasser',          fr: 'eau profonde',           it: 'acqua profonda' },
  // Access is stated only when it is NOT the default. 52% of beaches are EASY;
  // saying so on half the site is noise, while "hard to reach" / "reached by
  // boat" is exactly what the secluded-beach searcher is looking for.
  hardAccess:           { en: 'hard to reach',          gr: 'με δύσκολη πρόσβαση',       de: 'schwer zugänglich',      fr: "d'accès difficile",      it: 'di difficile accesso' },
  boatAccess:           { en: 'reached by boat',        gr: 'με πρόσβαση από τη θάλασσα', de: 'nur per Boot erreichbar', fr: 'accessible en bateau',  it: 'raggiungibile in barca' },
};
const traitPhrase = (key, language) => TRAIT_PHRASES[key][language] || TRAIT_PHRASES[key].en;

// Meta-sized shelter verdict: one short line per wind regime × measured level.
//
// WHY (08/08/2026): the nationally measured seasonal verdict reached the page
// BODY on 06/08, but the snippet Google actually shows still carried only the
// orientation-derived hedge — "συχνά πιο απάνεμη σε βόρειους ανέμους" appeared
// on 241 Greek pages, and the top four snippet bodies covered a quarter of the
// site. The verdict is the one fact here no competitor holds; it belongs in the
// snippet. The full LOCAL_WIND_SECTION sentence does not fit 155 characters, so
// these are short forms of the SAME verdict read from the SAME baked
// `localWindStatus` — never a second, hand-written scale.
//
// Greek names a feminine subject ("ακτή") on purpose: the beach's own name may be
// neuter (boat-only spots like "Το Κλέφτικο" — the trap `statusBoatGr` exists for
// in the body copy), and an adjective agreeing with the wrong gender would be a
// grammar error on hundreds of pages.
const BEACH_META_SHELTER = {
  aegean: {
    protected: { en: 'Usually a sheltered shore in the meltemi.', gr: 'Συνήθως προστατευμένη ακτή στα μελτέμια.', de: 'Beim Meltemi meist geschützte Küste.', fr: 'Côte généralement abritée au meltemi.', it: 'Costa di solito riparata dal meltemi.' },
    partial:   { en: 'Partial shelter in the meltemi.',           gr: 'Μερική προστασία στα μελτέμια.',          de: 'Teilweiser Schutz beim Meltemi.',     fr: 'Abri partiel au meltemi.',            it: 'Riparo parziale dal meltemi.' },
    exposed:   { en: 'Exposed shore in the meltemi.',             gr: 'Εκτεθειμένη ακτή στα μελτέμια.',          de: 'Beim Meltemi exponierte Küste.',      fr: 'Côte exposée au meltemi.',            it: 'Costa esposta al meltemi.' },
  },
  ionian: {
    protected: { en: 'Usually a sheltered shore in the maistros.', gr: 'Συνήθως προστατευμένη ακτή στον μαΐστρο.', de: 'Beim Maistros meist geschützte Küste.', fr: 'Côte généralement abritée au maïstro.', it: 'Costa di solito riparata dal maestrale.' },
    partial:   { en: 'Partial shelter in the maistros.',           gr: 'Μερική προστασία στον μαΐστρο.',           de: 'Teilweiser Schutz beim Maistros.',      fr: 'Abri partiel au maïstro.',              it: 'Riparo parziale dal maestrale.' },
    exposed:   { en: 'Exposed shore in the maistros.',             gr: 'Εκτεθειμένη ακτή στον μαΐστρο.',           de: 'Beim Maistros exponierte Küste.',       fr: 'Côte exposée au maïstro.',              it: 'Costa esposta al maestrale.' },
  },
  thermaic: {
    protected: { en: 'Usually a sheltered shore in the summer wind.', gr: 'Συνήθως προστατευμένη ακτή στον καλοκαιρινό αέρα.', de: 'Beim Sommerwind meist geschützte Küste.', fr: "Côte généralement abritée par le vent d'été.", it: 'Costa di solito riparata dal vento estivo.' },
    partial:   { en: 'Partial shelter in the summer wind.',           gr: 'Μερική προστασία στον καλοκαιρινό αέρα.',           de: 'Teilweiser Schutz beim Sommerwind.',      fr: "Abri partiel par le vent d'été.",             it: 'Riparo parziale dal vento estivo.' },
    exposed:   { en: 'Exposed shore in the summer wind.',             gr: 'Εκτεθειμένη ακτή στον καλοκαιρινό αέρα.',           de: 'Beim Sommerwind exponierte Küste.',       fr: "Côte exposée au vent d'été.",                 it: 'Costa esposta al vento estivo.' },
  },
};

// The measured verdict for this beach, in meta form, or '' when the model
// abstained (no baked status) — abstention prints nothing, exactly as the body
// copy does. Never invents a level.
const beachMetaShelterLine = (beach, region, language) => {
  const lang = BEACH_META_SHELTER.aegean.protected[language] ? language : 'en';
  const status = beach?.localWindStatus;
  if (status !== 'protected' && status !== 'partial' && status !== 'exposed') return '';
  const regime = getRegionWindContext(region?.id);
  return BEACH_META_SHELTER[regime]?.[status]?.[lang] || '';
};

// Ordered, data-backed trait phrases for the snippet. Returns the list so the
// composer can drop the weakest ones when the line runs long, instead of losing
// the whole clause.
// How the three snippet slots are filled, and why in this order.
//
// `tier` keeps the sentence readable: tier 1 is what the place IS and why you
// would pick it; tier 2 is useful detail that must never push tier 1 out (a
// snippet reading "Sandy beach, with showers, campsite nearby" for an organised
// family beach is worse for the reader even though it is rarer).
//
// `share` is the measured national coverage of each field (% of the 2.862
// records, counted 16/08/2026). Inside a tier the RAREST trait wins, because a
// trait half the coast also has separates nothing. Ordering by raw search demand
// was tried first and measured worse: it collapsed 214 beaches onto the single
// sentence "Sandy beach, organised with sunbeds, shallow water, family-friendly"
// The rarity order lifts distinct trait signatures from 399 to 818.
//
// Re-measure `share` if the underlying data changes materially; it only decides
// ordering, so drift degrades the spread gracefully rather than saying anything
// untrue.
const TRAIT_SELECTION = [
  // Tier 0 is exempt from the rarity rule on purpose. "Sunbeds" is the one
  // modifier with a MEASURED click-through rate rather than just impressions:
  // 9,8% against a 4,0% site average in the 28 days to 13/08 (the highest of
  // any intent we serve, on 61 impressions at position 6,2). Sorting it by
  // rarity buried it — it appeared on 119 pages instead of the ~1.000 that are
  // organised — so it is pinned ahead of the rarity ladder. Common and wanted
  // beats rare and ignored.
  { key: 'organisedWithSunbeds', tier: 0, share: 35, when: b => b.amenities?.organized === true && b.amenities?.sunbeds === true },
  { key: 'organised',            tier: 0, share: 8,  when: b => b.amenities?.organized === true && b.amenities?.sunbeds !== true },
  { key: 'sunbeds',              tier: 0, share: 10, when: b => b.amenities?.organized !== true && b.amenities?.sunbeds === true },
  { key: 'shallow',              tier: 1, share: 50, when: b => (b.waterDepth?.type || b.waterDepth) === 'shallow' },
  { key: 'family',               tier: 1, share: 29, when: b => b.environment?.familyFriendly === true },
  { key: 'snorkeling',           tier: 1, share: 26, when: b => b.activities?.snorkeling === true },
  { key: 'beachBar',             tier: 1, share: 21, when: b => b.amenities?.beachBar === true },
  { key: 'food',                 tier: 1, share: 31, when: b => b.amenities?.restaurant === true || b.amenities?.taverna === true },
  { key: 'boatAccess',           tier: 1, share: 4,  when: b => String(b.accessibility) === 'BOAT_ONLY' },
  { key: 'hardAccess',           tier: 1, share: 9,  when: b => String(b.accessibility) === 'DIFFICULT' },
  { key: 'remote',               tier: 2, share: 13, when: b => b.environment?.remote === true },
  { key: 'quiet',                tier: 2, share: 31, when: b => b.environment?.remote !== true && b.environment?.quiet === true },
  { key: 'shade',                tier: 2, share: 42, when: b => b.amenities?.naturalShade === true },
  { key: 'camping',              tier: 2, share: 14, when: b => Boolean(b.nearbyCamping) },
  { key: 'shower',               tier: 2, share: 9,  when: b => b.amenities?.shower === true },
  { key: 'deep',                 tier: 2, share: 25, when: b => b.characteristics?.deepWaters === true },
  { key: 'parking',              tier: 2, share: 50, when: b => b.amenities?.parking === true },
];

const beachTraitList = (beach, language, { includeNortherly = true } = {}) => {
  const lang = TRAIT_PHRASES.organised[language] ? language : 'en';
  const features = TRAIT_SELECTION
    .filter(entry => {
      try {
        return entry.when(beach) === true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.tier - b.tier || a.share - b.share)
    .map(entry => traitPhrase(entry.key, lang));
  // The orientation hedge is now the FALLBACK, not the headline: when the model
  // baked a real verdict, `beachMetaShelterLine` says the stronger, measured
  // thing and repeating a weaker version of the same claim only wastes
  // characters. Kept for the handful of beaches where the model abstained.
  if (includeNortherly && Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d))) {
    features.push(traitPhrase('northerly', lang));
  }
  return features;
};


// Programmatic beach meta template, all five languages:
// "{Label}, {island}: {traits} {CTA}". de/fr/it used to bail out here and fall
// back to `beachDescriptionFor`, a fixed sentence that carried no information
// about the beach — "Spiaggia X, Santorini (Grecia). Controlla vento, onde,
// meteo ed esposizione della spiaggia prima di andare." on every single Italian
// page. The Greek page for the same beach opened with what the place is actually
// like. That gap is the best explanation we have for identical rank (9.5) and
// half the CTR (1.37% vs 2.63%).
const beachTraitMetaDescription = (beach, region, beachName, islandName, language) => {
  const label = localizedBeachLabel(beachName, language);
  const lang = BEACH_TYPE_TRAIT.sandy[language] ? language : 'en';
  const head = `${label}, ${islandName}: `;
  const shelter = beachMetaShelterLine(beach, region, language);
  // The orientation hedge only earns its place when no verdict was baked.
  const typePhrase = BEACH_TYPE_TRAIT[beach?.beachType]?.[lang] || '';
  const traitList = beachTraitList(beach, language, { includeNortherly: !shelter });
  const sentence = count => {
    const parts = [typePhrase, ...traitList.slice(0, count)].filter(Boolean);
    if (!parts.length) return '';
    // The trait phrases are lowercase because they normally follow the beach
    // type ("Αμμώδης παραλία, ήσυχη"). On the 112 beaches whose type is unknown
    // the first one starts the sentence instead, and read as a typo: "Παραλία
    // Δημήτρανι, Σαλαμίνα: ήσυχη."
    if (!typePhrase) parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${parts.join(', ')}.`;
  };
  // Ordered by what we would rather keep. The measured verdict outranks both the
  // trait list and the CTA: it is the only clause on the line that a competitor
  // cannot copy from a tourism page, and it is what the query actually asks.
  // Three traits, not four: measured, a fourth clause fits within 155 characters
  // on only 3 of 2.854 Greek pages once the head, the verdict and the CTA are
  // paid for. It bought nothing and was removed rather than left as decoration.
  const bodies = [3, 2, 1, 0]
    .map(count => [sentence(count), shelter].filter(Boolean).join(' '))
    .filter(Boolean);
  // Shed traits before shedding the call to action — the CTA is what turns a
  // description into a click, so it goes last, not first.
  const candidates = [
    ...bodies.map(body => `${head}${body} ${BEACH_META_CTA.tiny[language]}`),
    ...bodies.map(body => `${head}${body}`),
  ];
  // No traits and no verdict at all (unknown type, model abstained): keep the
  // pre-existing behaviour rather than emitting a bare name.
  candidates.push(`${head}${BEACH_META_CTA.long[language]}`);
  candidates.push(`${head}${BEACH_META_CTA.short[language]}`);
  candidates.push(`${head}${BEACH_META_CTA.tiny[language]}`);
  for (const candidate of candidates) if (candidate.length <= 155) return candidate;
  return truncateForMeta(candidates[candidates.length - 1], 155);
};

// Per-beach <head>/JSON-LD description cascade:
//   1. hand-written per-page override (12-page CTR fix), unchanged
//   2. unique editorial story opener + live CTA (en/gr story beaches)
//   3. programmatic trait template + live CTA (en/gr), or the localized
//      practical-info template (de/fr/it).
// The authored `description` data field is no longer used for the meta (it was
// generic across beaches); it still renders in the visible page body.
const beachMetaDescription = (beach, region, beachName, islandName, language) => {
  const override = SEO_META_DESCRIPTION_OVERRIDES[`${region?.id}#${beach.id}`];
  if (override && (language === 'en' || language === 'gr') && override[language] && !hasUnsupportedStaticConditionCopy(override[language])) {
    const text = override[language];
    const shelter = beachMetaShelterLine(beach, region, language);
    if (!shelter) return text;
    // These overrides were written as complete snippets, each ending in its own
    // call to action. That trailing sentence is dropped and re-added by the
    // composer, so the characters it was holding can pay for the verdict — the
    // hand-written part keeps describing the beach's character, which is what it
    // is good at, and the shelter level comes from the data.
    //
    // WHY (08/08/2026): seven of the sixteen asserted shelter from orientation
    // alone, written before the verdict was baked. Two contradicted it outright —
    // Καλόγερος Πάρου read "υπήνεμη στο μελτέμι" over data that says *exposed*,
    // Λυχνάρι claimed shelter over *partial*. A hand-written sentence cannot keep
    // step with data that changes; only one place may state the level.
    // `\s`, not `\b`: JavaScript's word boundary is ASCII-only, so it never fires
    // after "Δες" and the Greek CTA silently survived the strip.
    const traits = text.replace(/(?:^|(?<=\.\s))(?:Check|Δες)\s[^.]*\.\s*$/u, '').trim();
    const body = traits || text;
    const withCta = `${body} ${shelter} ${BEACH_META_CTA.tiny[language]}`;
    if (withCta.length <= 155) return withCta;
    const withoutCta = `${body} ${shelter}`;
    if (withoutCta.length <= 155) return withoutCta;
    return text;
  }
  const story = getBeachStory(region, beach, language);
  const safeStoryParagraph = story?.paragraphs?.find(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (safeStoryParagraph) {
    // 08/08/2026: the story opener used to own the whole snippet, and on 789
    // Greek pages that silently cost us the measured verdict — the one clause a
    // tourism site cannot write. The opener is still the lead (it is genuinely
    // unique prose, which the trait template is not), but it now yields
    // characters to the verdict rather than the other way round.
    const shelter = beachMetaShelterLine(beach, region, language);
    const cta = BEACH_META_CTA.story[language];
    if (shelter) {
      for (const openerLength of [115, 100, 85, 70]) {
        const opener = truncateForMeta(safeStoryParagraph, openerLength);
        const withCta = `${opener} ${shelter} ${cta}`;
        if (withCta.length <= 155) return withCta;
        const withoutCta = `${opener} ${shelter}`;
        if (withoutCta.length <= 155) return withoutCta;
      }
    }
    const opener = truncateForMeta(safeStoryParagraph, 115);
    const withCta = `${opener} ${cta}`;
    if (withCta.length <= 155) return withCta;
    return truncateForMeta(safeStoryParagraph, 155);
  }
  return beachTraitMetaDescription(beach, region, beachName, islandName, language);
};

// Visible, crawlable editorial section (unique geology/history/character prose)
// rendered into the static beach page body. Its <h2> is the curated, keyword-ish
// story title (e.g. "Το σεληνιακό τοπίο της Μήλου").
const renderBeachStory = (region, beach, language) => {
  const story = getBeachStory(region, beach, language);
  if (!story) return '';
  const safeParagraphs = story.paragraphs.filter(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (safeParagraphs.length === 0) return '';
  const heading = !hasUnsupportedStaticConditionCopy(story.title) ? story.title : '';
  return `
        <section style="margin:0 0 22px;">
          ${heading ? `<h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>` : ''}
          ${safeParagraphs.map(p => `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`).join('')}
        </section>`;
};

// Short per-beach blurb for the guide-article beach lists: the curated story
// title (a unique, evocative hook) + a trimmed opening sentence. Only beaches
// with a curated story (Milos, en/gr) get one; others fall back to the plain
// structured meta. Returns inner text or '' (the <p> wrapper is added by the
// caller, outside the <a> so it is body text, not anchor text).
const intentBeachBlurbText = (region, beach, language) => {
  const story = getBeachStory(region, beach, language);
  if (!story) return '';
  const safeLead = story.paragraphs.find(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (!safeLead) return '';
  const lead = truncateForMeta(safeLead, 150);
  const title = !hasUnsupportedStaticConditionCopy(story.title) ? story.title : '';
  return title ? `${title} — ${lead}` : lead;
};
// Localized "Beach X" / "Παραλία X" label that never doubles the noun when the
// resolved name already contains it (~21% of Greek names already include
// "Παραλία", e.g. "Παραλία Φλοίσβου" was rendering "Παραλία Παραλία Φλοίσβου").
// Mirrors utils/localization.ts#localizedBeachLabel — keep the two in sync.
const BEACH_NOUN_BY_LANG = { en: 'Beach', gr: 'Παραλία', de: 'Strand', fr: 'Plage', it: 'Spiaggia' };
const localizedBeachLabel = (beachName, language) => {
  const noun = BEACH_NOUN_BY_LANG[language] || BEACH_NOUN_BY_LANG.en;
  const alreadyHasNoun = new RegExp(`(^|\\s)${noun}(\\s|$)`, 'i').test(beachName);
  if (alreadyHasNoun) return beachName;
  return language === 'en' ? `${beachName} ${noun}` : `${noun} ${beachName}`;
};
// The conditions hook for beach-page <title>s. Leads with the WEATHER query word
// (καιρός / weather / Wetter / météo / meteo) because that is the single highest-
// demand thing users actually type — "καιρός παραλία {name}" is our exact product,
// yet no title targeted it. Wind & wave stay (our moat); "live" is dropped from the
// title to keep the region in-title (the 3-tier overflow never sacrifices the
// island for a hook word) and instead lives in the H1/description, which still
// deliver live wind/waves/weather on SPA hydration.
const BEACH_TITLE_HOOK = {
  en: 'Weather, Wind & Waves',
  gr: 'Καιρός, Άνεμος & Κύμα',
  de: 'Wetter, Wind & Wellen',
  fr: 'Météo, vent & vagues',
  it: 'Meteo, vento e onde',
};
// Greek glyphs are wider, so Google truncates GR titles a few px earlier.
const beachTitleMaxLen = language => (language === 'gr' ? 58 : 60);
const beachH1For = (beachName, islandName, language) =>
  `${localizedBeachLabel(beachName, language)}, ${islandName}`;
// Deterministic overflow tiers (spec §2.2): T1 full → T2 drop brand → T3 drop
// island → T4 bare label. The hook is never dropped before brand/island.
const beachTitleFor = (beachName, islandName, language) => {
  const label = localizedBeachLabel(beachName, language);
  const hook = BEACH_TITLE_HOOK[language] || BEACH_TITLE_HOOK.en;
  const sep = language === 'en' ? ': ' : ' — ';
  const max = beachTitleMaxLen(language);
  const tiers = [
    `${label}, ${islandName}${sep}${hook} | CalmBeach`,
    `${label}, ${islandName}${sep}${hook}`,
    `${label}${sep}${hook}`,
  ];
  for (const tier of tiers) if (tier.length <= max) return tier;
  return label;
};
const beachAttractionName = (beachName, language) => localizedBeachLabel(beachName, language);
const beachImageAltFor = (beachName, islandName, language) => {
  const label = localizedBeachLabel(beachName, language);
  return pickLang(language, {
    en: `${label} in ${islandName}, Greece`,
    gr: `${label}, ${islandName}`,
    de: `${label}, ${islandName}, Griechenland`,
    fr: `${label}, ${islandName}, Grèce`,
    it: `${label}, ${islandName}, Grecia`,
  });
};

// The beach page was the only page category shipping ZERO <img> in its HTML —
// measured across all 8.210 of them (10 §4). Google was given 18.504 impressions
// worth of beach pages with no picture to put next to the result, and the pages
// convert at 2,8% CTR from position 8,9, below our own curve.
//
// Note what this image is and is not: React replaces #root on mount, so a
// visitor with JavaScript sees it for a moment and then sees the app. Its real
// audience is the crawler and the reader whose JS has not arrived yet — which is
// exactly who decides whether a thumbnail appears in the search result. Hence
// lazy/async: it must never compete with the app for bandwidth.
//
// The credit line is not decoration. 958 of our photos are under licences that
// require attribution (risk #2), so a photo without its author does not ship.
// `beachCardPhoto` already refuses to return anything it cannot attribute.
const renderBeachPhotoFigure = (beach, beachName, islandName, language) => {
  const photo = beachCardPhoto(beach, language);
  if (!photo) return '';
  const alt = pickLang(language, {
    en: `${beachName} beach, ${islandName}, Greece`,
    gr: `Παραλία ${beachName}, ${islandName}`,
    de: `Strand ${beachName}, ${islandName}, Griechenland`,
    fr: `Plage ${beachName}, ${islandName}, Grèce`,
    it: `Spiaggia ${beachName}, ${islandName}, Grecia`,
  });
  const { author, license, sourceUrl } = photo.credit;
  // A visitor's photo has no external licence page to point at, so its byline is
  // plain text. Linking it to "" would make the caption reload the page.
  const creditLine = photo.isUgc
    ? `<figcaption style="margin:6px 0 0;font-size:12px;color:#64748b;">${escapeHtml(beachName)} — ${escapeHtml(photo.creditLabel)}</figcaption>`
    : photo.creditRequired
      ? `<figcaption style="margin:6px 0 0;font-size:12px;color:#64748b;">${escapeHtml(beachName)} — <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank" style="color:#64748b;">${escapeHtml(author)}</a>, ${escapeHtml(license)}</figcaption>`
      : '';
  // `object-position:50% 65%` — ίδιο νούμερο με το `.beach-photo-frame` του index.css.
  // Οι δύο τιμές ΠΡΕΠΕΙ να μένουν ίδιες: αυτή είναι η φωτογραφία που βλέπει ο επισκέπτης
  // πριν φορτώσει το React, και μια διαφορά θα φαινόταν ως αναπήδηση του κάδρου.
  return `
        <figure style="margin:0 0 20px;">
          <img src="${escapeHtml(photo.src2x)}" srcset="${escapeHtml(photo.src)} 400w, ${escapeHtml(photo.src2x)} 800w" sizes="(max-width:760px) 100vw, 720px" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" fetchpriority="high" decoding="async" width="800" height="600" style="width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;object-position:50% 65%;border-radius:12px;display:block;">
          ${creditLine}
        </figure>`;
};

// One <dl> row linking a hand-verified public webcam (12 beaches, 26/08/2026).
// Linked, never embedded: the page stays first-party, and the operator's name is
// the anchor so nobody mistakes the camera for ours. Search Console (90d to
// 24/08/2026) showed ~700 impressions for «<beach> κάμερα / live cam / webcam»
// landing on beach pages — the searcher wants to SEE the sea now; where a camera
// exists this row hands them to it, next to the wind and waves we measure.
const renderWebcamRow = (beach, copy) => {
  const cam = beach?.webcam;
  if (!cam?.url || !cam?.operator) return '';
  return `<dt style="font-weight:700;">${escapeHtml(copy.webcam)}</dt><dd style="margin:0;"><a href="${escapeHtml(cam.url)}" target="_blank" rel="noopener noreferrer" style="color:#0e7490;font-weight:700;">${escapeHtml(cam.operator)} ↗</a> <span style="color:#64748b;font-size:14px;">(${escapeHtml(copy.webcamNote)})</span></dd>`;
};

const staticBeachFallback = (beach, island, region, canonicalUrl, locale = prerenderLocales[0]) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const islandName = displayName(island.name, island.id, language);
  const description = beachDescriptionFor(beach, beachName, islandName, language);
  const amenityLabels = [
    beach.amenities?.organized ? copy.organizedBeach : null,
    beach.amenities?.beachBar ? copy.beachBar : null,
    beach.amenities?.sunbeds ? copy.sunbeds : null,
    beach.amenities?.parking ? copy.parking : null,
    beach.amenities?.restaurant || beach.amenities?.taverna ? copy.foodNearby : null,
    amenityTextIncludesAny(beach.metadata?.amenities, SNACK_CANTEEN_AMENITY_TERMS) ? copy.snackCanteen : null,
    beach.environment?.familyFriendly ? copy.familyFriendly : null,
    beach.environment?.quiet ? copy.quiet : null,
    beach.activities?.snorkeling ? copy.snorkeling : null,
  ].filter(Boolean);

  return `
    <div id="root">
      <main data-static-fallback style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">${escapeHtml(copy.brand)}</p>
        ${renderBeachBreadcrumb(region, island, beachName, language, locale)}
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(beachH1For(beachName, islandName, language))}</h1>
        ${renderBeachPhotoFigure(beach, beachName, islandName, language)}
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(description)}</p>
        ${renderBeachStory(region, beach, language)}
        <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 14px;margin:0 0 20px;">
          <dt style="font-weight:700;">${escapeHtml(copy.region)}</dt><dd style="margin:0;">${escapeHtml(islandName)}, Greece</dd>
          ${renderDefinitionRow(copy.beachType, readableBeachType(beach, language))}
          ${renderDefinitionRow(copy.access, readableAccess(beach, language))}
          ${renderWebcamRow(beach, copy)}
          <dt style="font-weight:700;">${escapeHtml(copy.coordinates)}</dt><dd style="margin:0;">${escapeHtml(beach.coordinates?.lat)}, ${escapeHtml(beach.coordinates?.lon)}</dd>
        </dl>
        ${amenityLabels.length > 0 ? `<ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;padding:0;list-style:none;">${amenityLabels.map(label => `<li style="border:1px solid #bae6fd;border-radius:999px;padding:6px 10px;background:white;color:#075985;font-weight:700;font-size:13px;">${escapeHtml(label)}</li>`).join('')}</ul>` : ''}
        ${renderBeachNarrative(beach, island, region, language, copy.aboutHeading)}
        ${renderBeachFaq(buildBeachFaqPairs(beach, island, region, language), language)}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(copy.openAppBeach)}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewBeach)}</a></p>
        ${renderIslandGuides(island, region, locale, null, pickLang(language, {
          en: `${islandName} beach guides`,
          gr: `Οδηγοί παραλιών — ${islandName}`,
          de: `${islandName} Strandführer`,
          fr: `Guides plages — ${islandName}`,
          it: `Guide spiagge — ${islandName}`,
        }), beach)}
        ${renderNationalGuides(locale, pickLang(language, {
          en: 'Beach guides across Greece',
          gr: 'Οδηγοί παραλιών σε όλη την Ελλάδα',
          de: 'Strandführer für ganz Griechenland',
          fr: 'Guides plages dans toute la Grèce',
          it: 'Guide spiagge in tutta la Grecia',
        }), region.id)}
        ${renderShelteredNearby(beach, island, region, language, locale)}
        ${renderNearbyBeaches(beach, island, region, language, locale)}
      </main>
    </div>
  `;
};

// --- Region-page shelter hook (dataset-driven, differentiates from a plain list) ---
// Count = beaches carrying the baked `shelteredFromLocalWind` flag (computed once by
// scripts/bakeLocalWindShelter.ts via the curated-aware windClimatology, with
// context-specific sectors: meltemi N+NE / maistros NW+W). This is the SINGLE source
// shared with beachGuides + App; the prerender never recomputes it here.
const countShelteredBeaches = beaches =>
  beaches.filter(b => Number.isInteger(b.id) && b.name && b.shelteredFromLocalWind === true).length;

// Wind-regime copy tokens (meltemi / maistros / summer wind) come from the shared
// localWindContext.mjs so the labels never drift between build scripts and runtime.
const windWordsFor = regionId => localWindLabelFor(regionId);

// Explicit Greek declension per region (genitive for "Παραλίες {gen}" + the
// "σε"+accusative phrase "στη/στον/στο/στους/στις/στα {name}" for meta/H1/intro).
// Hand-authored (Greek toponyms have exceptions) — NOT rule-generated. Keyed by
// region id. `en` overrides an unnatural admin display name.
const REGION_DECLENSION = {
  'attica-aegina': { gen: 'Αίγινας', prep: 'στην Αίγινα' },
  'attica-agistri': { gen: 'Αγκιστρίου', prep: 'στο Αγκίστρι' },
  'attica-athens-area-mainland': { gen: 'Αττικής', prep: 'στην Αττική', en: 'Attica' },
  'attica-east-attica-mainland': { gen: 'Ανατολικής Αττικής', prep: 'στην Ανατολική Αττική' },
  'attica-hydra': { gen: 'Ύδρας', prep: 'στην Ύδρα' },
  'attica-kythira': { gen: 'Κυθήρων', prep: 'στα Κύθηρα' },
  'attica-methana': { gen: 'Μεθάνων', prep: 'στα Μέθανα' },
  'attica-piraeus-area': { gen: 'Πειραιά', prep: 'στον Πειραιά', en: 'Piraeus' },
  'attica-poros': { gen: 'Πόρου', prep: 'στον Πόρο' },
  'attica-salamina': { gen: 'Σαλαμίνας', prep: 'στη Σαλαμίνα' },
  'attica-spetses': { gen: 'Σπετσών', prep: 'στις Σπέτσες' },
  'attica-west-attica-mainland': { gen: 'Δυτικής Αττικής', prep: 'στη Δυτική Αττική' },
  'central-greece-evia': { gen: 'Εύβοιας', prep: 'στην Εύβοια' },
  'central-greece-fokida-mainland': { gen: 'Φωκίδας', prep: 'στη Φωκίδα' },
  'central-greece-fthiotida-mainland': { gen: 'Φθιώτιδας', prep: 'στη Φθιώτιδα' },
  'central-greece-skyros': { gen: 'Σκύρου', prep: 'στη Σκύρο' },
  'central-greece-viotia-mainland': { gen: 'Βοιωτίας', prep: 'στη Βοιωτία' },
  'central-macedonia-halkidiki-mainland': { gen: 'Χαλκιδικής', prep: 'στη Χαλκιδική' },
  'central-macedonia-pieria-mainland': { gen: 'Πιερίας', prep: 'στην Πιερία' },
  'central-macedonia-thessaloniki-area': { gen: 'Θεσσαλονίκης', prep: 'στη Θεσσαλονίκη', en: 'Thessaloniki' },
  'crete-crete-chania': { gen: 'Χανίων', prep: 'στα Χανιά' },
  'crete-crete-heraklion': { gen: 'Ηρακλείου', prep: 'στο Ηράκλειο' },
  'crete-crete-lasithi': { gen: 'Λασιθίου', prep: 'στο Λασίθι' },
  'crete-crete-rethymno': { gen: 'Ρεθύμνου', prep: 'στο Ρέθυμνο' },
  'crete-gavdos': { gen: 'Γαύδου', prep: 'στη Γαύδο' },
  'east-macedonia-and-thrace-evros-mainland': { gen: 'Έβρου', prep: 'στον Έβρο' },
  'east-macedonia-and-thrace-kavala-mainland': { gen: 'Καβάλας', prep: 'στην Καβάλα' },
  'east-macedonia-and-thrace-rodopi-mainland': { gen: 'Ροδόπης', prep: 'στη Ροδόπη' },
  'east-macedonia-and-thrace-samothraki': { gen: 'Σαμοθράκης', prep: 'στη Σαμοθράκη' },
  'east-macedonia-and-thrace-thasos': { gen: 'Θάσου', prep: 'στη Θάσο' },
  'east-macedonia-and-thrace-xanthi-mainland': { gen: 'Ξάνθης', prep: 'στην Ξάνθη' },
  'epirus-arta-mainland': { gen: 'Άρτας', prep: 'στην Άρτα' },
  'epirus-preveza-mainland': { gen: 'Πρέβεζας', prep: 'στην Πρέβεζα' },
  'epirus-thesprotia-mainland': { gen: 'Θεσπρωτίας', prep: 'στη Θεσπρωτία' },
  'ionian-islands-antipaxos': { gen: 'Αντίπαξων', prep: 'στους Αντίπαξους' },
  'ionian-islands-corfu': { gen: 'Κέρκυρας', prep: 'στην Κέρκυρα' },
  'ionian-islands-erikoussa': { gen: 'Ερείκουσας', prep: 'στην Ερείκουσα' },
  'ionian-islands-ithaca': { gen: 'Ιθάκης', prep: 'στην Ιθάκη' },
  'ionian-islands-kefalonia': { gen: 'Κεφαλονιάς', prep: 'στην Κεφαλονιά' },
  'ionian-islands-lefkada': { gen: 'Λευκάδας', prep: 'στη Λευκάδα' },
  'ionian-islands-mathraki': { gen: 'Μαθρακίου', prep: 'στο Μαθράκι' },
  'ionian-islands-meganisi': { gen: 'Μεγανησίου', prep: 'στο Μεγανήσι' },
  'ionian-islands-othonoi': { gen: 'Οθωνών', prep: 'στους Οθωνούς' },
  'ionian-islands-paxos': { gen: 'Παξών', prep: 'στους Παξούς' },
  'ionian-islands-zakynthos': { gen: 'Ζακύνθου', prep: 'στη Ζάκυνθο' },
  'north-aegean-agios-efstratios': { gen: 'Αγίου Ευστρατίου', prep: 'στον Άγιο Ευστράτιο' },
  'north-aegean-chios': { gen: 'Χίου', prep: 'στη Χίο' },
  'north-aegean-fournoi': { gen: 'Φούρνων', prep: 'στους Φούρνους' },
  'north-aegean-ikaria': { gen: 'Ικαρίας', prep: 'στην Ικαρία' },
  'north-aegean-lemnos': { gen: 'Λήμνου', prep: 'στη Λήμνο' },
  'north-aegean-lesvos': { gen: 'Λέσβου', prep: 'στη Λέσβο' },
  'north-aegean-oinousses': { gen: 'Οινουσσών', prep: 'στις Οινούσσες' },
  'north-aegean-psara': { gen: 'Ψαρών', prep: 'στα Ψαρά' },
  'north-aegean-samos': { gen: 'Σάμου', prep: 'στη Σάμο' },
  'peloponnese-argolida-mainland': { gen: 'Αργολίδας', prep: 'στην Αργολίδα' },
  'peloponnese-arkadia-mainland': { gen: 'Αρκαδίας', prep: 'στην Αρκαδία' },
  'peloponnese-korinthia-mainland': { gen: 'Κορινθίας', prep: 'στην Κορινθία' },
  'peloponnese-lakonia-mainland': { gen: 'Λακωνίας', prep: 'στη Λακωνία' },
  'peloponnese-messinia-mainland': { gen: 'Μεσσηνίας', prep: 'στη Μεσσηνία' },
  'south-aegean-agathonisi': { gen: 'Αγαθονησίου', prep: 'στο Αγαθονήσι' },
  'south-aegean-amorgos': { gen: 'Αμοργού', prep: 'στην Αμοργό' },
  'south-aegean-anafi': { gen: 'Ανάφης', prep: 'στην Ανάφη' },
  'south-aegean-andros': { gen: 'Άνδρου', prep: 'στην Άνδρο' },
  'south-aegean-antiparos': { gen: 'Αντιπάρου', prep: 'στην Αντίπαρο' },
  'south-aegean-arki': { gen: 'Αρκών', prep: 'στους Αρκούς' },
  'south-aegean-astypalaia': { gen: 'Αστυπάλαιας', prep: 'στην Αστυπάλαια' },
  'south-aegean-donousa': { gen: 'Δονούσας', prep: 'στη Δονούσα' },
  'south-aegean-folegandros': { gen: 'Φολεγάνδρου', prep: 'στη Φολέγανδρο' },
  'south-aegean-halki': { gen: 'Χάλκης', prep: 'στη Χάλκη' },
  'south-aegean-ios': { gen: 'Ίου', prep: 'στην Ίο' },
  'south-aegean-iraklia': { gen: 'Ηρακλειάς', prep: 'στην Ηρακλειά' },
  'south-aegean-kalymnos': { gen: 'Καλύμνου', prep: 'στην Κάλυμνο' },
  'south-aegean-karpathos': { gen: 'Καρπάθου', prep: 'στην Κάρπαθο' },
  'south-aegean-kasos': { gen: 'Κάσου', prep: 'στην Κάσο' },
  'south-aegean-kastellorizo': { gen: 'Καστελλορίζου', prep: 'στο Καστελλόριζο' },
  'south-aegean-kea': { gen: 'Κέας', prep: 'στην Κέα' },
  'south-aegean-kimolos': { gen: 'Κιμώλου', prep: 'στην Κίμωλο' },
  'south-aegean-kos': { gen: 'Κω', prep: 'στην Κω' },
  'south-aegean-koufonisia': { gen: 'Κουφονησίων', prep: 'στα Κουφονήσια' },
  'south-aegean-kythnos': { gen: 'Κύθνου', prep: 'στην Κύθνο' },
  'south-aegean-leros': { gen: 'Λέρου', prep: 'στη Λέρο' },
  'south-aegean-lipsi': { gen: 'Λειψών', prep: 'στους Λειψούς' },
  'south-aegean-marathi': { gen: 'Μαραθίου', prep: 'στο Μαράθι' },
  'south-aegean-milos': { gen: 'Μήλου', prep: 'στη Μήλο' },
  'south-aegean-mykonos': { gen: 'Μυκόνου', prep: 'στη Μύκονο' },
  'south-aegean-naxos': { gen: 'Νάξου', prep: 'στη Νάξο' },
  'south-aegean-nisyros': { gen: 'Νισύρου', prep: 'στη Νίσυρο' },
  'south-aegean-paros': { gen: 'Πάρου', prep: 'στην Πάρο' },
  'south-aegean-patmos': { gen: 'Πάτμου', prep: 'στην Πάτμο' },
  'south-aegean-polyaigos': { gen: 'Πολυαίγου', prep: 'στην Πολύαιγο' },
  'south-aegean-pserimos': { gen: 'Ψερίμου', prep: 'στην Ψέριμο' },
  'south-aegean-rhodes': { gen: 'Ρόδου', prep: 'στη Ρόδο' },
  'south-aegean-santorini': { gen: 'Σαντορίνης', prep: 'στη Σαντορίνη' },
  'south-aegean-schinoussa': { gen: 'Σχοινούσας', prep: 'στη Σχοινούσα' },
  'south-aegean-serifos': { gen: 'Σερίφου', prep: 'στη Σέριφο' },
  'south-aegean-sifnos': { gen: 'Σίφνου', prep: 'στη Σίφνο' },
  'south-aegean-sikinos': { gen: 'Σικίνου', prep: 'στη Σίκινο' },
  'south-aegean-symi': { gen: 'Σύμης', prep: 'στη Σύμη' },
  'south-aegean-syros': { gen: 'Σύρου', prep: 'στη Σύρο' },
  'south-aegean-telendos': { gen: 'Τελένδου', prep: 'στην Τέλενδο' },
  'south-aegean-tilos': { gen: 'Τήλου', prep: 'στην Τήλο' },
  'south-aegean-tinos': { gen: 'Τήνου', prep: 'στην Τήνο' },
  'thessaly-alonissos': { gen: 'Αλοννήσου', prep: 'στην Αλόννησο' },
  'thessaly-larissa-coast-agia---kissavos': { gen: 'Λάρισας', prep: 'στη Λάρισα', en: 'Larissa' },
  'thessaly-magnesia-mainland---pelion': { gen: 'Πηλίου', prep: 'στο Πήλιο', en: 'Pelion' },
  'thessaly-skiathos': { gen: 'Σκιάθου', prep: 'στη Σκιάθο' },
  'thessaly-skopelos': { gen: 'Σκοπέλου', prep: 'στη Σκόπελο' },
  'west-greece-achaia-mainland': { gen: 'Αχαΐας', prep: 'στην Αχαΐα' },
  'west-greece-aetolia-acarnania-mainland': { gen: 'Αιτωλοακαρνανίας', prep: 'στην Αιτωλοακαρνανία' },
  'west-greece-ileia-mainland': { gen: 'Ηλείας', prep: 'στην Ηλεία' },
};
// Greek genitive for the title, falling back to the raw name if unmapped.
const regionGenGr = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.gen || fallbackName;
// Greek "σε"+accusative phrase for meta/H1/intro, falling back to "σε {name}".
const regionPrepGr = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.prep || `σε ${fallbackName}`;
// English display name (override for unnatural admin names), else the dataset name.
const regionDisplayEn = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.en || fallbackName;

// --- Computed geometry intro for the 'sheltered' guide (defeats doorway-page risk) ---
// Instead of a template intro with a swapped toponym, we read the region's ray-cast
// exposure profiles and STATE what the geometry actually shows: how many beaches take
// no open water toward the local wind, which coast they cluster on, and the arc they
// face. Every number is computed; the paragraph cannot survive a find-and-replace of
// the island name. Falls back to the template intro when the data is missing or the
// sheltered set does not cluster cleanly (honesty guard).
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassBin = deg => COMPASS_8[Math.round(((deg % 360) / 45)) % 8];
const levelRank = level => (level === 'exposed' ? 2 : level === 'partial' ? 1 : 0);
// Coast the shore faces + the wind that then hits it, keyed by 8-point bin.
const COAST_WORD = {
  N:  { gr: 'βόρεια', en: 'north' },        NE: { gr: 'βορειοανατολική', en: 'northeast' },
  E:  { gr: 'ανατολική', en: 'east' },      SE: { gr: 'νοτιοανατολική', en: 'southeast' },
  S:  { gr: 'νότια', en: 'south' },         SW: { gr: 'νοτιοδυτική', en: 'southwest' },
  W:  { gr: 'δυτική', en: 'west' },         NW: { gr: 'βορειοδυτική', en: 'northwest' },
};
const DIR_ABBR_GR = { N: 'Β', NE: 'ΒΑ', E: 'Α', SE: 'ΝΑ', S: 'Ν', SW: 'ΝΔ', W: 'Δ', NW: 'ΒΔ' };
const DIR_ABBR_EN = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };
// "the wind blows from …" — used for the opposite wind that reverses the shelter.
const DIR_FROM = {
  N:  { gr: 'τον βορρά', en: 'the north' },        NE: { gr: 'τα βορειοανατολικά', en: 'the northeast' },
  E:  { gr: 'την ανατολή', en: 'the east' },       SE: { gr: 'τα νοτιοανατολικά', en: 'the southeast' },
  S:  { gr: 'τον νότο', en: 'the south' },          SW: { gr: 'τα νοτιοδυτικά', en: 'the southwest' },
  W:  { gr: 'τη δύση', en: 'the west' },            NW: { gr: 'τα βορειοδυτικά', en: 'the northwest' },
};

// Read + cache a region's ray-cast exposure profiles (may not exist for every region).
const exposureCache = new Map();
const loadExposureProfiles = async regionId => {
  if (exposureCache.has(regionId)) return exposureCache.get(regionId);
  let data = null;
  try {
    data = await readJson(toPublicFilePath(`/data/geospatial/exposure/${regionId}.json`));
  } catch {
    data = null;
  }
  exposureCache.set(regionId, data);
  return data;
};

// Turn the exposure profiles into the handful of numbers the intro asserts.
// Returns { usable:false } when the data can't support a specific, honest claim.
const computeShelterGeometry = (regionId, exposure) => {
  const profiles = exposure?.profiles && typeof exposure.profiles === 'object'
    ? Object.values(exposure.profiles)
    : null;
  if (!Array.isArray(profiles) || profiles.length < 8) return { usable: false };
  const windSectors = localWindSectorsFor(regionId);
  const total = profiles.length;
  const protectedFromWind = [];
  let exposedToWind = 0;
  for (const p of profiles) {
    const s = p.sectors;
    if (!s || !Number.isFinite(p.facingDeg)) continue;
    const worst = Math.max(...windSectors.map(d => levelRank(s[d]?.level)));
    if (windSectors.every(d => s[d]?.level === 'protected')) protectedFromWind.push(p);
    if (worst === 2) exposedToWind += 1;
  }
  if (protectedFromWind.length < 4) return { usable: false };
  // Circular mean of the sheltered set's facing direction → the lee coast.
  let sx = 0, sy = 0;
  for (const p of protectedFromWind) { const r = (p.facingDeg * Math.PI) / 180; sx += Math.cos(r); sy += Math.sin(r); }
  const meanDeg = ((Math.atan2(sy / protectedFromWind.length, sx / protectedFromWind.length) * 180) / Math.PI + 360) % 360;
  const offset = deg => ((deg - meanDeg + 540) % 360) - 180; // signed distance from mean
  const inCluster = protectedFromWind.filter(p => Math.abs(offset(p.facingDeg)) <= 67.5).length;
  const clusterFrac = inCluster / protectedFromWind.length;
  if (clusterFrac < 0.6) return { usable: false }; // scattered → template is more honest
  const offsets = protectedFromWind.map(p => offset(p.facingDeg)).sort((a, b) => a - b);
  const arcStartBin = compassBin((meanDeg + offsets[0] + 360) % 360);
  const arcEndBin = compassBin((meanDeg + offsets[offsets.length - 1] + 360) % 360);
  const meanBin = compassBin(meanDeg);
  return {
    usable: true,
    total,
    protectedCount: protectedFromWind.length,
    exposedCount: exposedToWind,
    leeCoastBin: meanBin,
    arcStartBin,
    arcEndBin,
    windSectors,
  };
};

// Compose the 3-paragraph computed intro (gr/en only; de/fr/it keep the template).
const buildShelteredGeometryIntro = (regionId, geo, language) => {
  if (!geo?.usable || (language !== 'gr' && language !== 'en')) return null;
  const w = windWordsFor(regionId);
  const atoms = LOCAL_WIND_ATOMS[getRegionWindContext(regionId)];
  const windFromAbbr = language === 'gr' ? atoms.dir.gr : atoms.dir.en;
  const coast = COAST_WORD[geo.leeCoastBin][language];
  const arcAbbr = language === 'gr' ? DIR_ABBR_GR : DIR_ABBR_EN;
  const arc = geo.arcStartBin === geo.arcEndBin ? arcAbbr[geo.arcStartBin] : `${arcAbbr[geo.arcStartBin]}–${arcAbbr[geo.arcEndBin]}`;
  const oppFrom = DIR_FROM[geo.leeCoastBin][language]; // the wind that reverses the shelter
  if (language === 'gr') {
    const windNom = w.elNom;         // "το μελτέμι" / "ο μαΐστρος" (nominative)
    const eis = /^[αεηιουω]/i.test(coast) ? 'στην' : 'στη'; // "στην ανατολική" vs "στη νότια"
    return [
      `${windNom.charAt(0).toUpperCase()}${windNom.slice(1)} πνέει από ${windFromAbbr}, και στα δεδομένα μας ο διαχωρισμός φαίνεται καθαρά. Από τις ${geo.total} παραλίες που έχουμε μοντελοποιήσει, οι ${geo.protectedCount} δεν βλέπουν καθόλου ανοιχτό νερό προς ${windFromAbbr}· μαζεύονται ${eis} ${coast} ακτή, με προσανατολισμό σε ένα τόξο ${arc}. Οι πιο σταθερές απ' αυτές είναι στη λίστα πιο κάτω. Αντίθετα, ${geo.exposedCount} παραλίες είναι ορθάνοιχτες σε αυτόν τον άνεμο.`,
      `Ο λόγος είναι η ίδια η μορφολογία: αυτές οι παραλίες έχουν στεριά πίσω τους, από τη μεριά που έρχεται ${windNom}. Δεν είναι απαραίτητα κλειστοί κόλποι — απλώς κάθονται στον άνεμο-σκιά της απέναντι ακτής.`,
      `Το τίμημα το λέμε ανοιχτά: η ίδια ${coast} ακτή είναι ανοιχτή στον αντίθετο άνεμο. Τις μέρες που ο άνεμος γυρίζει από ${oppFrom}, η προστασία αντιστρέφεται και καλύτερη γίνεται η άλλη πλευρά. Γι' αυτό η λίστα περιορίζει την επιλογή — δεν αντικαθιστά την πρόγνωση· δες ζωντανό άνεμο και κύμα στη σελίδα της παραλίας πριν πας.`,
    ].join('\n\n');
  }
  return [
    `${w.en.charAt(0).toUpperCase()}${w.en.slice(1)} blows from ${windFromAbbr}, and the split shows up clearly in the data. Of the ${geo.total} beaches we have modelled, ${geo.protectedCount} take no open water toward ${windFromAbbr}; they cluster on the ${coast} coast, facing an arc of ${arc}. The most reliable of them are listed below. The other ${geo.exposedCount} sit wide open to it.`,
    `The reason is the shape of the coast itself: these beaches have land behind them on the side the wind comes from. They are not necessarily enclosed bays — they simply sit in the wind shadow of the shore opposite.`,
    `The trade-off, plainly: the same ${coast} coast is open to the opposite wind. On days the wind swings from ${oppFrom}, the shelter reverses and the far side is the better call. So this list narrows the choice — it does not replace the forecast; check live wind and waves on the beach page before you go.`,
  ].join('\n\n');
};

// Region-page copy: dataset-driven shelter hook. `sheltered` is the meltemi/βοριάς/
// Vardaris-protected count; `total` the region's beach count. Numberless fallback
// when the count is not compelling (0, 1, or all) so we never write "0 sheltered".
const pickUnderLimit = (tiers, max) => tiers.find(t => t.length <= max) || tiers[tiers.length - 1];

// Static de/fr/it intent titles are authored with a "| CalmBeach" suffix but, unlike
// en/gr (which run through pickUnderLimit tiers), get no overflow handling — long
// localized phrases push them past the ~60-char SERP limit and truncate. Drop the
// brand suffix when the title exceeds the per-language limit (the site name still shows
// separately on mobile SERPs via the WebSite JSON-LD, §1.3). Idempotent: en/gr and any
// title already within limit pass through unchanged.
const INTENT_TITLE_BRAND = ' | CalmBeach';
const fitIntentTitle = (title, language) => {
  const max = language === 'gr' ? 58 : 60;
  if (typeof title !== 'string' || title.length <= max) return title;
  return title.endsWith(INTENT_TITLE_BRAND) ? title.slice(0, -INTENT_TITLE_BRAND.length) : title;
};
// Region-hub title: count first, then the wind moat as the tail.
// The query behind these pages is the bare "{νησί} παραλίες" / "{island}
// beaches" — a request for the LIST. The previous title led with the task
// ("σύγκρινε προστασία από τον άνεμο" / "Compare Wind & Wave Shelter"), which
// answers a question nobody asked at that moment: 206 impressions at pos ~10-12
// earned exactly 0 clicks (GSC 28d to 2026-07-24), against a ~1.2% baseline for
// those positions. Leading with "{total} παραλίες {gen}" answers the query
// first; the shelter count keeps the differentiator without owning the title.
// ---------------------------------------------------------------------------
// Region-page copy — rewritten 05/08/2026. See docs/team/10-seo-specialist.md.
//
// What was wrong: the H1 asked the SHELTER question ("Which Preveza beaches are
// more sheltered from the wind?"), which is the job of /sheltered-beaches/{region}/.
// So on the region's own head term — "preveza beaches", "lemnos beaches",
// "kavala beach" — Google skipped the region page entirely and ranked three of
// our sub-guides at positions 12-15 against each other. Zero clicks on 208
// impressions across those three queries, and 34 clicks for the whole page type
// site-wide (GSC 06/07-02/08).
//
// So: the H1 is now the bare head term, the shelter angle is demoted to a
// section that LINKS the sheltered guide, and the guides read as children of
// this page instead of rivals to it.
//
// The comparative stays everywhere it appears ("πιο υπήνεμες" / "more
// sheltered" / "eher windgeschützt" / "plutôt abritées" / "più riparate"): the
// exposure model ranks coasts against a wind direction, it never promises
// shelter, and `checkRiskyConditionClaims` in scripts/auditSeoPrerender.mjs
// treats the bare claim as a defect. It is right to.
const buildRegionHeadCopy = (regionId, nameEl, nameEn, total, sheltered, language) => {
  const w = windWordsFor(regionId);
  const numberless = sheltered < 2 || sheltered >= total;

  if (language === 'gr') {
    const gen = regionGenGr(regionId, nameEl);
    const prep = regionPrepGr(regionId, nameEl);
    return {
      // Head term first, always. The tiers only ever drop the tail.
      title: pickUnderLimit([
        `Παραλίες ${gen}: όλες οι ${total}, άνεμος & κύμα | CalmBeach`,
        `Παραλίες ${gen}: όλες οι ${total}, άνεμος & κύμα`,
        `Παραλίες ${gen}: όλες οι ${total}`,
        `Παραλίες ${gen}`,
      ], 58),
      description: numberless
        ? `Και οι ${total} παραλίες ${prep}, με ζωντανό άνεμο και κύμα για την καθεμιά και προστασία ${w.elFrom}.`
        : `Και οι ${total} παραλίες ${prep}, με ζωντανό άνεμο και κύμα. Οι ${sheltered} μένουν πιο υπήνεμες ${w.elIn}.`,
      h1: `Παραλίες ${gen}`,
      intro: numberless
        ? `Όλες οι ${total} παραλίες ${prep}, σε μία λίστα. Διαφέρουν πολύ στην προστασία ${w.elFrom} — άνοιξε όποια θέλεις για ζωντανό άνεμο και κύμα πριν ξεκινήσεις.`
        : `Όλες οι ${total} παραλίες ${prep}, σε μία λίστα. Οι ${sheltered} από αυτές δεν είναι εκτεθειμένες ${w.elIn} — αυτές έχουν τις καλύτερες πιθανότητες για μπάνιο μια μέρα με αέρα. Άνοιξε όποια θέλεις για ζωντανό άνεμο και κύμα.`,
      sections: [
        {
          heading: `Ποιες παραλίες ${prep} μένουν πιο υπήνεμες ${w.elIn};`,
          body: numberless
            ? `Κοίτα προς τα πού βλέπει η κάθε ακτή. Όταν φυσάει ${w.elNom}, οι παραλίες που κοιτούν προς την αντίθετη μεριά έχουν μπροστά τους λιγότερη θάλασσα για να χτιστεί κύμα, οπότε συνήθως είναι πιο βατές. Δεν είναι εγγύηση: η ίδια παραλία αλλάζει χαρακτήρα όταν γυρίσει ο άνεμος, γι' αυτό δες τον ζωντανό άνεμο και το κύμα πριν πας.`
            : `Από τις ${total}, οι ${sheltered} έχουν προσανατολισμό μακριά ${w.elFrom}, δηλαδή μπροστά τους υπάρχει λιγότερη θάλασσα για να χτιστεί κύμα όταν φυσάει. Δεν είναι εγγύηση — η ίδια παραλία αλλάζει χαρακτήρα όταν γυρίσει ο άνεμος. Δες τη ζωντανή εικόνα πριν ξεκινήσεις.`,
        },
        {
          heading: `Με τι σειρά είναι η λίστα;`,
          body: `Με το πόσο γνωστή είναι η κάθε παραλία, όχι με βαθμολογία δική μας. Η κατάταξη «ποια είναι καλή τώρα» αλλάζει ώρα με την ώρα και δεν μπορεί να τυπωθεί σε στατική σελίδα — γι' αυτό εδώ θα βρεις τη λίστα και τα σταθερά χαρακτηριστικά, ενώ τις συνθήκες τις δίνει ο ζωντανός χάρτης.`,
        },
      ],
    };
  }

  if (language === 'de') {
    return {
      title: pickUnderLimit([
        `Strände auf ${nameEn}: alle ${total}, Wind & Wellen | CalmBeach`,
        `Strände auf ${nameEn}: alle ${total}, Wind & Wellen`,
        `Strände auf ${nameEn}: alle ${total}`,
        `Strände auf ${nameEn}`,
      ], 60),
      description: numberless
        ? `Alle ${total} Strände auf ${nameEn}, mit Live-Wind und Wellen für jeden einzelnen und dem Schutz vor ${w.de}.`
        : `Alle ${total} Strände auf ${nameEn} mit Live-Wind und Wellen. ${sheltered} davon liegen eher windgeschützt vor ${w.de}.`,
      h1: `Strände auf ${nameEn}`,
      intro: numberless
        ? `Alle ${total} Strände auf ${nameEn} in einer Liste. Sie unterscheiden sich stark im Schutz vor ${w.de} — öffne einen beliebigen für Live-Wind und Wellen, bevor du losfährst.`
        : `Alle ${total} Strände auf ${nameEn} in einer Liste. ${sheltered} davon liegen nicht offen zu ${w.de} und haben an einem windigen Tag die besseren Chancen. Öffne einen beliebigen für Live-Wind und Wellen.`,
      sections: [
        {
          heading: `Welche Strände auf ${nameEn} sind eher windgeschützt?`,
          body: `Es kommt darauf an, wohin die Küste schaut. Weht der Wind, haben Buchten auf der abgewandten Seite weniger offene See vor sich, an der sich Welle aufbauen kann — sie sind meist ruhiger. Das ist keine Garantie: dreht der Wind, ändert sich der Strand. Prüfe Wind und Wellen live, bevor du losfährst.`,
        },
        {
          heading: 'Wie ist die Liste sortiert?',
          body: 'Nach Bekanntheit, nicht nach einer Wertung von uns. Welcher Strand gerade gut ist, ändert sich stündlich und lässt sich auf einer statischen Seite nicht drucken — hier stehen die Liste und die festen Eigenschaften, die Bedingungen liefert die Live-Karte.',
        },
      ],
    };
  }

  if (language === 'fr') {
    return {
      title: pickUnderLimit([
        `Plages à ${nameEn} : les ${total}, vent & vagues | CalmBeach`,
        `Plages à ${nameEn} : les ${total}, vent & vagues`,
        `Plages à ${nameEn} : les ${total}`,
        `Plages à ${nameEn}`,
      ], 60),
      description: numberless
        ? `Les ${total} plages de ${nameEn}, avec le vent et les vagues en direct pour chacune et leur abri ${w.fr}.`
        : `Les ${total} plages de ${nameEn}, vent et vagues en direct. ${sheltered} d'entre elles sont plutôt abritées ${w.fr}.`,
      h1: `Plages à ${nameEn}`,
      intro: numberless
        ? `Les ${total} plages de ${nameEn}, en une seule liste. Leur abri ${w.fr} varie beaucoup — ouvrez celle que vous voulez pour le vent et les vagues en direct avant de partir.`
        : `Les ${total} plages de ${nameEn}, en une seule liste. ${sheltered} d'entre elles ne sont pas exposées ${w.fr} : ce sont celles qui ont le plus de chances un jour de vent. Ouvrez celle que vous voulez pour le vent et les vagues en direct.`,
      sections: [
        {
          heading: `Quelles plages de ${nameEn} sont plutôt abritées ?`,
          body: `Tout dépend de l'orientation de la côte. Quand le vent souffle, les criques tournées à l'opposé ont moins de mer ouverte devant elles pour lever de la vague : elles sont en général plus confortables. Ce n'est pas une garantie — la même plage change de caractère quand le vent tourne. Vérifiez le vent et les vagues en direct avant d'y aller.`,
        },
        {
          heading: 'Comment la liste est-elle classée ?',
          body: "Par notoriété, pas par une note de notre part. Savoir quelle plage est bonne à un moment donné change d'heure en heure et ne peut pas s'imprimer sur une page statique — ici vous avez la liste et les caractéristiques stables, les conditions viennent de la carte en direct.",
        },
      ],
    };
  }

  if (language === 'it') {
    return {
      title: pickUnderLimit([
        `Spiagge a ${nameEn}: tutte le ${total}, vento e onde | CalmBeach`,
        `Spiagge a ${nameEn}: tutte le ${total}, vento e onde`,
        `Spiagge a ${nameEn}: tutte le ${total}`,
        `Spiagge a ${nameEn}`,
      ], 60),
      description: numberless
        ? `Tutte le ${total} spiagge di ${nameEn}, con vento e onde in diretta per ciascuna e il riparo ${w.it}.`
        : `Tutte le ${total} spiagge di ${nameEn}, vento e onde in diretta. ${sheltered} sono più riparate ${w.it}.`,
      h1: `Spiagge a ${nameEn}`,
      intro: numberless
        ? `Tutte le ${total} spiagge di ${nameEn} in un unico elenco. Il riparo ${w.it} cambia molto da una all'altra — apri quella che vuoi per vento e onde in diretta prima di partire.`
        : `Tutte le ${total} spiagge di ${nameEn} in un unico elenco. ${sheltered} non sono esposte ${w.it} e in una giornata ventosa hanno le probabilità migliori. Apri quella che vuoi per vento e onde in diretta.`,
      sections: [
        {
          heading: `Quali spiagge di ${nameEn} sono più riparate?`,
          body: `Dipende da dove guarda la costa. Quando soffia il vento, le insenature orientate dalla parte opposta hanno meno mare aperto davanti per costruire onda, quindi di solito sono più comode. Non è una garanzia: la stessa spiaggia cambia carattere quando il vento gira. Controlla vento e onde in tempo reale prima di andare.`,
        },
        {
          heading: "Con quale criterio è ordinato l'elenco?",
          body: 'Per quanto è conosciuta ciascuna spiaggia, non per un nostro voto. Quale spiaggia sia buona in un dato momento cambia di ora in ora e non si può stampare su una pagina statica — qui trovi l\'elenco e le caratteristiche stabili, le condizioni le dà la mappa in diretta.',
        },
      ],
    };
  }

  // en
  return {
    title: pickUnderLimit([
      `Beaches in ${nameEn}: All ${total}, Wind & Waves | CalmBeach`,
      `Beaches in ${nameEn}: All ${total}, Wind & Waves`,
      `Beaches in ${nameEn}: All ${total}`,
      `Beaches in ${nameEn}`,
    ], 60),
    // Every string here that contains "sheltered" also carries a qualifier
    // ("more", "check", "before you go", "compare") — `shelterQualifierPattern`
    // in scripts/auditSeoPrerender.mjs treats a bare shelter claim as a defect,
    // and the exposure model does rank coasts rather than promise shelter.
    description: numberless
      ? `All ${total} beaches in ${nameEn}, with live wind and waves for each. Compare how sheltered each one sits from ${w.en} before you go.`
      : `All ${total} beaches in ${nameEn}, with live wind and waves. ${sheltered} of them sit more sheltered from ${w.en}.`,
    h1: `Beaches in ${nameEn}`,
    intro: numberless
      ? `All ${total} beaches in ${nameEn}, in one list. They vary widely in how sheltered they sit from ${w.en} — open any of them and check live wind and waves before you go.`
      : `All ${total} beaches in ${nameEn}, in one list. ${sheltered} of them are not exposed to ${w.en}, which gives them the better odds on a windy day. Open any of them for live wind and waves.`,
    sections: [
      {
        heading: `Which beaches in ${nameEn} are more sheltered from the wind?`,
        body: numberless
          ? `It comes down to which way the coast faces. When ${w.en} blows, coves facing the other way have less open water in front of them for a wave to build across, so they are usually more comfortable. It is not a guarantee — the same beach changes character when the wind turns. Check live wind and waves before you go.`
          : `${sheltered} of the ${total} face away from ${w.en}, meaning less open water in front of them for a wave to build across when it blows. It is not a guarantee — the same beach changes character when the wind turns. Check the live reading before you drive out.`,
      },
      {
        heading: 'How is this list ordered?',
        body: 'By how well known each beach is, not by a score of ours. Which beach is good on a given day changes hour by hour and cannot be printed on a static page — so this page carries the list and the things that do not change, and the live map carries the conditions.',
      },
    ],
  };
};

// The region page's crawlable body. Deliberately built from plain inline styles
// and NOT from STATIC_PAGE_BASE_CSS / renderBeachCard, unlike the guide
// articles: this page still mounts the React app, and that stylesheet carries
// global `body`, `a` and `*{box-sizing}` rules that would restyle the live map.
// The SEO value here is text, structure and links — photo cards would have cost
// a second design system inside the interactive page, plus ~400 KB on Halkidiki
// (133 beaches), to buy nothing Google reads.
const REGION_BEACH_LINK_CAP = 200; // headroom over the largest region (Halkidiki, 133)
const staticRegionFallback = (island, region, canonicalUrl, locale = prerenderLocales[0], content = null) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const chrome = getArticleChrome(language);
  const islandName = displayName(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  // Every beach, not the first 80. The old cap orphaned the tail of the four
  // regions that exceed it — Halkidiki 133, Evia 130, Corfu 105, Chania 89 — so
  // 96 beach pages had no internal link from anywhere on the site and reached
  // Google by sitemap alone (measured 05/08/2026, scripts/auditOrphanPages.mjs).
  // A text link costs ~120 bytes; the region page is the only natural parent
  // those pages have. The JSON-LD ItemList below stays capped at 80 — schema.org
  // lists are a sample, and that one is parsed on every crawl.
  const beachItems = beaches
    .slice(0, REGION_BEACH_LINK_CAP)
    .map(beach => {
      const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
      // The curated story hook where one exists (unique prose, ~83 beaches), the
      // structured type/access line otherwise. Same helper the guide lists use.
      const blurb = intentBeachBlurbText(region, beach, language);
      return `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
              <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
              ${renderBeachSummaryMeta(beach, language)}
            </a>
            ${blurb ? `<p style="margin:5px 2px 0;font-size:13.5px;line-height:1.5;color:#475569;">${escapeHtml(blurb)}</p>` : ''}
          </li>
        `;
    })
    .join('');

  // Each visible Q&A heading is an <h2> and each body a <p>, so the FAQPage
  // JSON-LD built from the same `content.sections` in buildRegionPage describes
  // markup that is actually on the page — the rule Google states for FAQ rich
  // results, and the same shape staticIslandIntentFallback uses.
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  const sectionHtml = sections.map(section => `
          <section style="margin:0 0 18px;">
            <h2 style="margin:0 0 7px;font-size:18px;line-height:1.25;color:#0f172a;">${escapeHtml(section.heading)}</h2>
            <p style="margin:0;font-size:15.5px;line-height:1.62;color:#334155;">${escapeHtml(section.body)}</p>
          </section>`).join('');

  return `
    <div id="root">
      <main data-static-fallback style="max-width:840px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">${escapeHtml(copy.brand)}</p>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(content ? content.h1 : copy.regionHeading(islandName))}</h1>
        <p style="margin:0 0 22px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(content ? content.intro : copy.regionDescription(islandName, beaches.length))}</p>
        ${beachItems ? `<h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(chrome.listHeading)}</h2>
        <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0 0 26px;padding:0;list-style:none;">${beachItems}</ul>` : ''}
        ${renderRegionGuideSection(island, region, locale)}
        ${sectionHtml ? `<h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(chrome.faqHeading)}</h2>${sectionHtml}` : ''}
        <p data-nosnippet="true" style="margin:18px 0 0;color:#475569;">${escapeHtml(copy.openAppRegion)}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewRegion(islandName))}</a></p>
      </main>
    </div>
  `;
};

// The fully-static pages carry their own small design system instead of the
// 223 KB app stylesheet (see the stylesheet swap in stripClientScripts below).
const STATIC_PAGE_BASE_CSS = STATIC_ARTICLE_CSS;

const stripClientScripts = html => html
  .replace(/\s*<link rel="modulepreload"[^>]*>\s*/gi, '')
  .replace(/\s*<script\b(?=[^>]*\btype="module"|\btype='module')[^>]*>[\s\S]*?<\/script>\s*/gi, '')
  // These pages never boot React, so nothing ever clears the fallback timer:
  // without this the whole article stays display:none for 5s and then pops in.
  .replace(/\s*<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?__calmBeachFallbackTimer[\s\S]*?<\/script>\s*/gi, '\n    ')
  .replace(/\s*<style\b[^>]*>(?:(?!<\/style>)[\s\S])*?show-static-fallback[\s\S]*?<\/style>\s*/gi, '\n    ')
  // The static article markup is inline-styled; the only Tailwind it uses is the
  // body class. Inline that instead of blocking paint on the whole app stylesheet.
  .replace(/\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]*\.css"[^>]*>\s*/gi, `\n    <style>${STATIC_PAGE_BASE_CSS}</style>\n    `);

const landingChromeCopy = {
  en: {
    openApp: 'Open app',
    related: 'Related CalmBeach pages',
    faqLabel: 'Frequently asked questions',
    disclaimer: 'Recommendations are indicative and depend on available weather and beach data. Conditions may vary locally.',
  },
  gr: {
    openApp: 'Άνοιγμα',
    related: 'Σχετικές σελίδες CalmBeach',
    faqLabel: 'Συχνές ερωτήσεις',
    disclaimer: 'Οι προτάσεις είναι ενδεικτικές και εξαρτώνται από τα διαθέσιμα δεδομένα καιρού και παραλιών. Οι συνθήκες μπορεί να διαφέρουν τοπικά.',
  },
};

const staticSeoLandingPage = (content, locale, dynamicHtml = '') => {
  // The first link is always the primary entry into the live app; promote it to
  // a prominent CTA so this page reads as a real CalmBeach gateway, not a stray
  // document. The rest stay as secondary related links. Link hrefs are stored as
  // base paths and localized so a Greek page funnels into Greek routes.
  // `dynamicHtml` is the data-driven section (a real beach list or a region hub)
  // that makes the page deliver on its title instead of being generic prose.
  const chrome = landingChromeCopy[locale.language] || landingChromeCopy.en;
  const homeHref = localizedPath('/', locale);
  const localizeHref = href => href?.startsWith('#') ? href : localizedPath(href, locale);
  const [primaryLink, ...secondaryLinks] = content.links;
  const faqItems = Array.isArray(content.faq) ? content.faq.filter(item => item?.q && item?.a) : [];

  return `
    <div id="root">
      <main style="max-width:880px;margin:0 auto;padding:0 20px 56px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;">
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0e7490;font-weight:800;font-size:18px;">
            <img src="/calmbeach-mark.svg" alt="" width="32" height="32" style="display:block;" />
            CalmBeach Greece
          </a>
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;padding:8px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(chrome.openApp)}</a>
        </header>
        <section style="padding:24px 0 8px;">
          <h1 style="margin:0 0 14px;font-size:38px;line-height:1.08;">${escapeHtml(content.h1)}</h1>
          <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#334155;">${escapeHtml(content.intro)}</p>
          ${primaryLink ? `<a href="${escapeHtml(localizeHref(primaryLink.href))}" style="display:inline-flex;align-items:center;justify-content:center;background:#0e7490;color:white;border-radius:12px;padding:14px 22px;text-decoration:none;font-weight:800;font-size:16px;box-shadow:0 10px 24px -12px rgba(14,116,144,.6);">${escapeHtml(primaryLink.label)} →</a>` : ''}
          ${content.trustNote ? `<p style="margin:14px 0 0;border:1px solid #bae6fd;border-radius:12px;background:#ecfeff;padding:11px 13px;color:#334155;font-size:14px;line-height:1.5;">${escapeHtml(content.trustNote)}</p>` : ''}
        </section>
        ${dynamicHtml}
        <div style="display:grid;gap:16px;margin:28px 0;">
          ${content.sections.map(section => `
            <section style="border-top:1px solid #bae6fd;padding-top:16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(section.heading)}</h2>
              <p style="margin:0;font-size:16px;line-height:1.58;color:#334155;">${escapeHtml(section.body)}</p>
            </section>
          `).join('')}
        </div>
        ${faqItems.length > 0 ? `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(content.faqHeading || chrome.faqLabel)}</h2>
          <dl style="display:grid;gap:12px;margin:0;">
            ${faqItems.map(item => `
              <div style="border:1px solid #bae6fd;border-radius:12px;background:white;padding:12px 14px;">
                <dt style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0f172a;">${escapeHtml(item.q)}</dt>
                <dd style="margin:0;color:#475569;font-size:15px;line-height:1.55;">${escapeHtml(item.a)}</dd>
              </div>
            `).join('')}
          </dl>
        </section>
        ` : ''}
        ${secondaryLinks.length > 0 ? `
        <nav aria-label="${escapeHtml(chrome.related)}">
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">
            ${secondaryLinks.map(link => `
              <li style="margin:0;">
                <a href="${escapeHtml(localizeHref(link.href))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:800;">${escapeHtml(link.label)}</a>
              </li>
            `).join('')}
          </ul>
        </nav>
        ` : ''}
        <p data-nosnippet="true" style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">${escapeHtml(chrome.disclaimer)}</p>
      </main>
    </div>
  `;
};

// Localized headings for the data-driven sections. Kept here (not in each locale
// block) so the page content stays focused on intent copy.
const listSectionHeadings = {
  accessible: { en: 'Accessible beaches with Seatrac access', gr: 'Προσβάσιμες παραλίες με Seatrac' },
  family: { en: 'Family-friendly beaches', gr: 'Οικογενειακές παραλίες' },
  camping: { en: 'Beaches with a campsite nearby', gr: 'Παραλίες με κάμπινγκ κοντά' },
  top: { en: 'Popular beaches to compare', gr: 'Δημοφιλείς παραλίες για σύγκριση' },
};
const hubSectionHeading = { en: 'Browse beaches by island & region', gr: 'Δες παραλίες ανά νησί & περιοχή' };
const emptyListNote = { en: 'We are still adding beaches to this guide.', gr: 'Προσθέτουμε ακόμη παραλίες σε αυτόν τον οδηγό.' };
const localeText = (table, locale) => table[locale.language] || table.en;
const emptyListNoteFor = (category, locale) => {
  if (category === 'accessible') {
    return locale.language === 'gr'
      ? 'Δεν υπάρχουν ακόμα επιβεβαιωμένα δεδομένα προσβασιμότητας για αυτήν την περιοχή. Μπορείς να δεις κοντινές παραλίες και τις πληροφορίες πρόσβασης σε κάθε σελίδα.'
      : 'We don\'t have verified accessibility data for this area yet. You can still explore nearby beaches and check access details on each beach page.';
  }
  return localeText(emptyListNote, locale);
};

const getBeachSeatrac = beach => beach?.seatrac ?? beach?.metadata?.seatrac;

const accessFeatureOrder = ['disabledParking', 'boardwalkToWater', 'accessibleWc', 'changingRoom', 'shower', 'shade'];
const positiveAccessStatuses = new Set(['yes', 'seasonal']);
const accessFeatureCopy = {
  seatrac: { en: 'Seatrac sea-access ramp', gr: 'Ράμπα Seatrac' },
  disabledParking: { en: 'Accessible parking', gr: 'Πάρκινγκ ΑμεΑ' },
  boardwalkToWater: { en: 'Boardwalk to water', gr: 'Διάδρομος προς τη θάλασσα' },
  accessibleWc: { en: 'Accessible WC', gr: 'Προσβάσιμο WC' },
  changingRoom: { en: 'Accessible changing room', gr: 'Προσβάσιμο αποδυτήριο' },
  shower: { en: 'Accessible shower', gr: 'Προσβάσιμο ντους' },
  shade: { en: 'Shaded seating listed', gr: 'Καταγεγραμμένη σκιά' },
  parking: { en: 'Parking listed', gr: 'Καταγεγραμμένο parking' },
  seasonal: { en: 'Seasonal equipment', gr: 'Εποχικός εξοπλισμός' },
  verify: { en: 'Verify before visiting', gr: 'Επιβεβαίωση πριν την επίσκεψη' },
  checked: { en: 'Checked', gr: 'Έλεγχος' },
  details: { en: 'Open details for wind and waves', gr: 'Άνοιγμα λεπτομερειών για άνεμο και κύμα' },
};

const accessCopy = (key, language) => accessFeatureCopy[key]?.[language] || accessFeatureCopy[key]?.en || key;

const accessibleFeatureLabels = (beach, language) => {
  const seatrac = getBeachSeatrac(beach);
  if (seatrac?.hasSeatrac !== true || seatrac.status !== 'online') return [];

  const labels = [accessCopy('seatrac', language)];
  for (const key of accessFeatureOrder) {
    if (positiveAccessStatuses.has(seatrac.amenities?.[key])) labels.push(accessCopy(key, language));
  }
  if (beach.amenities?.parking === true && !positiveAccessStatuses.has(seatrac.amenities?.disabledParking)) {
    labels.push(accessCopy('parking', language));
  }

  return Array.from(new Set(labels)).slice(0, 6);
};

const accessibleCaveatLabels = (beach, language) => {
  const seatrac = getBeachSeatrac(beach);
  if (!seatrac) return [];

  return [
    seatrac.seasonal ? accessCopy('seasonal', language) : '',
    seatrac.verifiedAt ? `${accessCopy('checked', language)} ${seatrac.verifiedAt}` : '',
    seatrac.needsVerification ? accessCopy('verify', language) : '',
  ].filter(Boolean);
};

const renderBeachListSection = (items, locale, category) => {
  const language = locale.language;
  const heading = localeText(listSectionHeadings[category] || {}, locale);
  const sectionId = category === 'accessible' ? ' id="accessible-beach-list"' : '';

  if (!items.length) {
    return `
        <section${sectionId} style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 8px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <p style="margin:0;color:#475569;">${escapeHtml(emptyListNoteFor(category, locale))}</p>
        </section>`;
  }

  const cards = items.map(({ beach, region, island }) => {
    const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
    const islandName = displayName(island.name, region.id, language);
    const metaParts = [islandName, readableBeachType(beach, language)].filter(Boolean);
    const accessFeatures = category === 'accessible' ? accessibleFeatureLabels(beach, language) : [];
    const accessCaveats = category === 'accessible' ? accessibleCaveatLabels(beach, language) : [];
    const accessFeaturesHtml = accessFeatures.length
      ? `<span style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">${accessFeatures.map(label => `<span style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;background:#ecfeff;padding:3px 8px;color:#075985;font-size:12px;font-weight:700;">${escapeHtml(label)}</span>`).join('')}</span>`
      : '';
    const accessCaveatHtml = accessCaveats.length
      ? `<span style="display:block;margin-top:7px;color:#64748b;font-size:12px;line-height:1.45;">${escapeHtml(accessCaveats.join(' - '))}</span>`
      : '';
    const detailsHintHtml = category === 'accessible'
      ? `<span style="display:block;margin-top:7px;color:#0e7490;font-size:13px;font-weight:800;">${escapeHtml(accessCopy('details', language))}</span>`
      : '';

    let extra = '';
    if (category === 'camping' && Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) {
      const nearest = beach.nearbyCamping.reduce((closest, candidate) => (
        candidate.distanceMeters < closest.distanceMeters ? candidate : closest
      ));
      const campName = (language === 'en' && nearest.nameEn) ? nearest.nameEn : nearest.name;
      const label = language === 'gr' ? 'κάμπινγκ' : 'campsite';
      extra = `${label}: ${campName} · ${nearest.distanceMeters} m`;
    }

    return `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
              <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
              ${metaParts.length ? `<span style="display:block;margin-top:4px;color:#475569;font-size:14px;">${escapeHtml(metaParts.join(' · '))}</span>` : ''}
              ${accessFeaturesHtml}
              ${accessCaveatHtml}
              ${detailsHintHtml}
              ${extra ? `<span style="display:block;margin-top:2px;color:#0e7490;font-size:13px;font-weight:600;">${escapeHtml(extra)}</span>` : ''}
            </a>
          </li>`;
  }).join('');

  return `
        <section${sectionId} style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${cards}</ul>
        </section>`;
};

const renderRegionHubSection = (hubRegions, locale) => {
  const language = locale.language;
  const heading = localeText(hubSectionHeading, locale);
  const collator = language === 'gr' ? 'el' : 'en';
  const items = [...hubRegions]
    .sort((a, b) => localized(a.island.name, a.region.id, language)
      .localeCompare(localized(b.island.name, b.region.id, language), collator))
    .map(item => `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(item.path, locale))}" style="display:block;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(localized(item.island.name, item.region.id, language))}</a>
          </li>`)
    .join('');

  return `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Pick the data-driven section for a landing based on its kind.
const renderLandingDynamic = (landing, locale, dynamic) => {
  if (landing.kind === 'beachList') return renderBeachListSection(dynamic.items || [], locale, landing.category);
  if (landing.kind === 'regionHub') {
    // best-beaches-greece-today also leads with real, crawlable links to the most
    // popular individual beaches (it used to link regions only — a 2-hop crawl to
    // any beach). Other regionHub pages (sheltered-meltemi) keep the region grid.
    const topBeaches = (dynamic.topBeaches || []).length
      ? renderBeachListSection(dynamic.topBeaches, locale, 'top')
      : '';
    return `${topBeaches}${renderRegionHubSection(dynamic.hubRegions || [], locale)}`;
  }
  return '';
};

const landingAlternateUrls = landing => {
  const supported = prerenderLocales.filter(locale => landing.locales[locale.id]);
  // x-default has to point at a page that EXISTS. This used to hard-code the Greek
  // locale for every landing, including the 5 that are English-only — so they
  // advertised /el/<slug>/ URLs that were never emitted. Google discards an entire
  // hreflang set when one entry is broken, which took the valid entries with it.
  // Prefer Greek when there is a Greek version, otherwise the first locale we built.
  const defaultLocale = supported.find(locale => locale.id === xDefaultLocale.id) || supported[0];
  return [
    ...supported.map(locale => ({
      hreflang: locale.hreflang,
      href: canonicalUrlFor(landing.pathName, locale),
    })),
    ...(defaultLocale ? [{
      hreflang: 'x-default',
      href: canonicalUrlFor(landing.pathName, defaultLocale),
    }] : []),
  ];
};

const buildSeoLandingPage = (baseHtml, landing, content, locale, imageUrl, dynamic = {}) => {
  const canonicalUrl = canonicalUrlFor(landing.pathName, locale);
  const imageAlt = locale.language === 'gr'
    ? `${content.h1} — CalmBeach Greece`
    : `${content.h1} on CalmBeach Greece`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: content.title,
      description: content.description,
      url: canonicalUrl,
      image: imageUrl,
      inLanguage: locale.htmlLang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'CalmBeach Greece',
        url: canonicalUrlFor('/', locale),
      },
    },
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: content.h1, url: canonicalUrl },
    ]),
  ];

  // Beach-list guides expose their list as ItemList structured data, mirroring
  // the region pages, so the curated beaches are machine-readable too.
  if (landing.kind === 'beachList' && Array.isArray(dynamic.items) && dynamic.items.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      numberOfItems: dynamic.items.length,
      itemListElement: dynamic.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: displayName(item.beach.name, `Beach ${item.beach.id}`, locale.language),
        url: canonicalUrlFor(beachPath(item.region, item.island, item.beach), locale),
      })),
    });
  }
  if (Array.isArray(content.faq) && content.faq.length > 0) {
    jsonLd.push(faqJsonLd(content.faq.filter(item => item?.q && item?.a)));
  }

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: content.title,
    description: content.description,
    canonicalUrl,
    imageUrl,
    imageAlt,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: landingAlternateUrls(landing),
    ogType: 'website',
    jsonLd,
  });

  const dynamicHtml = renderLandingDynamic(landing, locale, dynamic);
  return stripClientScripts(htmlWithHead).replace(/<div id="root">\s*<\/div>/i, staticSeoLandingPage(content, locale, dynamicHtml));
};

// --- Guides hub ----------------------------------------------------------------
// The ~300 island×intent articles were only reachable from the region/beach page
// they belong to — there was no single place a reader (or a crawler) could see
// what the site actually publishes. This is that place: one static index, grouped
// by topic, linking every guide that cleared the ≥MIN gate. en + el only, matching
// the home page: de/fr/it guides exist only for LOCALIZED_REGIONS, so a national
// hub in those locales would list mostly-missing pages.
const GUIDES_HUB_PATH = '/beach-guides/';

const guidesHubCopy = {
  en: {
    title: 'Greek Beach Guides — by Topic and Island | CalmBeach',
    description: 'Every CalmBeach beach guide in one place: family, more sheltered, snorkeling, organized, secluded and sunset beaches, island by island.',
    h1: 'Beach guides',
    intro: 'Every guide we publish, grouped by what you are looking for and then by island. Each one lists the beaches that actually match, and links straight through to live wind and wave conditions.',
    nationalHeading: 'Greece-wide guides',
    islandsLabel: island => island,
    empty: 'No guides published yet.',
  },
  gr: {
    title: 'Οδηγοί Παραλιών — ανά Θέμα και Νησί | CalmBeach',
    description: 'Όλοι οι οδηγοί παραλιών του CalmBeach σε ένα σημείο: οικογενειακές, υπήνεμες, για snorkeling, οργανωμένες, απομονωμένες και για ηλιοβασίλεμα, νησί προς νησί.',
    h1: 'Οδηγοί παραλιών',
    intro: 'Όλοι οι οδηγοί που δημοσιεύουμε, ομαδοποιημένοι πρώτα κατά θέμα και μετά κατά νησί. Ο καθένας δείχνει τις παραλίες που ταιριάζουν πραγματικά και οδηγεί κατευθείαν στις τρέχουσες συνθήκες ανέμου και κύματος.',
    nationalHeading: 'Οδηγοί για όλη την Ελλάδα',
    islandsLabel: island => island,
    empty: 'Δεν έχουν δημοσιευτεί ακόμη οδηγοί.',
  },
};

// Full topic headings for the hub — INTENT_NAV_LABELS are chip-sized fragments
// ("Organized"), which read as nonsense as a standalone <h2>.
const GUIDES_HUB_TOPIC_HEADINGS = {
  family:     { en: 'Family beaches',              gr: 'Οικογενειακές παραλίες' },
  snorkeling: { en: 'Snorkeling beaches',          gr: 'Παραλίες για snorkeling' },
  organized:  { en: 'Organized beaches',           gr: 'Οργανωμένες παραλίες' },
  secluded:   { en: 'Secluded beaches',            gr: 'Απομονωμένες παραλίες' },
  sunset:     { en: 'Sunset beaches',              gr: 'Παραλίες για ηλιοβασίλεμα' },
};

// The sheltered guides are NOT one topic: a Cycladic island is sheltered from
// the meltemi, an Ionian one from the maistros, the Thermaic gulf from the
// afternoon sea breeze. Listing Arta and Ithaca under a "meltemi" heading told
// the reader something false about a sea the meltemi doesn't reach, so the hub
// splits this topic by wind regime. Aegean first (by far the largest set).
const SHELTERED_REGIME_ORDER = ['aegean', 'ionian', 'thermaic'];
const shelteredHubHeading = (windContext, language) => {
  const label = LOCAL_WIND_LABEL[windContext];
  return language === 'gr' ? `Υπήνεμες ${label.elIn}` : `Sheltered in ${label.en}`;
};

// islandIntentPages -> [{ key, heading, islands: [{ name, href }] }], in the
// islandIntents display order, islands collated in the reader's alphabet.
// `sheltered` expands into one group per wind regime present.
const groupGuidesByTopic = (islandIntentPages, locale) => {
  const language = locale.language;
  const collator = language === 'gr' ? 'el' : 'en';
  const toIsland = (page, intent) => ({
    name: displayName(page.island.name, page.region.id, language),
    href: localizedPath(islandIntentPath(intent, page.region, page.island), locale),
  });
  const byName = (a, b) => a.name.localeCompare(b.name, collator);

  return islandIntents.flatMap(intent => {
    const pages = islandIntentPages.filter(page => page.intent.key === intent.key);
    if (pages.length === 0) return [];

    if (intent.key === 'sheltered') {
      return SHELTERED_REGIME_ORDER
        .map(windContext => ({
          key: `sheltered-${windContext}`,
          heading: shelteredHubHeading(windContext, language),
          islands: pages
            .filter(page => getRegionWindContext(page.region.id) === windContext)
            .map(page => toIsland(page, intent))
            .sort(byName),
        }))
        .filter(group => group.islands.length > 0);
    }

    return [{
      key: intent.key,
      heading: GUIDES_HUB_TOPIC_HEADINGS[intent.key]?.[language]
        || GUIDES_HUB_TOPIC_HEADINGS[intent.key]?.en
        || INTENT_NAV_LABELS[intent.key]?.[language]
        || intent.key,
      islands: pages.map(page => toIsland(page, intent)).sort(byName),
    }];
  });
};

const staticGuidesHubPage = (topics, locale) => {
  const copy = guidesHubCopy[locale.language] || guidesHubCopy.en;
  const chrome = landingChromeCopy[locale.language] || landingChromeCopy.en;
  const homeHref = localizedPath('/', locale);

  const renderTopic = topic => `
        <section style="margin:0 0 26px;border-top:1px solid #bae6fd;padding-top:16px;">
          <h2 style="margin:0 0 10px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(topic.heading)} <span style="font-weight:600;font-size:15px;color:#64748b;">(${topic.islands.length})</span></h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:0;padding:0;list-style:none;">
            ${topic.islands.map(island => `<li style="margin:0;"><a href="${escapeHtml(island.href)}" style="display:block;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(island.name)}</a></li>`).join('')}
          </ul>
        </section>`;

  const nationalLinks = NATIONAL_GUIDE_LINKS
    .map(link => `<li style="margin:0;"><a href="${escapeHtml(localizedPath(link.path, locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:800;">${escapeHtml(link.label[locale.language] || link.label.en)}</a></li>`)
    .join('');

  return `
    <div id="root">
      <main style="max-width:880px;margin:0 auto;padding:0 20px 56px;color:#0f172a;background:#f8fafc;">
        <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;">
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0e7490;font-weight:800;font-size:18px;">
            <img src="/calmbeach-mark.svg" alt="" width="32" height="32" style="display:block;" />
            CalmBeach Greece
          </a>
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;padding:8px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(chrome.openApp)}</a>
        </header>
        <section style="padding:24px 0 20px;">
          <h1 style="margin:0 0 14px;font-size:38px;line-height:1.08;">${escapeHtml(copy.h1)}</h1>
          <p style="margin:0;font-size:18px;line-height:1.6;color:#334155;">${escapeHtml(copy.intro)}</p>
        </section>
        ${topics.length > 0 ? topics.map(renderTopic).join('') : `<p style="color:#475569;">${escapeHtml(copy.empty)}</p>`}
        <section style="margin:28px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(copy.nationalHeading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${nationalLinks}</ul>
        </section>
        <p data-nosnippet="true" style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">${escapeHtml(chrome.disclaimer)}</p>
      </main>
    </div>
  `;
};

const buildGuidesHubPage = (baseHtml, islandIntentPages, locale, imageUrl, emittedLocales) => {
  const copy = guidesHubCopy[locale.language] || guidesHubCopy.en;
  const canonicalUrl = canonicalUrlFor(GUIDES_HUB_PATH, locale);
  const topics = groupGuidesByTopic(islandIntentPages, locale);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: copy.h1,
      description: copy.description,
      url: canonicalUrl,
      image: imageUrl,
      inLanguage: locale.htmlLang,
      isPartOf: { '@type': 'WebSite', name: 'CalmBeach Greece', url: canonicalUrlFor('/', locale) },
      // One ItemList per topic rather than ~300 flat entries, so the grouping the
      // page actually shows is the grouping machines read.
      hasPart: topics.map(topic => ({
        '@type': 'ItemList',
        name: topic.heading,
        numberOfItems: topic.islands.length,
        itemListElement: topic.islands.map((island, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: island.name,
          url: `${siteUrl}${island.href}`,
        })),
      })),
    },
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: copy.h1, url: canonicalUrl },
    ]),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: copy.title,
    description: copy.description,
    canonicalUrl,
    imageUrl,
    imageAlt: copy.h1,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(GUIDES_HUB_PATH, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return stripClientScripts(htmlWithHead)
    .replace(/<div id="root">\s*<\/div>/i, staticGuidesHubPage(topics, locale));
};

const buildHomePage = (baseHtml, locale, imageUrl, emittedLocales = baseLocales, regionLinks = []) => {
  const pathName = '/';
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CalmBeach Greece',
    alternateName: ['Calm Beach Greece', 'CalmBeach'],
    description: locale.homeDescription,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
  };

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: locale.homeTitle,
    description: locale.homeDescription,
    canonicalUrl,
    imageUrl,
    imageAlt: locale.homeImageAlt,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticHomeFallback(canonicalUrl, locale, regionLinks));
};

const buildRegionPage = (baseHtml, island, region, imageUrl, locale = prerenderLocales[0], emittedLocales = baseLocales, sheltered = 0) => {
  const pathName = regionPath(region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = displayName(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const total = beaches.filter(b => Number.isInteger(b.id) && b.name).length;
  // Dataset-driven shelter hook (meltemi/βοριάς/Vardaris count) — replaces the
  // generic, near-identical "compare N beaches by wind, waves…" copy for en/gr.
  const nameEl = displayName(island.name, region.id, 'gr');
  const nameEn = regionDisplayEn(region.id, displayName(island.name, region.id, 'en'));
  // All five languages now go through one function. de/fr/it used to skip it
  // entirely and carry inline literals, which is how they ended up with a
  // different framing from en/gr on the same page type.
  const headCopy = buildRegionHeadCopy(region.id, nameEl, nameEn, total, sheltered, language);
  // The same two computed sections the guides carry — the only content on the
  // site that answers "when should I come?" with a number, and the strongest
  // argument that these are real pages and not a keyword permutation. Both take
  // an arbitrary beach-id set and return the content untouched when the data is
  // missing or the region has fewer than 3 beaches with climatology.
  // Same idiom as the guide loop on purpose (`.map(beach => beach.id)`,
  // `locale.language` spelled out): scripts/validateWaveClimatology.mjs and
  // validateWaterClimatology.mjs read this call site as TEXT to prove the
  // section is wired to real beach ids, the right climatology file and the
  // locale's language. Passing the local `language` alias here was equivalent at
  // runtime and still tripped both gates — correctly, because a gate that reads
  // source cannot know an alias is the same thing.
  // Kept un-nested for the same reason the guide loop is: the water gate reads
  // one call expression and fails if `waveClimatology` appears inside it, because
  // the two file names differ by a letter and swapping them makes the temperature
  // section vanish in silence. Nesting the sea call inside the water call put
  // both names in one expression and tripped it.
  const beachIds = beaches.filter(beach => Number.isInteger(beach.id)).map(beach => beach.id);
  const withSea = withSeaSeasonSection(headCopy, beachIds, waveClimatology, locale.language, region.id);
  const content = withWaterSeasonSection(withSea, beachIds, waterClimatology, locale.language);
  const description = content.description;
  const title = content.title;
  // The breadcrumb used to read `${islandName} beaches` — the raw display name
  // plus a hardcoded English noun, on every locale. Two problems it caused:
  // "Παραλίες Αττικής" on the page against "Περιοχή Αθήνας beaches" in the
  // breadcrumb (the H1 uses the curated `regionDisplayEn`/declension, the label
  // did not), and a German page whose breadcrumb said "beaches". The H1 IS the
  // label — one string, one name. Caught 05/08 by scripts/auditRegionPages.mjs.
  const regionPageName = content.h1;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: content.h1,
    description,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: beaches.length,
      itemListElement: beaches.slice(0, 80).map((beach, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: displayName(beach.name, `Beach ${beach.id}`, language),
        url: canonicalUrlFor(beachPath(region, island, beach), locale),
      })),
    },
  };
  const jsonLd = [
    pageJsonLd,
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: regionPageName, url: canonicalUrl },
    ]),
    // Every question here is rendered as a visible <h2>/<p> pair by
    // staticRegionFallback, from this same array. Region pages were the only
    // list-page type on the site without it.
    faqJsonLd(content.sections.map(section => ({ q: section.heading, a: section.body }))),
  ].filter(Boolean);

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: pickLang(language, { en: `${nameEn} beaches in Greece`, gr: `Παραλίες ${regionPrepGr(region.id, islandName)}`, de: `Strände – ${nameEn}, Griechenland`, fr: `Plages – ${nameEn}, Grèce`, it: `Spiagge – ${nameEn}, Grecia` }),
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticRegionFallback(island, region, canonicalUrl, locale, content));
};

const articleChrome = {
  en: { listHeading: 'The beaches', ctaLead: 'Wind and waves change every day. See live conditions for any of these beaches before you drive out.', ctaButton: 'Open the live map', photoNote: 'Photo credits', faqHeading: 'Good to know' },
  gr: { listHeading: 'Οι παραλίες', ctaLead: 'Ο άνεμος και το κύμα αλλάζουν κάθε μέρα. Δες ζωντανά τις συνθήκες για όποια παραλία θέλεις πριν ξεκινήσεις.', ctaButton: 'Άνοιγμα ζωντανού χάρτη', photoNote: 'Πηγές φωτογραφιών', faqHeading: 'Καλό να ξέρεις' },
  de: { listHeading: 'Die Strände', ctaLead: 'Wind und Wellen ändern sich täglich. Prüfe die Live-Bedingungen, bevor du losfährst.', ctaButton: 'Live-Karte öffnen', photoNote: 'Bildnachweise', faqHeading: 'Gut zu wissen' },
  fr: { listHeading: 'Les plages', ctaLead: "Le vent et les vagues changent chaque jour. Vérifiez les conditions en direct avant de partir.", ctaButton: 'Ouvrir la carte en direct', photoNote: 'Crédits photo', faqHeading: 'Bon à savoir' },
  it: { listHeading: 'Le spiagge', ctaLead: 'Vento e onde cambiano ogni giorno. Controlla le condizioni in diretta prima di partire.', ctaButton: 'Apri la mappa live', photoNote: 'Crediti fotografici', faqHeading: 'Da sapere' },
};
const getArticleChrome = language => articleChrome[language] || articleChrome.en;

// --- Safety + legal strip on the guide pages ---------------------------------
// These articles carried no disclaimer and no legal link at all, while the beach
// pages have had both since 29/07. Snorkeling made that indefensible: it is the
// one topic we publish where the reader gets into deep water off rocks partly
// because we pointed them there. Terms/Privacy/Cookies exist at the root only
// (no /el/terms/), so those stay root-relative on purpose; the FAQ is localized.
// Wording avoids the word "safe" in every language — the honesty guard treats an
// unqualified safety claim as a defect, and it is right to.
const ARTICLE_SAFETY_NOTE = {
  en: {
    generic: 'Wind, waves and facilities change. Everything here is indicative and does not replace what you see when you arrive, lifeguard instructions or the beach flags.',
    snorkeling: 'Everything here is indicative and does not replace what you see when you arrive, lifeguard instructions or the beach flags. Snorkel at your own risk: avoid going in alone over rocks when there is swell, and stay close to shore.',
    legalLabel: 'Terms', privacyLabel: 'Privacy', cookiesLabel: 'Cookies', faqLabel: 'How CalmBeach works',
  },
  gr: {
    generic: 'Ο άνεμος, το κύμα και οι παροχές αλλάζουν. Ό,τι γράφεται εδώ είναι ενδεικτικό και δεν αντικαθιστά αυτό που βλέπεις όταν φτάνεις, τις οδηγίες του ναυαγοσώστη ή τις σημαίες της παραλίας.',
    snorkeling: 'Ό,τι γράφεται εδώ είναι ενδεικτικό και δεν αντικαθιστά αυτό που βλέπεις όταν φτάνεις, τις οδηγίες του ναυαγοσώστη ή τις σημαίες της παραλίας. Το snorkeling γίνεται με δική σου ευθύνη: μην μπαίνεις μόνος πάνω από βράχια όταν έχει κύμα και μένε κοντά στην ακτή.',
    legalLabel: 'Όροι χρήσης', privacyLabel: 'Απόρρητο', cookiesLabel: 'Cookies', faqLabel: 'Πώς δουλεύει το CalmBeach',
  },
  de: {
    generic: 'Wind, Wellen und Ausstattung ändern sich. Alles hier ist unverbindlich und ersetzt weder den eigenen Eindruck vor Ort noch Anweisungen der Rettungsschwimmer oder die Strandflaggen.',
    snorkeling: 'Alles hier ist unverbindlich und ersetzt weder den eigenen Eindruck vor Ort noch Anweisungen der Rettungsschwimmer oder die Strandflaggen. Schnorcheln auf eigene Verantwortung: nicht allein über Felsen bei Welle, und in Ufernähe bleiben.',
    legalLabel: 'Nutzungsbedingungen', privacyLabel: 'Datenschutz', cookiesLabel: 'Cookies', faqLabel: 'So funktioniert CalmBeach',
  },
  fr: {
    generic: "Le vent, les vagues et les équipements changent. Tout ceci est indicatif et ne remplace ni ce que vous voyez sur place, ni les consignes des maîtres-nageurs, ni les drapeaux de plage.",
    snorkeling: "Tout ceci est indicatif et ne remplace ni ce que vous voyez sur place, ni les consignes des maîtres-nageurs, ni les drapeaux de plage. Le snorkeling se pratique sous votre responsabilité : évitez d'y aller seul au-dessus des rochers par houle, et restez près du bord.",
    legalLabel: "Conditions d'utilisation", privacyLabel: 'Confidentialité', cookiesLabel: 'Cookies', faqLabel: 'Comment fonctionne CalmBeach',
  },
  it: {
    generic: 'Vento, onde e servizi cambiano. Tutto qui è indicativo e non sostituisce ciò che vedi sul posto, le indicazioni dei bagnini o le bandiere della spiaggia.',
    snorkeling: "Tutto qui è indicativo e non sostituisce ciò che vedi sul posto, le indicazioni dei bagnini o le bandiere della spiaggia. Lo snorkeling è sotto la tua responsabilità: evita di entrare da solo sopra gli scogli con onda e resta vicino a riva.",
    legalLabel: 'Termini di utilizzo', privacyLabel: 'Privacy', cookiesLabel: 'Cookie', faqLabel: 'Come funziona CalmBeach',
  },
};

const renderArticleLegalStrip = (intentKey, locale) => {
  const copy = ARTICLE_SAFETY_NOTE[locale.language] || ARTICLE_SAFETY_NOTE.en;
  const note = intentKey === 'snorkeling' ? copy.snorkeling : copy.generic;
  const links = [
    { href: localizedPath('/faq/', locale), label: copy.faqLabel },
    { href: '/terms/', label: copy.legalLabel },
    { href: '/privacy/', label: copy.privacyLabel },
    { href: '/cookies/', label: copy.cookiesLabel },
  ];
  // Guide articles get their own strip (tuned per intent — snorkeling says something
  // different) and are therefore the ONE page type that does not go through
  // withStaticFooter, so the source/licence line has to be repeated here or those
  // 997 pages would be the only ones shipping without the ODbL notice.
  const dataNote = (FOOTER_COPY[locale.language] || FOOTER_COPY.en).data;
  return `
          <footer class="cb-legal" data-nosnippet="true">
            <p>${escapeHtml(note)}</p>
            <ul>${links.map(link => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>
            <p>${escapeHtml(dataNote)}</p>
          </footer>`;
};

// One compact credit line per photo we actually rendered: author, licence and a
// link to the Commons file page. Per-card captions would drown the design, but a
// blanket "photos from Commons" note does NOT satisfy CC BY — this does.
const renderPhotoCredits = (beaches, language, chrome, heroPhoto = null) => {
  const row = (beach, credit) => {
    const name = displayName(beach.name, `Beach ${beach.id}`, language);
    const { author, license, sourceUrl } = credit;
    // A visitor's own photo has no licence deed and no source page — its whole
    // provenance is "this person sent it to us and let us publish it". Rendering
    // the Commons shape for it would produce a dead link and a dangling comma.
    if (!sourceUrl) return `<li>${escapeHtml(name)}: ${escapeHtml(author)}</li>`;
    return `<li>${escapeHtml(name)}: <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(author)}</a>, ${escapeHtml(license)}</li>`;
  };
  // The hero counts too when it is a beach photo rather than a region background.
  const heroRow = heroPhoto?.credit ? [row(heroPhoto.beach, heroPhoto.credit)] : [];
  const rows = heroRow.concat(beaches
    .map(beach => ({ beach, photo: beachCardPhoto(beach, language) }))
    .filter(entry => entry.photo?.creditRequired)
    .map(({ beach, photo }) => row(beach, photo.credit)));
  if (rows.length === 0) return '';
  return `
          <details class="cb-credits">
            <summary>${escapeHtml(chrome.photoNote)}</summary>
            <ul>${rows.join('')}</ul>
          </details>`;
};

// --- Shoreline thumbnails ------------------------------------------------------
// A no-JS port of components/ShorelineThumbnail.tsx. Where a card has no
// photograph we draw the beach's OWN coastline instead of the generic wave
// panel: real geometry (public/data/coastline/shape/<region>.json, built by
// scripts/buildShorelineThumbs.mjs) with the shore material and amenity marks
// read off the same audited fields the card's chips use.
//
// This file is the static twin of the React component, so the two MUST stay in
// step: same feature derivation, same symbols, same tiled texture, same phase
// shift — a beach's drawing is identical in the app and on the guide page. If
// you change one, change both. The only deliberate difference is byte-driven:
// coordinates are rounded to 0.1 units (~0.15 px at the rendered card size),
// because this markup is inlined into ~980 files rather than executed once.
const SHORELINE_BOX = { width: 200, height: 120, pinX: 100, pinY: 78 };
const shorelineShapeDir = path.join(publicDir, 'data', 'coastline', 'shape');

// Read once per region and keep it: this script renders ~980 pages and would
// otherwise re-parse the same JSON for every card. A missing file is the normal
// state for a region with no shapes yet, so it is cached as null and stays quiet.
const shorelineShapeCache = new Map();
const shorelineShapesFor = regionId => {
  if (!regionId) return null;
  if (shorelineShapeCache.has(regionId)) return shorelineShapeCache.get(regionId);
  let beaches = null;
  try {
    const payload = JSON.parse(readFileSync(path.join(shorelineShapeDir, `${regionId}.json`), 'utf8'));
    beaches = payload?.beaches && typeof payload.beaches === 'object' ? payload.beaches : null;
  } catch {
    beaches = null;
  }
  shorelineShapeCache.set(regionId, beaches);
  return beaches;
};

// Coverage is 92.9%, so "no shape" is a normal answer and callers must keep the
// old placeholder. The strict shape test is also the injection guard: the points
// string goes straight into an SVG attribute, so anything that is not
// "x,y x,y …" is refused rather than escaped.
const SHORELINE_POINTS_RE = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?(?: -?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)+$/;
const shorelineShapeFor = (regionId, beachId) => {
  if (!Number.isInteger(beachId)) return null;
  const raw = shorelineShapesFor(regionId)?.[String(beachId)];
  const points = typeof raw?.s === 'string' ? raw.s.trim() : '';
  if (!SHORELINE_POINTS_RE.test(points)) return null;
  return { points };
};

// Port of materialFromLabel in ShorelineThumbnail.tsx.
const shorelineMaterialFromLabel = value => {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  if (!text) return null;
  if (text.includes('sand') || text.includes('αμμ')) return 'sand';
  if (text.includes('pebble') || text.includes('shingle') || text.includes('βότσαλ') || text.includes('βοτσαλ')) {
    return 'pebbles';
  }
  if (text.includes('rock') || text.includes('βραχ')) return 'rocks';
  return null;
};

// Port of deriveShorelineFeatures. Every symbol maps to a field the pages
// already state in words — nothing here is inferred. Access is drawn ONLY when
// getting there is awkward: "easy road access" is frequently an unverified
// default in the dataset, so an asphalt road (or an unknown access) earns no
// mark at all.
const shorelineFeaturesFor = beach => {
  const terrainTypes = beach?.metadata?.terrain?.types;
  const candidates = [
    beach?.beachType,
    beach?.staticLabels?.beachType,
    ...(Array.isArray(terrainTypes) ? terrainTypes : []),
  ];

  let material = null;
  for (const candidate of candidates) {
    material = shorelineMaterialFromLabel(candidate);
    if (material) break;
  }

  const depth = beach?.characteristics?.shallowWaters === true || beach?.waterDepth === 'shallow'
    ? 'shallow'
    : beach?.characteristics?.deepWaters === true || beach?.waterDepth === 'deep'
      ? 'deep'
      : null;

  const accessType = beach?.staticLabels?.accessType ?? beach?.metadata?.access?.type;
  const access = accessType === 'boat_only'
    ? 'boat'
    : accessType === 'passable_dirt_road' || accessType === 'difficult_dirt_road'
      ? 'track'
      : accessType === 'hiking_path_easy' || accessType === 'hiking_path_difficult'
        ? 'path'
        : null;

  const amenities = beach?.amenities;
  return {
    material,
    depth,
    access,
    sunbeds: amenities?.sunbeds === true || amenities?.organized === true,
    eatery: amenities?.taverna === true || amenities?.beachBar === true || amenities?.restaurant === true,
    trees: amenities?.naturalShade === true,
  };
};

const shorelinePoints = serialized => serialized
  .split(' ')
  .map(pair => pair.split(',').map(Number))
  .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));

// The shoreline is built left-to-right, so the waterline height is a plain lookup.
const makeShorelineYAt = points => x => {
  if (points.length === 0) return SHORELINE_BOX.pinY;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) {
      if (x2 === x1) return y2;
      return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
  }
  return points[points.length - 1][1];
};

const SHORE_INK = '#8d7a55';
const SHORE_INK_BUILT = '#6f6146';
const SHORE_INK_TREE = '#6f8a62';
const SHORE_INK_ROUTE = '#7a6a4a';

// How far out to sea the depth contours sit — crowded against the shore reads as
// "deep straight away", spread wide as "you can walk out a long way".
const SHORE_CONTOURS = {
  shallow: [-11, -23, -36],
  medium: [-7, -15, -24],
  deep: [-4, -8.5, -14],
};

// Coordinates: 0.1 units is ~0.15 px on a rendered card, so this is lossless to
// the eye and drops ~2 bytes off every number in the drawing. "0.5" -> ".5" is
// valid SVG and saves another byte a time over ~150 numbers per card.
const trimZero = text => text.replace(/^(-?)0\./, '$1.');
const svgNum = value => {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? '0' : trimZero(String(rounded));
};
// Opacities and stroke widths keep 2 decimals: the contour ramp is .32/.22/.12
// and rounding it to one decimal would visibly flatten the depth ladder.
const svgFine = value => trimZero(String(Math.round(value * 100) / 100));

// Grains, shingle or rock, as a chart texture hugging the waterline: one tiled
// pattern filled into one band, mirroring TEXTURE_TILES in the component. The
// per-mark version this replaces emitted ~105 nodes per beach, which on a
// 40-card guide page is 4,000 nodes of inline SVG.
const SHORE_TEXTURE_TILES = {
  sand: {
    size: [7, 7],
    depth: 11,
    tile: `<circle cx="1.7" cy="2.1" r=".62" fill="${SHORE_INK}" opacity=".5"/>`
      + `<circle cx="5.1" cy="5.3" r=".55" fill="${SHORE_INK}" opacity=".42"/>`
      + `<circle cx="4.4" cy="1.2" r=".4" fill="${SHORE_INK}" opacity=".34"/>`,
  },
  pebbles: {
    size: [10, 8],
    depth: 11,
    tile: `<ellipse cx="2.6" cy="2.4" rx="1.7" ry="1.2" fill="none" stroke="${SHORE_INK}" stroke-width=".55" opacity=".6"/>`
      + `<ellipse cx="7.4" cy="5.7" rx="2" ry="1.35" fill="none" stroke="${SHORE_INK}" stroke-width=".55" opacity=".5"/>`,
  },
  rocks: {
    size: [16, 12],
    depth: 14,
    tile: `<path d="M1.4 8.4 L4.4 2.6 L7.6 8.4 Z" fill="none" stroke="${SHORE_INK}" stroke-width=".62" stroke-linejoin="round" opacity=".62"/>`
      + `<path d="M8.8 10.6 L11.6 5.4 L14.6 10.6 Z" fill="none" stroke="${SHORE_INK}" stroke-width=".62" stroke-linejoin="round" opacity=".5"/>`,
  },
};

// The strip of land between the waterline and `depth` units inland. The polyline
// is x-monotone, so walking it forward at y+2 and back at y+depth closes an
// exact band with no geometry work.
const shoreBandPolygon = (points, depth) => {
  const seaward = points.map(([x, y]) => `${svgNum(x)},${svgNum(y + 2)}`);
  const landward = [...points].reverse().map(([x, y]) => `${svgNum(x)},${svgNum(y + depth)}`);
  return [...seaward, ...landward].join(' ');
};

// A row of sunbeds seen from the side: mattress plus raised backrest.
const renderSunbedMark = (x, y, scale) => {
  const beds = [0, 7.5, 15]
    .map(offset => `<g transform="translate(${offset} 0)"><path d="M0 0 H5.4"/><path d="M0 0 L-1.9 -3.1"/><path d="M1.1 1.9 V0"/><path d="M4.6 1.9 V0"/></g>`)
    .join('');
  return `<g transform="translate(${svgNum(x)} ${svgNum(y)}) scale(${svgFine(scale)})" fill="none" stroke="${SHORE_INK_BUILT}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round">${beds}</g>`;
};

// A shore taverna: pitched roof on posts, the way a chart marks a building.
const renderEateryMark = (x, y, scale) => (
  `<g transform="translate(${svgNum(x)} ${svgNum(y)}) scale(${svgFine(scale)})" fill="none" stroke="${SHORE_INK_BUILT}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">`
  + '<path d="M-6.4 -2.2 L0 -7.4 L6.4 -2.2 Z"/><path d="M-4.6 -2.2 V2.4"/><path d="M4.6 -2.2 V2.4"/><path d="M-6.4 2.4 H6.4"/></g>'
);

// Tamarisks — the tree that actually shades a Greek beach.
const renderTreeMark = (x, y, scale) => (
  `<g transform="translate(${svgNum(x)} ${svgNum(y)}) scale(${svgFine(scale)})" stroke="${SHORE_INK_TREE}" stroke-linecap="round">`
  + `<path d="M0 2.6 V-2.4" stroke-width="1.1" fill="none"/>`
  + `<path d="M-4.8 -2.6 Q0 -8.4 4.8 -2.6 Z" stroke-width="1" fill="${SHORE_INK_TREE}" fill-opacity=".16"/></g>`
);

// How you get here, drawn only when it is not a plain road. The route arrives
// from the bottom of the frame, which is inland; for a boat-only beach no route
// is drawn at all — the absence is the message — and a boat sits offshore.
const renderAccessMark = (kind, shoreY) => {
  if (kind === 'boat') {
    return `<g transform="translate(146 ${svgNum(Math.max(14, shoreY - 22))})">`
      + `<path d="M-6.4 0 H6.4 L4.4 4 H-4.4 Z" fill="none" stroke="${SHORE_INK_ROUTE}" stroke-width="1.15" stroke-linejoin="round"/>`
      + `<path d="M0 0 V-6.6" stroke="${SHORE_INK_ROUTE}" stroke-width="1.05" stroke-linecap="round"/>`
      + `<path d="M0.9 -6.2 L4.6 -1.6 H0.9 Z" fill="${SHORE_INK_ROUTE}" fill-opacity=".22" stroke="${SHORE_INK_ROUTE}" stroke-width=".9" stroke-linejoin="round"/></g>`;
  }
  return `<path d="M100 128 C 90 116, 110 100, 100 ${(shoreY + 4).toFixed(1)}" fill="none" stroke="${SHORE_INK_ROUTE}"`
    + ` stroke-width="${kind === 'track' ? '1.5' : '1.2'}" stroke-linecap="round" stroke-dasharray="${kind === 'track' ? '6 4' : '0.5 4'}" opacity=".72"/>`;
};

const shorelineAriaLabels = {
  gr: beachName => `Σχεδιάγραμμα της ακτογραμμής στην παραλία ${beachName}`,
  en: beachName => `Diagram of the shoreline at ${beachName}`,
  fr: beachName => `Schéma du littoral à ${beachName}`,
  de: beachName => `Schema der Küstenlinie bei ${beachName}`,
  it: beachName => `Schema della costa a ${beachName}`,
};

// Amenity marks go on the land, well clear of the pin, and only where there is
// enough dry room below the waterline for them to sit inside the frame.
const shorelineAmenityMarks = (features, shoreYAt) => {
  const wanted = [];
  if (features.sunbeds) wanted.push('sunbeds');
  if (features.eatery) wanted.push('eatery');
  if (features.trees) wanted.push('trees');
  if (wanted.length === 0) return [];

  const slots = [62, 140, 30, 172];
  const placed = [];
  for (const kind of wanted) {
    const slot = slots.find(candidate => {
      if (placed.some(item => Math.abs(item.x - candidate) < 30)) return false;
      const y = shoreYAt(candidate) + (kind === 'sunbeds' ? 15 : 19);
      return y < SHORELINE_BOX.height - 5;
    });
    if (slot === undefined) continue;
    placed.push({ kind, x: slot, y: shoreYAt(slot) + (kind === 'sunbeds' ? 15 : 19) });
  }
  return placed;
};

// Returns the card figure for a beach we have geometry for, or null so the
// caller keeps the existing placeholder untouched.
const renderShorelineFigure = (beach, region, beachName, language) => {
  const shape = shorelineShapeFor(region?.id, beach?.id);
  if (!shape) return null;

  const { width, height, pinX, pinY } = SHORELINE_BOX;
  const features = shorelineFeaturesFor(beach);
  const points = shorelinePoints(shape.points);
  const shoreYAt = makeShorelineYAt(points);
  // Ids must be unique per page: ~30 of these cards share one document and a
  // duplicate gradient id would silently repaint every later card. Beach ids are
  // globally unique and a beach appears once per page, so they are the key.
  const uid = `cbs${beach.id}`;
  // The land polygon is the shoreline closed off along the bottom of the box.
  const land = `${shape.points} ${width + 10},${height + 30} -10,${height + 30}`;
  const markScale = 0.86;
  const label = (shorelineAriaLabels[language] || shorelineAriaLabels.en)(beachName);

  const contours = SHORE_CONTOURS[features.depth ?? 'medium']
    .map((offset, index) => `<polyline points="${shape.points}" transform="translate(0,${offset})" stroke-width="${svgFine(1.6 - index * 0.2)}" opacity="${svgFine(0.32 - index * 0.1)}"/>`)
    .join('');

  // The texture tile is phase-shifted by the beach id so two cards side by side
  // never tile in lockstep — the same trick, and the same seed, as the component.
  const texture = SHORE_TEXTURE_TILES[features.material] || null;
  const pattern = texture
    ? `<pattern id="${uid}t" patternUnits="userSpaceOnUse" width="${texture.size[0]}" height="${texture.size[1]}" patternTransform="translate(${beach.id % 7} ${beach.id % 5})">${texture.tile}</pattern>`
    : '';

  const clipped = [
    features.access && features.access !== 'boat' ? renderAccessMark(features.access, shoreYAt(pinX)) : '',
    texture ? `<polygon points="${shoreBandPolygon(points, texture.depth)}" fill="url(#${uid}t)"/>` : '',
    shorelineAmenityMarks(features, shoreYAt).map(mark => {
      if (mark.kind === 'sunbeds') return renderSunbedMark(mark.x - 8, mark.y, markScale);
      if (mark.kind === 'eatery') return renderEateryMark(mark.x, mark.y, markScale);
      return renderTreeMark(mark.x - 5, mark.y, markScale) + renderTreeMark(mark.x + 5.5, mark.y + 1.4, markScale * 0.82);
    }).join(''),
  ].join('');

  return '<div class="cb-fig cb-fig-shore">'
    + `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escapeHtml(label)}">`
    + '<defs>'
    + `<linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6ebfda"/><stop offset="55%" stop-color="#9bd6e7"/><stop offset="100%" stop-color="#c9ecf4"/></linearGradient>`
    + `<linearGradient id="${uid}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f2e7cd"/><stop offset="55%" stop-color="#e6d8b8"/><stop offset="100%" stop-color="#d8ccab"/></linearGradient>`
    + `<clipPath id="${uid}c"><polygon points="${land}"/></clipPath>`
    + pattern
    + '</defs>'
    + `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#${uid}s)"/>`
    // Depth contours: the same shoreline stepped out to sea, the way a chart
    // draws them. Their spacing is the water-depth field, not decoration.
    + `<g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${contours}</g>`
    // Wet sand: a soft light band hugging the water line.
    + `<polygon points="${land}" fill="#ffffff" opacity=".55" transform="translate(0,-2.5)"/>`
    + `<polygon points="${land}" fill="url(#${uid}l)"/>`
    + (features.access === 'boat' ? renderAccessMark('boat', shoreYAt(146)) : '')
    + (clipped ? `<g clip-path="url(#${uid}c)">${clipped}</g>` : '')
    + `<polyline points="${shape.points}" fill="none" stroke="#3f8ba3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/>`
    + `<circle cx="${pinX}" cy="${pinY}" r="7" fill="#ffffff" opacity=".9"/>`
    + `<circle cx="${pinX}" cy="${pinY}" r="4.4" fill="#0e7490"/>`
    + `<circle cx="${pinX}" cy="${pinY}" r="2.4" fill="#ffffff" opacity=".85"/>`
    + '</svg></div>';
};

// --- Ordering the list, and saying why ---------------------------------------
// A guide that promises "the best beaches for X" and then lists them in an
// order nobody can explain is the kind of page Google's own scaled-content
// policy is written about. Every signal below is a real field on the beach —
// terrain, orientation, Places review count — never a hash, never a guess.

const beachTerrainTypes = beach => beach.terrain?.types || beach.metadata?.terrain?.types || [];

// What a snorkeler is actually looking for: rock to hold life and hide fish.
// `rocks` outranks `large_stones`; pebbles alone are a weaker but real signal.
const snorkelSeabedScore = beach => {
  const types = beachTerrainTypes(beach);
  if (types.includes('rocks')) return 3;
  if (types.includes('large_stones')) return 2;
  if (types.includes('pebbles')) return 1;
  return 0;
};

// Facing away from all three northerly quadrants is the single most useful
// static fact we hold for a Greek summer: the Meltemi blows from the north.
const isShelteredFromNortherlies = beach =>
  NORTHERLY.every(direction => (beach.protectedFrom || []).includes(direction));

// How many wind directions the beach's own geometry turns its back on. Broader
// shelter means the water is more often flat, and flat water is what makes a
// seabed visible at all.
const shelterBreadth = beach => (beach.protectedFrom || []).length;

const rankIntentBeaches = (beaches, intentKey) => {
  const intentScore = beach => {
    if (intentKey === 'snorkeling') return snorkelSeabedScore(beach) * 10 + shelterBreadth(beach);
    if (intentKey === 'sheltered') return shelterBreadth(beach);
    return 0;
  };
  return [...beaches].sort((a, b) =>
    intentScore(b) - intentScore(a)
    // Real popularity: a log-scaled Google Places review count, 0 when we have
    // no Places data at all (so "we don't know" sorts last, it does not bluff).
    || (b.popularityScore ?? 0) - (a.popularityScore ?? 0)
    // Photographs last, as a tiebreak between otherwise equal beaches — never
    // as a reason to outrank a better-matching one.
    || (beachCardPhoto(b) ? 1 : 0) - (beachCardPhoto(a) ? 1 : 0)
    || (a.id ?? 0) - (b.id ?? 0));
};

// One line under the list heading telling the reader what the order means.
// Wording is deliberately hedged ("more often", "tends to") — it must pass the
// same honesty guard as every other static sentence on the site.
const orderRationale = (intentKey, language) => {
  if (intentKey === 'snorkeling') return pickLang(language, {
    en: 'The order is not random: rockier seabeds first, and among those the ones whose orientation leaves them less exposed — that is where the water tends to stay clearest. Check conditions before you go.',
    gr: 'Η σειρά δεν είναι τυχαία: πρώτα οι πιο βραχώδεις, και ανάμεσά τους όσες, με βάση τον προσανατολισμό τους, μένουν λιγότερο εκτεθειμένες — εκεί το νερό μένει πιο διάφανο. Έλεγξε τις συνθήκες πριν πας.',
    de: 'Die Reihenfolge ist nicht zufällig: zuerst die felsigeren, davon die nach Ausrichtung weniger exponierten — dort bleibt das Wasser meist klarer. Prüfe die Bedingungen, bevor du losfährst.',
    fr: "L'ordre n'est pas aléatoire : d'abord les fonds les plus rocheux, et parmi eux les moins exposés selon leur orientation — c'est là que l'eau reste la plus claire. Vérifiez les conditions avant de partir.",
    it: "L'ordine non è casuale: prima i fondali più rocciosi e, tra questi, i meno esposti secondo l'orientamento — lì l'acqua resta più limpida. Controlla le condizioni prima di andare.",
  });
  // The sheltered guides are the site's own subject and were the ONE intent
  // listing beaches in an order the page never explained — exactly the shape the
  // comment at the top of this block warns about. The order really is
  // `shelterBreadth` first (rankIntentBeaches), then the Places review count, so
  // the sentence names both; on regions where every listed bay shields the same
  // number of directions, popularity is what the reader is actually seeing, and
  // saying so is more honest than claiming a distinction that is not there.
  if (intentKey === 'sheltered') return pickLang(language, {
    en: 'The order is not random: first the bays whose orientation turns their back on the most wind directions, and among equal ones the beaches more people actually visit. Orientation is the shape of the coast, not a forecast — check wind and waves before you go.',
    gr: 'Η σειρά δεν είναι τυχαία: πρώτα οι όρμοι που, με βάση τον προσανατολισμό τους, γυρίζουν την πλάτη στις περισσότερες κατευθύνσεις ανέμου, και ανάμεσα σε ίσους όσες παραλίες έχουν περισσότερο κόσμο. Ο προσανατολισμός είναι το σχήμα της ακτής, όχι πρόγνωση — έλεγξε άνεμο και κύμα πριν πας.',
    de: 'Die Reihenfolge ist nicht zufällig: zuerst die Buchten, die nach ihrer Ausrichtung den meisten Windrichtungen den Rücken zuwenden, und unter gleichen die meistbesuchten. Die Ausrichtung ist die Form der Küste, keine Vorhersage — prüfe Wind und Wellen, bevor du losfährst.',
    fr: "L'ordre n'est pas aléatoire : d'abord les baies qui, par leur orientation, tournent le dos au plus grand nombre de directions de vent, et à égalité les plus fréquentées. L'orientation est la forme de la côte, pas une prévision — vérifiez le vent et les vagues avant de partir.",
    it: "L'ordine non è casuale: prima le insenature che, per orientamento, voltano le spalle al maggior numero di direzioni di vento e, a parità, le più frequentate. L'orientamento è la forma della costa, non una previsione — controlla vento e onde prima di andare.",
  });
  return null;
};

// Shown only where the seabed is the reason the beach ranks where it does —
// rock or large stones. Pebbles and sand say nothing a snorkeler can use, and
// the beach-type tag next to it already carries them.
const snorkelSeabedTag = (beach, language) => {
  const score = snorkelSeabedScore(beach);
  if (score < 2) return null;
  const rocky = score === 3;
  return pickLang(language, {
    en: rocky ? 'Rocky seabed' : 'Stony seabed',
    gr: rocky ? 'Βραχώδης βυθός' : 'Πετρώδης βυθός',
    de: rocky ? 'Felsiger Grund' : 'Steiniger Grund',
    fr: rocky ? 'Fond rocheux' : 'Fond de galets',
    it: rocky ? 'Fondale roccioso' : 'Fondale sassoso',
  });
};

// A card tag for the one thing no other beach list in Greece carries. Shown
// only when the geometry turns its back on all three northerly directions —
// the same rule the sheltered guides use, not a softer one.
const windShelterTag = (beach, language) => {
  if (!isShelteredFromNortherlies(beach)) return null;
  return pickLang(language, {
    en: 'More sheltered from northerlies',
    gr: 'Πιο υπήνεμη στα βόρεια',
    de: 'Nordwind: eher geschützter',
    fr: 'Plus abritée des vents du nord',
    it: 'Più riparata dai venti del nord',
  });
};

// The section that makes a snorkeling guide worth reading twice: when the
// Meltemi is up, WHICH of these specific beaches still face away from it, by
// name. Different sentence on every island because it is computed from that
// island's beaches — not a template with the island name swapped in. Phrased
// as a question so it belongs in the visible Q&A and in the FAQPage markup.
const withSnorkelingWindSection = (content, beaches, language) => {
  const sheltered = beaches.filter(isShelteredFromNortherlies);
  if (sheltered.length === 0) return content;
  const names = sheltered.slice(0, 3).map(beach => displayName(beach.name, `Beach ${beach.id}`, language));
  const list = names.join(', ');
  const more = sheltered.length - names.length;
  const section = pickLang(language, {
    en: {
      heading: 'Where do I snorkel when the north wind blows?',
      body: `${sheltered.length} of the beaches listed here face away from all three northerly directions, based on their orientation: ${list}${more > 0 ? ` and ${more} more on this page` : ''}. That usually means less chop and better visibility while the Meltemi is up — orientation is a strong hint, not a promise, so check wind and waves before you go.`,
    },
    gr: {
      heading: 'Πού κάνω snorkeling όταν φυσάει βόρειος;',
      body: `${sheltered.length} από τις παραλίες αυτής της σελίδας γυρίζουν την πλάτη και στις τρεις βόρειες κατευθύνσεις, με βάση τον προσανατολισμό τους: ${list}${more > 0 ? ` και ${more} ακόμη πιο κάτω` : ''}. Αυτό συνήθως σημαίνει λιγότερο κυματάκι και καλύτερη ορατότητα όσο κρατάει το μελτέμι — ο προσανατολισμός είναι ισχυρή ένδειξη, όχι υπόσχεση, οπότε έλεγξε άνεμο και κύμα πριν πας.`,
    },
    de: {
      heading: 'Wohin zum Schnorcheln bei Nordwind?',
      body: `${sheltered.length} der hier gelisteten Strände liegen nach ihrer Ausrichtung von allen drei Nordrichtungen abgewandt: ${list}${more > 0 ? ` und ${more} weitere auf dieser Seite` : ''}. Das bedeutet meist weniger Kabbelwasser und bessere Sicht, solange der Meltemi weht — die Ausrichtung ist ein starker Hinweis, keine Zusage: prüfe Wind und Wellen, bevor du losfährst.`,
    },
    fr: {
      heading: 'Où faire du snorkeling quand le vent du nord souffle ?',
      body: `${sheltered.length} des plages listées ici tournent le dos aux trois directions nord, selon leur orientation : ${list}${more > 0 ? ` et ${more} autres sur cette page` : ''}. Cela signifie généralement moins de clapot et une meilleure visibilité pendant le Meltemi — l'orientation est un indice fort, pas une promesse : vérifiez le vent et les vagues avant de partir.`,
    },
    it: {
      heading: 'Dove fare snorkeling quando soffia il vento del nord?',
      body: `${sheltered.length} delle spiagge elencate qui, per orientamento, danno le spalle a tutte e tre le direzioni nord: ${list}${more > 0 ? ` e altre ${more} in questa pagina` : ''}. Di solito significa meno increspature e visibilità migliore mentre soffia il Meltemi — l'orientamento è un indizio forte, non una promessa: controlla vento e onde prima di andare.`,
    },
  });
  return { ...content, sections: [section, ...content.sections] };
};

// ---------------------------------------------------------------------------
// Sub-area sections — the words people actually type for a big region.
// Search Console, 90 days to 24/08/2026: «βόρεια εύβοια παραλίες για παιδιά» 222
// impressions, «νότια εύβοια …» 128, «χαλκίδα …» 114, against 421 for the plain
// «εύβοια …». One page already serves all four at position 4–8; these sections
// give each phrase its own H2 (and FAQ entry) WITHOUT a new URL. Membership is
// computed from coordinates, so the lists can never drift from the beach data,
// and the copy states geography only — no shelter or calmness claim to guard.
// Add a region here only when Search Console shows the sub-area words.
const distanceKm = (a, lat, lon) => {
  const la = Number(a?.coordinates?.lat); const lo = Number(a?.coordinates?.lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return Infinity;
  return 111 * Math.hypot(la - lat, (lo - lon) * Math.cos((la * Math.PI) / 180));
};
const nearChalkida = beach => distanceKm(beach, 38.4637, 23.5945) <= 25;
const REGION_SUBAREAS = {
  'central-greece-evia': [
    { key: 'north', inName: { gr: 'στη Βόρεια Εύβοια', en: 'in North Evia' }, where: { gr: 'Αιδηψός, Λίμνη, Ιστιαία, Αγία Άννα', en: 'Aidipsos, Limni, Istiaia, Agia Anna' },
      test: beach => Number(beach?.coordinates?.lat) >= 38.72 },
    { key: 'chalkida', inName: { gr: 'κοντά στη Χαλκίδα', en: 'near Chalkida' }, where: { gr: 'έως 25 χλμ. από την πόλη', en: 'within 25 km of the town' },
      test: nearChalkida },
    { key: 'central', inName: { gr: 'στην Κεντρική Εύβοια', en: 'in Central Evia' }, where: { gr: 'Κύμη, Χιλιαδού, Αλιβέρι', en: 'Kymi, Chiliadou, Aliveri' },
      test: beach => { const lat = Number(beach?.coordinates?.lat); return lat >= 38.33 && lat < 38.72 && !nearChalkida(beach); } },
    { key: 'south', inName: { gr: 'στη Νότια Εύβοια', en: 'in South Evia' }, where: { gr: 'Κάρυστος, Μαρμάρι, Στύρα', en: 'Karystos, Marmari, Styra' },
      test: beach => Number(beach?.coordinates?.lat) < 38.33 },
  ],
};
// The family phrase is the one exception to CATEGORY_META: people search «παραλίες
// για παιδιά», not «οικογενειακές παραλίες», and the heading should say their words.
const subareaPhrase = (intentKey, language) => {
  if (intentKey === 'family') return language === 'gr' ? 'παραλίες για παιδιά' : 'family beaches';
  return CATEGORY_META[intentKey]?.[language]?.phrase || CATEGORY_META[intentKey]?.en?.phrase || 'beaches';
};
const withSubareaSections = (content, beaches, region, island, locale, intentKey) => {
  const areas = REGION_SUBAREAS[region?.id];
  const language = locale.language;
  if (!areas || (language !== 'gr' && language !== 'en')) return content;
  const total = beaches.length;
  const phrase = subareaPhrase(intentKey, language);
  const extra = [];
  for (const area of areas) {
    const members = beaches.filter(area.test);
    if (members.length === 0) continue;
    const names = members.map(beach => displayName(beach.name, `Beach ${beach.id}`, language));
    const links = members.map((beach, i) => ({ href: localizedPath(beachPath(region, island, beach), locale), label: names[i] }));
    const n = members.length;
    const heading = language === 'gr'
      ? `Ποιες ${phrase} είναι ${area.inName.gr};`
      : `Which ${phrase} are ${area.inName.en}?`;
    const body = language === 'gr'
      ? `${n} από τις ${total} ${phrase} αυτής της σελίδας ${n === 1 ? 'βρίσκεται' : 'βρίσκονται'} ${area.inName.gr} (${area.where.gr}): ${names.join(', ')}. Άνοιξε κάθε παραλία για live άνεμο και κύμα πριν πας.`
      : `${n} of the ${total} ${phrase} on this page ${n === 1 ? 'is' : 'are'} ${area.inName.en} (${area.where.en}): ${names.join(', ')}. Open each beach for live wind and waves before you go.`;
    extra.push({ heading, body, links });
  }
  if (extra.length === 0) return content;
  return { ...content, sections: [...content.sections, ...extra] };
};

// ---------------------------------------------------------------------------
// "Which five would I try first?" — a snorkeling shortlist computed from the same
// ranking the list already uses (seabed, then breadth of shelter, then real
// popularity), with the reason spelled out per beach from our own fields. Started
// on Rhodes only: /snorkeling-beaches/rhodes/ drew 1.748 impressions at position
// ~10 with 14 clicks in the 90 days to 24/08/2026 — the largest single gap on the
// site — while Halkidiki/Lemnos/Syros already convert at 13–15%. Widening this
// set to every snorkeling guide is a many-page change: route it through the
// 18·Google pre-launch gate first (docs/team/18-google.md §5), don't just add ids.
const SNORKELING_FIRST_PICKS_REGIONS = new Set(['south-aegean-rhodes']);
const DIRECTION_WORD = {
  en: { North: 'north', Northeast: 'north-east', East: 'east', Southeast: 'south-east', South: 'south', Southwest: 'south-west', West: 'west', Northwest: 'north-west' },
  gr: { North: 'βόρεια', Northeast: 'βορειοανατολικά', East: 'ανατολικά', Southeast: 'νοτιοανατολικά', South: 'νότια', Southwest: 'νοτιοδυτικά', West: 'δυτικά', Northwest: 'βορειοδυτικά' },
};
const withSnorkelingFirstPicksSection = (content, beaches, region, island, locale) => {
  if (!SNORKELING_FIRST_PICKS_REGIONS.has(region?.id)) return content;
  const language = locale.language;
  if (language !== 'gr' && language !== 'en') return content;
  const picks = rankIntentBeaches(beaches, 'snorkeling').slice(0, 5);
  if (picks.length < 3) return content;
  const gr = language === 'gr';
  const seabedWord = beach => {
    const score = snorkelSeabedScore(beach);
    if (score === 3) return gr ? 'βραχώδης βυθός' : 'rocky seabed';
    if (score === 2) return gr ? 'πετρώδης βυθός' : 'stony seabed';
    if (score === 1) return gr ? 'βοτσαλωτός βυθός' : 'pebble seabed';
    return gr ? 'αμμώδης βυθός' : 'sandy seabed';
  };
  // What the five SHARE is said once (on Rhodes all 18 are rocky and turn their
  // back on 5 of 8 directions — repeating that five times reads like a template);
  // what differs — which way each bay faces — is said per beach.
  const seabeds = new Set(picks.map(seabedWord));
  const breadths = new Set(picks.map(shelterBreadth));
  const sharedSeabed = seabeds.size === 1 ? [...seabeds][0] : null;
  const sharedBreadth = breadths.size === 1 ? [...breadths][0] : null;
  const facesOf = beach => (beach.orientation?.faces || []).map(d => DIRECTION_WORD[language][d]).filter(Boolean).join('/');
  const reason = beach => {
    const parts = [];
    if (!sharedSeabed) parts.push(seabedWord(beach));
    const faces = facesOf(beach);
    if (faces) parts.push(gr ? `κοιτάει ${faces}` : `faces ${faces}`);
    const breadth = shelterBreadth(beach);
    if (sharedBreadth === null && breadth > 0) parts.push(gr
      ? `με βάση τον προσανατολισμό της γυρίζει την πλάτη σε ${breadth} από τις 8 κατευθύνσεις ανέμου`
      : `by its orientation it turns its back on ${breadth} of the 8 wind directions`);
    return parts.join(', ');
  };
  const shared = [];
  // Greek needs the accusative here («έχουν βραχώδη βυθό»), not the nominative the tag uses.
  const SEABED_ACC = { 'βραχώδης βυθός': 'βραχώδη βυθό', 'πετρώδης βυθός': 'πετρώδη βυθό', 'βοτσαλωτός βυθός': 'βοτσαλωτό βυθό', 'αμμώδης βυθός': 'αμμώδη βυθό' };
  if (sharedSeabed) shared.push(gr ? `Και οι ${picks.length} έχουν ${SEABED_ACC[sharedSeabed] || sharedSeabed}` : `All ${picks.length} have a ${sharedSeabed}`);
  if (sharedBreadth !== null && sharedBreadth > 0) shared.push(gr
    ? `${shared.length ? 'με' : 'Με'} βάση τον προσανατολισμό τους γυρίζουν την πλάτη σε ${sharedBreadth} από τις 8 κατευθύνσεις ανέμου`
    : `${shared.length ? 'by' : 'By'} their orientation they turn their back on ${sharedBreadth} of the 8 wind directions`);
  const sharedLine = shared.length
    ? (gr ? ` ${shared.join(' και ')} — διαφέρουν στο πού κοιτάει ο κάθε όρμος.` : ` ${shared.join(' and ')} — they differ in which way each bay faces.`)
    : '';
  const items = picks.map((beach, i) => {
    const r = reason(beach);
    return `${i + 1}) ${displayName(beach.name, `Beach ${beach.id}`, language)}${r ? ` — ${r}` : ''}`;
  });
  const links = picks.map(beach => ({ href: localizedPath(beachPath(region, island, beach), locale), label: displayName(beach.name, `Beach ${beach.id}`, language) }));
  const section = gr
    ? {
      heading: 'Ποιες πέντε να δοκιμάσω πρώτες;',
      body: `Αν έχεις μία μέρα, ξεκίνα από αυτές — με τη σειρά της λίστας: πρώτα ο βυθός, μετά από πόσες κατευθύνσεις ανέμου προστατεύει τον όρμο ο προσανατολισμός του, και τέλος η πραγματική δημοτικότητα.${sharedLine} ${items.join('· ')}. Ο προσανατολισμός είναι ισχυρή ένδειξη, όχι υπόσχεση — δες άνεμο και κύμα στη σελίδα κάθε παραλίας πριν πας.`,
      links,
    }
    : {
      heading: 'Which five would I try first?',
      body: `If you only have a day, start with these — in the order of the list: seabed first, then how many wind directions each bay's orientation shields it from, then real popularity.${sharedLine} ${items.join('; ')}. Orientation is a strong hint, not a promise — check wind and waves on each beach page before you go.`,
      links,
    };
  return { ...content, sections: [section, ...content.sections] };
};

// "And if the wind turns?" — the question every sheltered guide raises and none
// of them answered. The list is built for ONE wind (the region's summer regime),
// so a reader who arrives on a day it is not blowing has no way to re-choose.
//
// Foreign forums ask this in almost these words — "which beach when it is
// windy?", "Finding the beach with the lightest winds??" (TripAdvisor Crete),
// "Non windy beach" (Naxos) — and the answer locals give each other is always a
// PAIR: "if St George is windy, Agios Prokopios is normally calm". That pair is
// exactly what our orientation field can compute and a competitor's beach list
// cannot.
//
// Why grouping by `faces` and not by our own ranking: on these regions every
// listed beach has the same shelter breadth (5 of 8 directions), so a "top three"
// would just restate the first three of the list — the template shape this
// project refuses. What genuinely differs between them is which way each bay
// looks, and that is the one fact that decides where to go when the wind moves.
//
// Started on the three sheltered guides that earned impressions and ZERO clicks
// in the 28 days to 18/08/2026 (Alonissos 227, Halkidiki 171, Syros 122 —
// reports/snapshots/2026-08-21.json, `zeroClick`). Widening this to all 244
// sheltered guides is a many-page change: route it through the 18·Google
// pre-launch gate first (docs/team/18-google.md §5), don't just add ids.
// The swap a local would tell you: "if St George is windy, Agios Prokopios is
// normally calm". Foreign forums ask for exactly this and answer each other with
// pairs, never with lists — TripAdvisor Crete «which beach when it is windy?»,
// Naxos «Non windy beach», Mumsnet «Any Greek Cyclades bearable with the Meltemi
// in August?». We can compute it from fields we already bake, so it is the one
// answer on this page a competitor's beach list cannot carry.
//
// The exposed beach is named ONLY by the model's verdict, never by its
// orientation: `shelteredFromLocalWind` folds in fetch and open water, so a bay
// can face south-east and still be exposed, and printing both would read as a
// contradiction on our own page.
const MELTEMI_SWAP_MAX_KM = 20;
const MELTEMI_SWAP_PAIRS = 2;
const meltemiSwapPairs = (beaches, island) => {
  const all = Array.isArray(island?.beaches) ? island.beaches : [];
  // Only beaches with a real Places review count: an exposed beach nobody has
  // heard of is not the one the reader drove to and found unusable.
  const exposed = all
    .filter(beach => beach.shelteredFromLocalWind !== true && (beach.popularityScore ?? 0) > 0)
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0));
  const used = new Set();
  const pairs = [];
  for (const from of exposed) {
    if (pairs.length >= MELTEMI_SWAP_PAIRS) break;
    const lat = Number(from?.coordinates?.lat);
    const lon = Number(from?.coordinates?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Chosen from `beaches` — the list printed on THIS page — so the swap never
    // sends the reader to a beach the page does not go on to show.
    const to = beaches.find(candidate =>
      !used.has(candidate.id) &&
      candidate.id !== from.id &&
      (candidate.orientation?.faces || []).length > 0 &&
      distanceKm(candidate, lat, lon) <= MELTEMI_SWAP_MAX_KM);
    if (!to) continue;
    used.add(to.id);
    pairs.push({ from, to, km: Math.round(distanceKm(to, lat, lon)) });
  }
  return pairs;
};
const SHELTERED_SWITCH_REGIONS = new Set([
  'thessaly-alonissos',
  'central-macedonia-halkidiki-mainland',
  'south-aegean-syros',
]);
// Two examples per group: enough to make the group concrete, few enough that the
// paragraph stays a sentence rather than a second list.
const SHELTERED_SWITCH_EXAMPLES = 2;
const withShelteredSwitchSection = (content, beaches, region, island, locale) => {
  if (!SHELTERED_SWITCH_REGIONS.has(region?.id)) return content;
  const language = locale.language;
  if (language !== 'gr' && language !== 'en') return content;
  const gr = language === 'gr';
  // `beaches` arrives sorted by popularity, so the examples pulled off each group
  // are the ones a reader is most likely to have heard of.
  const groups = new Map();
  for (const beach of beaches) {
    const face = (beach.orientation?.faces || [])[0];
    if (!face || !DIRECTION_WORD[language][face]) continue;
    if (!groups.has(face)) groups.set(face, []);
    groups.get(face).push(beach);
  }
  // Fewer than two groups means there is nothing to switch between, and the
  // heading would be asking a question the page cannot answer.
  const ordered = [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (ordered.length < 2) return content;
  const top = ordered.slice(0, 3);
  const links = [];
  const phrases = top.map(([face, list]) => {
    const examples = list.slice(0, SHELTERED_SWITCH_EXAMPLES);
    for (const beach of examples) {
      links.push({
        href: localizedPath(beachPath(region, island, beach), locale),
        label: displayName(beach.name, `Beach ${beach.id}`, language),
      });
    }
    const names = examples.map(beach => displayName(beach.name, `Beach ${beach.id}`, language)).join(', ');
    const word = DIRECTION_WORD[language][face];
    return gr
      ? `${list.length} κοιτάνε ${word} (${names})`
      : `${list.length} face ${word} (${names})`;
  });
  const atoms = LOCAL_WIND_ATOMS[getRegionWindContext(region.id)];
  const regime = atoms.word[language] || atoms.word.en;
  const regimeDir = atoms.dir[language] || atoms.dir.en;
  // The named swap, when a close enough pair exists. Greek names are introduced
  // as «η παραλία X» so the sentence declines correctly whatever the name is.
  const swapPairs = meltemiSwapPairs(beaches, island);
  const swapSentence = pair => {
    const from = displayName(pair.from.name, `Beach ${pair.from.id}`, language);
    const to = displayName(pair.to.name, `Beach ${pair.to.id}`, language);
    const face = DIRECTION_WORD[language][(pair.to.orientation?.faces || [])[0]];
    return gr
      ? `η παραλία ${from} έχει ανοιχτό νερό προς ${regimeDir} και πιάνει από τις πρώτες κύμα όταν φυσά ${regime}, ενώ η παραλία ${to}, ${pair.km} χλμ πιο πέρα, κοιτάει ${face} και με βάση τον προσανατολισμό της μένει συχνά πιο ήσυχη`
      : `${from} takes open water toward ${regimeDir}, so it is among the first here to pick up chop in the ${regime}, while ${to}, ${pair.km} km away and facing ${face}, is oriented away from it and is usually the more comfortable call`;
  };
  // The reasoning is spelled out once, on the first pair. Any further pair is
  // named as a bare swap — repeating the same clause per pair is the template
  // shape this project avoids, and it buries the one line that carries meaning.
  const swapShort = pair => {
    const from = displayName(pair.from.name, `Beach ${pair.from.id}`, language);
    const to = displayName(pair.to.name, `Beach ${pair.to.id}`, language);
    const face = DIRECTION_WORD[language][(pair.to.orientation?.faces || [])[0]];
    return gr
      ? `${from} → ${to} (${pair.km} χλμ, κοιτάει ${face})`
      : `${from} → ${to} (${pair.km} km, facing ${face})`;
  };
  const swapSection = swapPairs.length === 0 ? null : (() => {
    const firstFrom = displayName(swapPairs[0].from.name, `Beach ${swapPairs[0].from.id}`, language);
    const lead = swapSentence(swapPairs[0]);
    const rest = swapPairs.slice(1).map(swapShort);
    const restLine = rest.length
      ? (gr ? ` Το ίδιο ζευγάρωμα ισχύει και αλλού: ${rest.join('· ')}.` : ` The same swap works elsewhere: ${rest.join('; ')}.`)
      : '';
    const swapLinks = swapPairs.flatMap(pair => [pair.to, pair.from].map(beach => ({
      href: localizedPath(beachPath(region, island, beach), locale),
      label: displayName(beach.name, `Beach ${beach.id}`, language),
    })));
    return gr
      ? {
        heading: `Έχει αέρα στην παραλία ${firstFrom} — πού να πάω αντ' αυτής;`,
        body: `Δες την πρόγνωση μόλις ξυπνήσεις και διάλεξε κόλπο που γυρίζει την πλάτη στον άνεμο που όντως φυσάει. Στο δικό μας μοντέλο έκθεσης, ${lead}.${restLine} Ο προσανατολισμός είναι ισχυρή ένδειξη, όχι υπόσχεση — σύγκρινε ζωντανά άνεμο και κύμα και στις δύο σελίδες πριν πας.`,
        links: swapLinks,
      }
      : {
        heading: `If ${firstFrom} is too windy, where do I go instead?`,
        body: `Check the forecast when you wake up, then pick a bay that turns its back on the wind that is actually blowing. In our exposure model ${lead}.${restLine} Orientation is a strong signal, not a promise — compare live wind and waves on both beach pages before you go.`,
        links: swapLinks,
      };
  })();
  const section = gr
    ? {
      heading: 'Κι αν γυρίσει ο άνεμος;',
      body: `Η λίστα είναι φτιαγμένη για έναν άνεμο — ${regime} από ${regimeDir}. Οι παραλίες της όμως δεν κοιτάνε όλες την ίδια μεριά: ${phrases.join('· ')}. Τις μέρες που ο αέρας έρχεται από αλλού, αυτό είναι που αλλάζει την απόφαση: διάλεξε ομάδα που γυρίζει την πλάτη της εκεί απ' όπου φυσάει, με βάση τον προσανατολισμό της. Δες άνεμο και κύμα στη σελίδα κάθε παραλίας πριν πας.`,
      links,
    }
    : {
      heading: 'And if the wind turns?',
      body: `This list is built for one wind — the ${regime} from ${regimeDir}. But the beaches on it do not all look the same way: ${phrases.join('; ')}. On days the air arrives from somewhere else, that is what changes the decision: pick a group whose bays turn their back on the direction it is actually coming from, based on their orientation. Check wind and waves on each beach page before you go.`,
      links,
    };
  // Swap first when we have one: it answers the question in the words people
  // actually ask it, and the orientation split reads as the follow-up.
  const sections = swapSection ? [swapSection, section] : [section];
  return { ...content, sections: [...sections, ...content.sections] };
};

// A card that leads with a photograph where we have one. Where we don't, a
// tinted panel carrying the beach type — never an empty or broken frame.
const renderBeachCard = (beach, island, region, locale, intentKey = null) => {
  const language = locale.language;
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const blurb = intentBeachBlurbText(region, beach, language);
  const photo = beachCardPhoto(beach, language);
  const type = readableBeachType(beach, language);
  const access = readableAccess(beach, language);
  const isHard = beach.staticLabels?.accessType === 'BOAT_ONLY' || beach.accessibility === 'difficult';

  // No photo: draw the beach's own shoreline from the shipped coastline geometry
  // — a real, specific picture instead of a stock panel, and no extra request
  // because it is inlined. Coverage is 92.9%, so the wave-motif panel stays for
  // beaches with no shape: a deliberate placeholder, never a failed image. The
  // beach type is NOT repeated in either — the tag directly below carries it.
  const figure = photo
    ? `<figure class="cb-fig"><img src="${escapeHtml(photo.src)}" srcset="${escapeHtml(photo.src)} 1x, ${escapeHtml(photo.src2x)} 2x" alt="${escapeHtml(beachName)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" width="400" height="300">${photo.creditLabel ? `<figcaption class="cb-fig-credit">${escapeHtml(photo.creditLabel)}</figcaption>` : ''}</figure>`
    : renderShorelineFigure(beach, region, beachName, language)
      || `<div class="cb-fig cb-fig-none" aria-hidden="true"><svg viewBox="0 0 120 40" preserveAspectRatio="none" focusable="false"><path d="M0 26c15 0 15-8 30-8s15 8 30 8 15-8 30-8 15 8 30 8v14H0z"/></svg></div>`;

  // The wind tag is skipped on the sheltered guide, where every beach on the
  // page carries it and it would degrade into wallpaper.
  const windTag = intentKey === 'sheltered' ? null : windShelterTag(beach, language);
  // The seabed tag exists to make the stated order verifiable. Without it the
  // page claimed "rockier seabeds first" while its top card read "Pebbles" —
  // the beach TYPE is what the coast is made of, the terrain list is what is
  // under the water, and only the second one is the reason it is ranked here.
  const seabedTag = intentKey === 'snorkeling' ? snorkelSeabedTag(beach, language) : null;
  const tags = [
    type ? `<li class="cb-tag">${escapeHtml(type)}</li>` : '',
    seabedTag ? `<li class="cb-tag cb-tag-seabed">${escapeHtml(seabedTag)}</li>` : '',
    access ? `<li class="cb-tag${isHard ? ' cb-tag-warn' : ''}">${escapeHtml(access)}</li>` : '',
    windTag ? `<li class="cb-tag cb-tag-wind">${escapeHtml(windTag)}</li>` : '',
  ].filter(Boolean).join('');

  return `
            <li class="cb-card">
              ${figure}
              <div class="cb-card-body">
                <a class="cb-card-name" href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}">${escapeHtml(beachName)}</a>
                ${tags ? `<ul class="cb-tags">${tags}</ul>` : ''}
                ${blurb ? `<p class="cb-blurb">${escapeHtml(blurb)}</p>` : ''}
              </div>
            </li>`;
};

const staticIslandIntentFallback = (content, island, region, beaches, canonicalUrl, locale, intent, hero) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const chrome = getArticleChrome(language);
  const islandName = displayName(island.name, region.id, language);
  const homeHref = homePathForLocale(locale);
  const regionHref = localizedPath(regionPath(region, island), locale);
  const sep = '<span> › </span>';
  const eyebrow = intentNavLabel(intent?.key, region.id, language);
  const body = String(content.intro).split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  // The hero deck is the meta description, not the first intro paragraph: it is
  // already written as a standalone one-line summary, so the hero and the
  // article body never say the same sentence twice.
  const deck = content.description;
  const stats = heroStatsFor(beaches, language);
  // Ordering. The comment that used to sit here said the upstream sort was "a
  // deterministic hash of the beach id, so there is no meaningful ranking being
  // disturbed" — and on that basis reordered the whole grid to put photographs
  // first. That justification expired: `popularityScore` was fixed to a
  // log-scaled Google Places review count (buildBeachRegionData.mjs:145), so the
  // upstream order IS meaningful now, and photo-first was silently overwriting
  // it. A page titled "the best beaches for snorkeling" owes the reader a real
  // reason for the order. Photo presence survives only as the last tiebreak.
  const ordered = rankIntentBeaches(beaches, intent?.key);
  const beachItems = ordered.map(beach => renderBeachCard(beach, island, region, locale, intent?.key)).join('');
  const rationale = orderRationale(intent?.key, language);
  // `hero` is either the region's own background, or a photo of a beach this
  // article lists, or null — in which case the hero runs on its CSS gradient.
  // Never another region's scenery passed off as this one's.
  const heroAlt = hero?.beach
    ? displayName(hero.beach.name, `Beach ${hero.beach.id}`, language)
    : `${content.h1} — CalmBeach`;
  const heroImage = renderHeroPicture(hero, heroAlt);

  return `
    <div id="root">
      <main data-static-fallback>
        <div class="cb-wrap">
          <div class="cb-bar">
            <a class="cb-logo" href="${escapeHtml(homeHref)}"><img src="/calmbeach-mark.svg" alt="" width="30" height="30">${escapeHtml(copy.brand)}</a>
            <a class="cb-openapp" href="${escapeHtml(regionHref)}">${escapeHtml(copy.regionHeading(islandName))}</a>
          </div>

          <header class="cb-hero">
            ${heroImage}
            <div class="cb-hero-body">
              <nav class="cb-crumb" aria-label="breadcrumb">
                <a href="${escapeHtml(homeHref)}">${escapeHtml(copy.home)}</a>${sep}<a href="${escapeHtml(regionHref)}">${escapeHtml(copy.regionHeading(islandName))}</a>
              </nav>
              ${eyebrow ? `<p class="cb-eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
              <h1 class="cb-h1">${escapeHtml(content.h1)}</h1>
              ${deck ? `<p class="cb-hero-sub">${escapeHtml(deck)}</p>` : ''}
              ${stats ? `<ul class="cb-stats">${stats}</ul>` : ''}
            </div>
          </header>

          ${body.length > 0 ? `<div class="cb-prose">${body.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''}

          ${beachItems ? `
          <div class="cb-rule"><h2>${escapeHtml(chrome.listHeading)}</h2></div>
          ${rationale ? `<p class="cb-order-note">${escapeHtml(rationale)}</p>` : ''}
          <ul class="cb-grid">${beachItems}</ul>
          ${renderPhotoCredits(ordered, language, chrome, hero?.beach ? hero : null)}` : ''}

          <div class="cb-rule"><h2>${escapeHtml(chrome.faqHeading)}</h2></div>
          <div class="cb-qa">
            ${content.sections.map(section => `
              <section class="cb-qa-item">
                <h2>${escapeHtml(section.heading)}</h2>
                <p>${escapeHtml(section.body)}</p>
                ${Array.isArray(section.links) && section.links.length > 0
                  ? `<p class="cb-qa-links">${section.links.map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join(' · ')}</p>`
                  : ''}
              </section>`).join('')}
          </div>

          <div class="cb-cta">
            <p>${escapeHtml(chrome.ctaLead)}</p>
            <a href="${escapeHtml(regionHref)}">${escapeHtml(chrome.ctaButton)} →</a>
          </div>

          ${renderIslandGuides(island, region, locale, intent?.key, pickLang(language, {
            en: `More ${islandName} beach guides`,
            gr: `Άλλοι οδηγοί παραλιών — ${islandName}`,
            de: `Weitere ${islandName} Strandführer`,
            fr: `Autres guides plages — ${islandName}`,
            it: `Altre guide spiagge — ${islandName}`,
          }))}
          <p class="cb-note" data-nosnippet="true"><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(copy.viewRegion(islandName))}</a></p>
          ${renderArticleLegalStrip(intent?.key, locale)}
        </div>
      </main>
    </div>
  `;
};

const buildIslandIntentPage = (baseHtml, intent, content, island, region, beaches, imageUrl, locale, emittedLocales = baseLocales, hero = null) => {
  const pathName = islandIntentPath(intent, region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = displayName(island.name, region.id, language);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: content.h1,
      description: content.description,
      url: canonicalUrl,
      image: imageUrl,
      inLanguage: locale.htmlLang,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: beaches.length,
        itemListElement: beaches.map((beach, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: displayName(beach.name, `Beach ${beach.id}`, language),
          description: intentBeachBlurbText(region, beach, language) || undefined,
          url: canonicalUrlFor(beachPath(region, island, beach), locale),
        })),
      },
    },
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: `${islandName} beaches`, url: canonicalUrlFor(regionPath(region, island), locale) },
      { name: content.h1, url: canonicalUrl },
    ]),
    faqJsonLd(content.sections.map(section => ({ q: section.heading, a: section.body }))),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: fitIntentTitle(content.title, locale.language),
    description: content.description,
    canonicalUrl,
    imageUrl,
    imageAlt: content.h1,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return stripClientScripts(htmlWithHead).replace(/<div id="root">\s*<\/div>/i, staticIslandIntentFallback(content, island, region, beaches, canonicalUrl, locale, intent, hero));
};

const buildBeachPage = (baseHtml, island, beach, region, imageUrl, locale = prerenderLocales[0], emittedLocales = baseLocales) => {
  const pathName = beachPath(region, island, beach);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const islandName = displayName(island.name, region.id, language);
  const description = beachMetaDescription(beach, region, beachName, islandName, language);
  const title = beachTitleFor(beachName, islandName, language);
  const beachPageName = localizedBeachLabel(beachName, language);
  const beachRegionPageName = `${islandName} beaches`;
  // When a curated editorial story exists, expose its full text as the
  // schema.org disambiguatingDescription so the entity carries the rich,
  // unique narrative (the short `description` stays snippet-length).
  const story = getBeachStory(region, beach, language);
  const safeStoryParagraphs = story?.paragraphs?.filter(paragraph => !hasUnsupportedStaticConditionCopy(paragraph)) || [];
  const pageJsonLd = {
    '@context': 'https://schema.org',
    // schema.org/Beach is the precise type; TouristAttraction is kept for
    // consumers that already read it. Neither yields a SERP rich result — the
    // value is entity disambiguation (Knowledge Graph / AI answers / Maps).
    '@type': ['Beach', 'TouristAttraction'],
    name: beachAttractionName(beachName, language),
    description,
    disambiguatingDescription: safeStoryParagraphs.length ? safeStoryParagraphs.join(' ') : undefined,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GR',
      addressRegion: islandName,
    },
    geo: beach.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: beach.coordinates.lat,
      longitude: beach.coordinates.lon,
    } : undefined,
  };
  const jsonLd = [
    pageJsonLd,
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: beachRegionPageName, url: canonicalUrlFor(regionPath(region, island), locale) },
      { name: beachPageName, url: canonicalUrl },
    ]),
  ];
  // FAQPage joined the beach page on 06/08/2026, and only because the same pairs are
  // now RENDERED visibly by renderBeachFaq in the static fallback (h3 question +
  // p answer) — the condition the previous note was protecting. Same builder, same
  // order, so the markup describes exactly what a visitor reads. If the visible
  // section is ever removed, this must go with it.
  const faqPairs = buildBeachFaqPairs(beach, island, region, language);
  if (faqPairs.length) jsonLd.push(faqJsonLd(faqPairs));

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: beachImageAltFor(beachName, islandName, language),
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticBeachFallback(beach, island, region, canonicalUrl, locale));
};

const sitemapEntry = (url, imageUrl, lastmod) => ({ url, imageUrl, lastmod });

const renderSitemapEntry = (entry, fallbackLastmod) => {
  const imageTag = entry.imageUrl
    ? `<image:image><image:loc>${escapeXml(entry.imageUrl)}</image:loc></image:image>`
    : '';

  return `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastmod || fallbackLastmod}</lastmod>${imageTag}</url>`;
};

const main = async () => {
  const [baseHtml, beachIndex, publicAssets] = await Promise.all([
    readFile(indexHtmlPath, 'utf8'),
    readJson(beachIndexPath),
    listRootPublicAssets(),
  ]);

  const homeOgImageUrl = toAbsolutePublicUrl(publicAssets.has(homeOgImagePath) ? homeOgImagePath : defaultOgImagePath);
  const homeSitemapImageUrl = toSitemapImageUrl(homeOgImageUrl, publicAssets);
  const sitemapEntries = [];
  const redirects = [];
  let pageCount = 0;
  let regionPageCount = 0;
  let landingPageCount = 0;
  let islandIntentPageCount = 0;

  // Home stays national (en + el). Adding /de//fr//it/ home pages would require
  // their guide links (en/el only) to resolve; keep the multilingual cluster
  // scoped to the pilot region instead.
  // Resolved from the index alone (region.name carries the English label the slug
  // is built from), so this needs none of the per-region app payloads and can run
  // before that loop.
  const homeRegions = HOME_REGION_IDS
    .map(id => (beachIndex.regions || []).find(region => region.id === id))
    .filter(Boolean);
  if (homeRegions.length !== HOME_REGION_IDS.length) {
    console.warn(`[home] ${HOME_REGION_IDS.length - homeRegions.length} home region id(s) not found in the beach index — check HOME_REGION_IDS.`);
  }

  for (const locale of baseLocales) {
    const homeRoutePath = localizedPath('/', locale);
    const homeOutputDir = outputDirForRoute(homeRoutePath);
    const regionLinks = homeRegions.map(region => ({
      href: localizedPath(regionPath(region, null), locale),
      label: displayName(region.name, region.id, locale.language),
    }));
    await mkdir(homeOutputDir, { recursive: true });
    await writeFile(path.join(homeOutputDir, 'index.html'), withStaticFooter(buildHomePage(baseHtml, locale, homeOgImageUrl, baseLocales, regionLinks), locale), 'utf8');
    sitemapEntries.push(sitemapEntry(canonicalUrlFor('/', locale), homeSitemapImageUrl));
  }

  // Consolidation 301s for the retired generic landing pages.
  for (const redirect of landingRedirects) {
    for (const locale of baseLocales) {
      const from = localizedPath(redirect.from, locale);
      const to = localizedPath(redirect.to, locale);
      redirects.push(`${from} ${to} 301`);
      redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
    }
  }

  // Pre-pass: aggregate beaches across all regions for the data-driven guide
  // pages. Read the full app payload (a superset of the summary) because
  // `campsites` lives only there; region/beach page generation below stays on
  // the summary tier unchanged.
  const categoryBuckets = { accessible: [], family: [], camping: [] };
  const hubRegions = [];
  const topBeaches = [];
  const islandIntentPages = [];
  let islandIntentBelowMin = 0;
  for (const region of beachIndex.regions || []) {
    let appPayload;
    try {
      appPayload = await readJson(toPublicFilePath(region.appDataPath || `/data/beaches/app/${region.id}.json`));
    } catch {
      continue;
    }

    const island = appPayload.island;
    if (!island?.id || !Array.isArray(island.beaches)) continue;

    hubRegions.push({ region, island, path: regionPath(region, island) });

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;
      const entry = { beach, region, island };
      topBeaches.push(entry);
      if (beach.environment?.familyFriendly === true) categoryBuckets.family.push(entry);
      // Mirror hasDisabledAccess in services/recommendationService.ts: seatrac may
      // sit on the beach or under metadata, and only an online unit qualifies
      // (wrong info can strand a wheelchair user).
      const seatrac = getBeachSeatrac(beach);
      if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') categoryBuckets.accessible.push(entry);
      if (Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) categoryBuckets.camping.push(entry);
    }

    // Per-island intent guides: only emit when the island clears the minimum so
    // we never publish near-empty doorway pages.
    const validBeaches = island.beaches.filter(beach => Number.isInteger(beach.id) && beach.name);
    // 'sheltered' uses the baked, curated-aware `shelteredFromLocalWind` flag (one
    // source), so it lists only genuinely sheltered beaches for the region's regime.
    for (const intent of islandIntents) {
      // Same predicate `getIslandGuides` uses, so "this guide gets built" and
      // "the region page links this guide" can never diverge again.
      const matchedAll = validBeaches.filter(intentPredicateFor(intent));
      const matches = matchedAll
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, ISLAND_INTENT_CAP);
      // Proportional gate for 'sheltered': a small island where >=25% of beaches are
      // sheltered is useful, not a failure (e.g. Santorini 4/13).
      const minForIntent = intentMinFor(intent.key);
      const passes = intent.key === 'sheltered'
        ? (matchedAll.length >= minForIntent || (validBeaches.length > 0 && matchedAll.length / validBeaches.length >= 0.25))
        : matches.length >= minForIntent;
      if (passes && matches.length > 0) {
        islandIntentPages.push({ intent, region, island, beaches: matches, shelteredCount: intent.key === 'sheltered' ? matchedAll.length : matches.length });
      } else if (matches.length > 0) {
        islandIntentBelowMin += 1;
      }
    }
  }

  // Rank each bucket by crowd popularity (proxy for notability), then cap.
  const LANDING_LIST_CAP = 24;
  for (const key of Object.keys(categoryBuckets)) {
    categoryBuckets[key].sort((a, b) => {
      const byPopularity = (b.beach.popularityScore ?? 0) - (a.beach.popularityScore ?? 0);
      if (byPopularity !== 0) return byPopularity;
      return localized(a.beach.name, '', 'en').localeCompare(localized(b.beach.name, '', 'en'));
    });
    categoryBuckets[key] = categoryBuckets[key].slice(0, LANDING_LIST_CAP);
  }

  // National most-popular beaches, for the best-beaches-greece-today hub.
  topBeaches.sort((a, b) => (b.beach.popularityScore ?? 0) - (a.beach.popularityScore ?? 0));
  const topNationalBeaches = topBeaches.slice(0, LANDING_LIST_CAP);

  for (const landing of seoLandingPages) {
    const dynamic = landing.kind === 'beachList'
      ? { items: categoryBuckets[landing.category] || [] }
      : landing.kind === 'regionHub'
        ? { hubRegions, topBeaches: landing.pathName === '/best-beaches-greece-today/' ? topNationalBeaches : [] }
        : {};

    for (const locale of prerenderLocales) {
      const content = landing.locales[locale.id];
      if (!content) continue;

      const landingOutputDir = outputDirForRoute(localizedPath(landing.pathName, locale));
      await mkdir(landingOutputDir, { recursive: true });
      await writeFile(path.join(landingOutputDir, 'index.html'), withStaticFooter(buildSeoLandingPage(baseHtml, landing, content, locale, homeOgImageUrl, dynamic), locale), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(landing.pathName, locale), homeSitemapImageUrl));
      landingPageCount += 1;
    }
  }

  // Programmatic per-island intent guides (gated above by ISLAND_INTENT_MIN).
  for (const page of islandIntentPages) {
    const intentHeroPath = resolveRegionOgImagePath(page.region, page.island, publicAssets);
    const intentOgImageUrl = toAbsolutePublicUrl(intentHeroPath);
    const intentSitemapImageUrl = toSitemapImageUrl(intentOgImageUrl, publicAssets);
    // og:image must stay .jpg for universal decoding, but the on-page hero can
    // take the .avif/.webp derivatives the build already emits (74/74 parity).
    // Where the region has no photo of its own, fall through to one of this
    // article's beaches rather than showing another island's coastline.
    const intentHero = heroIsRegionSpecific(intentHeroPath, page.region, page.island)
      ? heroSourcesFor(intentHeroPath, publicAssets)
      : heroFromBeaches(page.beaches);
    const pathName = islandIntentPath(page.intent, page.region, page.island);
    const emittedLocales = localesForRegion(page.region.id);
    const shelterGeo = page.intent.key === 'sheltered'
      ? computeShelterGeometry(page.region.id, await loadExposureProfiles(page.region.id))
      : null;
    for (const locale of emittedLocales) {
      const islandName = displayName(page.island.name, page.region.id, locale.language);
      const intentCount = page.intent.key === 'sheltered' ? (page.shelteredCount ?? page.beaches.length) : page.beaches.length;
      const localeCopy = page.intent.copy(islandName, intentCount, page.region.id);
      const baseContent = localeCopy[locale.language] || localeCopy.en;
      // Swap in the hand-written GR intro + H1 for targeted family pages; the
      // beach list and the family Q&A sections stay as generated.
      const familyOverride = page.intent.key === 'family' && locale.language === 'gr'
        ? FAMILY_INTRO_OVERRIDES[page.region.id]
        : null;
      // Computed geometry intro for the sheltered guide (gr/en; null → template).
      const shelteredIntro = page.intent.key === 'sheltered'
        ? buildShelteredGeometryIntro(page.region.id, shelterGeo, locale.language)
        : null;
      const contentBase = familyOverride
        ? { ...baseContent, h1: familyOverride.h1, intro: familyOverride.intro }
        : shelteredIntro
          ? { ...baseContent, intro: shelteredIntro }
          : baseContent;
      // Snorkeling guides open their Q&A with a paragraph that is computed from
      // THIS island's beaches — which of them face away from the Meltemi, by
      // name. It is the one thing on the page a template could not have written,
      // and the reason a three-beach guide is still worth publishing.
      const withWind = page.intent.key === 'snorkeling'
        ? withSnorkelingWindSection(contentBase, page.beaches, locale.language)
        : contentBase;
      // Rhodes-only computed shortlist (see SNORKELING_FIRST_PICKS_REGIONS) — goes first.
      const withPicks = page.intent.key === 'snorkeling'
        ? withSnorkelingFirstPicksSection(withWind, page.beaches, page.region, page.island, locale)
        : withWind;
      // Orientation-split shortlist for the sheltered guides that earned
      // impressions and no clicks (see SHELTERED_SWITCH_REGIONS) — goes first.
      const withSwitch = page.intent.key === 'sheltered'
        ? withShelteredSwitchSection(withPicks, page.beaches, page.region, page.island, locale)
        : withPicks;
      // Sub-area H2s for regions whose searchers name a part of the region (Evia).
      const withIntentSection = withSubareaSections(withSwitch, page.beaches, page.region, page.island, locale, page.intent.key);
      // "When is the sea calmest here?" — real per-month percentages from 10 years of
      // Copernicus reanalysis, appended to EVERY intent guide, not just the wind ones.
      // A family guide and a snorkeling guide get the same question from the same visitor
      // ("when should I come?"), and this is the only place on the site that answers it.
      // It also makes each of these pages carry a number no template could have written,
      // which is what separates a guide from a doorway page.
      const beachIds = page.beaches.map(beach => beach.id);
      const withSea = withSeaSeasonSection(
        withIntentSection,
        beachIds,
        waveClimatology,
        locale.language,
        page.region.id,
      );
      // "How warm is the water, month by month?" — the other half of "when should I come?".
      // Wave answers whether the sea is workable; temperature answers whether it is inviting,
      // and it carries the counter-intuitive fact that in much of Greece October beats June.
      const content = withWaterSeasonSection(
        withSea,
        beachIds,
        waterClimatology,
        locale.language,
      );
      const intentOutputDir = outputDirForRoute(localizedPath(pathName, locale));
      await mkdir(intentOutputDir, { recursive: true });
      await writeFile(path.join(intentOutputDir, 'index.html'), buildIslandIntentPage(baseHtml, page.intent, content, page.island, page.region, page.beaches, intentOgImageUrl, locale, emittedLocales, intentHero), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(pathName, locale), intentSitemapImageUrl));
      islandIntentPageCount += 1;
    }
  }
  const intentThresholdNote = [`≥${ISLAND_INTENT_MIN} beaches`, ...Object.entries(ISLAND_INTENT_MIN_BY_KEY).map(([key, min]) => `${key} ≥${min}`)].join(', ');
  console.log(`Island intent guides: ${islandIntentPages.length} published (${intentThresholdNote}), ${islandIntentBelowMin} island×intent combos skipped below threshold.`);

  // The single place every guide is collected. Emitted after the guides so it can
  // only ever link to pages that were actually written above.
  for (const locale of baseLocales) {
    const hubOutputDir = outputDirForRoute(localizedPath(GUIDES_HUB_PATH, locale));
    await mkdir(hubOutputDir, { recursive: true });
    await writeFile(path.join(hubOutputDir, 'index.html'), withStaticFooter(buildGuidesHubPage(baseHtml, islandIntentPages, locale, homeOgImageUrl, baseLocales), locale), 'utf8');
    sitemapEntries.push(sitemapEntry(canonicalUrlFor(GUIDES_HUB_PATH, locale), homeSitemapImageUrl));
    pageCount += 1;
  }
  console.log(`Guides hub: ${GUIDES_HUB_PATH} emitted for ${baseLocales.map(l => l.id).join(', ')} (${islandIntentPages.length} guide links).`);

  for (const region of beachIndex.regions || []) {
    const summaryPath = region.summaryDataPath || `/data/beaches/app/summary/${region.id}.json`;
    let payload;

    try {
      payload = await readJson(toPublicFilePath(summaryPath));
    } catch {
      payload = await readJson(toPublicFilePath(region.appDataPath || `/data/beaches/app/${region.id}.json`));
    }

    const island = payload.island;
    if (!island?.id || !Array.isArray(island.beaches)) continue;

    const regionOgImageUrl = toAbsolutePublicUrl(resolveRegionOgImagePath(region, island, publicAssets));
    const regionSitemapImageUrl = toSitemapImageUrl(regionOgImageUrl, publicAssets);
    // Per-page freshness: the region's data-generation date, not a single build
    // stamp for all 5.7k URLs. Falls back to the build date when absent.
    const regionLastmod = (payload.generatedAt || '').slice(0, 10) || undefined;
    const currentRegionPath = regionPath(region, island);
    const currentLegacyRegionPath = legacyRegionPath(region.id);
    if (currentLegacyRegionPath !== currentRegionPath) {
      redirects.push(`${currentLegacyRegionPath} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath.replace(/\/$/, '')} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath}* ${currentRegionPath}:splat 301`);
    }

    const regionShelteredCount = countShelteredBeaches(island.beaches);
    const emittedLocales = localesForRegion(region.id);
    for (const locale of emittedLocales) {
      const localizedRegionPath = localizedPath(currentRegionPath, locale);
      const regionOutputDir = outputDirForRoute(localizedRegionPath);
      await mkdir(regionOutputDir, { recursive: true });
      await writeFile(path.join(regionOutputDir, 'index.html'), withStaticFooter(buildRegionPage(baseHtml, island, region, regionOgImageUrl, locale, emittedLocales, regionShelteredCount), locale), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(currentRegionPath, locale), regionSitemapImageUrl, regionLastmod));
      regionPageCount += 1;
    }

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;

      const routePath = beachPath(region, island, beach);
      // A renamed slug must 301 in EVERY locale this beach was built in, not just
      // the bare English URL. localesForRegion is the exact set the pages above
      // were emitted in, so we never point at a page that was never generated.
      // Measured 21/08/2026: 8 of the 24 indexed-but-dead URLs were /el|de|fr|it/
      // variants of a rename whose English 301 was perfectly fine.
      for (const legacyPath of legacyBeachPaths(region, island, beach)) {
        for (const locale of localesForRegion(region.id)) {
          const from = localizedPath(legacyPath, locale);
          const to = localizedPath(routePath, locale);
          redirects.push(`${from} ${to} 301`);
          redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
        }
      }

      // This beach's own photo when it has one, otherwise the regional background.
      //
      // og:image only — the SITEMAP keeps the local image on purpose. Image sitemaps
      // are a claim about images the site hosts, and Google will not index images on
      // a domain we cannot verify in Search Console. We do not own
      // commons.wikimedia.org, so listing 1.025 Wikimedia URLs there would be a claim
      // we cannot back and would never pay off. The SEO audit refuses off-host
      // sitemap images for exactly this reason and caught the first attempt.
      //
      // og:image has no such rule: Facebook, WhatsApp and Slack fetch whatever URL
      // they are given, which is where the beach photo actually earns the tap.
      const beachOgUrl = beachOgImage(beach) || regionOgImageUrl;

      for (const locale of emittedLocales) {
        const localizedRoutePath = localizedPath(routePath, locale);
        const outputDir = outputDirForRoute(localizedRoutePath);
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, 'index.html'), withStaticFooter(buildBeachPage(baseHtml, island, beach, region, beachOgUrl, locale, emittedLocales), locale), 'utf8');
        sitemapEntries.push(sitemapEntry(canonicalUrlFor(routePath, locale), regionSitemapImageUrl, regionLastmod));
        pageCount += 1;
      }
    }
  }

  // ── The OAuth return page ──────────────────────────────────────────────────
  // Google redirects here after sign-in, so this URL must exist as a real file:
  // every route on this site is a prerendered directory and there is no SPA
  // catch-all, so an unemitted /auth/callback/ would be a 404 in the middle of
  // signing in.
  //
  // It is the built shell VERBATIM. It deliberately does not go through
  // buildX/withStaticFooter: those paths add head templating and, for some page
  // types, run stripClientScripts — which deletes the module scripts. On a page
  // whose entire job is to run JavaScript, that would hang the sign-in forever
  // with nothing in the console to explain it.
  //
  // Not in the sitemap, not linked from anywhere, noindex: it has no content, and
  // an indexed callback URL is only ever a way for someone to land mid-handshake.
  //
  // Two things ARE removed from the copy, and both matter:
  //   • the canonical — the shell's points at the homepage, and a second file
  //     claiming that URL collides with the real home page in every audit that
  //     keys pages by canonical (auditHreflangIntegrity.mjs builds exactly such a
  //     map, so the home page's hreflang cluster would silently disappear);
  //   • the JSON-LD — a WebSite/Organization block on a one-second redirect page
  //     is a duplicate entity, not structured data.
  const authCallbackDir = path.join(distDir, 'auth', 'callback');
  await mkdir(authCallbackDir, { recursive: true });
  const authCallbackHtml = baseHtml
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi, '')
    .replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow">');
  await writeFile(path.join(authCallbackDir, 'index.html'), authCallbackHtml, 'utf8');

  // ── <lastmod> THAT IS TRUE ───────────────────────────────────────────────
  //
  // What this replaced: every URL without an explicit lastmod got `new Date()`
  // — today, on every single build — and every beach/region page got its
  // REGION's `payload.generatedAt`, i.e. when the data file was last rebuilt,
  // shared by all ~30 beaches of that region. Neither has anything to do with
  // whether that page's content changed. Measured on the 16/08 sitemap: 9.536
  // URLs carried exactly TWO distinct dates — 8.407 said one day, 1.129 said
  // the next.
  //
  // Why it matters. 4 in 10 of our pages are not in Google's index at all
  // (URL Inspection, 16/08: 11/18 English beach pages indexed, 6/15 Italian;
  // "Discovered – currently not indexed" means Google saw the URL and did not
  // even fetch it). lastmod is the one lever we have for saying "spend your
  // crawl here, not there". A lastmod that claims 8.407 pages changed when none
  // did is noise, and Google is documented to ignore the signal entirely once
  // it stops correlating with real change. We were spending our only priority
  // signal on nothing.
  //
  // How it works now: a per-page fingerprint of what the page SAYS, kept in a
  // small committed ledger. Same fingerprint as last build → keep the old date.
  // Changed → today. A page that genuinely did not change now keeps a date that
  // recedes into the past, which is exactly what it should say.
  //
  // The fingerprint deliberately covers ONLY the meaningful surface: title, meta
  // description, canonical, JSON-LD and the visible text. It must NOT include
  // <script>/<link> tags — Vite renames every asset chunk whenever any code
  // changes, so hashing the raw HTML would mark all 9.536 pages as modified on
  // any code edit and put us straight back where we started. ISO timestamps and
  // dd/mm/yyyy dates are stripped for the same reason.
  const sitemapLedgerPath = path.join(projectRoot, 'data', 'sitemapLastmod.json');
  const previousLedger = await readJson(sitemapLedgerPath).catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);

  // The fingerprint itself lives in utils/sitemapFingerprint.mjs so the quality
  // gate (scripts/validateSitemapLastmod.mjs) can drive the REAL function rather
  // than a copy that drifts away from it. That file documents what the
  // fingerprint covers and — more importantly — what it must never cover.
  const contentFingerprint = sitemapContentFingerprint;

  /** dist file backing a canonical URL, or null for anything not on disk. */
  const distFileForUrl = (url) => {
    let pathname;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
    return path.join(distDir, pathname.replace(/^\/+/, '').replace(/\/+$/, ''), 'index.html');
  };

  // Bounded concurrency: 9.536 simultaneous reads exhausts file handles on
  // Windows, and unbounded Promise.all over the whole list is how that happens.
  const forEachLimited = async (items, limit, worker) => {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]);
      }
    });
    await Promise.all(runners);
  };

  // Ledger key is the PATH, not the absolute URL — same information, ~230 KB less
  // of it across 9.536 rows. Value is "<fingerprint>:<date>" rather than an object,
  // for the same reason.
  const ledgerKey = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };
  const readLedgerRow = (row) => {
    if (typeof row !== 'string') return null;
    const cut = row.lastIndexOf(':');
    return cut < 0 ? null : { h: row.slice(0, cut), d: row.slice(cut + 1) };
  };

  const ledger = {};
  let changedPages = 0;
  let unreadablePages = 0;
  await forEachLimited(sitemapEntries, 24, async (entry) => {
    const key = ledgerKey(entry.url);
    const known = readLedgerRow(previousLedger[key]);
    const file = distFileForUrl(entry.url);
    let html = null;
    if (file) html = await readFile(file, 'utf8').catch(() => null);
    if (html === null) {
      // Never invent a date for a page we could not read: fall back to whatever
      // the ledger already knew, and only then to today. Silently stamping today
      // would re-create the bug for exactly the pages we cannot verify.
      unreadablePages += 1;
      const date = known ? known.d : today;
      ledger[key] = `${known ? known.h : ''}:${date}`;
      entry.lastmod = date;
      return;
    }
    const fingerprint = contentFingerprint(html);
    const date = known && known.h === fingerprint ? known.d : today;
    if (!known || known.h !== fingerprint) changedPages += 1;
    ledger[key] = `${fingerprint}:${date}`;
    entry.lastmod = date;
  });

  // One row per line, keys sorted: a build that changes twelve pages must produce
  // a twelve-line diff, not a 800 KB single-line blob that git cannot delta. The
  // file is committed on purpose — see the note in docs/team/10-seo-specialist.md:
  // Netlify builds from a clean checkout, so an uncommitted ledger means every
  // deploy re-stamps every page with today's date, which is the bug this fixes.
  const ledgerRows = Object.keys(ledger)
    .sort()
    .map(key => `${JSON.stringify(key)}:${JSON.stringify(ledger[key])}`);
  await writeFile(sitemapLedgerPath, `{\n${ledgerRows.join(',\n')}\n}\n`, 'utf8');
  const dateSpread = new Set(Object.values(ledger).map(v => v.d)).size;
  console.log(
    `sitemap lastmod: ${changedPages} of ${sitemapEntries.length} pages changed content` +
      ` (${dateSpread} distinct dates${unreadablePages ? `, ${unreadablePages} unreadable` : ''})`
  );

  const lastmod = today;
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...sitemapEntries.map(entry => renderSitemapEntry(entry, lastmod)),
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

  // -------------------------------------------------------------------------
  // Safety net for URLs Google still holds. Appended LAST on purpose.
  //
  // Two Netlify behaviours make this safe, both read in the official docs on
  // 21/08/2026 rather than remembered:
  //   - the engine applies the FIRST matching rule, so every precise 301 above
  //     still wins;
  //   - a non-forced rule is skipped when a real file exists at the path, so a
  //     published page is never shadowed by the pattern that covers its
  //     retired siblings.
  // A ":placeholder" matches exactly one path segment, which is why neither
  // /sunset-beaches/ nor /beaches/{region}/ is caught here.
  //
  // Written because the 21/08 audit found 24 ranking URLs returning a bare 404.
  // See docs/team/10-seo-specialist.md (21/08) and scripts/auditIndexedUrlsResolve.mjs.
  // -------------------------------------------------------------------------
  for (const intent of islandIntents) {
    for (const locale of prerenderLocales) {
      // A guide that stops clearing its gate for a region — the 200-340° sunset
      // rule cost Patmos, Lipsi, Telendos and Lasithi their page, 145 impressions
      // — lands on the region page: same beaches, natural parent.
      const from = localizedPath(`${intent.pathPrefix}/:slug/`, locale);
      const to = localizedPath('/beaches/:slug/', locale);
      redirects.push(`${from} ${to} 301`);
      redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
    }
  }
  for (const locale of prerenderLocales) {
    // A beach that is gone from the dataset entirely — deleted, merged, or moved
    // to another region — has no legacy slug recorded anywhere, so nothing above
    // can catch it. 9 of the 24 dead URLs were exactly this. The region page is
    // the honest answer: the beach they wanted is not there any more, but its
    // neighbours are.
    const from = localizedPath('/beaches/:region/:beach/', locale);
    const to = localizedPath('/beaches/:region/', locale);
    redirects.push(`${from} ${to} 301`);
    redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
  }

  // Every rule above is pushed twice, once with a trailing slash and once without.
  // That was belt and braces, and the braces are not load-bearing: the official
  // Netlify docs state that it "will match paths to rules regardless of whether or
  // not they contain a trailing slash" (read 21/08/2026). Dropping the duplicate
  // halves the file with no change in behaviour.
  //
  // Deduped on the PAIR, never on the source alone: two rules sharing a source but
  // disagreeing on the target are a real conflict, and both must reach the file so
  // the first-match rule decides. Swallowing one here would hide the bug instead.
  // Splat rules are left untouched — a trailing * is not a trailing slash.
  const beforeDedupe = redirects.length;
  const seenRedirects = new Set();
  for (let i = 0; i < redirects.length; i += 1) {
    const [from, to] = redirects[i].split(' ');
    if (!from || from.endsWith('*')) continue;
    const key = `${from.endsWith('/') ? from.slice(0, -1) : from} ${to}`;
    if (seenRedirects.has(key)) {
      redirects.splice(i, 1);
      i -= 1;
      continue;
    }
    seenRedirects.add(key);
  }

  if (redirects.length > 0) {
    await writeFile(path.join(distDir, '_redirects'), `${redirects.join('\n')}\n`, 'utf8');
  }
  console.log(`Prerendered ${baseLocales.length} home pages, ${landingPageCount} SEO landing pages, ${islandIntentPageCount} island intent pages, ${regionPageCount} region pages, ${pageCount} beach pages, the /auth/callback/ shell, ${redirects.length} redirects (${beforeDedupe - redirects.length} duplicate slash-variants dropped) and sitemap.xml`);
};

main().catch(error => {
  console.error('Failed to prerender beach pages.', error);
  process.exitCode = 1;
});

// The consent-free, first-party action counter. One-way import: pageviewBeacon
// never imports back from here, so there is no module cycle across Vite chunks.
import { recordAction } from './pageviewBeacon';

// ─────────────────────────────────────────────────────────────────────────────
// THE SUCCESS METRIC — `navigation_clicked`.
//
// Decided 30/07/2026. Of the 40 events below, this is the ONE that means the site
// did its job: the visitor picked a beach and opened directions to drive there.
// Everything else measures interest — this measures a decision. The stated goal is
// "the No.1 site for where to swim in Greece today", and a swim starts with
// someone actually going.
//
// Until this was written down, none of the 40 events was marked as a conversion in
// GA4, so every product change (planner, filters, a new feature) was judged by eye.
// `beach_detail_opened` was the obvious alternative and was rejected: it is far
// more frequent and also means "opened it and left".
//
// ⚠️ The GA4 side is a setting, not code — mark `navigation_clicked` as a key event
// in the GA4 UI. This comment exists so the choice is not silently re-litigated,
// and so nobody renames or removes the event without knowing what it carries.
// ─────────────────────────────────────────────────────────────────────────────
export type AnalyticsEvent =
  | 'app_loaded'
  | 'page_view'
  | 'language_changed'
  | 'region_changed'
  | 'weather_fallback_shown'
  | 'weather_retry_clicked'
  | 'search_used'
  | 'filter_applied'
  | 'filters_cleared'
  | 'empty_results_shown'
  | 'beach_detail_opened'
  // THE conversion. See the block above before changing, renaming or removing it.
  | 'navigation_clicked'
  // Any click on a link that takes the visitor OFF calmbeach.gr — photo credit
  // sources, weather-provider attribution, legal-document external refs, and
  // (once they exist) accommodation/affiliate links. A document-level delegated
  // listener fires this for every outbound <a>, so a future affiliate link is
  // measured automatically without wiring a new trackEvent call at the link
  // site. Deliberately separate from `navigation_clicked` (Google/Apple Maps),
  // which fires via window.open(), not a real <a> — no double-counting.
  | 'outbound_link_clicked'
  | 'favorite_clicked'
  | 'share_clicked'
  | 'recommendation_feedback_positive'
  | 'recommendation_feedback_negative'
  | 'forecast_day_selected'
  | 'forecast_expanded'
  | 'map_viewed'
  | 'map_marker_clicked'
  | 'map_sea_motion_play'
  // Το ημερολόγιο δουλειάς της landing: άνοιξε το «όλα τα νέα», πάτησε σύνδεσμο περιοχής,
  // ή ήρθε από τη γραμμή «Τελευταία βελτίωση» του footer.
  | 'landing_worklog_expanded'
  | 'landing_worklog_link_clicked'
  | 'footer_latest_work_clicked'
  // Street map vs satellite imagery. Tells us whether the aerial view is a niche
  // toggle or the one people actually want to land on.
  | 'map_basemap_toggle'
  // The in-page shortcuts that sit under today's answer on a beach page. Carries
  // `target` ('story' | 'nearby') so the two are judged separately rather than as
  // one number — they solve different problems and only one of them may be worth
  // keeping. They exist because the page is ~6 phone screens and we have NEVER
  // measured scroll depth on it, so this event is the whole point of shipping
  // them: if they go untapped, the honest reading is that the length is not what
  // costs us, and the chips come out again. Same discipline the trip planner's
  // unanswered "how many days?" bought the hard way.
  | 'beach_jump_clicked'
  // "Something else wrong on this page?" — the correction route for the beach dataset,
  // separate from the forecast-accuracy widget because it reports a wrong FACT (amenity,
  // access, a beach that is not there) rather than a wrong forecast, and it survives the
  // showConditions gate that hides that widget. It is a mailto, so this event is the only
  // way to know it is used at all: the click is measurable, the send is not.
  | 'beach_report_problem_clicked'
  // Core Web Vitals from real visitors (utils/webVitals.ts). Carries `metric`
  // (LCP | INP | CLS), `value` and Google's own `rating` bucket, so the answer to
  // "is it fast on a phone" is read as p75 by device rather than as an average.
  | 'web_vital'
  | 'beta_feedback_clicked'
  // National landing (components/landing/). `landing_viewed` is the denominator
  // for every drop-off question — without it the landing's reach is invisible,
  // since a landing view and a region home are both view==='home'.
  | 'landing_viewed'
  | 'landing_near_me_clicked'
  | 'landing_region_clicked'
  | 'landing_all_regions_clicked'
  // The way out of the landing and into the 381 guide articles. Carries `guide`
  // ("family:evia", or "hub" for the all-guides link) so the six curated pairs
  // can be judged against each other rather than as one number — the point of
  // measuring them is to find out which QUESTION people arrive with, which is
  // the only thing that says what the next article should be about.
  | 'landing_guide_clicked'
  | 'landing_contact_clicked'
  // The story section, measured with two sentinels rather than one observer on
  // the section itself: the section is taller than a phone viewport, so a
  // ratio-based observer could never fire. `_viewed` (heading in view) is the
  // denominator, `_read` (signature line in view) is an honest read-through.
  | 'landing_story_viewed'
  | 'landing_story_read'
  | 'landing_feedback_submitted'
  | 'landing_feedback_failed'
  // The newsletter — the landing's only way of asking a visitor to come back.
  // `_viewed` is the denominator (it sits at the very bottom of a long page, so
  // the interesting number is what share of people even reach it), `_submitted`
  // fires only on a real 2xx, and `_failed` exists so a broken endpoint shows up
  // as a shape in the data instead of as silence that looks like disinterest.
  | 'landing_newsletter_viewed'
  | 'landing_newsletter_submitted'
  | 'landing_newsletter_failed'
  // The photo-contribution funnel, which only exists because accounts do. It is
  // measured end to end on purpose: the whole point of accounts is whether they
  // produce photos, and every step below is a place that can silently swallow
  // the intent.
  //   landing_photos_viewed   — the announcement was actually seen (denominator)
  //   landing_photos_cta_clicked / photo_sheet_sign_in_clicked — intent
  //   photo_sheet_opened      — the form was reached
  //   photo_prepare_failed    — their file could not be turned into an upload
  //   photo_upload_failed / _succeeded — the end of the funnel
  // `signed_in` on the first two separates "wants to contribute" from "already
  // has an account", which are different populations with different drop-off.
  | 'landing_photos_viewed'
  | 'landing_photos_cta_clicked'
  | 'photo_sheet_opened'
  | 'photo_sheet_sign_in_clicked'
  | 'photo_prepare_failed'
  | 'photo_upload_failed'
  | 'photo_upload_succeeded'
  // Multi-day trip planner (components/planner/). `days` tells us how long a
  // stay we answered for, and `source` separates the three audiences —
  // 'auto' (we planned the next 3 days unasked — an IMPRESSION), 'search_intent'
  // (they typed «Νάξο 5 μέρες»), 'chip' (they changed the day count).
  // NOTE since 28/07/2026: with auto-planning this fires for nearly everyone who
  // scrolls to the card, so on its own it is a denominator, NOT evidence of
  // interest. Read it against trip_plan_beach_opened.
  | 'trip_planned'
  // The planner's real success metric: a visitor tapping a beach OUT of the
  // plan. This is the one that says the multi-day answer was worth something —
  // trip_planned stopped being able to say that when the plan became automatic.
  | 'trip_plan_beach_opened'
  // A free-text search parsed as a trip sentence («θα μείνω Νάξο για 5 μέρες»).
  // Fired for EVERY outcome, including the failures, because the only way to
  // learn which sentences real visitors type — and which ones we cannot read —
  // is to count them. `matched` carries the verdict.
  | 'trip_query_parsed'
  | 'beach_viewed'
  | 'beach_navigated'
  | 'beach_favorited'
  | 'search_performed'
  | 'region_selected'
  | 'beach_search'
  | 'recommendations_viewed'
  | 'beach_card_clicked'
  | 'beach_details_opened'
  | 'map_opened'
  | 'filter_used'
  | 'ai_advisor_question'
  | 'photo_suggestion_clicked'
  | 'recommendation_feedback'
  | 'condition_feedback'
  // Two-dimensional "calm water / strong wind" cove card: did the user find it useful?
  // The revealed-preference signal for whether the hidden-calm coves are worth surfacing.
  | 'cove_conditions_feedback'
  | 'install_prompt_shown'
  | 'install_prompt_accepted'
  | 'install_prompt_dismissed'
  | 'app_installed'
  // The "rate the app 1–10" card (components/AppRatingPrompt.tsx). shown/dismissed measure
  // whether the ask itself annoys people; submitted carries the two scores as metadata so
  // GA4 can average them without waiting for the Telegram archive.
  | 'app_rating_prompt_shown'
  | 'app_rating_prompt_dismissed'
  | 'app_rating_submitted'
  // One real Open-Meteo origin fetch (cache MISS only). The GA4 aggregate of these
  // ≈ our real calls/day and is the trigger signal for moving to a shared server cache.
  | 'open_meteo_fetch';

/** Which Open-Meteo endpoint a counted origin call hit. */
export type OpenMeteoEndpoint = 'current' | 'hourly' | 'marine' | 'over-water-wind';

export interface AnalyticsData {
  event: AnalyticsEvent;
  beachId?: number | string;
  timestamp: string;
  userLocation?: { lat: number; lon: number };
  metadata?: any;
}

export type ConditionFeedbackVerdict = 'accurate' | 'had_waves' | 'too_windy' | 'calmer';

// When the visitor was actually AT the beach, asked as a second step right after the verdict
// button. Without this, `hour` below (the click time) is the only time signal we have, and a
// report typed at 22:00 about a beach visited at 09:00 reads as an evening observation — the
// exact confusion that made an 09/08/2026 owner ask for this field.
export type ObservedTiming = 'now' | 'morning' | 'midday' | 'evening' | 'unsure';

export interface FeedbackData {
  beachId: number;
  feedback: 'accurate' | 'not_accurate' | ConditionFeedbackVerdict;
  timestamp: string;
  // Modeled conditions at feedback time, so an offline pass can later calibrate the
  // per-beach/sector model against what the visitor actually observed (roadmap #7).
  //
  // The wave fields matter as much as the wind ones: without what we CLAIMED the sea was, a
  // "had waves" report cannot calibrate a wave model, only a wind model. And without `live`
  // every record is ambiguous — "I am standing here in it" and "I was reading about next
  // Tuesday" are opposite kinds of evidence and were previously indistinguishable.
  conditions?: {
    exposureLevel?: string;
    beaufort?: number;
    /**
     * Ό,τι ΕΙΔΕ ο επισκέπτης στο hero: «3–4» όταν το εύρος άναψε (utils/beaufortRange), αλλιώς
     * «3». Το `beaufort` από πάνω είναι το κάτω άκρο που έκρινε το χρώμα· ένα «είχε πιο πολύ
     * αέρα» κρίνεται απέναντι σε αυτό εδώ (Νάξος #2017, 25/08/2026).
     */
    beaufortShown?: string;
    windDir?: string;
    date?: string;
    /** Athens hour the visitor CLICKED the feedback button — not necessarily when they swam. */
    hour?: number;
    /**
     * Η ΩΡΑ ΠΟΥ ΕΔΕΙΧΝΕ Η ΟΘΟΝΗ (0–23) — πρόσθετο 29/08/2026.
     *
     * ⚠️ ΟΧΙ εγγυημένα ώρα Ελλάδας, σε αντίθεση με το `hour` από πάνω. Η τιμή γεννιέται στο
     * App.tsx ως `new Date(selectedHourDt * 1000).getHours()`, δηλαδή στη ζώνη ΤΗΣ ΣΥΣΚΕΥΗΣ.
     * Μέσα στην Ελλάδα τα δύο ταυτίζονται· από το εξωτερικό όχι. Αυτό που εγγυάται το πεδίο
     * είναι ότι ΑΥΤΟΣ ο αριθμός τυπώθηκε στη σελίδα — και μόνο αυτό λέει το mail.
     *
     * `undefined` σημαίνει ότι ο διακόπτης ώρας ήταν στο «τώρα», άρα τα νούμερα από κάτω
     * είναι της τρέχουσας ώρας. Όταν ΕΧΕΙ τιμή, ο επισκέπτης είχε γυρίσει τον διακόπτη και
     * τα `seaStateWaveM`/`shoreDisplayWaveM`/`beaufortShown` ανήκουν σε ΑΥΤΗΝ την ώρα — όχι
     * στην ώρα που πάτησε το κουμπί (`hour`) και όχι στην ώρα που ήταν στην παραλία.
     *
     * Χωρίς αυτό το πεδίο τα δύο μισά της αναφοράς δεν ταιριάζουν μεταξύ τους: Μικρή Άμμος
     * Θεσπρωτίας (902), 29/08/2026 — ο επισκέπτης δήλωσε «τώρα είναι εκεί» στις 11:00 και
     * το mail έγραφε «0,18 μ.» για ώρα που κανείς δεν μπορούσε να μάθει. Το `live: false`
     * έλεγε μόνο ΟΤΙ η οθόνη ήταν αλλού, ποτέ ΠΟΥ — δηλαδή η αναφορά ήταν αβαθμονόμητη.
     */
    shownHour?: number;
    /** When the visitor says they were actually at the beach — see ObservedTiming above. */
    observedTiming?: ObservedTiming;
    /** The sea state we claimed (m) and its period — what the report is evidence against. */
    seaStateWaveM?: number;
    seaStatePeriodS?: number;
    /**
     * ⚠️ Ο ΑΡΙΘΜΟΣ ΠΟΥ ΕΙΔΕ ΤΟ ΜΑΤΙ ΤΟΥ ΕΠΙΣΚΕΠΤΗ (m) — πρόσθετο 15/08/2026.
     *
     * Το `seaStateWaveM` από πάνω είναι το ΑΝΟΙΧΤΟ ΝΕΡΟ: αυτό που κρίνει χρώμα και ετυμηγορία,
     * μετρημένο σε σημείο με διάμεσο 10 χλμ. από την ακτή. Από τις 13/08/2026 όμως η οθόνη
     * τυπώνει παντού το `shoreDisplayWaveM` — το νερό ΣΤΗΝ ΑΚΤΗ (βλ. PORISMA §Γ5). Χωρίς αυτό
     * το πεδίο, μια αναφορά «είχε κύμα» βαθμονομείται απέναντι σε νούμερο που ο άνθρωπος που
     * την έστειλε δεν είδε ποτέ.
     *
     * Πρώτο πραγματικό περιστατικό: Λιά Μυκόνου (1958), 15/08/2026 — το e-mail ανέφερε
     * «Κύμα που δείχναμε: 1,78 μ.» ενώ η σελίδα έδειχνε ~0,10 μ. Και τα δύο σωστά· άλλο νερό.
     *
     * `undefined` είναι η κανονική απάντηση (η οθόνη έπεσε πίσω στο ανοιχτό νερό) — ο δέκτης
     * πρέπει να το διαβάζει ως «ίδιο με το ανοιχτό», όχι ως έλλειψη δεδομένων.
     */
    shoreDisplayWaveM?: number;
    /** Ο αριθμός ακτής ήρθε από μετρημένη απόδειξη ότι το νερό φεύγει, όχι από την έκπτωση ×0,5 (§Γ55/§Γ56). */
    shoreWaveFromDepartingSea?: boolean;
    /** True only when the user is looking at right now, not a remembered or future day. */
    live?: boolean;
    /**
     * ΤΑ ΣΤΟΙΧΕΙΑ ΠΟΥ ΚΡΙΝΟΥΝ ΕΝΑ «ΕΙΧΕ ΠΙΟ ΠΟΛΥ ΚΥΜΑ» — πρόσθετα 06/09/2026 (Κυρά Παναγιά
     * Καρπάθου #2308). Το μήνυμα έλεγε «ΒΔ 4–5 Μπφ, protected, ακτή 0,10 μ., ανοιχτά 0,74 μ.»
     * και δεν μπορούσε να απαντηθεί: ο αριθμός της ακτής κρίνεται από το ΑΠΟ ΠΟΥ έρχεται το
     * κύμα σε σχέση με το πού κοιτάει η ακτή (utils/shoreWave isSeaArrivingShore /
     * isSeaDepartingShore), και τίποτα από τα δύο δεν ταξίδευε. Χωρίς αυτά, κάθε τέτοιο σχόλιο
     * θέλει να ξανατρέξει κανείς την πρόγνωση της ώρας εκείνης για να μάθει τι είδε η μηχανή.
     *
     * Πάνε ΜΟΝΟ στο Telegram/Blobs, όχι στο GA (δες TELEGRAM_ONLY_CONDITION_KEYS): το GA κόβει
     * στις 20 παραμέτρους και τα πεδία που ήδη στέλνει είναι αυτά που διαβάζουν οι αναφορές.
     */
    /** Ταχύτητα ανέμου (χλμ/ώ) πίσω από το Μποφόρ — η είσοδος του μοντέλου κύματος. */
    windSpeedKmh?: number;
    /** Προς τα πού κοιτάει η ακτή (μοίρες) — αυτό που διάβασε η μηχανή, όχι το χειρόγραφο πεδίο. */
    facingDeg?: number;
    /** Από πού έρχεται το κύμα των ανοιχτών (μοίρες), την ώρα που έδειχνε η οθόνη. */
    waveDirectionDeg?: number;
    swellWaveHeightM?: number;
    swellWavePeriodS?: number;
    swellWaveDirectionDeg?: number;
    /** Τι έκρινε η εφαρμογή για τη μεριά που έρχεται η θάλασσα (utils/seaArrival). */
    seaArrivalExposureLevel?: string;
    /** Ποιος δρόμος έδωσε τον τυπωμένο αριθμό ακτής — βλ. recommendationService BeachScore.shoreWaveSource. */
    shoreWaveSource?: string;
  };
}

export interface FeedbackNotificationContext {
  source?: string;
  beachName?: string;
  islandName?: string;
  regionId?: string;
  language?: string;
  pagePath?: string;
}

const STORAGE_KEY = 'beach_buddy_analytics';
const FEEDBACK_KEY = 'beach_buddy_feedback';
const CONSENT_KEY = 'beach_buddy_analytics_consent';
const OPEN_METEO_CALLS_KEY = 'beach_buddy_open_meteo_calls';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || '';
const GOOGLE_ANALYTICS_SCRIPT_ID = 'beach-buddy-google-analytics';
const GOOGLE_ANALYTICS_DENYLISTED_METADATA = new Set([
  'query',
  'question',
  'lat',
  'lon',
  'latitude',
  'longitude',
  'userLocation',
  'exactLocation',
  'email',
  'phone',
]);

// GA4 RESERVES these event-parameter names for campaign / traffic-source attribution.
// An event carrying a param literally named `source` (or `medium`, `campaign`, …) silently
// OVERWRITES the session's source/medium — so our internal UI-origin `source` values
// (`detail_map`, `consent_accept`, `recommendation_card`, …) were being recorded as the
// traffic source, inflating sessions and dumping ~70% of traffic into "Unassigned"
// (those values match no channel grouping). We still want the UI-origin signal, so we
// PREFIX any collision (`source` → `ui_source`) instead of dropping it: the analytics
// stays, attribution is left to Google's real source/medium. See services docs / GA4:
// "manually collected traffic-source parameters".
const GOOGLE_ANALYTICS_RESERVED_PARAM_NAMES = new Set([
  'source',
  'medium',
  'campaign',
  'term',
  'content',
  'campaign_id',
  'campaign_source',
  'campaign_medium',
  'campaign_name',
  'campaign_term',
  'campaign_content',
  'source_platform',
  'creative_format',
  'marketing_tactic',
  'gclid',
  'dclid',
  'gclsrc',
  'srsltid',
]);

type GoogleAnalyticsParams = Record<string, string | number | boolean>;
type GtagArguments = [string, ...unknown[]];
type GoogleConsentValue = 'granted' | 'denied';
type GoogleConsentModeSettings = {
  analytics_storage: GoogleConsentValue;
  ad_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  ad_personalization: GoogleConsentValue;
};

declare global {
  interface Window {
    dataLayer?: GtagArguments[];
    gtag?: (...args: GtagArguments) => void;
  }
}

export type AnalyticsConsent = 'accepted' | 'declined';

let googleAnalyticsInitialized = false;
let consentDefaultInitialized = false;

const DEFAULT_DENIED_CONSENT: GoogleConsentModeSettings = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

const getConsentModeSettings = (consent: AnalyticsConsent | null): GoogleConsentModeSettings => ({
  ...DEFAULT_DENIED_CONSENT,
  analytics_storage: consent === 'accepted' ? 'granted' : 'denied',
});

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key: string, value: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Analytics storage should never block the app.
  }
};

const removeStorageItem = (key: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Analytics storage should never block the app.
  }
};

// The build's deploy environment. Set per Netlify context in netlify.toml:
// "production" on main, "staging" on branch deploys, "preview" on deploy previews.
// Unset (local `npm run build`) defaults to "production" so we never accidentally
// kill production GA if the env var is ever missing — non-production deploys must
// OPT OUT explicitly, which the netlify.toml context blocks do.
const APP_ENV = import.meta.env.VITE_APP_ENV?.trim() || 'production';

/** True only on the real production deploy — used to fence GA off everywhere else. */
export const isProductionEnvironment = () => APP_ENV === 'production';

// GA runs only on the production deploy: a shipped measurement id, a production Vite
// build, AND VITE_APP_ENV === "production". This last gate is what stops a Netlify
// branch deploy or deploy preview (which are also PROD Vite builds) from sending hits
// into the production GA4 property and inflating real traffic.
export const isGoogleAnalyticsConfigured = () =>
  Boolean(GOOGLE_ANALYTICS_MEASUREMENT_ID) && import.meta.env.PROD && isProductionEnvironment();

const setGoogleAnalyticsDisabled = (disabled: boolean) => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined') return;
  const windowFlags = window as unknown as Record<string, boolean>;
  windowFlags[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`] = disabled;
};

const initializeGoogleTag = () => {
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    // gtag.js only treats a dataLayer entry as a command when it is the native
    // `arguments` object. Pushing a (spread) array makes the library silently
    // ignore `config`/`event`/`consent`, so no GA4 destination is ever registered
    // and zero hits are sent — which looks like "GA is dead" while Search Console
    // (server-side) still reports traffic. Mirror Google's canonical snippet.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments as unknown as GtagArguments);
    };
  }
};

const applyDefaultConsentMode = () => {
  if (consentDefaultInitialized) return;

  window.gtag?.('consent', 'default', DEFAULT_DENIED_CONSENT);
  consentDefaultInitialized = true;
};

const updateGoogleConsentMode = (consent: AnalyticsConsent | null) => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('consent', 'update', getConsentModeSettings(consent));
};

const appendGoogleAnalyticsScript = () => {
  if (document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`;

  document.head.appendChild(script);
};

const ensureGoogleAnalyticsLoaded = () => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined') return;
  const consent = getAnalyticsConsent();

  initializeGoogleTag();
  setGoogleAnalyticsDisabled(consent !== 'accepted');
  applyDefaultConsentMode();
  updateGoogleConsentMode(consent);

  if (consent !== 'accepted') return;

  if (!googleAnalyticsInitialized) {
    window.gtag?.('js', new Date());
    window.gtag?.('config', GOOGLE_ANALYTICS_MEASUREMENT_ID, {
      // We emit page_view manually from the app router (state-based navigation),
      // so GA4's automatic first-load page_view is disabled to avoid double-counting.
      send_page_view: false,
      // Cap the _ga / _ga_<id> cookie lifetime at ~13 months so it matches the
      // duration stated in the Cookie Policy (GA4 otherwise defaults to 2 years).
      cookie_expires: 60 * 60 * 24 * 30 * 13,
      // ΤΑ ΔΙΑΦΗΜΙΣΤΙΚΑ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ ΤΟΥ GA4, ΣΒΗΣΤΑ ΡΗΤΑ (28/08/2026).
      //
      // Ενεργή παραβίαση CSP από /beaches/evia/233-klimaki/: το GA4 προσπάθησε να
      // στείλει το γεγονός `navigation_clicked` στο pagead2.googlesyndication.com
      // /measurement/conversion — διαφημιστικό δίκτυο της Google, με το δικό μας
      // αναγνωριστικό μέτρησης πάνω του. Το connect-src το έκοψε, σωστά.
      //
      // Δεν το θέλουμε ούτε κατ' ελάχιστον: δεν τρέχουμε διαφημίσεις πουθενά (μηδέν
      // αναφορές σε AdSense/Google Ads σε όλο τον κώδικα), και το DEFAULT_DENIED_CONSENT
      // παραπάνω αρνείται ad_storage, ad_user_data και ad_personalization ΑΚΟΜΑ ΚΑΙ όταν
      // ο επισκέπτης δεχτεί — μόνο το analytics_storage ανοίγει. Το ping λοιπόν
      // αντέφασκε με τη ρύθμιση που έχουμε ήδη δηλώσει.
      //
      // Οι δύο σημαίες το σταματούν στην ΠΗΓΗ, αντί να το αφήνουμε να φεύγει και να το
      // κόβει ο browser σε κάθε σελίδα κάθε επισκέπτη. Η μέτρηση επισκεψιμότητας δεν
      // αγγίζεται: αυτή πάει σε *.google-analytics.com και googletagmanager.com/td,
      // που είναι και τα δύο επιτρεπτά στο CSP.
      //
      // ΑΝ ΞΑΝΑΕΜΦΑΝΙΣΤΕΙ: το «Google signals» είναι ΚΑΙ διακόπτης μέσα στον πίνακα του
      // GA4 (Admin → Data collection), που δεν ελέγχεται από εδώ.
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    googleAnalyticsInitialized = true;
  }

  appendGoogleAnalyticsScript();
};

const normalizeGoogleAnalyticsParamName = (key: string) => {
  const normalized = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();

  const withValidStart = /^[a-z]/.test(normalized) ? normalized : `m_${normalized}`;
  return withValidStart.slice(0, 40);
};

const toGoogleAnalyticsValue = (value: unknown): string | number | boolean | undefined => {
  if (typeof value === 'string') return value.slice(0, 100);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
};

const sanitizeAnalyticsMetadata = (metadata?: unknown): GoogleAnalyticsParams => {
  const params: GoogleAnalyticsParams = {};

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return params;
  }

  Object.entries(metadata).slice(0, 20).forEach(([key, value]) => {
    if (GOOGLE_ANALYTICS_DENYLISTED_METADATA.has(key)) return;

    const analyticsValue = toGoogleAnalyticsValue(value);
    if (analyticsValue === undefined) return;

    let name = normalizeGoogleAnalyticsParamName(key);
    if (GOOGLE_ANALYTICS_RESERVED_PARAM_NAMES.has(name)) {
      // Prefix so it can never be read as GA4 traffic-source attribution. Re-slice to
      // stay within the 40-char param-name limit. Idempotent (`ui_source` is not reserved),
      // so the second sanitize pass inside trackGoogleAnalyticsEvent leaves it unchanged.
      name = `ui_${name}`.slice(0, 40);
    }
    params[name] = analyticsValue;
  });

  return params;
};

const buildGoogleAnalyticsParams = (
  beachId?: number | string,
  metadata?: unknown
): GoogleAnalyticsParams => {
  const params: GoogleAnalyticsParams = {};

  if (beachId !== undefined) {
    params.beach_id = String(beachId);
  }

  return {
    ...params,
    ...sanitizeAnalyticsMetadata(metadata),
  };
};

const trackGoogleAnalyticsEvent = (
  event: AnalyticsEvent,
  beachId?: number | string,
  metadata?: unknown
) => {
  ensureGoogleAnalyticsLoaded();
  if (typeof window === 'undefined' || !window.gtag || !isGoogleAnalyticsConfigured()) return;

  window.gtag('event', event, buildGoogleAnalyticsParams(beachId, metadata));
};

const sendFeedbackEmail = (payload: {
  source: string;
  beachId: number;
  feedback: FeedbackData['feedback'];
  timestamp: string;
  conditions?: FeedbackData['conditions'];
  context?: FeedbackNotificationContext;
}) => {
  if (typeof fetch === 'undefined') return;

  fetch('/.netlify/functions/feedback-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then(response => {
    if (!response.ok && import.meta.env.DEV) {
      console.warn(`[Feedback] Email delivery failed with HTTP ${response.status}`);
    }
  }).catch(error => {
    if (import.meta.env.DEV) {
      console.warn('[Feedback] Email delivery failed.', error);
    }
  });
};

/**
 * Free-text message from the landing story section, delivered over the same
 * Telegram function as beach feedback (no new infrastructure, instant push).
 *
 * Deliberately NOT consent-gated: this is content the visitor chose to send us,
 * not tracking. The analytics event that accompanies it is gated as usual.
 *
 * Resolves true only on a real 2xx, so the UI can fall back to the plain mail
 * address instead of pretending the message went out.
 */
export const sendLandingMessage = async (payload: {
  message: string;
  replyTo?: string;
  prompt?: string;
  language?: string;
  /** Honeypot: a visible endpoint is a spam target within days. */
  company?: string;
}): Promise<boolean> => {
  if (typeof fetch === 'undefined') return false;

  try {
    const response = await fetch('/.netlify/functions/feedback-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'landing_story',
        feedback: 'story_message',
        message: payload.message,
        replyTo: payload.replyTo || '',
        prompt: payload.prompt || '',
        company: payload.company || '',
        timestamp: new Date().toISOString(),
        context: {
          language: payload.language,
          pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        },
      }),
    });
    return response.ok;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Feedback] Landing message delivery failed.', error);
    }
    return false;
  }
};

/**
 * The "rate the app" submission (components/AppRatingPrompt.tsx): two 1–10 scores plus an
 * optional free-text note, over the same Telegram function as beach feedback. Like the
 * landing message, deliberately NOT consent-gated — content the visitor chose to send us,
 * not tracking. Resolves true only on a real 2xx so the card can offer a retry instead of
 * pretending the rating went out.
 */
export const sendAppRating = async (payload: {
  easeOfUse: number;
  accuracy: number;
  message?: string;
  /** Distinct days of use before the card asked — context for reading the scores. */
  usageDays?: number;
  language?: string;
}): Promise<boolean> => {
  if (typeof fetch === 'undefined') return false;

  try {
    const response = await fetch('/.netlify/functions/feedback-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'app_rating_prompt',
        feedback: 'app_rating',
        ratings: { easeOfUse: payload.easeOfUse, accuracy: payload.accuracy },
        usageDays: payload.usageDays,
        message: payload.message || '',
        timestamp: new Date().toISOString(),
        context: {
          language: payload.language,
          pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        },
      }),
    });
    return response.ok;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Feedback] App rating delivery failed.', error);
    }
    return false;
  }
};

/**
 * Newsletter subscription. Posts to /api/newsletter, which writes a durable row
 * (de-duplicated by a hash of the address) and pushes a Telegram notification.
 *
 * `alreadySubscribed` comes back so the UI can avoid a second confirmation that
 * reads like a second subscription — but the visible message is deliberately the
 * SAME either way. A different message for an address already on the list tells
 * anyone who asks whether that address subscribed, which is a small free leak we
 * do not need to hand out.
 *
 * Errors resolve rather than throw: the section falls back to the plain address,
 * exactly like the story form, so the path never dead-ends.
 */
export const subscribeToNewsletter = async (payload: {
  email: string;
  language?: string;
  source?: string;
  /** Honeypot: a visible endpoint is a spam target within days. */
  company?: string;
}): Promise<{ ok: boolean; alreadySubscribed: boolean }> => {
  if (typeof fetch === 'undefined') return { ok: false, alreadySubscribed: false };

  try {
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        locale: payload.language || '',
        source: payload.source || 'landing',
        company: payload.company || '',
      }),
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, alreadySubscribed: Boolean(body?.alreadySubscribed) };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Newsletter] Subscription failed.', error);
    }
    return { ok: false, alreadySubscribed: false };
  }
};

export const getAnalyticsConsent = (): AnalyticsConsent | null => {
  const value = getStorageItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
};

export const setAnalyticsConsent = (consent: AnalyticsConsent) => {
  setStorageItem(CONSENT_KEY, consent);

  if (consent === 'declined') {
    removeStorageItem(STORAGE_KEY);
  }

  if (isGoogleAnalyticsConfigured() && typeof window !== 'undefined') {
    initializeGoogleTag();
    applyDefaultConsentMode();
    setGoogleAnalyticsDisabled(consent !== 'accepted');
  }

  ensureGoogleAnalyticsLoaded();
  updateGoogleConsentMode(consent);
};

export const initializeAnalytics = () => {
  if (isGoogleAnalyticsConfigured() && typeof window !== 'undefined') {
    initializeGoogleTag();
    applyDefaultConsentMode();
    setGoogleAnalyticsDisabled(getAnalyticsConsent() !== 'accepted');
  }

  ensureGoogleAnalyticsLoaded();
  updateGoogleConsentMode(getAnalyticsConsent());
};

export const canTrackAnalytics = () => getAnalyticsConsent() === 'accepted';

export const trackEvent = (
  event: AnalyticsEvent, 
  beachId?: number | string, 
  metadata?: any
) => {
  // First-party mirror of the handful of events that mean "this visitor did the
  // thing" (navigate, share, favourite, outbound). It runs BEFORE the consent gate
  // on purpose: it stores no cookie and no personal data (see pageviewBeacon.ts),
  // and it is the only way conversions from the consent-declining / ad-blocking
  // half of our traffic ever become visible. Unknown events are ignored there.
  recordAction(event);

  if (!canTrackAnalytics()) return;

  const safeMetadata = sanitizeAnalyticsMetadata(metadata);
  trackGoogleAnalyticsEvent(event, beachId, safeMetadata);

  const data: AnalyticsData = {
    event,
    beachId,
    timestamp: new Date().toISOString(),
    metadata: safeMetadata
  };

  const existing = getEvents();
  existing.push(data);
  setStorageItem(STORAGE_KEY, JSON.stringify(existing));
  
  if (import.meta.env.DEV) {
    console.log(`[Analytics] Tracked: ${event}`, data);
  }
};

export const trackPageView = (
  path: string,
  metadata?: Record<string, string | number | boolean | undefined>
) => {
  const loc = typeof window !== 'undefined' ? window.location : undefined;
  trackEvent('page_view', undefined, {
    // GA4-recommended page params (send_page_view is off, so these are the
    // canonical source of truth for the page_view event).
    page_path: path,
    page_location: loc ? `${loc.origin}${path}${loc.search}${loc.hash}` : path,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    // Retained for the local event log / existing consumers.
    path,
    ...(metadata || {}),
  });
};

/**
 * Static wind-exposure descriptors for a beach, normalized for GA4. Every field
 * falls back to 'unknown' (never undefined). Notes on the data model:
 *  - shelterLevel lives on Beach.windProfile, not top-level.
 *  - fetchExposure is a top-level Beach field.
 *  - exposureStatus is NOT a static Beach field; it is a live/computed value
 *    (SimpleWindSuitability) and is only known when passed in explicitly.
 */
export const buildBeachExposureParams = (
  beach?: {
    windProfile?: { shelterLevel?: string | null } | null;
    fetchExposure?: string | null;
  } | null,
  exposureStatus?: string | null,
): { shelter_level: string; exposure_status: string; fetch_exposure: string } => ({
  shelter_level: beach?.windProfile?.shelterLevel ?? 'unknown',
  exposure_status: exposureStatus ?? 'unknown',
  fetch_exposure: beach?.fetchExposure ?? 'unknown',
});

export const getEvents = (): AnalyticsData[] => {
  const stored = getStorageItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const storeFeedback = (
  beachId: number,
  feedback: 'accurate' | 'not_accurate',
  context?: FeedbackNotificationContext
) => {
  const data: FeedbackData = {
    beachId,
    feedback,
    timestamp: new Date().toISOString()
  };

  const existing = getFeedback();
  existing.push(data);
  setStorageItem(FEEDBACK_KEY, JSON.stringify(existing));
  
  trackEvent(
    feedback === 'accurate' ? 'recommendation_feedback_positive' : 'recommendation_feedback_negative',
    beachId,
    { feedback }
  );
  sendFeedbackEmail({
    source: context?.source || 'recommendation_feedback',
    beachId,
    feedback,
    timestamp: data.timestamp,
    context,
  });
};

/**
 * Structured "how was it really?" feedback (roadmap #7 — the capture half of the loop).
 * Pairs the visitor's observed verdict with the modeled conditions and ships it as a GA4
 * 'condition_feedback' event + a local record. The CALIBRATION half (aggregate verdicts
 * per beach/sector and nudge the model / ground truth) is an offline pass over exported
 * GA data — there is no app backend to close the loop live.
 */
/**
 * Τα διαγνωστικά πεδία της θάλασσας (06/09/2026) μένουν έξω από το GA event: το
 * sanitizeAnalyticsMetadata κρατάει τις πρώτες 20 παραμέτρους, οπότε χωρίς αυτό το φίλτρο θα
 * έβγαζε σιωπηλά ό,τι έτυχε να είναι τελευταίο — π.χ. το `live`, που το διαβάζουν οι εξαγωγές.
 * Το Telegram και τα Blobs παίρνουν το πλήρες αντικείμενο (sendFeedbackEmail παρακάτω).
 */
const TELEGRAM_ONLY_CONDITION_KEYS: ReadonlyArray<keyof NonNullable<FeedbackData['conditions']>> = [
  'windSpeedKmh', 'facingDeg', 'waveDirectionDeg',
  'swellWaveHeightM', 'swellWavePeriodS', 'swellWaveDirectionDeg',
  'seaArrivalExposureLevel', 'shoreWaveSource',
];

const gaConditions = (conditions?: FeedbackData['conditions']): Record<string, unknown> => {
  if (!conditions) return {};
  const omitted = new Set<string>(TELEGRAM_ONLY_CONDITION_KEYS);
  return Object.fromEntries(Object.entries(conditions).filter(([key]) => !omitted.has(key)));
};

export const storeConditionFeedback = (
  beachId: number,
  verdict: ConditionFeedbackVerdict,
  conditions?: FeedbackData['conditions'],
  context?: FeedbackNotificationContext
) => {
  const data: FeedbackData = { beachId, feedback: verdict, timestamp: new Date().toISOString(), conditions };
  const existing = getFeedback();
  existing.push(data);
  setStorageItem(FEEDBACK_KEY, JSON.stringify(existing));
  trackEvent('condition_feedback', beachId, { verdict, ...gaConditions(conditions) });
  sendFeedbackEmail({
    source: context?.source || 'condition_feedback',
    beachId,
    feedback: verdict,
    timestamp: data.timestamp,
    conditions,
    context,
  });
};

export const getFeedback = (): FeedbackData[] => {
  const stored = getStorageItem(FEEDBACK_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

// "Worse than shown" verdicts that should downrank a beach in live scoring (recommendation
// Service consumes this count). Includes the structured negatives so the live per-device
// penalty keeps working after the binary not_accurate button was replaced (roadmap #7).
// 'calmer' is the opposite signal (model over-warned) and 'accurate' is neutral, so neither
// penalises here — softening stays evidence-gated in the offline calibration pass.
const NEGATIVE_FEEDBACK = new Set<FeedbackData['feedback']>(['not_accurate', 'had_waves', 'too_windy']);
export const getNegativeFeedbackCount = (beachId: number): number => {
  const feedback = getFeedback();
  return feedback.filter(f => f.beachId === beachId && NEGATIVE_FEEDBACK.has(f.feedback)).length;
};

// --- Open-Meteo call counter -------------------------------------------------
// A per-UTC-day count of REAL origin fetches (cache misses), so we can see how close
// we are to Open-Meteo's 10,000/day limit without any backend. Two sinks:
//   • localStorage (always, no PII) — a local operational counter for quick inspection.
//   • GA4 event (consent-gated)     — the cross-user aggregate = real calls/day. Because
//     it is consent-gated it UNDER-counts (declined users), so treat it as a lower bound /
//     trend alarm, not an exact meter.
// Rough Tier-B (shared server cache) trigger: amber at a sustained ~4,000–5,000/day, red
// beyond ~7,000/day or on repeated HTTP 429s.
const utcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

interface OpenMeteoDayCount {
  day: string;
  count: number;
}

const readOpenMeteoDayCount = (): OpenMeteoDayCount | null => {
  const stored = getStorageItem(OPEN_METEO_CALLS_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as OpenMeteoDayCount;
    return typeof parsed?.day === 'string' && typeof parsed?.count === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

export const recordOpenMeteoCall = (endpoint: OpenMeteoEndpoint) => {
  // Local counter — always on (operational, no personal data).
  const today = utcDayKey(new Date());
  const existing = readOpenMeteoDayCount();
  const next: OpenMeteoDayCount = existing && existing.day === today
    ? { day: today, count: existing.count + 1 }
    : { day: today, count: 1 };
  setStorageItem(OPEN_METEO_CALLS_KEY, JSON.stringify(next));

  // Cross-user aggregate — consent-gated. Sent directly (NOT via trackEvent) so the
  // high-frequency counter never bloats the local analytics event log.
  if (canTrackAnalytics()) {
    trackGoogleAnalyticsEvent('open_meteo_fetch', undefined, { endpoint });
  }

  if (import.meta.env.DEV) {
    console.log(`[weather] Open-Meteo origin call #${next.count} today (${endpoint})`);
  }
};

/** Real Open-Meteo origin calls counted on THIS device today (UTC). 0 if none / new day. */
export const getOpenMeteoCallCountToday = (): number => {
  const today = utcDayKey(new Date());
  const stored = readOpenMeteoDayCount();
  return stored && stored.day === today ? stored.count : 0;
};

export const getAnalyticsInsights = () => {
  const events = getEvents();
  
  const beachViews: Record<number | string, number> = {};
  const searchLocations: Record<string, number> = {};
  const beachFavorites: Record<number | string, number> = {};

  events.forEach(e => {
    if ((e.event === 'beach_viewed' || e.event === 'beach_detail_opened') && e.beachId) {
      beachViews[e.beachId] = (beachViews[e.beachId] || 0) + 1;
    }
    if ((e.event === 'search_performed' || e.event === 'beach_search' || e.event === 'search_used') && e.metadata?.search_length) {
      const key = `${e.metadata.search_length} chars`;
      searchLocations[key] = (searchLocations[key] || 0) + 1;
    }
    if ((e.event === 'beach_favorited' || e.event === 'favorite_clicked') && e.beachId) {
      beachFavorites[e.beachId] = (beachFavorites[e.beachId] || 0) + 1;
    }
  });

  return {
    beachViews,
    searchLocations,
    beachFavorites
  };
};

import React, { useEffect, useRef } from 'react';
import type { Island, LanguageCode } from '../../types';
import { canTrackAnalytics, trackEvent } from '../../services/analyticsService';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../services/legalConsent';
import type { DirectorySearchSuggestion } from '../BeachSearcherHome';
import { useNationalConditions } from '../../hooks/useNationalConditions';
import { LandingHero } from './LandingHero';
import { TodayRegionsSection } from './TodayRegionsSection';
import { HowWeDecideSection } from './HowWeDecideSection';
import { CommunityPhotosSection } from './CommunityPhotosSection';
import { OurStorySection } from './OurStorySection';
import { NewsletterSection } from './NewsletterSection';

// The national landing shown to first-time / no-region visitors. It follows the
// competitor's clean, sectioned philosophy but differentiates hard: it leads
// with a decision for TODAY and our honesty, NOT directory size or vibe browsing.
//
// Page rhythm: real-photo hero (rotating with the time of day) → "regions today"
// (crawlable region links, ranked by how many of each region's beaches are
// protected from today's wind — our answer instead of a competitor-style
// browse-by-region photo grid) → one dark contrast moment (the trust manifesto) →
// footer. One national read backs the hero and the region strip, so it stays a
// single cached call.

interface LandingViewProps {
  language: LanguageCode;
  allIslands: Island[];
  searchQuery: string;
  searchSuggestions: DirectorySearchSuggestion[];
  isSearchSuggesting: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchSuggestionSelect: (suggestion: DirectorySearchSuggestion) => void;
  onShowNearbyBeaches: () => void;
  isFindingLocation: boolean;
  locationError?: string | null;
  onSelectIsland: (island: Island) => void;
  onOpenIslandSelector: () => void;
  /** False when accounts are unconfigured — the photo section then does not render. */
  isAuthAvailable: boolean;
  isSignedIn: boolean;
  /** Signed out → sign in; signed in → open the upload sheet. */
  onAddPhoto: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  language,
  allIslands,
  searchQuery,
  searchSuggestions,
  isSearchSuggesting,
  onSearchChange,
  onSearchSubmit,
  onSearchSuggestionSelect,
  onShowNearbyBeaches,
  isFindingLocation,
  locationError,
  onSelectIsland,
  onOpenIslandSelector,
  isAuthAvailable,
  isSignedIn,
  onAddPhoto,
}) => {
  const conditions = useNationalConditions();

  // Landing reach — the denominator for every drop-off question we want to ask
  // (how many of these ever pick a region / tap "near me" / search?).
  //
  // A first-time visitor meets the landing and the consent banner at the SAME
  // moment, so a fire-once-on-mount effect is silently dropped by the consent
  // gate for exactly the population we most need to count. So: only mark it as
  // sent once it actually went out, and retry when consent is answered.
  const trackedViewRef = useRef(false);
  useEffect(() => {
    const send = () => {
      if (trackedViewRef.current || !canTrackAnalytics()) return;
      trackedViewRef.current = true;
      trackEvent('landing_viewed', undefined, { locale: language });
    };

    send();
    if (trackedViewRef.current || typeof document === 'undefined') return undefined;

    document.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, send);
    return () => document.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, send);
  }, [language]);

  // One shared handler so "near me" is counted identically wherever it is offered
  // (hero CTA and the region-strip CTA), with the origin preserved.
  const handleNearMe = (source: 'hero' | 'regions') => {
    trackEvent('landing_near_me_clicked', undefined, { source });
    onShowNearbyBeaches();
  };

  return (
    <main className="relative z-10 pb-16 sm:pb-24">
      <LandingHero
        language={language}
        searchQuery={searchQuery}
        suggestions={searchSuggestions}
        isSuggesting={isSearchSuggesting}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onSuggestionSelect={onSearchSuggestionSelect}
        onNearMe={() => handleNearMe('hero')}
        isFindingLocation={isFindingLocation}
        locationError={locationError}
        roughness={conditions.roughness}
      />

      {/* Real <a href> navigation carrying today's live wind — the landing's only
          crawlable links, and the only path for visitors who will neither type
          nor share their location.

          The national read below was already being paid for by the hero, which
          used one field of it (roughness) and dropped the rest. The per-region
          wind DIRECTION rides along in the same response, and since 29/08/2026 it
          is what turns these tiles from thirteen identical names into a ranked
          answer. `isFresh` is passed with it because the section says «σήμερα»:
          without the flag it would print a three-hour-old direction as today's. */}
      <div className="mt-5 sm:mt-14">
        <TodayRegionsSection
          language={language}
          allIslands={allIslands}
          onSelectIsland={onSelectIsland}
          onShowNearbyBeaches={() => handleNearMe('regions')}
          isFindingLocation={isFindingLocation}
          locationError={locationError}
          regionConditions={conditions.regions}
          isConditionsFresh={conditions.isFresh}
          onOpenIslandSelector={() => {
            trackEvent('landing_all_regions_clicked');
            onOpenIslandSelector();
          }}
        />
      </div>

      {/* MOVED UP 08/08/2026, above "how we decide", at Miltos's call.
          The photo ask now sits straight after the region band, while the
          visitor is still thinking about a specific coast they know — which is
          exactly when "do you have a photo of one of these?" makes sense. Below
          the methodology band it was the fourth thing on a long page, i.e.
          invisible on a phone. The trade is deliberate: the ask now comes before
          we have finished showing our working. */}
      <div className="mt-14 sm:mt-20">
        <CommunityPhotosSection
          language={language}
          isAuthAvailable={isAuthAvailable}
          isSignedIn={isSignedIn}
          onStart={onAddPhoto}
        />
      </div>

      {/* MOVED ABOVE THE ARTICLE INDEX 29/08/2026, at Miltos's call. This band is
          the reason to trust every number on the page, so it has to be read
          BEFORE the visitor is offered somewhere else to go: the article index is
          navigation, and navigation ends the visit. It also inherits the photo
          ask's momentum instead of arriving after a ~490px list of links. */}
      <div className="mt-14 sm:mt-20">
        <HowWeDecideSection language={language} />
      </div>

      {/* ΤΑ ΑΡΘΡΑ ΕΦΥΓΑΝ ΑΠΟ ΕΔΩ 06/09/2026 (Μίλτος): πήγαν στο μενού της
          κεφαλίδας (components/MainMenu.tsx), μαζί με τη φωτογραφία και το
          ημερολόγιο. Ήταν ~490px στο κινητό ανάμεσα στην εμπιστοσύνη και το
          γράμμα, δηλαδή πλοήγηση στη μέση μιας σελίδας που απαντάει· και η
          πλοήγηση τελειώνει την επίσκεψη. Ο crawler δεν χάνει τίποτα: τα έξι
          links δεν ήταν ποτέ στο στατικό HTML (το GuideTopicsSection περίμενε το
          ευρετήριο περιοχών), και το prerender συνεχίζει να γράφει μόνο του το
          «popular beach guides» nav μαζί με το /beach-guides/. Το υποσέλιδο
          κρατάει επίσης τον σύνδεσμο των οδηγών σε κάθε σελίδα.
          Το GuideTopicsSection ΔΕΝ διαγράφηκε — μένει έτοιμο αν το θέλουμε πίσω. */}

      {/* The human close: light and first-person, so the page ends on "help us"
          and not on caveats. It follows the trust band directly again (the
          article index sat between them from 29/08 to 06/09/2026), so it inherits
          the dark band's contrast the way it did originally. */}
      <div className="mt-14 sm:mt-20">
        <OurStorySection language={language} />
      </div>

      {/* The last thing on the page, and the only one that asks for a SECOND
          visit. Everything above answers today and lets the visitor go; a beach
          service is used a few times a year, so without a list every visit has
          to be re-won from Google. Placed after the letter on purpose — a "before
          you go" line, never a pop-up. */}
      <div className="mt-12 sm:mt-16">
        <NewsletterSection language={language} />
      </div>
    </main>
  );
};

export default LandingView;

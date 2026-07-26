import React, { useEffect, useRef } from 'react';
import type { Island, LanguageCode } from '../../types';
import { canTrackAnalytics, trackEvent } from '../../services/analyticsService';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../services/legalConsent';
import type { DirectorySearchSuggestion } from '../BeachSearcherHome';
import { useNationalConditions } from '../../hooks/useNationalConditions';
import { LandingHero } from './LandingHero';
import { TodayRegionsSection } from './TodayRegionsSection';
import { HowWeDecideSection } from './HowWeDecideSection';

// The national landing shown to first-time / no-region visitors. It follows the
// competitor's clean, sectioned philosophy but differentiates hard: it leads
// with a decision for TODAY and our honesty, NOT directory size or vibe browsing.
//
// Page rhythm: real-photo hero (rotating with the time of day) → "regions today"
// (crawlable region links carrying today's live wind — our answer instead of a
// competitor-style browse-by-region photo grid) → one dark contrast moment (the
// trust manifesto) → footer. One national read backs the hero and the region
// strip, so it stays a single cached call.

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
          nor share their location. */}
      <div className="mt-10 sm:mt-14">
        <TodayRegionsSection
          language={language}
          allIslands={allIslands}
          regions={conditions.regions}
          status={conditions.status}
          onSelectIsland={onSelectIsland}
          onShowNearbyBeaches={() => handleNearMe('regions')}
          isFindingLocation={isFindingLocation}
          locationError={locationError}
          onOpenIslandSelector={() => {
            trackEvent('landing_all_regions_clicked');
            onOpenIslandSelector();
          }}
        />
      </div>

      <div className="mt-14 sm:mt-20">
        <HowWeDecideSection language={language} />
      </div>
    </main>
  );
};

export default LandingView;

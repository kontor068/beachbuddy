import React from 'react';
import type { Island, LanguageCode } from '../../types';
import type { DirectorySearchSuggestion } from '../BeachSearcherHome';
import { useNationalConditions } from '../../hooks/useNationalConditions';
import { LandingHero } from './LandingHero';
import { TodaySeasSection } from './TodaySeasSection';
import { HowWeDecideSection } from './HowWeDecideSection';

// The national landing shown to first-time / no-region visitors. It follows the
// competitor's clean, sectioned philosophy but differentiates hard: it leads
// with a decision for TODAY and our honesty, NOT directory size or vibe browsing.
//
// Page rhythm: living hero (the sea moves with today's real conditions) → "the
// seas today" (the SAME live national read, broken down per sea area — our
// answer instead of a competitor-style browse-by-region grid) → one dark
// contrast moment (the trust manifesto) → footer. One national read backs the
// hero and the seas panel, so it stays a single cached call.

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
  searchQuery,
  searchSuggestions,
  isSearchSuggesting,
  onSearchChange,
  onSearchSubmit,
  onSearchSuggestionSelect,
  onShowNearbyBeaches,
  isFindingLocation,
  locationError,
  onOpenIslandSelector,
}) => {
  const conditions = useNationalConditions();

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
        onNearMe={onShowNearbyBeaches}
        isFindingLocation={isFindingLocation}
        locationError={locationError}
        roughness={conditions.roughness}
      />

      <div className="mt-12 sm:mt-16">
        <TodaySeasSection
          language={language}
          areas={conditions.areas}
          status={conditions.status}
          onShowNearbyBeaches={onShowNearbyBeaches}
          onOpenIslandSelector={onOpenIslandSelector}
        />
      </div>

      <div className="mt-14 sm:mt-20">
        <HowWeDecideSection language={language} />
      </div>
    </main>
  );
};

export default LandingView;

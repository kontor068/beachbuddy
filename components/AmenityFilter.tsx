
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FilterKey, LanguageCode, SortOption } from '../types';
import { Translation } from '../types';
import { 
  Trees,
  Utensils,
  Martini,
  ParkingCircle,
  ShowerHead,
  CircleDot,
  Mountain, 
  BadgeCheck,
  Search,
  Sunset,
  Users,
  VolumeX,
  ArrowDown, 
  ArrowUp, 
  CheckCircle2, 
  Globe,
  MapPin,
  ShieldCheck,
  Accessibility,
  PersonStanding
} from 'lucide-react';
import { SandDotsIcon, SandPebblesIcon, SunbedIcon } from './BeachFeatureIcons';

interface CombinedFilterProps {
  initialSelectedFilters: FilterKey[];
  initialSortBy: SortOption;
  initialDistanceWithinSuitable?: boolean;
  onApplyFilters: (
    filters: FilterKey[],
    sortBy: SortOption,
    options?: { distanceWithinSuitable?: boolean }
  ) => void;
  onClose: () => void;
  /** Full reset to the app's default state (clears advanced filters AND quick preferences
   *  AND search). The sheet only owns selectedFilters, so a stuck preference cannot be cleared
   *  from here without this — that is what made "Επαναφορά Φίλτρων" appear to do nothing. */
  onResetAll?: () => void;
  t: Translation;
  isGettingLocation: boolean;
  locationError: string | null;
  hasUserLocation?: boolean;
  onRequestLocation?: () => void | Promise<void>;
  availableFilters?: FilterKey[];
  /** Filters no beach in the colour group picked on the map legend has. Shown faded and
   *  unclickable rather than removed: dropping a chip mid-sheet shifts every chip after it, and
   *  a thumb already moving lands on whatever slid into the gap. */
  unavailableFilters?: FilterKey[];
  protectedSortLabel?: string;
  showProtectedSort?: boolean;
  /** Hide the "near me" (distance) sort option — on mobile it lives in the dedicated front button instead. */
  hideDistanceSort?: boolean;
  /** Hide the whole sort section — on mobile the sort (Όλες / Καταλληλότερες) is surfaced as
   *  quick selectors outside the sheet, so it must not be duplicated here. */
  hideSortSection?: boolean;
  getResultCount?: (filters: FilterKey[], sortBy: SortOption) => number;
  onResultCountChange?: (count: number) => void;
  language: LanguageCode;
}


const filterIcons: Record<string, React.ReactNode> = {
  organized: <BadgeCheck className="h-5 w-5 shrink-0" />,
  naturalShade: <Trees className="h-5 w-5 shrink-0" />,
  taverna: <Utensils className="h-5 w-5 shrink-0" />,
  beachBar: <Martini className="h-5 w-5 shrink-0" />,
  sunbeds: <SunbedIcon className="h-5 w-5 shrink-0" />,
  parking: <ParkingCircle className="h-5 w-5 shrink-0" />,
  shower: <ShowerHead className="h-5 w-5 shrink-0" />,
  sandy: <SandDotsIcon className="h-5 w-5 shrink-0" />,
  pebbles: <CircleDot className="h-5 w-5 shrink-0" />,
  quiet: <VolumeX className="h-5 w-5 shrink-0" />,
  snorkeling: <Search className="h-5 w-5 shrink-0" />,
  adventure: <MapPin className="h-5 w-5 shrink-0" />,
  sunset: <Sunset className="h-5 w-5 shrink-0" />,
  naturist: <PersonStanding className="h-5 w-5 shrink-0" />,
  familyFriendly: <Users className="h-5 w-5 shrink-0" />,
  'sandy-pebbles': <SandPebblesIcon className="h-5 w-5 shrink-0" />,
  rocky: <Mountain className="h-5 w-5 shrink-0" />,
  deepWaters: <ArrowDown className="h-5 w-5 shrink-0" />,
  shallowWaters: <ArrowUp className="h-5 w-5 shrink-0" />,
  easyAccess: <CheckCircle2 className="h-5 w-5 shrink-0" />,
  disabledAccess: <Accessibility className="h-5 w-5 shrink-0" />,
  showAll: <Globe className="h-5 w-5 shrink-0" />,
};

const filterSheetCopy: Record<LanguageCode, {
  quick: string;
  selected: string;
  amenities: string;
  beachAndWater: string;
  experience: string;
  more: string;
  sort: string;
  nearMe: string;
  seeResults: (count: number) => string;
  /** Shown only when the picked attributes exist in the region but none of them is suitable today. */
  noneSuitable: string;
  seeAllInstead: (count: number) => string;
}> = {
  en: {
    quick: 'Most useful',
    selected: 'Active filters',
    amenities: 'Amenities',
    beachAndWater: 'Sand & water',
    experience: 'Experience',
    more: 'More filters',
    sort: 'Sort',
    nearMe: 'Near me',
    seeResults: (count) => `See ${count} beaches`,
    noneSuitable: 'None of these is suitable today.',
    seeAllInstead: (count) => `Show all ${count} anyway`,
  },
  gr: {
    quick: 'Πιο χρήσιμα',
    selected: 'Ενεργά φίλτρα',
    amenities: 'Παροχές',
    beachAndWater: 'Άμμος & νερά',
    experience: 'Εμπειρία',
    more: 'Περισσότερα',
    sort: 'Ταξινόμηση',
    nearMe: 'Κοντά μου',
    seeResults: (count) => `Δες ${count} παραλίες`,
    noneSuitable: 'Καμία από αυτές δεν είναι κατάλληλη σήμερα.',
    seeAllInstead: (count) => `Δες τις ${count} έτσι κι αλλιώς`,
  },
  fr: {
    quick: 'Les plus utiles',
    selected: 'Filtres actifs',
    amenities: 'Services',
    beachAndWater: 'Sable et eau',
    experience: 'Experience',
    more: 'Plus de filtres',
    sort: 'Tri',
    nearMe: 'Pres de moi',
    seeResults: (count) => `Voir ${count} plages`,
    noneSuitable: "Aucune d'elles n'est adaptée aujourd'hui.",
    seeAllInstead: (count) => `Voir les ${count} quand même`,
  },
  de: {
    quick: 'Am wichtigsten',
    selected: 'Aktive Filter',
    amenities: 'Ausstattung',
    beachAndWater: 'Sand und Wasser',
    experience: 'Erlebnis',
    more: 'Weitere Filter',
    sort: 'Sortierung',
    nearMe: 'In der Nahe',
    seeResults: (count) => `${count} Strande anzeigen`,
    noneSuitable: 'Keiner davon ist heute geeignet.',
    seeAllInstead: (count) => `Trotzdem alle ${count} zeigen`,
  },
  it: {
    quick: 'Più utili',
    selected: 'Filtri attivi',
    amenities: 'Servizi',
    beachAndWater: 'Sabbia e acqua',
    experience: 'Esperienza',
    more: 'Altri filtri',
    sort: 'Ordina',
    nearMe: 'Vicino a me',
    seeResults: (count) => `Vedi ${count} spiagge`,
    noneSuitable: 'Nessuna di queste è adatta oggi.',
    seeAllInstead: (count) => `Mostra comunque tutte e ${count}`,
  },
};

type FilterSectionTitleKey = 'quick' | 'amenities' | 'beachAndWater' | 'experience' | 'more';

const filterGroupDefinitions: Array<{ id: string; titleKey: FilterSectionTitleKey; filters: FilterKey[] }> = [
  { id: 'quick', titleKey: 'quick', filters: ['familyFriendly', 'beachBar', 'quiet', 'easyAccess', 'disabledAccess'] },
  { id: 'amenities', titleKey: 'amenities', filters: ['taverna', 'sunbeds', 'parking', 'shower', 'naturalShade'] },
  { id: 'beachAndWater', titleKey: 'beachAndWater', filters: ['sandy', 'pebbles', 'sandy-pebbles', 'rocky', 'shallowWaters', 'deepWaters'] },
  { id: 'experience', titleKey: 'experience', filters: ['snorkeling', 'adventure', 'sunset', 'naturist'] },
];

const hiddenUserFacingFilters = new Set<FilterKey>(['organized']);
const removeHiddenUserFacingFilters = (filters: FilterKey[]): FilterKey[] => (
    filters.filter(filter => !hiddenUserFacingFilters.has(filter))
);

export const CombinedFilter: React.FC<CombinedFilterProps> = ({ 
    initialSelectedFilters, 
    initialSortBy, 
    initialDistanceWithinSuitable = false,
    onApplyFilters,
    onResetAll,
    t,
    isGettingLocation,
    locationError,
    hasUserLocation = false,
    onRequestLocation,
    availableFilters,
    unavailableFilters,
    protectedSortLabel,
    showProtectedSort = true,
    hideDistanceSort = false,
    hideSortSection = false,
    getResultCount,
    onResultCountChange,
    language,
}) => {
    // Internal state for temporary changes
    const normalizeInitialSort = useCallback((sortBy: SortOption): SortOption => (
        !showProtectedSort && sortBy === 'protected' ? 'all' : sortBy
    ), [showProtectedSort]);
    const [tempFilters, setTempFilters] = useState<FilterKey[]>(() => removeHiddenUserFacingFilters(initialSelectedFilters));
    const [tempSortBy, setTempSortBy] = useState<SortOption>(() => normalizeInitialSort(initialSortBy));
    const [tempDistanceWithinSuitable, setTempDistanceWithinSuitable] = useState(initialDistanceWithinSuitable);

    // Sync internal state if the modal is reopened with different initial props
    useEffect(() => {
        setTempFilters(removeHiddenUserFacingFilters(initialSelectedFilters));
        setTempSortBy(normalizeInitialSort(initialSortBy));
        setTempDistanceWithinSuitable(showProtectedSort ? initialDistanceWithinSuitable : false);
    }, [initialDistanceWithinSuitable, initialSelectedFilters, initialSortBy, normalizeInitialSort, showProtectedSort]);

    const handleFilterChange = useCallback((filter: FilterKey | 'all') => {
        if (filter === 'all') {
            setTempFilters([]);
            return;
        }

        setTempFilters(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(filter)) {
                newSelection.delete(filter);
            } else {
                newSelection.add(filter);
                if (filter === 'shallowWaters' && newSelection.has('deepWaters')) {
                    newSelection.delete('deepWaters');
                }
                if (filter === 'deepWaters' && newSelection.has('shallowWaters')) {
                    newSelection.delete('shallowWaters');
                }
            }
            return Array.from(newSelection);
        });
    }, []);

    const handleProtectedSortClick = useCallback(() => {
        if (tempSortBy === 'distance') {
            setTempDistanceWithinSuitable(true);
        }
        setTempSortBy('protected');
    }, [tempSortBy]);

    const handleAllSortClick = useCallback(() => {
        // "Όλες" always means show all beaches — never silently switch to distance.
        // (Previously, coming from suitable + distance-within-suitable — the default state in
        // the "Κοντά μου" region — tapping All flipped to 'distance', so the list stayed on the
        // suitable view instead of showing everything.)
        setTempSortBy('all');
        setTempDistanceWithinSuitable(false);
    }, []);

    const handleDistanceSortClick = useCallback(() => {
        if (tempSortBy === 'protected') {
            if (!tempDistanceWithinSuitable && !hasUserLocation) {
                void onRequestLocation?.();
            }
            setTempDistanceWithinSuitable(current => !current);
            return;
        }

        if (tempSortBy !== 'distance' && !hasUserLocation) {
            void onRequestLocation?.();
        }
        setTempSortBy(current => current === 'distance' ? 'all' : 'distance');
        setTempDistanceWithinSuitable(false);
    }, [hasUserLocation, onRequestLocation, tempDistanceWithinSuitable, tempSortBy]);

    const handleReset = () => {
        setTempFilters([]);
        setTempSortBy(showProtectedSort ? 'protected' : 'all');
        setTempDistanceWithinSuitable(false);
        // Also clear the app-level state the sheet doesn't own (quick preferences + search),
        // so reset actually clears everything — including a stuck preference that shows as an
        // active count with no selected chip here.
        onResetAll?.();
    };
    const handleApply = () => {
        // The button offered «Όλες» — applying has to actually deliver it, or the offer is a lie.
        const appliedSortBy = normalizeInitialSort(shouldOfferAllInstead ? 'all' : tempSortBy);
        onApplyFilters(tempFilters, appliedSortBy, {
            distanceWithinSuitable: appliedSortBy === 'protected' && tempDistanceWithinSuitable,
        });
    };

    const availableFilterSet = availableFilters ? new Set<FilterKey>(availableFilters) : undefined;
    const unavailableFilterSet = new Set<FilterKey>(unavailableFilters ?? []);
    const filters = (Object.keys(t.filterOptions)
        .filter(k => k !== 'showAll' && k !== 'restaurant' && k !== 'unknown' && !hiddenUserFacingFilters.has(k as FilterKey)) as FilterKey[])
        .filter(filter => !availableFilterSet || availableFilterSet.has(filter) || tempFilters.includes(filter));
    const liveResultCount = useMemo(() => (
        getResultCount ? getResultCount(tempFilters, tempSortBy) : undefined
    ), [getResultCount, tempFilters, tempSortBy]);
    /**
     * THE DEAD END, AND THE WAY OUT OF IT (Μίλτος, 12/08/2026).
     *
     * «Καταλληλότερες» judges the day, not the region: on a windy afternoon a perfectly real set
     * of beach-bar beaches can be nothing but red, and the honest answer to «Δες N» is zero. That
     * answer is also useless on its own — the beaches ARE there, one tap away under «Όλες», and
     * the visitor has no way of knowing that from a greyed-out button.
     *
     * So when the suitable view is empty and the all view is not, the button stops pretending and
     * offers the thing that exists: it says so in words above, and applying switches the sort. One
     * tap, no guessing, and the number on it is true either way.
     */
    const allViewResultCount = useMemo(() => (
        getResultCount && tempSortBy !== 'all' ? getResultCount(tempFilters, 'all') : undefined
    ), [getResultCount, tempFilters, tempSortBy]);
    const shouldOfferAllInstead = liveResultCount === 0 && (allViewResultCount ?? 0) > 0;

    /**
     * A chip that would empty the list must not be tappable — the same rule the desktop chip
     * row already applies (BeachSearcherHome: faceted count 0 → fade + disable). The prop
     * `unavailableFilters` only knows about the picked colour group and judges each filter on
     * its own, so on mobile a COMBINATION that yields nothing was still tappable. Ask the
     * sheet's own counter — the one behind the "see N beaches" button — the same question per
     * chip: with this added to what is already picked, what is left? Zero → disabled.
     *
     * Only unselected chips are judged: turning a filter OFF always opens the list back up, so
     * an already-picked chip stays tappable even when the current selection returns nothing.
     *
     * Counted against sort 'all' on purpose, never the live 'protected' sort. We are answering
     * "do these attributes exist together in this region", not "is it windy today" — on a 6 Bft
     * day the protected count is near zero for EVERY chip and the whole sheet would grey out,
     * hiding a real choice (switch the sort) behind what looks like a broken screen.
     *
     * Keyed on joined strings, not the arrays/callback themselves: `filters` is rebuilt on every
     * render and `getResultCount` is a fresh closure from App each time, so raw deps would rerun
     * ~20 count passes on every unrelated re-render while the sheet is open.
     */
    const getResultCountRef = useRef(getResultCount);
    getResultCountRef.current = getResultCount;
    const filtersKey = filters.join('|');
    const tempFiltersKey = tempFilters.join('|');
    const emptyingFilters = useMemo(() => {
        const empties = new Set<FilterKey>();
        const countFor = getResultCountRef.current;
        if (!countFor) return empties;

        const selected = new Set(tempFilters);
        filters.forEach(filter => {
            if (selected.has(filter)) return;
            if (countFor([...tempFilters, filter], 'all') === 0) {
                empties.add(filter);
            }
        });
        return empties;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey, tempFiltersKey]);

    const sheetCopy = filterSheetCopy[language];
    const displayGroups = filterGroupDefinitions
        .map(group => ({
            ...group,
            filters: group.filters.filter(filter => filters.includes(filter)),
        }))
        .filter(group => group.filters.length > 0);
    const groupedFilters = new Set(displayGroups.flatMap(group => group.filters));
    const remainingFilters = filters.filter(filter => !groupedFilters.has(filter));
    const allGroups = remainingFilters.length > 0
        ? [...displayGroups, { id: 'more', titleKey: 'more' as FilterSectionTitleKey, filters: remainingFilters }]
        : displayGroups;
    const primaryGroup = allGroups.find(group => group.id === 'quick');
    const secondaryGroups = allGroups.filter(group => group.id !== 'quick');
    const activeFilterLabels = tempFilters
        .filter(filter => filters.includes(filter))
        .map(filter => ({ filter, label: t.filterOptions[filter] }));
    const sortOptions: Array<{
        id: 'all' | 'protected' | 'distance';
        label: string;
        icon: React.ReactNode;
        isVisible: boolean;
        isActive: boolean;
        onClick: () => void;
        isDisabled?: boolean;
    }> = [
        {
            id: 'all',
            label: t.sortByAll,
            icon: <Globe className="h-4 w-4" />,
            isVisible: true,
            isActive: tempSortBy === 'all',
            onClick: handleAllSortClick,
        },
        {
            id: 'protected',
            label: protectedSortLabel ?? t.sortByProtected,
            icon: <ShieldCheck className="h-4 w-4" />,
            isVisible: showProtectedSort,
            isActive: tempSortBy === 'protected' && !tempDistanceWithinSuitable,
            onClick: handleProtectedSortClick,
        },
        {
            id: 'distance',
            label: isGettingLocation ? t.gettingLocation : sheetCopy.nearMe,
            icon: <MapPin className="h-4 w-4" />,
            isVisible: !hideDistanceSort,
            isActive: tempSortBy === 'distance' || (tempSortBy === 'protected' && tempDistanceWithinSuitable),
            onClick: handleDistanceSortClick,
            isDisabled: isGettingLocation,
        },
    ];
    const visibleSortOptions = sortOptions
        .filter(option => option.isVisible)
        .sort((a, b) => {
            if (a.id === 'protected') return -1;
            if (b.id === 'protected') return 1;
            return 0;
        });

    // The badge beside the sheet's title counts the same beaches the button promises — including
    // when the button has fallen back to «Όλες», or the two would contradict each other on screen.
    const headerResultCount = shouldOfferAllInstead ? allViewResultCount : liveResultCount;
    useEffect(() => {
        if (!onResultCountChange || typeof headerResultCount !== 'number') return;
        onResultCountChange(headerResultCount);
    }, [headerResultCount, onResultCountChange]);

    const renderFilterButton = (filter: FilterKey, compact = false) => {
        const isSelected = tempFilters.includes(filter);
        const isUnavailable = !isSelected && (unavailableFilterSet.has(filter) || emptyingFilters.has(filter));
        return (
            <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                disabled={isUnavailable}
                aria-pressed={isSelected}
                aria-label={`${t.toggleFilterForLabel} ${t.filterOptions[filter]}`}
                title={filter === 'organized' ? t.organizedTooltip : undefined}
                /* ΤΟ ΓΕΜΙΣΜΑ ΤΟΥ ΕΠΙΛΕΓΜΕΝΟΥ ΕΙΝΑΙ ΤΟ CTA ΤΗΣ ΜΑΡΚΑΣ, ΟΧΙ cyan-600 (28/08/2026).
                   Μετρημένο: λευκό πάνω σε #0891b2 δίνει 3,68:1, κάτω από το 4,5 που ζητάει το
                   WCAG AA — και δεν είναι μία γωνία της οθόνης, είναι κάθε πατημένο φίλτρο και
                   το κουμπί που κλείνει το φύλλο. Το #007a83 (--color-cta) δίνει 5,11:1 και δεν
                   είναι νέο χρώμα: είναι αυτό που μπήκε στις 05/08 ακριβώς γι' αυτόν τον λόγο
                   σε όλο το υπόλοιπο site (βλ. σχόλιο στο index.css). Το φύλλο των φίλτρων απλώς
                   δεν είχε περάσει από εκείνη τη σάρωση. */
                className={`inline-flex min-h-10 items-center justify-center rounded-control border px-3 py-2 text-sm font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-cyan-600/30 ${
                    compact ? 'gap-1.5' : 'gap-2'
                } ${
                    isSelected
                        ? 'border-cta bg-cta text-white shadow-surface'
                        : 'border-line bg-surface text-slate-700 shadow-surface hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-slate-950'
                } ${isUnavailable ? 'cursor-not-allowed opacity-40 hover:border-line hover:bg-surface hover:text-slate-700' : ''}`}
            >
                {filterIcons[filter as string]}
                <span className="min-w-0 whitespace-normal text-center leading-tight">{t.filterOptions[filter]}</span>
                {isSelected && <CheckCircle2 className="ml-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
        );
    };

    const renderFilterSection = (title: string, sectionFilters: FilterKey[], compact = false) => (
        <section key={title} className="space-y-2.5">
            <h3 className="px-0.5 text-sm font-bold tracking-normal text-slate-600">{title}</h3>
            <div className={`grid gap-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {sectionFilters.map(filter => renderFilterButton(filter, compact))}
            </div>
        </section>
    );

    // ΧΩΡΙΣ ΠΛΑΙΣΙΟ (28/08/2026): ήταν το μόνο πράγμα στο φύλλο μέσα σε κάρτα με περίγραμμα,
    // δαχτυλίδι ΚΑΙ σκιά — και μέσα της δύο ακόμη κουτιά. Η ταξινόμηση ξεχωρίζει από τη θέση
    // της (πρώτη) και από τον τίτλο της, όπως κάθε άλλη ομάδα εδώ μέσα· δεν χρειάζεται και
    // κορνίζα. Ο τίτλος παίρνει το ίδιο βάρος με τους υπόλοιπους («Πιο χρήσιμα», «Παροχές»).
    const renderSortSection = () => (
        <section>
            <h3 id="sort-heading" className="mb-2.5 px-0.5 text-sm font-bold tracking-normal text-slate-600">{sheetCopy.sort}</h3>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="sort-heading">
                {visibleSortOptions.map(option => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={option.onClick}
                        disabled={option.isDisabled}
                        className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold leading-snug transition focus:outline-none focus:ring-2 focus:ring-cyan-600/30 disabled:cursor-wait disabled:opacity-60 ${
                            visibleSortOptions.length === 3 && option.id === 'protected' ? 'col-span-2' : ''
                        } ${
                            option.isActive
                                ? 'border-cta bg-cta text-white shadow-surface'
                                : 'border-line bg-surface text-slate-700 shadow-surface hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-slate-950'
                        }`}
                    >
                        {option.icon}
                        <span className="min-w-0 whitespace-normal text-center">{option.label}</span>
                    </button>
                ))}
            </div>
            {locationError && (
                <p className="mt-2 text-sm text-red-600" role="alert">{locationError}</p>
            )}
        </section>
    );

    return (
        <div className="space-y-5">
            {activeFilterLabels.length > 0 && (
                <section className="rounded-surface border border-cyan-100 bg-cyan-50/55 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold tracking-normal text-cyan-800">{sheetCopy.selected}</h3>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100">
                            {activeFilterLabels.length}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeFilterLabels.map(({ filter, label }) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => handleFilterChange(filter)}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-xs font-bold text-cyan-800 shadow-sm shadow-cyan-900/4"
                            >
                                <span>{label}</span>
                                <span className="text-cyan-700" aria-hidden="true">x</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {!hideSortSection && renderSortSection()}

            <div className="space-y-5" role="group" aria-labelledby="filters-heading">
                <h3 id="filters-heading" className="sr-only">{t.filterTitle}</h3>
                {primaryGroup && renderFilterSection(sheetCopy[primaryGroup.titleKey], primaryGroup.filters, true)}
            </div>

            <div className="space-y-5 pb-24" role="group" aria-label={sheetCopy.more}>
                {secondaryGroups.map(group => renderFilterSection(sheetCopy[group.titleKey], group.filters))}
            </div>

            <div className="sticky bottom-0 border-t border-line bg-canvas pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
                {/* Amber is a register here ("this is not what you asked for"), not a tone claim. */}
                {shouldOfferAllInstead && (
                    <p role="status" className="mb-2 text-center text-xs font-bold leading-snug text-amber-900">
                        {sheetCopy.noneSuitable}
                    </p>
                )}
                <div className="flex items-center gap-3">
                <button onClick={handleReset} className="min-h-12 shrink rounded-control bg-surface px-3 py-2.5 text-sm font-bold text-slate-600 shadow-surface ring-1 ring-line transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/40 sm:px-4">
                    {t.resetFilters}
                </button>
                <button onClick={handleApply} className="min-h-12 flex-1 shrink-0 basis-1/2 rounded-control bg-cta px-3 py-2.5 text-sm font-extrabold text-white shadow-lifted transition hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-cyan-600/35 sm:px-4">
                    {shouldOfferAllInstead && typeof allViewResultCount === 'number'
                        ? sheetCopy.seeAllInstead(allViewResultCount)
                        : typeof liveResultCount === 'number'
                            ? sheetCopy.seeResults(liveResultCount)
                            : t.applyFilters}
                </button>
                </div>
            </div>
        </div>
    );
};

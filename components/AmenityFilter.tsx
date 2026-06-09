
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FilterKey, LanguageCode, SortOption } from '../types';
import { Translation } from '../types';
import { 
  Trees, 
  Utensils, 
  Waves, 
  ParkingCircle, 
  CircleDot, 
  Mountain, 
  BadgeCheck,
  Search,
  Users,
  VolumeX,
  ArrowDown, 
  ArrowUp, 
  CheckCircle2, 
  Globe,
  MapPin,
  ShieldCheck
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
  t: Translation;
  isGettingLocation: boolean;
  locationError: string | null;
  hasUserLocation?: boolean;
  onRequestLocation?: () => void | Promise<void>;
  availableFilters?: FilterKey[];
  protectedSortLabel?: string;
  showProtectedSort?: boolean;
  getResultCount?: (filters: FilterKey[], sortBy: SortOption) => number;
  onResultCountChange?: (count: number) => void;
  language: LanguageCode;
}


const filterIcons: Record<string, React.ReactNode> = {
  organized: <BadgeCheck className="h-5 w-5 shrink-0" />,
  naturalShade: <Trees className="h-5 w-5 shrink-0" />,
  taverna: <Utensils className="h-5 w-5 shrink-0" />,
  beachBar: <Waves className="h-5 w-5 shrink-0" />,
  sunbeds: <SunbedIcon className="h-5 w-5 shrink-0" />,
  parking: <ParkingCircle className="h-5 w-5 shrink-0" />,
  sandy: <SandDotsIcon className="h-5 w-5 shrink-0" />,
  pebbles: <CircleDot className="h-5 w-5 shrink-0" />,
  quiet: <VolumeX className="h-5 w-5 shrink-0" />,
  snorkeling: <Search className="h-5 w-5 shrink-0" />,
  adventure: <MapPin className="h-5 w-5 shrink-0" />,
  familyFriendly: <Users className="h-5 w-5 shrink-0" />,
  'sandy-pebbles': <SandPebblesIcon className="h-5 w-5 shrink-0" />,
  rocky: <Mountain className="h-5 w-5 shrink-0" />,
  deepWaters: <ArrowDown className="h-5 w-5 shrink-0" />,
  shallowWaters: <ArrowUp className="h-5 w-5 shrink-0" />,
  easyAccess: <CheckCircle2 className="h-5 w-5 shrink-0" />,
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
  },
  it: {
    quick: 'Piu utili',
    selected: 'Filtri attivi',
    amenities: 'Servizi',
    beachAndWater: 'Sabbia e acqua',
    experience: 'Esperienza',
    more: 'Altri filtri',
    sort: 'Ordina',
    nearMe: 'Vicino a me',
    seeResults: (count) => `Vedi ${count} spiagge`,
  },
};

type FilterSectionTitleKey = 'quick' | 'amenities' | 'beachAndWater' | 'experience' | 'more';

const filterGroupDefinitions: Array<{ id: string; titleKey: FilterSectionTitleKey; filters: FilterKey[] }> = [
  { id: 'quick', titleKey: 'quick', filters: ['familyFriendly', 'beachBar', 'quiet', 'easyAccess'] },
  { id: 'amenities', titleKey: 'amenities', filters: ['taverna', 'sunbeds', 'parking', 'organized', 'naturalShade'] },
  { id: 'beachAndWater', titleKey: 'beachAndWater', filters: ['sandy', 'pebbles', 'sandy-pebbles', 'rocky', 'shallowWaters', 'deepWaters'] },
  { id: 'experience', titleKey: 'experience', filters: ['snorkeling', 'adventure'] },
];

export const CombinedFilter: React.FC<CombinedFilterProps> = ({ 
    initialSelectedFilters, 
    initialSortBy, 
    initialDistanceWithinSuitable = false,
    onApplyFilters,
    t,
    isGettingLocation,
    locationError,
    hasUserLocation = false,
    onRequestLocation,
    availableFilters,
    protectedSortLabel,
    showProtectedSort = true,
    getResultCount,
    onResultCountChange,
    language,
}) => {
    // Internal state for temporary changes
    const normalizeInitialSort = useCallback((sortBy: SortOption): SortOption => (
        !showProtectedSort && sortBy === 'protected' ? 'all' : sortBy
    ), [showProtectedSort]);
    const [tempFilters, setTempFilters] = useState<FilterKey[]>(initialSelectedFilters);
    const [tempSortBy, setTempSortBy] = useState<SortOption>(() => normalizeInitialSort(initialSortBy));
    const [tempDistanceWithinSuitable, setTempDistanceWithinSuitable] = useState(initialDistanceWithinSuitable);

    // Sync internal state if the modal is reopened with different initial props
    useEffect(() => {
        setTempFilters(initialSelectedFilters);
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
        if (tempSortBy === 'protected' && tempDistanceWithinSuitable) {
            setTempSortBy('distance');
        } else if (tempSortBy !== 'distance') {
            setTempSortBy('all');
        }
        setTempDistanceWithinSuitable(false);
    }, [tempDistanceWithinSuitable, tempSortBy]);

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
    };
    const handleApply = () => {
        const appliedSortBy = normalizeInitialSort(tempSortBy);
        onApplyFilters(tempFilters, appliedSortBy, {
            distanceWithinSuitable: appliedSortBy === 'protected' && tempDistanceWithinSuitable,
        });
    };

    const availableFilterSet = availableFilters ? new Set<FilterKey>(availableFilters) : undefined;
    const filters = (Object.keys(t.filterOptions)
        .filter(k => k !== 'showAll' && k !== 'restaurant' && k !== 'unknown') as FilterKey[])
        .filter(filter => !availableFilterSet || availableFilterSet.has(filter) || tempFilters.includes(filter));
    const liveResultCount = useMemo(() => (
        getResultCount ? getResultCount(tempFilters, tempSortBy) : undefined
    ), [getResultCount, tempFilters, tempSortBy]);

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
            isVisible: true,
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

    useEffect(() => {
        if (!onResultCountChange || typeof liveResultCount !== 'number') return;
        onResultCountChange(liveResultCount);
    }, [liveResultCount, onResultCountChange]);

    const renderFilterButton = (filter: FilterKey, compact = false) => {
        const isSelected = tempFilters.includes(filter);
        return (
            <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                aria-pressed={isSelected}
                aria-label={`${t.toggleFilterForLabel} ${t.filterOptions[filter]}`}
                title={filter === 'organized' ? t.organizedTooltip : undefined}
                className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-cyan-600/30 ${
                    compact ? 'gap-1.5' : 'gap-2'
                } ${
                    isSelected
                        ? 'border-cyan-600 bg-cyan-600 text-white shadow-md shadow-cyan-700/20'
                        : 'border-slate-200 bg-white/82 text-slate-700 shadow-sm shadow-slate-900/5 hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-slate-950'
                }`}
            >
                {filterIcons[filter as string]}
                <span className="truncate">{t.filterOptions[filter]}</span>
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

    const renderSortSection = () => (
        <section className="rounded-2xl border border-cyan-200 bg-white/92 p-3 shadow-sm shadow-cyan-900/8 ring-1 ring-cyan-50">
            <h3 id="sort-heading" className="mb-3 px-0.5 text-base font-extrabold tracking-normal text-slate-900">{sheetCopy.sort}</h3>
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
                                ? 'border-cyan-600 bg-cyan-600 text-white shadow-md shadow-cyan-700/20'
                                : 'border-slate-200 bg-slate-50/80 text-slate-700 shadow-sm shadow-slate-900/5 hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-slate-950'
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
                <section className="rounded-2xl border border-cyan-100 bg-cyan-50/55 p-3">
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

            {renderSortSection()}

            <div className="space-y-5" role="group" aria-labelledby="filters-heading">
                <h3 id="filters-heading" className="sr-only">{t.filterTitle}</h3>
                {primaryGroup && renderFilterSection(sheetCopy[primaryGroup.titleKey], primaryGroup.filters, true)}
            </div>

            <div className="space-y-5 pb-24" role="group" aria-label={sheetCopy.more}>
                {secondaryGroups.map(group => renderFilterSection(sheetCopy[group.titleKey], group.filters))}
            </div>

            <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200/85 bg-slate-50/96 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_28px_rgba(15,23,42,0.06)] backdrop-blur">
                <button onClick={handleReset} className="min-h-12 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400/40">
                    {t.resetFilters}
                </button>
                <button onClick={handleApply} className="min-h-12 flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-600/35">
                    {typeof liveResultCount === 'number' ? sheetCopy.seeResults(liveResultCount) : t.applyFilters}
                </button>
            </div>
        </div>
    );
};

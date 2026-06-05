
import React, { useState, useEffect, useCallback } from 'react';
import { FilterKey, SortOption } from '../types';
import { Translation } from '../types';
import { 
  Umbrella, 
  Trees, 
  Utensils, 
  Waves, 
  ParkingCircle, 
  CircleDot, 
  Layers, 
  Mountain, 
  Sparkles,
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
  availableFilters?: FilterKey[];
  protectedSortLabel?: string;
  getResultCount?: (filters: FilterKey[], sortBy: SortOption) => number;
  onResultCountChange?: (count: number) => void;
}


const filterIcons: Record<string, React.ReactNode> = {
  organized: <BadgeCheck className="h-5 w-5 mr-2" />,
  naturalShade: <Trees className="h-5 w-5 mr-2" />,
  taverna: <Utensils className="h-5 w-5 mr-2" />,
  beachBar: <Waves className="h-5 w-5 mr-2" />,
  sunbeds: <Umbrella className="h-5 w-5 mr-2" />,
  parking: <ParkingCircle className="h-5 w-5 mr-2" />,
  sandy: <Sparkles className="h-5 w-5 mr-2" />,
  pebbles: <CircleDot className="h-5 w-5 mr-2" />,
  quiet: <VolumeX className="h-5 w-5 mr-2" />,
  snorkeling: <Search className="h-5 w-5 mr-2" />,
  familyFriendly: <Users className="h-5 w-5 mr-2" />,
  'sandy-pebbles': <Layers className="h-5 w-5 mr-2" />,
  rocky: <Mountain className="h-5 w-5 mr-2" />,
  deepWaters: <ArrowDown className="h-5 w-5 mr-2" />,
  shallowWaters: <ArrowUp className="h-5 w-5 mr-2" />,
  easyAccess: <CheckCircle2 className="h-5 w-5 mr-2" />,
  showAll: <Globe className="h-5 w-5 mr-2" />,
};

export const CombinedFilter: React.FC<CombinedFilterProps> = ({ 
    initialSelectedFilters, 
    initialSortBy, 
    initialDistanceWithinSuitable = false,
    onApplyFilters,
    t,
    isGettingLocation,
    locationError,
    availableFilters,
    protectedSortLabel,
    getResultCount,
    onResultCountChange,
}) => {
    // Internal state for temporary changes
    const [tempFilters, setTempFilters] = useState<FilterKey[]>(initialSelectedFilters);
    const [tempSortBy, setTempSortBy] = useState<SortOption>(initialSortBy);
    const [tempDistanceWithinSuitable, setTempDistanceWithinSuitable] = useState(initialDistanceWithinSuitable);

    // Sync internal state if the modal is reopened with different initial props
    useEffect(() => {
        setTempFilters(initialSelectedFilters);
        setTempSortBy(initialSortBy);
        setTempDistanceWithinSuitable(initialDistanceWithinSuitable);
    }, [initialDistanceWithinSuitable, initialSelectedFilters, initialSortBy]);

    useEffect(() => {
        if (!getResultCount || !onResultCountChange) return;
        onResultCountChange(getResultCount(tempFilters, tempSortBy));
    }, [getResultCount, onResultCountChange, tempFilters, tempSortBy]);

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
            setTempDistanceWithinSuitable(current => !current);
            return;
        }

        setTempSortBy(current => current === 'distance' ? 'all' : 'distance');
        setTempDistanceWithinSuitable(false);
    }, []);

    const handleReset = () => {
        setTempFilters([]);
        setTempSortBy('protected');
        setTempDistanceWithinSuitable(false);
    };
    const handleApply = () => {
        onApplyFilters(tempFilters, tempSortBy, {
            distanceWithinSuitable: tempSortBy === 'protected' && tempDistanceWithinSuitable,
        });
    };

    const availableFilterSet = availableFilters ? new Set<FilterKey>(availableFilters) : undefined;
    const filters = (Object.keys(t.filterOptions)
        .filter(k => k !== 'showAll' && k !== 'restaurant') as FilterKey[])
        .filter(filter => !availableFilterSet || availableFilterSet.has(filter) || tempFilters.includes(filter));

    const CheckmarkIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    );

    return (
        <>
            <div className="space-y-6">
                <div role="group" aria-labelledby="filters-heading">
                    <p id="filters-heading" className="text-sm text-slate-500 mb-4">{t.filterExplanation}</p>
                    <div className="flex flex-wrap gap-3">
                    {filters.map(filter => {
                        const isSelected = tempFilters.includes(filter);
                        return (
                        <button
                            key={filter}
                            onClick={() => handleFilterChange(filter)}
                            aria-pressed={isSelected}
                            aria-label={`${t.toggleFilterForLabel} ${t.filterOptions[filter]}`}
                            title={filter === 'organized' ? t.organizedTooltip : undefined}
                            className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 ${
                            isSelected
                                ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40 hover:shadow-xl hover:scale-[1.03]'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:scale-[1.03]'
                            }`}
                        >
                            {filterIcons[filter as string]}
                            {t.filterOptions[filter]}
                            {isSelected && <CheckmarkIcon />}
                        </button>
                        );
                    })}
                    </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200/60">
                    <h4 id="sort-heading" className="text-sm font-bold text-slate-600 mb-3">{t.sortByTitle}</h4>
                    <div className="flex flex-wrap gap-3" role="group" aria-labelledby="sort-heading">
                    <button
                        onClick={handleAllSortClick}
                        className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 ${
                        tempSortBy === 'all' || tempSortBy === 'distance'
                            ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40 hover:shadow-xl hover:scale-[1.03]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:scale-[1.03]'
                        }`}
                    >
                        <Globe className="h-5 w-5 mr-2" />
                        {t.sortByAll}
                    </button>
                    <button
                        onClick={handleProtectedSortClick}
                        className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 ${
                        tempSortBy === 'protected'
                            ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40 hover:shadow-xl hover:scale-[1.03]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:scale-[1.03]'
                        }`}
                    >
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        {protectedSortLabel ?? t.sortByProtected}
                    </button>
                    <button
                        onClick={handleDistanceSortClick}
                        disabled={isGettingLocation}
                        className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-wait ${
                        tempSortBy === 'distance' || (tempSortBy === 'protected' && tempDistanceWithinSuitable)
                            ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40 hover:shadow-xl hover:scale-[1.03]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:scale-[1.03]'
                        }`}
                    >
                        <MapPin className="h-5 w-5 mr-2" />
                        {isGettingLocation ? t.gettingLocation : t.sortByDistance}
                    </button>
                    </div>
                    {locationError && (
                        <p className="mt-2 text-sm text-red-600" role="alert">{locationError}</p>
                    )}
                </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-200/80 flex items-center justify-between gap-3">
                <button onClick={handleReset} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400">
                    {t.resetFilters}
                </button>
                <button onClick={handleApply} className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 shadow-md hover:shadow-lg">
                    {t.applyFilters}
                </button>
            </div>
        </>
    );
};

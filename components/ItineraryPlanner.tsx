
import React from 'react';
import { TravelStyle } from '../types';
import { ItineraryPlannerSkeleton } from './ItineraryPlannerSkeleton';
import ItineraryDisplay from './ItineraryDisplay';

interface ItineraryPlannerProps {
  duration: number;
  onDurationChange: (duration: number) => void;
  onGenerate: () => void;
  itinerary: string | null;
  isLoading: boolean;
  error: string | null;
  t: any;
  maxDuration: number;
  travelStyle: TravelStyle;
  onTravelStyleChange: (style: TravelStyle) => void;
  onSaveItinerary: (content: string) => void;
  isItinerarySaved: boolean;
}

const ItineraryPlanner: React.FC<ItineraryPlannerProps> = ({
  duration,
  onDurationChange,
  onGenerate,
  itinerary,
  isLoading,
  error,
  t,
  maxDuration,
  travelStyle,
  onTravelStyleChange,
  onSaveItinerary,
  isItinerarySaved,
}) => {
  // Allow from 1 up to maxDuration days
  const durationOptions = Array.from({ length: maxDuration }, (_, i) => i + 1);
  
  const availableTravelStyles: { id: TravelStyle; icon: React.ReactNode }[] = [
    { id: 'family', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.527-1.973 6.012 6.012 0 011.912 2.706C16.27 8.57 16.5 9.26 16.5 10c0 .74-.23 1.43-.668 1.973a6.012 6.012 0 01-1.912 2.706C13.488 14.27 13.026 14 12.5 14a1.5 1.5 0 01-1.5-1.5v-.5a2 2 0 00-4 0v.5A1.5 1.5 0 016 14c-.526 0-.988.27-1.332.727a6.012 6.012 0 01-1.912-2.706C3.73 11.43 3.5 10.74 3.5 10c0-.74.23-1.43.668-1.973z" /></svg> },
    { id: 'couple', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg> },
    { id: 'friends', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg> },
    { id: 'solo', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> },
  ];

  return (
    <div className="bg-[var(--color-foreground)] rounded-xl shadow-md border border-[var(--color-border)] p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </div>
        </div>
        <div>
            <h2 id="itinerary-heading" className="text-xl font-extrabold text-[var(--color-text-primary)]">{t.itineraryPlannerTitle}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t.itineraryPlannerDescription}</p>
        </div>
      </div>
      
       <div className="mt-6 space-y-4">
        <div>
            <label id="travel-style-label" className="block text-sm font-bold text-[var(--color-text-primary)] mb-2">{t.travelStyleTitle}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="radiogroup" aria-labelledby="travel-style-label">
                {availableTravelStyles.map(({ id, icon }) => {
                    const isSelected = travelStyle === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onTravelStyleChange(id)}
                            role="radio"
                            aria-checked={isSelected}
                            className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all duration-200 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                                isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                : 'bg-[var(--color-foreground)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-indigo-400'
                            }`}
                        >
                            {icon}
                            <span className="text-sm font-semibold">{t.travelStyles[id]}</span>
                        </button>
                    )
                })}
            </div>
        </div>
        <div>
            <label id="duration-label" className="block text-sm font-bold text-[var(--color-text-primary)] mb-2">{t.durationLabel}</label>
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-labelledby="duration-label">
            {durationOptions.map(d => (
                <button
                key={d}
                onClick={() => onDurationChange(d)}
                className={`min-w-[3rem] justify-center text-center px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    duration === d
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-[var(--color-foreground)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-indigo-400'
                }`}
                aria-pressed={duration === d}
                >
                {d} {t.days(d)}
                </button>
            ))}
            </div>
        </div>
      </div>


      <div className="mt-6">
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t.generatingMessage}
            </>
          ) : (
            t.generateButton
          )}
        </button>
      </div>
      
      {isLoading && <ItineraryPlannerSkeleton duration={duration} />}

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-r-lg" role="alert">
          <p className="font-bold">{t.errorTitle}</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {itinerary && !isLoading && !error && (
        <div className="mt-6 pt-6 border-t border-[var(--color-border)] animate-fade-in-up">
          <ItineraryDisplay content={itinerary} />
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => onSaveItinerary(itinerary)}
              disabled={isItinerarySaved}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 font-bold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              {isItinerarySaved ? t.savedItineraries.planSaved : t.savedItineraries.saveButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryPlanner;

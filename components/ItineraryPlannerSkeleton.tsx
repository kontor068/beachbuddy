import React from 'react';

interface ItineraryPlannerSkeletonProps {
  duration: number;
}

// FIX: Added export and completed the component structure.
export const ItineraryPlannerSkeleton: React.FC<ItineraryPlannerSkeletonProps> = ({ duration }) => {
  return (
    <div className="mt-6 pt-6 border-t border-[var(--color-border)] animate-pulse">
      <div className="space-y-2">
        {[...Array(duration)].map((_, index) => (
          <div key={index} className="bg-[var(--color-foreground)] rounded-lg border border-[var(--color-border)] overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-800/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 bg-[var(--color-skeleton-base)] rounded-md"></div>
                  <div className="h-6 bg-[var(--color-skeleton-base)] rounded w-48 sm:w-64"></div>
                </div>
                <div className="h-6 w-6 bg-[var(--color-skeleton-base)] rounded-full"></div>
              </div>
            </div>
            <div className="p-4 pt-2">
              <div className="space-y-2">
                <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-11/12"></div>
                <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
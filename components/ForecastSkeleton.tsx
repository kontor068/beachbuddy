import React from 'react';

const ForecastSkeleton: React.FC = () => {
  return (
    <div className="mb-8 mt-4">
      <div className="h-7 bg-[var(--color-skeleton-base)] rounded w-48 mb-4 px-4 md:px-6"></div>
      <div className="overflow-x-auto pb-4 -mb-4 no-scrollbar">
        <div className="flex gap-2 px-4 md:px-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-24 bg-[var(--color-foreground)] rounded-xl p-2 border-2 border-[var(--color-border)]">
              <div className="space-y-1 mb-1">
                  <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-10 mx-auto"></div>
                  <div className="h-3 bg-[var(--color-skeleton-base)] rounded w-12 mx-auto"></div>
              </div>
              <div className="h-10 w-10 bg-[var(--color-skeleton-base)] rounded-full mx-auto"></div>
               <div className="space-y-1 mt-1 mb-1">
                <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-8 mx-auto"></div>
                <div className="h-3 bg-[var(--color-skeleton-base)] rounded w-6 mx-auto"></div>
              </div>
              <div className="mt-1 pt-1 border-t border-[var(--color-border)]">
                <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-16 mx-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ForecastSkeleton;
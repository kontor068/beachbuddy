
import React from 'react';

const WindInfoSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-200/50 dark:bg-slate-800/50 rounded-xl p-6 m-4 md:m-6">
      {/* Header section skeleton */}
      <div className="flex items-start justify-between mb-2 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[var(--color-skeleton-base)] rounded-lg"></div>
          <div>
            <div className="h-7 bg-[var(--color-skeleton-base)] rounded w-48 mb-2"></div>
            <div className="h-5 bg-[var(--color-skeleton-base)] rounded w-32"></div>
          </div>
        </div>
        <div className="h-10 bg-[var(--color-skeleton-base)] rounded-lg w-28"></div>
      </div>

      {/* Last updated skeleton */}
      <div className="h-4 bg-[var(--color-skeleton-base)] rounded w-40 mb-6 mt-3"></div>

      {/* Compass and direction skeleton */}
      <div className="mt-2">
        <div className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap mb-6">
          <div className="w-24 h-24 bg-[var(--color-skeleton-base)] rounded-full"></div>
          <div className="h-7 bg-[var(--color-skeleton-base)] rounded w-44"></div>
        </div>
        
        {/* Wind strength skeleton */}
        <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg w-full">
            <div className="flex justify-center items-center mb-3">
                <div className="h-5 bg-[var(--color-skeleton-base)] rounded w-24 mr-4"></div>
                <div className="h-6 bg-[var(--color-skeleton-base)] rounded-full w-28"></div>
            </div>
            <div className="h-6 bg-[var(--color-skeleton-base)] rounded w-36 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

export default WindInfoSkeleton;


import React from 'react';
import { BeachCardSkeleton } from './BeachCard.tsx';
import WindInfoSkeleton from './WindInfoSkeleton.tsx';
import ForecastSkeleton from './ForecastSkeleton.tsx';

interface SkeletonLoaderProps {
  t: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ t }) => {
  return (
    <div className="animate-pulse">
      {/* WindInfo Skeleton */}
      <WindInfoSkeleton />
      
      {/* Forecast Skeleton */}
      <ForecastSkeleton />
      
      <div className="px-4 md:px-6 py-8">
        {/* Amenity Filter Skeleton */}
        <div className="px-4 md:px-6 py-6 mb-8 bg-[var(--color-foreground)] rounded-xl shadow-md border border-[var(--color-border)] -mt-4 space-y-4">
          <div className="h-6 bg-[var(--color-skeleton-base)] rounded w-1/3"></div>
          <div className="flex flex-wrap gap-3">
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded-lg w-16"></div>
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded-lg w-24"></div>
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded-lg w-28"></div>
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded-lg w-20"></div>
          </div>
        </div>

        {/* Sheltered Beaches Section Skeleton */}
        <section className="mb-16">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-5 bg-[var(--color-skeleton-base)] rounded w-3/4 mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <BeachCardSkeleton key={`shelter-skel-${i}`} />
            ))}
          </div>
        </section>

        {/* Exposed Beaches Section Skeleton */}
        <section>
          <div className="max-w-3xl mx-auto text-center mb-10">
            <div className="h-10 bg-[var(--color-skeleton-base)] rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-5 bg-[var(--color-skeleton-base)] rounded w-3/4 mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <BeachCardSkeleton key={`exposed-skel-${i}`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SkeletonLoader;
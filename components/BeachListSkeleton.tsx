import React from 'react';
import { BeachCardSkeleton } from './BeachCard.tsx';

const BeachListSkeleton: React.FC = () => {
  return (
    <div className="px-4 md:px-6 py-8">
      <section>
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="h-10 bg-[var(--color-skeleton-base)] rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-5 bg-[var(--color-skeleton-base)] rounded w-3/4 mx-auto"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <BeachCardSkeleton key={`list-skel-${i}`} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default BeachListSkeleton;
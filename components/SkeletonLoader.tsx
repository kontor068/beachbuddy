

import React from 'react';

interface SkeletonLoaderProps {
  t?: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = () => {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-sky-50/82 px-4 backdrop-blur-sm" role="status" aria-label="Loading">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/70 bg-white/86 shadow-lg shadow-sky-900/10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
      </div>
    </div>
  );
};

export default SkeletonLoader;

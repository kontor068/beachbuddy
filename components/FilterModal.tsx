import React, { useEffect } from 'react';
import { Translation } from '../types';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
  children: React.ReactNode;
  resultCount?: number;
}

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, t, children, resultCount }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/48 animate-fade-in sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
    >
      <div
        className="flex max-h-[95dvh] w-full max-w-2xl transform flex-col overflow-hidden rounded-t-[1.4rem] bg-slate-50 shadow-2xl transition-transform duration-300 animate-slide-up sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/96 px-4 py-3.5 backdrop-blur sm:px-5">
          <h2 id="filter-modal-title" className="flex min-w-0 items-center gap-2 text-xl font-bold text-slate-800">
            <span className="min-w-0 truncate">{t.filterTitle}</span>
            {typeof resultCount === 'number' && (
              <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100">
                {resultCount}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full"
            aria-label={t.closeModalLabel || 'Close'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 pb-0 pt-4 sm:px-6 sm:pt-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FilterModal;

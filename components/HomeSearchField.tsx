import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Search, Waves, X } from 'lucide-react';
import type { DirectorySearchSuggestion } from './BeachSearcherHome';

// Self-contained search field for the landing hero. It owns only its local UI
// state (dropdown open + keyboard-active index); every side effect (query
// changes, suggestions, submit, selection) is delegated to the SAME App
// handlers the region-view search uses, so the two surfaces never diverge in
// behaviour — only in markup.

export interface HomeSearchFieldLabels {
  searchAria: string;
  clearSearchAria: string;
  regionLabel: string;
  beachLabel: string;
  loading: string;
  noResults: string;
}

interface HomeSearchFieldProps {
  value: string;
  placeholder: string;
  labels: HomeSearchFieldLabels;
  suggestions: DirectorySearchSuggestion[];
  isSuggesting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestionSelect: (suggestion: DirectorySearchSuggestion) => void;
  autoFocus?: boolean;
}

export const HomeSearchField: React.FC<HomeSearchFieldProps> = ({
  value,
  placeholder,
  labels,
  suggestions,
  isSuggesting,
  onChange,
  onSubmit,
  onSuggestionSelect,
  autoFocus,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);
  const listId = useId();

  const canShow = value.trim().length >= 2;
  const shouldRenderSuggestions = isOpen && canShow && (suggestions.length > 0 || isSuggesting);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const select = (suggestion: DirectorySearchSuggestion) => {
    close();
    onSuggestionSelect(suggestion);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (canShow) setIsOpen(true);
      setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        select(suggestions[activeIndex]);
      }
      // Otherwise let the form's onSubmit fire (plain search).
    } else if (event.key === 'Escape') {
      close();
    }
  };

  return (
    <form
      ref={containerRef}
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        close();
        onSubmit();
      }}
      role="search"
    >
      <input
        type="search"
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shouldRenderSuggestions}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-label={labels.searchAria}
        autoComplete="off"
        spellCheck={false}
        inputMode="search"
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (canShow) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-14 w-full rounded-2xl border border-white/70 bg-white/90 px-5 pr-28 text-base font-medium text-slate-800 shadow-lg shadow-sky-900/10 outline-none ring-1 ring-white/50 backdrop-blur-md transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/25 sm:min-h-16 sm:rounded-full sm:text-lg"
      />

      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            close();
          }}
          className="absolute right-16 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/30"
          aria-label={labels.clearSearchAria}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <button
        type="submit"
        className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-slate-950 text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 sm:h-12 sm:w-12"
        aria-label={labels.searchAria}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>

      {shouldRenderSuggestions && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-sky-100 bg-white/98 text-left shadow-xl shadow-sky-950/12 ring-1 ring-white/70 backdrop-blur-xl"
        >
          {suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
              {suggestions.map((suggestion, index) => {
                const isActive = index === activeIndex;
                const kindLabel = suggestion.type === 'region' ? labels.regionLabel : labels.beachLabel;
                return (
                  <button
                    key={suggestion.id}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(suggestion)}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                      isActive ? 'bg-cyan-50 text-slate-950' : 'text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      suggestion.type === 'region' ? 'bg-cyan-50 text-[#007a83]' : 'bg-sky-50 text-sky-700'
                    }`}>
                      {suggestion.type === 'region' ? (
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Waves className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold leading-tight text-slate-950">
                        {suggestion.label}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight text-slate-700">
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-normal text-slate-700">
                          {kindLabel}
                        </span>
                        <span className="min-w-0 truncate">{suggestion.subtitle}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm font-semibold text-slate-700">
              {isSuggesting ? labels.loading : labels.noResults}
            </div>
          )}
        </div>
      )}
    </form>
  );
};

export default HomeSearchField;

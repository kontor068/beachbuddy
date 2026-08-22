import React, { startTransition, useEffect, useId, useRef, useState } from 'react';
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

// One state per wording. Long enough to finish reading a Greek sentence, short
// enough that the second wording is still on screen while the visitor decides.
const PLACEHOLDER_ROTATE_MS = 4000;

interface HomeSearchFieldProps {
  value: string;
  placeholder: string;
  /**
   * Optional SECOND wording. When it is given, the placeholder alternates
   * between `placeholder` and this one every 4s — and only then. Callers that
   * pass just `placeholder` get exactly the old, static behaviour.
   *
   * The rotation is deliberately confined to the placeholder: `labels.searchAria`
   * never changes, so a screen reader announces one stable name for this field
   * instead of a churning one. No aria-live either — this is a hint, not news.
   */
  placeholderAlt?: string;
  labels: HomeSearchFieldLabels;
  suggestions: DirectorySearchSuggestion[];
  isSuggesting: boolean;
  onChange: (value: string) => void;
  /** Takes the text actually in the box — see the note on `draft` below. */
  onSubmit: (query?: string) => void;
  onSuggestionSelect: (suggestion: DirectorySearchSuggestion) => void;
  autoFocus?: boolean;
}

export const HomeSearchField: React.FC<HomeSearchFieldProps> = ({
  value,
  placeholder,
  placeholderAlt,
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
  const [isFocused, setIsFocused] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);
  const listId = useId();

  /**
   * The field shows what was typed the moment it is typed; the rest of the page catches up
   * a beat later. Before this the box was driven straight off the page's own search state,
   * so one keypress meant one full re-render — the map, the list, all of it — before the
   * letter could appear. Measured on a throttled phone: 342ms for the first character and
   * ~90ms for each one after, which is a keyboard that visibly trails the thumb.
   *
   * `draft` is the urgent copy. The page is told inside a transition, so React is free to
   * throw that work away when the next character arrives and only finish the search the
   * visitor actually stopped on.
   */
  const [draft, setDraft] = useState(value);
  // What we last sent upward. A `value` equal to it is our own echo coming back and must not
  // overwrite whatever has been typed since; anything else is the page changing the text on
  // its own (the clear button, picking a suggestion, a restored query) and wins.
  const lastSentRef = useRef(value);
  useEffect(() => {
    if (value === lastSentRef.current) return;
    lastSentRef.current = value;
    setDraft(value);
  }, [value]);

  const canShow = draft.trim().length >= 2;
  const shouldRenderSuggestions = isOpen && canShow && (suggestions.length > 0 || isSuggesting);
  // The clear button only exists once something is typed. Reserving room for it
  // while the field is empty ate ~56px of a narrow phone and clipped the
  // placeholder, so the right padding tracks what is actually rendered.
  const hasValue = draft.trim().length > 0;

  // The placeholder only ever moves while the field is IDLE — nothing typed and
  // nobody in it. Swapping the wording under someone who is reading it, or
  // behind a value they have already entered, would be moving the target.
  // Pausing freezes the current wording rather than resetting it; the next
  // interval starts fresh on blur, so nothing swaps the instant you leave.
  //
  // No cross-fade, for anyone: the text of ::placeholder cannot be tweened, and
  // faking it with an overlay div would risk font/padding drift on a native
  // control. An instant swap has nothing for prefers-reduced-motion to reduce,
  // and it keeps BOTH wordings available to reduced-motion visitors — they are
  // different information, not decoration.
  const rotatesPlaceholder = Boolean(placeholderAlt) && !isFocused && draft.length === 0;

  useEffect(() => {
    if (!rotatesPlaceholder) return undefined;
    const timer = window.setInterval(() => setShowAlt(current => !current), PLACEHOLDER_ROTATE_MS);
    // Cleared on unmount, on focus/typing, and on a language switch (the copy
    // itself is a dependency), so no timer outlives the wording it was started for.
    return () => window.clearInterval(timer);
  }, [rotatesPlaceholder, placeholderAlt]);

  const activePlaceholder = showAlt && placeholderAlt ? placeholderAlt : placeholder;

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
        onSubmit(draft);
      }}
      role="search"
    >
      <input
        type="search"
        value={draft}
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
          const next = event.target.value;
          setDraft(next);
          lastSentRef.current = next;
          startTransition(() => onChange(next));
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setIsFocused(true);
          if (canShow) setIsOpen(true);
        }}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={activePlaceholder}
        className={`min-h-14 w-full rounded-2xl border border-white/70 bg-white pl-4 text-base font-medium text-ellipsis text-slate-800 shadow-lg shadow-sky-900/10 outline-none ring-1 ring-white/50 transition placeholder:text-[14px] placeholder:text-slate-500 max-[389px]:placeholder:text-[13px] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/25 sm:min-h-16 sm:rounded-full sm:pl-5 sm:text-lg sm:placeholder:text-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${
          hasValue ? 'pr-[6.5rem] sm:pr-28' : 'pr-14 sm:pr-16'
        }`}
      />

      {hasValue && (
        <button
          type="button"
          onClick={() => {
            // Urgent, not a transition: clearing is a decision, it must land at once.
            setDraft('');
            lastSentRef.current = '';
            onChange('');
            close();
          }}
          className="absolute right-14 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/30 sm:right-16"
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
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-sky-100 bg-white text-left shadow-xl shadow-sky-950/12 ring-1 ring-white/70"
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

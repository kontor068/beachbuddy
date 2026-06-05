import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, LocateFixed, Search, X } from 'lucide-react';
import { Island, LanguageCode, Translation } from '../types';
import { fuzzySearchScore } from '../utils/searchNormalize';
import { getLocalizedCopy } from '../utils/i18n';

interface IslandSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  islands: Island[];
  onSelect: (island: Island) => void;
  t: Translation;
  language: LanguageCode;
  onSelectNearest: () => void;
  isFindingNearest: boolean;
  findNearestError: string | null;
}

type IslandSection = {
  group: string;
  list: Island[];
};

const groupOrder = [
  'attica',
  'argosaronic',
  'cyclades',
  'dodecanese',
  'crete',
  'ionian',
  'sporades',
  'north_aegean',
  'euboea',
  'mainland_peloponnese',
  'mainland_central',
  'mainland_thessaly',
  'mainland_epirus',
  'mainland_macedonia',
  'mainland_thrace',
];

const destinationOrderByGroup: Record<string, string[]> = {
  attica: [
    'attica-east-attica-mainland',
    'attica-piraeus-area',
    'attica-west-attica-mainland',
  ],
  argosaronic: [
    'attica-aegina',
    'attica-agistri',
    'attica-hydra',
    'attica-poros',
    'attica-salamina',
  ],
};

const getGroupRank = (group: string): number => {
  const rank = groupOrder.indexOf(group);
  return rank === -1 ? groupOrder.length : rank;
};

const sortDestinationsForGroup = (group: string, list: Island[], language: LanguageCode): Island[] => {
  const preferredOrder = destinationOrderByGroup[group] || [];
  return [...list].sort((a, b) => {
    const aRank = preferredOrder.indexOf(a.id);
    const bRank = preferredOrder.indexOf(b.id);
    const safeARank = aRank === -1 ? preferredOrder.length : aRank;
    const safeBRank = bRank === -1 ? preferredOrder.length : bRank;
    return safeARank - safeBRank || a.name[language].localeCompare(b.name[language]);
  });
};

const getGroupLabel = (group: string, language: LanguageCode, t: Translation): string => {
  if (group === 'attica') {
    return getLocalizedCopy(language, {
      en: 'Attica regions',
      gr: 'Περιοχές Αττικής',
      fr: 'Régions de l’Attique',
      de: 'Attika-Regionen',
      it: 'Regioni dell’Attica',
    });
  }
  return t.islandSelector.groups[group as keyof typeof t.islandSelector.groups] || group;
};

export const IslandSelectorModal: React.FC<IslandSelectorModalProps> = ({
  isOpen,
  onClose,
  islands,
  onSelect,
  t,
  language,
  onSelectNearest,
  isFindingNearest,
  findNearestError,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const copy = getLocalizedCopy(language, {
    en: {
      close: 'Close location selector',
      search: 'Search island or region',
      noResults: 'No islands or regions found.',
      findingLocation: 'Finding nearby region',
    },
    gr: {
      close: 'Κλείσιμο επιλογής περιοχής',
      search: 'Αναζήτηση νησιού ή περιοχής',
      noResults: 'Δεν βρέθηκαν νησιά ή περιοχές.',
      findingLocation: 'Εύρεση κοντινής περιοχής',
    },
    fr: {
      close: 'Fermer le sélecteur',
      search: 'Rechercher une île ou région',
      noResults: 'Aucune île ou région trouvée.',
      findingLocation: 'Recherche de la région proche',
    },
    de: {
      close: 'Standortauswahl schließen',
      search: 'Insel oder Region suchen',
      noResults: 'Keine Inseln oder Regionen gefunden.',
      findingLocation: 'Nahe Region wird gesucht',
    },
    it: {
      close: 'Chiudi selettore località',
      search: 'Cerca isola o regione',
      noResults: 'Nessuna isola o regione trovata.',
      findingLocation: 'Ricerca regione vicina',
    },
  });

  const islandSections = useMemo<IslandSection[]>(() => {
    const query = searchTerm.trim();
    const filtered = query
      ? islands
          .map(island => ({
            island,
            score: Math.max(
              fuzzySearchScore(query, island.name[language]),
              fuzzySearchScore(query, island.name.en),
              fuzzySearchScore(query, island.name.gr)
            ),
          }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || a.island.name[language].localeCompare(b.island.name[language]))
          .map(item => item.island)
      : islands;

    const grouped = filtered.reduce((acc, island) => {
      const group = island.group || 'other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(island);
      return acc;
    }, {} as Record<string, Island[]>);

    return (Object.entries(grouped) as [string, Island[]][])
      .sort(([a], [b]) => getGroupRank(a) - getGroupRank(b) || a.localeCompare(b))
      .map(([group, list]) => ({
        group,
        list: sortDestinationsForGroup(group, list, language),
      }));
  }, [islands, searchTerm, language]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusDialog = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(element => element.offsetParent !== null);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      } else if (!dialogRef.current.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex animate-fade-in items-end justify-center bg-slate-950/58 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[88dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-[1.65rem] bg-[var(--color-background)] shadow-2xl ring-1 ring-white/30 sm:h-[74vh] sm:max-h-[720px] sm:max-w-md sm:rounded-[1.65rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="island-selector-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/70 bg-white/78 p-4 shadow-sm shadow-sky-900/5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="island-selector-title" className="font-heading text-xl font-black leading-tight text-slate-950 dark:text-white">
                {t.islandSelector.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <button
            type="button"
            onClick={onSelectNearest}
            disabled={isFindingNearest}
            aria-label={isFindingNearest ? copy.findingLocation : t.islandSelector.useCurrentLocation}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-sm shadow-cyan-900/15 transition hover:bg-cyan-700 active:scale-[0.995] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {isFindingNearest ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
            ) : (
              <LocateFixed className="h-5 w-5" aria-hidden="true" />
            )}
            {t.islandSelector.useCurrentLocation}
          </button>

          {findNearestError && (
            <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600" role="alert">
              {findNearestError}
            </p>
          )}

          <div className="relative mt-3">
            <label htmlFor="island-selector-search" className="sr-only">{copy.search}</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="island-selector-search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={t.islandSelector.searchPlaceholder}
              aria-label={copy.search}
              className="min-h-11 w-full rounded-full border border-white/70 bg-white/90 py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-800 shadow-sm outline-none ring-1 ring-white/45 transition placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-400/75 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:ring-slate-800"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          {islandSections.length === 0 ? (
            <p className="text-center text-slate-500 p-4" role="status">{copy.noResults}</p>
          ) : (
            islandSections.map(({ group, list }) => (
              <div key={group}>
                <h3 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {getGroupLabel(group, language, t)}
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {list.map(island => (
                    <button
                      key={island.id}
                      type="button"
                      onClick={() => {
                        onSelect(island);
                        onClose();
                      }}
                      className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-white/62 px-4 py-3 text-left font-bold text-slate-800 shadow-sm ring-1 ring-white/55 transition hover:bg-cyan-50 hover:text-cyan-800 active:scale-[0.995] active:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-slate-800 dark:hover:bg-slate-800"
                    >
                      <span className="min-w-0 truncate">{island.name[language]}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-600 dark:text-slate-600" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

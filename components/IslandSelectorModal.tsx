
import React, { useState, useMemo } from 'react';
import { Island, LanguageCode } from '../types';
import { Translation } from '../types';
import { fuzzySearchScore } from '../utils/searchNormalize';

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

export const IslandSelectorModal: React.FC<IslandSelectorModalProps> = ({ isOpen, onClose, islands, onSelect, t, language, onSelectNearest, isFindingNearest, findNearestError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const groupedIslands = useMemo(() => {
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

    return filtered.reduce((acc, island) => {
      const group = island.group || 'other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(island);
      return acc;
    }, {} as Record<string, Island[]>);
  }, [islands, searchTerm, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[90] animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--color-background)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md h-[85vh] sm:h-[70vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">{t.islandSelector.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </header>
        <div className="p-4 space-y-4">
          <button onClick={onSelectNearest} disabled={isFindingNearest} className="w-full py-3 bg-cyan-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-cyan-700 transition-colors disabled:opacity-50">
            {isFindingNearest ? <span className="animate-spin text-xl">◌</span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9z" clipRule="evenodd" /></svg>}
            {t.islandSelector.useCurrentLocation}
          </button>
          {findNearestError && (
            <p className="text-sm text-red-500 text-center">{findNearestError}</p>
          )}
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t.islandSelector.searchPlaceholder} className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-cyan-500 outline-none dark:bg-slate-800 dark:border-slate-700" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          {Object.keys(groupedIslands).length === 0 ? (
             <p className="text-center text-slate-500 p-4">No results found.</p>
          ) : (
            (Object.entries(groupedIslands) as [string, Island[]][]).map(([group, list]) => (
                <div key={group}>
                <h3 className="text-xs font-bold text-slate-500 mb-2">{t.islandSelector.groups[group as keyof typeof t.islandSelector.groups] || group}</h3>
                <div className="grid grid-cols-1 gap-1">
                    {list.map(i => (
                    <button key={i.id} onClick={() => { onSelect(i); onClose(); }} className="text-left px-4 py-3 hover:bg-cyan-50 dark:hover:bg-slate-700 active:bg-cyan-100 dark:active:bg-slate-600 rounded-lg font-medium transition-colors min-h-[44px]">{i.name[language]}</button>
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

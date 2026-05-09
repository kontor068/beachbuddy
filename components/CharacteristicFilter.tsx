

import React from 'react';
import { Beach } from '../types';

type CharacteristicKey = keyof Beach['characteristics'];

interface CharacteristicFilterProps {
  selectedCharacteristics: string[];
  onCharacteristicChange: (characteristic: string | 'all') => void;
  t: any;
}

const characteristicIcons: Record<string, React.ReactNode> = {
  // FIX: Removed 'sand' and 'pebbles' as they are not valid keys for type 'CharacteristicKey'.
  // Beach surface type is handled by 'beachType', not 'characteristics'.
  deepWaters: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
  shallowWaters: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 12h16M4 16h16" /></svg>,
};


const CharacteristicFilter: React.FC<CharacteristicFilterProps> = ({ selectedCharacteristics, onCharacteristicChange, t }) => {
  const characteristics = Object.keys(t.characteristics) as CharacteristicKey[];
  const isAllSelected = selectedCharacteristics.length === 0;

  const CheckmarkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div role="group" aria-labelledby="characteristics-heading">
      <h3 id="characteristics-heading" className="text-lg font-bold text-slate-700 mb-4">{t.filterByCharacteristics}</h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onCharacteristicChange('all')}
          aria-pressed={isAllSelected}
          aria-label={t.clearCharacteristicFiltersLabel}
          className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 ${
            isAllSelected
              ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40'
              : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:text-cyan-600 hover:shadow-md hover:-translate-y-px'
          }`}
        >
          {t.filterAll}
          {isAllSelected && <CheckmarkIcon />}
        </button>
        {characteristics.map(characteristic => {
          const isSelected = selectedCharacteristics.includes(characteristic as string);
          return (
            <button
              key={characteristic as string}
              onClick={() => onCharacteristicChange(characteristic as string)}
              aria-pressed={isSelected}
              aria-label={`${t.toggleFilterForLabel} ${t.characteristics[characteristic]}`}
              className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 ${
                isSelected
                  ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-600/40'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:text-cyan-600 hover:shadow-md hover:-translate-y-px'
              }`}
            >
              {characteristicIcons[characteristic as string]}
              {t.characteristics[characteristic]}
              {isSelected && <CheckmarkIcon />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CharacteristicFilter;
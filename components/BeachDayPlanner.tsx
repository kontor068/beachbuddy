import React from 'react';
import { BeachDayPlan } from '../services/beachPlannerService';
import { LanguageCode } from '../types';
import { getSelectedDayPrefix } from '../utils/dateLabels';

interface BeachDayPlannerProps {
  plan: BeachDayPlan;
  beachName: string;
  language?: LanguageCode;
  selectedDate?: Date;
}

export const BeachDayPlanner: React.FC<BeachDayPlannerProps> = ({ plan, language = 'en', selectedDate }) => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const summary = language === 'gr'
    ? `Το πλάνο βασίζεται στις προβλεπόμενες συνθήκες ανέμου και θερμοκρασίας για ${day}.`
    : plan.summary
        .replace(/\btoday\b/gi, day)
        .replace(/\bToday\b/g, day.charAt(0).toUpperCase() + day.slice(1));
  const plannerSummary = language === 'gr'
    ? (plan.isGoodDay
      ? `Το πλάνο βασίζεται στον άνεμο και την κατάσταση της θάλασσας για ${day}.`
      : `Οι συνθήκες ανέμου και θάλασσας δεν είναι ιδανικές ${day}.`)
    : summary;

  if (!plan.isGoodDay) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {language === 'gr' ? 'Οι συνθήκες δεν είναι ιδανικές' : 'Conditions Not Ideal'}
        </h3>
        <p className="text-orange-700 text-sm">{plannerSummary}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[1.75rem] border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="bg-cyan-50 p-2.5 rounded-2xl text-cyan-600 flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="min-w-0">
          <span className="text-xs font-black text-slate-500 block mb-1">
            {language === 'gr' ? 'Πρόταση ημέρας' : 'Day plan'}
          </span>
          <p className="text-sm text-slate-600 mt-1 leading-snug">{plannerSummary}</p>
        </div>
      </div>

      {plan.conditionsChangeAt && (
        <div className="bg-amber-50 rounded-2xl px-3 py-2.5 border border-amber-100 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs font-semibold text-amber-800 leading-snug">
            {language === 'gr'
              ? <>Μετά τις <span className="font-black">{plan.conditionsChangeAt}</span> οι συνθήκες μπορεί να αλλάξουν.</>
              : <>After <span className="font-black">{plan.conditionsChangeAt}</span>, conditions may change.</>}
          </p>
        </div>
      )}
    </div>
  );
};

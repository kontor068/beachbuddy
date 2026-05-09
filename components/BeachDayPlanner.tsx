import React from 'react';
import { BeachDayPlan } from '../services/beachPlannerService';
import { LanguageCode } from '../types';

interface BeachDayPlannerProps {
  plan: BeachDayPlan;
  beachName: string;
  language?: LanguageCode;
}

export const BeachDayPlanner: React.FC<BeachDayPlannerProps> = ({ plan, beachName, language = 'en' }) => {
  const summary = language === 'gr'
    ? 'Το πλάνο βασίζεται στις σημερινές συνθήκες ανέμου και θερμοκρασίας.'
    : plan.summary;

  if (!plan.isGoodDay) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {language === 'gr' ? 'Οι συνθήκες δεν είναι ιδανικές' : 'Conditions Not Ideal'}
        </h3>
        <p className="text-orange-700 text-sm">{summary}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-cyan-50 p-4 border-b border-cyan-100">
        <h3 className="font-bold text-cyan-900 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {language === 'gr' ? `Πλάνο ημέρας για ${beachName}` : `Beach Day Plan for ${beachName}`}
        </h3>
      </div>
      
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Arrival Time */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 mb-1">{language === 'gr' ? 'Άφιξη' : 'Arrival'}</span>
          <div className="flex items-center gap-2 text-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-lg">{plan.arrivalTime}</span>
          </div>
        </div>

        {/* Departure Time */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 mb-1">{language === 'gr' ? 'Αναχώρηση' : 'Departure'}</span>
          <div className="flex items-center gap-2 text-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-bold text-lg">{plan.departureTime}</span>
          </div>
        </div>

        {/* Best Swim Window - Full Width */}
        <div className="col-span-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">{language === 'gr' ? 'Καλύτερο διάστημα για μπάνιο' : 'Best Swim Window'}</span>
              <span className="font-bold text-slate-900 text-lg block">{plan.bestSwimWindow}</span>
              <p className="text-sm text-slate-600 mt-1 leading-snug">{summary}</p>
            </div>
          </div>
        </div>

        {/* Warning if conditions change */}
        {plan.conditionsChangeAt && (
          <div className="col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-100 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-medium text-amber-800">
              {language === 'gr' ? 'Οι συνθήκες αρχίζουν να αλλάζουν γύρω στις' : 'Conditions start to change around'} <span className="font-bold">{plan.conditionsChangeAt}</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

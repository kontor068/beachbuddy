import React from 'react';
import { Translation } from '../types';

interface UnsafeConditionsMessageProps {
  t: Translation;
}

const TipItem: React.FC<{ icon: React.ReactNode, text: string }> = ({ icon, text }) => (
    <li className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-background-accent)] rounded-lg flex items-center justify-center text-[var(--color-accent)]">
            {icon}
        </div>
        <p className="text-[var(--color-text-secondary)] pt-1 text-sm sm:text-base">{text}</p>
    </li>
);

export const UnsafeConditionsMessage: React.FC<UnsafeConditionsMessageProps> = ({ t }) => {
    const tips = [
        { icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>, text: t.winterSwimming.tip1 },
        { icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h1a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.884 11H16.116M7.884 11l-2.28 2.28m12.792 0l-2.28-2.28M5.055 11a2 2 0 00-2 2v1a2 2 0 01-2 2h1.945a2 2 0 012-2V13a2 2 0 00-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.945 11a2 2 0 012 2v1a2 2 0 002 2h-1.945a2 2 0 00-2-2V13a2 2 0 01-2-2z" /></svg>, text: t.winterSwimming.tip2 },
        { icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>, text: t.winterSwimming.tip3 },
        { icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>, text: t.winterSwimming.tip4 },
        { icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>, text: t.winterSwimming.tip5 },
    ];

    return (
        <div className="px-4 md:px-6 py-8 animate-fade-in-up">
            <div className="text-center bg-[var(--color-foreground)] p-6 sm:p-8 rounded-2xl shadow-lg border border-[var(--color-border)] max-w-3xl mx-auto">
                <div className="mx-auto h-16 w-16 text-red-500 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center ring-4 ring-red-200 dark:ring-red-800/60">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">{t.winterSwimming.unsafeConditionsTitle}</h2>
                <p className="mt-2 text-md text-[var(--color-text-secondary)] max-w-xl mx-auto">{t.winterSwimming.unsafeConditionsDescription}</p>

                <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-left">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 text-center">{t.winterSwimming.tipsTitle}</h3>
                    <ul className="space-y-4 max-w-lg mx-auto">
                        {tips.map((tip, i) => <TipItem key={i} icon={tip.icon} text={tip.text} />)}
                    </ul>
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import { Beach, LanguageCode } from '../types';

interface AudioGuideToastProps {
  isVisible: boolean;
  beach: Beach | null;
  story: string | null;
  isLoading: boolean;
  onPlay: () => void;
  onStop: () => void;
  language: LanguageCode;
  t: any;
}

const AudioGuideToast: React.FC<AudioGuideToastProps> = ({ isVisible, beach, story, isLoading, onPlay, onStop, language, t }) => {
  const isPlaying = !!story;

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md z-50 transition-all duration-500 ease-in-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      {beach && (
        <div className="bg-slate-800 rounded-xl shadow-2xl p-4 text-white flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 12a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM15 12a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zM8 17a1 1 0 100-2 1 1 0 000 2zM12 17a1 1 0 100-2 1 1 0 000 2zM4.228 6.25a1 1 0 00-1.415 1.415l1.414 1.414a1 1 0 001.415-1.415L4.228 6.25zM14.343 14.343a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414zM4.228 13.75a1 1 0 011.415-1.415l1.414 1.414a1 1 0 01-1.415 1.415L4.228 13.75zM14.343 5.657a1 1 0 011.414-1.414l1.414 1.414a1 1 0 01-1.414 1.414l-1.414-1.414z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base">{t.audioGuide.title(beach.name[language])}</h3>
            <div className="flex items-center gap-3 mt-2">
              {isPlaying ? (
                <button
                  onClick={onStop}
                  className="flex-grow flex items-center justify-center px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {t.audioGuide.stopButton}
                </button>
              ) : (
                <>
                  <button
                    onClick={onPlay}
                    disabled={isLoading}
                    className="flex-grow flex items-center justify-center px-4 py-2 bg-white text-slate-800 font-semibold rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {t.audioGuide.loading}
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        {t.audioGuide.playButton}
                      </>
                    )}
                  </button>
                  <button
                    onClick={onStop}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    aria-label={t.audioGuide.dismiss}
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioGuideToast;

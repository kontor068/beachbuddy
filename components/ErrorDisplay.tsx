
import React from 'react';

interface ErrorDisplayProps {
  message: string;
  onRetry: () => void;
  t: any;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry, t }) => {
  return (
    <div className="bg-red-50 p-6 m-4 md:m-6 rounded-xl shadow-lg border border-red-200" role="alert" aria-live="assertive">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <div>
             <h3 className="text-lg font-bold text-red-800">{t.errorTitle}</h3>
            <p className="text-sm text-red-700 mt-1">{message}</p>
          </div>
          <div className="mt-4 md:mt-0 md:ml-6">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 w-full md:w-auto px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50 transition-colors"
            >
              {t.tryAgain}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;

import React from 'react';

interface WeatherAlertProps {
  beaufortLevel: number;
  windDirection: string;
  t: any;
  onDismiss: () => void;
}

const ALERT_THRESHOLD_BFT = 7; // Trigger alert at 7 Bft (High Wind) or higher

const WeatherAlert: React.FC<WeatherAlertProps> = ({ beaufortLevel, windDirection, t, onDismiss }) => {
  // The component is now rendered conditionally by its parent, so this check is redundant
  // but kept as a safeguard.
  if (beaufortLevel < ALERT_THRESHOLD_BFT) {
    return null;
  }

  return (
    <div className="px-4 md:px-6 mb-8 animate-fade-in-up">
      <div
        className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg shadow-lg"
        role="alert"
      >
        <div className="flex items-start justify-between">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-red-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    >
                    <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                        clipRule="evenodd"
                    />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-lg font-bold">{t.weatherAlert.title}</h3>
                    <p className="mt-1 text-sm">
                    {t.weatherAlert.message(beaufortLevel, windDirection)}
                    </p>
                </div>
            </div>
            <div className="ml-4 flex-shrink-0">
                <button
                onClick={onDismiss}
                className="p-1.5 rounded-full hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={t.audioGuide.dismiss}
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherAlert;

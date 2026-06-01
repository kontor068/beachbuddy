import React from 'react';
import { DailyForecast, Translation } from '../types';
import Forecast from './Forecast';

interface WeatherSummaryProps {
  forecast: DailyForecast[];
  selectedDayIndex: number;
  onDaySelect: (index: number) => void;
  t: Translation;
  islandName?: string;
  variant?: 'default' | 'heroCompact' | 'header' | 'summaryStrip';
}

export const WeatherSummary: React.FC<WeatherSummaryProps> = ({
  forecast,
  selectedDayIndex,
  onDaySelect,
  t,
  islandName,
  variant = 'default',
}) => {
  if (!forecast || forecast.length === 0 || !forecast[selectedDayIndex]) return null;

  return (
    <Forecast 
      displayForecasts={forecast} 
      selectedDayIndex={selectedDayIndex} 
      onDaySelect={onDaySelect} 
      t={t} 
      islandName={islandName}
      variant={variant}
    />
  );
};

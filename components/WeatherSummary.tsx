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
  defaultHourlyExpanded?: boolean;
  useWeekdayLabels?: boolean;
  hideHourlyToggle?: boolean;
  hideForecastHeader?: boolean;
  stackedPills?: boolean;
  fillHeight?: boolean;
}

export const WeatherSummary: React.FC<WeatherSummaryProps> = ({
  forecast,
  selectedDayIndex,
  onDaySelect,
  t,
  islandName,
  variant = 'default',
  defaultHourlyExpanded = false,
  useWeekdayLabels = false,
  hideHourlyToggle = false,
  hideForecastHeader = false,
  stackedPills = false,
  fillHeight = false,
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
      defaultHourlyExpanded={defaultHourlyExpanded}
      useWeekdayLabels={useWeekdayLabels}
      hideHourlyToggle={hideHourlyToggle}
      hideForecastHeader={hideForecastHeader}
      stackedPills={stackedPills}
      fillHeight={fillHeight}
    />
  );
};

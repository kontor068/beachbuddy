import { Beach, ForecastItem } from '../types';

export interface BeachDayPlan {
  beachId: number;
  arrivalTime: string;
  bestSwimWindow: string;
  conditionsChangeAt: string | null;
  departureTime: string;
  summary: string;
  isGoodDay: boolean;
}

export const generateBeachDayPlan = (beach: Beach, hourlyForecast: ForecastItem[]): BeachDayPlan => {
  if (!hourlyForecast || hourlyForecast.length === 0) {
    return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "N/A",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "Insufficient forecast data to generate a plan.",
      isGoodDay: false
    };
  }

  // Filter for next 12-15 hours or just use what's provided (usually 24h for the day)
  // We assume hourlyForecast is for the relevant day.
  // Let's focus on "daylight" hours roughly 08:00 to 20:00 if possible, 
  // or just process the list provided which is likely the day's forecast.
  
  const relevantHours = hourlyForecast.filter(item => {
    if (!item.dt_txt || !item.dt_txt.includes(' ')) return false;
    const timeParts = item.dt_txt.split(' ');
    const hour = timeParts.length > 1 ? parseInt(timeParts[1].substring(0, 2), 10) : -1;
    return hour >= 8 && hour <= 20; // Focus on beach hours
  });

  if (relevantHours.length === 0) {
     return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "N/A",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "No daylight forecast data available.",
      isGoodDay: false
    };
  }

  // Define "Good" conditions
  // Wind < 18 km/h (approx 5 m/s)
  // Temp 22-32
  const isGoodCondition = (item: ForecastItem) => {
    const windSpeedKmh = item.wind.speed * 3.6;
    const temp = item.main.temp;
    return windSpeedKmh < 18 && temp >= 22 && temp <= 35; // Extended upper limit slightly for Greece
  };

  let bestWindowStart: number | null = null;
  let bestWindowEnd: number | null = null;
  let currentWindowStart: number | null = null;
  let maxWindowLength = 0;

  // Find longest window of good conditions
  for (let i = 0; i < relevantHours.length; i++) {
    const item = relevantHours[i];
    if (isGoodCondition(item)) {
      if (currentWindowStart === null) {
        currentWindowStart = i;
      }
    } else {
      if (currentWindowStart !== null) {
        const length = i - currentWindowStart;
        if (length > maxWindowLength) {
          maxWindowLength = length;
          bestWindowStart = currentWindowStart;
          bestWindowEnd = i - 1;
        }
        currentWindowStart = null;
      }
    }
  }
  // Check if window extends to the end
  if (currentWindowStart !== null) {
    const length = relevantHours.length - currentWindowStart;
    if (length > maxWindowLength) {
      maxWindowLength = length;
      bestWindowStart = currentWindowStart;
      bestWindowEnd = relevantHours.length - 1;
    }
  }

  if (bestWindowStart === null) {
    // No good window found
    return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "Conditions not ideal today",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "Weather conditions (wind or temperature) are not ideal for swimming today.",
      isGoodDay: false
    };
  }

  const startItem = relevantHours[bestWindowStart];
  const endItem = relevantHours[bestWindowEnd!];
  
  const startTimeStr = (startItem.dt_txt && startItem.dt_txt.includes(' ') && startItem.dt_txt.split(' ').length > 1) 
    ? startItem.dt_txt.split(' ')[1].substring(0, 5) 
    : new Date(startItem.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
  const endTimeStr = (endItem.dt_txt && endItem.dt_txt.includes(' ') && endItem.dt_txt.split(' ').length > 1) 
    ? endItem.dt_txt.split(' ')[1].substring(0, 5) 
    : new Date(endItem.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  
  // Add 3 hours to end time because forecast items are usually 3-hour steps? 
  // Wait, types says "hourly", but OpenWeatherMap free is 3-hourly. 
  // Let's assume the list is hourly if it says "hourlyForecast", but if it's 3-hourly steps, we need to adjust.
  // Looking at the data structure in previous turns (not visible here but standard OWM), it's often 3h.
  // However, the prompt says "hourlyForecast". Let's assume the caller passes granular data or we treat the step as the duration.
  // If `dt_txt` are 3 hours apart (09:00, 12:00), then a "good" item at 12:00 means 12:00-15:00 is good?
  // Let's check the gap.
  let step = 1; // default 1 hour
  if (relevantHours.length > 1) {
      const t1 = new Date(relevantHours[0].dt * 1000).getTime();
      const t2 = new Date(relevantHours[1].dt * 1000).getTime();
      step = (t2 - t1) / (1000 * 60 * 60);
  }

  // Format times
  // Arrival: 30 mins before start if possible, or just start time
  const arrivalTime = startTimeStr;
  
  // Departure: End of the window
  // If step is 3 hours, and endItem is 12:00, it means good until 15:00.
  const endDate = new Date(endItem.dt * 1000);
  endDate.setHours(endDate.getHours() + step);
  const departureTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

  const bestSwimWindow = `${startTimeStr} - ${departureTime}`;

  // Check for conditions worsening
  let conditionsChangeAt: string | null = null;
  let worseReason = "";
  
  if (bestWindowEnd! < relevantHours.length - 1) {
      const nextItem = relevantHours[bestWindowEnd! + 1];
      conditionsChangeAt = (nextItem.dt_txt && nextItem.dt_txt.includes(' ') && nextItem.dt_txt.split(' ').length > 1) 
        ? nextItem.dt_txt.split(' ')[1].substring(0, 5) 
        : new Date(nextItem.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      if (nextItem.wind.speed * 3.6 >= 18) worseReason = "wind picks up";
      else if (nextItem.main.temp < 22) worseReason = "gets too cool";
      else if (nextItem.main.temp > 35) worseReason = "gets too hot";
      else worseReason = "conditions change";
  }

  let summary = "";
  if (maxWindowLength >= relevantHours.length) {
      summary = "Perfect conditions all day! Arrive anytime and stay as long as you like.";
  } else if (bestWindowStart === 0) {
      summary = `Arrive early (${arrivalTime}) for the best conditions. ${worseReason ? `It ${worseReason} around ${conditionsChangeAt}.` : "Conditions change later."}`;
  } else {
      summary = `The best time to swim is from ${startTimeStr}. ${worseReason ? `Conditions worsen after ${departureTime}.` : ""}`;
  }

  return {
    beachId: beach.id,
    arrivalTime,
    bestSwimWindow,
    conditionsChangeAt,
    departureTime,
    summary,
    isGoodDay: true
  };
};

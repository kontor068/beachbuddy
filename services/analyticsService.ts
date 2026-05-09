
import { LanguageCode } from '../types';

export type AnalyticsEvent = 
  | 'beach_viewed'
  | 'beach_navigated'
  | 'beach_favorited'
  | 'search_performed'
  | 'filter_used'
  | 'ai_advisor_question'
  | 'recommendation_feedback';

export interface AnalyticsData {
  event: AnalyticsEvent;
  beachId?: number | string;
  timestamp: string;
  userLocation?: { lat: number; lon: number };
  metadata?: any;
}

export interface FeedbackData {
  beachId: number;
  feedback: 'accurate' | 'not_accurate';
  timestamp: string;
}

const STORAGE_KEY = 'beach_buddy_analytics';
const FEEDBACK_KEY = 'beach_buddy_feedback';

export const trackEvent = (
  event: AnalyticsEvent, 
  beachId?: number | string, 
  metadata?: any,
  userLocation?: { lat: number; lon: number }
) => {
  const data: AnalyticsData = {
    event,
    beachId,
    timestamp: new Date().toISOString(),
    userLocation,
    metadata
  };

  const existing = getEvents();
  existing.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  
  console.log(`[Analytics] Tracked: ${event}`, data);
};

export const getEvents = (): AnalyticsData[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const storeFeedback = (beachId: number, feedback: 'accurate' | 'not_accurate') => {
  const data: FeedbackData = {
    beachId,
    feedback,
    timestamp: new Date().toISOString()
  };

  const existing = getFeedback();
  existing.push(data);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing));
  
  trackEvent('recommendation_feedback', beachId, { feedback });
};

export const getFeedback = (): FeedbackData[] => {
  const stored = localStorage.getItem(FEEDBACK_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const getNegativeFeedbackCount = (beachId: number): number => {
  const feedback = getFeedback();
  return feedback.filter(f => f.beachId === beachId && f.feedback === 'not_accurate').length;
};

export const getAnalyticsInsights = () => {
  const events = getEvents();
  
  const beachViews: Record<number | string, number> = {};
  const searchLocations: Record<string, number> = {};
  const beachFavorites: Record<number | string, number> = {};

  events.forEach(e => {
    if (e.event === 'beach_viewed' && e.beachId) {
      beachViews[e.beachId] = (beachViews[e.beachId] || 0) + 1;
    }
    if (e.event === 'search_performed' && e.metadata?.query) {
      searchLocations[e.metadata.query] = (searchLocations[e.metadata.query] || 0) + 1;
    }
    if (e.event === 'beach_favorited' && e.beachId) {
      beachFavorites[e.beachId] = (beachFavorites[e.beachId] || 0) + 1;
    }
  });

  return {
    beachViews,
    searchLocations,
    beachFavorites
  };
};

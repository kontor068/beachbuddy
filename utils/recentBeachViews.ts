// The last few beach pages this visitor opened — kept ONLY on their device, and read back
// by one reader: the "rate the app" card, so a low accuracy score can say WHICH beach it is
// about with one tap. Before this (10/09/2026) a «4/10 accuracy» arrived with nothing but the
// page the visitor happened to be on, and the investigation could not tell which beach —
// or even which island — the score was about.
//
// Nothing here is sent anywhere by itself. The list leaves the device only if the visitor
// taps one of its beaches in the rating card and presses Send.

const STORE_KEY = 'cb_recent_beaches_v1';
const MAX_ENTRIES = 5;

export type RecentBeachView = {
  id: number;
  name: string;
  region?: string;
  /** The visitor's own local day (YYYY-MM-DD) — "which day did you look at it". */
  day: string;
};

const localDayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const readRecentBeachViews = (): RecentBeachView[] => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(entry => Number.isFinite(entry?.id) && typeof entry?.name === 'string').slice(0, MAX_ENTRIES)
      : [];
  } catch {
    return [];
  }
};

/** Newest first, one entry per beach (re-opening a beach moves it to the front). */
export const recordRecentBeachView = (view: Omit<RecentBeachView, 'day'>): void => {
  try {
    const next = [
      { ...view, day: localDayKey() },
      ...readRecentBeachViews().filter(entry => entry.id !== view.id),
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled — the rating card simply shows no chips */
  }
};

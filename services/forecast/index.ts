import type { ForecastProvider } from './ForecastProvider';
import { openMeteoProvider } from './openMeteoProvider';

// The one place that decides which forecast source the app uses. Swapping the
// provider (or picking one by env) happens HERE and nowhere else — that's the
// whole point of the seam.
export const activeForecastProvider: ForecastProvider = openMeteoProvider;

export type { ForecastProvider } from './ForecastProvider';

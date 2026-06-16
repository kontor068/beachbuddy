import { getIslandStripPhoto } from '../data/destinationPhotoAdapter';

/**
 * Whether the island shows the homepage context strip. True for any island that maps to a
 * destination with a curated photo — a dedicated `hero` or, as a fallback, its `card`
 * (see getIslandStripPhoto). Islands with no curated photo get no strip.
 *
 * When this is true the full-bleed island background is suppressed (see App.tsx) so the
 * island photo is not shown twice — the strip becomes the single island-photo focal point.
 */
export const islandHasContextStrip = (islandId: string | undefined | null): boolean => (
  Boolean(islandId && getIslandStripPhoto(islandId))
);

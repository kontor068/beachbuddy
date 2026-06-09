import { Accessibility, Beach } from '../types';

const normalizeAccessText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type AccessSource = {
  metadata?: Beach['metadata'];
  accessNotes?: Beach['accessNotes'];
};

export const hasDirtRoadAccess = (beach: AccessSource): boolean => {
  const access = beach.metadata?.access;
  const accessText = [
    access?.type,
    access?.label,
    access?.notes,
    beach.accessNotes?.gr,
    beach.accessNotes?.en,
  ].map(normalizeAccessText).join(' ');

  return (
    access?.type === 'passable_dirt_road' ||
    access?.type === 'difficult_dirt_road' ||
    /χωματοδρομ|dirt road|gravel road|unpaved|sterrato|piste/.test(accessText)
  );
};

export const hasBoatOnlyAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  beach.accessibility === Accessibility.BOAT_ONLY || beach.metadata?.access?.type === 'boat_only'
);

export const hasChallengingAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  beach.accessibility === Accessibility.DIFFICULT ||
  beach.metadata?.access?.type === 'difficult_dirt_road' ||
  beach.metadata?.access?.type === '4x4_only' ||
  beach.metadata?.access?.type === 'hiking_path_difficult'
);

export const hasDifficultTopPickAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  hasBoatOnlyAccess(beach) || hasChallengingAccess(beach)
);

export const isAdventureBeach = (
  beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes' | 'environment'>
): boolean => {
  const isRemote = Boolean(beach.environment?.remote || beach.metadata?.environment?.remote);

  return Boolean(
    isRemote ||
    hasBoatOnlyAccess(beach) ||
    hasChallengingAccess(beach) ||
    (hasDirtRoadAccess(beach) && isRemote)
  );
};

export const hasPracticalTopPickAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => {
  if (hasDifficultTopPickAccess(beach)) return false;

  const accessType = beach.metadata?.access?.type;
  return (
    accessType === 'asphalt_road' ||
    accessType === 'passable_dirt_road' ||
    accessType === 'hiking_path_easy' ||
    (!accessType && (beach.accessibility === Accessibility.EASY || beach.accessibility === Accessibility.MODERATE))
  );
};

export const hasMainstreamTopPickAccess = (
  beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes' | 'environment'>
): boolean => (
  !Boolean(beach.environment?.remote || beach.metadata?.environment?.remote) &&
  hasTrulyEasyAccess(beach)
);

export const hasTrulyEasyAccess = (beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes'>): boolean => {
  if (hasDirtRoadAccess(beach)) return false;
  if (hasBoatOnlyAccess(beach) || hasChallengingAccess(beach)) return false;
  if (beach.metadata?.access?.type === 'hiking_path_easy') return false;
  return beach.metadata?.access?.type === 'asphalt_road' || (
    beach.accessibility === Accessibility.EASY && !beach.metadata?.access?.type
  );
};

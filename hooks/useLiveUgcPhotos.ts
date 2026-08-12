// ─────────────────────────────────────────────────────────────────────────────
// «Η φωτογραφία μπήκε — δείξ' την τώρα.»
//
// Approved photos arrive after the page has rendered (services/liveUgcPhotos.ts
// fetches them from the public bucket). The photo lookup itself is synchronous
// and buried inside services/beachPhotos.ts, so there is no promise for a
// component to await — the arrival has to push a re-render instead.
//
// ONE CALL, AT THE ROOT. This is deliberately used in App and nowhere else: the
// beach card, the map popup and the detail page all read their photos through
// the same lookup, and none of them is memoised against a parent re-render. One
// subscription at the top therefore refreshes every one of them, whereas a hook
// per component would be five subscriptions doing the same work.
//
// The returned number is not meant to be rendered. It changes only when the set
// of approved photos actually changes, which on almost every visit is never.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useSyncExternalStore } from 'react';

import { startLiveUgcPhotos } from '../services/liveUgcPhotos';
import { getUgcPhotosVersion, subscribeUgcPhotos } from '../utils/ugcPhotos';

/** Zero is what a page rendered without a browser has: the baked list, unchanged. */
const serverSnapshot = () => 0;

export const useLiveUgcPhotos = (): number => {
  useEffect(() => startLiveUgcPhotos(), []);
  return useSyncExternalStore(subscribeUgcPhotos, getUgcPhotosVersion, serverSnapshot);
};

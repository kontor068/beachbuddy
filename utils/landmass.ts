/**
 * Road-connectivity ("landmass") model for the "Κοντά μου" (Near me) view.
 *
 * "Near me" merges beaches from several regions ranked by *straight-line* distance.
 * Straight-line distance ignores the sea: a beach 15 km away across the water on
 * the next island is **not** near you — you'd need a ferry to get there. The
 * symptom that prompted this: standing on Naxos, "Near me" suggested beaches on
 * Koufonisia (a separate island ~10–25 km away by sea). The same thing happens
 * between every pair of close-but-separate islands (Paros↔Antiparos,
 * Naxos↔the Lesser Cyclades, Mykonos↔Tinos, Kalymnos↔Kos, …).
 *
 * Fix: before merging, group regions by **landmass** (what you can actually reach
 * by car) and only ever merge regions that share the user's landmass.
 *
 * The model:
 *  - The Greek mainland is one road network (Peloponnese ↔ Sterea ↔ Macedonia ↔ …
 *    all connected by isthmus/bridge). Every prefecture region — ids ending in
 *    `-mainland` or `-area` — shares the `greek-mainland` landmass. The existing
 *    distance radius still keeps the merge local, so this only ever joins genuinely
 *    adjacent coast (e.g. standing on an East-Attica / Korinthia border).
 *  - Crete is one island split into four prefecture regions (`crete-crete-*`); they
 *    share the `crete` landmass. Gavdos (`crete-gavdos`) is a separate island and
 *    is intentionally excluded.
 *  - Every other region is its own island, so it is its own landmass — this is the
 *    default and is what stops one island from bleeding into another.
 *
 * Bridge/causeway islands (Evia, Lefkada) are deliberately left as their own
 * landmass rather than folded into the mainland: both are long enough that a short
 * straight-line hop to the facing coast is often a multi-hour drive around to the
 * single bridge, so merging them would re-introduce exactly the unreachable
 * suggestions we are removing here. Leaving them isolated never produces a false
 * "near" result; at worst it under-reaches by not crossing the bridge.
 */
export const getLandmassId = (regionId: string): string => {
  if (regionId.startsWith('crete-crete-')) return 'crete';
  if (regionId.endsWith('-mainland') || regionId.endsWith('-area')) return 'greek-mainland';
  return regionId;
};

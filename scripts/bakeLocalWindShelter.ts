/**
 * Bakes the categorical `shelteredFromLocalWind` flag into the app region data,
 * computed by the ONE curated-aware function (utils/windClimatology
 * summarizeLocalWindBehavior) with context-specific sectors (meltemi N+NE /
 * maistros NW+W). Runs after build:beach-data; prerender, beachGuides and App all
 * READ this flag — nobody recomputes.
 *
 * Run via the wrapper: node scripts/bakeLocalWindShelter.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { summarizeLocalWindBehavior } from '../utils/windClimatology';
import type { Beach, GeospatialExposureProfile, WindSector } from '../types';

const pub = path.join(process.cwd(), 'public');
const rj = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

async function main(): Promise<void> {
  const ctx = (await import('../utils/localWindContext.mjs')) as {
    getRegionWindContext: (id: string) => 'aegean' | 'ionian' | 'thermaic';
    LOCAL_WIND_SECTORS: Record<string, WindSector[]>;
  };

  const index = rj(path.join(pub, 'data', 'beaches', 'index.json'));
  let total = 0;
  let sheltered = 0;

  for (const region of index.regions || []) {
    const appPath = path.join(pub, 'data', 'beaches', 'app', `${region.id}.json`);
    if (!existsSync(appPath)) continue;
    const app = rj(appPath);
    const beaches: Beach[] = app.island?.beaches || [];

    const exPath = path.join(pub, 'data', 'geospatial', 'exposure', `${region.id}.json`);
    const profiles: Record<string, GeospatialExposureProfile> = existsSync(exPath) ? (rj(exPath).profiles || {}) : {};
    const sectors = ctx.LOCAL_WIND_SECTORS[ctx.getRegionWindContext(region.id)];

    // Compute once per beach from the full app-shape beach (so resolveBeachWindProfile
    // sees curated overrides / windsport spots / suspect pins), then fan out to every
    // file variant the runtime + prerender read. The three-level verdict is baked
    // alongside the boolean so the static beach page can print the same sentence the
    // app's shelter section shows; when the model abstains (undefined) no status is
    // written — absence must stay "no claim", never collapse to 'exposed'.
    const flagById = new Map<number, boolean>();
    const statusById = new Map<number, 'protected' | 'partial' | 'exposed'>();
    for (const beach of beaches) {
      if (!Number.isInteger(beach.id)) continue;
      const level = summarizeLocalWindBehavior(profiles[String(beach.id)], beach, sectors);
      if (level) statusById.set(beach.id, level);
      const flag = level === 'protected';
      flagById.set(beach.id, flag);
      total += 1;
      if (flag) sheltered += 1;
    }

    for (const variant of ['app', 'app/summary', 'app/detail']) {
      const fp = path.join(pub, 'data', 'beaches', variant, `${region.id}.json`);
      if (!existsSync(fp)) continue;
      const data = rj(fp);
      const list: Beach[] = data.island?.beaches || [];
      for (const beach of list) {
        if (!flagById.has(beach.id)) continue;
        const target = beach as { shelteredFromLocalWind?: boolean; localWindStatus?: string };
        target.shelteredFromLocalWind = flagById.get(beach.id);
        if (statusById.has(beach.id)) target.localWindStatus = statusById.get(beach.id);
        else delete target.localWindStatus;
      }
      writeFileSync(fp, `${JSON.stringify(data)}\n`, 'utf8');
    }
  }

  console.log(`bakeLocalWindShelter: ${sheltered}/${total} beaches sheltered from the local summer wind.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

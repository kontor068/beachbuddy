/**
 * Bakes the MEASURED `steepSeabedDepthM` into the app region data from the EMODnet bathymetry
 * profiles that have been sitting on disk unread since 18/08/2026
 * (public/data/geospatial/bathymetry). The rule and the words both live in utils/seabedEntry —
 * nothing is decided here.
 *
 * Reads the sector the beach FACES (facingDeg from the exposure profile), i.e. the water people
 * walk into, and writes the number only when it is deep enough to state and our own recorded
 * waterDepth does not disagree. Absence means "no claim", never "shallow".
 *
 * Runs after build:beach-data. Run via the wrapper: node scripts/bakeSeabedEntry.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveSteepSeabedDepthM } from '../utils/seabedEntry';
import type { Beach } from '../types';

const pub = path.join(process.cwd(), 'public');
const rj = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function main(): void {
  const index = rj(path.join(pub, 'data', 'beaches', 'index.json'));
  let total = 0;
  let stated = 0;
  let silentOnDisagreement = 0;
  let noReading = 0;

  for (const region of index.regions || []) {
    const appPath = path.join(pub, 'data', 'beaches', 'app', `${region.id}.json`);
    if (!existsSync(appPath)) continue;

    const exposurePath = path.join(pub, 'data', 'geospatial', 'exposure', `${region.id}.json`);
    const bathymetryPath = path.join(pub, 'data', 'geospatial', 'bathymetry', `${region.id}.json`);
    const exposure: Record<string, { facingDeg?: number }> = existsSync(exposurePath)
      ? (rj(exposurePath).profiles || {})
      : {};
    const bathymetry: Record<string, unknown> = existsSync(bathymetryPath)
      ? (rj(bathymetryPath).profiles || {})
      : {};

    // Compute once per beach from the app-shape record, then fan out to every file variant the
    // runtime and the prerender read — same pattern as bakeLocalWindShelter.
    const depthById = new Map<number, number>();
    for (const beach of (rj(appPath).island?.beaches || []) as Beach[]) {
      if (!Number.isInteger(beach.id)) continue;
      total += 1;

      const facingDeg = exposure[String(beach.id)]?.facingDeg;
      const recordedWaterDepthType = beach.metadata?.waterDepth?.type
        ?? (typeof beach.waterDepth === 'string' ? beach.waterDepth : undefined);

      const depthM = resolveSteepSeabedDepthM({
        profile: bathymetry[String(beach.id)] as never,
        facingDeg,
        recordedWaterDepthType,
      });

      if (depthM != null) {
        depthById.set(beach.id, depthM);
        stated += 1;
        continue;
      }

      // Only for the log, so the run says what it stayed silent about rather than reporting a
      // bare count that hides a disagreement.
      const readingExists = resolveSteepSeabedDepthM({
        profile: bathymetry[String(beach.id)] as never,
        facingDeg,
      }) != null;
      if (readingExists && recordedWaterDepthType === 'shallow') silentOnDisagreement += 1;
      else if (!readingExists) noReading += 1;
    }

    for (const variant of ['app', 'app/summary', 'app/detail']) {
      const fp = path.join(pub, 'data', 'beaches', variant, `${region.id}.json`);
      if (!existsSync(fp)) continue;
      const data = rj(fp);
      for (const beach of (data.island?.beaches || []) as Beach[]) {
        const target = beach as { steepSeabedDepthM?: number };
        if (depthById.has(beach.id)) target.steepSeabedDepthM = depthById.get(beach.id);
        else delete target.steepSeabedDepthM;
      }
      writeFileSync(fp, `${JSON.stringify(data)}\n`, 'utf8');
    }
  }

  console.log(
    `Βυθός: ${stated} από ${total} παραλίες δηλώνουν μετρημένο βάθος `
    + `(σιωπή σε ${silentOnDisagreement} όπου η δική μας καταγραφή λέει «ρηχά», `
    + `${noReading} χωρίς μέτρηση μπροστά τους).`
  );
}

main();

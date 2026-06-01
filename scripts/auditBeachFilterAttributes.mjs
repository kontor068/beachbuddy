import fs from 'node:fs';
import path from 'node:path';
import {
  CAFE_AMENITY_TERMS,
  RESTAURANT_AMENITY_TERMS,
  SNACK_CANTEEN_AMENITY_TERMS,
  TAVERNA_AMENITY_TERMS,
  amenityTextIncludesAny,
  hasExplicitBeachBarAmenityInList,
  isAmbiguousBeachBarAmenity,
} from '../utils/amenityMatching.js';

const appDir = path.join('public', 'data', 'beaches', 'app');
const regionArgs = process.argv.slice(2);

const isRegionFile = name =>
  name.endsWith('.json') &&
  name !== 'index.json' &&
  !name.startsWith('summary') &&
  !name.startsWith('detail');

const files = regionArgs.length
  ? regionArgs.map(region => path.join(appDir, `${region.replace(/\.json$/, '')}.json`))
  : fs.readdirSync(appDir).filter(isRegionFile).map(name => path.join(appDir, name));

const hasLifeguardClaim = text =>
  text.includes('ναυαγοσώστη') ||
  text.includes('ναυαγοσωστη') ||
  text.includes('lifeguard');

const hardAccessTypes = new Set(['hiking_path_difficult', 'boat_only']);
const hardFamilyAccessTypes = new Set(['4x4_only', 'difficult_dirt_road', 'hiking_path_difficult', 'boat_only']);
const allowedWaterDepthTypes = new Set(['shallow', 'medium', 'deep']);

const expectedBeachTypeFromTerrain = terrainTypes => {
  const hasFineSand = terrainTypes.includes('fine_sand');
  const hasCoarseSand = terrainTypes.includes('coarse_sand');
  const hasPebbles = terrainTypes.includes('pebbles');
  const hasLargeStones = terrainTypes.includes('large_stones');
  const hasRocks = terrainTypes.includes('rocks');
  const hasSand = hasFineSand || hasCoarseSand;

  if (hasRocks && !hasSand && !hasPebbles) return 'rocky';
  if (hasSand && (hasPebbles || hasLargeStones || hasRocks)) return 'sandy-pebbles';
  if (hasPebbles || hasLargeStones) return 'pebbles';
  if (hasSand) return 'sandy';
  return undefined;
};

const findings = [];
let beachCount = 0;
let lifeguardClaims = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    findings.push({ severity: 'high', region: path.basename(file, '.json'), issue: 'missing_region_file', beach: '-' });
    continue;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const regionId = data.region?.id || path.basename(file, '.json');
  const beaches = data.island?.beaches || [];
  beachCount += beaches.length;

  for (const beach of beaches) {
    const name = beach.name?.gr || beach.name?.en || String(beach.id);
    const metadataAmenities = beach.metadata?.amenities || [];
    const amenitiesText = metadataAmenities.join('|').toLowerCase();
    const accessType = String(beach.staticLabels?.accessType || beach.metadata?.access?.type || '');
    const terrainTypes = beach.metadata?.terrain?.types || [];
    const metadataWaterDepthType = beach.metadata?.waterDepth?.type;
    const hasCafe = amenityTextIncludesAny(metadataAmenities, CAFE_AMENITY_TERMS);
    const hasSnackOrCanteen = amenityTextIncludesAny(metadataAmenities, SNACK_CANTEEN_AMENITY_TERMS);
    const hasTavernaOrRestaurant = amenityTextIncludesAny(metadataAmenities, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS]);

    const add = (severity, issue, detail = '') => {
      findings.push({ severity, region: regionId, beach: `${beach.id} ${name}`, issue, detail });
    };

    if (amenitiesText.includes('/')) add('medium', 'slash_joined_amenity', amenitiesText);
    if (metadataAmenities.some(isAmbiguousBeachBarAmenity)) add('medium', 'ambiguous_beach_bar_amenity', amenitiesText);
    if (beach.environment?.quiet && beach.amenities?.beachBar) add('high', 'quiet_with_beach_bar');
    if (beach.environment?.quiet && (beach.amenities?.organized || beach.amenities?.sunbeds || hasCafe || hasSnackOrCanteen || hasTavernaOrRestaurant)) {
      add('high', 'quiet_with_visitor_services', amenitiesText);
    }
    if (beach.amenities?.beachBar && metadataAmenities.length > 0 && !hasExplicitBeachBarAmenityInList(metadataAmenities)) add('high', 'weak_beach_bar_flag', amenitiesText);
    if (accessType.includes('4x4')) add('medium', 'four_by_four_wording', accessType);
    if (beach.amenities?.organized && (!beach.metadata?.amenities || beach.metadata.amenities.length === 0)) {
      add('medium', 'organized_without_metadata_amenities');
    }
    if (hardFamilyAccessTypes.has(accessType) && beach.environment?.familyFriendly) {
      add('high', 'family_friendly_hard_access', accessType);
    }
    if (hardAccessTypes.has(accessType) && beach.environment?.familyFriendly && !beach.characteristics?.shallowWaters) {
      add('medium', 'family_friendly_hard_access_not_shallow');
    }
    if (beach.environment?.familyFriendly && !beach.characteristics?.shallowWaters) {
      add('high', 'family_friendly_without_shallow_water', beach.waterDepth);
    }
    if (!allowedWaterDepthTypes.has(beach.waterDepth)) {
      add('high', 'invalid_water_depth', String(beach.waterDepth));
    }
    if (!metadataWaterDepthType) {
      add('high', 'missing_metadata_water_depth');
    } else if (metadataWaterDepthType !== beach.waterDepth) {
      add('high', 'metadata_water_depth_mismatch', `${beach.waterDepth} expected ${metadataWaterDepthType}`);
    }
    if (beach.characteristics?.shallowWaters && beach.characteristics?.deepWaters) {
      add('high', 'shallow_and_deep_water_flags');
    }
    if (beach.waterDepth === 'shallow' && (!beach.characteristics?.shallowWaters || beach.characteristics?.deepWaters)) {
      add('high', 'shallow_water_depth_flag_mismatch');
    }
    if (beach.waterDepth === 'medium' && (beach.characteristics?.shallowWaters || beach.characteristics?.deepWaters)) {
      add('high', 'medium_water_depth_flag_mismatch');
    }
    if (beach.waterDepth === 'deep' && (!beach.characteristics?.deepWaters || beach.characteristics?.shallowWaters)) {
      add('high', 'deep_water_depth_flag_mismatch');
    }
    if (beach.activities?.snorkeling && !terrainTypes.includes('rocks') && !terrainTypes.includes('large_stones')) {
      add('high', 'snorkeling_without_rocky_terrain', terrainTypes.join('|'));
    }
    const expectedBeachType = expectedBeachTypeFromTerrain(terrainTypes);
    if (expectedBeachType && beach.beachType !== expectedBeachType) {
      add('high', 'beach_type_terrain_mismatch', `${beach.beachType} expected ${expectedBeachType} from ${terrainTypes.join('|')}`);
    }
    if (!Array.isArray(terrainTypes) || terrainTypes.length === 0) add('low', 'missing_terrain_types');
    if (hasLifeguardClaim(amenitiesText)) lifeguardClaims++;
  }
}

const bySeverity = findings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] || 0) + 1;
  return acc;
}, {});

console.log(`Beach filter attribute audit`);
console.log(`Files checked: ${files.length}`);
console.log(`Beaches checked: ${beachCount}`);
console.log(`Findings: ${findings.length} (high ${bySeverity.high || 0}, medium ${bySeverity.medium || 0}, low ${bySeverity.low || 0})`);
console.log(`Lifeguard claims found: ${lifeguardClaims}`);

for (const finding of findings.slice(0, 120)) {
  console.log(`${finding.severity.toUpperCase()} ${finding.region} ${finding.beach}: ${finding.issue}${finding.detail ? ` -> ${finding.detail}` : ''}`);
}

if (findings.length > 120) console.log(`... ${findings.length - 120} more findings omitted`);
if ((bySeverity.high || 0) > 0) process.exitCode = 1;

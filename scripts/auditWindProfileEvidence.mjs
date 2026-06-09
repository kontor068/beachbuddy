import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultRegionId = 'south-aegean-naxos';
const regionId = process.argv.find(arg => arg.startsWith('--region='))
  ?.split('=')[1] || defaultRegionId;
const outDir = process.argv.find(arg => arg.startsWith('--out-dir='))
  ?.split('=')[1] || path.join('reports', 'wind-profile-evidence');

const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const strictNaxosMediumIds = new Set([
  1991, 1992, 1999, 2000, 2002, 2004, 2015, 2016, 2017,
]);
const verifiedNaxosMapEvidenceIds = new Set([
  1991, 1992, 1999, 2000, 2002, 2004, 2007, 2015, 2016, 2017, 2018,
]);
const manualLowBlockersByBeachId = {
  2007: 'Mikri Vigla south-side separation from the north/wind-sport side needs local verification before confidence upgrade.',
};
const authoredExposedSectorsByBeachId = {
  1981: ['W', 'SW', 'NW'],
  1982: ['S', 'SW', 'W'],
  1983: ['N', 'NE', 'NW'],
  1984: ['W', 'SW', 'NW'],
  1985: ['W', 'SW', 'NW'],
  1986: ['N', 'NE', 'E'],
  1987: ['W', 'SW', 'NW'],
  1988: ['N', 'NW', 'W'],
  1989: ['N', 'NE', 'E'],
  1990: ['N', 'NE', 'E'],
  1991: ['W', 'NW', 'N'],
  1992: ['N', 'NW', 'W'],
  1993: ['W', 'SW', 'NW'],
  1994: ['N', 'NW', 'W'],
  1995: ['S', 'SE', 'SW'],
  1996: ['N', 'NE', 'NW'],
  1997: ['W', 'SW', 'NW'],
  1998: ['W', 'SW', 'NW'],
  1999: ['E', 'SE', 'S'],
  2000: ['E', 'SE', 'S'],
  2001: ['N', 'NE', 'E'],
  2002: ['N', 'NE', 'E'],
  2003: ['N', 'NE', 'E'],
  2004: ['N', 'NE', 'NW'],
  2005: ['N', 'NW', 'W'],
  2006: ['N', 'NW', 'W'],
  2007: ['S', 'SW', 'W'],
  2008: ['W', 'SW', 'NW'],
  2009: ['NE', 'E', 'SE'],
  2010: ['N', 'NW', 'W'],
  2011: ['E', 'SE', 'S'],
  2012: ['W', 'SW', 'NW'],
  2013: ['S', 'SW', 'W'],
  2014: ['E', 'SE', 'S'],
  2015: ['E', 'SE', 'S'],
  2016: ['N', 'NW', 'W'],
  2017: ['E', 'SE', 'S'],
  2018: ['N', 'NE', 'E'],
  2019: ['W', 'SW', 'NW'],
};

const loadJson = filePath => JSON.parse(readFileSync(path.join(root, filePath), 'utf8'));

const appPayload = loadJson(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`));
const geospatialPayload = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`));
const beaches = Array.isArray(appPayload)
  ? appPayload
  : appPayload.island?.beaches || appPayload.beaches || [];
const geospatialProfiles = geospatialPayload.profiles || {};

const sourceUrlsFor = beach => [
  ...(beach.sourceUrls || []),
  ...(beach.metadata?.sourceUrls || []),
  ...(beach.verification_sources || []),
  ...(beach.metadata?.verification_sources || []),
];

const sourceNotesFor = beach => [
  ...(Array.isArray(beach.sourceNotes) ? beach.sourceNotes : beach.sourceNotes ? [beach.sourceNotes] : []),
  ...(Array.isArray(beach.metadata?.sourceNotes)
    ? beach.metadata.sourceNotes
    : beach.metadata?.sourceNotes
      ? [beach.metadata.sourceNotes]
      : []),
];

const hasValidGeospatialProfile = profile => Boolean(
  profile &&
  profile.confidence === 'medium' &&
  typeof profile.facingDeg === 'number' &&
  sectors.every(sector => profile.sectors?.[sector]?.level)
);

const hasMapIdentityEvidence = beach => {
  const urls = sourceUrlsFor(beach);
  return urls.some(url => /openstreetmap\.org/i.test(url)) ||
    (regionId === defaultRegionId && verifiedNaxosMapEvidenceIds.has(beach.id));
};

const hasOfficialStaticEvidence = beach => {
  const urls = sourceUrlsFor(beach);
  return urls.some(url => /(naxos\.gr|blueflag\.gr)/i.test(url));
};

const hasGoogleUnresolvedGate = beach => beach.metadata?.googleMapsNavigation?.status === 'unresolved';

const hasProtectedSectorConflict = (beach, profile) => {
  const authoredSectors = authoredExposedSectorsByBeachId[beach.id] || [];
  if (authoredSectors.length === 0) return false;
  return authoredSectors.some(sector => profile?.sectors?.[sector]?.level === 'protected');
};

const confidenceFor = (beach, profile) => {
  const reasons = [];
  if (!hasValidGeospatialProfile(profile)) reasons.push('missing usable medium geospatial exposure');
  if (!hasMapIdentityEvidence(beach)) reasons.push('missing OSM same-beach identity evidence');
  if (hasGoogleUnresolvedGate(beach)) reasons.push('Google Maps navigation identity unresolved');
  if (hasProtectedSectorConflict(beach, profile)) {
    reasons.push('authored exposed sectors conflict with geospatial protected sectors');
  }
  if (beach.metadata?.confidence === 'low') reasons.push('static beach metadata is low confidence');
  if (manualLowBlockersByBeachId[beach.id]) reasons.push(manualLowBlockersByBeachId[beach.id]);

  const recommendedConfidence = reasons.length === 0 ? 'medium' : 'low';
  return { recommendedConfidence, reasons };
};

const records = beaches.map(beach => {
  const profile = geospatialProfiles[String(beach.id)];
  const urls = sourceUrlsFor(beach);
  const confidence = confidenceFor(beach, profile);
  return {
    beachId: beach.id,
    name: beach.name?.en,
    recommendedWindProfileConfidence: confidence.recommendedConfidence,
    currentEvidence: {
      coordinateIdentity: hasMapIdentityEvidence(beach) ? 'osm-same-beach' : 'not-osm-backed',
      staticEvidence: hasOfficialStaticEvidence(beach) ? 'official-or-blue-flag' : 'non-official-or-missing',
      geospatial: hasValidGeospatialProfile(profile)
        ? {
          confidence: profile.confidence,
          facingDeg: profile.facingDeg,
          source: profile.source || geospatialPayload.source?.landMask?.confidence || 'natural-earth-baseline',
        }
        : 'missing-or-unusable',
      googleMapsNavigation: beach.metadata?.googleMapsNavigation?.status || 'not-checked',
      accessAmenitiesConfidence: beach.metadata?.confidence || 'unknown',
    },
    blockers: confidence.reasons,
    sourceUrls: urls,
  };
});

const summary = records.reduce((current, record) => {
  current.total += 1;
  current[record.recommendedWindProfileConfidence] += 1;
  if (record.blockers.length > 0) current.blocked += 1;
  return current;
}, { total: 0, high: 0, medium: 0, low: 0, blocked: 0 });

if (regionId === defaultRegionId) {
  const mediumIds = records
    .filter(record => record.recommendedWindProfileConfidence === 'medium')
    .map(record => record.beachId)
    .sort((a, b) => a - b);
  const expectedMediumIds = [...strictNaxosMediumIds].sort((a, b) => a - b);
  const sameIds = mediumIds.length === expectedMediumIds.length &&
    mediumIds.every((id, index) => id === expectedMediumIds[index]);

  if (!sameIds) {
    throw new Error(
      `Naxos wind-profile evidence gate drifted. Expected medium ids ${expectedMediumIds.join(',')}; got ${mediumIds.join(',')}.`
    );
  }
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  regionId,
  policy: {
    lowToMedium: [
      'OSM same-beach identity evidence exists',
      'generated geospatial profile is usable and medium confidence',
      'Google Maps navigation is not explicitly unresolved',
      'static beach metadata is not low confidence',
      'authored exposed-sector notes do not contradict protected geospatial sectors',
    ],
    mediumToHigh: [
      'not granted by this audit',
      'requires high-resolution shoreline geometry plus trusted local/nautical/watersports or repeated observed behavior',
    ],
  },
  summary,
  records,
};

mkdirSync(path.join(root, outDir), { recursive: true });
const outPath = path.join(root, outDir, `${regionId}.json`);
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outPath, summary }, null, 2));

import fs from 'node:fs';
import path from 'node:path';

const DATA_PATH = path.join('public', 'greek_beaches.json');
const REPORT_DIR = path.join('reports', 'phase2');
const JSON_REPORT = path.join(REPORT_DIR, 'beach-verification-coverage.json');
const MD_REPORT = path.join(REPORT_DIR, 'beach-verification-coverage.md');
const CSV_REPORT = path.join(REPORT_DIR, 'beach-verification-priorities.csv');

const HARD_ACCESS_TYPES = new Set(['difficult_dirt_road', 'hiking_path_difficult', 'boat_only']);
const MODERATE_ACCESS_TYPES = new Set(['passable_dirt_road', 'hiking_path_easy']);
const SOURCE_BACKED_CLAIM_TYPES = [
  'lifeguard',
  'hard_access',
  'moderate_access',
  'beach_bar',
  'organized',
  'high_confidence',
  'medium_confidence',
];

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const normalizeArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)].filter(Boolean);
};

const includesText = (values, regex) => normalizeArray(values).some(value => regex.test(value));

const getSourceEvidence = metadata => {
  const sourceUrls = normalizeArray(metadata?.sourceUrls);
  const verificationSources = normalizeArray(metadata?.verification_sources);
  const sourceNotes = normalizeArray(metadata?.sourceNotes)
    .filter(note => !/^phase 2 audit/i.test(note));

  return {
    sourceUrls,
    verificationSources,
    sourceNotes,
    sourceUrlCount: sourceUrls.length,
    verificationSourceCount: verificationSources.length,
    sourceNoteCount: sourceNotes.length,
    hasUrl: sourceUrls.length > 0,
    hasAnyEvidence: sourceUrls.length > 0 || verificationSources.length > 0 || sourceNotes.length > 0,
  };
};

function* walkBeachRecords(node, pathParts = []) {
  if (Array.isArray(node)) {
    for (const [index, beach] of node.entries()) {
      yield {
        beach,
        index,
        region: pathParts[0] || 'Unknown',
        prefecture: pathParts[1] || 'Unknown',
        place: pathParts[2] || 'Unknown',
      };
    }
    return;
  }

  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    yield* walkBeachRecords(value, [...pathParts, key]);
  }
}

const csvEscape = value => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const records = [];
const findings = [];
const rawRecords = [];

for (const item of walkBeachRecords(data)) {
  const { beach, region, prefecture, place, index } = item;
  const lat = typeof beach?.lat === 'number' ? beach.lat : Number(beach?.lat);
  const lon = typeof beach?.lon === 'number' ? beach.lon : Number(beach?.lon);
  const name = typeof beach?.name === 'string' && beach.name.trim() ? beach.name.trim() : 'Unknown';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (beach?.metadata?.excludeFromApp === true) continue;

  rawRecords.push({
    beach,
    region,
    prefecture,
    place,
    index,
    name,
    lat,
    lon,
  });
}

const dedupedRecords = [];
const seenExactKeys = new Set();
for (const item of rawRecords) {
  const key = `${item.region}|${item.place}|${item.name}|${item.lat.toFixed(6)}|${item.lon.toFixed(6)}`;
  if (seenExactKeys.has(key)) continue;
  seenExactKeys.add(key);
  dedupedRecords.push(item);
}

for (const item of dedupedRecords) {
  const { beach, region, prefecture, place, index, name, lat, lon } = item;
  const metadata = beach.metadata || {};
  const amenities = normalizeArray(metadata.amenities);
  const accessType = metadata.access?.type || 'unknown';
  const confidence = metadata.confidence || 'unknown';
  const evidence = getSourceEvidence(metadata);
  const hasLifeguard = includesText(amenities, /lifeguard|ναυαγ/i);
  const hasBeachBar = includesText(amenities, /beach\s*bar|beachbar|beach club/i);
  const hasOrganizedServices = Boolean(metadata.organized) || includesText(
    amenities,
    /ξαπλώστρ|ομπρέλ|sunbed|umbrella|ντους|wc|τουαλέτ|αποδυτήρ/i,
  );

  const claimTypes = [];
  if (hasLifeguard) claimTypes.push('lifeguard');
  if (HARD_ACCESS_TYPES.has(accessType)) claimTypes.push('hard_access');
  if (MODERATE_ACCESS_TYPES.has(accessType)) claimTypes.push('moderate_access');
  if (hasBeachBar) claimTypes.push('beach_bar');
  if (hasOrganizedServices) claimTypes.push('organized');
  if (confidence === 'high') claimTypes.push('high_confidence');
  if (confidence === 'medium') claimTypes.push('medium_confidence');

  const beachId = `${region} > ${prefecture} > ${place} #${index}`;
  const record = {
    beachId,
    region,
    prefecture,
    place,
    index,
    name,
    lat,
    lon,
    accessType,
    confidence,
    sourceUrlCount: evidence.sourceUrlCount,
    verificationSourceCount: evidence.verificationSourceCount,
    sourceNoteCount: evidence.sourceNoteCount,
    hasAnyEvidence: evidence.hasAnyEvidence,
    claimTypes,
    priorityScore: 0,
    priorityReasons: [],
  };

  const addFinding = (severity, type, reason, score) => {
    findings.push({
      severity,
      type,
      reason,
      beachId,
      region,
      prefecture,
      place,
      index,
      name,
      accessType,
      confidence,
      sourceUrlCount: evidence.sourceUrlCount,
      verificationSourceCount: evidence.verificationSourceCount,
      sourceNoteCount: evidence.sourceNoteCount,
    });
    record.priorityScore += score;
    record.priorityReasons.push(`${severity}:${type}`);
  };

  if (hasLifeguard && !evidence.hasUrl) {
    addFinding('high', 'lifeguard_without_source_url', 'Lifeguard claim needs a direct source URL.', 100);
  }

  if (HARD_ACCESS_TYPES.has(accessType) && !evidence.hasUrl) {
    addFinding('high', 'hard_access_without_source_url', 'Difficult/boat-only access needs direct source evidence.', 85);
  }

  if (confidence === 'high' && !evidence.hasAnyEvidence) {
    addFinding('high', 'high_confidence_without_evidence', 'High confidence should be evidence-backed.', 80);
  }

  if (hasBeachBar && !evidence.hasUrl) {
    addFinding('medium', 'beach_bar_without_source_url', 'Beach bar claim should be source-backed or downgraded.', 50);
  }

  if (hasOrganizedServices && !evidence.hasUrl) {
    addFinding('medium', 'organized_without_source_url', 'Organized/paid/seasonal services should be source-backed.', 35);
  }

  if (MODERATE_ACCESS_TYPES.has(accessType) && !evidence.hasAnyEvidence) {
    addFinding('medium', 'moderate_access_without_evidence', 'Dirt-road/path access should have at least one evidence note/source.', 30);
  }

  if (confidence === 'medium' && !evidence.hasAnyEvidence) {
    addFinding('medium', 'medium_confidence_without_evidence', 'Medium confidence should be justified before launch.', 20);
  }

  if (!evidence.hasAnyEvidence) {
    addFinding('low', 'no_source_evidence', 'No source URL, verification source, or source note recorded.', 10);
  }

  records.push(record);
}

const bySeverity = findings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] || 0) + 1;
  return acc;
}, {});

const byType = findings.reduce((acc, finding) => {
  acc[finding.type] = (acc[finding.type] || 0) + 1;
  return acc;
}, {});

const byRegion = records.reduce((acc, record) => {
  if (!acc[record.region]) {
    acc[record.region] = {
      beaches: 0,
      withoutEvidence: 0,
      withUrl: 0,
      highPriority: 0,
    };
  }
  acc[record.region].beaches += 1;
  if (!record.hasAnyEvidence) acc[record.region].withoutEvidence += 1;
  if (record.sourceUrlCount > 0) acc[record.region].withUrl += 1;
  if (record.priorityScore >= 80) acc[record.region].highPriority += 1;
  return acc;
}, {});

const prioritizedRecords = records
  .filter(record => record.priorityScore > 0)
  .sort((a, b) => b.priorityScore - a.priorityScore || a.region.localeCompare(b.region) || a.name.localeCompare(b.name));

const claimCoverage = SOURCE_BACKED_CLAIM_TYPES.reduce((acc, type) => {
  const claimRecords = records.filter(record => record.claimTypes.includes(type));
  acc[type] = {
    total: claimRecords.length,
    withUrl: claimRecords.filter(record => record.sourceUrlCount > 0).length,
    withAnyEvidence: claimRecords.filter(record => record.hasAnyEvidence).length,
  };
  return acc;
}, {});

fs.mkdirSync(REPORT_DIR, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  source: DATA_PATH,
  totals: {
    beaches: records.length,
    withSourceUrl: records.filter(record => record.sourceUrlCount > 0).length,
    withAnyEvidence: records.filter(record => record.hasAnyEvidence).length,
    withoutAnyEvidence: records.filter(record => !record.hasAnyEvidence).length,
    findings: findings.length,
    bySeverity,
    byType,
  },
  claimCoverage,
  byRegion,
  topPriority: prioritizedRecords.slice(0, 250),
  findings,
};

fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`);

const csvRows = [
  [
    'priorityScore',
    'priorityReasons',
    'region',
    'prefecture',
    'place',
    'index',
    'name',
    'accessType',
    'confidence',
    'sourceUrlCount',
    'verificationSourceCount',
    'sourceNoteCount',
  ],
  ...prioritizedRecords.map(record => [
    record.priorityScore,
    record.priorityReasons.join('|'),
    record.region,
    record.prefecture,
    record.place,
    record.index,
    record.name,
    record.accessType,
    record.confidence,
    record.sourceUrlCount,
    record.verificationSourceCount,
    record.sourceNoteCount,
  ]),
];
fs.writeFileSync(CSV_REPORT, `${csvRows.map(row => row.map(csvEscape).join(',')).join('\n')}\n`);

const regionLines = Object.entries(byRegion)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([region, stats]) => `| ${region} | ${stats.beaches} | ${stats.withUrl} | ${stats.withoutEvidence} | ${stats.highPriority} |`);

const claimLines = Object.entries(claimCoverage)
  .map(([type, stats]) => `| ${type} | ${stats.total} | ${stats.withUrl} | ${stats.withAnyEvidence} |`);

const topLines = prioritizedRecords.slice(0, 40)
  .map(record => `| ${record.priorityScore} | ${record.region} | ${record.place} | ${record.name} | ${record.accessType} | ${record.confidence} | ${record.priorityReasons.join('<br>')} |`);

const markdown = `# Beach Data Verification Phase 2 Coverage

Generated: ${report.generatedAt}

This report measures evidence coverage and launch-risk priority for every beach record. It does not prove correctness; it shows what still needs source-backed verification.

## Totals

- Beaches: ${report.totals.beaches}
- With direct source URL: ${report.totals.withSourceUrl}
- With any evidence field: ${report.totals.withAnyEvidence}
- Without any evidence: ${report.totals.withoutAnyEvidence}
- Findings: ${report.totals.findings}
- High findings: ${bySeverity.high || 0}
- Medium findings: ${bySeverity.medium || 0}
- Low findings: ${bySeverity.low || 0}

## Claim Coverage

| Claim type | Total | With URL | With any evidence |
| --- | ---: | ---: | ---: |
${claimLines.join('\n')}

## Region Coverage

| Region | Beaches | With URL | Without evidence | High-priority records |
| --- | ---: | ---: | ---: | ---: |
${regionLines.join('\n')}

## Top Priority Records

| Score | Region | Place | Beach | Access | Confidence | Reasons |
| ---: | --- | --- | --- | --- | --- | --- |
${topLines.join('\n')}

Full JSON: \`${JSON_REPORT}\`

Priority CSV: \`${CSV_REPORT}\`
`;

fs.writeFileSync(MD_REPORT, markdown);

console.log('Beach Verification Phase 2 Coverage');
console.log(`Beaches: ${report.totals.beaches}`);
console.log(`With direct source URL: ${report.totals.withSourceUrl}`);
console.log(`With any evidence: ${report.totals.withAnyEvidence}`);
console.log(`Without evidence: ${report.totals.withoutAnyEvidence}`);
console.log(`Findings: ${report.totals.findings} (high ${bySeverity.high || 0}, medium ${bySeverity.medium || 0}, low ${bySeverity.low || 0})`);
console.log(`JSON report: ${JSON_REPORT}`);
console.log(`Markdown report: ${MD_REPORT}`);
console.log(`Priority CSV: ${CSV_REPORT}`);

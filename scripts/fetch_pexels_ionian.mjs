/**
 * Fetches ONE representative cover photo from Pexels for each Ionian island.
 * Run with: PEXELS_API_KEY=... node scripts/fetch_pexels_ionian.mjs
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

if (!PEXELS_API_KEY) {
  console.error('Missing PEXELS_API_KEY environment variable.');
  process.exit(1);
}

const IONIAN_ISLANDS = [
  { key: 'corfu',      en: 'Corfu',      gr: 'Κέρκυρα',    query: 'Corfu beach Greece' },
  { key: 'paxos',     en: 'Paxos',      gr: 'Παξοί',      query: 'Paxos beach Greece' },
  { key: 'antipaxos', en: 'Antipaxos',  gr: 'Αντίπαξοι',  query: 'Antipaxos beach Greece' },
  { key: 'lefkada',   en: 'Lefkada',    gr: 'Λευκάδα',    query: 'Lefkada beach Greece' },
  { key: 'kefalonia', en: 'Kefalonia',  gr: 'Κεφαλονιά',  query: 'Kefalonia beach Greece' },
  { key: 'ithaca',    en: 'Ithaca',     gr: 'Ιθάκη',      query: 'Ithaca Greece island' },
  { key: 'zakynthos', en: 'Zakynthos',  gr: 'Ζάκυνθος',   query: 'Zakynthos beach Greece' },
  { key: 'meganisi',  en: 'Meganisi',   gr: 'Μεγανήσι',   query: 'Meganisi Lefkada Greece' },
  { key: 'othonoi',   en: 'Othonoi',    gr: 'Οθωνοί',     query: 'Othonoi Corfu Greece island' },
  { key: 'erikoussa', en: 'Erikoussa',  gr: 'Ερείκουσσα', query: 'Erikoussa Corfu Greece island' },
  { key: 'mathraki',  en: 'Mathraki',   gr: 'Μαθράκι',    query: 'Mathraki Corfu Greece island' },
];

async function fetchPexelsPhoto(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY }
  });
  if (!res.ok) {
    console.error(`  Pexels error ${res.status} for: ${query}`);
    return null;
  }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) {
    console.warn(`  No results for: ${query}`);
    return null;
  }
  // Use large2x (1880px) or large (940px) for good quality
  return photo.src.large2x || photo.src.large;
}

async function main() {
  console.log('Fetching Pexels cover photos for Ionian Islands...\n');
  const results = {};

  for (const island of IONIAN_ISLANDS) {
    process.stdout.write(`  ${island.en} (${island.gr})... `);
    const url = await fetchPexelsPhoto(island.query);
    if (url) {
      results[island.key] = { en: island.en, gr: island.gr, url };
      console.log('✓');
    } else {
      console.log('✗ no photo found');
    }
    // Respect rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n--- RESULTS ---');
  console.log(JSON.stringify(results, null, 2));

  // Generate the TypeScript code to add to beachPhotos.ts
  console.log('\n--- TypeScript code for beachPhotos.ts ---\n');

  const lines = [];
  lines.push('const IONIAN_ISLAND_PHOTOS: Record<string, string[]> = {');
  for (const [key, val] of Object.entries(results)) {
    lines.push(`  // ${val.en} / ${val.gr}`);
    lines.push(`  '${val.en}': ['${val.url}'],`);
    lines.push(`  '${val.gr}': ['${val.url}'],`);
  }
  lines.push('};');
  console.log(lines.join('\n'));

  // Also generate aliases
  const aliasLines = [];
  aliasLines.push('\nconst IONIAN_ISLAND_ALIASES: Record<string, string> = {');
  for (const [key, val] of Object.entries(results)) {
    const normalized = val.en.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedGr = val.gr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    aliasLines.push(`  ${normalized}: '${key}',`);
    aliasLines.push(`  ${normalizedGr}: '${key}',`);
  }
  aliasLines.push('};');
  console.log(aliasLines.join('\n'));
}

main().catch(console.error);

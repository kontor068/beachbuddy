import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const publicDir = path.join(projectRoot, 'public');
const reportPath = path.join(projectRoot, 'reports', 'destination-card-image-optimization.json');

const userAgent = 'CalmBeachImageOptimizer/1.0 (https://calmbeach.gr)';
const target = {
  width: 800,
  height: 600,
  maxBytes: 120 * 1024,
  minBytes: 50 * 1024,
};

const candidates = [
  {
    destinationId: 'crete',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_Balos_beach.jpg',
    outputPath: '/images/destinations/crete/crete-balos-beach-card.webp',
  },
  {
    destinationId: 'rhodes',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rhodos_Lindos_Beach_R01.jpg',
    outputPath: '/images/destinations/rhodes/rhodes-lindos-beach-card.webp',
  },
  {
    destinationId: 'corfu',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Corfu_Paleokastritsa_Beach_R01.jpg',
    outputPath: '/images/destinations/corfu/corfu-paleokastritsa-beach-card.webp',
  },
  {
    destinationId: 'zakynthos',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Navagio_beach_Zakynthos_3.jpg',
    outputPath: '/images/destinations/zakynthos/zakynthos-navagio-beach-card.webp',
  },
  {
    destinationId: 'kefalonia',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Myrtos_Beach,_Kefalonia.jpg',
    outputPath: '/images/destinations/kefalonia/kefalonia-myrtos-beach-card.webp',
  },
  {
    destinationId: 'lefkada',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Porto_Katsiki_Beach,_Lefkada,_Ionian_Islands,_Greece.jpg',
    outputPath: '/images/destinations/lefkada/lefkada-porto-katsiki-card.webp',
  },
  {
    destinationId: 'naxos',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Portara_of_Naxos_at_Sunset.jpg',
    outputPath: '/images/destinations/naxos/naxos-portara-sunset-card.webp',
  },
  {
    destinationId: 'paros',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Paros_Kolymbithres1_tango7174.jpg',
    outputPath: '/images/destinations/paros/paros-kolymbithres-card.webp',
  },
  {
    destinationId: 'mykonos',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Windmills_in_Mykonos_01.jpg',
    outputPath: '/images/destinations/mykonos/mykonos-chora-windmills-card.webp',
  },
  {
    destinationId: 'santorini',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Oia_-_Santorini_-_Greece_-_16.jpg',
    outputPath: '/images/destinations/santorini/santorini-oia-caldera-card.webp',
  },
];

const fetchJson = async url => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }

  return response.json();
};

const downloadBuffer = async url => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const getCommonsTitle = sourceUrl => {
  const title = decodeURIComponent(new URL(sourceUrl).pathname.split('/wiki/File:')[1] || '');
  if (!title) {
    throw new Error(`Could not parse Commons file title from ${sourceUrl}`);
  }

  return `File:${title}`;
};

const getOriginalImageUrl = async sourceUrl => {
  const params = new URLSearchParams({
    action: 'query',
    titles: getCommonsTitle(sourceUrl),
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
  });
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  const page = Object.values(data.query?.pages || {})[0];
  const originalUrl = page?.imageinfo?.[0]?.url;

  if (!originalUrl) {
    throw new Error(`Could not resolve original image URL for ${sourceUrl}`);
  }

  return originalUrl;
};

const renderWebp = async (inputBuffer, quality) => (
  sharp(inputBuffer)
    .rotate()
    .resize(target.width, target.height, {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({
      quality,
      effort: 6,
    })
    .toBuffer()
);

const optimizeWebp = async inputBuffer => {
  const attempts = [];

  for (let quality = 96; quality >= 48; quality -= 4) {
    const output = await renderWebp(inputBuffer, quality);
    attempts.push({ quality, sizeBytes: output.length });

    if (output.length <= target.maxBytes) {
      return { output, quality, attempts };
    }
  }

  const fallback = await renderWebp(inputBuffer, 44);
  attempts.push({ quality: 44, sizeBytes: fallback.length });
  return { output: fallback, quality: 44, attempts };
};

const toAbsolutePublicPath = publicPath => path.join(publicDir, publicPath.replace(/^\/+/, ''));

const main = async () => {
  const results = [];

  for (const candidate of candidates) {
    console.log(`Optimizing ${candidate.destinationId} card...`);
    const originalUrl = await getOriginalImageUrl(candidate.sourceUrl);
    const originalBuffer = await downloadBuffer(originalUrl);
    const { output, quality, attempts } = await optimizeWebp(originalBuffer);
    const outputFile = toAbsolutePublicPath(candidate.outputPath);

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, output);

    const metadata = await sharp(output).metadata();
    const fileStats = await stat(outputFile);
    const withinTarget = fileStats.size >= target.minBytes && fileStats.size <= target.maxBytes;

    results.push({
      ...candidate,
      originalUrl,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: fileStats.size,
      sizeKb: Number((fileStats.size / 1024).toFixed(1)),
      quality,
      withinTarget,
      attempts,
    });
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    target,
    results,
  }, null, 2)}\n`);

  for (const result of results) {
    console.log(`${result.outputPath}: ${result.width}x${result.height}, ${result.sizeKb}KB, q${result.quality}, target=${result.withinTarget}`);
  }

  const failed = results.filter(result => !result.withinTarget);
  if (failed.length > 0) {
    console.warn(`Some files are outside target size: ${failed.map(item => item.outputPath).join(', ')}`);
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

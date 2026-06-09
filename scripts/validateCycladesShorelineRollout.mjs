import { spawn } from 'node:child_process';
import path from 'node:path';

const validatedRegions = [
  { regionId: 'south-aegean-naxos', slug: 'naxos' },
  { regionId: 'south-aegean-paros', slug: 'paros' },
  { regionId: 'south-aegean-milos', slug: 'milos' },
  { regionId: 'south-aegean-andros', slug: 'andros' },
  { regionId: 'south-aegean-tinos', slug: 'tinos' },
  { regionId: 'south-aegean-syros', slug: 'syros' },
  { regionId: 'south-aegean-mykonos', slug: 'mykonos' },
  { regionId: 'south-aegean-santorini', slug: 'santorini' },
  { regionId: 'south-aegean-ios', slug: 'ios' },
  { regionId: 'south-aegean-sifnos', slug: 'sifnos' },
  { regionId: 'south-aegean-serifos', slug: 'serifos' },
  { regionId: 'south-aegean-kythnos', slug: 'kythnos' },
  { regionId: 'south-aegean-kea', slug: 'kea' },
];

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const basePort = Number(args.get('base-port') || 4190);
const outDir = args.get('out-dir') || path.join('reports', 'cyclades-shoreline-rollout');

const runCommand = (command, commandArgs) => new Promise((resolve, reject) => {
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', code => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code}`));
  });
  child.on('error', reject);
});

for (const [index, region] of validatedRegions.entries()) {
  console.log(`\nValidating shoreline consistency for ${region.regionId}`);
  await runCommand('node', [
    'scripts/validateShorelineSegmentConsistency.mjs',
    `--region=${region.regionId}`,
    `--out-dir=${path.join(outDir, 'shoreline-segment-consistency')}`,
  ]);

  console.log(`\nValidating map stability for ${region.slug}`);
  await runCommand('node', [
    'scripts/validateRegionMapStability.mjs',
    `--region-slug=${region.slug}`,
    `--port=${basePort + index}`,
    `--out-dir=${path.join(outDir, 'map-stability')}`,
  ]);
}

console.log('\nCyclades shoreline rollout validation passed.');

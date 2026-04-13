import './components/loader.js';
import { renderBadge } from './core/renderer.js';
import { registry } from './core/registry.js';
import { createRNG } from './core/rng.js';
import { buildPipeline } from './core/pipeline.js';
import fs from 'fs';

async function main() {
  const stats = registry.stats();
  console.log('Registry:', JSON.stringify(stats));

  // Diversity
  const combos = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const sha = (i * 7919).toString(16).padStart(7, '0');
    const rng = createRNG(sha);
    const pipe = buildPipeline(rng);
    combos.add(JSON.stringify(pipe.patterns));
  }
  console.log(`Unique combos in 100 SHAs: ${combos.size}`);

  const svgBuffer = fs.readFileSync('icon.svg');

  // Determinism
  const gif1 = await renderBadge(svgBuffer, 'abc1234', { width: 64, height: 64, frames: 5 });
  const gif2 = await renderBadge(svgBuffer, 'abc1234', { width: 64, height: 64, frames: 5 });
  console.log('Deterministic:', Buffer.compare(gif1, gif2) === 0);

  // Performance
  const start = Date.now();
  await renderBadge(svgBuffer, 'test123', { width: 256, height: 256, frames: 30 });
  console.log('256x256 30fr:', Date.now() - start, 'ms');

  console.log('All tests passed');
}

main().catch(e => { console.error(e); process.exit(1); });

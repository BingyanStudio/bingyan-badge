import './components/loader.js';
import { renderBadge } from './core/renderer.js';
import { registry } from './core/registry.js';
import { createRNG } from './core/rng.js';
import { buildPipeline } from './core/pipeline.js';
import fs from 'fs';

async function main() {
  const stats = registry.stats();
  console.log('Registry:', JSON.stringify(stats));

  const svgBuffer = fs.readFileSync('icon.svg');

  const shas = ['abc1234', 'deadbee', '1337c0d', 'ff00ff0', '0a0b0c0'];
  for (const sha of shas) {
    const rng = createRNG(sha);
    const pipe = buildPipeline(rng);
    console.log(sha, '→', JSON.stringify(pipe.patterns));
  }

  // Diversity check
  const combos = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const sha = (i * 7919).toString(16).padStart(7, '0');
    const rng = createRNG(sha);
    const pipe = buildPipeline(rng);
    combos.add(JSON.stringify(pipe.patterns));
  }
  console.log(`Unique combos in 50 SHAs: ${combos.size}`);

  const start = Date.now();
  const gif = await renderBadge(svgBuffer, 'abc1234', { width: 128, height: 128, frames: 10 });
  console.log('128x128 10fr:', gif.length, 'bytes,', Date.now() - start, 'ms');

  const start2 = Date.now();
  const gif2 = await renderBadge(svgBuffer, 'abc1234', { width: 256, height: 256, frames: 30 });
  console.log('256x256 30fr:', gif2.length, 'bytes,', Date.now() - start2, 'ms');
  fs.mkdirSync('.temp', { recursive: true });
  fs.writeFileSync('.temp/test_ts.gif', gif2);

  // Determinism
  const gif3 = await renderBadge(svgBuffer, 'abc1234', { width: 128, height: 128, frames: 10 });
  console.log('Deterministic:', Buffer.compare(gif, gif3) === 0);

  console.log('All tests passed');
}

main().catch(e => { console.error(e); process.exit(1); });

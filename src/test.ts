import './components/loader.js';
import { renderBadge } from './core/renderer.js';
import { registry } from './core/registry.js';
import { createRNG } from './core/rng.js';
import { buildPipeline } from './core/pipeline.js';
import { buildGeometry, applyMask } from './core/path-engine.js';
import { ScalarField } from './core/fields.js';
import sharp from 'sharp';
import fs from 'fs';

const SVG_PATH = 'M251.79,18.48C200.36-21.32,113.1,5.3,56.89,77.94S-3.22,241.72,48.21,281.52s138.69,13.18,194.9-59.45S303.22,58.28,251.79,18.48ZM211.66,150.54C187.71,236.44,72.81,257.92,72.81,257.92l22.06-88.80S225.38,101.32,211.66,150.54Zm2.42-78.29c-16.15,46-118.67,79-118.67,79l17-79S239.52-.27,214.08,72.25Z';

async function main() {
  const stats = registry.stats();
  console.log('Registry:', JSON.stringify(stats));

  // Show what pipelines look like now
  console.log('\n=== Sample pipelines ===');
  for (const sha of ['123abc', 'deadbee', 'abc1234', 'ff00ff0', '7777777', '0000000', 'cafebab', '1337c0d']) {
    const rng = createRNG(sha);
    const p = buildPipeline(rng);
    console.log(`${sha}: icon=[${p.desc.icon.join(' → ')}]  bg=[${p.desc.bg.join(' → ')}]  mask=${p.desc.mask}`);
  }

  // Diversity
  const combos = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const sha = (i * 7919).toString(16).padStart(7, '0');
    const rng = createRNG(sha);
    const p = buildPipeline(rng);
    combos.add(JSON.stringify(p.desc));
  }
  console.log(`\nUnique pipelines in 200 SHAs: ${combos.size}`);

  // Brightness audit
  const svgBuf = fs.readFileSync('icon.svg');
  const W = 256, H = 256, FRAMES = 10;
  const geo = buildGeometry(SVG_PATH, [0, 0, 275.91, 300], { tx: -12.05, ty: 0 }, W, H);
  const { data } = await sharp(svgBuf)
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const extMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) extMask[i] = data[i * 4 + 3]! > 10 ? 1 : 0;
  applyMask(geo, extMask);

  let darkCount = 0;
  const testShas: string[] = [];
  for (let i = 0; i < 40; i++) testShas.push((i * 7919 + 1000).toString(16).padStart(7, '0'));

  for (const sha of testShas) {
    const rng = createRNG(sha);
    const pipeline = buildPipeline(rng);
    const feedback: Record<string, ScalarField> = {};
    let totalLum = 0;
    for (let f = 0; f < FRAMES; f++) {
      const pixels = pipeline.execute({ geo, t: f / FRAMES, feedback });
      for (let i = 0; i < W * H; i++) {
        totalLum += pixels[i * 4]! * 0.299 + pixels[i * 4 + 1]! * 0.587 + pixels[i * 4 + 2]! * 0.114;
      }
    }
    const avgLum = totalLum / (W * H * FRAMES);
    if (avgLum < 15) darkCount++;
  }
  console.log(`\nBrightness audit: ${darkCount} / ${testShas.length} too dark (< 15)`);

  // Determinism
  const gif1 = await renderBadge(svgBuf, 'abc1234', { width: 64, height: 64, frames: 5 });
  const gif2 = await renderBadge(svgBuf, 'abc1234', { width: 64, height: 64, frames: 5 });
  console.log('Deterministic:', Buffer.compare(gif1, gif2) === 0);

  // Loop test
  const rng = createRNG('looptest');
  const pipeline = buildPipeline(rng);
  const fb0: Record<string, ScalarField> = {};
  const fb1: Record<string, ScalarField> = {};
  const f0 = pipeline.execute({ geo, t: 0, feedback: fb0 });
  // new pipeline with same seed for t=1
  const rng2 = createRNG('looptest');
  const pipeline2 = buildPipeline(rng2);
  const f1 = pipeline2.execute({ geo, t: 1, feedback: fb1 });
  let maxDiff = 0;
  for (let i = 0; i < f0.length; i++) maxDiff = Math.max(maxDiff, Math.abs(f0[i]! - f1[i]!));
  console.log(`Loop test: maxDiff=${maxDiff} ${maxDiff <= 1 ? 'PASS' : 'FAIL'}`);

  console.log('\nAll tests passed');
}

main().catch(e => { console.error(e); process.exit(1); });

// 色相诊断：量化管线中色相"转圈圈"（rainbow/RGB 效果）的概率和来源
import './components/loader.js';
import { registry } from './core/registry.js';
import { createRNG } from './core/rng.js';
import { buildPipeline } from './core/pipeline.js';
import { buildGeometry, applyMask } from './core/path-engine.js';
import { ScalarField } from './core/fields.js';
import sharp from 'sharp';
import fs from 'fs';

const SVG_PATH = 'M251.79,18.48C200.36-21.32,113.1,5.3,56.89,77.94S-3.22,241.72,48.21,281.52s138.69,13.18,194.9-59.45S303.22,58.28,251.79,18.48ZM211.66,150.54C187.71,236.44,72.81,257.92,72.81,257.92l22.06-88.80S225.38,101.32,211.66,150.54Zm2.42-78.29c-16.15,46-118.67,79-118.67,79l17-79S239.52-.27,214.08,72.25Z';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

async function main() {
  const W = 64, H = 64, FRAMES = 3;
  const svgBuf = fs.readFileSync('icon.svg');
  const geo = buildGeometry(SVG_PATH, [0, 0, 275.91, 300], { tx: -12.05, ty: 0 }, W, H);
  const { data } = await sharp(svgBuf)
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const extMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) extMask[i] = data[i * 4 + 3]! > 10 ? 1 : 0;
  applyMask(geo, extMask);

  const N = 200;
  let rainbowCount = 0;
  let highHueShiftCount = 0;
  let paletteWideSpreadCount = 0;
  let gradientWideSpreadCount = 0;
  const rainbowPipelines: { desc: any; hueRange: number }[] = [];

  // 统计各问题来源
  const hueSpreadStats: number[] = [];
  const hueShiftStats: number[] = [];
  const hueSpeedStats: number[] = [];
  const spatialHueRanges: number[] = [];
  const temporalHueRanges: number[] = [];

  for (let i = 0; i < N; i++) {
    const sha = (i * 7919 + 42).toString(16).padStart(7, '0');
    const rng = createRNG(sha);
    const pipeline = buildPipeline(rng);
    const desc = pipeline.desc;

    // 分析 pipeline 描述中的色相变化来源
    const hasHslShift = desc.icon.includes('col:hsl-shift') || desc.bg.includes('col:hsl-shift');
    if (hasHslShift) highHueShiftCount++;

    const hasPalette = desc.icon.includes('col:palette') || desc.bg.includes('col:palette');
    if (hasPalette) paletteWideSpreadCount++;

    const hasGradient = desc.icon.includes('col:gradient') || desc.bg.includes('col:gradient');
    if (hasGradient) gradientWideSpreadCount++;

    // 实际渲染，测量色相分布
    const feedback: Record<string, ScalarField> = {};
    const frameHues: number[][] = []; // 每帧的色相分布

    for (let f = 0; f < FRAMES; f++) {
      const pixels = pipeline.execute({ geo, t: f / FRAMES, feedback, transparent: true });
      const hues: number[] = [];
      for (let p = 0; p < W * H; p++) {
        const a = pixels[p * 4 + 3]!;
        if (a < 10) continue;
        const r = pixels[p * 4]! / 255;
        const g = pixels[p * 4 + 1]! / 255;
        const b = pixels[p * 4 + 2]! / 255;
        const [h, s, l] = rgbToHsl(r, g, b);
        if (s > 0.15 && l > 0.05 && l < 0.95) { // 只统计有意义的有彩色像素
          hues.push(h);
        }
      }
      frameHues.push(hues);
    }

    // 计算单帧内的空间色相范围（取中间帧）
    const midHues = frameHues[Math.floor(FRAMES / 2)] ?? [];
    if (midHues.length > 50) {
      // 用环形距离计算色相 range
      const spatialRange = circularHueRange(midHues);
      spatialHueRanges.push(spatialRange);
    }

    // 计算时间维度的色相漂移（首帧 vs 末帧的中位色相差）
    const firstHues = frameHues[0] ?? [];
    const lastHues = frameHues[FRAMES - 1] ?? [];
    if (firstHues.length > 50 && lastHues.length > 50) {
      const medFirst = circularMedian(firstHues);
      const medLast = circularMedian(lastHues);
      let drift = Math.abs(medLast - medFirst);
      if (drift > 0.5) drift = 1 - drift;
      temporalHueRanges.push(drift);
    }

    // 判断是否"彩虹"：空间色相范围 > 0.4（覆盖超过 40% 色环）
    const spatialRange = midHues.length > 50 ? circularHueRange(midHues) : 0;
    if (spatialRange > 0.4) {
      rainbowCount++;
      rainbowPipelines.push({ desc, hueRange: spatialRange });
    }
  }

  // 输出报告
  console.log(`\n=== 色相诊断报告 (${N} 个样本) ===\n`);
  console.log(`彩虹效果（空间色相范围 > 40% 色环）: ${rainbowCount}/${N} = ${(rainbowCount / N * 100).toFixed(1)}%`);
  console.log(`包含 hsl-shift 的管线: ${highHueShiftCount}/${N} = ${(highHueShiftCount / N * 100).toFixed(1)}%`);
  console.log(`包含 palette 的管线: ${paletteWideSpreadCount}/${N} = ${(paletteWideSpreadCount / N * 100).toFixed(1)}%`);
  console.log(`包含 gradient 的管线: ${gradientWideSpreadCount}/${N} = ${(gradientWideSpreadCount / N * 100).toFixed(1)}%`);

  console.log(`\n--- 空间色相范围分布 ---`);
  printPercentiles(spatialHueRanges);

  console.log(`\n--- 时间色相漂移分布 ---`);
  printPercentiles(temporalHueRanges);

  // 分析哪些组合导致彩虹
  console.log(`\n--- 彩虹样本的管线特征 ---`);
  let rbGrad = 0, rbPal = 0, rbHsl = 0, rbDuo = 0, rbChromatic = 0;
  const rbSamples = rainbowPipelines.length;
  for (let i = 0; i < rainbowPipelines.length; i++) {
    const { desc, hueRange } = rainbowPipelines[i]!;
    const allIds = [...desc.icon, ...desc.bg];
    if (allIds.includes('col:gradient')) rbGrad++;
    if (allIds.includes('col:palette')) rbPal++;
    if (allIds.includes('col:hsl-shift')) rbHsl++;
    if (allIds.includes('col:duotone')) rbDuo++;
    if (allIds.includes('col:chromatic')) rbChromatic++;
    if (i < 5) {
      console.log(`  样本: icon=[${desc.icon.join(' → ')}]  bg=[${desc.bg.join(' → ')}]  hueRange=${hueRange.toFixed(3)}`);
    }
  }
  if (rbSamples > 0) {
    console.log(`  总彩虹样本: ${rbSamples}`);
    console.log(`  含 gradient: ${rbGrad} (${(rbGrad / rbSamples * 100).toFixed(0)}%)`);
    console.log(`  含 palette: ${rbPal} (${(rbPal / rbSamples * 100).toFixed(0)}%)`);
    console.log(`  含 hsl-shift: ${rbHsl} (${(rbHsl / rbSamples * 100).toFixed(0)}%)`);
    console.log(`  含 duotone: ${rbDuo} (${(rbDuo / rbSamples * 100).toFixed(0)}%)`);
    console.log(`  含 chromatic: ${rbChromatic} (${(rbChromatic / rbSamples * 100).toFixed(0)}%)`);
  }
}

// 环形色相范围：找到覆盖所有色相的最小弧长
function circularHueRange(hues: number[]): number {
  if (hues.length < 2) return 0;
  const sorted = [...hues].sort((a, b) => a - b);
  // 找最大间隙
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i]! - sorted[i - 1]!);
  }
  // 环形间隙
  maxGap = Math.max(maxGap, 1 - sorted[sorted.length - 1]! + sorted[0]!);
  return 1 - maxGap; // 范围 = 1 - 最大间隙
}

function circularMedian(hues: number[]): number {
  // 简化：用 atan2 做环形平均
  let sinSum = 0, cosSum = 0;
  for (const h of hues) {
    sinSum += Math.sin(h * Math.PI * 2);
    cosSum += Math.cos(h * Math.PI * 2);
  }
  return ((Math.atan2(sinSum, cosSum) / (Math.PI * 2)) % 1 + 1) % 1;
}

function printPercentiles(arr: number[]) {
  if (arr.length === 0) { console.log('  (无数据)'); return; }
  const sorted = [...arr].sort((a, b) => a - b);
  const p = (pct: number) => sorted[Math.floor(pct / 100 * (sorted.length - 1))]!.toFixed(3);
  console.log(`  样本数: ${arr.length}`);
  console.log(`  P10=${p(10)}  P25=${p(25)}  P50=${p(50)}  P75=${p(75)}  P90=${p(90)}  P95=${p(95)}  max=${p(100)}`);
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * 色彩质量量化分析工具
 *
 * 基于原画色彩理论的量化指标：
 * - 灰（gray）：对比不够，S 和 L 都集中在中间，看起来糊里糊涂
 * - 跳（jarring）：对比过头，色相/明度跳跃太大，看着难受
 * - 闷（dull）：暗部死黑，缺少光感和色彩变化
 * - 脏（muddy）：看不清固有色，低饱和 + 中等亮度混成一团
 * - 粉（chalky）：红/绿区域加白发粉，失去色彩倾向
 * - 生（raw）：颜色之间缺乏关系，愣凑在一起
 * - 单（flat）：颜色关系不丰富，色彩变化太少
 */

import './components/loader.js';
import { createRNG } from './core/rng.js';
import { buildPipeline } from './core/pipeline.js';
import { buildGeometry, applyMask } from './core/path-engine.js';
import { ScalarField } from './core/fields.js';
import { rgbToHsl } from './core/math.js';
import sharp from 'sharp';
import fs from 'fs';

const SVG_PATH = 'M251.79,18.48C200.36-21.32,113.1,5.3,56.89,77.94S-3.22,241.72,48.21,281.52s138.69,13.18,194.9-59.45S303.22,58.28,251.79,18.48ZM211.66,150.54C187.71,236.44,72.81,257.92,72.81,257.92l22.06-88.80S225.38,101.32,211.66,150.54Zm2.42-78.29c-16.15,46-118.67,79-118.67,79l17-79S239.52-.27,214.08,72.25Z';

interface ColorStats {
  // 基础统计
  avgH: number; avgS: number; avgL: number;
  stdH: number; stdS: number; stdL: number;
  minS: number; maxS: number;
  minL: number; maxL: number;

  // 分布
  satDistribution: { low: number; mid: number; high: number }; // S < 0.3 / 0.3-0.6 / > 0.6
  lumDistribution: { dark: number; mid: number; light: number }; // L < 0.25 / 0.25-0.65 / > 0.65

  // 色相分析
  hueRange: number;         // 色相覆盖范围 (0-1)
  dominantHue: number;      // 主色相
  hueConcentration: number; // 色相集中度 (0=均匀分散, 1=单色)

  // 对比度
  lumContrast: number;      // 亮度对比 (maxL - minL 的 P90-P10)
  satContrast: number;      // 饱和度对比

  // 帧间一致性
  frameConsistency: number; // 帧间像素差的均值 (0=完全一致)
  loopError: number;        // 首尾帧差异
}

interface Diagnosis {
  score: number;          // 0-100, 越高越好
  issues: string[];       // 检测到的问题
  details: Record<string, number>; // 各项打分细节
}

function computePixelHSL(pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number) {
  const hues: number[] = [];
  const sats: number[] = [];
  const lums: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const r = pixels[i * 4]! / 255;
    const g = pixels[i * 4 + 1]! / 255;
    const b = pixels[i * 4 + 2]! / 255;
    const [h, s, l] = rgbToHsl(r, g, b);
    hues.push(h);
    sats.push(s);
    lums.push(l);
  }
  return { hues, sats, lums };
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], avg: number): number {
  return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx]!;
}

// 圆形色相均值（处理色相环绕问题）
function circularMean(hues: number[]): number {
  let sinSum = 0, cosSum = 0;
  for (const h of hues) {
    sinSum += Math.sin(h * Math.PI * 2);
    cosSum += Math.cos(h * Math.PI * 2);
  }
  return ((Math.atan2(sinSum, cosSum) / (Math.PI * 2)) % 1 + 1) % 1;
}

// 圆形色相标准差
function circularStd(hues: number[], avgH: number): number {
  let sum = 0;
  for (const h of hues) {
    let diff = h - avgH;
    if (diff > 0.5) diff -= 1;
    if (diff < -0.5) diff += 1;
    sum += diff * diff;
  }
  return Math.sqrt(sum / hues.length);
}

function analyzeFrame(pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number): ColorStats {
  const { hues, sats, lums } = computePixelHSL(pixels, mask, w, h);

  const avgH = circularMean(hues);
  const avgS = mean(sats);
  const avgL = mean(lums);
  const stdH = circularStd(hues, avgH);
  const stdSVal = std(sats, avgS);
  const stdLVal = std(lums, avgL);

  const lowSat = sats.filter(s => s < 0.3).length / sats.length;
  const midSat = sats.filter(s => s >= 0.3 && s <= 0.6).length / sats.length;
  const highSat = sats.filter(s => s > 0.6).length / sats.length;

  const darkLum = lums.filter(l => l < 0.25).length / lums.length;
  const midLum = lums.filter(l => l >= 0.25 && l <= 0.65).length / lums.length;
  const lightLum = lums.filter(l => l > 0.65).length / lums.length;

  const p10L = percentile(lums, 0.1);
  const p90L = percentile(lums, 0.9);
  const p10S = percentile(sats, 0.1);
  const p90S = percentile(sats, 0.9);

  return {
    avgH, avgS, avgL,
    stdH, stdS: stdSVal, stdL: stdLVal,
    minS: Math.min(...sats), maxS: Math.max(...sats),
    minL: Math.min(...lums), maxL: Math.max(...lums),
    satDistribution: { low: lowSat, mid: midSat, high: highSat },
    lumDistribution: { dark: darkLum, mid: midLum, light: lightLum },
    hueRange: stdH * 4, // rough range estimate
    dominantHue: avgH,
    hueConcentration: 1 - Math.min(1, stdH * 4),
    lumContrast: p90L - p10L,
    satContrast: p90S - p10S,
    frameConsistency: 0,
    loopError: 0,
  };
}

function diagnose(stats: ColorStats, frameStats: ColorStats[]): Diagnosis {
  const issues: string[] = [];
  const details: Record<string, number> = {};
  let score = 100;

  // ── 灰：对比不够，S/L 方差都小 ──
  // 饱和度平均低且方差小 → 灰
  const grayScore = (() => {
    // 真正的"灰"是饱和度低。均匀饱和度不等于灰。
    let penalty = 0;
    if (stats.avgS < 0.25) penalty += 25;
    else if (stats.avgS < 0.35) penalty += 15;
    else if (stats.avgS < 0.45) penalty += 5;
    // 饱和度方差极低 + 亮度方差也低 → 整体缺乏层次感
    if (stats.stdS < 0.05 && stats.stdL < 0.08) penalty += 10;
    return penalty;
  })();
  details['gray'] = grayScore;
  if (grayScore > 15) issues.push(`灰(${grayScore}): avgS=${stats.avgS.toFixed(3)}, stdS=${stats.stdS.toFixed(3)}, stdL=${stats.stdL.toFixed(3)}`);
  score -= grayScore;

  // ── 跳：对比过头 ──
  const jarringScore = (() => {
    let penalty = 0;
    // 色相分散过大
    if (stats.stdH > 0.2) penalty += 20;
    else if (stats.stdH > 0.15) penalty += 10;
    // 亮度或饱和度对比过大
    if (stats.lumContrast > 0.7) penalty += 10;
    if (stats.satContrast > 0.7) penalty += 10;
    // 极低方差（stdS≈0, stdL≈0 意味着大块纯色）也是一种"跳"——机械感
    if (stats.stdS < 0.01 && stats.stdL < 0.01) penalty += 15;
    return penalty;
  })();
  details['jarring'] = jarringScore;
  if (jarringScore > 10) issues.push(`跳(${jarringScore}): stdH=${stats.stdH.toFixed(3)}, lumContrast=${stats.lumContrast.toFixed(3)}, satContrast=${stats.satContrast.toFixed(3)}`);
  score -= jarringScore;

  // ── 闷：暗部死黑 ──
  const dullScore = (() => {
    // 大量暗像素且暗部饱和度低
    const darkPenalty = stats.lumDistribution.dark > 0.5 ? 20 : stats.lumDistribution.dark > 0.3 ? 10 : 0;
    const lowLumPenalty = stats.avgL < 0.2 ? 15 : stats.avgL < 0.3 ? 8 : 0;
    return darkPenalty + lowLumPenalty;
  })();
  details['dull'] = dullScore;
  if (dullScore > 10) issues.push(`闷(${dullScore}): dark%=${(stats.lumDistribution.dark * 100).toFixed(1)}%, avgL=${stats.avgL.toFixed(3)}`);
  score -= dullScore;

  // ── 脏：低饱和 + 中亮度 ──
  const muddyScore = (() => {
    // 大量 S < 0.3 且 L 在 0.25-0.5 的像素
    const lowSatMidLum = stats.satDistribution.low > 0.4 && stats.avgL > 0.25 && stats.avgL < 0.5 ? 20 : 0;
    const generalMuddy = stats.avgS < 0.3 && stats.stdL < 0.15 ? 10 : 0;
    return lowSatMidLum + generalMuddy;
  })();
  details['muddy'] = muddyScore;
  if (muddyScore > 10) issues.push(`脏(${muddyScore}): lowSat%=${(stats.satDistribution.low * 100).toFixed(1)}%, avgS=${stats.avgS.toFixed(3)}`);
  score -= muddyScore;

  // ── 粉：红/绿区域高L低S ──
  // (简化：整体检测高亮低饱和)
  const chalkyScore = (() => {
    const lightLowSat = stats.avgL > 0.6 && stats.avgS < 0.3 ? 15 : 0;
    return lightLowSat;
  })();
  details['chalky'] = chalkyScore;
  if (chalkyScore > 5) issues.push(`粉(${chalkyScore}): avgL=${stats.avgL.toFixed(3)}, avgS=${stats.avgS.toFixed(3)}`);
  score -= chalkyScore;

  // ── 生/单：色彩关系不丰富 ──
  const flatScore = (() => {
    // 色相太集中（几乎单色），且没有足够的明度变化来补偿
    if (stats.stdH < 0.03 && stats.stdL < 0.15) return 10;
    return 0;
  })();
  details['flat'] = flatScore;
  if (flatScore > 5) issues.push(`单(${flatScore}): stdH=${stats.stdH.toFixed(3)}, stdL=${stats.stdL.toFixed(3)}`);
  score -= flatScore;

  // ── 帧间一致性 / 循环 ──
  if (stats.loopError > 5) {
    const loopPenalty = Math.min(15, Math.round(stats.loopError / 2));
    details['loop'] = loopPenalty;
    issues.push(`循环断裂(${loopPenalty}): loopError=${stats.loopError.toFixed(1)}`);
    score -= loopPenalty;
  }

  return { score: Math.max(0, score), issues, details };
}

async function main() {
  const svgBuf = fs.readFileSync('icon.svg');
  const W = 256, H = 256, FRAMES = 60;

  const geo = buildGeometry(SVG_PATH, [0, 0, 275.91, 300], { tx: -12.05, ty: 0 }, W, H);
  const { data } = await sharp(svgBuf)
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const extMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) extMask[i] = data[i * 4 + 3]! > 10 ? 1 : 0;
  applyMask(geo, extMask);

  // 用户标注的参考 hash
  const labeled: [string, string][] = [
    ['0b9993', '太灰'],
    ['128711', '太跳'],
    ['128712', '太闷'],
    ['128713', '太跳'],
    ['12871c', '太跳'],
    ['128720', '较好(首尾帧?)'],
    ['128723', '太跳'],
    ['128726', '非常好'],
  ];

  // 额外随机采样
  const extraHashes: string[] = [];
  for (let i = 0; i < 50; i++) {
    extraHashes.push((i * 7919 + 500).toString(16).padStart(6, '0'));
  }

  const allHashes = [...labeled.map(l => l[0]), ...extraHashes];
  const results: { sha: string; label: string; diagnosis: Diagnosis; stats: ColorStats; desc: string }[] = [];

  for (const sha of allHashes) {
    const label = labeled.find(l => l[0] === sha)?.[1] || '';
    const rng = createRNG(sha);
    const pipeline = buildPipeline(rng);
    const feedback: Record<string, ScalarField> = {};

    const frameStatsList: ColorStats[] = [];
    let firstFrame: Uint8ClampedArray | null = null;
    let lastFrame: Uint8ClampedArray | null = null;

    // 采样若干帧
    const sampleFrames = [0, Math.floor(FRAMES / 4), Math.floor(FRAMES / 2), Math.floor(FRAMES * 3 / 4), FRAMES - 1];
    for (const fi of sampleFrames) {
      const pixels = pipeline.execute({ geo, t: fi / FRAMES, feedback, transparent: true });
      const frameStat = analyzeFrame(pixels, geo.insideMask, W, H);
      frameStatsList.push(frameStat);
      if (fi === 0) firstFrame = new Uint8ClampedArray(pixels);
      if (fi === FRAMES - 1) lastFrame = new Uint8ClampedArray(pixels);
    }

    // 聚合帧统计
    const aggStats = { ...frameStatsList[Math.floor(frameStatsList.length / 2)]! };

    // 计算循环误差
    if (firstFrame && lastFrame) {
      let totalDiff = 0;
      let count = 0;
      for (let i = 0; i < W * H; i++) {
        if (!geo.insideMask[i]) continue;
        const dr = Math.abs(firstFrame[i * 4]! - lastFrame[i * 4]!);
        const dg = Math.abs(firstFrame[i * 4 + 1]! - lastFrame[i * 4 + 1]!);
        const db = Math.abs(firstFrame[i * 4 + 2]! - lastFrame[i * 4 + 2]!);
        totalDiff += (dr + dg + db) / 3;
        count++;
      }
      aggStats.loopError = count > 0 ? totalDiff / count : 0;
    }

    const diag = diagnose(aggStats, frameStatsList);
    results.push({
      sha,
      label,
      diagnosis: diag,
      stats: aggStats,
      desc: pipeline.desc.icon.join(' → '),
    });
  }

  // 打印标注样本的详细报告
  console.log('\n═══ 用户标注样本分析 ═══\n');
  for (const r of results.filter(r => r.label)) {
    const s = r.stats;
    console.log(`[${r.sha}] ${r.label} → 得分: ${r.diagnosis.score}`);
    console.log(`  管线: ${r.desc}`);
    console.log(`  HSL均值: H=${s.avgH.toFixed(3)} S=${s.avgS.toFixed(3)} L=${s.avgL.toFixed(3)}`);
    console.log(`  HSL标差: H=${s.stdH.toFixed(3)} S=${s.stdS.toFixed(3)} L=${s.stdL.toFixed(3)}`);
    console.log(`  饱和度分布: low=${(s.satDistribution.low * 100).toFixed(0)}% mid=${(s.satDistribution.mid * 100).toFixed(0)}% high=${(s.satDistribution.high * 100).toFixed(0)}%`);
    console.log(`  亮度分布: dark=${(s.lumDistribution.dark * 100).toFixed(0)}% mid=${(s.lumDistribution.mid * 100).toFixed(0)}% light=${(s.lumDistribution.light * 100).toFixed(0)}%`);
    console.log(`  对比: lumContrast=${s.lumContrast.toFixed(3)} satContrast=${s.satContrast.toFixed(3)}`);
    console.log(`  循环误差: ${s.loopError.toFixed(2)}`);
    if (r.diagnosis.issues.length) {
      console.log(`  问题: ${r.diagnosis.issues.join('; ')}`);
    }
    console.log();
  }

  // 统计整体分布
  console.log('\n═══ 全量采样分布 (50 random + 8 labeled) ═══\n');
  const scores = results.map(r => r.diagnosis.score);
  const excellent = scores.filter(s => s >= 80).length;
  const good = scores.filter(s => s >= 60 && s < 80).length;
  const mediocre = scores.filter(s => s >= 40 && s < 60).length;
  const poor = scores.filter(s => s < 40).length;
  console.log(`  优秀(≥80): ${excellent}/${results.length} (${(excellent / results.length * 100).toFixed(0)}%)`);
  console.log(`  良好(60-79): ${good}/${results.length} (${(good / results.length * 100).toFixed(0)}%)`);
  console.log(`  一般(40-59): ${mediocre}/${results.length} (${(mediocre / results.length * 100).toFixed(0)}%)`);
  console.log(`  差(<40): ${poor}/${results.length} (${(poor / results.length * 100).toFixed(0)}%)`);

  // 各问题出现频率
  const issueCounts: Record<string, number> = {};
  for (const r of results) {
    for (const [key, val] of Object.entries(r.diagnosis.details)) {
      if (val > 5) {
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      }
    }
  }
  console.log('\n  各问题出现频率:');
  for (const [key, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key}: ${count}/${results.length} (${(count / results.length * 100).toFixed(0)}%)`);
  }

  // 整体 HSL 分布统计
  const allAvgS = results.map(r => r.stats.avgS);
  const allAvgL = results.map(r => r.stats.avgL);
  const allStdH = results.map(r => r.stats.stdH);
  console.log(`\n  饱和度均值: min=${Math.min(...allAvgS).toFixed(3)} avg=${mean(allAvgS).toFixed(3)} max=${Math.max(...allAvgS).toFixed(3)}`);
  console.log(`  亮度均值: min=${Math.min(...allAvgL).toFixed(3)} avg=${mean(allAvgL).toFixed(3)} max=${Math.max(...allAvgL).toFixed(3)}`);
  console.log(`  色相标差: min=${Math.min(...allStdH).toFixed(3)} avg=${mean(allStdH).toFixed(3)} max=${Math.max(...allStdH).toFixed(3)}`);

  // 显示得分最低的 5 个
  console.log('\n═══ 最差 5 个 ═══\n');
  const worst = [...results].sort((a, b) => a.diagnosis.score - b.diagnosis.score).slice(0, 5);
  for (const r of worst) {
    console.log(`  [${r.sha}] score=${r.diagnosis.score} ${r.label || ''} → ${r.diagnosis.issues.join('; ')}`);
    console.log(`    管线: ${r.desc}`);
  }

  // 显示得分最高的 5 个
  console.log('\n═══ 最好 5 个 ═══\n');
  const best = [...results].sort((a, b) => b.diagnosis.score - a.diagnosis.score).slice(0, 5);
  for (const r of best) {
    console.log(`  [${r.sha}] score=${r.diagnosis.score} ${r.label || ''}`);
    console.log(`    管线: ${r.desc}`);
    console.log(`    HSL: S=${r.stats.avgS.toFixed(3)} L=${r.stats.avgL.toFixed(3)} stdH=${r.stats.stdH.toFixed(3)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

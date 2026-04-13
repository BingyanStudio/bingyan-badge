// 管线构建器：从组件注册表中随机抽取节点、随机接线
//
// Icon/BG 管线结构（每一步都由 RNG 决定是否包含、用什么组件）：
//
//   source_A ──┐
//              ├─ [blend] → [transform chain] → gradient → [subtle lighting] → [hsl-shift]
//   source_B ──┘
//
// 关键设计：
// - 可以有 1 或 2 个 source，2 个时用 combiner 混合
// - transform chain 可以有 0~3 步
// - lighting 只有 30% 概率，且强度降低，不再主导画面
// - 纹理生成器（domain-warp, plasma, kaleidoscope, fractal）占大头

import { registry } from './registry.js';
import { ScalarField, ColorField } from './fields.js';
import { hslToRgb, AnimMode } from './math.js';
import type { RNG, PipelineContext, NodeFn, Component } from './types.js';
import { ComponentType, RecipeSlot } from './types.js';
import type { GradientStop } from '../components/color/gradient.js';

export interface Pipeline {
  desc: PipelineDesc;
  execute(ctx: PipelineContext): Uint8ClampedArray;
}

export interface PipelineDesc {
  icon: string[];
  bg: string[];
  mask: string;
}

// ─── 工具函数 ───

function randomizeParams(comp: Component, rng: RNG): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(comp.params)) {
    switch (def.type) {
      case 'float': result[key] = rng.range(def.min ?? 0, def.max ?? 1); break;
      case 'int': result[key] = rng.randInt(def.min ?? 0, def.max ?? 10); break;
      case 'enum': result[key] = rng.pick(def.options ?? []); break;
    }
  }
  return result;
}

const LOOP_FREQ_KEYS = new Set(['freq', 'pulseFreq', 'rotateSpeed', 'scrollSpeed', 'speed', 'animate']);

function ensureLoopParams(params: Record<string, unknown>, rng: RNG): void {
  for (const key of LOOP_FREQ_KEYS) {
    if (typeof params[key] === 'number') {
      params[key] = Math.max(1, Math.round(params[key] as number));
    }
  }
  if (!('animMode' in params)) {
    const r = rng.random();
    if (r < 0.3) params['animMode'] = AnimMode.OSCILLATE;
    else if (r < 0.7) params['animMode'] = AnimMode.FORWARD;
    else params['animMode'] = AnimMode.TRIANGLE;
  }
}

function randomStops(rng: RNG, minL: number, maxL: number): GradientStop[] {
  const n = rng.randInt(3, 7);
  const baseH = rng.random();
  // 色相展幅：允许适度范围，但保持和谐（类比色/邻近色方案）
  const spread = rng.range(0.03, 0.15);
  const dir = rng.random() > 0.5 ? 1 : -1;
  const stops: GradientStop[] = [];

  // 饱和度策略：选定一个基准饱和度区间，内部微调
  // 避免所有 stop 独立随机导致"生"（颜色缺乏关系）
  const satBase = rng.range(0.45, 0.85);
  const satVar = rng.range(0.05, 0.15);

  for (let i = 0; i < n; i++) {
    // 饱和度围绕基准微调，保持整体色调统一
    const s = Math.max(0.2, Math.min(1, satBase + (rng.random() - 0.5) * 2 * satVar));
    stops.push({
      pos: i / (n - 1),
      h: ((baseH + dir * spread * (i / (n - 1))) % 1 + 1) % 1,
      s,
      l: rng.range(minL, maxL),
    });
  }
  return stops;
}

// 优质纹理源权重更高
const SOURCE_WEIGHTS: Record<string, number> = {
  'src:domain-warp': 5,
  'src:plasma': 5,
  'src:kaleidoscope': 4,
  'src:fractal': 4,
  'src:lissajous': 3,
  'src:wave-interference': 4,
  'src:particle-grid': 3,
  'src:op-art': 4,
  'src:brush-noise': 4,
  'src:reaction-diffusion': 4,
  'src:flow-field': 4,
  'src:truchet': 3,
  'src:cellular': 3,
  'src:moire': 4,
  'src:spiral': 3,
  'src:voronoi': 3,
  'src:noise': 3,
  'src:sdf': 1,
  'src:arc': 1,
  'src:radial': 1,
  'src:mask': 0, // 不作为主纹理源
  'src:time': 0, // 不作为主纹理源
};

function pickWeightedSource(rng: RNG): Component {
  const sources = registry.listByType(ComponentType.SOURCE);
  const weighted: { comp: Component; w: number }[] = [];
  for (const c of sources) {
    const w = SOURCE_WEIGHTS[c.id] ?? 1;
    if (w > 0) weighted.push({ comp: c, w });
  }
  const total = weighted.reduce((s, e) => s + e.w, 0);
  let r = rng.random() * total;
  for (const e of weighted) {
    r -= e.w;
    if (r <= 0) return e.comp;
  }
  return weighted[weighted.length - 1]!.comp;
}

const LIGHTING_WEIGHTS: Record<string, number> = {
  'lit:rim': 5,
  'lit:ao': 4,
  'lit:specular': 4,
  'lit:directional': 4,
  'lit:caustics': 4,
  'lit:emboss': 1,
};

function pickWeightedLighting(rng: RNG): Component {
  const comps = registry.listByType(ComponentType.LIGHTING);
  const weighted: { comp: Component; w: number }[] = [];
  for (const c of comps) {
    const w = LIGHTING_WEIGHTS[c.id] ?? 2;
    weighted.push({ comp: c, w });
  }
  const total = weighted.reduce((s, e) => s + e.w, 0);
  let r = rng.random() * total;
  for (const e of weighted) {
    r -= e.w;
    if (r <= 0) return e.comp;
  }
  return weighted[weighted.length - 1]!.comp;
}

function makeSourceFn(comp: Component, rng: RNG): NodeFn<any> {
  const params = randomizeParams(comp, rng);
  ensureLoopParams(params, rng);
  return comp.create(params);
}

function makeTransformFn(rng: RNG): { id: string; fn: NodeFn<any>; needsSecondInput: boolean } {
  const xfs = registry.listByType(ComponentType.TRANSFORM);
  const comp = rng.pick(xfs);
  const params = randomizeParams(comp, rng);
  ensureLoopParams(params, rng);
  if (comp.id === 'xf:feedback') params['key'] = 'fb_' + rng.randInt(0, 9);
  return { id: comp.id, fn: comp.create(params), needsSecondInput: comp.id === 'xf:warp' || comp.id === 'xf:displace' };
}

// ─── 管线组装 ───

type BuiltChain = {
  ids: string[];
  run: (ctx: PipelineContext) => ColorField;
};

function buildColorChain(rng: RNG, kind: 'icon' | 'bg'): BuiltChain {
  const ids: string[] = [];
  const isIcon = kind === 'icon';

  // 1. Pick 1 or 2 sources
  const srcA = pickWeightedSource(rng);
  const srcAFn = makeSourceFn(srcA, rng);
  ids.push(srcA.id);

  let srcBFn: NodeFn<any> | null = null;
  let blendMode: string | null = null;
  if (rng.random() < (isIcon ? 0.4 : 0.25)) {
    const srcB = pickWeightedSource(rng);
    srcBFn = makeSourceFn(srcB, rng);
    blendMode = rng.pick(['add', 'mul', 'screen', 'overlay', 'max']);
    ids.push('+' + srcB.id, 'blend:' + blendMode);
  }

  // 2. Transform chain: 0~3 steps for icon, 0~1 for bg
  const maxXf = isIcon ? rng.randInt(0, 3) : rng.randInt(0, 1);
  const xfSteps: { id: string; fn: NodeFn<any>; needsSecondInput: boolean }[] = [];
  for (let i = 0; i < maxXf; i++) {
    const step = makeTransformFn(rng);
    xfSteps.push(step);
    ids.push(step.id);
  }

  // Prepare warp noise source if needed
  let warpNoiseFn: NodeFn<any> | null = null;
  if (xfSteps.some(s => s.needsSecondInput)) {
    warpNoiseFn = makeSourceFn(registry.get('src:noise')!, rng);
  }

  // 3. Color mapping: gradient (60%), duotone (20%), or palette (20%)
  let colorMapFn: NodeFn<any>;
  const colorMapRoll = rng.random();
  if (colorMapRoll < 0.6) {
    const gradStops = randomStops(rng, isIcon ? 0.35 : 0.08, isIcon ? 0.7 : 0.25);
    const gradComp = registry.get('col:gradient')!;
    colorMapFn = gradComp.create({ stops: gradStops });
    ids.push('col:gradient');
  } else if (colorMapRoll < 0.8) {
    const duoComp = registry.get('col:duotone');
    if (duoComp) {
      const duoParams = randomizeParams(duoComp, rng);
      colorMapFn = duoComp.create(duoParams);
      ids.push('col:duotone');
    } else {
      const gradStops = randomStops(rng, isIcon ? 0.35 : 0.08, isIcon ? 0.7 : 0.25);
      colorMapFn = registry.get('col:gradient')!.create({ stops: gradStops });
      ids.push('col:gradient');
    }
  } else {
    const palComp = registry.get('col:palette');
    if (palComp) {
      const palParams = randomizeParams(palComp, rng);
      colorMapFn = palComp.create(palParams);
      ids.push('col:palette');
    } else {
      const gradStops = randomStops(rng, isIcon ? 0.35 : 0.08, isIcon ? 0.7 : 0.25);
      colorMapFn = registry.get('col:gradient')!.create({ stops: gradStops });
      ids.push('col:gradient');
    }
  }

  // 4. Maybe subtle lighting (25% icon, 10% bg)
  let litFn: NodeFn<any> | null = null;
  let litIntensity = 0;
  if (rng.random() < (isIcon ? 0.25 : 0.1)) {
    const litComp = pickWeightedLighting(rng);
    const litParams = randomizeParams(litComp, rng);
    ensureLoopParams(litParams, rng);
    litFn = litComp.create(litParams);
    litIntensity = rng.range(0.1, 0.3);
    ids.push(litComp.id + '(subtle)');
  }

  // 5. Maybe hsl-shift (35%)
  let hslFn: NodeFn<any> | null = null;
  if (rng.random() < 0.35) {
    const hslComp = registry.get('col:hsl-shift')!;
    const hslParams = randomizeParams(hslComp, rng);
    ensureLoopParams(hslParams, rng);
    hslFn = hslComp.create(hslParams);
    ids.push('col:hsl-shift');
  }

  // 6. Color transforms: 可叠加多层（impasto, watercolor, chromatic, vignette）
  const colXfFns: NodeFn<any>[] = [];
  const colXfPool = registry.listByType(ComponentType.COLOR_TRANSFORM)
    .filter(c => c.id !== 'col:light-apply' && c.id !== 'col:hsl-shift')
    .filter(c => !(hslFn && c.id === 'col:chromatic'));  // hsl-shift + chromatic 叠加导致彩虹
  // 第一层 45% 概率
  if (rng.random() < 0.45 && colXfPool.length > 0) {
    const comp = rng.pick(colXfPool);
    const params = randomizeParams(comp, rng);
    ensureLoopParams(params, rng);
    colXfFns.push(comp.create(params));
    ids.push(comp.id);
    // 第二层 25% 概率（不同类型），chromatic 不叠加
    const remaining = colXfPool.filter(c => c.id !== comp.id && c.id !== 'col:chromatic');
    if (comp.id !== 'col:chromatic' && rng.random() < 0.25 && remaining.length > 0) {
      const comp2 = rng.pick(remaining);
      const params2 = randomizeParams(comp2, rng);
      ensureLoopParams(params2, rng);
      colXfFns.push(comp2.create(params2));
      ids.push(comp2.id);
    }
  }

  return {
    ids,
    run(ctx: PipelineContext): ColorField {
      // Sources
      let field = srcAFn(ctx) as ScalarField;
      if (srcBFn && blendMode) {
        const fieldB = srcBFn(ctx) as ScalarField;
        const blended = new ScalarField(field.width, field.height);
        for (let i = 0; i < field.data.length; i++) {
          const a = field.data[i]!, b = fieldB.data[i]!;
          switch (blendMode) {
            case 'add': blended.data[i] = Math.min(1, a + b); break;
            case 'mul': blended.data[i] = a * b; break;
            case 'screen': blended.data[i] = 1 - (1 - a) * (1 - b); break;
            case 'overlay': blended.data[i] = a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b); break;
            case 'max': blended.data[i] = Math.max(a, b); break;
            default: blended.data[i] = (a + b) / 2;
          }
        }
        field = blended;
      }

      // Transforms
      for (const step of xfSteps) {
        if (step.needsSecondInput && warpNoiseFn) {
          const noise = warpNoiseFn(ctx) as ScalarField;
          field = step.fn(ctx, field, noise) as ScalarField;
        } else {
          field = step.fn(ctx, field) as ScalarField;
        }
      }

      // Gradient
      let color = colorMapFn(ctx, field) as ColorField;

      // Subtle lighting
      if (litFn) {
        const litField = litFn(ctx) as ScalarField;
        const c = new ColorField(color.width, color.height);
        for (let i = 0; i < color.r.length; i++) {
          const l = litField.data[i]!;
          // 只用 litIntensity 比例做调制，其余保持原色
          const mix = litIntensity;
          const lit = l * mix + (1 - mix);
          c.r[i] = color.r[i]! * lit;
          c.g[i] = color.g[i]! * lit;
          c.b[i] = color.b[i]! * lit;
        }
        color = c;
      }

      // HSL shift
      if (hslFn) {
        color = hslFn(ctx, color) as ColorField;
      }

      // Color transforms (impasto, watercolor, chromatic, vignette)
      for (const fn of colXfFns) {
        color = fn(ctx, color) as ColorField;
      }

      return color;
    },
  };
}

// ─── Mask ───

function buildMask(rng: RNG): { id: string; fn: NodeFn<ScalarField> } {
  const recipes = registry.listRecipesBySlot(RecipeSlot.MASK);
  if (recipes.length) {
    const r = rng.pick(recipes);
    return { id: r.id, fn: r.build(rng.fork(), registry) as NodeFn<ScalarField> };
  }
  return {
    id: 'mask:sharp',
    fn: (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      for (let i = 0; i < f.data.length; i++) f.data[i] = ctx.geo.insideMask[i]!;
      return f;
    },
  };
}

// ─── 亮度校准 ───

const MIN_ICON_LUM = 46;
const MIN_BG_LUM = 10;

// ─── 主入口 ───

export function buildPipeline(rng: RNG): Pipeline {
  const iconChain = buildColorChain(rng.fork(), 'icon');
  const bgChain = buildColorChain(rng.fork(), 'bg');
  const maskInfo = buildMask(rng.fork());
  const composeFn = registry.get('col:compose')!.create({});

  const [fbR, fbG, fbB] = hslToRgb(rng.random(), rng.range(0.5, 1), rng.range(0.4, 0.6));

  let iconBoost = 1;
  let iconAdd = 0;
  let bgBoost = 1;
  let calibrated = false;

  return {
    desc: { icon: iconChain.ids, bg: bgChain.ids, mask: maskInfo.id },
    execute(ctx: PipelineContext): Uint8ClampedArray {
      const iconColor = iconChain.run(ctx);
      const bgColor = bgChain.run(ctx);
      const mask = maskInfo.fn(ctx);
      const pixels = composeFn(ctx, iconColor, bgColor, mask) as Uint8ClampedArray;

      if (!calibrated) {
        const { insideMask } = ctx.geo;
        let iconSum = 0, iconN = 0, bgSum = 0, bgN = 0;
        for (let i = 0; i < ctx.geo.width * ctx.geo.height; i++) {
          const lum = pixels[i * 4]! * 0.299 + pixels[i * 4 + 1]! * 0.587 + pixels[i * 4 + 2]! * 0.114;
          if (insideMask[i]) { iconSum += lum; iconN++; }
          else { bgSum += lum; bgN++; }
        }
        const iconAvg = iconN > 0 ? iconSum / iconN : 0;
        const bgAvg = bgN > 0 ? bgSum / bgN : 0;
        if (iconAvg < MIN_ICON_LUM) {
          iconBoost = iconAvg > 2 ? Math.min(MIN_ICON_LUM / iconAvg, 5) : 1;
          if (iconAvg <= 2) iconAdd = MIN_ICON_LUM;
        }
        if (!ctx.transparent && bgAvg < MIN_BG_LUM && bgAvg > 1) {
          bgBoost = Math.min(MIN_BG_LUM / bgAvg, 4);
        }
        calibrated = true;
      }

      if (iconBoost > 1 || iconAdd > 0 || bgBoost > 1) {
        const { insideMask } = ctx.geo;
        for (let i = 0; i < ctx.geo.width * ctx.geo.height; i++) {
          const idx = i * 4;
          if (insideMask[i]) {
            if (iconAdd > 0) {
              const origLum = pixels[idx]! * 0.299 + pixels[idx + 1]! * 0.587 + pixels[idx + 2]! * 0.114;
              const mix = Math.max(0, 1 - origLum / MIN_ICON_LUM);
              pixels[idx] = Math.min(255, pixels[idx]! + fbR * 255 * mix * 0.7);
              pixels[idx + 1] = Math.min(255, pixels[idx + 1]! + fbG * 255 * mix * 0.7);
              pixels[idx + 2] = Math.min(255, pixels[idx + 2]! + fbB * 255 * mix * 0.7);
            } else if (iconBoost > 1) {
              pixels[idx] = Math.min(255, pixels[idx]! * iconBoost);
              pixels[idx + 1] = Math.min(255, pixels[idx + 1]! * iconBoost);
              pixels[idx + 2] = Math.min(255, pixels[idx + 2]! * iconBoost);
            }
          } else if (bgBoost > 1) {
            pixels[idx] = Math.min(255, pixels[idx]! * bgBoost);
            pixels[idx + 1] = Math.min(255, pixels[idx + 1]! * bgBoost);
            pixels[idx + 2] = Math.min(255, pixels[idx + 2]! * bgBoost);
          }
        }
      }

      return pixels;
    },
  };
}

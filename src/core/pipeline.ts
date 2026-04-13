// 管线构建器：从组件注册表中随机抽取节点，随机连接，生成效果
//
// 不再使用模板 recipe，而是按以下规则动态组装：
//
// Icon 管线：
//   1. 抽一个 SOURCE 作为基底纹理（sdf / arc / noise / voronoi / fractal / kaleidoscope）
//   2. 可能叠加一个 TRANSFORM（warp / quantize / edge / feedback）
//   3. 用 COLOR gradient 映射为颜色
//   4. 可能叠加一个 LIGHTING 做光照调制（emboss / specular / rim / ao）
//   5. 可能做一个 COLOR_TRANSFORM 色彩后处理（hsl-shift）
//
// BG 管线：同样的结构，但用不同的参数范围（偏暗）
//
// Mask 管线：保留简单的 4 选 1
//
// "可能" = 由 RNG 决定是否添加该步骤

import { registry } from './registry.js';
import { ScalarField, ColorField } from './fields.js';
import { hslToRgb } from './math.js';
import type { RNG, PipelineContext, NodeFn, Component } from './types.js';
import { ComponentType, RecipeSlot } from './types.js';
import type { GradientStop } from '../components/color/gradient.js';

export interface Pipeline {
  desc: PipelineDesc;
  execute(ctx: PipelineContext): Uint8ClampedArray;
}

export interface PipelineDesc {
  icon: string[];   // 用到的组件 id 列表
  bg: string[];
  mask: string;
}

// ─── 参数随机化 ───

function randomizeParams(comp: Component, rng: RNG): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(comp.params)) {
    switch (def.type) {
      case 'float':
        result[key] = rng.range(def.min ?? 0, def.max ?? 1);
        break;
      case 'int':
        result[key] = rng.randInt(def.min ?? 0, def.max ?? 10);
        break;
      case 'enum':
        result[key] = rng.pick(def.options ?? []);
        break;
      case 'stops':
        // 由调用方单独处理
        break;
    }
  }
  return result;
}

function randomStops(rng: RNG, minL: number, maxL: number): GradientStop[] {
  const n = rng.randInt(3, 7);
  const baseH = rng.random();
  const hueSpread = rng.range(0.08, 0.5);
  const dir = rng.random() > 0.5 ? 1 : -1;
  const stops: GradientStop[] = [];
  for (let i = 0; i < n; i++) {
    stops.push({
      pos: i / (n - 1),
      h: ((baseH + dir * hueSpread * (i / (n - 1))) % 1 + 1) % 1,
      s: rng.range(0.55, 1),
      l: rng.range(minL, maxL),
    });
  }
  return stops;
}

// ─── 动态管线组装 ───

// 需要循环保证的频率参数名
const LOOP_FREQ_KEYS = new Set(['freq', 'pulseFreq', 'rotateSpeed', 'scrollSpeed']);

function ensureLoopParams(params: Record<string, unknown>): void {
  for (const key of LOOP_FREQ_KEYS) {
    if (typeof params[key] === 'number') {
      params[key] = Math.max(1, Math.round(params[key] as number));
    }
  }
}

/** 从注册表中随机选一个指定类型的组件，随机化参数，返回 NodeFn */
function pickComponent(type: ComponentType, rng: RNG, overrides?: Record<string, unknown>): { id: string; fn: NodeFn<any> } {
  const comps = registry.listByType(type);
  if (!comps.length) throw new Error(`No components of type ${type}`);
  const comp = rng.pick(comps);
  const params = { ...randomizeParams(comp, rng), ...overrides };
  ensureLoopParams(params);

  // gradient 需要 stops 参数
  if (params['stops'] === undefined && comp.id === 'col:gradient') {
    params['stops'] = randomStops(rng, 0.35, 0.7);
  }

  return { id: comp.id, fn: comp.create(params) };
}

/** 指定 id 的组件 */
function useComponent(id: string, rng: RNG, overrides?: Record<string, unknown>): NodeFn<any> {
  const comp = registry.get(id);
  if (!comp) throw new Error(`Component ${id} not found`);
  const params = { ...randomizeParams(comp, rng), ...overrides };
  ensureLoopParams(params);
  if (params['stops'] === undefined && id === 'col:gradient') {
    params['stops'] = randomStops(rng, 0.35, 0.7);
  }
  return comp.create(params);
}

type BuiltChain = {
  ids: string[];
  run: (ctx: PipelineContext) => ColorField;
};

function buildColorChain(rng: RNG, kind: 'icon' | 'bg'): BuiltChain {
  const ids: string[] = [];
  const isIcon = kind === 'icon';

  // 1. Source
  const src = pickComponent(ComponentType.SOURCE, rng);
  ids.push(src.id);

  // 2. Maybe transform (50% chance, 30% for bg)
  let xfFn: NodeFn<any> | null = null;
  let xfId: string | null = null;
  if (rng.random() < (isIcon ? 0.5 : 0.3)) {
    // 排除 feedback 在背景上（不需要帧间状态）
    const xfComps = registry.listByType(ComponentType.TRANSFORM)
      .filter(c => isIcon || c.id !== 'xf:feedback');
    if (xfComps.length) {
      const xfComp = rng.pick(xfComps);
      const xfParams = randomizeParams(xfComp, rng);
      ensureLoopParams(xfParams);
      if (xfComp.id === 'xf:feedback') {
        xfParams['key'] = 'fb_' + kind;
      }
      xfFn = xfComp.create(xfParams);
      xfId = xfComp.id;
      ids.push(xfId);
    }
  }

  // warp 需要第二个输入（噪声），准备一个
  let warpNoiseFn: NodeFn<any> | null = null;
  if (xfId === 'xf:warp') {
    warpNoiseFn = useComponent('src:noise', rng);
    ids.push('src:noise(warp)');
  }

  // 3. Gradient color mapping
  const gradStops = randomStops(rng, isIcon ? 0.35 : 0.03, isIcon ? 0.72 : 0.15);
  const gradFn = useComponent('col:gradient', rng, { stops: gradStops });
  ids.push('col:gradient');

  // 4. Maybe lighting (60% for icon, 25% for bg)
  let litFn: NodeFn<any> | null = null;
  if (rng.random() < (isIcon ? 0.6 : 0.25)) {
    const lit = pickComponent(ComponentType.LIGHTING, rng);
    litFn = lit.fn;
    ids.push(lit.id);
  }

  // 5. Maybe hsl-shift (30% chance)
  let hslFn: NodeFn<any> | null = null;
  if (rng.random() < 0.3) {
    hslFn = useComponent('col:hsl-shift', rng);
    ids.push('col:hsl-shift');
  }

  // 6. Maybe specular on top (40% for icon, skip for bg)
  let specFn: NodeFn<any> | null = null;
  let specIntensity = 0;
  if (isIcon && rng.random() < 0.4) {
    specFn = useComponent('lit:specular', rng);
    specIntensity = rng.range(0.2, 0.6);
    ids.push('lit:specular(top)');
  }

  return {
    ids,
    run(ctx: PipelineContext): ColorField {
      // source
      let field = src.fn(ctx) as ScalarField;

      // transform
      if (xfFn) {
        if (xfId === 'xf:warp' && warpNoiseFn) {
          const noise = warpNoiseFn(ctx) as ScalarField;
          field = xfFn(ctx, field, noise) as ScalarField;
        } else {
          field = xfFn(ctx, field) as ScalarField;
        }
      }

      // gradient
      let color = gradFn(ctx, field) as ColorField;

      // lighting (multiplicative)
      if (litFn) {
        const litField = litFn(ctx) as ScalarField;
        const c = new ColorField(color.width, color.height);
        for (let i = 0; i < color.r.length; i++) {
          const l = litField.data[i]!;
          c.r[i] = color.r[i]! * (l * 0.7 + 0.3);
          c.g[i] = color.g[i]! * (l * 0.7 + 0.3);
          c.b[i] = color.b[i]! * (l * 0.7 + 0.3);
        }
        color = c;
      }

      // hsl shift
      if (hslFn) {
        color = hslFn(ctx, color) as ColorField;
      }

      // specular (additive highlight)
      if (specFn) {
        const specField = specFn(ctx) as ScalarField;
        for (let i = 0; i < color.r.length; i++) {
          const s = specField.data[i]! * specIntensity;
          color.r[i] = Math.min(1, color.r[i]! + s);
          color.g[i] = Math.min(1, color.g[i]! + s);
          color.b[i] = Math.min(1, color.b[i]! + s);
        }
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
  // fallback: sharp mask
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

  // fallback 色用于亮度太低时的加法填充
  const [fbR, fbG, fbB] = hslToRgb(rng.random(), rng.range(0.5, 1), rng.range(0.4, 0.6));

  let iconBoost = 1;
  let iconAdd = 0;
  let bgBoost = 1;
  let calibrated = false;

  return {
    desc: {
      icon: iconChain.ids,
      bg: bgChain.ids,
      mask: maskInfo.id,
    },
    execute(ctx: PipelineContext): Uint8ClampedArray {
      const iconColor = iconChain.run(ctx);
      const bgColor = bgChain.run(ctx);
      const mask = maskInfo.fn(ctx);
      const pixels = composeFn(ctx, iconColor, bgColor, mask) as Uint8ClampedArray;

      // 首帧亮度校准
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
        if (bgAvg < MIN_BG_LUM && bgAvg > 1) {
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

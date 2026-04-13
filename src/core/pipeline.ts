import { registry } from './registry.js';
import { ScalarField, ColorField } from './fields.js';
import type { RNG, PipelineContext, NodeFn } from './types.js';
import { RecipeSlot } from './types.js';
import { hslToRgb } from './math.js';

export interface Pipeline {
  patterns: { icon: string; bg: string; mask: string };
  execute(ctx: PipelineContext): Uint8ClampedArray;
}

// 最低亮度阈值 (0-255 scale)
const MIN_ICON_LUM = 46;
const MIN_BG_LUM = 10;

export function buildPipeline(rng: RNG): Pipeline {
  const iconRecipes = registry.listRecipesBySlot(RecipeSlot.ICON);
  const bgRecipes = registry.listRecipesBySlot(RecipeSlot.BG);
  const maskRecipes = registry.listRecipesBySlot(RecipeSlot.MASK);

  if (!iconRecipes.length || !bgRecipes.length || !maskRecipes.length) {
    throw new Error(`Registry missing recipes`);
  }

  const iconRecipe = rng.pick(iconRecipes);
  const bgRecipe = rng.pick(bgRecipes);
  const maskRecipe = rng.pick(maskRecipes);

  const iconFn = iconRecipe.build(rng.fork(), registry) as NodeFn<ColorField>;
  const bgFn = bgRecipe.build(rng.fork(), registry) as NodeFn<ColorField>;
  const maskFn = maskRecipe.build(rng.fork(), registry) as NodeFn<ScalarField>;
  const composeFn = registry.get('col:compose')!.create({});

  // 为无法自发产生足够亮度的 icon 准备一个备选填充色
  const fallbackH = rng.random();
  const [fbR, fbG, fbB] = hslToRgb(fallbackH, rng.range(0.5, 1), rng.range(0.4, 0.6));

  let iconBoost = 1;
  let iconAdd = 0;   // additive fallback (0-255)
  let bgBoost = 1;
  let calibrated = false;

  return {
    patterns: { icon: iconRecipe.id, bg: bgRecipe.id, mask: maskRecipe.id },
    execute(ctx: PipelineContext): Uint8ClampedArray {
      const iconColor = iconFn(ctx);
      const bgColor = bgFn(ctx);
      const mask = maskFn(ctx);
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
          if (iconAvg > 2) {
            // 有一点亮度但不够：乘法提升
            iconBoost = Math.min(MIN_ICON_LUM / iconAvg, 5);
          } else {
            // 基本全黑：用加法填充 fallback 色
            iconAdd = MIN_ICON_LUM;
          }
        }
        if (bgAvg < MIN_BG_LUM) {
          bgBoost = bgAvg > 1 ? Math.min(MIN_BG_LUM / bgAvg, 4) : 1;
        }
        calibrated = true;
      }

      if (iconBoost > 1 || iconAdd > 0 || bgBoost > 1) {
        const { insideMask } = ctx.geo;
        for (let i = 0; i < ctx.geo.width * ctx.geo.height; i++) {
          const idx = i * 4;
          if (insideMask[i]) {
            if (iconAdd > 0) {
              // 加法混入 fallback 色，保留原始颜色如果有的话
              const origLum = pixels[idx]! * 0.299 + pixels[idx + 1]! * 0.587 + pixels[idx + 2]! * 0.114;
              const mix = Math.max(0, 1 - origLum / MIN_ICON_LUM); // 原色越亮，混入越少
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

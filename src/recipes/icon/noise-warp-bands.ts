import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'icon:noise-warp-bands',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const sdf = registry.get('src:sdf')!.create({ normalize: rng.range(20, 40) });
    const noise = registry.get('src:noise')!.create({ scale: rng.range(2, 6), octaves: rng.randInt(3, 5), seed: rng.randInt(0, 9999), scrollX: rng.range(1, 4), scrollY: rng.range(-1, 1) });
    const warp = registry.get('xf:warp')!.create({ strength: rng.range(8, 25) });
    const quantize = registry.get('xf:quantize')!.create({ levels: rng.randInt(3, 8) });
    const baseH = rng.random();
    const count = rng.randInt(3, 5);
    const stops: GradientStop[] = Array.from({ length: count }, (_, i) => ({
      pos: i / (count - 1 || 1), h: (baseH + i * rng.range(0.05, 0.15)) % 1,
      s: rng.range(0.6, 1), l: rng.range(0.3, 0.65),
    }));
    stops.forEach((s, i) => { s.pos = i / (stops.length - 1); });
    const grad = registry.get('col:gradient')!.create({ stops });
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), rotateSpeed: rng.randInt(1, 3), depth: rng.range(1, 2) });

    return (ctx: PipelineContext) => {
      const sdfF = sdf(ctx) as ScalarField;
      const noiseF = noise(ctx) as ScalarField;
      const warped = warp(ctx, sdfF, noiseF) as ScalarField;
      const quantized = quantize(ctx, warped) as ScalarField;
      const color = grad(ctx, quantized) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.8 + 0.2;
        color.r[i]! *= l; color.g[i]! *= l; color.b[i]! *= l;
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

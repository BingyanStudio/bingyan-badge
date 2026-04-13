import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'icon:fractal-depth',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const fractal = registry.get('src:fractal')!.create({
      layers: rng.randInt(3, 6),
      decay: rng.range(0.4, 0.7),
      freqMul: rng.range(1.8, 2.5),
      distortion: rng.range(3, 12),
      seed: rng.randInt(0, 9999),
      scrollSpeed: rng.range(0.5, 2),
    });
    const emboss = registry.get('lit:emboss')!.create({
      angle: rng.range(0, 6.28), elev: rng.range(0.3, 0.7),
      rotateSpeed: rng.randInt(1, 3), depth: rng.range(0.8, 2),
    });
    const spec = registry.get('lit:specular')!.create({
      angle: rng.range(0, 6.28), power: rng.range(12, 32),
      rotateSpeed: rng.randInt(1, 3),
    });
    const baseH = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h: baseH, s: rng.range(0.6, 0.9), l: rng.range(0.15, 0.25) },
      { pos: 0.3, h: (baseH + rng.range(0.05, 0.15)) % 1, s: rng.range(0.7, 1), l: rng.range(0.4, 0.55) },
      { pos: 0.6, h: (baseH + rng.range(0.1, 0.3)) % 1, s: rng.range(0.6, 0.9), l: rng.range(0.5, 0.7) },
      { pos: 1, h: (baseH + rng.range(0.2, 0.5)) % 1, s: rng.range(0.5, 0.8), l: rng.range(0.6, 0.8) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const fracF = fractal(ctx) as ScalarField;
      const color = grad(ctx, fracF) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const specF = spec(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.7 + 0.3;
        const s = specF.data[i]! * 0.5;
        color.r[i] = Math.min(1, color.r[i]! * l + s);
        color.g[i] = Math.min(1, color.g[i]! * l + s);
        color.b[i] = Math.min(1, color.b[i]! * l + s);
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

// 分形背景：整个画面用低频分形纹理填充
import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:fractal',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const fractal = registry.get('src:fractal')!.create({
      layers: rng.randInt(2, 4),
      decay: rng.range(0.5, 0.7),
      freqMul: rng.range(1.8, 2.2),
      distortion: rng.range(1, 5),
      seed: rng.randInt(0, 9999),
      scrollSpeed: rng.range(0.3, 1),
    });
    const h = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.3, 0.6), l: rng.range(0.02, 0.06) },
      { pos: 0.5, h: (h + 0.08) % 1, s: rng.range(0.4, 0.7), l: rng.range(0.06, 0.14) },
      { pos: 1, h: (h + 0.15) % 1, s: rng.range(0.3, 0.5), l: rng.range(0.03, 0.08) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const ff = fractal(ctx) as ScalarField;
      return grad(ctx, ff) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

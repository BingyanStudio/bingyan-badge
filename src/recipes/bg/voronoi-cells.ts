import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:voronoi-cells',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const vor = registry.get('src:voronoi')!.create({ scale: rng.range(3, 8), seed: rng.randInt(0, 9999), mode: 'edge', scroll: rng.range(0.3, 1) });
    const h = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.3, 0.6), l: rng.range(0.03, 0.07) },
      { pos: 1, h: (h + 0.1) % 1, s: rng.range(0.4, 0.7), l: rng.range(0.1, 0.18) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const vf = vor(ctx) as ScalarField;
      return grad(ctx, vf) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

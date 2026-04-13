// 万花筒背景：整个画面用万花筒纹理填充
import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:kaleidoscope',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const kal = registry.get('src:kaleidoscope')!.create({
      segments: rng.randInt(4, 8),
      pattern: rng.pick(['noise', 'voronoi', 'spiral']),
      scale: rng.range(1.5, 4),
      seed: rng.randInt(0, 9999),
      rotateSpeed: rng.randInt(1, 3),
      zoom: rng.range(1, 2),
    });
    const h = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.3, 0.6), l: rng.range(0.03, 0.07) },
      { pos: 0.5, h: (h + 0.1) % 1, s: rng.range(0.4, 0.7), l: rng.range(0.08, 0.15) },
      { pos: 1, h: (h + 0.2) % 1, s: rng.range(0.3, 0.5), l: rng.range(0.04, 0.09) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const kf = kal(ctx) as ScalarField;
      return grad(ctx, kf) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

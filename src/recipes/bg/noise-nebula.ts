import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:noise-nebula',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const noise = registry.get('src:noise')!.create({ scale: rng.range(2, 5), octaves: rng.randInt(3, 5), seed: rng.randInt(0, 9999), scrollX: rng.range(0.5, 2), scrollY: rng.range(0.3, 1) });
    const h = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.2, 0.5), l: rng.range(0.02, 0.06) },
      { pos: 0.5, h: (h + 0.05) % 1, s: rng.range(0.3, 0.6), l: rng.range(0.06, 0.12) },
      { pos: 1, h: (h + 0.1) % 1, s: rng.range(0.2, 0.4), l: rng.range(0.03, 0.08) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const nf = noise(ctx) as ScalarField;
      return grad(ctx, nf) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

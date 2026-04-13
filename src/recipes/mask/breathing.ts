import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:breathing',
  slot: RecipeSlot.MASK,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const freq = rng.randInt(1, 3);
    const amplitude = rng.range(1, 4);
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const f = new ScalarField(w, h);
      const offset = Math.sin(ctx.t * Math.PI * 2 * freq) * amplitude;
      for (let i = 0; i < w * h; i++)
        f.data[i] = Math.max(0, Math.min(1, -(sdf[i]! + offset) / 3));
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

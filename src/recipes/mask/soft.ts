import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:soft',
  slot: RecipeSlot.MASK,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const softness = rng.range(2, 6);
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const f = new ScalarField(w, h);
      for (let i = 0; i < w * h; i++)
        f.data[i] = Math.max(0, Math.min(1, (-sdf[i]! + softness) / (2 * softness)));
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

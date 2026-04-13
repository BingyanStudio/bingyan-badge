import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:sharp',
  slot: RecipeSlot.MASK,
  build(_rng: RNG, _reg: ComponentRegistryReader) {
    return (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      for (let i = 0; i < f.data.length; i++) f.data[i] = ctx.geo.insideMask[i]!;
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

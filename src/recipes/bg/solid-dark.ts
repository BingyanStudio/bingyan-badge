import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { hslToRgb } from '../../core/math.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'bg:solid-dark',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const [r, g, b] = hslToRgb(rng.random(), rng.range(0.2, 0.5), rng.range(0.03, 0.1));
    return (ctx: PipelineContext) => {
      const c = new ColorField(ctx.geo.width, ctx.geo.height);
      c.r.fill(r); c.g.fill(g); c.b.fill(b);
      return c;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

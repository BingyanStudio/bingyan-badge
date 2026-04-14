// 波浪边缘遮罩：用 fbm 噪声调制 SDF 边界，产生有机的波动轮廓
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:wave',
  slot: RecipeSlot.MASK,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const noise = registry.get('src:noise')!.create({
      scale: rng.range(4, 10),
      octaves: 3,
      seed: rng.randInt(0, 9999),
      scrollX: rng.range(1, 3),
      scrollY: rng.range(0.5, 2),
    });
    const amplitude = rng.range(2, 6);
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const nf = noise(ctx) as ScalarField;
      const f = new ScalarField(w, h);
      for (let i = 0; i < w * h; i++) {
        const noiseOffset = (nf.data[i]! - 0.5) * amplitude * 2;
        f.data[i] = Math.max(0, Math.min(1, -(sdf[i]! + noiseOffset) / 3));
      }
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

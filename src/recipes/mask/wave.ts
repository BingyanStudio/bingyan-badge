// 波浪边缘遮罩：用正弦波调制 SDF 边界，产生波动的轮廓
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:wave',
  slot: RecipeSlot.MASK,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const waveFreq = rng.range(3, 8);
    const waveAmp = rng.range(1, 4);
    const speed = rng.randInt(1, 3);
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf, arcParam } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * speed;
      for (let i = 0; i < w * h; i++) {
        const waveOffset = Math.sin(arcParam[i]! * Math.PI * 2 * waveFreq + phase) * waveAmp;
        f.data[i] = Math.max(0, Math.min(1, -(sdf[i]! + waveOffset) / 3));
      }
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

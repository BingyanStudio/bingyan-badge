import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { voronoi, loopOffset2D, AnimMode } from '../../core/math.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';

const recipe: Recipe = {
  id: 'mask:noisy',
  slot: RecipeSlot.MASK,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const scale = rng.range(7, 14);
    const amplitude = rng.range(5, 12);
    const seed = rng.randInt(0, 9999);
    const speed = rng.range(0.3, 0.8);
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const f = new ScalarField(w, h);
      const [ox, oy] = loopOffset2D(ctx.t, AnimMode.OSCILLATE, speed, speed);
      for (let i = 0; i < w * h; i++) {
        const px = (i % w) / w * scale + ox;
        const py = Math.floor(i / w) / h * scale + oy;
        // voronoi dist 产生多边形碎片轮廓，边缘是直线段和尖角
        const { dist } = voronoi(px, py, seed);
        const noiseOffset = (dist - 0.4) * amplitude * 2;
        f.data[i] = Math.max(0, Math.min(1, -(sdf[i]! + noiseOffset) / 1.5));
      }
      return f;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

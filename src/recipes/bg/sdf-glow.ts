import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:sdf-glow',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const h = rng.random();
    const glowRange = rng.range(30, 80);
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.5, 0.8), l: rng.range(0.08, 0.15) },
      { pos: 1, h: (h + 0.05) % 1, s: rng.range(0.2, 0.4), l: rng.range(0.01, 0.04) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });
    const pulseFreq = rng.range(0.5, 2);
    const pulseAmp = rng.range(0.1, 0.3);

    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf, insideMask } = ctx.geo;
      const f = new ScalarField(w, h);
      const pulse = Math.sin(ctx.t * Math.PI * 2 * pulseFreq) * pulseAmp;
      for (let i = 0; i < w * h; i++) {
        if (insideMask[i]) { f.data[i] = 0; continue; }
        f.data[i] = Math.max(0, 1 - sdf[i]! / (glowRange * (1 + pulse)));
      }
      return grad(ctx, f) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

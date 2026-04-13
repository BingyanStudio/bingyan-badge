import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'icon:kaleidoscope-fill',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const kal = registry.get('src:kaleidoscope')!.create({
      segments: rng.randInt(4, 10),
      pattern: rng.pick(['noise', 'voronoi', 'rings', 'spiral']),
      scale: rng.range(2, 6),
      seed: rng.randInt(0, 9999),
      rotateSpeed: rng.randInt(1, 3),
      zoom: rng.range(0.8, 2),
    });
    const emboss = registry.get('lit:emboss')!.create({
      angle: rng.range(0, 6.28), elev: rng.range(0.4, 0.8),
      rotateSpeed: rng.randInt(1, 3), depth: rng.range(0.8, 1.8),
    });
    const rim = registry.get('lit:rim')!.create({
      edgeWidth: rng.range(4, 10), softness: rng.range(1, 2.5),
      pulse: rng.range(0.1, 0.5), pulseFreq: rng.randInt(1, 3),
    });
    const startH = rng.random();
    const stops: GradientStop[] = Array.from({ length: 6 }, (_, i) => ({
      pos: i / 5,
      h: (startH + i * rng.range(0.08, 0.18)) % 1,
      s: rng.range(0.65, 1), l: rng.range(0.35, 0.65),
    }));
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const kalF = kal(ctx) as ScalarField;
      const color = grad(ctx, kalF) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const rimF = rim(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.65 + 0.35;
        const rv = rimF.data[i]!;
        color.r[i] = Math.min(1, color.r[i]! * l + rv * 0.35);
        color.g[i] = Math.min(1, color.g[i]! * l + rv * 0.35);
        color.b[i] = Math.min(1, color.b[i]! * l + rv * 0.3);
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

function iridescent(rng: RNG): GradientStop[] {
  const n = rng.randInt(4, 7), start = rng.random(), stops: GradientStop[] = [];
  for (let i = 0; i < n; i++)
    stops.push({ pos: i / (n - 1), h: (start + i * rng.range(0.12, 0.25)) % 1, s: rng.range(0.7, 1), l: rng.range(0.4, 0.7) });
  return stops;
}

const recipe: Recipe = {
  id: 'icon:voronoi-crystal',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const vor = registry.get('src:voronoi')!.create({ scale: rng.range(4, 10), seed: rng.randInt(0, 9999), mode: rng.pick(['dist', 'edge']), scroll: rng.range(0.5, 3) });
    const maskSrc = registry.get('src:mask')!.create({});
    const grad = registry.get('col:gradient')!.create({ stops: iridescent(rng) });
    const rim = registry.get('lit:rim')!.create({ edgeWidth: rng.range(5, 15), softness: rng.range(1, 3), pulse: rng.range(0.2, 0.8), pulseFreq: rng.range(0.5, 2) });
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), rotateSpeed: rng.range(1, 3), depth: rng.range(0.5, 1.5) });

    return (ctx: PipelineContext) => {
      const vorF = vor(ctx) as ScalarField;
      const maskF = maskSrc(ctx) as ScalarField;
      const masked = vorF.clone();
      for (let i = 0; i < masked.data.length; i++) masked.data[i]! *= maskF.data[i]!;
      const color = grad(ctx, masked) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const rimF = rim(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.7 + 0.3;
        const rv = rimF.data[i]! * 0.4;
        color.r[i] = Math.min(1, color.r[i]! * l + rv);
        color.g[i] = Math.min(1, color.g[i]! * l + rv);
        color.b[i] = Math.min(1, color.b[i]! * l + rv * 0.9);
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

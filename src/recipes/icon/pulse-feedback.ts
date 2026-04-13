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
  id: 'icon:pulse-feedback',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const edge = registry.get('xf:edge')!.create({ inner: rng.range(2, 6), outer: rng.range(2, 6), softness: rng.range(0.5, 2) });
    const time = registry.get('src:time')!.create({ waveform: rng.pick(['sin', 'exp', 'tri']), freq: rng.randInt(1, 3), phase: 0 });
    const feedback = registry.get('xf:feedback')!.create({ decay: rng.range(0.7, 0.92), key: 'fb_a' });
    const sdf = registry.get('src:sdf')!.create({ normalize: rng.range(15, 30) });
    const grad = registry.get('col:gradient')!.create({ stops: iridescent(rng) });
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), rotateSpeed: rng.randInt(1, 3), depth: rng.range(0.8, 2) });

    return (ctx: PipelineContext) => {
      const edgeF = edge(ctx) as ScalarField;
      const timeF = time(ctx) as ScalarField;
      const pulsed = edgeF.clone();
      const tv = timeF.data[0]!;
      for (let i = 0; i < pulsed.data.length; i++) pulsed.data[i]! *= tv;
      const fed = feedback(ctx, pulsed) as ScalarField;
      const sdfF = sdf(ctx) as ScalarField;
      const combined = sdfF.clone();
      for (let i = 0; i < combined.data.length; i++)
        combined.data[i] = Math.max(0, Math.min(1, sdfF.data[i]! + fed.data[i]! * 0.5));
      const color = grad(ctx, combined) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.7 + 0.3;
        color.r[i]! *= l; color.g[i]! *= l; color.b[i]! *= l;
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

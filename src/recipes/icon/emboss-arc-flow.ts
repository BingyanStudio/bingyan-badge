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
  id: 'icon:emboss-arc-flow',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), elev: rng.range(0.3, 0.8), rotateSpeed: rng.randInt(1, 3), depth: rng.range(0.5, 2) });
    const ao = registry.get('lit:ao')!.create({ range: rng.range(10, 30), strength: rng.range(0.3, 0.7) });
    const arcSrc = registry.get('src:arc')!.create({});
    const timeSrc = registry.get('src:time')!.create({ waveform: 'saw', freq: rng.randInt(1, 3), phase: rng.random() });
    const grad = registry.get('col:gradient')!.create({ stops: iridescent(rng) });
    const lightApply = registry.get('col:light-apply')!.create({ mode: 'multiply' });
    const spec = registry.get('lit:specular')!.create({ angle: rng.range(0, 6.28), power: rng.range(8, 40), rotateSpeed: rng.randInt(1, 3) });

    return (ctx: PipelineContext) => {
      const arcF = arcSrc(ctx) as ScalarField;
      const timeF = timeSrc(ctx) as ScalarField;
      const animated = arcF.clone();
      for (let i = 0; i < animated.data.length; i++)
        animated.data[i] = ((animated.data[i]! + timeF.data[0]!) % 1 + 1) % 1;
      const color = grad(ctx, animated) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const aoF = ao(ctx) as ScalarField;
      const combined = embossF.clone();
      for (let i = 0; i < combined.data.length; i++)
        combined.data[i] = combined.data[i]! * aoF.data[i]!;
      const lit = lightApply(ctx, color, combined) as ColorField;
      const specF = spec(ctx) as ScalarField;
      for (let i = 0; i < lit.r.length; i++) {
        const s = specF.data[i]! * 0.6;
        lit.r[i] = Math.min(1, lit.r[i]! + s);
        lit.g[i] = Math.min(1, lit.g[i]! + s);
        lit.b[i] = Math.min(1, lit.b[i]! + s);
      }
      return lit;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

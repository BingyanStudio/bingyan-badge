import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'icon:sdf-texture',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const sdf = registry.get('src:sdf')!.create({ normalize: rng.range(15, 40) });
    const noise = registry.get('src:noise')!.create({ scale: rng.range(3, 8), octaves: rng.randInt(3, 5), seed: rng.randInt(0, 9999), scrollX: rng.range(-2, 2), scrollY: rng.range(-2, 2) });
    const baseH = rng.random();
    const count = rng.randInt(3, 6);
    const stops: GradientStop[] = Array.from({ length: count }, (_, i) => ({
      pos: i / (count - 1 || 1),
      h: (baseH + rng.range(-0.15, 0.15)) % 1,
      s: rng.range(0.5, 1), l: rng.range(0.3, 0.7),
    }));
    // ensure monotonic pos
    stops.forEach((s, i) => { s.pos = i / (stops.length - 1); });
    const grad = registry.get('col:gradient')!.create({ stops });
    const spec = registry.get('lit:specular')!.create({ angle: rng.range(0, 6.28), power: rng.range(10, 30), rotateSpeed: rng.randInt(1, 3) });
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), rotateSpeed: rng.randInt(1, 3), depth: rng.range(0.8, 2) });

    return (ctx: PipelineContext) => {
      const sdfF = sdf(ctx) as ScalarField;
      const noiseF = noise(ctx) as ScalarField;
      const warped = sdfF.clone();
      for (let i = 0; i < warped.data.length; i++)
        warped.data[i] = Math.max(0, Math.min(1, sdfF.data[i]! + (noiseF.data[i]! - 0.5) * 0.4));
      const color = grad(ctx, warped) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const specF = spec(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.8 + 0.2;
        color.r[i] = Math.min(1, color.r[i]! * l + specF.data[i]! * 0.5);
        color.g[i] = Math.min(1, color.g[i]! * l + specF.data[i]! * 0.5);
        color.b[i] = Math.min(1, color.b[i]! * l + specF.data[i]! * 0.5);
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

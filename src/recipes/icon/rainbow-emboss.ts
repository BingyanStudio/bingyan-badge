import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'icon:rainbow-emboss',
  slot: RecipeSlot.ICON,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const arc = registry.get('src:arc')!.create({});
    const sdf = registry.get('src:sdf')!.create({ normalize: rng.range(15, 35) });
    const time = registry.get('src:time')!.create({ waveform: 'saw', freq: rng.randInt(1, 3), phase: rng.random() });
    const startH = rng.random();
    const stops: GradientStop[] = Array.from({ length: 8 }, (_, i) => ({
      pos: i / 7, h: (startH + i / 7) % 1, s: rng.range(0.8, 1), l: rng.range(0.4, 0.65),
    }));
    const grad = registry.get('col:gradient')!.create({ stops });
    const emboss = registry.get('lit:emboss')!.create({ angle: rng.range(0, 6.28), elev: rng.range(0.4, 0.8), rotateSpeed: rng.randInt(1, 3), depth: rng.range(1, 2.5) });
    const spec = registry.get('lit:specular')!.create({ angle: rng.range(0, 6.28), power: rng.range(12, 30), rotateSpeed: rng.randInt(1, 3) });
    const mixAmt = rng.range(0.3, 0.7);

    return (ctx: PipelineContext) => {
      const arcF = arc(ctx) as ScalarField;
      const sdfF = sdf(ctx) as ScalarField;
      const timeF = time(ctx) as ScalarField;
      const mixed = arcF.clone();
      for (let i = 0; i < mixed.data.length; i++)
        mixed.data[i] = ((arcF.data[i]! * mixAmt + sdfF.data[i]! * (1 - mixAmt) + timeF.data[0]!) % 1 + 1) % 1;
      const color = grad(ctx, mixed) as ColorField;
      const embossF = emboss(ctx) as ScalarField;
      const specF = spec(ctx) as ScalarField;
      for (let i = 0; i < color.r.length; i++) {
        const l = embossF.data[i]! * 0.8 + 0.2;
        const s = specF.data[i]! * 0.7;
        color.r[i] = Math.min(1, color.r[i]! * l + s);
        color.g[i] = Math.min(1, color.g[i]! * l + s);
        color.b[i] = Math.min(1, color.b[i]! * l + s);
      }
      return color;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

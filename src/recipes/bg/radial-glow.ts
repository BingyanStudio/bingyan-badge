// 径向渐变背景：从中心向外的颜色过渡，比纯黑有视觉存在感
import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import type { RNG, Recipe, PipelineContext, ComponentRegistryReader } from '../../core/types.js';
import { RecipeSlot } from '../../core/types.js';
import type { GradientStop } from '../../components/color/gradient.js';

const recipe: Recipe = {
  id: 'bg:radial-glow',
  slot: RecipeSlot.BG,
  build(rng: RNG, _reg: ComponentRegistryReader) {
    const radial = registry.get('src:radial')!.create({});
    const h = rng.random();
    const stops: GradientStop[] = [
      { pos: 0, h, s: rng.range(0.3, 0.6), l: rng.range(0.1, 0.18) },
      { pos: 0.6, h: (h + 0.03) % 1, s: rng.range(0.2, 0.5), l: rng.range(0.05, 0.1) },
      { pos: 1, h: (h + 0.06) % 1, s: rng.range(0.15, 0.35), l: rng.range(0.01, 0.05) },
    ];
    const grad = registry.get('col:gradient')!.create({ stops });

    return (ctx: PipelineContext) => {
      const radF = radial(ctx) as ScalarField;
      return grad(ctx, radF) as ColorField;
    };
  },
};

registry.registerRecipe(recipe);
export default recipe;

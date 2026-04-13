import { registry } from './registry.js';
import { ScalarField, ColorField } from './fields.js';
import type { RNG, PipelineContext, NodeFn } from './types.js';
import { RecipeSlot } from './types.js';

export interface Pipeline {
  patterns: { icon: string; bg: string; mask: string };
  execute(ctx: PipelineContext): Uint8ClampedArray;
}

export function buildPipeline(rng: RNG): Pipeline {
  const iconRecipes = registry.listRecipesBySlot(RecipeSlot.ICON);
  const bgRecipes = registry.listRecipesBySlot(RecipeSlot.BG);
  const maskRecipes = registry.listRecipesBySlot(RecipeSlot.MASK);

  if (!iconRecipes.length || !bgRecipes.length || !maskRecipes.length) {
    throw new Error(`Registry missing recipes: icon=${iconRecipes.length} bg=${bgRecipes.length} mask=${maskRecipes.length}`);
  }

  const iconRecipe = rng.pick(iconRecipes);
  const bgRecipe = rng.pick(bgRecipes);
  const maskRecipe = rng.pick(maskRecipes);

  const iconFn = iconRecipe.build(rng.fork(), registry) as NodeFn<ColorField>;
  const bgFn = bgRecipe.build(rng.fork(), registry) as NodeFn<ColorField>;
  const maskFn = maskRecipe.build(rng.fork(), registry) as NodeFn<ScalarField>;
  const composeFn = registry.get('col:compose')!.create({});

  return {
    patterns: { icon: iconRecipe.id, bg: bgRecipe.id, mask: maskRecipe.id },
    execute(ctx: PipelineContext): Uint8ClampedArray {
      const iconColor = iconFn(ctx);
      const bgColor = bgFn(ctx);
      const mask = maskFn(ctx);
      return composeFn(ctx, iconColor, bgColor, mask) as Uint8ClampedArray;
    },
  };
}

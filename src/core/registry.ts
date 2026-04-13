import type { Component, ComponentType, ComponentRegistryReader, Recipe, RecipeSlot } from './types.js';

class ComponentRegistry implements ComponentRegistryReader {
  private components = new Map<string, Component>();
  private byType = new Map<ComponentType, Component[]>();
  private recipes = new Map<string, Recipe>();
  private recipesBySlot = new Map<RecipeSlot, Recipe[]>();

  register(component: Component): void {
    if (this.components.has(component.id)) {
      throw new Error(`Component "${component.id}" already registered`);
    }
    this.components.set(component.id, component);
    const list = this.byType.get(component.type) ?? [];
    list.push(component);
    this.byType.set(component.type, list);
  }

  registerRecipe(recipe: Recipe): void {
    if (this.recipes.has(recipe.id)) {
      throw new Error(`Recipe "${recipe.id}" already registered`);
    }
    this.recipes.set(recipe.id, recipe);
    const list = this.recipesBySlot.get(recipe.slot) ?? [];
    list.push(recipe);
    this.recipesBySlot.set(recipe.slot, list);
  }

  get(id: string): Component | undefined {
    return this.components.get(id);
  }

  listByType(type: ComponentType): Component[] {
    return this.byType.get(type) ?? [];
  }

  getRecipe(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }

  listRecipesBySlot(slot: RecipeSlot): Recipe[] {
    return this.recipesBySlot.get(slot) ?? [];
  }

  stats(): { components: number; recipes: Record<string, number> } {
    const recipes: Record<string, number> = {};
    for (const [slot, list] of this.recipesBySlot) {
      recipes[slot] = list.length;
    }
    return { components: this.components.size, recipes };
  }
}

// 全局单例
export const registry = new ComponentRegistry();

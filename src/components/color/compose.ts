import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component = {
  id: 'col:compose',
  type: ComponentType.COMPOSE,
  params: {},
  create() {
    return (ctx: PipelineContext, iconColor: ColorField, bgColor: ColorField, maskField: ScalarField) => {
      const w = ctx.geo.width, h = ctx.geo.height;
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const m = maskField
          ? Math.max(0, Math.min(1, maskField.data[i]!))
          : ctx.geo.insideMask[i]!;
        let r: number, g: number, b: number;
        if (m > 0.001 && iconColor) {
          const bgR = bgColor ? bgColor.r[i]! : 0;
          const bgG = bgColor ? bgColor.g[i]! : 0;
          const bgB = bgColor ? bgColor.b[i]! : 0;
          r = bgR * (1 - m) + iconColor.r[i]! * m;
          g = bgG * (1 - m) + iconColor.g[i]! * m;
          b = bgB * (1 - m) + iconColor.b[i]! * m;
        } else if (bgColor) {
          r = bgColor.r[i]!; g = bgColor.g[i]!; b = bgColor.b[i]!;
        } else {
          r = 0; g = 0; b = 0;
        }
        const idx = i * 4;
        pixels[idx] = Math.max(0, Math.min(255, r * 255));
        pixels[idx + 1] = Math.max(0, Math.min(255, g * 255));
        pixels[idx + 2] = Math.max(0, Math.min(255, b * 255));
        pixels[idx + 3] = 255;
      }
      return pixels;
    };
  },
};

registry.register(component);
export default component;

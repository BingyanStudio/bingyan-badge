import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

// GIF 透明标记色：选用洋红色，正常纹理几乎不会生成此色，避免与深色像素碰撞
export const TRANSPARENT_MARKER = { r: 255, g: 0, b: 255 };
export const TRANSPARENT_COLOR_INT = 0xFF00FF;

const component: Component = {
  id: 'col:compose',
  type: ComponentType.COMPOSE,
  params: {},
  create() {
    return (ctx: PipelineContext, iconColor: ColorField, bgColor: ColorField, maskField: ScalarField) => {
      const w = ctx.geo.width, h = ctx.geo.height;
      const pixels = new Uint8ClampedArray(w * h * 4);
      const transparent = ctx.transparent ?? true;

      for (let i = 0; i < w * h; i++) {
        const m = maskField
          ? Math.max(0, Math.min(1, maskField.data[i]!))
          : ctx.geo.insideMask[i]!;

        const idx = i * 4;

        if (transparent) {
          if (m > 0.5) {
            // Icon pixel: fully opaque
            pixels[idx] = Math.max(0, Math.min(255, iconColor.r[i]! * 255));
            pixels[idx + 1] = Math.max(0, Math.min(255, iconColor.g[i]! * 255));
            pixels[idx + 2] = Math.max(0, Math.min(255, iconColor.b[i]! * 255));
            pixels[idx + 3] = 255;
          } else {
            // Background pixel: fully transparent (alpha=0 triggers gif-encoder-2 transparency)
            pixels[idx] = 255;
            pixels[idx + 1] = 0;
            pixels[idx + 2] = 255;
            pixels[idx + 3] = 0;
          }
        } else {
          // Opaque mode: blend icon and bg
          if (m > 0.001 && iconColor) {
            const bgR = bgColor ? bgColor.r[i]! : 0;
            const bgG = bgColor ? bgColor.g[i]! : 0;
            const bgB = bgColor ? bgColor.b[i]! : 0;
            pixels[idx] = Math.max(0, Math.min(255, (bgR * (1 - m) + iconColor.r[i]! * m) * 255));
            pixels[idx + 1] = Math.max(0, Math.min(255, (bgG * (1 - m) + iconColor.g[i]! * m) * 255));
            pixels[idx + 2] = Math.max(0, Math.min(255, (bgB * (1 - m) + iconColor.b[i]! * m) * 255));
          } else if (bgColor) {
            pixels[idx] = Math.max(0, Math.min(255, bgColor.r[i]! * 255));
            pixels[idx + 1] = Math.max(0, Math.min(255, bgColor.g[i]! * 255));
            pixels[idx + 2] = Math.max(0, Math.min(255, bgColor.b[i]! * 255));
          }
          pixels[idx + 3] = 255;
        }
      }
      return pixels;
    };
  },
};

registry.register(component);
export default component;

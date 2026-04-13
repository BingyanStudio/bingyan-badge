import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

// GIF 透明标记色：背景区域填充此色，由 GIFEncoder 映射为透明
// 选一个极暗的颜色，正常纹理不太会生成这个精确值
export const TRANSPARENT_MARKER = { r: 1, g: 1, b: 1 };
export const TRANSPARENT_COLOR_INT = 0x010101;

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

        if (m > 0.001 && iconColor) {
          if (transparent) {
            // 透明模式：icon 颜色直接输出，不混合背景
            pixels[idx] = Math.max(0, Math.min(255, iconColor.r[i]! * 255));
            pixels[idx + 1] = Math.max(0, Math.min(255, iconColor.g[i]! * 255));
            pixels[idx + 2] = Math.max(0, Math.min(255, iconColor.b[i]! * 255));
          } else {
            // 不透明模式：icon + bg 混合
            const bgR = bgColor ? bgColor.r[i]! : 0;
            const bgG = bgColor ? bgColor.g[i]! : 0;
            const bgB = bgColor ? bgColor.b[i]! : 0;
            pixels[idx] = Math.max(0, Math.min(255, (bgR * (1 - m) + iconColor.r[i]! * m) * 255));
            pixels[idx + 1] = Math.max(0, Math.min(255, (bgG * (1 - m) + iconColor.g[i]! * m) * 255));
            pixels[idx + 2] = Math.max(0, Math.min(255, (bgB * (1 - m) + iconColor.b[i]! * m) * 255));
          }
          // 避免意外命中透明标记色
          if (transparent && pixels[idx] === 1 && pixels[idx + 1] === 1 && pixels[idx + 2] === 1) {
            pixels[idx] = 2;
          }
          pixels[idx + 3] = 255;
        } else {
          if (transparent) {
            // 背景区域：填充透明标记色
            pixels[idx] = TRANSPARENT_MARKER.r;
            pixels[idx + 1] = TRANSPARENT_MARKER.g;
            pixels[idx + 2] = TRANSPARENT_MARKER.b;
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

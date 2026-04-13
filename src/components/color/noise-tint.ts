// 噪声着色：对每个像素的色相/饱和度施加微量噪声扰动
// 模拟胶片颗粒的色彩偏移，让数字图像具有模拟质感
// 与 grain 组合 → 复古胶片；与 watercolor 组合 → 手绘水彩
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { rgbToHsl, hslToRgb, hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  hueNoise: number;
  satNoise: number;
  lumNoise: number;
  scale: number;
  seed: number;
  animate: number;
}

const component: Component<P> = {
  id: 'col:noise-tint',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    hueNoise: { type: 'float', min: 0, max: 0.1, default: 0.03 },
    satNoise: { type: 'float', min: 0, max: 0.2, default: 0.08 },
    lumNoise: { type: 'float', min: 0, max: 0.15, default: 0.05 },
    scale: { type: 'float', min: 1, max: 8, default: 3 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1, default: 0.3 },
  },
  create({ hueNoise, satNoise, lumNoise, scale, seed, animate }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const c = new ColorField(w, h);
      const frame = Math.floor(ctx.t * 30 * animate);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let [hue, sat, lum] = rgbToHsl(input.r[i]!, input.g[i]!, input.b[i]!);

          const sx = Math.floor(x / w * scale * 10);
          const sy = Math.floor(y / h * scale * 10);
          const hn = (hash(sx, sy, seed + frame) - 0.5) * 2 * hueNoise;
          const sn = (hash(sx, sy, seed + frame + 1000) - 0.5) * 2 * satNoise;
          const ln = (hash(sx, sy, seed + frame + 2000) - 0.5) * 2 * lumNoise;

          hue = ((hue + hn) % 1 + 1) % 1;
          sat = Math.max(0, Math.min(1, sat + sn));
          lum = Math.max(0, Math.min(1, lum + ln));

          const [r, g, b] = hslToRgb(hue, sat, lum);
          c.r[i] = r;
          c.g[i] = g;
          c.b[i] = b;
        }
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

// 水彩效果：边缘洇染 + 颜料沉积 + 纸张纹理
// 与 blur 组合 → 水墨晕染；与 contour 组合 → 水彩线描；与 grain 组合 → 手工纸质感
// 核心思路：在颜色场上做各向异性扩散，让颜色在边界处自然渗透，然后叠加颗粒模拟纸张吸附
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { hash, fbm, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  bleed: number;
  pigment: number;
  paperGrain: number;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'col:watercolor',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    bleed: { type: 'float', min: 0.5, max: 4, default: 2 },
    pigment: { type: 'float', min: 0.1, max: 0.8, default: 0.4 },
    paperGrain: { type: 'float', min: 0.05, max: 0.3, default: 0.12 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1, default: 0.3 },
  },
  create({ bleed, pigment, paperGrain, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const radius = Math.ceil(bleed);
      const phase = loopValue(ctx.t, animMode) * animate;

      // Separable box blur (O(n) per pixel instead of O(radius^2))
      const blurChannel = (src: Float32Array): Float32Array => {
        const tmp = new Float32Array(w * h);
        const out = new Float32Array(w * h);
        const diam = radius * 2 + 1;
        const inv = 1 / diam;
        // Horizontal pass
        for (let y = 0; y < h; y++) {
          let sum = 0;
          for (let x = -radius; x <= radius; x++)
            sum += src[y * w + Math.max(0, Math.min(w - 1, x))]!;
          tmp[y * w] = sum * inv;
          for (let x = 1; x < w; x++) {
            sum += src[y * w + Math.min(w - 1, x + radius)]!;
            sum -= src[y * w + Math.max(0, x - radius - 1)]!;
            tmp[y * w + x] = sum * inv;
          }
        }
        // Vertical pass
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let y = -radius; y <= radius; y++)
            sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]!;
          out[x] = sum * inv;
          for (let y = 1; y < h; y++) {
            sum += tmp[Math.min(h - 1, y + radius) * w + x]!;
            sum -= tmp[Math.max(0, y - radius - 1) * w + x]!;
            out[y * w + x] = sum * inv;
          }
        }
        return out;
      };

      const spreadR = blurChannel(input.r);
      const spreadG = blurChannel(input.g);
      const spreadB = blurChannel(input.b);

      // Edge darkening + paper grain
      const c = new ColorField(w, h);
      const frame = Math.floor(ctx.t * 30 * animate);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;

          const diffR = Math.abs(spreadR[i]! - input.r[i]!);
          const diffG = Math.abs(spreadG[i]! - input.g[i]!);
          const diffB = Math.abs(spreadB[i]! - input.b[i]!);
          const edgeDark = (diffR + diffG + diffB) * pigment;

          const paper = 1 - paperGrain * (hash(x, y, seed + 7777 + frame) - 0.5) * 2;

          c.r[i] = Math.max(0, Math.min(1, (spreadR[i]! - edgeDark) * paper));
          c.g[i] = Math.max(0, Math.min(1, (spreadG[i]! - edgeDark) * paper));
          c.b[i] = Math.max(0, Math.min(1, (spreadB[i]! - edgeDark) * paper));
        }
      }

      return c;
    };
  },
};

registry.register(component);
export default component;

// 辉光/泛光：对亮区做扩散模糊后叠加回原图，产生光晕效果
// 与 threshold 组合 → 霓虹灯管；与 vignette 组合 → 聚光舞台
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { AnimMode, loopValue01 } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  threshold: number;
  radius: number;
  intensity: number;
  pulseFreq: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'col:glow',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    threshold: { type: 'float', min: 0.3, max: 0.9, default: 0.6 },
    radius: { type: 'int', min: 2, max: 8, default: 4 },
    intensity: { type: 'float', min: 0.2, max: 1.5, default: 0.6 },
    pulseFreq: { type: 'float', min: 0, max: 2, default: 0 },
  },
  create({ threshold, radius, intensity, pulseFreq, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const pulse = pulseFreq > 0
        ? 0.7 + loopValue01(ctx.t * pulseFreq % 1, animMode) * 0.6
        : 1;
      const eff = intensity * pulse;

      // 提取高亮区域
      const brightR = new Float32Array(w * h);
      const brightG = new Float32Array(w * h);
      const brightB = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const lum = input.r[i]! * 0.299 + input.g[i]! * 0.587 + input.b[i]! * 0.114;
        if (lum > threshold) {
          const factor = (lum - threshold) / (1 - threshold);
          brightR[i] = input.r[i]! * factor;
          brightG[i] = input.g[i]! * factor;
          brightB[i] = input.b[i]! * factor;
        }
      }

      // 简易 box blur
      const blurChannel = (src: Float32Array): Float32Array => {
        const tmp = new Float32Array(w * h);
        const out = new Float32Array(w * h);
        const diam = radius * 2 + 1;
        const inv = 1 / diam;
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

      const glowR = blurChannel(brightR);
      const glowG = blurChannel(brightG);
      const glowB = blurChannel(brightB);

      // 叠加
      const c = new ColorField(w, h);
      for (let i = 0; i < w * h; i++) {
        c.r[i] = Math.min(1, input.r[i]! + glowR[i]! * eff);
        c.g[i] = Math.min(1, input.g[i]! + glowG[i]! * eff);
        c.b[i] = Math.min(1, input.b[i]! + glowB[i]! * eff);
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

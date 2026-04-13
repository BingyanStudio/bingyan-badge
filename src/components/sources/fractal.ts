// 分形组件：基于 path 距离场做分形重复
// 将 SDF 值做周期性折叠，产生类似等高线/分形缩放的图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  layers: number;     // 分形重复层数
  decay: number;      // 每层衰减
  freqMul: number;    // 每层频率倍增
  distortion: number; // 噪声扰动强度
  seed: number;
  scrollSpeed: number;
}

const component: Component<P> = {
  id: 'src:fractal',
  type: ComponentType.SOURCE,
  params: {
    layers: { type: 'int', min: 2, max: 8, default: 4 },
    decay: { type: 'float', min: 0.3, max: 0.8, default: 0.5 },
    freqMul: { type: 'float', min: 1.5, max: 3, default: 2 },
    distortion: { type: 'float', min: 0, max: 15, default: 5 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    scrollSpeed: { type: 'float', min: 0, max: 1.5, default: 1 },
  },
  create({ layers, decay, freqMul, distortion, seed, scrollSpeed }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf, normalX, normalY } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = Math.sin(ctx.t * Math.PI * 2) * scrollSpeed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const baseDist = Math.abs(sdf[i]!);

          // 噪声扰动采样坐标
          const nx = x + normalX[i]! * distortion * fbm(x / w * 3 + phase, y / h * 3, 3, seed);
          const ny = y + normalY[i]! * distortion * fbm(x / w * 3, y / h * 3 + phase, 3, seed + 100);
          const distortedDist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2) + baseDist;

          // 分形折叠：多层不同频率的正弦波叠加
          let val = 0;
          let amp = 1;
          let freq = 0.15;
          for (let l = 0; l < layers; l++) {
            val += amp * (0.5 + 0.5 * Math.sin(distortedDist * freq + ctx.t * Math.PI * 2 * (l + 1)));
            amp *= decay;
            freq *= freqMul;
          }
          f.data[i] = Math.max(0, Math.min(1, val / (1 + decay)));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

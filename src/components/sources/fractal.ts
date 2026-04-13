// 分形组件：基于 path 距离场做分形重复
// 将 SDF 值做周期性折叠，产生类似等高线/分形缩放的图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  layers: number;
  decay: number;
  freqMul: number;
  distortion: number;
  seed: number;
  scrollSpeed: number;
  animMode: AnimMode;
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
  create({ layers, decay, freqMul, distortion, seed, scrollSpeed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf, normalX, normalY } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = loopValue(ctx.t, animMode) * scrollSpeed;
      // 分形层内的时间推进：FORWARD 模式直接用 t，其他模式用 sin
      const layerTime = animMode === AnimMode.FORWARD
        ? ctx.t * Math.PI * 2
        : ctx.t * Math.PI * 2;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const baseDist = Math.abs(sdf[i]!);

          const nx = x + normalX[i]! * distortion * fbm(x / w * 3 + phase, y / h * 3, 3, seed);
          const ny = y + normalY[i]! * distortion * fbm(x / w * 3, y / h * 3 + phase, 3, seed + 100);
          const distortedDist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2) + baseDist;

          let val = 0;
          let amp = 1;
          let freq = 0.15;
          for (let l = 0; l < layers; l++) {
            val += amp * (0.5 + 0.5 * Math.sin(distortedDist * freq + layerTime * (l + 1)));
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

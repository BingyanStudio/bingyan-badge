// 各向异性笔刷噪声：沿给定方向拉伸的噪声场，模拟画布上的笔触纹理
// 与 impasto 组合 → 油画底纹；与 halftone 组合 → 雕版套印；与 gradient 组合 → 印象派底色
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, AnimMode, loopOffset2D } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  scale: number;
  stretch: number;
  angle: number;
  layers: number;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:brush-noise',
  type: ComponentType.SOURCE,
  params: {
    scale: { type: 'float', min: 1, max: 8, default: 3 },
    stretch: { type: 'float', min: 2, max: 10, default: 5 },
    angle: { type: 'float', min: 0, max: 6.28, default: 0.6 },
    layers: { type: 'int', min: 1, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0.1, max: 1.5, default: 0.5 },
  },
  create({ scale, stretch, angle, layers, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w * scale;
          const ny = y / h * scale;

          const bx = cosA * nx + sinA * ny;
          const by = -sinA * nx + cosA * ny;

          const sx = bx;
          const sy = by * stretch;

          let val = 0;
          let amp = 1;
          let totalAmp = 0;
          for (let l = 0; l < layers; l++) {
            const lScale = 1 + l * 0.7;
            // 每层用自己的相位偏移（l 作为额外偏移）
            const [phX, phY] = loopOffset2D((ctx.t + l * 0.17) % 1, animMode, 0.3 * animate, 0.3 * animate);
            val += amp * fbm(
              sx * lScale + phX,
              sy * lScale + phY,
              4, seed + l * 1000
            );
            totalAmp += amp;
            amp *= 0.5;
          }

          f.data[y * w + x] = Math.max(0, Math.min(1, val / totalAmp));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

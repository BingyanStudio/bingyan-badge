// 水面焦散：模拟光线穿过水面折射产生的波纹亮斑
// 通过多层正弦波的极值检测近似焦散聚焦区域
// 与 gradient 组合 → 水下场景；与 impasto 组合 → 宝石内部光线
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  scale: number;
  layers: number;
  speed: number;
  intensity: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'lit:caustics',
  type: ComponentType.LIGHTING,
  params: {
    scale: { type: 'float', min: 2, max: 10, default: 5 },
    layers: { type: 'int', min: 2, max: 5, default: 3 },
    speed: { type: 'float', min: 0.3, max: 2, default: 1 },
    intensity: { type: 'float', min: 0.3, max: 1, default: 0.7 },
  },
  create({ scale, layers, speed, intensity, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * speed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w * scale, ny = y / h * scale;
          let maxVal = 0;

          for (let l = 0; l < layers; l++) {
            const lf = 1 + l * 0.7;
            const lp = phase * (1 + l * 0.3);
            // 两组交叉波的绝对值叠加
            const wave1 = Math.abs(Math.sin(nx * lf * 2.3 + ny * lf * 1.7 + lp));
            const wave2 = Math.abs(Math.sin(nx * lf * 1.5 - ny * lf * 2.1 + lp * 0.8));
            // 焦散 = 两组波的乘积在极值处产生亮斑
            const caustic = Math.pow(wave1 * wave2, 0.5);
            maxVal = Math.max(maxVal, caustic);
          }

          f.data[y * w + x] = Math.min(1, maxVal * intensity + (1 - intensity) * 0.3);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

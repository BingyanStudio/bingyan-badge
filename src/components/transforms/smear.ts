// 运动拖尾：沿指定方向采样多点做定向模糊，模拟运动模糊
// 与 glitch 组合 → 数据传输干扰；与 feedback 组合 → 拖影余像
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  angle: number;
  length: number;
  samples: number;
  speed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:smear',
  type: ComponentType.TRANSFORM,
  params: {
    angle: { type: 'float', min: 0, max: 6.28, default: 0 },
    length: { type: 'float', min: 2, max: 20, default: 8 },
    samples: { type: 'int', min: 3, max: 12, default: 6 },
    speed: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ angle, length, samples, speed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const a = angle + ctx.t * Math.PI * 2 * speed;
      const dx = Math.cos(a), dy = Math.sin(a);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, totalW = 0;
          for (let s = 0; s < samples; s++) {
            const t = (s / (samples - 1)) * 2 - 1; // [-1, 1]
            const weight = 1 - Math.abs(t) * 0.5;
            const sx = x + dx * t * length;
            const sy = y + dy * t * length;
            sum += input.sample(
              Math.max(0, Math.min(w - 1, sx)),
              Math.max(0, Math.min(h - 1, sy))
            ) * weight;
            totalW += weight;
          }
          f.data[y * w + x] = sum / totalW;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

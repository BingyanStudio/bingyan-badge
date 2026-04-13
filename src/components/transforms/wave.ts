// 波形变形：沿 X/Y 轴做参数化正弦位移
// 不同轴向、频率、振幅的组合产生从水面波纹到旗帜飘动的各种效果
// 与 mirror 组合 → 对称波浪；与 posterize 组合 → 层叠梯田
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  axis: string;
  freq: number;
  amplitude: number;
  speed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:wave',
  type: ComponentType.TRANSFORM,
  params: {
    axis: { type: 'enum', options: ['horizontal', 'vertical', 'both'], default: 'both' },
    freq: { type: 'float', min: 1, max: 10, default: 3 },
    amplitude: { type: 'float', min: 2, max: 20, default: 8 },
    speed: { type: 'float', min: 0.3, max: 2, default: 1 },
  },
  create({ axis, freq, amplitude, speed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * speed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx = x, sy = y;

          if (axis === 'horizontal' || axis === 'both') {
            sx += Math.sin(y / h * Math.PI * 2 * freq + phase) * amplitude;
          }
          if (axis === 'vertical' || axis === 'both') {
            sy += Math.sin(x / w * Math.PI * 2 * freq + phase * 0.7) * amplitude;
          }

          f.data[y * w + x] = input.sample(
            Math.max(0, Math.min(w - 1, sx)),
            Math.max(0, Math.min(h - 1, sy))
          );
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

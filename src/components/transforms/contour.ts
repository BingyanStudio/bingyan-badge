// 等值线提取：在标量场上按固定间隔提取等高线
// 与 palette 组合 → 木刻版画；与 blur+gradient 组合 → 地形图风格；与 invert 组合 → 荧光线描
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  levels: number;
  lineWidth: number;
  fill: string;
  animate: number;
}

const component: Component<P> = {
  id: 'xf:contour',
  type: ComponentType.TRANSFORM,
  params: {
    levels: { type: 'int', min: 3, max: 20, default: 8 },
    lineWidth: { type: 'float', min: 0.5, max: 3, default: 1 },
    fill: { type: 'enum', options: ['line-only', 'stepped', 'hybrid'], default: 'hybrid' },
    animate: { type: 'float', min: 0, max: 1.5, default: 0.5 },
  },
  create({ levels, lineWidth, fill, animate }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const offset = ctx.t * animate;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const v = input.data[i]! + offset;

          // 量化到等级
          const stepped = Math.floor(v * levels) / levels;

          // 计算到最近等值线的距离（用邻域梯度估计）
          const vr = x < w - 1 ? input.data[i + 1]! + offset : v;
          const vd = y < h - 1 ? input.data[i + w]! + offset : v;
          const gradX = (vr - v) * levels;
          const gradY = (vd - v) * levels;
          const gradMag = Math.sqrt(gradX * gradX + gradY * gradY);

          // 到最近等值线的距离
          const fractional = (v * levels) % 1;
          const distToLine = Math.min(fractional, 1 - fractional) / (gradMag + 0.001);
          const lineIntensity = Math.max(0, 1 - distToLine / lineWidth);

          switch (fill) {
            case 'line-only':
              f.data[i] = lineIntensity;
              break;
            case 'stepped':
              f.data[i] = stepped;
              break;
            default: // hybrid: 填色 + 线条叠加
              f.data[i] = Math.min(1, stepped + lineIntensity * 0.4);
          }
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

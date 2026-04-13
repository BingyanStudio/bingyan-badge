// 快速模糊：两趟分离式 box blur（近似高斯）
// 与 sharpen 组合是经典的 unsharp-mask；与 threshold 组合可做柔和描边
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { radius: number; }

const component: Component<P> = {
  id: 'xf:blur',
  type: ComponentType.TRANSFORM,
  params: {
    radius: { type: 'int', min: 1, max: 6, default: 2 },
  },
  create({ radius }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const tmp = new Float32Array(w * h);
      const out = new ScalarField(w, h);
      const diam = radius * 2 + 1;
      const invDiam = 1 / diam;

      // horizontal pass
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = -radius; x <= radius; x++) {
          sum += input.data[y * w + Math.max(0, Math.min(w - 1, x))]!;
        }
        tmp[y * w] = sum * invDiam;
        for (let x = 1; x < w; x++) {
          sum += input.data[y * w + Math.min(w - 1, x + radius)]!;
          sum -= input.data[y * w + Math.max(0, x - radius - 1)]!;
          tmp[y * w + x] = sum * invDiam;
        }
      }

      // vertical pass
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -radius; y <= radius; y++) {
          sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]!;
        }
        out.data[x] = sum * invDiam;
        for (let y = 1; y < h; y++) {
          sum += tmp[Math.min(h - 1, y + radius) * w + x]!;
          sum -= tmp[Math.max(0, y - radius - 1) * w + x]!;
          out.data[y * w + x] = sum * invDiam;
        }
      }

      return out;
    };
  },
};

registry.register(component);
export default component;

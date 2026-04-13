// 脊线提取：检测场中的局部极值线（梯度幅值），产生类似铅笔线描的效果
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { strength: number; invert: number; }

const component: Component<P> = {
  id: 'xf:ridge',
  type: ComponentType.TRANSFORM,
  params: {
    strength: { type: 'float', min: 1, max: 10, default: 4 },
    invert: { type: 'float', min: 0, max: 1, default: 0 },
  },
  create({ strength, invert: inv }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          // Sobel gradient magnitude
          const gx =
            -input.data[(y - 1) * w + x - 1]! - 2 * input.data[y * w + x - 1]! - input.data[(y + 1) * w + x - 1]!
            + input.data[(y - 1) * w + x + 1]! + 2 * input.data[y * w + x + 1]! + input.data[(y + 1) * w + x + 1]!;
          const gy =
            -input.data[(y - 1) * w + x - 1]! - 2 * input.data[(y - 1) * w + x]! - input.data[(y - 1) * w + x + 1]!
            + input.data[(y + 1) * w + x - 1]! + 2 * input.data[(y + 1) * w + x]! + input.data[(y + 1) * w + x + 1]!;

          let val = Math.min(1, Math.sqrt(gx * gx + gy * gy) * strength);
          if (inv > 0.5) val = 1 - val;
          f.data[y * w + x] = val;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

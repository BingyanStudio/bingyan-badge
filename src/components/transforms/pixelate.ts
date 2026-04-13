import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { blockSize: number; }

const component: Component<P> = {
  id: 'xf:pixelate',
  type: ComponentType.TRANSFORM,
  params: {
    blockSize: { type: 'int', min: 2, max: 12, default: 4 },
  },
  create({ blockSize }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
          // 取块中心值
          const cx = Math.min(bx + (blockSize >> 1), w - 1);
          const cy = Math.min(by + (blockSize >> 1), h - 1);
          const val = input.data[cy * w + cx]!;
          for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
            for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
              f.data[(by + dy) * w + (bx + dx)] = val;
            }
          }
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

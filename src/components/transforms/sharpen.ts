// 锐化（unsharp mask）：增强边缘对比度
// 原理：original + amount * (original - blurred)
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { amount: number; radius: number; }

const component: Component<P> = {
  id: 'xf:sharpen',
  type: ComponentType.TRANSFORM,
  params: {
    amount: { type: 'float', min: 0.3, max: 3, default: 1 },
    radius: { type: 'int', min: 1, max: 3, default: 1 },
  },
  create({ amount, radius }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const diam = radius * 2 + 1;
      const invDiam2 = 1 / (diam * diam);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // compute local average
          let sum = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = Math.max(0, Math.min(w - 1, x + dx));
              const ny = Math.max(0, Math.min(h - 1, y + dy));
              sum += input.data[ny * w + nx]!;
            }
          }
          const blurred = sum * invDiam2;
          const original = input.data[y * w + x]!;
          f.data[y * w + x] = Math.max(0, Math.min(1, original + amount * (original - blurred)));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

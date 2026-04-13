import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { amount: number; speed: number; seed: number; }

const component: Component<P> = {
  id: 'xf:grain',
  type: ComponentType.TRANSFORM,
  params: {
    amount: { type: 'float', min: 0.02, max: 0.2, default: 0.08 },
    speed: { type: 'float', min: 1, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 9999, default: 0 },
  },
  create({ amount, speed, seed }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const frame = Math.floor(ctx.t * 60 * speed);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const noise = (hash(x, y, seed + frame) - 0.5) * 2 * amount;
          f.data[i] = Math.max(0, Math.min(1, input.data[i]! + noise));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

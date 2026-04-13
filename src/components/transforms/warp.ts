import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { strength: number; }

const component: Component<P> = {
  id: 'xf:warp',
  type: ComponentType.TRANSFORM,
  params: { strength: { type: 'float', min: 1, max: 40, default: 10 } },
  create({ strength }) {
    return (ctx: PipelineContext, base: ScalarField, amount: ScalarField) => {
      const { width: w, height: h, normalX, normalY } = ctx.geo;
      const f = new ScalarField(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const a = (amount ? amount.data[i]! : 0.5) * strength;
          f.data[i] = base.sample(x + normalX[i]! * a, y + normalY[i]! * a);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

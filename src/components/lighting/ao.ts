import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { range: number; strength: number; }

const component: Component<P> = {
  id: 'lit:ao',
  type: ComponentType.LIGHTING,
  params: {
    range: { type: 'float', min: 5, max: 40, default: 20 },
    strength: { type: 'float', min: 0.1, max: 0.9, default: 0.6 },
  },
  create({ range, strength }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf, insideMask } = ctx.geo;
      const f = new ScalarField(w, h, 1);
      for (let i = 0; i < w * h; i++) {
        if (!insideMask[i]) continue;
        const depth = Math.min(1, Math.abs(sdf[i]!) / range);
        f.data[i] = 1 - (1 - depth) * strength;
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

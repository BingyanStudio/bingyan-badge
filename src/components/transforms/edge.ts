import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { inner: number; outer: number; softness: number; }

const component: Component<P> = {
  id: 'xf:edge',
  type: ComponentType.TRANSFORM,
  params: {
    inner: { type: 'float', min: 0.5, max: 20, default: 3 },
    outer: { type: 'float', min: 0.5, max: 20, default: 3 },
    softness: { type: 'float', min: 0.3, max: 4, default: 1 },
  },
  create({ inner, outer, softness }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const f = new ScalarField(w, h);
      for (let i = 0; i < w * h; i++) {
        const d = sdf[i]!;
        if (d < -inner || d > outer) continue;
        const v = d < 0 ? 1 - Math.abs(d) / inner : 1 - d / outer;
        f.data[i] = Math.pow(Math.max(0, v), softness);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

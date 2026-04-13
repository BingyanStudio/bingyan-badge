import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component<{ normalize: number }> = {
  id: 'src:sdf',
  type: ComponentType.SOURCE,
  params: { normalize: { type: 'float', min: 5, max: 60, default: 30 } },
  create({ normalize }) {
    return (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      for (let i = 0; i < f.data.length; i++) {
        f.data[i] = Math.max(0, Math.min(1, -ctx.geo.sdf[i]! / normalize));
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

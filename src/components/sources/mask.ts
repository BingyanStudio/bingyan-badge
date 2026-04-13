import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component = {
  id: 'src:mask',
  type: ComponentType.SOURCE,
  params: {},
  create() {
    return (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      for (let i = 0; i < f.data.length; i++) f.data[i] = ctx.geo.insideMask[i]!;
      return f;
    };
  },
};

registry.register(component);
export default component;

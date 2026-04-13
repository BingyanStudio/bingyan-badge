import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component = {
  id: 'src:arc',
  type: ComponentType.SOURCE,
  params: {},
  create() {
    return (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      f.data.set(ctx.geo.arcParam);
      return f;
    };
  },
};

registry.register(component);
export default component;

import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component = {
  id: 'xf:invert',
  type: ComponentType.TRANSFORM,
  params: {},
  create() {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const f = new ScalarField(input.width, input.height);
      for (let i = 0; i < input.data.length; i++) f.data[i] = 1 - input.data[i]!;
      return f;
    };
  },
};

registry.register(component);
export default component;

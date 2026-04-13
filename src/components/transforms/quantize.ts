import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { levels: number; }

const component: Component<P> = {
  id: 'xf:quantize',
  type: ComponentType.TRANSFORM,
  params: { levels: { type: 'int', min: 2, max: 16, default: 4 } },
  create({ levels }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const f = new ScalarField(input.width, input.height);
      for (let i = 0; i < input.data.length; i++) {
        f.data[i] = Math.round(input.data[i]! * (levels - 1)) / (levels - 1);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

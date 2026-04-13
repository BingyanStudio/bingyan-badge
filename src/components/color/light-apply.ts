import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { mode: string; }

const component: Component<P> = {
  id: 'col:light-apply',
  type: ComponentType.COLOR_TRANSFORM,
  params: { mode: { type: 'enum', options: ['multiply', 'add'], default: 'multiply' } },
  create({ mode }) {
    return (_ctx: PipelineContext, color: ColorField, light: ScalarField) => {
      const c = new ColorField(color.width, color.height);
      for (let i = 0; i < color.r.length; i++) {
        const l = light.data[i]!;
        if (mode === 'multiply') {
          c.r[i] = color.r[i]! * l;
          c.g[i] = color.g[i]! * l;
          c.b[i] = color.b[i]! * l;
        } else {
          c.r[i] = Math.min(1, color.r[i]! + l);
          c.g[i] = Math.min(1, color.g[i]! + l);
          c.b[i] = Math.min(1, color.b[i]! + l);
        }
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

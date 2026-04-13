import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { decay: number; key: string; }

const component: Component<P> = {
  id: 'xf:feedback',
  type: ComponentType.TRANSFORM,
  params: {
    decay: { type: 'float', min: 0.5, max: 0.98, default: 0.85 },
    key: { type: 'enum', options: ['fb_a', 'fb_b', 'fb_c'], default: 'fb_a' },
  },
  create({ decay, key }) {
    return (ctx: PipelineContext, current: ScalarField) => {
      const prev = ctx.feedback[key];
      const f = new ScalarField(current.width, current.height);
      if (prev) {
        for (let i = 0; i < current.data.length; i++) {
          f.data[i] = Math.max(current.data[i]!, prev.data[i]! * decay);
        }
      } else {
        f.data.set(current.data);
      }
      ctx.feedback[key] = f.clone();
      return f;
    };
  },
};

registry.register(component);
export default component;

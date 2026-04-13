import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { spacing: number; thickness: number; scrollSpeed: number; }

const component: Component<P> = {
  id: 'xf:scan-lines',
  type: ComponentType.TRANSFORM,
  params: {
    spacing: { type: 'int', min: 2, max: 8, default: 4 },
    thickness: { type: 'float', min: 0.1, max: 0.7, default: 0.35 },
    scrollSpeed: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ spacing, thickness, scrollSpeed }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const offset = ctx.t * spacing * scrollSpeed;
      for (let y = 0; y < h; y++) {
        const phase = ((y + offset) % spacing) / spacing;
        const darken = phase < thickness ? 0.5 + 0.5 * (phase / thickness) : 1;
        for (let x = 0; x < w; x++) {
          f.data[y * w + x] = input.data[y * w + x]! * darken;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

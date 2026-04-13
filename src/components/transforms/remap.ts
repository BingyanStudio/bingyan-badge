import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { inMin: number; inMax: number; outMin: number; outMax: number; curve: string; }

const component: Component<P> = {
  id: 'xf:remap',
  type: ComponentType.TRANSFORM,
  params: {
    inMin: { type: 'float', min: -2, max: 2, default: 0 },
    inMax: { type: 'float', min: -2, max: 2, default: 1 },
    outMin: { type: 'float', min: -1, max: 2, default: 0 },
    outMax: { type: 'float', min: -1, max: 2, default: 1 },
    curve: { type: 'enum', options: ['linear', 'smooth', 'pow2', 'sqrt'], default: 'linear' },
  },
  create({ inMin, inMax, outMin, outMax, curve }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const f = new ScalarField(input.width, input.height);
      const range = inMax - inMin || 1;
      for (let i = 0; i < input.data.length; i++) {
        let v = (input.data[i]! - inMin) / range;
        v = Math.max(0, Math.min(1, v));
        if (curve === 'smooth') v = v * v * (3 - 2 * v);
        else if (curve === 'pow2') v = v * v;
        else if (curve === 'sqrt') v = Math.sqrt(v);
        f.data[i] = outMin + v * (outMax - outMin);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { mode: string; }

const component: Component<P> = {
  id: 'comb:combine',
  type: ComponentType.COMBINER,
  params: {
    mode: { type: 'enum', options: ['add', 'mul', 'screen', 'overlay', 'max', 'min', 'sub'], default: 'add' },
  },
  create({ mode }) {
    return (_ctx: PipelineContext, a: ScalarField, b: ScalarField) => {
      const f = new ScalarField(a.width, a.height);
      for (let i = 0; i < a.data.length; i++) {
        const va = a.data[i]!, vb = b.data[i]!;
        switch (mode) {
          case 'add': f.data[i] = va + vb; break;
          case 'mul': f.data[i] = va * vb; break;
          case 'screen': f.data[i] = 1 - (1 - va) * (1 - vb); break;
          case 'overlay': f.data[i] = va < 0.5 ? 2 * va * vb : 1 - 2 * (1 - va) * (1 - vb); break;
          case 'max': f.data[i] = Math.max(va, vb); break;
          case 'min': f.data[i] = Math.min(va, vb); break;
          case 'sub': f.data[i] = va - vb; break;
          default: f.data[i] = va + vb;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

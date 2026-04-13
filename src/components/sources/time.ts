import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { waveform: string; freq: number; phase: number; }

const component: Component<P> = {
  id: 'src:time',
  type: ComponentType.SOURCE,
  params: {
    waveform: { type: 'enum', options: ['sin', 'saw', 'tri', 'pulse', 'exp'], default: 'sin' },
    freq: { type: 'float', min: 0.1, max: 8, default: 1 },
    phase: { type: 'float', min: 0, max: 1, default: 0 },
  },
  create({ waveform, freq, phase }) {
    return (ctx: PipelineContext) => {
      const raw = ctx.t * freq + phase;
      let val: number;
      switch (waveform) {
        case 'sin': val = Math.sin(raw * Math.PI * 2) * 0.5 + 0.5; break;
        case 'saw': val = ((raw % 1) + 1) % 1; break;
        case 'tri': val = 1 - Math.abs(((raw % 1 + 1) % 1) * 2 - 1); break;
        case 'pulse': val = ((raw % 1 + 1) % 1) < 0.5 ? 1 : 0; break;
        case 'exp': val = Math.exp(-((raw % 1 + 1) % 1) * 5); break;
        default: val = ((raw % 1) + 1) % 1;
      }
      return new ScalarField(ctx.geo.width, ctx.geo.height, val);
    };
  },
};

registry.register(component);
export default component;

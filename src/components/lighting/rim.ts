import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode, loopValue01 } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { edgeWidth: number; softness: number; pulse: number; pulseFreq: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'lit:rim',
  type: ComponentType.LIGHTING,
  params: {
    edgeWidth: { type: 'float', min: 2, max: 25, default: 8 },
    softness: { type: 'float', min: 0.5, max: 4, default: 1.5 },
    pulse: { type: 'float', min: 0, max: 1, default: 0 },
    pulseFreq: { type: 'float', min: 0.2, max: 2, default: 1 },
  },
  create({ edgeWidth, softness, pulse, pulseFreq, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h, sdf } = ctx.geo;
      const f = new ScalarField(w, h);
      const pMod = pulse > 0 ? loopValue01(ctx.t * pulseFreq % 1, animMode) * pulse : 0;
      const ew = edgeWidth * (1 + pMod);
      for (let i = 0; i < w * h; i++) {
        const d = Math.abs(sdf[i]!);
        if (d < ew) f.data[i] = Math.pow(1 - d / ew, softness);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

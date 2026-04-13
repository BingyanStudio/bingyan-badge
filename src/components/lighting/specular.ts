import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { angle: number; power: number; rotateSpeed: number; }

const component: Component<P> = {
  id: 'lit:specular',
  type: ComponentType.LIGHTING,
  params: {
    angle: { type: 'float', min: 0, max: 6.28, default: 0.8 },
    power: { type: 'float', min: 4, max: 64, default: 20 },
    rotateSpeed: { type: 'float', min: 0, max: 8, default: 0 },
  },
  create({ angle, power, rotateSpeed }) {
    return (ctx: PipelineContext) => {
      const a = angle + ctx.t * rotateSpeed;
      const lx = Math.cos(a), ly = Math.sin(a);
      const { width: w, height: h, normalX, normalY, insideMask } = ctx.geo;
      const f = new ScalarField(w, h);
      for (let i = 0; i < w * h; i++) {
        if (!insideMask[i]) continue;
        f.data[i] = Math.pow(Math.max(0, normalX[i]! * lx + normalY[i]! * ly), power);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

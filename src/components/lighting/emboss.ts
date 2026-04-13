import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { angle: number; elev: number; rotateSpeed: number; depth: number; }

const component: Component<P> = {
  id: 'lit:emboss',
  type: ComponentType.LIGHTING,
  params: {
    angle: { type: 'float', min: 0, max: 6.28, default: 0.8 },
    elev: { type: 'float', min: 0.1, max: 1.2, default: 0.6 },
    rotateSpeed: { type: 'float', min: 0, max: 6, default: 0 },
    depth: { type: 'float', min: 0.3, max: 3, default: 1 },
  },
  create({ angle, elev, rotateSpeed, depth }) {
    return (ctx: PipelineContext) => {
      const a = angle + ctx.t * rotateSpeed;
      const lx = Math.cos(a) * Math.cos(elev), ly = Math.sin(a) * Math.cos(elev);
      const { width: w, height: h, sdf, normalX, normalY, insideMask } = ctx.geo;
      const f = new ScalarField(w, h, 0.5);
      for (let i = 0; i < w * h; i++) {
        if (!insideMask[i]) continue;
        const dot = normalX[i]! * lx + normalY[i]! * ly;
        const depthFade = Math.min(1, Math.abs(sdf[i]!) / (12 * depth));
        f.data[i] = 0.5 + dot * 0.45 * (1 - depthFade * 0.3);
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

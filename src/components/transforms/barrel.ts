import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { strength: number; animate: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'xf:barrel',
  type: ComponentType.TRANSFORM,
  params: {
    strength: { type: 'float', min: 0.1, max: 0.8, default: 0.3 },
    animate: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ strength, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      const k = strength * (1 + 0.3 * loopValue(ctx.t, animMode) * animate);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x - cx) / maxR, dy = (y - cy) / maxR;
          const r2 = dx * dx + dy * dy;
          const factor = 1 + k * r2;
          const sx = cx + dx * factor * maxR;
          const sy = cy + dy * factor * maxR;
          f.data[y * w + x] = input.sample(sx, sy);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

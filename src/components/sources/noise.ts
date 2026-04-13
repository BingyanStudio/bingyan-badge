import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { scale: number; octaves: number; seed: number; scrollX: number; scrollY: number; }

const component: Component<P> = {
  id: 'src:noise',
  type: ComponentType.SOURCE,
  params: {
    scale: { type: 'float', min: 1, max: 12, default: 4 },
    octaves: { type: 'int', min: 1, max: 6, default: 4 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    scrollX: { type: 'float', min: -5, max: 5, default: 0 },
    scrollY: { type: 'float', min: -5, max: 5, default: 0 },
  },
  create({ scale, octaves, seed, scrollX, scrollY }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const ox = ctx.t * scrollX, oy = ctx.t * scrollY;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          f.data[y * w + x] = fbm(x / w * scale + ox, y / h * scale + oy, octaves, seed);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

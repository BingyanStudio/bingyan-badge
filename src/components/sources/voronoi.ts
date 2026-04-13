import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { voronoi, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { scale: number; seed: number; mode: string; scroll: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'src:voronoi',
  type: ComponentType.SOURCE,
  params: {
    scale: { type: 'float', min: 2, max: 15, default: 6 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    mode: { type: 'enum', options: ['dist', 'edge'], default: 'dist' },
    scroll: { type: 'float', min: 0, max: 5, default: 0 },
  },
  create({ scale, seed, mode, scroll, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const ph = loopValue(ctx.t, animMode) * scroll;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = voronoi(x / w * scale + ph, y / h * scale, seed);
          f.data[y * w + x] = mode === 'edge' ? Math.min(1, v.edge * 3) : Math.min(1, v.dist);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

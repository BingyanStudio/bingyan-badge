// 特鲁谢拼贴：在网格中放置随机旋转的基础图元（弧线/对角线/三角），产生连续的迷宫/编织图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  tileSize: number;
  pattern: string;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:truchet',
  type: ComponentType.SOURCE,
  params: {
    tileSize: { type: 'int', min: 8, max: 40, default: 20 },
    pattern: { type: 'enum', options: ['arc', 'diagonal', 'triangle', 'weave'], default: 'arc' },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ tileSize, pattern, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * animate;
      const lv = loopValue(ctx.t, animMode);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const tx = Math.floor(x / tileSize);
          const ty = Math.floor(y / tileSize);
          const rotation = hash(tx, ty, seed) > 0.5 ? 1 : 0;

          let lx = (x % tileSize) / tileSize;
          let ly = (y % tileSize) / tileSize;

          if (rotation) { const tmp = lx; lx = 1 - ly; ly = tmp; }

          let val: number;
          switch (pattern) {
            case 'arc': {
              const d1 = Math.sqrt(lx * lx + ly * ly);
              const d2 = Math.sqrt((1 - lx) ** 2 + (1 - ly) ** 2);
              const r = 0.5 + lv * 0.05 * animate;
              val = Math.min(Math.abs(d1 - r), Math.abs(d2 - r));
              val = 1 - Math.min(1, val * 8);
              break;
            }
            case 'diagonal': {
              const thick = 0.12 + lv * 0.03 * animate;
              const d = Math.abs(lx - ly) / Math.SQRT2;
              val = d < thick ? 1 - d / thick : 0;
              break;
            }
            case 'triangle': {
              const cx = 0.5, cy = 0.5;
              const angle = Math.atan2(ly - cy, lx - cx) + phase * 0.1;
              val = ((angle / Math.PI + 1) * 0.5) % 1;
              break;
            }
            case 'weave': {
              const band = Math.sin(lx * Math.PI) * Math.sin(ly * Math.PI);
              const checker = (tx + ty) % 2;
              val = checker ? band : 1 - band;
              val = val * 0.8 + lv * 0.1 * animate + 0.1;
              break;
            }
            default:
              val = lx;
          }
          f.data[y * w + x] = Math.max(0, Math.min(1, val));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

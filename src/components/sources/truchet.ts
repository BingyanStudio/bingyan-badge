// 特鲁谢拼贴：在网格中放置随机旋转的基础图元（弧线/对角线/三角），产生连续的迷宫/编织图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  tileSize: number;
  pattern: string;
  seed: number;
  animate: number;
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
  create({ tileSize, pattern, seed, animate }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * animate;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const tx = Math.floor(x / tileSize);
          const ty = Math.floor(y / tileSize);
          const rotation = hash(tx, ty, seed) > 0.5 ? 1 : 0;

          // local coordinates within tile [0, 1]
          let lx = (x % tileSize) / tileSize;
          let ly = (y % tileSize) / tileSize;

          // apply tile rotation
          if (rotation) { const tmp = lx; lx = 1 - ly; ly = tmp; }

          let val: number;
          switch (pattern) {
            case 'arc': {
              // two quarter-circles at opposite corners
              const d1 = Math.sqrt(lx * lx + ly * ly);
              const d2 = Math.sqrt((1 - lx) ** 2 + (1 - ly) ** 2);
              const r = 0.5 + Math.sin(phase) * 0.05;
              val = Math.min(Math.abs(d1 - r), Math.abs(d2 - r));
              val = 1 - Math.min(1, val * 8);
              break;
            }
            case 'diagonal': {
              // diagonal line with animated thickness
              const thick = 0.12 + Math.sin(phase) * 0.03;
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
              // interleaving bands
              const band = Math.sin(lx * Math.PI) * Math.sin(ly * Math.PI);
              const checker = (tx + ty) % 2;
              val = checker ? band : 1 - band;
              val = val * 0.8 + Math.sin(phase) * 0.1 + 0.1;
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

// 元胞自动机图案：用简单规则迭代产生复杂的涌现图案
// 1D Wolfram 规则 在 2D 上逐行展开，配合时间滚动
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  rule: number;
  scale: number;
  seed: number;
  scrollSpeed: number;
}

const component: Component<P> = {
  id: 'src:cellular',
  type: ComponentType.SOURCE,
  params: {
    rule: { type: 'int', min: 0, max: 255, default: 110 },
    scale: { type: 'int', min: 1, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ rule, scale, seed }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const sw = Math.ceil(w / scale);
      const sh = Math.ceil(h / scale);
      const scrollOffset = Math.floor(ctx.t * sh);

      // initialize first row from seed
      let prev = new Uint8Array(sw);
      for (let x = 0; x < sw; x++) {
        prev[x] = hash(x, 0, seed) > 0.5 ? 1 : 0;
      }

      // run automaton for sh + scrollOffset rows, keep last sh rows
      const totalRows = sh + scrollOffset;
      const grid = new Float32Array(sw * sh);

      let current = new Uint8Array(sw);
      for (let row = 1; row <= totalRows; row++) {
        for (let x = 0; x < sw; x++) {
          const l = prev[(x - 1 + sw) % sw]!;
          const c = prev[x]!;
          const r = prev[(x + 1) % sw]!;
          const idx = (l << 2) | (c << 1) | r;
          current[x] = (rule >> idx) & 1;
        }

        const gridRow = row - scrollOffset - 1;
        if (gridRow >= 0 && gridRow < sh) {
          for (let x = 0; x < sw; x++) {
            grid[gridRow * sw + x] = current[x]!;
          }
        }

        const tmp = prev;
        prev = current;
        current = tmp;
      }

      // upsample
      const f = new ScalarField(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(Math.floor(x / scale), sw - 1);
          const sy = Math.min(Math.floor(y / scale), sh - 1);
          f.data[y * w + x] = grid[sy * sw + sx]!;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

// 元胞自动机图案：用简单规则迭代产生复杂的涌现图案
// 1D Wolfram 规则在 2D 上逐行展开，用循环偏移保证动画首尾一致
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopValue01 } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  rule: number;
  scale: number;
  seed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:cellular',
  type: ComponentType.SOURCE,
  params: {
    rule: { type: 'int', min: 0, max: 255, default: 110 },
    scale: { type: 'int', min: 1, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ rule, scale, seed, animMode = AnimMode.OSCILLATE }) {
    let cachedGrid: Float32Array | null = null;
    let cachedSW = 0, cachedSH = 0, cachedTotalRows = 0;

    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const sw = Math.ceil(w / scale);
      const sh = Math.ceil(h / scale);
      const scrollRange = sh;
      const totalRows = sh + scrollRange;

      if (!cachedGrid || cachedSW !== sw || cachedSH !== sh) {
        cachedSW = sw; cachedSH = sh; cachedTotalRows = totalRows;
        cachedGrid = new Float32Array(sw * totalRows);

        let prev = new Uint8Array(sw);
        for (let x = 0; x < sw; x++) {
          prev[x] = hash(x, 0, seed) > 0.5 ? 1 : 0;
        }
        for (let x = 0; x < sw; x++) cachedGrid[x] = prev[x]!;

        let current = new Uint8Array(sw);
        for (let row = 1; row < totalRows; row++) {
          for (let x = 0; x < sw; x++) {
            const l = prev[(x - 1 + sw) % sw]!;
            const c = prev[x]!;
            const r = prev[(x + 1) % sw]!;
            const idx = (l << 2) | (c << 1) | r;
            current[x] = (rule >> idx) & 1;
          }
          for (let x = 0; x < sw; x++) cachedGrid[row * sw + x] = current[x]!;
          const tmp = prev; prev = current; current = tmp;
        }
      }

      const scrollOffset = Math.floor(loopValue01(ctx.t, animMode) * scrollRange);

      const f = new ScalarField(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(Math.floor(x / scale), sw - 1);
          const sy = Math.min(Math.floor(y / scale), sh - 1);
          const row = sy + scrollOffset;
          f.data[y * w + x] = cachedGrid![row * sw + sx]!;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

// 水晶切面：基于 Voronoi 将场分割为不规则面片，每片内采样同一点
// 产生类似彩色玻璃/钻石切面的效果，cell 数量越多越碎裂
// 与 gradient 组合 → 彩色玻璃窗；与 sharpen 组合 → 宝石切面
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopOffset2D } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  cells: number;
  edgeWidth: number;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:crystal',
  type: ComponentType.TRANSFORM,
  params: {
    cells: { type: 'int', min: 6, max: 40, default: 16 },
    edgeWidth: { type: 'float', min: 0, max: 0.15, default: 0.05 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1, default: 0.3 },
  },
  create({ cells, edgeWidth, seed, animate, animMode = AnimMode.OSCILLATE }) {
    const pts: { x: number; y: number; px: number; py: number }[] = [];
    for (let i = 0; i < cells; i++) {
      pts.push({
        x: hash(i, 0, seed),
        y: hash(i, 1, seed),
        px: hash(i, 2, seed) * Math.PI * 2,
        py: hash(i, 3, seed) * Math.PI * 2,
      });
    }

    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const [offX, offY] = loopOffset2D(ctx.t, animMode, animate * 0.05, animate * 0.05);

      const animPts = pts.map(p => ({
        x: p.x + Math.sin(p.px + ctx.t * Math.PI * 2) * offX,
        y: p.y + Math.cos(p.py + ctx.t * Math.PI * 2) * offY,
      }));

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w, ny = y / h;
          let minDist = Infinity, minDist2 = Infinity;
          let closestIdx = 0;
          for (let i = 0; i < animPts.length; i++) {
            const dx = nx - animPts[i]!.x, dy = ny - animPts[i]!.y;
            const d = dx * dx + dy * dy;
            if (d < minDist) {
              minDist2 = minDist;
              minDist = d;
              closestIdx = i;
            } else if (d < minDist2) {
              minDist2 = d;
            }
          }

          const cp = animPts[closestIdx]!;
          const sx = Math.max(0, Math.min(w - 1, cp.x * w));
          const sy = Math.max(0, Math.min(h - 1, cp.y * h));
          let val = input.sample(sx, sy);

          if (edgeWidth > 0) {
            const edgeDist = Math.sqrt(minDist2) - Math.sqrt(minDist);
            if (edgeDist < edgeWidth) {
              val = val * (edgeDist / edgeWidth);
            }
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

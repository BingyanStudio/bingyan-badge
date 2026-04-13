// 碎裂变形：将画面分割为随机多边形碎片，各碎片做独立位移/旋转
// 产生玻璃碎裂或拼图散落的效果
// 与 crystal 组合 → 双层碎裂；与 edge 组合 → 裂纹网络
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  pieces: number;
  spread: number;
  rotation: number;
  seed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:fracture',
  type: ComponentType.TRANSFORM,
  params: {
    pieces: { type: 'int', min: 4, max: 30, default: 12 },
    spread: { type: 'float', min: 0.5, max: 8, default: 3 },
    rotation: { type: 'float', min: 0, max: 0.5, default: 0.15 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ pieces, spread, rotation, seed, animMode = AnimMode.OSCILLATE }) {
    // 生成碎片中心（Voronoi种子）及其运动参数
    const centers: { x: number; y: number; dx: number; dy: number; rot: number }[] = [];
    for (let i = 0; i < pieces; i++) {
      centers.push({
        x: hash(i, 0, seed),
        y: hash(i, 1, seed),
        dx: (hash(i, 2, seed) - 0.5) * 2,
        dy: (hash(i, 3, seed) - 0.5) * 2,
        rot: (hash(i, 4, seed) - 0.5) * 2,
      });
    }

    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const lv = loopValue(ctx.t, animMode);
      const spreadPx = spread * lv;
      const rotAmt = rotation * lv;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w, ny = y / h;

          // 找最近的碎片中心
          let minDist = Infinity;
          let closest = centers[0]!;
          for (const c of centers) {
            const dx = nx - c.x, dy = ny - c.y;
            const d = dx * dx + dy * dy;
            if (d < minDist) { minDist = d; closest = c; }
          }

          // 对当前像素做碎片的逆变换
          const cx = closest.x * w, cy = closest.y * h;
          const lx = x - cx, ly = y - cy;

          const cos = Math.cos(-rotAmt * closest.rot);
          const sin = Math.sin(-rotAmt * closest.rot);
          const rx = lx * cos - ly * sin;
          const ry = lx * sin + ly * cos;

          const sx = rx + cx - closest.dx * spreadPx;
          const sy = ry + cy - closest.dy * spreadPx;

          f.data[y * w + x] = input.sample(
            Math.max(0, Math.min(w - 1, sx)),
            Math.max(0, Math.min(h - 1, sy))
          );
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

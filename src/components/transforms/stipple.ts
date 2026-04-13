// 点刻：基于标量场亮度做密度调制的随机点阵
// 与 gradient 组合 → 修拉点彩派；与 threshold 组合 → 喷墨打印；与 blur 组合 → 柔焦银盐
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  density: number;
  pointSize: number;
  jitter: number;
  seed: number;
  animate: number;
}

const component: Component<P> = {
  id: 'xf:stipple',
  type: ComponentType.TRANSFORM,
  params: {
    density: { type: 'float', min: 0.3, max: 1, default: 0.7 },
    pointSize: { type: 'int', min: 1, max: 5, default: 2 },
    jitter: { type: 'float', min: 0, max: 1, default: 0.5 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1.5, default: 0.3 },
  },
  create({ density, pointSize, jitter, seed, animate }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const frame = Math.floor(ctx.t * 60 * animate);

      // 以 pointSize 为网格大小铺点
      const grid = Math.max(1, pointSize);

      for (let gy = 0; gy < h; gy += grid) {
        for (let gx = 0; gx < w; gx += grid) {
          // 网格中心的平均亮度
          let sum = 0, count = 0;
          for (let dy = 0; dy < grid && gy + dy < h; dy++) {
            for (let dx = 0; dx < grid && gx + dx < w; dx++) {
              sum += input.data[(gy + dy) * w + (gx + dx)]!;
              count++;
            }
          }
          const avgVal = count > 0 ? sum / count : 0;

          // 亮度决定是否放点（概率阈值）
          const threshold = 1 - avgVal * density;
          const rnd = hash(gx, gy, seed + frame);

          if (rnd > threshold) {
            // 计算带抖动的点中心
            const jx = jitter * (hash(gx + 1, gy, seed + frame) - 0.5) * grid;
            const jy = jitter * (hash(gx, gy + 1, seed + frame) - 0.5) * grid;
            const cx = gx + grid / 2 + jx;
            const cy = gy + grid / 2 + jy;

            // 画点（圆形）
            const radius = grid * 0.45 * (0.5 + avgVal * 0.5);
            const r2 = radius * radius;
            const minX = Math.max(0, Math.floor(cx - radius));
            const maxX = Math.min(w - 1, Math.ceil(cx + radius));
            const minY = Math.max(0, Math.floor(cy - radius));
            const maxY = Math.min(h - 1, Math.ceil(cy + radius));

            for (let py = minY; py <= maxY; py++) {
              for (let px = minX; px <= maxX; px++) {
                const dx = px - cx, dy = py - cy;
                if (dx * dx + dy * dy <= r2) {
                  f.data[py * w + px] = Math.min(1, f.data[py * w + px]! + avgVal);
                }
              }
            }
          }
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

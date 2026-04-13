// 粒子网格：规则网格上的粒子受力场驱动做周期运动，连线产生弹性网格效果
// 不同的运动模式产生从有序到混沌的各种网格变形
// 与 blur 组合 → 柔焦网格；与 edge+invert 组合 → 线框渲染
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  gridSize: number;
  displacement: number;
  lineWidth: number;
  dotSize: number;
  seed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:particle-grid',
  type: ComponentType.SOURCE,
  params: {
    gridSize: { type: 'int', min: 4, max: 16, default: 8 },
    displacement: { type: 'float', min: 0.1, max: 0.8, default: 0.4 },
    lineWidth: { type: 'float', min: 0.5, max: 3, default: 1.2 },
    dotSize: { type: 'float', min: 0, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ gridSize, displacement, lineWidth, dotSize, seed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2;

      // 计算每个网格顶点的偏移位置
      const cols = gridSize + 1, rows = gridSize + 1;
      const cellW = w / gridSize, cellH = h / gridSize;
      const positions: { x: number; y: number }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = c * cellW, baseY = r * cellH;
          const angle = hash(c, r, seed) * Math.PI * 2;
          const amp = hash(c, r, seed + 100) * displacement * Math.min(cellW, cellH);
          const dx = Math.sin(phase + angle) * amp;
          const dy = Math.cos(phase + angle * 1.3) * amp;
          positions.push({ x: baseX + dx, y: baseY + dy });
        }
      }

      // 绘制连线
      const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        const steps = Math.ceil(len);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = x0 + (x1 - x0) * t;
          const py = y0 + (y1 - y0) * t;
          const radius = lineWidth;
          const minX = Math.max(0, Math.floor(px - radius));
          const maxX = Math.min(w - 1, Math.ceil(px + radius));
          const minY = Math.max(0, Math.floor(py - radius));
          const maxY = Math.min(h - 1, Math.ceil(py + radius));
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
              if (dist < radius) {
                const val = 1 - dist / radius;
                const idx = y * w + x;
                f.data[idx] = Math.min(1, f.data[idx]! + val * 0.7);
              }
            }
          }
        }
      };

      // 水平连线
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = positions[r * cols + c]!, b = positions[r * cols + c + 1]!;
          drawLine(a.x, a.y, b.x, b.y);
        }
      }
      // 垂直连线
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const a = positions[r * cols + c]!, b = positions[(r + 1) * cols + c]!;
          drawLine(a.x, a.y, b.x, b.y);
        }
      }

      // 绘制节点圆点
      if (dotSize > 0) {
        for (const p of positions) {
          const radius = dotSize;
          const r2 = radius * radius;
          const minX = Math.max(0, Math.floor(p.x - radius));
          const maxX = Math.min(w - 1, Math.ceil(p.x + radius));
          const minY = Math.max(0, Math.floor(p.y - radius));
          const maxY = Math.min(h - 1, Math.ceil(p.y + radius));
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if ((x - p.x) ** 2 + (y - p.y) ** 2 < r2) {
                f.data[y * w + x] = 1;
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

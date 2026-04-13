// 利萨如曲线场：参数化 a/b/delta 产生经典的示波器曲线图案
// 不同 a:b 比值涌现截然不同的对称图形，delta 相位差控制旋转方向
// 与 blur 组合 → 荧光线条；与 halftone 组合 → 科技感网点；与 contour 组合 → 等高线环
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  freqA: number;
  freqB: number;
  delta: number;
  thickness: number;
  decay: number;
  trailCount: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:lissajous',
  type: ComponentType.SOURCE,
  params: {
    freqA: { type: 'int', min: 1, max: 7, default: 3 },
    freqB: { type: 'int', min: 1, max: 7, default: 2 },
    delta: { type: 'float', min: 0, max: 6.28, default: 1.57 },
    thickness: { type: 'float', min: 0.01, max: 0.08, default: 0.03 },
    decay: { type: 'float', min: 0.3, max: 0.95, default: 0.7 },
    trailCount: { type: 'int', min: 20, max: 120, default: 60 },
  },
  create({ freqA, freqB, delta, thickness, decay, trailCount, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2;

      // 沿曲线采样点，每个点向周围像素贡献亮度
      const cx = w / 2, cy = h / 2;
      const scaleX = w * 0.4, scaleY = h * 0.4;
      const thickPx = thickness * w;
      const thickSq = thickPx * thickPx;

      for (let i = 0; i < trailCount; i++) {
        const trailT = i / trailCount;
        const param = trailT * Math.PI * 2;
        const px = cx + Math.sin(freqA * param + phase + delta) * scaleX;
        const py = cy + Math.sin(freqB * param + phase) * scaleY;
        const brightness = Math.pow(decay, (1 - trailT) * 3);

        const minX = Math.max(0, Math.floor(px - thickPx * 2));
        const maxX = Math.min(w - 1, Math.ceil(px + thickPx * 2));
        const minY = Math.max(0, Math.floor(py - thickPx * 2));
        const maxY = Math.min(h - 1, Math.ceil(py + thickPx * 2));

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dx = x - px, dy = y - py;
            const distSq = dx * dx + dy * dy;
            if (distSq < thickSq * 4) {
              const val = brightness * Math.exp(-distSq / (2 * thickSq));
              const idx = y * w + x;
              f.data[idx] = Math.min(1, f.data[idx]! + val);
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

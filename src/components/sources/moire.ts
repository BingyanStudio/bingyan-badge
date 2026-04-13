// Moiré 干涉图案：多组同心环/线条叠加产生的干涉条纹
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode, loopOffset2D } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { layers: number; baseFreq: number; drift: number; seed: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'src:moire',
  type: ComponentType.SOURCE,
  params: {
    layers: { type: 'int', min: 2, max: 5, default: 3 },
    baseFreq: { type: 'float', min: 8, max: 40, default: 20 },
    drift: { type: 'float', min: 0.05, max: 0.3, default: 0.15 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ layers, baseFreq, drift, seed, animMode = AnimMode.OSCILLATE }) {
    const centers: { cx: number; cy: number; freq: number; phase: number }[] = [];
    let s = seed;
    for (let i = 0; i < layers; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const cx = 0.3 + (s % 1000) / 1000 * 0.4;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const cy = 0.3 + (s % 1000) / 1000 * 0.4;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const freq = baseFreq * (0.8 + (s % 1000) / 1000 * 0.4);
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const phase = (s % 1000) / 1000 * Math.PI * 2;
      centers.push({ cx, cy, freq, phase });
    }

    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      // 时间相位用于波纹推进（始终使用 2πt 保证循环）
      const ta = ctx.t * Math.PI * 2;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let val = 0;
          for (const c of centers) {
            // 中心漂移使用 animMode 控制运动轨迹
            const [driftX, driftY] = loopOffset2D(
              (ctx.t + c.phase / (Math.PI * 2)) % 1,
              animMode,
              drift,
              drift
            );
            const dx = x / w - c.cx - driftX;
            const dy = y / h - c.cy - driftY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            val += 0.5 + 0.5 * Math.sin(dist * c.freq + ta);
          }
          f.data[y * w + x] = (val / layers) % 1;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

// 波干涉场：多个点波源发射同心波，波的叠加产生干涉图案
// 不同波源数量和频率组合涌现出从简单条纹到复杂晶格的多种形态
// 与 threshold 组合 → 二值化干涉带；与 posterize 组合 → 等高地形
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  emitters: number;
  freq: number;
  damping: number;
  seed: number;
  speed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:wave-interference',
  type: ComponentType.SOURCE,
  params: {
    emitters: { type: 'int', min: 2, max: 8, default: 4 },
    freq: { type: 'float', min: 8, max: 50, default: 20 },
    damping: { type: 'float', min: 0, max: 0.5, default: 0.15 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    speed: { type: 'float', min: 0.5, max: 2, default: 1 },
  },
  create({ emitters, freq, damping, seed, speed, animMode = AnimMode.OSCILLATE }) {
    // 预计算发射源位置
    const sources: { cx: number; cy: number; phaseOff: number; freqMul: number }[] = [];
    for (let i = 0; i < emitters; i++) {
      sources.push({
        cx: hash(i, 0, seed) * 0.6 + 0.2,
        cy: hash(i, 1, seed) * 0.6 + 0.2,
        phaseOff: hash(i, 2, seed) * Math.PI * 2,
        freqMul: 0.8 + hash(i, 3, seed) * 0.4,
      });
    }

    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * speed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let val = 0;
          const nx = x / w, ny = y / h;
          for (const src of sources) {
            const dx = nx - src.cx, dy = ny - src.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const amplitude = Math.exp(-dist * damping * 10);
            val += amplitude * Math.sin(dist * freq * src.freqMul + phase + src.phaseOff);
          }
          f.data[y * w + x] = val / emitters * 0.5 + 0.5;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

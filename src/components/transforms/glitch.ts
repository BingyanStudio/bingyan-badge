import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { intensity: number; speed: number; seed: number; }

const component: Component<P> = {
  id: 'xf:glitch',
  type: ComponentType.TRANSFORM,
  params: {
    intensity: { type: 'float', min: 2, max: 20, default: 8 },
    speed: { type: 'float', min: 1, max: 4, default: 2 },
    seed: { type: 'int', min: 0, max: 9999, default: 42 },
  },
  create({ intensity, speed, seed }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      // 每帧用时间+种子生成不同的行偏移模式
      const frame = Math.floor(ctx.t * 60 * speed) % 60;
      for (let y = 0; y < h; y++) {
        // 每行有独立的随机偏移量，但只有部分行被激活
        const rowHash = hash(y, frame, seed);
        const active = rowHash > 0.7; // ~30% 的行发生偏移
        const shift = active ? Math.floor((hash(y, frame, seed + 100) - 0.5) * 2 * intensity) : 0;
        for (let x = 0; x < w; x++) {
          const sx = Math.max(0, Math.min(w - 1, x + shift));
          f.data[y * w + x] = input.data[y * w + sx]!;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

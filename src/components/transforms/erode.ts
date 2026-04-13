// 形态学侵蚀/膨胀：收缩或扩张场中的亮区
// 与 threshold 组合可做出手绘描边效果；与 blur 组合可做柔和的光晕
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { radius: number; mode: string; }

const component: Component<P> = {
  id: 'xf:erode',
  type: ComponentType.TRANSFORM,
  params: {
    radius: { type: 'int', min: 1, max: 4, default: 1 },
    mode: { type: 'enum', options: ['erode', 'dilate'], default: 'erode' },
  },
  create({ radius, mode }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const isDilate = mode === 'dilate';
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let val = isDilate ? 0 : 1;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (dx * dx + dy * dy > radius * radius) continue;
              const nx = Math.max(0, Math.min(w - 1, x + dx));
              const ny = Math.max(0, Math.min(h - 1, y + dy));
              const s = input.data[ny * w + nx]!;
              val = isDilate ? Math.max(val, s) : Math.min(val, s);
            }
          }
          f.data[y * w + x] = val;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

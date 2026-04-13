// 笔触涂抹：沿流场方向对标量场做定向模糊
// 与 sharpen 组合 → 厚涂质感；与 posterize 组合 → 木版画；与 grain 组合 → 炭笔素描
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  length: number;
  curvature: number;
  density: number;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:brush-stroke',
  type: ComponentType.TRANSFORM,
  params: {
    length: { type: 'int', min: 3, max: 16, default: 8 },
    curvature: { type: 'float', min: 0.5, max: 4, default: 2 },
    density: { type: 'int', min: 4, max: 20, default: 10 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1.5, default: 0.5 },
  },
  create({ length, curvature, density, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      // 流向角度偏移：FORWARD 模式让笔触方向持续旋转，OSCILLATE 来回
      const phase = ctx.t * Math.PI * 2 * animate;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;

          const angle = fbm(x / w * curvature, y / h * curvature, 3, seed) * Math.PI * 2 + phase;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);

          let sum = 0;
          let count = 0;
          for (let s = -density; s <= density; s++) {
            const t = s / density;
            const sx = x + dx * t * length;
            const sy = y + dy * t * length;

            const weight = 1 - Math.abs(t);
            sum += input.sample(sx, sy) * weight;
            count += weight;
          }

          f.data[i] = count > 0 ? sum / count : input.data[i]!;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

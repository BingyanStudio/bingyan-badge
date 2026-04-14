// Domain Warping：用噪声扭曲采样坐标，再用扭曲后的坐标采样另一层噪声
// 这是程序化纹理中最能产生有机、流动感图案的技术
// 参考 Inigo Quilez 的 "warping" 文章
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, AnimMode, loopOffset2D } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { scale: number; warpStrength: number; iterations: number; seed: number; animate: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'src:domain-warp',
  type: ComponentType.SOURCE,
  params: {
    scale: { type: 'float', min: 1.5, max: 6, default: 3 },
    warpStrength: { type: 'float', min: 0.5, max: 3, default: 1.5 },
    iterations: { type: 'int', min: 1, max: 3, default: 2 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0.3, max: 1.5, default: 1 },
  },
  create({ scale, warpStrength, iterations, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const [ta, tb] = loopOffset2D(ctx.t, animMode, animate, animate);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let px = x / w * scale;
          let py = y / h * scale;

          for (let it = 0; it < iterations; it++) {
            const ox = fbm(px + ta, py + 1.7 * it, 3, seed + it * 100) * warpStrength;
            const oy = fbm(px + 5.2 * it + tb, py, 3, seed + it * 100 + 50) * warpStrength;
            px += ox;
            py += oy;
          }

          f.data[y * w + x] = fbm(px, py, 3, seed + 999);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

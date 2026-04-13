// 反应扩散（Gray-Scott 模型）：产生图灵斑纹——有机的斑点、条纹、迷宫图案
// 不同 feed/kill 参数区间涌现出截然不同的形态
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { hash } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  feed: number;
  kill: number;
  scale: number;
  steps: number;
  seed: number;
}

const component: Component<P> = {
  id: 'src:reaction-diffusion',
  type: ComponentType.SOURCE,
  params: {
    feed: { type: 'float', min: 0.02, max: 0.07, default: 0.04 },
    kill: { type: 'float', min: 0.04, max: 0.07, default: 0.06 },
    scale: { type: 'int', min: 2, max: 4, default: 3 },
    steps: { type: 'int', min: 10, max: 40, default: 20 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
  },
  create({ feed, kill, scale, steps, seed }) {
    // downscale simulation for performance
    let cachedW = 0, cachedH = 0;
    let u: Float32Array | null = null;
    let v: Float32Array | null = null;

    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const sw = Math.ceil(w / scale), sh = Math.ceil(h / scale);

      if (sw !== cachedW || sh !== cachedH) {
        cachedW = sw; cachedH = sh;
        u = new Float32Array(sw * sh).fill(1);
        v = new Float32Array(sw * sh).fill(0);
        // seed initial perturbation
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (hash(x, y, seed) > 0.85) {
              v![y * sw + x] = 1;
              u![y * sw + x] = 0.5;
            }
          }
        }
      }

      const Du = 0.2, Dv = 0.1;
      const dt = 1.0;
      const feedAnim = feed + Math.sin(ctx.t * Math.PI * 2) * 0.003;
      const nu = new Float32Array(sw * sh);
      const nv = new Float32Array(sw * sh);

      for (let s = 0; s < steps; s++) {
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const i = y * sw + x;
            const xp = (x + 1) % sw, xm = (x - 1 + sw) % sw;
            const yp = (y + 1) % sh, ym = (y - 1 + sh) % sh;
            const lapU = u![y * sw + xp]! + u![y * sw + xm]! + u![yp * sw + x]! + u![ym * sw + x]! - 4 * u![i]!;
            const lapV = v![y * sw + xp]! + v![y * sw + xm]! + v![yp * sw + x]! + v![ym * sw + x]! - 4 * v![i]!;
            const uvv = u![i]! * v![i]! * v![i]!;
            nu[i] = u![i]! + dt * (Du * lapU - uvv + feedAnim * (1 - u![i]!));
            nv[i] = v![i]! + dt * (Dv * lapV + uvv - (feedAnim + kill) * v![i]!);
          }
        }
        u!.set(nu);
        v!.set(nv);
      }

      // upsample to output
      const f = new ScalarField(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = (x / scale), sy = (y / scale);
          const x0 = Math.floor(sx), y0 = Math.floor(sy);
          const fx = sx - x0, fy = sy - y0;
          const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
          f.data[y * w + x] =
            v![y0 * sw + x0]! * (1 - fx) * (1 - fy) +
            v![y0 * sw + x1]! * fx * (1 - fy) +
            v![y1 * sw + x0]! * (1 - fx) * fy +
            v![y1 * sw + x1]! * fx * fy;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

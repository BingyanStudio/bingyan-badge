// 流场笔触：模拟画笔沿流场方向绘制的笔触线条
// 通过在噪声场上做粒子积分（line integral convolution 简化版）产生丝滑的流线纹理
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, hash, AnimMode, loopOffset2D } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  scale: number;
  length: number;
  density: number;
  seed: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:flow-field',
  type: ComponentType.SOURCE,
  params: {
    scale: { type: 'float', min: 2, max: 8, default: 4 },
    length: { type: 'int', min: 8, max: 30, default: 16 },
    density: { type: 'float', min: 0.3, max: 1, default: 0.6 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0.3, max: 1.5, default: 1 },
  },
  create({ scale, length, density, seed, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const [offX, offY] = loopOffset2D(ctx.t, animMode, 0.3 * animate, 0.3 * animate);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (hash(x, y, seed + 7) > density) {
            f.data[y * w + x] = fbm(x / w * scale, y / h * scale, 3, seed);
            continue;
          }

          let accum = 0;
          let px = x / w * scale, py = y / h * scale;

          for (let s = 0; s < length; s++) {
            const angle = fbm(px + offX, py + offY, 3, seed) * Math.PI * 2;
            accum += hash(Math.floor(px * 50), Math.floor(py * 50), seed + 500);
            px += Math.cos(angle) * 0.04;
            py += Math.sin(angle) * 0.04;
          }
          f.data[y * w + x] = (accum / length) % 1;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

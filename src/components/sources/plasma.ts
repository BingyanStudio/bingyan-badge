// 等离子体纹理：多个正弦函数叠加产生的流动彩色图案
// plasma 的动画天然是前进式的（sin(x + t) 中 t 线性递增即可循环），
// 但通过 animMode 可选择不同的时间函数来产生不同运动质感
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { complexity: number; speed: number; scale: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'src:plasma',
  type: ComponentType.SOURCE,
  params: {
    complexity: { type: 'int', min: 3, max: 7, default: 5 },
    speed: { type: 'float', min: 0.5, max: 1.5, default: 1 },
    scale: { type: 'float', min: 2, max: 8, default: 4 },
  },
  create({ complexity, speed, scale, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      // plasma 的各 sin 项本身就以 t 做相位推进，天然循环
      // 不同 animMode 改变"时间感"：FORWARD 匀速，OSCILLATE 来回，TRIANGLE 匀速来回
      const t = ctx.t * Math.PI * 2 * speed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w * scale, ny = y / h * scale;
          let val = 0;
          val += Math.sin(nx * 1.5 + t);
          val += Math.sin(ny * 2.0 - t * 0.7);
          val += Math.sin((nx + ny) * 1.2 + t * 0.5);
          val += Math.sin(Math.sqrt(nx * nx + ny * ny) * 2.5 - t * 1.3);
          for (let c = 4; c < complexity; c++) {
            val += Math.sin((nx * (c * 0.7) + ny * (c * 0.3)) + t * (c % 2 === 0 ? 0.8 : -0.6)) * (1 / c);
          }
          f.data[y * w + x] = val / (4 + (complexity - 4) * 0.3) * 0.5 + 0.5;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

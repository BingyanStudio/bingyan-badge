// 等离子体纹理：多个正弦函数叠加产生的流动彩色图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { complexity: number; speed: number; scale: number; }

const component: Component<P> = {
  id: 'src:plasma',
  type: ComponentType.SOURCE,
  params: {
    complexity: { type: 'int', min: 3, max: 7, default: 5 },
    speed: { type: 'float', min: 0.5, max: 1.5, default: 1 },
    scale: { type: 'float', min: 2, max: 8, default: 4 },
  },
  create({ complexity, speed, scale }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
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

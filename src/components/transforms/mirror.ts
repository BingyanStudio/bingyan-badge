// 镜像/对称变换：沿指定轴镜像场
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { axis: string; }

const component: Component<P> = {
  id: 'xf:mirror',
  type: ComponentType.TRANSFORM,
  params: {
    axis: { type: 'enum', options: ['horizontal', 'vertical', 'diagonal', 'quad'], default: 'horizontal' },
  },
  create({ axis }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx = x, sy = y;
          switch (axis) {
            case 'horizontal': sx = x < w / 2 ? x : w - 1 - x; break;
            case 'vertical': sy = y < h / 2 ? y : h - 1 - y; break;
            case 'diagonal':
              if (x + y > w) { sx = w - 1 - y; sy = h - 1 - x; }
              break;
            case 'quad':
              sx = x < w / 2 ? x : w - 1 - x;
              sy = y < h / 2 ? y : h - 1 - y;
              break;
          }
          f.data[y * w + x] = input.get(sx, sy);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

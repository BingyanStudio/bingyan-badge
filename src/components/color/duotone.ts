// 双色调映射：将标量场映射到两种颜色之间的渐变
// 与 threshold 组合产生高对比海报效果；与 blur 组合产生柔和水彩双色
import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { hslToRgb } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { hDark: number; hLight: number; sDark: number; sLight: number; contrast: number; }

const component: Component<P> = {
  id: 'col:duotone',
  type: ComponentType.COLOR,
  params: {
    hDark: { type: 'float', min: 0, max: 1, default: 0.6 },
    hLight: { type: 'float', min: 0, max: 1, default: 0.1 },
    sDark: { type: 'float', min: 0.2, max: 1, default: 0.7 },
    sLight: { type: 'float', min: 0.2, max: 1, default: 0.8 },
    contrast: { type: 'float', min: 0.5, max: 2, default: 1 },
  },
  create({ hDark, hLight, sDark, sLight, contrast }) {
    const [dr, dg, db] = hslToRgb(hDark, sDark, 0.15);
    const [lr, lg, lb] = hslToRgb(hLight, sLight, 0.85);

    return (_ctx: PipelineContext, input: ScalarField) => {
      const c = new ColorField(input.width, input.height);
      for (let i = 0; i < input.data.length; i++) {
        // apply contrast curve
        let v = input.data[i]!;
        v = 0.5 + (v - 0.5) * contrast;
        v = Math.max(0, Math.min(1, v));
        c.r[i] = dr + (lr - dr) * v;
        c.g[i] = dg + (lg - dg) * v;
        c.b[i] = db + (lb - db) * v;
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

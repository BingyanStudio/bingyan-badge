// 调色板映射：将标量场量化到 N 种预设颜色，产生限色/像素艺术风格
// 与 posterize 组合产生复古游戏机感；与 grain 组合产生仿胶片效果
import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { hslToRgb } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { colors: number; hueBase: number; hueSpread: number; saturation: number; }

const component: Component<P> = {
  id: 'col:palette',
  type: ComponentType.COLOR,
  params: {
    colors: { type: 'int', min: 2, max: 8, default: 4 },
    hueBase: { type: 'float', min: 0, max: 1, default: 0.5 },
    hueSpread: { type: 'float', min: 0.05, max: 0.5, default: 0.15 },
    saturation: { type: 'float', min: 0.2, max: 1, default: 0.6 },
  },
  create({ colors, hueBase, hueSpread, saturation }) {
    // pre-compute palette
    const palette: [number, number, number][] = [];
    for (let i = 0; i < colors; i++) {
      const t = i / (colors - 1);
      const h = ((hueBase + (t - 0.5) * hueSpread) % 1 + 1) % 1;
      const l = 0.15 + t * 0.65;
      palette.push(hslToRgb(h, saturation, l));
    }

    return (_ctx: PipelineContext, input: ScalarField) => {
      const c = new ColorField(input.width, input.height);
      for (let i = 0; i < input.data.length; i++) {
        const v = Math.max(0, Math.min(1, input.data[i]!));
        const idx = Math.min(colors - 1, Math.floor(v * colors));
        const [r, g, b] = palette[idx]!;
        c.r[i] = r;
        c.g[i] = g;
        c.b[i] = b;
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

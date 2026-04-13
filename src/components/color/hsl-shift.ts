import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { hslToRgb, rgbToHsl } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { hShift: number; sMul: number; lMul: number; hSpeed: number; }

const component: Component<P> = {
  id: 'col:hsl-shift',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    hShift: { type: 'float', min: 0, max: 1, default: 0 },
    sMul: { type: 'float', min: 0.3, max: 2, default: 1 },
    lMul: { type: 'float', min: 0.3, max: 2, default: 1 },
    hSpeed: { type: 'float', min: 0, max: 3, default: 0 },
  },
  create({ hShift, sMul, lMul, hSpeed }) {
    return (ctx: PipelineContext, input: ColorField, modulator?: ScalarField) => {
      const shift = hShift + ctx.t * hSpeed;
      const c = new ColorField(input.width, input.height);
      for (let i = 0; i < input.r.length; i++) {
        let [h, s, l] = rgbToHsl(input.r[i]!, input.g[i]!, input.b[i]!);
        h = ((h + shift + (modulator ? modulator.data[i]! * 0.3 : 0)) % 1 + 1) % 1;
        s = Math.max(0, Math.min(1, s * sMul));
        l = Math.max(0, Math.min(1, l * lMul));
        const [r, g, b] = hslToRgb(h, s, l);
        c.r[i] = r; c.g[i] = g; c.b[i] = b;
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

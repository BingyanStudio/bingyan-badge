import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { hslToRgb, rgbToHsl, AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { hShift: number; sMul: number; lMul: number; hSpeed: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'col:hsl-shift',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    hShift: { type: 'float', min: 0, max: 0.15, default: 0 },
    sMul: { type: 'float', min: 0.7, max: 1.4, default: 1 },
    lMul: { type: 'float', min: 0.7, max: 1.3, default: 1 },
    hSpeed: { type: 'float', min: 0, max: 0.4, default: 0 },
  },
  create({ hShift, sMul, lMul, hSpeed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ColorField, modulator?: ScalarField) => {
      const shift = hShift + loopValue(ctx.t, animMode) * hSpeed * 0.5;
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

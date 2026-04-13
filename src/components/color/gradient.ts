import { registry } from '../../core/registry.js';
import { ScalarField, ColorField } from '../../core/fields.js';
import { hslToRgb } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

export interface GradientStop { pos: number; h: number; s: number; l: number; }
interface P { stops: GradientStop[]; }

const component: Component<P> = {
  id: 'col:gradient',
  type: ComponentType.COLOR,
  params: { stops: { type: 'stops' } },
  create({ stops }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const c = new ColorField(input.width, input.height);
      for (let i = 0; i < input.data.length; i++) {
        const v = Math.max(0, Math.min(1, input.data[i]!));
        let lo = stops[0]!, hi = stops[stops.length - 1]!;
        for (let s = 0; s < stops.length - 1; s++) {
          if (v >= stops[s]!.pos && v <= stops[s + 1]!.pos) {
            lo = stops[s]!; hi = stops[s + 1]!; break;
          }
        }
        const range = hi.pos - lo.pos || 1;
        const t = (v - lo.pos) / range;
        let dh = hi.h - lo.h;
        if (dh > 0.5) dh -= 1;
        if (dh < -0.5) dh += 1;
        const [r, g, b] = hslToRgb(((lo.h + dh * t) % 1 + 1) % 1, lo.s + (hi.s - lo.s) * t, lo.l + (hi.l - lo.l) * t);
        c.r[i] = r; c.g[i] = g; c.b[i] = b;
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

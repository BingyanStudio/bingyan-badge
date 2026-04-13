import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { strength: number; radius: number; softness: number; }

const component: Component<P> = {
  id: 'col:vignette',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    strength: { type: 'float', min: 0.2, max: 0.8, default: 0.4 },
    radius: { type: 'float', min: 0.3, max: 0.9, default: 0.6 },
    softness: { type: 'float', min: 0.5, max: 3, default: 1.5 },
  },
  create({ strength, radius, softness }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const c = new ColorField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const dx = (x - cx) / maxR, dy = (y - cy) / maxR;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const falloff = Math.max(0, (dist - radius) / (1 - radius));
          const darken = 1 - strength * Math.pow(Math.min(1, falloff), softness);
          c.r[i] = input.r[i]! * darken;
          c.g[i] = input.g[i]! * darken;
          c.b[i] = input.b[i]! * darken;
        }
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

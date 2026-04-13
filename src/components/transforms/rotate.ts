// 旋转扭曲：以画面中心为轴做角度偏移，离中心越远扭曲越大
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { twist: number; animate: number; }

const component: Component<P> = {
  id: 'xf:rotate',
  type: ComponentType.TRANSFORM,
  params: {
    twist: { type: 'float', min: 0.5, max: 6, default: 2 },
    animate: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ twist, animate }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      const baseAngle = ctx.t * Math.PI * 2 * animate;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx, dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy) / maxR;
          const angle = Math.atan2(dy, dx) - twist * r + baseAngle;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const sx = cx + Math.cos(angle) * dist;
          const sy = cy + Math.sin(angle) * dist;
          f.data[y * w + x] = input.sample(sx, sy);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

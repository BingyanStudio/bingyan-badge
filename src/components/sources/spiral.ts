// 螺旋图案：从中心向外的螺旋臂
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { arms: number; tightness: number; thickness: number; }

const component: Component<P> = {
  id: 'src:spiral',
  type: ComponentType.SOURCE,
  params: {
    arms: { type: 'int', min: 1, max: 8, default: 3 },
    tightness: { type: 'float', min: 2, max: 12, default: 5 },
    thickness: { type: 'float', min: 0.3, max: 0.8, default: 0.5 },
  },
  create({ arms, tightness, thickness }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      const rotation = ctx.t * Math.PI * 2;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx, dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy) / maxR;
          const angle = Math.atan2(dy, dx) + rotation;
          const spiral = (angle * arms / (Math.PI * 2) + r * tightness) % 1;
          const v = 0.5 + 0.5 * Math.sin(spiral * Math.PI * 2);
          // 中心淡化
          const fade = Math.min(1, r * 3);
          f.data[y * w + x] = v * thickness + (1 - thickness) * r * fade;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

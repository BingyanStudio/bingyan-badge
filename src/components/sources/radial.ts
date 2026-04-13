// 径向场：从 path 中心辐射，可用于背景径向渐变
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component = {
  id: 'src:radial',
  type: ComponentType.SOURCE,
  params: {},
  create() {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          f.data[y * w + x] = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

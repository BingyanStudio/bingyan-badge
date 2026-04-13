import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { offset: number; angle: number; animate: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'col:chromatic',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    offset: { type: 'float', min: 0.3, max: 1.5, default: 1 },
    angle: { type: 'float', min: 0, max: 6.28, default: 0 },
    animate: { type: 'float', min: 0, max: 1, default: 1 },
  },
  create({ offset, angle, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const c = new ColorField(w, h);
      // 色差旋转方向始终前进（天然循环），不受 animMode 影响
      const a = angle + ctx.t * Math.PI * 2 * animate;
      const dx = Math.cos(a) * offset;
      const dy = Math.sin(a) * offset;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const rxf = x + dx, ryf = y + dy;
          const bxf = x - dx, byf = y - dy;

          const rx0 = Math.floor(rxf), ry0 = Math.floor(ryf);
          const rfx = rxf - rx0, rfy = ryf - ry0;
          c.r[i] = sampleChannel(input.r, w, h, rx0, ry0, rfx, rfy);

          c.g[i] = input.g[i]!;

          const bx0 = Math.floor(bxf), by0 = Math.floor(byf);
          const bfx = bxf - bx0, bfy = byf - by0;
          c.b[i] = sampleChannel(input.b, w, h, bx0, by0, bfx, bfy);
        }
      }
      return c;
    };
  },
};

function sampleChannel(ch: Float32Array, w: number, h: number, x0: number, y0: number, fx: number, fy: number): number {
  const g = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return ch[y * w + x]!;
  };
  return g(x0, y0) * (1 - fx) * (1 - fy)
    + g(x0 + 1, y0) * fx * (1 - fy)
    + g(x0, y0 + 1) * (1 - fx) * fy
    + g(x0 + 1, y0 + 1) * fx * fy;
}

registry.register(component);
export default component;

// 极坐标变换：在笛卡尔坐标和极坐标之间转换，产生旋涡/放射效果
// direction=to-polar 将直线纹理卷成圆环，direction=from-polar 将圆环展开
// 与 tile 组合 → 隧道效果；与 scan-lines 组合 → 唱片纹理
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { direction: string; twist: number; }

const component: Component<P> = {
  id: 'xf:polar',
  type: ComponentType.TRANSFORM,
  params: {
    direction: { type: 'enum', options: ['to-polar', 'from-polar'], default: 'to-polar' },
    twist: { type: 'float', min: 0, max: 3, default: 0 },
  },
  create({ direction, twist }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      const twistPhase = ctx.t * Math.PI * 2 * twist;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx: number, sy: number;

          if (direction === 'to-polar') {
            // 像素 (x,y) → 极坐标 (r, θ) → 映射回 (u, v) 采样
            const dx = x - cx, dy = y - cy;
            const r = Math.sqrt(dx * dx + dy * dy) / maxR;
            const theta = (Math.atan2(dy, dx) + Math.PI + twistPhase) / (Math.PI * 2);
            sx = ((theta % 1 + 1) % 1) * (w - 1);
            sy = r * (h - 1);
          } else {
            // 像素 (x,y) → 反极坐标 → 笛卡尔坐标采样
            const r = y / h;
            const theta = (x / w) * Math.PI * 2 + twistPhase;
            sx = cx + Math.cos(theta) * r * maxR;
            sy = cy + Math.sin(theta) * r * maxR;
          }

          f.data[y * w + x] = input.sample(
            Math.max(0, Math.min(w - 1, sx)),
            Math.max(0, Math.min(h - 1, sy))
          );
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

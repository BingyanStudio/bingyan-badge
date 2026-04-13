// 万花筒组件：以 path 中心为原点做角度对称折叠
// 将极坐标角度做 N 次对称映射，产生万花筒效果
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { fbm, voronoi } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  segments: number;   // 对称段数
  pattern: string;    // 填充纹理类型
  scale: number;
  seed: number;
  rotateSpeed: number;
  zoom: number;
}

const component: Component<P> = {
  id: 'src:kaleidoscope',
  type: ComponentType.SOURCE,
  params: {
    segments: { type: 'int', min: 3, max: 12, default: 6 },
    pattern: { type: 'enum', options: ['noise', 'voronoi', 'rings', 'spiral'], default: 'noise' },
    scale: { type: 'float', min: 1, max: 8, default: 3 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    rotateSpeed: { type: 'float', min: 0.1, max: 3, default: 0.5 },
    zoom: { type: 'float', min: 0.5, max: 3, default: 1 },
  },
  create({ segments, pattern, scale, seed, rotateSpeed, zoom }) {
    const segAngle = (Math.PI * 2) / segments;

    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const cx = w / 2, cy = h / 2;
      const rotation = ctx.t * Math.PI * 2 * rotateSpeed;
      const maxR = Math.sqrt(cx * cx + cy * cy);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx, dy = y - cy;
          let angle = Math.atan2(dy, dx) + rotation;
          const r = Math.sqrt(dx * dx + dy * dy) / maxR * zoom;

          // 万花筒折叠：将角度映射到 [0, segAngle) 内，再做镜像
          angle = ((angle % segAngle) + segAngle) % segAngle;
          if (angle > segAngle / 2) angle = segAngle - angle;

          // 用折叠后的极坐标采样纹理
          const sx = r * Math.cos(angle) * scale;
          const sy = r * Math.sin(angle) * scale;

          let val: number;
          switch (pattern) {
            case 'voronoi': {
              const v = voronoi(sx + 5, sy + 5, seed);
              val = Math.min(1, v.edge * 4);
              break;
            }
            case 'rings': {
              val = 0.5 + 0.5 * Math.sin(r * scale * 10 + ctx.t * Math.PI * 2);
              break;
            }
            case 'spiral': {
              const spiralAngle = angle + r * 8;
              val = 0.5 + 0.5 * Math.sin(spiralAngle * segments / 2 + ctx.t * Math.PI * 2 * 2);
              break;
            }
            default: { // noise
              val = fbm(sx + Math.sin(ctx.t * Math.PI * 2) * 0.5, sy + Math.cos(ctx.t * Math.PI * 2) * 0.5, 4, seed);
              break;
            }
          }
          f.data[y * w + x] = Math.max(0, Math.min(1, val));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

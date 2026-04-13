// Op Art 欧普艺术：几何错视图案，利用重复和渐变产生视觉运动幻觉
// 不同 pattern 模式涌现不同的错视效果，与 rotate/mirror 组合产生更复杂的对称性
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  pattern: string;
  freq: number;
  warpAmt: number;
  speed: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'src:op-art',
  type: ComponentType.SOURCE,
  params: {
    pattern: { type: 'enum', options: ['concentric', 'checker-warp', 'radial-lines', 'zigzag'], default: 'concentric' },
    freq: { type: 'float', min: 4, max: 30, default: 12 },
    warpAmt: { type: 'float', min: 0.1, max: 2, default: 0.8 },
    speed: { type: 'float', min: 0.3, max: 1.5, default: 1 },
  },
  create({ pattern, freq, warpAmt, speed, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext) => {
      const { width: w, height: h } = ctx.geo;
      const f = new ScalarField(w, h);
      const phase = ctx.t * Math.PI * 2 * speed;
      const cx = 0.5, cy = 0.5;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w, ny = y / h;
          const dx = nx - cx, dy = ny - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          let val: number;

          switch (pattern) {
            case 'concentric': {
              // 同心环频率随距离渐变，产生呼吸错觉
              const modFreq = freq * (1 + Math.sin(dist * 8 + phase) * warpAmt * 0.3);
              val = 0.5 + 0.5 * Math.sin(dist * modFreq + phase);
              break;
            }
            case 'checker-warp': {
              // 弯曲的棋盘格
              const warpX = nx + Math.sin(ny * freq * 0.5 + phase) * warpAmt * 0.1;
              const warpY = ny + Math.sin(nx * freq * 0.5 + phase * 0.7) * warpAmt * 0.1;
              const cx2 = Math.floor(warpX * freq), cy2 = Math.floor(warpY * freq);
              val = (cx2 + cy2) % 2 === 0 ? 1 : 0;
              break;
            }
            case 'radial-lines': {
              // 放射线条，宽度随距离调制
              const segments = Math.round(freq);
              const a = ((angle + phase * 0.2) / (Math.PI * 2) * segments + segments) % segments;
              const frac = a - Math.floor(a);
              const width = 0.5 + Math.sin(dist * freq * 0.5 + phase) * warpAmt * 0.3;
              val = frac < width ? 1 : 0;
              break;
            }
            case 'zigzag': {
              // 锯齿波纹
              const row = ny * freq;
              const zigOffset = Math.abs((row % 2) - 1) * warpAmt * 0.2;
              const col = (nx + zigOffset + Math.sin(row * Math.PI + phase) * warpAmt * 0.05) * freq;
              val = 0.5 + 0.5 * Math.sin(col * Math.PI + row * Math.PI);
              break;
            }
            default:
              val = 0.5;
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

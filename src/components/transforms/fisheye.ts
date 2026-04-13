// 鱼眼变换：球面投影产生中心膨胀或边缘压缩的镜头效果
// strength > 0 膨胀（凸透镜），< 0 收缩（凹透镜）
// 与 tile 组合 → 水晶球折射；与 pixelate 组合 → 像素球
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  strength: number;
  centerX: number;
  centerY: number;
  animate: number;
  animMode: AnimMode;
}

const component: Component<P> = {
  id: 'xf:fisheye',
  type: ComponentType.TRANSFORM,
  params: {
    strength: { type: 'float', min: -2, max: 3, default: 1.5 },
    centerX: { type: 'float', min: 0.2, max: 0.8, default: 0.5 },
    centerY: { type: 'float', min: 0.2, max: 0.8, default: 0.5 },
    animate: { type: 'float', min: 0, max: 1, default: 0.3 },
  },
  create({ strength, centerX, centerY, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const s = strength + loopValue(ctx.t, animMode) * animate;
      const cx = centerX * w, cy = centerY * h;
      const maxR = Math.min(w, h) * 0.5;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx, dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy);
          const nr = r / maxR;

          let newR: number;
          if (s > 0) {
            // 膨胀
            newR = Math.pow(nr, 1 + s) * maxR;
          } else {
            // 收缩
            newR = Math.pow(nr, 1 / (1 - s)) * maxR;
          }

          const scale = r > 0 ? newR / r : 1;
          const sx = cx + dx * scale;
          const sy = cy + dy * scale;

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

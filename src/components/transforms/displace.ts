// 通用位移：用第二个标量场作为位移图，沿任意方向偏移采样
// 比 warp（只沿法线方向）更自由，与任意 source 组合可产生不可预测的变形
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { AnimMode } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { amount: number; angle: number; animate: number; animMode: AnimMode; }

const component: Component<P> = {
  id: 'xf:displace',
  type: ComponentType.TRANSFORM,
  params: {
    amount: { type: 'float', min: 2, max: 30, default: 10 },
    angle: { type: 'float', min: 0, max: 6.28, default: 0 },
    animate: { type: 'float', min: 0, max: 2, default: 1 },
  },
  create({ amount, angle, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, base: ScalarField, map: ScalarField) => {
      const { width: w, height: h } = base;
      const f = new ScalarField(w, h);
      // 位移方向旋转：始终用 2πt 前进（天然循环），animMode 不影响旋转
      const a = angle + ctx.t * Math.PI * 2 * animate;
      const dx = Math.cos(a), dy = Math.sin(a);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const d = (map ? map.data[i]! - 0.5 : 0) * amount * 2;
          f.data[i] = base.sample(x + dx * d, y + dy * d);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

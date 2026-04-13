// 阈值化：将连续场转为二值/多值，softness 控制过渡带宽度
// 与 grain/noise 组合可做溶解效果；与 erode 组合可做描边
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { cutoff: number; softness: number; wobble: number; }

const component: Component<P> = {
  id: 'xf:threshold',
  type: ComponentType.TRANSFORM,
  params: {
    cutoff: { type: 'float', min: 0.1, max: 0.9, default: 0.5 },
    softness: { type: 'float', min: 0.01, max: 0.3, default: 0.05 },
    wobble: { type: 'float', min: 0, max: 0.3, default: 0 },
  },
  create({ cutoff, softness, wobble }) {
    return (ctx: PipelineContext, input: ScalarField) => {
      const f = new ScalarField(input.width, input.height);
      const c = cutoff + Math.sin(ctx.t * Math.PI * 2) * wobble;
      const invSoft = softness > 0.001 ? 1 / softness : 1000;
      for (let i = 0; i < input.data.length; i++) {
        const v = (input.data[i]! - c) * invSoft + 0.5;
        f.data[i] = Math.max(0, Math.min(1, v));
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

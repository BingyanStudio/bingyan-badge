// 方向光：用法线点乘光方向做漫反射，产生浮雕立体感
// 比 emboss 更物理、比 specular 更柔和，与 ao 组合产生丰富的光影层次
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { angle: number; elevation: number; wrap: number; rotateSpeed: number; }

const component: Component<P> = {
  id: 'lit:directional',
  type: ComponentType.LIGHTING,
  params: {
    angle: { type: 'float', min: 0, max: 6.28, default: 0.8 },
    elevation: { type: 'float', min: 0.1, max: 1.2, default: 0.6 },
    wrap: { type: 'float', min: 0, max: 1, default: 0.3 },
    rotateSpeed: { type: 'float', min: 0, max: 2, default: 0 },
  },
  create({ angle, elevation, wrap, rotateSpeed }) {
    return (ctx: PipelineContext) => {
      const a = angle + ctx.t * Math.PI * 2 * rotateSpeed;
      const lx = Math.cos(a) * Math.cos(elevation);
      const ly = Math.sin(a) * Math.cos(elevation);
      const { width: w, height: h, normalX, normalY, insideMask } = ctx.geo;
      const f = new ScalarField(w, h, 0.5);
      for (let i = 0; i < w * h; i++) {
        if (!insideMask[i]) continue;
        // half-Lambert wrap lighting: (dot * 0.5 + 0.5) for softer falloff
        const dot = normalX[i]! * lx + normalY[i]! * ly;
        const wrapped = (dot + wrap) / (1 + wrap);
        f.data[i] = Math.max(0, Math.min(1, wrapped));
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

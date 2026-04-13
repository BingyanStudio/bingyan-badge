// 厚涂效果：模拟颜料堆叠的浮雕质感 + 高光捕捉
// 与 brush-stroke 组合 → 油画；与 vignette 组合 → 古典肖像；与 palette 组合 → 野兽派
// 核心思路：利用颜色场的局部梯度模拟颜料厚度，产生方向性高光
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  thickness: number;
  lightAngle: number;
  specular: number;
  roughness: number;
  animate: number;
}

const component: Component<P> = {
  id: 'col:impasto',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    thickness: { type: 'float', min: 0.3, max: 2, default: 1 },
    lightAngle: { type: 'float', min: 0, max: 6.28, default: 0.8 },
    specular: { type: 'float', min: 0.1, max: 0.8, default: 0.4 },
    roughness: { type: 'float', min: 0.1, max: 1, default: 0.5 },
    animate: { type: 'float', min: 0, max: 1.5, default: 0.3 },
  },
  create({ thickness, lightAngle, specular, roughness, animate }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const c = new ColorField(w, h);

      const la = lightAngle + ctx.t * Math.PI * 2 * animate;
      const lx = Math.cos(la);
      const ly = Math.sin(la);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;

          // 用亮度场的梯度模拟颜料厚度的法线
          const lumC = input.r[i]! * 0.299 + input.g[i]! * 0.587 + input.b[i]! * 0.114;

          const ir = x < w - 1 ? i + 1 : i;
          const id = y < h - 1 ? i + w : i;

          const lumR = input.r[ir]! * 0.299 + input.g[ir]! * 0.587 + input.b[ir]! * 0.114;
          const lumD = input.r[id]! * 0.299 + input.g[id]! * 0.587 + input.b[id]! * 0.114;

          const gx = (lumR - lumC) * thickness;
          const gy = (lumD - lumC) * thickness;

          // 表面法线（从高度图近似）
          const nLen = Math.sqrt(gx * gx + gy * gy + 1);
          const nx = -gx / nLen;
          const ny = -gy / nLen;
          const nz = 1 / nLen;

          // 漫反射
          const diffuse = Math.max(0, nx * lx + ny * ly + nz * 0.5) * 0.6 + 0.4;

          // 高光（Blinn-Phong 近似）
          const hx = lx, hy = ly, hz = 1;
          const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
          const nDotH = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
          const specPow = 2 + (1 - roughness) * 30;
          const spec = specular * Math.pow(nDotH, specPow);

          c.r[i] = Math.min(1, input.r[i]! * diffuse + spec);
          c.g[i] = Math.min(1, input.g[i]! * diffuse + spec);
          c.b[i] = Math.min(1, input.b[i]! * diffuse + spec);
        }
      }
      return c;
    };
  },
};

registry.register(component);
export default component;

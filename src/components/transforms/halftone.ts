// 半调网点：将标量场转化为密度可变的圆点阵列
// 与 duotone 组合 → 波普风；与 palette 组合 → 漫画印刷感；与 rotate 组合 → 摩尔纹
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  dotSize: number;
  angle: number;
  shape: string;
  softness: number;
  animate: number;
}

const component: Component<P> = {
  id: 'xf:halftone',
  type: ComponentType.TRANSFORM,
  params: {
    dotSize: { type: 'int', min: 3, max: 12, default: 6 },
    angle: { type: 'float', min: 0, max: 3.14, default: 0.4 },
    shape: { type: 'enum', options: ['circle', 'diamond', 'line'], default: 'circle' },
    softness: { type: 'float', min: 0, max: 1, default: 0.3 },
    animate: { type: 'float', min: 0, max: 1.5, default: 0 },
  },
  create({ dotSize, angle, shape, softness, animate }) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    return (ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);
      const phaseShift = Math.sin(ctx.t * Math.PI * 2) * animate * dotSize;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const val = input.data[i]!;

          // 旋转坐标到网格空间
          const rx = cosA * x + sinA * y + phaseShift;
          const ry = -sinA * x + cosA * y;

          // 量化到网格单元中心
          const cellX = rx / dotSize;
          const cellY = ry / dotSize;
          const fracX = cellX - Math.floor(cellX) - 0.5;
          const fracY = cellY - Math.floor(cellY) - 0.5;

          // 基于输入值计算点半径（亮 → 小点，暗 → 大点）
          const radius = (1 - val) * 0.5;

          let dist: number;
          switch (shape) {
            case 'diamond':
              dist = Math.abs(fracX) + Math.abs(fracY);
              break;
            case 'line':
              dist = Math.abs(fracY);
              break;
            default: // circle
              dist = Math.sqrt(fracX * fracX + fracY * fracY);
          }

          const edge = softness > 0
            ? 1 - Math.min(1, Math.max(0, (dist - radius + softness * 0.5) / softness))
            : dist < radius ? 1 : 0;

          f.data[i] = edge;
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

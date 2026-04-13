// CMYK 彩色半调：将 RGB 各通道分别做不同角度的半调处理
// 模拟传统四色印刷的网点叠加效果，角度差异产生独特的摩尔纹
// 与 posterize 组合 → 报纸印刷；与 blur 组合 → 柔和丝网印
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { AnimMode, loopValue } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  dotSize: number;
  angleR: number;
  angleG: number;
  angleB: number;
  softness: number;
  animate: number;
  animMode: AnimMode;
}

function halftoneChannel(
  ch: Float32Array, w: number, h: number,
  dotSize: number, angle: number, softness: number, phaseShift: number,
  out: Float32Array
) {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const val = ch[i]!;
      const rx = cosA * x + sinA * y + phaseShift;
      const ry = -sinA * x + cosA * y;
      const cellX = rx / dotSize;
      const cellY = ry / dotSize;
      const fracX = cellX - Math.floor(cellX) - 0.5;
      const fracY = cellY - Math.floor(cellY) - 0.5;
      const dist = Math.sqrt(fracX * fracX + fracY * fracY);
      const radius = val * 0.5;
      const edge = softness > 0
        ? Math.min(1, Math.max(0, (radius - dist + softness * 0.3) / (softness * 0.6)))
        : dist < radius ? 1 : 0;
      out[i] = edge;
    }
  }
}

const component: Component<P> = {
  id: 'col:color-halftone',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    dotSize: { type: 'int', min: 3, max: 10, default: 5 },
    angleR: { type: 'float', min: 0, max: 1.57, default: 0.26 },
    angleG: { type: 'float', min: 0, max: 1.57, default: 0.79 },
    angleB: { type: 'float', min: 0, max: 1.57, default: 1.31 },
    softness: { type: 'float', min: 0, max: 1, default: 0.4 },
    animate: { type: 'float', min: 0, max: 1.5, default: 0 },
  },
  create({ dotSize, angleR, angleG, angleB, softness, animate, animMode = AnimMode.OSCILLATE }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;
      const c = new ColorField(w, h);
      const phaseShift = loopValue(ctx.t, animMode) * animate * dotSize;

      halftoneChannel(input.r, w, h, dotSize, angleR, softness, phaseShift, c.r);
      halftoneChannel(input.g, w, h, dotSize, angleG, softness, phaseShift * 0.7, c.g);
      halftoneChannel(input.b, w, h, dotSize, angleB, softness, phaseShift * 1.3, c.b);

      return c;
    };
  },
};

registry.register(component);
export default component;

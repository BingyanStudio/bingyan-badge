// Posterize + dither：色调分离 + 有序抖动，产生复古/像素风纹理
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { levels: number; dither: number; }

// 4x4 Bayer matrix
const BAYER = [
  0/16, 8/16, 2/16, 10/16,
  12/16, 4/16, 14/16, 6/16,
  3/16, 11/16, 1/16, 9/16,
  15/16, 7/16, 13/16, 5/16,
];

const component: Component<P> = {
  id: 'xf:posterize',
  type: ComponentType.TRANSFORM,
  params: {
    levels: { type: 'int', min: 2, max: 8, default: 4 },
    dither: { type: 'float', min: 0, max: 1, default: 0.5 },
  },
  create({ levels, dither }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const f = new ScalarField(input.width, input.height);
      for (let y = 0; y < input.height; y++) {
        for (let x = 0; x < input.width; x++) {
          const i = y * input.width + x;
          const bayerVal = BAYER[(y % 4) * 4 + (x % 4)]!;
          const v = input.data[i]! + (bayerVal - 0.5) * dither / levels;
          f.data[i] = Math.round(v * (levels - 1)) / (levels - 1);
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

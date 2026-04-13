// 平铺重复：将场在 UV 空间做 repeat/mirror，产生万花筒般的重复图案
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P { tilesX: number; tilesY: number; mode: string; }

const component: Component<P> = {
  id: 'xf:tile',
  type: ComponentType.TRANSFORM,
  params: {
    tilesX: { type: 'int', min: 2, max: 6, default: 2 },
    tilesY: { type: 'int', min: 2, max: 6, default: 2 },
    mode: { type: 'enum', options: ['repeat', 'mirror'], default: 'mirror' },
  },
  create({ tilesX, tilesY, mode }) {
    return (_ctx: PipelineContext, input: ScalarField) => {
      const { width: w, height: h } = input;
      const f = new ScalarField(w, h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let u = (x / w) * tilesX;
          let v = (y / h) * tilesY;

          if (mode === 'mirror') {
            const iu = Math.floor(u), iv = Math.floor(v);
            u = u - iu;
            v = v - iv;
            if (iu % 2 === 1) u = 1 - u;
            if (iv % 2 === 1) v = 1 - v;
          } else {
            u = ((u % 1) + 1) % 1;
            v = ((v % 1) + 1) % 1;
          }

          f.data[y * w + x] = input.sample(u * (w - 1), v * (h - 1));
        }
      }
      return f;
    };
  },
};

registry.register(component);
export default component;

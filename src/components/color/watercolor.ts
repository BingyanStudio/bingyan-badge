// 水彩效果：边缘洇染 + 颜料沉积 + 纸张纹理
// 与 blur 组合 → 水墨晕染；与 contour 组合 → 水彩线描；与 grain 组合 → 手工纸质感
// 核心思路：在颜色场上做各向异性扩散，让颜色在边界处自然渗透，然后叠加颗粒模拟纸张吸附
import { registry } from '../../core/registry.js';
import { ColorField } from '../../core/fields.js';
import { hash, fbm } from '../../core/math.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

interface P {
  bleed: number;
  pigment: number;
  paperGrain: number;
  seed: number;
  animate: number;
}

const component: Component<P> = {
  id: 'col:watercolor',
  type: ComponentType.COLOR_TRANSFORM,
  params: {
    bleed: { type: 'float', min: 0.5, max: 4, default: 2 },
    pigment: { type: 'float', min: 0.1, max: 0.8, default: 0.4 },
    paperGrain: { type: 'float', min: 0.05, max: 0.3, default: 0.12 },
    seed: { type: 'int', min: 0, max: 99999, default: 0 },
    animate: { type: 'float', min: 0, max: 1, default: 0.3 },
  },
  create({ bleed, pigment, paperGrain, seed, animate }) {
    return (ctx: PipelineContext, input: ColorField) => {
      const { width: w, height: h } = input;

      // 阶段1：各向异性扩散（沿梯度弱的方向更容易扩散 → 洇染效果）
      const spread = new ColorField(w, h);
      const radius = Math.ceil(bleed);
      const phase = Math.sin(ctx.t * Math.PI * 2) * animate;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;

          // 局部亮度梯度
          const lumC = input.r[i]! * 0.3 + input.g[i]! * 0.6 + input.b[i]! * 0.1;
          let lumR = lumC, lumD = lumC;
          if (x < w - 1) { const j = i + 1; lumR = input.r[j]! * 0.3 + input.g[j]! * 0.6 + input.b[j]! * 0.1; }
          if (y < h - 1) { const j = i + w; lumD = input.r[j]! * 0.3 + input.g[j]! * 0.6 + input.b[j]! * 0.1; }
          const gradMag = Math.abs(lumR - lumC) + Math.abs(lumD - lumC);

          // 梯度越小（平坦区域）扩散越强，梯度大（边界）扩散弱
          const diffuseStr = bleed * Math.exp(-gradMag * 8);

          // 用噪声扰动采样方向，模拟水渍不均匀
          const noiseAngle = fbm(x / w * 3 + phase, y / h * 3, 2, seed) * Math.PI * 2;
          const offsetX = Math.cos(noiseAngle) * diffuseStr;
          const offsetY = Math.sin(noiseAngle) * diffuseStr;

          // 带权采样
          let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const sx = Math.max(0, Math.min(w - 1, Math.round(x + dx + offsetX * dx / (radius || 1))));
              const sy = Math.max(0, Math.min(h - 1, Math.round(y + dy + offsetY * dy / (radius || 1))));
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > radius) continue;
              const weight = Math.exp(-dist * dist / (diffuseStr * diffuseStr + 0.1));
              const j = sy * w + sx;
              sumR += input.r[j]! * weight;
              sumG += input.g[j]! * weight;
              sumB += input.b[j]! * weight;
              sumW += weight;
            }
          }

          if (sumW > 0) {
            spread.r[i] = sumR / sumW;
            spread.g[i] = sumG / sumW;
            spread.b[i] = sumB / sumW;
          } else {
            spread.r[i] = input.r[i]!;
            spread.g[i] = input.g[i]!;
            spread.b[i] = input.b[i]!;
          }
        }
      }

      // 阶段2：颜料沉积（边缘变深）+ 纸张纹理
      const c = new ColorField(w, h);
      const frame = Math.floor(ctx.t * 30 * animate);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;

          // 边缘检测：与扩散前的差异越大说明是边缘
          const diffR = Math.abs(spread.r[i]! - input.r[i]!);
          const diffG = Math.abs(spread.g[i]! - input.g[i]!);
          const diffB = Math.abs(spread.b[i]! - input.b[i]!);
          const edgeDark = (diffR + diffG + diffB) * pigment;

          // 纸张纹理：高频噪声
          const paper = 1 - paperGrain * (hash(x, y, seed + 7777 + frame) - 0.5) * 2;

          c.r[i] = Math.max(0, Math.min(1, (spread.r[i]! - edgeDark) * paper));
          c.g[i] = Math.max(0, Math.min(1, (spread.g[i]! - edgeDark) * paper));
          c.b[i] = Math.max(0, Math.min(1, (spread.b[i]! - edgeDark) * paper));
        }
      }

      return c;
    };
  },
};

registry.register(component);
export default component;

// 渲染管线：SVG → 逐帧像素操作 → GIF 编码

import sharp from 'sharp';
import GIFEncoder from 'gif-encoder-2';
import { createRNG } from './rng.js';
import { composeEffects } from './compositor.js';

// 将 SVG 渲染为 RGBA 像素缓冲 + 形状蒙版
async function rasterizeSVG(svgBuffer, width, height) {
  const { data, info } = await sharp(svgBuffer)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 建立图标蒙版（alpha > 0 的像素属于图标）
  const mask = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * 4 + 3] > 10;
  }

  return { pixels: data, mask, width: info.width, height: info.height };
}

export async function renderBadge(svgBuffer, sha, options = {}) {
  const {
    width = 256,
    height = 256,
    frames = 30,
    delay = 50,  // ms per frame (default 20fps)
    quality = 10,
  } = options;

  // 1. 光栅化 SVG
  const { pixels: iconPixels, mask } = await rasterizeSVG(svgBuffer, width, height);

  // 2. 从 SHA 构建效果组合
  const rng = createRNG(sha);
  const effects = composeEffects(rng);

  // 3. 逐帧渲染
  const encoder = new GIFEncoder(width, height, 'neuquant', true);
  encoder.setDelay(delay);
  encoder.setRepeat(0);
  encoder.setQuality(quality);
  encoder.setTransparent(null);
  encoder.start();

  for (let f = 0; f < frames; f++) {
    const t = f / frames; // [0, 1)
    const framePixels = new Uint8ClampedArray(width * height * 4);

    // 背景层：先渲染背景
    for (const effect of effects) {
      if (effect.layer === 'background') {
        effect.fn(framePixels, width, height, t, effect.params, mask);
      }
    }

    // 图标层：先把原始图标像素复制到帧上
    for (let i = 0; i < width * height; i++) {
      if (mask[i]) {
        const idx = i * 4;
        framePixels[idx] = iconPixels[idx];
        framePixels[idx + 1] = iconPixels[idx + 1];
        framePixels[idx + 2] = iconPixels[idx + 2];
        framePixels[idx + 3] = iconPixels[idx + 3];
      }
    }

    // 图标效果
    for (const effect of effects) {
      if (effect.layer === 'icon') {
        effect.fn(framePixels, width, height, t, effect.params, mask);
      }
    }

    // 叠加层
    for (const effect of effects) {
      if (effect.layer === 'overlay') {
        effect.fn(framePixels, width, height, t, effect.params, mask);
      }
    }

    encoder.addFrame(framePixels);
  }

  encoder.finish();
  return encoder.out.getData();
}

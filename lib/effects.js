// 原子效果系统
// 每个效果是一个函数：(pixels, width, height, t, params, iconMask) => void
// pixels: Uint8ClampedArray (RGBA), t: 归一化时间 [0,1), iconMask: boolean[], params: 效果参数
//
// Noita 式涌现：效果本身简单，但组合后产生复杂行为。
// 效果分为三层：
//   - 背景层 (background): 影响背景区域
//   - 图标层 (icon): 影响图标区域的颜色/形变
//   - 叠加层 (overlay): 在最终画面上叠加粒子/光效

// ─── 颜色工具 ───

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function blendPixel(pixels, idx, r, g, b, a) {
  const srcA = a / 255;
  const dstA = pixels[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA < 0.001) return;
  pixels[idx] = (r * srcA + pixels[idx] * dstA * (1 - srcA)) / outA;
  pixels[idx + 1] = (g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA;
  pixels[idx + 2] = (b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA;
  pixels[idx + 3] = outA * 255;
}

function setPixelSafe(pixels, w, h, x, y, r, g, b, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  blendPixel(pixels, (y * w + x) * 4, r, g, b, a);
}

// Perlin-ish 噪声（简化版，足够做视觉效果）
function noise2d(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = noise2d(ix, iy), n10 = noise2d(ix + 1, iy);
  const n01 = noise2d(ix, iy + 1), n11 = noise2d(ix + 1, iy + 1);
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy;
}

function fbm(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

// ─── 背景效果 ───

export function bgSolidColor(pixels, w, h, t, params, mask) {
  const [r, g, b] = hslToRgb(params.hue, params.sat, params.lit);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) {
      const idx = i * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
}

export function bgGradientSweep(pixels, w, h, t, params, mask) {
  const angle = (params.baseAngle + t * 360 * params.sweepSpeed) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const nx = (x / w - 0.5) * cos + (y / h - 0.5) * sin + 0.5;
      const hue = (params.hue1 + (params.hue2 - params.hue1) * nx + t * 360 * params.colorSpeed) % 360;
      const [r, g, b] = hslToRgb(hue, params.sat, params.lit);
      const idx = i * 4;
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
    }
  }
}

export function bgPlasma(pixels, w, h, t, params, mask) {
  const speed = params.speed || 1;
  const scale = params.scale || 3;
  const phase = t * Math.PI * 2 * speed;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const nx = x / w * scale, ny = y / h * scale;
      const v1 = Math.sin(nx * 2 + phase);
      const v2 = Math.sin(ny * 3 - phase * 0.7);
      const v3 = Math.sin((nx + ny) * 1.5 + phase * 0.5);
      const v4 = Math.sin(Math.sqrt(nx * nx + ny * ny) * 3 - phase);
      const v = (v1 + v2 + v3 + v4) / 4;
      const hue = (params.hue + v * 120 + t * 60) % 360;
      const [r, g, b] = hslToRgb(hue, params.sat, 0.3 + v * 0.2);
      const idx = i * 4;
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
    }
  }
}

export function bgNebula(pixels, w, h, t, params, mask) {
  const phase = t * params.speed;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const nx = x / w * 4 + phase, ny = y / h * 4;
      const n = fbm(nx, ny, 5);
      const hue = (params.hue + n * params.hueRange) % 360;
      const lit = 0.05 + n * 0.25;
      const [r, g, b] = hslToRgb(hue, params.sat, lit);
      const idx = i * 4;
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
    }
  }
}

export function bgStarfield(pixels, w, h, t, params, mask) {
  // 先填充深色背景
  const [br, bg_, bb] = hslToRgb(params.bgHue, 0.3, 0.05);
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) continue;
    const idx = i * 4;
    pixels[idx] = br; pixels[idx + 1] = bg_; pixels[idx + 2] = bb; pixels[idx + 3] = 255;
  }
  // 散布星星
  for (let s = 0; s < params.count; s++) {
    const sx = noise2d(s * 7.13, 0.5) * w;
    const sy = noise2d(0.5, s * 11.37) * h;
    const twinkle = Math.sin(t * Math.PI * 2 * (1 + noise2d(s, s) * 3) + s) * 0.5 + 0.5;
    const brightness = twinkle * 255;
    const size = noise2d(s * 3.7, s * 1.3) > 0.7 ? 2 : 1;
    for (let dy = -size + 1; dy < size; dy++) {
      for (let dx = -size + 1; dx < size; dx++) {
        const px = Math.round(sx + dx), py = Math.round(sy + dy);
        if (px >= 0 && px < w && py >= 0 && py < h && !mask[py * w + px]) {
          const idx = (py * w + px) * 4;
          const falloff = 1 - Math.sqrt(dx * dx + dy * dy) / size;
          pixels[idx] = Math.min(255, pixels[idx] + brightness * falloff);
          pixels[idx + 1] = Math.min(255, pixels[idx + 1] + brightness * falloff);
          pixels[idx + 2] = Math.min(255, pixels[idx + 2] + brightness * falloff * 0.9);
        }
      }
    }
  }
}

// ─── 图标效果 ───

export function iconColorShift(pixels, w, h, t, params, mask) {
  const hueShift = params.hueShift + t * 360 * params.cycleSpeed;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;
    const r = pixels[idx] / 255, g = pixels[idx + 1] / 255, b = pixels[idx + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hu = 0, sa = 0;
    const li = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sa = li > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hu = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) hu = ((b - r) / d + 2) * 60;
      else hu = ((r - g) / d + 4) * 60;
    }
    const [nr, ng, nb] = hslToRgb(hu + hueShift, Math.min(1, sa + params.satBoost), li);
    pixels[idx] = nr; pixels[idx + 1] = ng; pixels[idx + 2] = nb;
  }
}

export function iconPulse(pixels, w, h, t, params, mask) {
  const pulse = Math.sin(t * Math.PI * 2 * params.freq) * 0.5 + 0.5;
  const factor = 1 + pulse * params.intensity;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;
    pixels[idx] = Math.min(255, pixels[idx] * factor);
    pixels[idx + 1] = Math.min(255, pixels[idx + 1] * factor);
    pixels[idx + 2] = Math.min(255, pixels[idx + 2] * factor);
  }
}

export function iconGlitch(pixels, w, h, t, params, mask) {
  // 水平条带错位效果，周期性触发
  const triggerPhase = (t * params.freq) % 1;
  if (triggerPhase > params.duration) return;

  const intensity = Math.sin(triggerPhase / params.duration * Math.PI) * params.maxShift;
  const bandHeight = Math.max(2, Math.floor(h * params.bandSize));
  const bandY = Math.floor(noise2d(Math.floor(t * params.freq * 10), 42) * h);

  for (let y = bandY; y < Math.min(h, bandY + bandHeight); y++) {
    const shift = Math.round(intensity * (noise2d(y * 0.1, t * 50) - 0.5) * 2);
    if (shift === 0) continue;
    const row = new Uint8Array(w * 4);
    for (let x = 0; x < w; x++) {
      const srcX = ((x - shift) % w + w) % w;
      const srcIdx = (y * w + srcX) * 4;
      const dstOff = x * 4;
      row[dstOff] = pixels[srcIdx];
      row[dstOff + 1] = pixels[srcIdx + 1];
      row[dstOff + 2] = pixels[srcIdx + 2];
      row[dstOff + 3] = pixels[srcIdx + 3];
    }
    // 色差：R通道额外偏移
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const redSrcX = ((x - Math.round(shift * 0.3)) % w + w) % w;
      pixels[idx] = row[redSrcX * 4]; // R from shifted
      pixels[idx + 1] = row[x * 4 + 1];
      pixels[idx + 2] = row[x * 4 + 2];
      pixels[idx + 3] = row[x * 4 + 3];
    }
  }
}

export function iconScanline(pixels, w, h, t, params, mask) {
  const scanY = Math.floor((t * params.speed % 1) * h);
  const thickness = params.thickness || 3;
  for (let dy = -thickness; dy <= thickness; dy++) {
    const y = scanY + dy;
    if (y < 0 || y >= h) continue;
    const falloff = 1 - Math.abs(dy) / (thickness + 1);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (pixels[idx + 3] === 0) continue;
      const boost = params.brightness * falloff;
      pixels[idx] = Math.min(255, pixels[idx] + boost);
      pixels[idx + 1] = Math.min(255, pixels[idx + 1] + boost);
      pixels[idx + 2] = Math.min(255, pixels[idx + 2] + boost);
    }
  }
}

// ─── 叠加效果 ───

export function overlayParticles(pixels, w, h, t, params, mask) {
  const count = params.count || 30;
  for (let p = 0; p < count; p++) {
    const seed1 = noise2d(p * 5.71, 0.3);
    const seed2 = noise2d(0.7, p * 3.91);
    const lifetime = params.lifetime || 1;
    const age = ((t + seed1) % lifetime) / lifetime;

    // 粒子从图标边缘发射，向外飘散
    const startAngle = seed1 * Math.PI * 2;
    const startR = w * 0.2;
    const cx = w / 2, cy = h / 2;
    const speed = params.speed * (0.5 + seed2);
    const drift = age * speed * w;
    const px = cx + Math.cos(startAngle + age * params.spiral) * (startR + drift);
    const py = cy + Math.sin(startAngle + age * params.spiral) * (startR + drift) - age * params.rise * h;

    const alpha = (1 - age) * 255 * params.opacity;
    const size = params.size * (1 - age * 0.5);
    const [r, g, b] = hslToRgb(params.hue + seed1 * params.hueSpread, params.sat, params.lit);

    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > size) continue;
        const falloff = 1 - dist / size;
        setPixelSafe(pixels, w, h, px + dx, py + dy, r, g, b, alpha * falloff);
      }
    }
  }
}

export function overlayRing(pixels, w, h, t, params, mask) {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.max(w, h) * 0.6;
  const ringR = (t * params.speed % 1) * maxR;
  const thickness = params.thickness || 3;
  const [r, g, b] = hslToRgb(params.hue, params.sat, params.lit);
  const fadeStart = maxR * 0.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const diff = Math.abs(dist - ringR);
      if (diff > thickness) continue;
      const edgeFade = 1 - diff / thickness;
      const distanceFade = ringR > fadeStart ? 1 - (ringR - fadeStart) / (maxR - fadeStart) : 1;
      const alpha = edgeFade * distanceFade * params.opacity * 255;
      blendPixel(pixels, (y * w + x) * 4, r, g, b, alpha);
    }
  }
}

export function overlayLightning(pixels, w, h, t, params, mask) {
  // 闪电只在特定时刻闪烁
  const phase = (t * params.freq) % 1;
  if (phase > params.duration) return;

  const flash = Math.sin(phase / params.duration * Math.PI);
  const cx = w / 2, cy = h * 0.15;
  const [r, g, b] = hslToRgb(params.hue, params.sat, params.lit);

  // 生成锯齿形闪电路径
  const segments = params.segments || 8;
  const points = [{ x: cx, y: cy }];
  const targetY = cy + h * 0.7;
  for (let s = 1; s <= segments; s++) {
    const frac = s / segments;
    const jitter = (noise2d(s * 13.7, t * 100) - 0.5) * w * params.spread;
    points.push({ x: cx + jitter, y: cy + (targetY - cy) * frac });
  }

  // 绘制闪电线段
  for (let s = 0; s < points.length - 1; s++) {
    const p1 = points[s], p2 = points[s + 1];
    const steps = Math.max(1, Math.ceil(Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)));
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const px = p1.x + (p2.x - p1.x) * frac;
      const py = p1.y + (p2.y - p1.y) * frac;
      const thickness = params.thickness * (1 - s / points.length * 0.5);
      for (let dy = -thickness; dy <= thickness; dy++) {
        for (let dx = -thickness; dx <= thickness; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > thickness) continue;
          const falloff = 1 - dist / thickness;
          setPixelSafe(pixels, w, h, px + dx, py + dy, r, g, b, flash * falloff * params.opacity * 255);
        }
      }
    }
  }

  // 全局闪光
  if (flash > 0.8) {
    const flashA = (flash - 0.8) * 5 * params.flashIntensity * 255;
    for (let i = 0; i < w * h * 4; i += 4) {
      pixels[i] = Math.min(255, pixels[i] + flashA);
      pixels[i + 1] = Math.min(255, pixels[i + 1] + flashA);
      pixels[i + 2] = Math.min(255, pixels[i + 2] + flashA);
    }
  }
}

export function overlayVignette(pixels, w, h, t, params, mask) {
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const pulse = params.pulse ? Math.sin(t * Math.PI * 2 * params.pulseFreq) * 0.1 : 0;
  const strength = params.strength + pulse;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      const factor = 1 - dist * dist * strength;
      const idx = (y * w + x) * 4;
      pixels[idx] *= factor;
      pixels[idx + 1] *= factor;
      pixels[idx + 2] *= factor;
    }
  }
}

export function overlayGlow(pixels, w, h, t, params, mask) {
  const cx = w / 2, cy = h / 2;
  const pulse = Math.sin(t * Math.PI * 2 * params.pulseFreq) * 0.5 + 0.5;
  const radius = w * params.radius * (0.8 + pulse * 0.4);
  const [r, g, b] = hslToRgb(params.hue + t * params.hueSpeed, params.sat, params.lit);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      const intensity = falloff * falloff * params.opacity;
      const idx = (y * w + x) * 4;
      pixels[idx] = Math.min(255, pixels[idx] + r * intensity);
      pixels[idx + 1] = Math.min(255, pixels[idx + 1] + g * intensity);
      pixels[idx + 2] = Math.min(255, pixels[idx + 2] + b * intensity);
      if (pixels[idx + 3] < 255) pixels[idx + 3] = Math.min(255, pixels[idx + 3] + 255 * intensity);
    }
  }
}

export function overlayMatrix(pixels, w, h, t, params, mask) {
  const columns = params.columns || 16;
  const colW = w / columns;
  const [r, g, b] = hslToRgb(params.hue, params.sat, params.lit);

  for (let col = 0; col < columns; col++) {
    const speed = 0.3 + noise2d(col * 7.3, 0.5) * params.speedVariance;
    const headY = ((t * speed + noise2d(col, 42)) % 1.4 - 0.2) * h;
    const tailLen = h * params.tailLength;

    for (let y = 0; y < h; y++) {
      const dist = headY - y;
      if (dist < 0 || dist > tailLen) continue;
      const fade = 1 - dist / tailLen;
      const cx = Math.floor(col * colW + colW / 2);
      const alpha = fade * params.opacity * 255;
      // 画一个小方块模拟字符
      const charSize = Math.floor(colW * 0.6);
      const charPhase = Math.floor(y / colW);
      if (noise2d(col, charPhase) > 0.4) {
        for (let dy = 0; dy < charSize; dy++) {
          for (let dx = 0; dx < charSize; dx++) {
            if (noise2d(col * 10 + dx, charPhase * 10 + dy + t * 20) > 0.45) {
              setPixelSafe(pixels, w, h, cx + dx - charSize / 2, y + dy, r, g, b, alpha);
            }
          }
        }
      }
    }
  }
}

export function overlayFireTrail(pixels, w, h, t, params, mask) {
  const cx = w / 2, cy = h / 2;
  for (let p = 0; p < params.count; p++) {
    const angle = noise2d(p * 3.1, 0.5) * Math.PI * 2;
    const baseR = w * 0.18;
    const age = ((t * params.speed + noise2d(p, p * 2)) % 1);
    const r_ = baseR + age * w * params.spread;
    const px = cx + Math.cos(angle + age * params.twist) * r_;
    const py = cy + Math.sin(angle + age * params.twist) * r_ - age * params.rise * h;

    const life = 1 - age;
    const hue = params.hue + age * params.hueShift;
    const lit = params.lit * life;
    const [r, g, b] = hslToRgb(hue, params.sat, lit);
    const size = params.size * life;
    const alpha = life * params.opacity * 255;

    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > size) continue;
        setPixelSafe(pixels, w, h, px + dx, py + dy, r, g, b, alpha * (1 - dist / size));
      }
    }
  }
}

// ─── 效果注册表 ───

export const EFFECT_REGISTRY = {
  background: {
    solidColor: { fn: bgSolidColor, weight: 2 },
    gradientSweep: { fn: bgGradientSweep, weight: 3 },
    plasma: { fn: bgPlasma, weight: 2 },
    nebula: { fn: bgNebula, weight: 2 },
    starfield: { fn: bgStarfield, weight: 1 },
  },
  icon: {
    colorShift: { fn: iconColorShift, weight: 3 },
    pulse: { fn: iconPulse, weight: 3 },
    glitch: { fn: iconGlitch, weight: 1 },
    scanline: { fn: iconScanline, weight: 2 },
  },
  overlay: {
    particles: { fn: overlayParticles, weight: 3 },
    ring: { fn: overlayRing, weight: 2 },
    lightning: { fn: overlayLightning, weight: 1 },
    vignette: { fn: overlayVignette, weight: 3 },
    glow: { fn: overlayGlow, weight: 3 },
    matrix: { fn: overlayMatrix, weight: 1 },
    fireTrail: { fn: overlayFireTrail, weight: 2 },
  }
};

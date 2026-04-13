// 纯数学工具：噪声、颜色转换

export function hash(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return hash(ix, iy, seed) * (1 - sx) * (1 - sy)
    + hash(ix + 1, iy, seed) * sx * (1 - sy)
    + hash(ix, iy + 1, seed) * (1 - sx) * sy
    + hash(ix + 1, iy + 1, seed) * sx * sy;
}

export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 1000);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

export interface VoronoiResult { dist: number; edge: number; }

export function voronoi(x: number, y: number, seed: number): VoronoiResult {
  const ix = Math.floor(x), iy = Math.floor(y);
  let minDist = 10, minDist2 = 10;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx + hash(ix + dx, iy + dy, seed);
      const cy = iy + dy + hash(ix + dx, iy + dy, seed + 500);
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < minDist) { minDist2 = minDist; minDist = dist; }
      else if (dist < minDist2) { minDist2 = dist; }
    }
  }
  return { dist: minDist, edge: minDist2 - minDist };
}

/** h in [0,1], s in [0,1], l in [0,1] → [r,g,b] each in [0,1] */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r: number, g: number, b: number;
  const h6 = h * 6;
  if (h6 < 1) { r = c; g = x; b = 0; }
  else if (h6 < 2) { r = x; g = c; b = 0; }
  else if (h6 < 3) { r = 0; g = c; b = x; }
  else if (h6 < 4) { r = 0; g = x; b = c; }
  else if (h6 < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── 动画循环模式 ───
// 所有模式在 t ∈ [0,1) 上无缝循环，首尾帧一致

export enum AnimMode {
  /** 来回摆动: sin(2πt)，值在 [-1,1] */
  OSCILLATE = 'oscillate',
  /** 单向前进: t 线性递增，利用噪声/纹理本身的周期性循环 */
  FORWARD = 'forward',
  /** 三角波: 线性来回，比 sin 更"匀速" */
  TRIANGLE = 'triangle',
}

/** 返回 [-1, 1] 范围的循环值，不同模式运动感不同 */
export function loopValue(t: number, mode: AnimMode): number {
  const TWO_PI = Math.PI * 2;
  switch (mode) {
    case AnimMode.FORWARD:
      // 映射 [0,1) → [-1,1)，线性前进
      return t * 2 - 1;
    case AnimMode.TRIANGLE:
      // 三角波: 0→1→0→-1→0 但线性
      return t < 0.25 ? t * 4
        : t < 0.75 ? 2 - t * 4
        : t * 4 - 4;
    case AnimMode.OSCILLATE:
    default:
      return Math.sin(t * TWO_PI);
  }
}

/** 返回 [0, 1] 范围的循环值（半波） */
export function loopValue01(t: number, mode: AnimMode): number {
  return loopValue(t, mode) * 0.5 + 0.5;
}

/**
 * 返回 2D 循环偏移 [ox, oy]，各分量在 [-amplitude, amplitude] 范围
 * OSCILLATE: sin/cos 画圆 (已有行为)
 * FORWARD: 沿对角线匀速平移，利用噪声的平铺性循环
 * TRIANGLE: 三角波沿 x/y 分别偏移
 */
export function loopOffset2D(t: number, mode: AnimMode, ampX: number, ampY: number): [number, number] {
  const TWO_PI = Math.PI * 2;
  switch (mode) {
    case AnimMode.FORWARD:
      return [t * ampX, t * ampY];
    case AnimMode.TRIANGLE: {
      const vx = loopValue(t, AnimMode.TRIANGLE);
      // y 相位偏移 0.25 避免走直线
      const vy = loopValue((t + 0.25) % 1, AnimMode.TRIANGLE);
      return [vx * ampX, vy * ampY];
    }
    case AnimMode.OSCILLATE:
    default:
      return [Math.sin(t * TWO_PI) * ampX, Math.cos(t * TWO_PI) * ampY];
  }
}

// 基于种子的确定性伪随机数生成器 (xoshiro128**)
// 用 SHA hex string 初始化，保证同一 SHA 始终产生相同效果

function hashToSeeds(sha) {
  // FNV-1a hash to expand any length input into 4 independent 32-bit seeds
  const bytes = [];
  for (let i = 0; i < sha.length; i++) {
    bytes.push(sha.charCodeAt(i));
  }

  const seeds = [];
  for (let s = 0; s < 4; s++) {
    let hash = 2166136261 >>> 0;  // FNV offset basis
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i] ^ s;  // mix in seed index
      hash = Math.imul(hash, 16777619) >>> 0;  // FNV prime
    }
    // Extra mixing
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x45d9f3b) >>> 0;
    hash ^= hash >>> 16;
    seeds.push(hash);
  }
  return seeds;
}

export function createRNG(sha) {
  let [s0, s1, s2, s3] = hashToSeeds(sha);

  function rotl(x, k) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }

  function nextU32() {
    const result = (rotl((s1 * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  }

  // Warm up: discard first 20 values to decorrelate initial state
  for (let i = 0; i < 20; i++) nextU32();

  // [0, 1)
  function random() {
    return nextU32() / 4294967296;
  }

  // [min, max)
  function range(min, max) {
    return min + random() * (max - min);
  }

  // 整数 [min, max]
  function randInt(min, max) {
    return Math.floor(range(min, max + 1));
  }

  // 从数组中随机选择
  function pick(arr) {
    return arr[Math.floor(random() * arr.length)];
  }

  // 从数组中随机选择 n 个（不重复）
  function pickN(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = Math.floor(random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  // 正态分布近似（Box-Muller）
  function gaussian(mean = 0, stddev = 1) {
    const u1 = random() || 1e-10;
    const u2 = random();
    return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // 返回 [0,1) 但偏向某个值
  function biased(center, spread = 0.3) {
    return Math.max(0, Math.min(1, gaussian(center, spread)));
  }

  // 创建一个带独立状态的子RNG（分叉）
  function fork() {
    const childSha = nextU32().toString(16).padStart(8, '0') +
                     nextU32().toString(16).padStart(8, '0') +
                     nextU32().toString(16).padStart(8, '0') +
                     nextU32().toString(16).padStart(8, '0');
    return createRNG(childSha);
  }

  return { random, range, randInt, pick, pickN, gaussian, biased, fork };
}

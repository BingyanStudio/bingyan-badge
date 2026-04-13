import type { RNG } from './types.js';

function hashToSeeds(sha: string): [number, number, number, number] {
  const bytes: number[] = [];
  for (let i = 0; i < sha.length; i++) {
    bytes.push(sha.charCodeAt(i));
  }
  const seeds: number[] = [];
  for (let s = 0; s < 4; s++) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i]! ^ s;
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b) >>> 0;
    h ^= h >>> 16;
    seeds.push(h);
  }
  return seeds as [number, number, number, number];
}

export function createRNG(sha: string): RNG {
  let [s0, s1, s2, s3] = hashToSeeds(sha);

  function rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }

  function nextU32(): number {
    const result = (rotl((s1 * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3;
    s2 ^= t; s3 = rotl(s3, 11);
    return result;
  }

  for (let i = 0; i < 20; i++) nextU32();

  function random(): number {
    return nextU32() / 4294967296;
  }

  function range(min: number, max: number): number {
    return min + random() * (max - min);
  }

  function randInt(min: number, max: number): number {
    return Math.floor(range(min, max + 1));
  }

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(random() * arr.length)]!;
  }

  function pickN<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = Math.floor(random() * copy.length);
      result.push(copy.splice(idx, 1)[0]!);
    }
    return result;
  }

  function gaussian(mean = 0, stddev = 1): number {
    const u1 = random() || 1e-10;
    const u2 = random();
    return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function biased(center: number, spread = 0.3): number {
    return Math.max(0, Math.min(1, gaussian(center, spread)));
  }

  function fork(): RNG {
    const childSha = nextU32().toString(16).padStart(8, '0')
      + nextU32().toString(16).padStart(8, '0')
      + nextU32().toString(16).padStart(8, '0')
      + nextU32().toString(16).padStart(8, '0');
    return createRNG(childSha);
  }

  return { random, range, randInt, pick, pickN, gaussian, biased, fork };
}

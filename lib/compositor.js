// Noita 式效果组合器
// 从 SHA 种子确定性地选择效果组合，并为每个效果生成参数。
// 涌现性来源：
//   1. 效果之间的视觉叠加产生意料之外的结果
//   2. 参数空间足够大，组合数量爆炸式增长
//   3. 某些效果组合具有协同增强（synergy）关系

import { EFFECT_REGISTRY } from './effects.js';

// 效果间的协同关系：当两个效果同时存在时，参数会被修改
const SYNERGIES = [
  {
    requires: ['lightning', 'pulse'],
    modify: { pulse: { intensity: 1.5 } },
  },
  {
    requires: ['plasma', 'colorShift'],
    modify: { colorShift: { cycleSpeed: 2.0 } },
  },
  {
    requires: ['starfield', 'particles'],
    modify: { particles: { opacity: 0.6, hueSpread: 180 } },
  },
  {
    requires: ['glitch', 'scanline'],
    modify: { glitch: { maxShift: 1.5, freq: 3 } },
  },
  {
    requires: ['nebula', 'glow'],
    modify: { glow: { opacity: 0.4, radius: 0.6 } },
  },
  {
    requires: ['fireTrail', 'pulse'],
    modify: { fireTrail: { count: 60 }, pulse: { intensity: 0.8 } },
  },
  {
    requires: ['matrix', 'glitch'],
    modify: { matrix: { opacity: 0.6 }, glitch: { duration: 0.4 } },
  },
];

function weightedPick(rng, entries) {
  const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
  let r = rng.random() * totalWeight;
  for (const [key, val] of entries) {
    r -= val.weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function generateParams(rng, effectName) {
  const p = {};
  switch (effectName) {
    case 'solidColor':
      p.hue = rng.range(0, 360);
      p.sat = rng.range(0.4, 0.9);
      p.lit = rng.range(0.05, 0.2);
      break;
    case 'gradientSweep':
      p.hue1 = rng.range(0, 360);
      p.hue2 = (p.hue1 + rng.range(30, 180)) % 360;
      p.sat = rng.range(0.5, 1);
      p.lit = rng.range(0.1, 0.3);
      p.baseAngle = rng.range(0, 360);
      p.sweepSpeed = rng.range(0.1, 0.5);
      p.colorSpeed = rng.range(0.1, 0.4);
      break;
    case 'plasma':
      p.hue = rng.range(0, 360);
      p.sat = rng.range(0.6, 1);
      p.speed = rng.range(0.5, 2);
      p.scale = rng.range(2, 6);
      break;
    case 'nebula':
      p.hue = rng.range(0, 360);
      p.hueRange = rng.range(60, 200);
      p.sat = rng.range(0.5, 1);
      p.speed = rng.range(0.3, 1.5);
      break;
    case 'starfield':
      p.bgHue = rng.range(200, 280);
      p.count = rng.randInt(40, 120);
      break;
    case 'colorShift':
      p.hueShift = rng.range(0, 360);
      p.cycleSpeed = rng.range(0.3, 1.5);
      p.satBoost = rng.range(0, 0.3);
      break;
    case 'pulse':
      p.freq = rng.range(0.5, 3);
      p.intensity = rng.range(0.2, 0.8);
      break;
    case 'glitch':
      p.freq = rng.range(1, 4);
      p.duration = rng.range(0.1, 0.3);
      p.maxShift = rng.range(5, 20);
      p.bandSize = rng.range(0.05, 0.15);
      break;
    case 'scanline':
      p.speed = rng.range(0.5, 2);
      p.thickness = rng.randInt(2, 5);
      p.brightness = rng.range(50, 150);
      break;
    case 'particles':
      p.count = rng.randInt(15, 50);
      p.speed = rng.range(0.1, 0.4);
      p.spiral = rng.range(0, Math.PI);
      p.rise = rng.range(0, 0.15);
      p.lifetime = rng.range(0.5, 1.5);
      p.size = rng.range(1.5, 4);
      p.hue = rng.range(0, 360);
      p.hueSpread = rng.range(20, 90);
      p.sat = rng.range(0.5, 1);
      p.lit = rng.range(0.5, 0.9);
      p.opacity = rng.range(0.4, 0.9);
      break;
    case 'ring':
      p.speed = rng.range(0.3, 1.5);
      p.thickness = rng.range(2, 6);
      p.hue = rng.range(0, 360);
      p.sat = rng.range(0.5, 1);
      p.lit = rng.range(0.6, 0.9);
      p.opacity = rng.range(0.3, 0.8);
      break;
    case 'lightning':
      p.freq = rng.range(0.5, 2);
      p.duration = rng.range(0.1, 0.25);
      p.hue = rng.pick([200, 220, 240, 270, 50]); // 蓝/紫/黄
      p.sat = rng.range(0.5, 1);
      p.lit = rng.range(0.7, 1);
      p.spread = rng.range(0.1, 0.4);
      p.thickness = rng.range(1.5, 3);
      p.segments = rng.randInt(5, 12);
      p.opacity = rng.range(0.6, 1);
      p.flashIntensity = rng.range(0.05, 0.2);
      break;
    case 'vignette':
      p.strength = rng.range(0.5, 1.5);
      p.pulse = rng.random() > 0.5;
      p.pulseFreq = rng.range(0.3, 1);
      break;
    case 'glow':
      p.hue = rng.range(0, 360);
      p.hueSpeed = rng.range(10, 60);
      p.sat = rng.range(0.4, 1);
      p.lit = rng.range(0.3, 0.7);
      p.radius = rng.range(0.3, 0.5);
      p.pulseFreq = rng.range(0.5, 2);
      p.opacity = rng.range(0.1, 0.3);
      break;
    case 'matrix':
      p.columns = rng.randInt(10, 24);
      p.hue = rng.pick([120, 130, 140, 160]); // 绿色系
      p.sat = rng.range(0.7, 1);
      p.lit = rng.range(0.4, 0.7);
      p.speedVariance = rng.range(0.5, 2);
      p.tailLength = rng.range(0.3, 0.7);
      p.opacity = rng.range(0.3, 0.5);
      break;
    case 'fireTrail':
      p.count = rng.randInt(20, 50);
      p.hue = rng.pick([10, 20, 30, 40]); // 暖色
      p.hueShift = rng.range(-30, 30);
      p.sat = rng.range(0.8, 1);
      p.lit = rng.range(0.5, 0.8);
      p.size = rng.range(2, 5);
      p.speed = rng.range(0.5, 1.5);
      p.spread = rng.range(0.1, 0.3);
      p.twist = rng.range(0, Math.PI * 2);
      p.rise = rng.range(0.05, 0.2);
      p.opacity = rng.range(0.5, 0.9);
      break;
  }
  return p;
}

export function composeEffects(rng) {
  const bgEntries = Object.entries(EFFECT_REGISTRY.background);
  const iconEntries = Object.entries(EFFECT_REGISTRY.icon);
  const overlayEntries = Object.entries(EFFECT_REGISTRY.overlay);

  // 选择 1 个背景效果
  const bgName = weightedPick(rng, bgEntries);

  // 选择 1-2 个图标效果
  const iconCount = rng.randInt(1, 2);
  const iconNames = [];
  const iconPool = [...iconEntries];
  for (let i = 0; i < iconCount && iconPool.length > 0; i++) {
    const name = weightedPick(rng, iconPool);
    iconNames.push(name);
    const idx = iconPool.findIndex(([n]) => n === name);
    iconPool.splice(idx, 1);
  }

  // 选择 1-3 个叠加效果
  const overlayCount = rng.randInt(1, 3);
  const overlayNames = [];
  const overlayPool = [...overlayEntries];
  for (let i = 0; i < overlayCount && overlayPool.length > 0; i++) {
    const name = weightedPick(rng, overlayPool);
    overlayNames.push(name);
    const idx = overlayPool.findIndex(([n]) => n === name);
    overlayPool.splice(idx, 1);
  }

  // 生成参数
  const effects = [];
  const allNames = new Set([bgName, ...iconNames, ...overlayNames]);
  const paramMap = {};

  const bgParams = generateParams(rng.fork(), bgName);
  paramMap[bgName] = bgParams;
  effects.push({ layer: 'background', name: bgName, fn: EFFECT_REGISTRY.background[bgName].fn, params: bgParams });

  for (const name of iconNames) {
    const params = generateParams(rng.fork(), name);
    paramMap[name] = params;
    effects.push({ layer: 'icon', name, fn: EFFECT_REGISTRY.icon[name].fn, params });
  }

  for (const name of overlayNames) {
    const params = generateParams(rng.fork(), name);
    paramMap[name] = params;
    effects.push({ layer: 'overlay', name, fn: EFFECT_REGISTRY.overlay[name].fn, params });
  }

  // 应用协同效果
  for (const synergy of SYNERGIES) {
    if (synergy.requires.every(n => allNames.has(n))) {
      for (const [effectName, mods] of Object.entries(synergy.modify)) {
        if (paramMap[effectName]) {
          for (const [key, value] of Object.entries(mods)) {
            if (typeof value === 'number' && typeof paramMap[effectName][key] === 'number') {
              paramMap[effectName][key] *= value;
            } else {
              paramMap[effectName][key] = value;
            }
          }
        }
      }
    }
  }

  return effects;
}

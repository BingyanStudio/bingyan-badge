import GIFEncoder from 'gif-encoder-2';
import { ScalarField } from './fields.js';
import { createRNG } from './rng.js';
import { buildGeometry } from './path-engine.js';
import { buildPipeline } from './pipeline.js';
import type { RenderOptions, PipelineContext, Geometry } from './types.js';
import { TRANSPARENT_COLOR_INT } from '../components/color/compose.js';

const SVG_PATH = 'M251.79,18.48C200.36-21.32,113.1,5.3,56.89,77.94S-3.22,241.72,48.21,281.52s138.69,13.18,194.9-59.45S303.22,58.28,251.79,18.48ZM211.66,150.54C187.71,236.44,72.81,257.92,72.81,257.92l22.06-88.80S225.38,101.32,211.66,150.54Zm2.42-78.29c-16.15,46-118.67,79-118.67,79l17-79S239.52-.27,214.08,72.25Z';
const VIEW_BOX: [number, number, number, number] = [0, 0, 275.91, 300];
const TRANSFORM = { tx: -12.05, ty: 0 };

const geoCache = new Map<string, Geometry>();

export function clearGeoCache(): void {
  geoCache.clear();
}

function getGeometry(width: number, height: number): { geo: Geometry; geoCached: boolean } {
  const key = `${width}x${height}`;
  const cached = geoCache.get(key);
  if (cached) return { geo: cached, geoCached: true };

  const geo = buildGeometry(SVG_PATH, VIEW_BOX, TRANSFORM, width, height);

  if (geoCache.size > 10) {
    const oldest = geoCache.keys().next().value!;
    geoCache.delete(oldest);
  }
  geoCache.set(key, geo);
  return { geo, geoCached: false };
}

export interface RenderTiming {
  geometry: number;
  geoCached: boolean;
  pipelineBuild: number;
  pipelineFrames: number;
  pipelineAvgFrame: number;
  gifEncode: number;
  total: number;
  gifBytes: number;
  pipeline: string;
}

export interface RenderResult {
  buffer: Buffer;
  timing: RenderTiming;
}

export async function renderBadge(sha: string, options: RenderOptions = {}): Promise<RenderResult> {
  const {
    width = 256,
    height = 256,
    frames = 60,
    delay = 60,
    quality = 20,
    transparent = true,
  } = options;

  const totalStart = performance.now();

  const geoStart = performance.now();
  const { geo, geoCached } = getGeometry(width, height);
  const geometryMs = performance.now() - geoStart;

  const buildStart = performance.now();
  const rng = createRNG(sha);
  const pipeline = buildPipeline(rng);
  const pipelineBuildMs = performance.now() - buildStart;

  const framesStart = performance.now();
  const encoder = new GIFEncoder(width, height, 'neuquant', true);
  encoder.setDelay(delay);
  encoder.setRepeat(0);
  encoder.setQuality(quality);

  if (transparent) {
    encoder.setTransparent(TRANSPARENT_COLOR_INT);
  }

  encoder.start();

  const feedback: Record<string, ScalarField> = {};
  const framePixels: Uint8ClampedArray[] = [];

  for (let f = 0; f < frames; f++) {
    const ctx: PipelineContext = { geo, t: f / frames, feedback, transparent };
    framePixels.push(pipeline.execute(ctx));
  }
  const pipelineFramesMs = performance.now() - framesStart;

  const encodeStart = performance.now();
  for (const pixels of framePixels) {
    encoder.addFrame(pixels);
  }
  encoder.finish();
  const gifEncodeMs = performance.now() - encodeStart;

  const buffer = encoder.out.getData();
  const totalMs = performance.now() - totalStart;
  const desc = pipeline.desc;
  const pipelineStr = `icon=[${desc.icon.join(' > ')}] bg=[${desc.bg.join(' > ')}] mask=${desc.mask}`;

  return {
    buffer,
    timing: {
      geometry: Math.round(geometryMs),
      geoCached,
      pipelineBuild: Math.round(pipelineBuildMs),
      pipelineFrames: Math.round(pipelineFramesMs),
      pipelineAvgFrame: Math.round(pipelineFramesMs / frames),
      gifEncode: Math.round(gifEncodeMs),
      total: Math.round(totalMs),
      gifBytes: buffer.length,
      pipeline: pipelineStr,
    },
  };
}

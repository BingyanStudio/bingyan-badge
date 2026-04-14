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

function getGeometry(width: number, height: number): Geometry {
  const key = `${width}x${height}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  // path-engine 的 nonzero winding number 对此 SVG 路径足够精确，无需 sharp 光栅化校验
  const geo = buildGeometry(SVG_PATH, VIEW_BOX, TRANSFORM, width, height);

  if (geoCache.size > 10) {
    const oldest = geoCache.keys().next().value!;
    geoCache.delete(oldest);
  }
  geoCache.set(key, geo);
  return geo;
}

export async function renderBadge(sha: string, options: RenderOptions = {}): Promise<Buffer> {
  const {
    width = 256,
    height = 256,
    frames = 60,
    delay = 50,
    quality = 10,
    transparent = true,
  } = options;

  const geo = getGeometry(width, height);
  const rng = createRNG(sha);
  const pipeline = buildPipeline(rng);

  const encoder = new GIFEncoder(width, height, 'neuquant', true);
  encoder.setDelay(delay);
  encoder.setRepeat(0);
  encoder.setQuality(quality);

  if (transparent) {
    encoder.setTransparent(TRANSPARENT_COLOR_INT);
  }

  encoder.start();

  const feedback: Record<string, ScalarField> = {};

  for (let f = 0; f < frames; f++) {
    const ctx: PipelineContext = { geo, t: f / frames, feedback, transparent };
    const pixels = pipeline.execute(ctx);
    encoder.addFrame(pixels);
  }

  encoder.finish();
  return encoder.out.getData();
}

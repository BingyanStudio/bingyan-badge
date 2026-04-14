import type { Geometry, PathSegment, PathPoint, SubPathData, PixelPoint, Vec2 } from './types.js';

interface ParsedCmd { type: string; args: number[]; }

function parsePath(d: string): ParsedCmd[] {
  const cmds: ParsedCmd[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    const type = match[1]!;
    const args = match[2]!.trim()
      .replace(/,/g, ' ')
      .replace(/-/g, ' -')
      .split(/\s+/)
      .filter(s => s.length > 0)
      .map(Number);
    cmds.push({ type, args });
  }
  return cmds;
}

function cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

function cubicBezierTangent(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

function pathToSegments(cmds: ParsedCmd[]): PathSegment[][] {
  const subPaths: PathSegment[][] = [];
  let currentSub: PathSegment[] = [];
  let cur: Vec2 = { x: 0, y: 0 };
  let subStart: Vec2 = { x: 0, y: 0 };
  let lastCp: Vec2 | null = null;

  for (const cmd of cmds) {
    const { type, args } = cmd;
    const isRel = type === type.toLowerCase();
    const abs = type.toUpperCase();

    if (abs === 'M') {
      if (currentSub.length > 0) { subPaths.push(currentSub); currentSub = []; }
      let i = 0;
      while (i < args.length) {
        const x = isRel ? cur.x + args[i]! : args[i]!;
        const y = isRel ? cur.y + args[i + 1]! : args[i + 1]!;
        if (i === 0) { subStart = { x, y }; }
        else { currentSub.push({ type: 'L', from: { ...cur }, to: { x, y } }); }
        cur = { x, y };
        i += 2;
      }
      lastCp = null;
    } else if (abs === 'L') {
      let i = 0;
      while (i < args.length) {
        const x = isRel ? cur.x + args[i]! : args[i]!;
        const y = isRel ? cur.y + args[i + 1]! : args[i + 1]!;
        currentSub.push({ type: 'L', from: { ...cur }, to: { x, y } });
        cur = { x, y }; i += 2;
      }
      lastCp = null;
    } else if (abs === 'H') {
      for (const a of args) {
        const x = isRel ? cur.x + a : a;
        currentSub.push({ type: 'L', from: { ...cur }, to: { x, y: cur.y } });
        cur = { x, y: cur.y };
      }
      lastCp = null;
    } else if (abs === 'V') {
      for (const a of args) {
        const y = isRel ? cur.y + a : a;
        currentSub.push({ type: 'L', from: { ...cur }, to: { x: cur.x, y } });
        cur = { x: cur.x, y };
      }
      lastCp = null;
    } else if (abs === 'C') {
      let i = 0;
      while (i < args.length) {
        const ox = isRel ? cur.x : 0, oy = isRel ? cur.y : 0;
        const cp1: Vec2 = { x: ox + args[i]!, y: oy + args[i + 1]! };
        const cp2: Vec2 = { x: ox + args[i + 2]!, y: oy + args[i + 3]! };
        const end: Vec2 = { x: ox + args[i + 4]!, y: oy + args[i + 5]! };
        currentSub.push({ type: 'C', from: { ...cur }, cp1, cp2, to: end });
        lastCp = cp2; cur = end; i += 6;
      }
    } else if (abs === 'S') {
      let i = 0;
      while (i < args.length) {
        const ox = isRel ? cur.x : 0, oy = isRel ? cur.y : 0;
        const cp1: Vec2 = lastCp
          ? { x: 2 * cur.x - lastCp.x, y: 2 * cur.y - lastCp.y }
          : { ...cur };
        const cp2: Vec2 = { x: ox + args[i]!, y: oy + args[i + 1]! };
        const end: Vec2 = { x: ox + args[i + 2]!, y: oy + args[i + 3]! };
        currentSub.push({ type: 'C', from: { ...cur }, cp1, cp2, to: end });
        lastCp = cp2; cur = end; i += 4;
      }
    } else if (abs === 'Q') {
      let i = 0;
      while (i < args.length) {
        const ox = isRel ? cur.x : 0, oy = isRel ? cur.y : 0;
        const cp: Vec2 = { x: ox + args[i]!, y: oy + args[i + 1]! };
        const end: Vec2 = { x: ox + args[i + 2]!, y: oy + args[i + 3]! };
        const cp1: Vec2 = { x: cur.x + 2 / 3 * (cp.x - cur.x), y: cur.y + 2 / 3 * (cp.y - cur.y) };
        const cp2: Vec2 = { x: end.x + 2 / 3 * (cp.x - end.x), y: end.y + 2 / 3 * (cp.y - end.y) };
        currentSub.push({ type: 'C', from: { ...cur }, cp1, cp2, to: end });
        lastCp = cp; cur = end; i += 4;
      }
    } else if (abs === 'Z') {
      if (cur.x !== subStart.x || cur.y !== subStart.y) {
        currentSub.push({ type: 'L', from: { ...cur }, to: { ...subStart } });
      }
      cur = { ...subStart };
      subPaths.push(currentSub); currentSub = []; lastCp = null;
    }
  }
  if (currentSub.length > 0) subPaths.push(currentSub);
  return subPaths;
}

function sampleSubPath(segments: PathSegment[], count: number): { points: PathPoint[]; totalLength: number } {
  const lengths: number[] = [];
  let totalLen = 0;
  for (const seg of segments) {
    let len = 0;
    const steps = seg.type === 'C' ? 20 : 1;
    let prev = seg.from;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = seg.type === 'C'
        ? cubicBezier(seg.from, seg.cp1, seg.cp2, seg.to, t)
        : { x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t };
      len += Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
      prev = pt;
    }
    lengths.push(len);
    totalLen += len;
  }

  const points: PathPoint[] = [];
  for (let i = 0; i < count; i++) {
    const targetDist = (i / count) * totalLen;
    let accum = 0;
    for (let si = 0; si < segments.length; si++) {
      if (accum + lengths[si]! >= targetDist || si === segments.length - 1) {
        const localT = lengths[si]! > 0 ? (targetDist - accum) / lengths[si]! : 0;
        const seg = segments[si]!;
        let pt: Vec2, tan: Vec2;
        if (seg.type === 'C') {
          pt = cubicBezier(seg.from, seg.cp1, seg.cp2, seg.to, localT);
          tan = cubicBezierTangent(seg.from, seg.cp1, seg.cp2, seg.to, localT);
        } else {
          pt = { x: seg.from.x + (seg.to.x - seg.from.x) * localT, y: seg.from.y + (seg.to.y - seg.from.y) * localT };
          tan = { x: seg.to.x - seg.from.x, y: seg.to.y - seg.from.y };
        }
        const tLen = Math.sqrt(tan.x * tan.x + tan.y * tan.y) || 1;
        const tx = tan.x / tLen, ty = tan.y / tLen;
        points.push({ x: pt.x, y: pt.y, tx, ty, nx: -ty, ny: tx, arcLen: targetDist / totalLen });
        break;
      }
      accum += lengths[si]!;
    }
  }
  return { points, totalLength: totalLen };
}

export function buildGeometry(
  pathData: string,
  viewBox: [number, number, number, number],
  transform: { tx: number; ty: number } | undefined,
  width: number,
  height: number,
): Geometry {
  const cmds = parsePath(pathData);
  const subPaths = pathToSegments(cmds);

  const [vx, vy, vw, vh] = viewBox;
  const scale = Math.min(width / vw, height / vh) * 0.85;
  const offsetX = (width - vw * scale) / 2 - vx * scale + (transform?.tx ?? 0) * scale;
  const offsetY = (height - vh * scale) / 2 - vy * scale + (transform?.ty ?? 0) * scale;

  const samplesPerUnit = 0.8;
  const subPathData: SubPathData[] = subPaths.map((segs, i) => {
    let roughLen = 0;
    for (const seg of segs) {
      const dx = seg.to.x - seg.from.x, dy = seg.to.y - seg.from.y;
      roughLen += Math.sqrt(dx * dx + dy * dy) * (seg.type === 'C' ? 1.3 : 1);
    }
    const sampleCount = Math.max(60, Math.floor(roughLen * samplesPerUnit));
    const { points, totalLength } = sampleSubPath(segs, sampleCount);
    return { index: i, points, totalLength, segments: segs, pixelPoints: [] };
  });

  const allPointsPixel: PixelPoint[] = [];
  for (const sp of subPathData) {
    sp.pixelPoints = sp.points.map(pt => ({
      ...pt,
      px: pt.x * scale + offsetX,
      py: pt.y * scale + offsetY,
      subPath: sp.index,
    }));
    allPointsPixel.push(...sp.pixelPoints);
  }

  // SDF + arcParam + normals — grid-accelerated nearest-point search
  const sdfRaw = new Float32Array(width * height);
  const arcParam = new Float32Array(width * height);
  const normalX = new Float32Array(width * height);
  const normalY = new Float32Array(width * height);

  // Build spatial grid for fast nearest-point lookup
  const cellSize = 8;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid: number[][] = new Array(gridW * gridH);
  for (let i = 0; i < grid.length; i++) grid[i] = [];
  for (let pi = 0; pi < allPointsPixel.length; pi++) {
    const pt = allPointsPixel[pi]!;
    const gx = Math.floor(pt.px / cellSize);
    const gy = Math.floor(pt.py / cellSize);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
      grid[gy * gridW + gx]!.push(pi);
    }
  }

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let minDist = Infinity, bestArc = 0, bestNx = 0, bestNy = 0;
      const gcx = Math.floor(px / cellSize);
      const gcy = Math.floor(py / cellSize);

      // Search expanding rings of grid cells until we can't find closer
      for (let ring = 0; ring <= Math.max(gridW, gridH); ring++) {
        // Early exit: if best distance is less than the closest possible point in outer rings
        if (ring > 0 && minDist < ((ring - 1) * cellSize) * ((ring - 1) * cellSize)) break;

        for (let gdy = gcy - ring; gdy <= gcy + ring; gdy++) {
          for (let gdx = gcx - ring; gdx <= gcx + ring; gdx++) {
            // Only check border cells of the ring
            if (ring > 0 && gdy > gcy - ring && gdy < gcy + ring && gdx > gcx - ring && gdx < gcx + ring) continue;
            if (gdx < 0 || gdx >= gridW || gdy < 0 || gdy >= gridH) continue;
            const cell = grid[gdy * gridW + gdx]!;
            for (const pi of cell) {
              const pt = allPointsPixel[pi]!;
              const d = (px - pt.px) ** 2 + (py - pt.py) ** 2;
              if (d < minDist) { minDist = d; bestArc = pt.arcLen; bestNx = pt.nx; bestNy = pt.ny; }
            }
          }
        }
        if (minDist < Infinity) {
          // Check if we need to search further
          const nextRingMinDist = ring * cellSize;
          if (minDist <= nextRingMinDist * nextRingMinDist) break;
        }
      }

      const idx = py * width + px;
      sdfRaw[idx] = Math.sqrt(minDist);
      arcParam[idx] = bestArc;
      normalX[idx] = bestNx;
      normalY[idx] = bestNy;
    }
  }

  // nonzero winding number → insideMask + signed SDF
  // Scanline approach: pre-collect edges that cross each row, then sweep per row
  const sdf = new Float32Array(width * height);
  const insideMask = new Uint8Array(width * height);

  // Collect all edge segments (pairs of consecutive pixelPoints)
  interface Edge { ax: number; ay: number; bx: number; by: number; }
  const allEdges: Edge[] = [];
  for (const sp of subPathData) {
    const pts = sp.pixelPoints;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      allEdges.push({ ax: a.px, ay: a.py, bx: b.px, by: b.py });
    }
  }

  // Bin edges by the rows they span
  const edgesByRow: number[][] = new Array(height);
  for (let y = 0; y < height; y++) edgesByRow[y] = [];
  for (let ei = 0; ei < allEdges.length; ei++) {
    const e = allEdges[ei]!;
    const yMin = Math.floor(Math.min(e.ay, e.by));
    const yMax = Math.ceil(Math.max(e.ay, e.by));
    for (let y = Math.max(0, yMin); y < Math.min(height, yMax + 1); y++) {
      edgesByRow[y]!.push(ei);
    }
  }

  for (let py = 0; py < height; py++) {
    // Compute winding number for all px in this row using only relevant edges
    const rowEdges = edgesByRow[py]!;
    // Collect all x-crossings with their winding direction
    const crossings: { x: number; dir: number }[] = [];
    for (const ei of rowEdges) {
      const e = allEdges[ei]!;
      if (e.ay <= py) {
        if (e.by > py) {
          crossings.push({ x: e.ax + (py - e.ay) / (e.by - e.ay) * (e.bx - e.ax), dir: 1 });
        }
      } else {
        if (e.by <= py) {
          crossings.push({ x: e.ax + (py - e.ay) / (e.by - e.ay) * (e.bx - e.ax), dir: -1 });
        }
      }
    }
    // Sort crossings by x
    crossings.sort((a, b) => a.x - b.x);

    // Sweep across pixels
    let ci = 0, winding = 0;
    for (let px = 0; px < width; px++) {
      while (ci < crossings.length && crossings[ci]!.x <= px) {
        winding += crossings[ci]!.dir;
        ci++;
      }
      const idx = py * width + px;
      const inside = winding !== 0;
      insideMask[idx] = inside ? 1 : 0;
      sdf[idx] = inside ? -sdfRaw[idx]! : sdfRaw[idx]!;
    }
  }

  return { width, height, scale, offsetX, offsetY, subPaths: subPathData, allPoints: allPointsPixel, sdf, arcParam, normalX, normalY, insideMask };
}

/** 用 sharp 渲染的精确蒙版修正 SDF 符号 */
export function applyMask(geo: Geometry, externalMask: Uint8Array): void {
  for (let i = 0; i < geo.width * geo.height; i++) {
    const wasInside = geo.insideMask[i]!;
    const isInside = externalMask[i]! ? 1 : 0;
    geo.insideMask[i] = isInside;
    if (wasInside !== isInside) {
      geo.sdf[i] = -geo.sdf[i]!;
    }
  }
}

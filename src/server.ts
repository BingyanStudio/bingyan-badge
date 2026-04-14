import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import './components/loader.js';

import { renderBadge, clearGeoCache, type RenderTiming } from './core/renderer.js';
import { getRepoShortSHA } from './core/github.js';
import { registry } from './core/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env['PORT'] || 3000;

app.use(express.json());
app.use((_req, res, next) => { res.setHeader('Access-Control-Expose-Headers', 'X-Render-Timing'); next(); });
app.use(express.static(path.join(ROOT, 'public')));
app.get('/icon.svg', (_req, res) => { res.type('image/svg+xml'); res.sendFile(path.join(ROOT, 'icon.svg')); });

function logStartup(): void {
  const stats = registry.stats();
  console.log(`组件: ${stats.components} | 配方: mask=${stats.recipes['mask'] ?? 0}`);
}

// ─── GIF 缓存（条目数 + 总字节双重上限）───

const cache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 3600_000;
const CACHE_MAX_ENTRIES = 200;
const CACHE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
let cacheBytes = 0;

function getCached(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cacheBytes -= entry.buffer.length;
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

function evictOldest(): void {
  const oldest = cache.keys().next().value!;
  const entry = cache.get(oldest)!;
  cacheBytes -= entry.buffer.length;
  cache.delete(oldest);
}

function setCache(key: string, buffer: Buffer): void {
  while (cache.size >= CACHE_MAX_ENTRIES || cacheBytes + buffer.length > CACHE_MAX_BYTES) {
    if (cache.size === 0) break;
    evictOldest();
  }
  cache.set(key, { buffer, timestamp: Date.now() });
  cacheBytes += buffer.length;
}

// ─── 并发渲染限制 ───

const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;

// ─── 清除缓存 ───

app.delete('/api/cache', (_req, res) => {
  const gifCount = cache.size;
  cache.clear();
  cacheBytes = 0;
  clearGeoCache();
  res.json({ cleared: true, gifEntries: gifCount });
});

// ─── 参数解析 ───

function intParam(v: unknown, def: number, min: number, max: number): number {
  if (v === undefined) return def;
  const n = parseInt(v as string, 10);
  return isNaN(n) ? def : Math.max(min, Math.min(max, n));
}

function boolParam(v: unknown, def: boolean): boolean {
  if (v === undefined) return def;
  const s = (v as string).toLowerCase();
  if (s === 'false' || s === '0' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 'yes') return true;
  return def;
}

function parseRenderParams(query: Record<string, unknown>) {
  const w = intParam(query['width'], 256, 32, 384);
  const h = intParam(query['height'], 256, 32, 384);
  const sp = intParam(query['speed'], 50, 20, 200);
  const fr = intParam(query['frames'], 30, 10, 60);
  const tp = boolParam(query['transparent'], true);
  return { w, h, sp, fr, tp };
}

const MAX_BUDGET = 384 * 384 * 60;

function checkBudget(w: number, h: number, fr: number): string | null {
  const total = w * h * fr;
  if (total > MAX_BUDGET) {
    return `渲染量超限：${w}×${h}×${fr} = ${total} 像素，上限 ${MAX_BUDGET}`;
  }
  return null;
}

// ─── 通用渲染 + 缓存逻辑 ───

async function handleRender(res: express.Response, cacheKey: string, sha: string, w: number, h: number, sp: number, fr: number, tp: boolean) {
  const hit = getCached(cacheKey);
  if (hit) {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Render-Timing', JSON.stringify({ cached: true }));
    return res.send(hit);
  }

  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    return res.status(503).json({ error: '服务器繁忙，请稍后重试' });
  }

  activeRenders++;
  try {
    const { buffer, timing } = await renderBadge(sha, { width: w, height: h, delay: sp, frames: fr, transparent: tp });
    setCache(cacheKey, buffer);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Render-Timing', JSON.stringify(timing));
    res.send(buffer);
  } finally {
    activeRenders--;
  }
}

// ─── API ───

app.get('/api/badge/sha/:sha', async (req, res) => {
  try {
    const sha = req.params['sha']!.replace(/[^0-9a-fA-F]/g, '').substring(0, 40);
    if (sha.length < 4) return res.status(400).json({ error: 'SHA 至少 4 位十六进制' });

    const { w, h, sp, fr, tp } = parseRenderParams(req.query);
    const err = checkBudget(w, h, fr);
    if (err) return res.status(400).json({ error: err });

    const key = `${sha}_${w}_${h}_${sp}_${fr}_${tp}`;
    await handleRender(res, key, sha, w, h, sp, fr, tp);
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/badge/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const sha = await getRepoShortSHA(owner!, repo!);

    const { w, h, sp, fr, tp } = parseRenderParams(req.query);
    const err = checkBudget(w, h, fr);
    if (err) return res.status(400).json({ error: err });

    const key = `${owner}_${repo}_${sha}_${w}_${h}_${sp}_${fr}_${tp}`;
    await handleRender(res, key, sha, w, h, sp, fr, tp);
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl || typeof repoUrl !== 'string') return res.status(400).json({ error: '请提供仓库链接' });
    const match = repoUrl.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
    if (!match) return res.status(400).json({ error: '无效的 GitHub 仓库链接' });
    const owner = match[1]!;
    const repo = match[2]!.replace(/\.git$/, '');
    const sha = await getRepoShortSHA(owner, repo);
    res.json({ owner, repo, sha, badgeUrl: `/api/badge/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` });
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
});

logStartup();
app.listen(PORT, () => { console.log(`Bingyan Badge 运行于 http://localhost:${PORT}`); });

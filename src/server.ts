import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import './components/loader.js';

import { renderBadge, clearGeoCache } from './core/renderer.js';
import { getRepoShortSHA } from './core/github.js';
import { registry } from './core/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env['PORT'] || 3000;
const ICON_PATH = path.join(ROOT, 'icon.svg');

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.get('/icon.svg', (_req, res) => { res.type('image/svg+xml'); res.sendFile(ICON_PATH); });

let iconSVGBuffer: Buffer;

function loadIcon(): void {
  if (!fs.existsSync(ICON_PATH)) {
    console.error('icon.svg 不存在，请将图标文件放在项目根目录');
    process.exit(1);
  }
  iconSVGBuffer = fs.readFileSync(ICON_PATH);
  const stats = registry.stats();
  console.log(`图标已加载 | 组件: ${stats.components} | 配方: mask=${stats.recipes['mask'] ?? 0}`);
}

// ─── 缓存 ───

const cache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 3600_000;

function getCached(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.buffer;
}

function setCache(key: string, buffer: Buffer): void {
  if (cache.size > 200) { cache.delete(cache.keys().next().value!); }
  cache.set(key, { buffer, timestamp: Date.now() });
}

// ─── 清除缓存 ───

app.delete('/api/cache', (_req, res) => {
  const gifCount = cache.size;
  cache.clear();
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

// ─── API ───

app.get('/api/badge/sha/:sha', async (req, res) => {
  try {
    const sha = req.params['sha']!.replace(/[^0-9a-fA-F]/g, '').substring(0, 40);
    if (sha.length < 4) return res.status(400).json({ error: 'SHA 至少 4 位十六进制' });

    const w = intParam(req.query['width'], 256, 32, 512);
    const h = intParam(req.query['height'], 256, 32, 512);
    const sp = intParam(req.query['speed'], 50, 20, 200);
    const fr = intParam(req.query['frames'], 60, 10, 60);
    const tp = boolParam(req.query['transparent'], true);

    const totalPixels = w * h * fr;
    const MAX_BUDGET = 512 * 512 * 60; // ~15.7M pixels
    if (totalPixels > MAX_BUDGET) {
      return res.status(400).json({ error: `渲染量超限：${w}×${h}×${fr} = ${totalPixels} 像素，上限 ${MAX_BUDGET}` });
    }

    const key = `${sha}_${w}_${h}_${sp}_${fr}_${tp}`;
    const hit = getCached(key);
    if (hit) { res.setHeader('Content-Type', 'image/gif'); res.setHeader('Cache-Control', 'public, max-age=3600'); return res.send(hit); }

    const gif = await renderBadge(iconSVGBuffer, sha, { width: w, height: h, delay: sp, frames: fr, transparent: tp });
    setCache(key, gif);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(gif);
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/badge/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const sha = await getRepoShortSHA(owner!, repo!);

    const w = intParam(req.query['width'], 256, 32, 512);
    const h = intParam(req.query['height'], 256, 32, 512);
    const sp = intParam(req.query['speed'], 50, 20, 200);
    const fr = intParam(req.query['frames'], 60, 10, 60);
    const tp = boolParam(req.query['transparent'], true);

    const totalPixels = w * h * fr;
    const MAX_BUDGET = 512 * 512 * 60; // ~15.7M pixels
    if (totalPixels > MAX_BUDGET) {
      return res.status(400).json({ error: `渲染量超限：${w}×${h}×${fr} = ${totalPixels} 像素，上限 ${MAX_BUDGET}` });
    }

    const key = `${owner}_${repo}_${sha}_${w}_${h}_${sp}_${fr}_${tp}`;
    const hit = getCached(key);
    if (hit) { res.setHeader('Content-Type', 'image/gif'); res.setHeader('Cache-Control', 'public, max-age=3600'); return res.send(hit); }

    const gif = await renderBadge(iconSVGBuffer, sha, { width: w, height: h, delay: sp, frames: fr, transparent: tp });
    setCache(key, gif);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(gif);
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

loadIcon();
app.listen(PORT, () => { console.log(`Bingyan Badge 运行于 http://localhost:${PORT}`); });

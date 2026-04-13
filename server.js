import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderBadge } from './lib/renderer.js';
import { getRepoShortSHA } from './lib/github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ICON_PATH = path.join(__dirname, 'icon.svg');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/icon.svg', (req, res) => {
  res.type('image/svg+xml');
  res.sendFile(ICON_PATH);
});
let iconSVGBuffer;

function loadIcon() {
  if (!fs.existsSync(ICON_PATH)) {
    console.error('icon.svg 不存在，请将图标文件放在项目根目录');
    process.exit(1);
  }
  iconSVGBuffer = fs.readFileSync(ICON_PATH);
  console.log('图标已加载:', ICON_PATH);
}

// 简易内存缓存：key -> {buffer, timestamp}
const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 小时

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

function setCache(key, buffer) {
  // 限制缓存大小
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { buffer, timestamp: Date.now() });
}

function parseIntParam(value, defaultVal, min, max) {
  if (value === undefined) return defaultVal;
  const n = parseInt(value, 10);
  if (isNaN(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

// API: 直接通过 SHA 生成徽章（用于测试/预览）
app.get('/api/badge/sha/:sha', async (req, res) => {
  try {
    const sha = req.params.sha.replace(/[^0-9a-fA-F]/g, '').substring(0, 40);
    if (sha.length < 4) {
      return res.status(400).json({ error: 'SHA 至少需要 4 个十六进制字符' });
    }

    const width = parseIntParam(req.query.width, 256, 32, 1024);
    const height = parseIntParam(req.query.height, 256, 32, 1024);
    const speed = parseIntParam(req.query.speed, 50, 20, 200);
    const frames = parseIntParam(req.query.frames, 30, 10, 60);

    const cacheKey = `${sha}_${width}_${height}_${speed}_${frames}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const gif = await renderBadge(iconSVGBuffer, sha, { width, height, delay: speed, frames });
    setCache(cacheKey, gif);

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(gif);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API: 通过 GitHub 仓库生成徽章
app.get('/api/badge/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const sha = await getRepoShortSHA(owner, repo);

    const width = parseIntParam(req.query.width, 256, 32, 1024);
    const height = parseIntParam(req.query.height, 256, 32, 1024);
    const speed = parseIntParam(req.query.speed, 50, 20, 200);
    const frames = parseIntParam(req.query.frames, 30, 10, 60);

    const cacheKey = `${owner}_${repo}_${sha}_${width}_${height}_${speed}_${frames}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const gif = await renderBadge(iconSVGBuffer, sha, { width, height, delay: speed, frames });
    setCache(cacheKey, gif);

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(gif);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API: 解析仓库链接
app.post('/api/generate', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ error: '请提供仓库链接' });
    }
    const match = repoUrl.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
    if (!match) {
      return res.status(400).json({ error: '无效的 GitHub 仓库链接' });
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const sha = await getRepoShortSHA(owner, repo);
    const badgeUrl = `/api/badge/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    res.json({ owner, repo, sha, badgeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

loadIcon();

app.listen(PORT, () => {
  console.log(`Bingyan Badge 服务运行于 http://localhost:${PORT}`);
});

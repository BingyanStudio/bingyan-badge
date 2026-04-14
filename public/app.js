document.getElementById('generateBtn').addEventListener('click', generate);
document.getElementById('repoUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});
document.getElementById('shaBtn').addEventListener('click', previewSHA);
document.getElementById('shaInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') previewSHA();
});

function getOptions() {
  const width = document.getElementById('optWidth').value;
  const height = document.getElementById('optHeight').value;
  const speed = document.getElementById('optSpeed').value;
  const frames = document.getElementById('optFrames').value;
  const params = new URLSearchParams();
  if (width !== '256') params.set('width', width);
  if (height !== '256') params.set('height', height);
  if (speed !== '70') params.set('speed', speed);
  if (frames !== '60') params.set('frames', frames);
  return params.toString() ? '?' + params.toString() : '';
}

// ─── 渲染日志面板 ───

function showTimingPanel(container, timing, networkMs) {
  let panel = container.querySelector('.timing-panel');
  if (!panel) {
    const details = document.createElement('details');
    details.className = 'timing-panel';
    const summary = document.createElement('summary');
    summary.textContent = '渲染日志';
    details.appendChild(summary);
    const content = document.createElement('div');
    content.className = 'timing-content';
    details.appendChild(content);
    container.appendChild(details);
    panel = details;
  }

  const content = panel.querySelector('.timing-content');

  if (timing.cached) {
    content.innerHTML =
      '<div class="timing-row"><span class="timing-label">GIF 缓存</span><span class="timing-tag timing-hit">命中</span></div>' +
      '<div class="timing-row"><span class="timing-label">网络传输</span><span class="timing-value">' + networkMs + ' ms</span></div>';
    return;
  }

  const rows = [
    { label: 'Geometry 构建', value: timing.geometry + ' ms', note: timing.geoCached ? '(已缓存)' : '(首次计算)' },
    { label: '管线构建', value: timing.pipelineBuild + ' ms' },
    { label: '帧渲染 (共' + Math.round(timing.pipelineFrames / (timing.pipelineAvgFrame || 1)) + '帧)', value: timing.pipelineFrames + ' ms', note: '均 ' + timing.pipelineAvgFrame + ' ms/帧' },
    { label: 'GIF 编码', value: timing.gifEncode + ' ms' },
    { label: '服务端总耗时', value: timing.total + ' ms', highlight: true },
    { label: '网络传输', value: networkMs + ' ms' },
    { label: 'GIF 体积', value: (timing.gifBytes / 1024).toFixed(0) + ' KB' },
  ];

  let html = '';
  for (const row of rows) {
    const cls = row.highlight ? ' timing-total' : '';
    html += '<div class="timing-row' + cls + '">';
    html += '<span class="timing-label">' + row.label + (row.note ? ' <span class="timing-note">' + row.note + '</span>' : '') + '</span>';
    html += '<span class="timing-value">' + row.value + '</span>';
    html += '</div>';
  }
  html += '<div class="timing-pipeline">' + timing.pipeline.replace(/ > /g, ' → ') + '</div>';
  content.innerHTML = html;
}

// ─── 通过 fetch 加载 GIF 并读取 timing 头 ───

async function fetchBadge(url) {
  const networkStart = performance.now();
  const res = await fetch(url);
  const networkMs = Math.round(performance.now() - networkStart);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败: ' + res.status);
  }

  let timing = null;
  const timingHeader = res.headers.get('X-Render-Timing');
  if (timingHeader) {
    try { timing = JSON.parse(timingHeader); } catch {}
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, timing, networkMs };
}

// ─── 生成徽章 ───

async function generate() {
  const repoUrl = document.getElementById('repoUrl').value.trim();
  if (!repoUrl) return;

  const resultDiv = document.getElementById('result');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');

  resultDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const opts = getOptions();
    const baseUrl = window.location.origin;
    const badgeUrl = data.badgeUrl + opts;
    const fullBadgeUrl = baseUrl + badgeUrl;

    const { blobUrl, timing, networkMs } = await fetchBadge(badgeUrl);
    loadingDiv.classList.add('hidden');

    const previewEl = document.getElementById('gifPreview');
    previewEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = blobUrl;
    img.alt = 'Bingyan Badge';
    previewEl.appendChild(img);

    document.getElementById('shaDisplay').textContent = data.sha;

    if (timing) {
      showTimingPanel(previewEl.closest('.preview'), timing, networkMs);
    }

    // 链接
    document.getElementById('markdownLink').value =
      `![Bingyan Badge](${fullBadgeUrl})`;
    document.getElementById('htmlLink').value =
      `<img src="${fullBadgeUrl}" alt="Bingyan Badge" width="200" />`;
    document.getElementById('directLink').value = fullBadgeUrl;

    resultDiv.classList.remove('hidden');
  } catch (err) {
    loadingDiv.classList.add('hidden');
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
  }
}

// ─── SHA 预览 ───

async function previewSHA() {
  const sha = document.getElementById('shaInput').value.trim().replace(/[^0-9a-fA-F]/g, '');
  if (sha.length < 4) return;

  const opts = getOptions();
  const previewEl = document.getElementById('shaPreview');
  previewEl.innerHTML = '<div class="spinner"></div>';

  try {
    const { blobUrl, timing, networkMs } = await fetchBadge(`/api/badge/sha/${sha}${opts}`);
    previewEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = blobUrl;
    img.alt = 'Badge Preview';
    previewEl.appendChild(img);

    if (timing) {
      showTimingPanel(previewEl, timing, networkMs);
    }
  } catch {
    previewEl.innerHTML = '<p style="color:#f85149">生成失败</p>';
  }
}

// ─── 复制按钮 ───

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.value).then(() => {
      const original = btn.textContent;
      btn.textContent = '已复制!';
      setTimeout(() => btn.textContent = original, 2000);
    });
  });
});

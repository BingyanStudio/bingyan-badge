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
  if (speed !== '50') params.set('speed', speed);
  if (frames !== '30') params.set('frames', frames);
  return params.toString() ? '?' + params.toString() : '';
}

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

    // 预览
    const img = document.createElement('img');
    img.src = badgeUrl;
    img.alt = 'Bingyan Badge';
    img.onload = () => loadingDiv.classList.add('hidden');
    img.onerror = () => {
      loadingDiv.classList.add('hidden');
      errorDiv.textContent = '徽章图片加载失败';
      errorDiv.classList.remove('hidden');
    };

    const previewEl = document.getElementById('gifPreview');
    previewEl.innerHTML = '';
    previewEl.appendChild(img);

    document.getElementById('shaDisplay').textContent = data.sha;

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

function previewSHA() {
  const sha = document.getElementById('shaInput').value.trim().replace(/[^0-9a-fA-F]/g, '');
  if (sha.length < 4) return;

  const opts = getOptions();
  const previewEl = document.getElementById('shaPreview');
  previewEl.innerHTML = '<div class="spinner"></div>';

  const img = document.createElement('img');
  img.src = `/api/badge/sha/${sha}${opts}`;
  img.alt = 'Badge Preview';
  img.onload = () => {
    previewEl.innerHTML = '';
    previewEl.appendChild(img);
  };
  img.onerror = () => {
    previewEl.innerHTML = '<p style="color:#f85149">生成失败</p>';
  };
}

// 复制按钮
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

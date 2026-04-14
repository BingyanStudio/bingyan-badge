export async function getRepoShortSHA(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'BingyanBadge/1.0',
  };
  if (process.env['GITHUB_TOKEN']) {
    headers['Authorization'] = `Bearer ${process.env['GITHUB_TOKEN']}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const waitMin = reset ? Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60000) : '?';
      throw new Error(`GitHub API 速率限制已用尽，${waitMin} 分钟后恢复。配置 GITHUB_TOKEN 可提升至 5000 次/小时`);
    }
    throw new Error(`GitHub API 错误: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as Array<{ sha: string }>;
  if (!data.length) {
    throw new Error('仓库中未找到任何提交记录');
  }
  return data[0]!.sha.substring(0, 7);
}

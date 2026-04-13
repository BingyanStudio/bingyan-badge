# Bingyan Badge

为 GitHub 仓库生成独一无二的动态冰岩徽章。基于仓库最新 commit SHA 确定性生成 GIF 动画，同一仓库始终得到相同效果，每次提交后自动变化。

## 效果系统

徽章效果由 SHA 种子确定性选择和组合，灵感来自 Noita 的组合魔法系统：

**背景层** — 纯色 / 渐变扫描 / 等离子体 / 星云 / 星空

**图标层** — 色相偏移 / 脉冲明暗 / 故障条纹 / 扫描线

**叠加层** — 粒子发射 / 扩散光环 / 闪电 / 暗角 / 辉光 / 矩阵雨 / 火焰轨迹

效果之间存在协同关系：例如"闪电 + 脉冲"会增强脉冲强度，"星云 + 辉光"会扩大辉光范围。

## 使用

### 本地开发

```bash
npm install
npm run dev
# 访问 http://localhost:3000
```

### API

| 接口 | 说明 |
|------|------|
| `GET /api/badge/:owner/:repo` | 通过 GitHub 仓库生成徽章 GIF |
| `GET /api/badge/sha/:sha` | 通过任意 SHA 直接生成徽章 GIF |
| `POST /api/generate` | 解析仓库链接，返回徽章元数据 |

**查询参数：**

| 参数 | 默认值 | 范围 | 说明 |
|------|--------|------|------|
| `width` | 256 | 32-1024 | 图片宽度 |
| `height` | 256 | 32-1024 | 图片高度 |
| `speed` | 50 | 20-200 | 帧延迟（ms），越小越快 |
| `frames` | 30 | 10-60 | 总帧数 |

**示例：**

```
![Bingyan Badge](https://your-domain.com/api/badge/owner/repo)
![Bingyan Badge](https://your-domain.com/api/badge/owner/repo?width=128&height=128&speed=30)
```

### Docker 部署

```bash
docker build -t bingyan-badge .
docker run -p 3000:3000 -e GITHUB_TOKEN=your_token bingyan-badge
```

设置 `GITHUB_TOKEN` 环境变量可提高 GitHub API 的速率限制。

## 技术栈

- Node.js 20+
- Express
- Sharp (SVG → 像素渲染)
- gif-encoder-2 (GIF 编码)

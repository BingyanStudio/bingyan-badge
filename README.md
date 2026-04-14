# Bingyan Badge

为 GitHub 仓库生成独一无二的动态冰岩徽章。基于仓库最新 commit SHA 确定性生成 GIF 动画。

## 架构

TypeScript + 组件注册模式。新增效果只需加一个文件。

```
src/
  core/               # 核心引擎
    types.ts          # 所有类型定义
    fields.ts         # ScalarField, ColorField 场数据结构
    math.ts           # 噪声、HSL 转换等纯数学工具
    rng.ts            # 基于 SHA 的确定性随机数生成器
    path-engine.ts    # SVG path 几何引擎（SDF、法线、弧长）
    registry.ts       # 全局组件注册表
    pipeline.ts       # 管线构建器
    renderer.ts       # 逐帧渲染 + GIF 编码
    github.ts         # GitHub API
  components/         # 可插拔组件（自注册）
    sources/          # 源：SDF、弧长、噪声、voronoi、时间
    transforms/       # 变换：remap、warp、edge、quantize、feedback
    lighting/         # 光照：浮雕、镜面高光、轮廓光、AO
    color/            # 颜色：渐变映射、HSL偏移、光照应用、合成
    combiners/        # 组合：加/乘/screen/overlay
    loader.ts         # 自动加载所有组件和配方
  recipes/            # 管线配方（随机选择 + 组合）
    icon/             # 6 种图标渲染配方
    bg/               # 4 种背景配方
    mask/             # 4 种蒙版配方
  server.ts           # Express 服务
```

### 效果系统

围绕 SVG path 的几何信息设计：

- **SDF 距离场**：每个像素到路径边缘的带符号距离 → 驱动深度纹理、边缘检测、辉光
- **法线场**：最近边缘点的法线方向 → 驱动浮雕光照、镜面反射、空间扭曲
- **弧长场**：沿路径的归一化弧长 → 驱动流动渐变、炫彩色带

配方随机组合 6×4×4 = 96 种管线结构，每种内部参数又完全不同。

### 新增组件

在 `src/components/` 对应子目录下创建文件：

```ts
import { registry } from '../../core/registry.js';
import { ScalarField } from '../../core/fields.js';
import { ComponentType, type Component, type PipelineContext } from '../../core/types.js';

const component: Component<{ myParam: number }> = {
  id: 'src:my-effect',
  type: ComponentType.SOURCE,
  params: { myParam: { type: 'float', min: 0, max: 1, default: 0.5 } },
  create({ myParam }) {
    return (ctx: PipelineContext) => {
      const f = new ScalarField(ctx.geo.width, ctx.geo.height);
      // ... 填充 f.data
      return f;
    };
  },
};

registry.register(component);
export default component;
```

然后在 `loader.ts` 中添加一行 import。

## 使用

### 本地开发

```bash
npm install
npm run dev          # tsx watch 模式
# 访问 http://localhost:3000
```

### 类型检查

```bash
npm run check        # tsc --noEmit
```

### API

| 接口 | 说明 |
|------|------|
| `GET /api/badge/:owner/:repo` | GitHub 仓库徽章 GIF |
| `GET /api/badge/sha/:sha` | 任意 SHA 直接生成 |
| `POST /api/generate` | 解析仓库链接，返回元数据 |

**查询参数：** `width` (默认256, 上限384), `height` (默认256, 上限384), `speed` (默认50ms), `frames` (默认30, 上限60)。总像素量 width×height×frames 不得超过 8,847,360。

### Docker 部署

```bash
docker build -t bingyan-badge .
docker run -p 3000:3000 -e GITHUB_TOKEN=your_token bingyan-badge
```

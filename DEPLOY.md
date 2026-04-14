# Bingyan Badge 部署指南

## 一、创建 GitHub Token（可选但推荐）

不配 Token 时，GitHub API 限流 60 次/小时（按 IP），对个人使用够了。  
配了 Token 后提升到 5000 次/小时，推荐在部署到公网后配置。

### 步骤

1. 打开 https://github.com/settings/tokens?type=beta （需要登录 GitHub）
2. 点击 **Generate new token**
3. 填写：
   - **Token name**: `bingyan-badge`
   - **Expiration**: 选 90 天或自定义（到期后需要重新生成）
   - **Repository access**: 选 **Public Repositories (read-only)**
   - **不需要勾选任何额外权限**（只需要读公开仓库的 commit 信息）
4. 点击 **Generate token**
5. **立即复制 Token**（页面关闭后无法再看到）

> 这个 Token 只有读取公开仓库的权限，安全风险很低。

---

## 二、部署到 Render

### 前置条件

- 代码已推送到 GitHub 仓库

### 步骤

1. 打开 https://render.com ，点击右上角 **Sign In**，选择 **GitHub** 登录

2. 登录后，点击页面顶部的 **New** → **Web Service**

3. 连接仓库：
   - 选择你的 `bingyan-badge` 仓库
   - 如果看不到，点 **Configure account** 授权 Render 访问你的仓库

4. 配置服务：

   | 配置项 | 填写内容 |
   |-------|---------|
   | **Name** | `bingyan-badge` |
   | **Region** | Singapore (Southeast Asia) |
   | **Branch** | `main` |
   | **Runtime** | Docker |
   | **Instance Type** | Free |

5. 展开 **Environment Variables**，点 **Add Environment Variable**：

   | Key | Value |
   |-----|-------|
   | `GITHUB_TOKEN` | 粘贴第一步生成的 Token（没有则留空） |

6. 点击 **Create Web Service**

7. 等待 2-3 分钟构建完成，看到 **"Your service is live"** 即部署成功

### 访问地址

部署完成后访问 `https://bingyan-badge.onrender.com`（名称取决于你填的 Name）。

### 注意事项

- Free 方案 15 分钟无流量会自动休眠，首次唤醒约 30 秒
- 每次 push 到 main 分支会自动重新部署
- 如果 Token 过期，去 Render Dashboard → 你的服务 → Environment → 更新 `GITHUB_TOKEN` 的值

---

## 三、部署到 Railway（备选）

1. 打开 https://railway.app ，用 GitHub 登录
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择 `bingyan-badge` 仓库
4. Railway 会自动检测 Dockerfile 并开始构建
5. 构建完成后，点击服务 → **Settings** → **Networking** → **Generate Domain** 获取公网地址
6. 在 **Variables** 中添加 `GITHUB_TOKEN`（可选）

Railway 每月有 $5 免费额度，不会自动休眠，响应更快。

---

## 四、部署到 Fly.io（备选）

需要安装 CLI 工具：

```bash
# macOS
brew install flyctl

# 或通用安装
curl -L https://fly.io/install.sh | sh
```

```bash
# 登录
fly auth login

# 在项目目录下执行
fly launch
# 按提示选择：区域选 sin (Singapore)，其他默认即可

# 设置环境变量（可选）
fly secrets set GITHUB_TOKEN=你的token

# 部署
fly deploy
```

Fly.io 免费额度包含 3 台小机器，不休眠。

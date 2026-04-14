#!/bin/bash
# 推送到 main 前的本地验证脚本
# 用法：./scripts/pre-push-check.sh
# 或作为 git hook：.git/hooks/pre-push

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step=0
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
pass() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}▸ $1${NC}"; }

# ─── 1. 类型检查 ───
info "类型检查..."
npx tsc --noEmit || fail "类型检查失败"
pass "类型检查通过"

# ─── 2. Docker 构建 ───
info "Docker 构建..."
if ! command -v docker &>/dev/null; then
  fail "Docker 未安装"
fi
if ! docker info &>/dev/null; then
  fail "Docker daemon 未运行，请先启动 Docker Desktop"
fi

IMAGE_NAME="bingyan-badge-ci-test"
docker build -t "$IMAGE_NAME" . || fail "Docker 构建失败"
pass "Docker 构建成功"

# ─── 3. 容器启动 + 健康检查 ───
info "启动容器..."
CONTAINER_ID=$(docker run -d --rm -p 13000:3000 "$IMAGE_NAME")

cleanup() {
  docker stop "$CONTAINER_ID" &>/dev/null || true
}
trap cleanup EXIT

# 等待服务就绪（最多 15 秒）
for i in $(seq 1 15); do
  if curl -sf http://localhost:13000/ > /dev/null 2>&1; then
    break
  fi
  if [ "$i" = "15" ]; then
    echo ""
    echo "容器日志："
    docker logs "$CONTAINER_ID" 2>&1 | tail -20
    fail "服务 15 秒内未就绪"
  fi
  sleep 1
  printf "."
done
echo ""
pass "服务已启动"

# ─── 4. API 冒烟测试 ───
info "API 测试..."

# 4a. SHA 接口
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  "http://localhost:13000/api/badge/sha/abc1234?width=64&height=64&frames=5")
if [ "$HTTP_CODE" != "200" ]; then
  fail "GET /api/badge/sha/abc1234 返回 $HTTP_CODE"
fi
pass "SHA 接口正常 (200)"

# 4b. 检查 timing 头
TIMING=$(curl -sf -D - \
  "http://localhost:13000/api/badge/sha/deadbee?width=64&height=64&frames=5" \
  -o /dev/null 2>&1 | grep -i "X-Render-Timing")
if [ -z "$TIMING" ]; then
  fail "响应缺少 X-Render-Timing 头"
fi
pass "Timing 头存在"

# 4c. 缓存命中
CACHED=$(curl -sf -D - \
  "http://localhost:13000/api/badge/sha/deadbee?width=64&height=64&frames=5" \
  -o /dev/null 2>&1 | grep "X-Render-Timing" | grep "cached")
if [ -z "$CACHED" ]; then
  fail "第二次请求未命中缓存"
fi
pass "缓存命中正常"

# 4d. 参数校验
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  "http://localhost:13000/api/badge/sha/ab")
if [ "$HTTP_CODE" = "400" ]; then
  pass "参数校验正常 (400)"
else
  fail "短 SHA 应返回 400，实际返回 $HTTP_CODE"
fi

# 4e. 静态页面
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:13000/")
if [ "$HTTP_CODE" != "200" ]; then
  fail "首页返回 $HTTP_CODE"
fi
pass "静态页面正常 (200)"

echo ""
echo -e "${GREEN}═══ 全部检查通过 ═══${NC}"

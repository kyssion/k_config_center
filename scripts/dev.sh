#!/usr/bin/env bash
# 同时启动后端（dotnet run，http://localhost:9000）与前端（vite，http://localhost:9001，/api 代理到 9000）
# 前置条件：已准备好 k_config_center/appsettings.Development.json（可从 .example 复制修改）
# 用法：./scripts/dev.sh  （Ctrl+C 一次性结束两个进程）
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f k_config_center/appsettings.Development.json ]; then
  echo "缺少 k_config_center/appsettings.Development.json，请复制 appsettings.Development.json.example 并填入真实数据库连接。" >&2
  exit 1
fi

cleanup() {
  # 杀掉本脚本拉起的整个进程组（后端 + 前端）
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> 启动后端 http://localhost:9000（Swagger: http://localhost:9000/swagger）"
(cd k_config_center && dotnet run) &

echo "==> 启动前端 http://localhost:9001"
(cd web && npm run dev) &

wait

#!/usr/bin/env bash
# 生产构建：前端产物输出到 k_config_center/wwwroot/，再 dotnet build 后端（单一应用部署形态）
# 用法：./scripts/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/2] 前端构建（tsc 检查 + vite build → k_config_center/wwwroot/）"
(cd web && npm run build)

echo "==> [2/2] 后端构建（dotnet build Release）"
dotnet build k_config_center.sln -c Release

echo "==> 构建完成 ✔（后端 dotnet run / 发布后，同一进程同时提供 API 与前端页面）"

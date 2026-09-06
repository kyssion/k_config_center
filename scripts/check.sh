#!/usr/bin/env bash
# 一键验证（AI 改动后必须跑）：后端构建 + 后端格式 + 后端测试 + 前端类型检查
# 用法：./scripts/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/4] 后端构建检查（dotnet build，0 警告基线）"
dotnet build k_config_center.sln

echo "==> [2/4] 后端格式检查（dotnet format --verify-no-changes，无格式差异）"
dotnet format k_config_center.sln --verify-no-changes

echo "==> [3/4] 后端测试（dotnet test，全部通过）"
dotnet test k_config_center.sln --no-build

echo "==> [4/4] 前端类型检查（tsc --noEmit）"
cd web
if [ ! -d node_modules ]; then
  echo "node_modules 不存在，先安装依赖（npm install）"
  npm install
fi
npx tsc --noEmit

echo "==> 全部通过 ✔"

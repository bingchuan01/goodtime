#!/usr/bin/env bash
# 在 ECS 上执行（server 目录已是最新代码后）:
#   bash /home/ecs-user/goodtime/server/scripts/remote-recover.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# 须先安装依赖，再 verify（否则会报 Cannot find module 'jsonwebtoken'）
if ! npm ci; then
  echo "npm ci 失败，改用 npm install"
  npm install
fi
node scripts/verify-modules.js
pm2 reload goodtime-api --update-env
PORT="${PORT:-3000}"
curl -sS "http://127.0.0.1:${PORT}/api/health" || true
echo ""

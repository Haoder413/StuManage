#!/bin/bash
# 学管系统 - 启动脚本
# 用法: ./start.sh [port]

PORT="${1:-3001}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 启动学管系统 (端口 $PORT)..."
cd "$DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

# 确保 Prisma 客户端已生成
npx prisma generate --no-hints 2>/dev/null
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null

echo "🌐 http://localhost:$PORT"
exec npx next dev -p "$PORT"

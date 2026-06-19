#!/bin/bash
# 学管系统 - 停止脚本

echo "🛑 停止学管系统..."

# 查找并终止 next dev 进程
PID=$(lsof -ti:3001 2>/dev/null || echo "")
PID2=$(lsof -ti:3000 2>/dev/null || echo "")

if [ -n "$PID" ]; then
  kill "$PID" 2>/dev/null && echo "✅ 端口 3001 已关闭" || echo "⚠️  无法关闭 3001"
fi
if [ -n "$PID2" ]; then
  kill "$PID2" 2>/dev/null && echo "✅ 端口 3000 已关闭" || echo "⚠️  无法关闭 3000"
fi

# 也尝试 pkill 方式
pkill -f "next dev" 2>/dev/null && echo "✅ Next.js 进程已终止"

echo "🏁 完成"

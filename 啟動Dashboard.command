#!/bin/bash
# ===================================
#  Todo Dashboard — 一鍵啟動腳本
#  Production 模式：Port 4000
#  （Port 3000 保留給 dev server）
# ===================================

# 切換到專案目錄
cd "$(dirname "$0")"

echo "==============================="
echo "  Todo Dashboard 啟動中..."
echo "  模式：Production（Port 3002）"
echo "==============================="
echo ""

# 檢查是否需要重新打包（.next-prod 資料夾不存在時）
if [ ! -d ".next-prod" ]; then
  echo "首次啟動，正在打包（約 30 秒）..."
  npm run build
  echo ""
fi

echo "✓  啟動 PM2 Production Server on http://localhost:3002"
echo ""

# 改用 PM2 啟動（背景執行，支援自動重啟）
npm run prod:start

# 2 秒後自動開啟瀏覽器（使用 Dia）
(sleep 2 && open -a "Dia" http://localhost:3002) &

echo ""
echo "【查看狀態】npm run prod:status"
echo "【查看 log】npm run prod:logs"
echo "【關閉方式】npm run prod:stop"
echo "==============================="

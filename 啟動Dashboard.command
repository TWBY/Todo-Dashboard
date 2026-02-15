#!/bin/bash
# ===================================
#  Todo Dashboard — 一鍵啟動腳本
#  Production 模式：Port 4000
#  （Port 3000 保留給 dev server）
# ===================================

PORT=4000

# 切換到專案目錄
cd "$(dirname "$0")"

echo "==============================="
echo "  Todo Dashboard 啟動中..."
echo "  模式：Production（Port $PORT）"
echo "==============================="
echo ""

# 檢查是否已有東西跑在該 port
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠  Port $PORT 已被佔用，先關閉舊的程序..."
  lsof -ti :$PORT | xargs kill -9 2>/dev/null
  sleep 3
  # 確認 port 已釋放
  while lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; do
    echo "   等待 port 釋放中..."
    sleep 1
  done
  echo "✓  已清除"
  echo ""
fi

# 檢查是否需要重新打包（.next 資料夾不存在時）
if [ ! -d ".next" ]; then
  echo "首次啟動，正在打包（約 30 秒）..."
  npm run build
  echo ""
fi

echo "✓  啟動 Production Server on http://localhost:$PORT"
echo "✓  在瀏覽器打開 → http://localhost:$PORT"
echo ""
echo "【關閉方式】直接關掉這個 Terminal 視窗即可"
echo "==============================="
echo ""

# 2 秒後自動開啟瀏覽器（使用 Dia）
(sleep 2 && open -a "Dia" http://localhost:$PORT) &

# 啟動 production server
npx next start -p $PORT

#!/bin/bash

# Dashboard Auto-Restart Wrapper
# 用法：npm run dev:watch 或 bash dev-with-restart.sh
# 停止：在終端機按 Ctrl+C

PORT=3000
MAX_RESTARTS=3
RESTART_WINDOW=60  # 1 分鐘
RESTART_DELAY=2
LOG_FILE=".dev-restart.log"

restart_count=0
window_start=$(date +%s)

cleanup() {
  echo "[$(date '+%H:%M:%S')] Wrapper stopped by user" >> "$LOG_FILE"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "[$(date '+%H:%M:%S')] Dashboard auto-restart wrapper started" >> "$LOG_FILE"

while true; do
  now=$(date +%s)

  # Reset counter after stable window
  if [ $((now - window_start)) -gt $RESTART_WINDOW ]; then
    restart_count=0
    window_start=$now
  fi

  if [ $restart_count -ge $MAX_RESTARTS ]; then
    echo "[$(date '+%H:%M:%S')] ERROR: Restarted $MAX_RESTARTS times in ${RESTART_WINDOW}s. Stopping." >> "$LOG_FILE"
    echo "Dashboard crashed too many times. Check .dev-restart.log for details."
    exit 1
  fi

  echo "[$(date '+%H:%M:%S')] Starting dev server on port $PORT (restart #$restart_count)..." >> "$LOG_FILE"

  npx next dev -p $PORT
  exit_code=$?
  restart_count=$((restart_count + 1))

  echo "[$(date '+%H:%M:%S')] Server exited with code $exit_code. Restarting in ${RESTART_DELAY}s..." >> "$LOG_FILE"

  # 確保 port 已釋放，避免 EADDRINUSE
  kill $(lsof -ti:$PORT) 2>/dev/null
  sleep $RESTART_DELAY
done

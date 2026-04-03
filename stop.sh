#!/bin/bash
# =============================================================================
# ScheduleWeb - Stop Script
# Dừng tất cả processes liên quan đến dự án
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Stopping ScheduleWeb..."

# Kill by PID files if exist
if [ -f "$SCRIPT_DIR/logs/backend.pid" ]; then
  BACKEND_PID=$(cat "$SCRIPT_DIR/logs/backend.pid")
  echo -n "Stopping backend (PID $BACKEND_PID)... "
  kill $BACKEND_PID 2>/dev/null && echo "OK" || echo "already dead"
fi

if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
  FRONTEND_PID=$(cat "$SCRIPT_DIR/logs/frontend.pid")
  echo -n "Stopping frontend (PID $FRONTEND_PID)... "
  kill $FRONTEND_PID 2>/dev/null && echo "OK" || echo "already dead"
fi

# Also kill any process on ports 3000 and 4000
echo -n "Cleaning up ports... "
lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti :4000 2>/dev/null | xargs kill 2>/dev/null || true
echo "Done"

echo "ScheduleWeb stopped."
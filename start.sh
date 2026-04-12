#!/bin/bash
# =============================================================================
# ScheduleWeb - Startup Script
# Chạy script này để khởi động toàn bộ dự án (backend + frontend)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo_step() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

echo_ok() {
  echo -e "${GREEN}✅ $1${NC}"
}

echo_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_err() {
  echo -e "${RED}❌ $1${NC}"
}

# =============================================================================
# 1. Kill existing processes on ports 3000 and 4000
# =============================================================================
echo_step "1. Dọn dẹp processes cũ trên port 3000 (frontend) và 4000 (backend)"

kill_port() {
  local port=$1
  local name=$2
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -n "  Killing processes on port $port ($name): "
    for pid in $pids; do
      kill $pid 2>/dev/null && echo -n "$pid " || true
    done
    echo ""
    sleep 1
    # Double-check
    local remaining=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$remaining" ]; then
      echo_warn "  Port $port still in use, trying -9..."
      for pid in $remaining; do
        kill -9 $pid 2>/dev/null || true
      done
    fi
    echo_ok "Port $port đã free"
  else
    echo_ok "Port $port đã free (không có process)"
  fi
}

kill_port 3000 "Frontend"
kill_port 4000 "Backend"

# =============================================================================
# 2. Clean Next.js build cache
# =============================================================================
echo_step "2. Xóa Next.js build cache"

if [ -d "$FRONTEND_DIR/.next" ]; then
  echo "  Xóa .next directory..."
  rm -rf "$FRONTEND_DIR/.next"
fi

echo_ok "Next.js cache đã xóa"

# =============================================================================
# 3. Build Backend
# =============================================================================
echo_step "3. Build Backend (TypeScript)"

cd "$BACKEND_DIR"
echo "  Chạy: npx tsc"
npx tsc

# Verify dist output
if [ -f "dist/backend/src/server.js" ]; then
  echo_ok "Backend build thành công: dist/backend/src/server.js"
else
  echo_err "Backend build THẤT BẠI - file không tìm thấy"
  exit 1
fi

# =============================================================================
# 4. TypeScript check Frontend
# =============================================================================
echo_step "4. TypeScript check Frontend"

cd "$FRONTEND_DIR"
echo "  Chạy: npx tsc --noEmit"
if npx tsc --noEmit 2>&1; then
  echo_ok "Frontend TypeScript check thành công"
else
  echo_err "Frontend TypeScript có lỗi - kiểm tra code trước"
  exit 1
fi

# =============================================================================
# 5. Start Backend
# =============================================================================
echo_step "5. Khởi động Backend"

cd "$BACKEND_DIR"
nohup node dist/backend/src/server.js > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/logs/backend.pid"
echo_ok "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Verify backend is running
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/tasks | grep -q "200"; then
  echo_ok "Backend chạy thành công trên http://localhost:4000"
else
  echo_err "Backend KHÔNG phản hồi - xem logs/backend.log"
  cat "$SCRIPT_DIR/logs/backend.log"
  exit 1
fi

# =============================================================================
# 6. Start Frontend (Next.js dev)
# =============================================================================
echo_step "6. Khởi động Frontend (Next.js dev server)"

cd "$FRONTEND_DIR"
# Cố định cổng sau khi đã kill 3000 ở bước 1 — tránh Next tự đổi (3004…) khiến bước kiểm tra HTTP bị miss.
PORT=3000 nohup npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/logs/frontend.pid"
echo_ok "Frontend PID: $FRONTEND_PID"

# Next.js dev (nhất là Turbopack) lần đầu thường cần >5s để compile — thử lặp thay vì kiểm tra một lần.
echo "  Đang đợi Next.js phản hồi (có thể 30–90 giây lần đầu sau khi xóa .next)..."
FRONTEND_PORT=""
attempt=0
max_attempts=30
while [ $attempt -lt $max_attempts ] && [ -z "$FRONTEND_PORT" ]; do
  attempt=$((attempt + 1))
  # PORT=3000 đã set ở trên; nếu vẫn bị chiếm, Next có thể nhảy 3001…
  for port in 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$port/" 2>/dev/null || echo "000")
    case "$STATUS" in
      2??|3??)
        FRONTEND_PORT=$port
        echo_ok "Frontend chạy thành công trên http://localhost:$port (HTTP $STATUS)"
        break 2
        ;;
    esac
  done
  if [ -z "$FRONTEND_PORT" ]; then
    if [ $((attempt % 5)) -eq 0 ] || [ "$attempt" -eq 1 ]; then
      echo "  ... vẫn đợi ($attempt/$max_attempts, mỗi 3s thử lại)"
    fi
    sleep 3
  fi
done

if [ -z "$FRONTEND_PORT" ]; then
  echo_err "Frontend KHÔNG phản hồi sau $((max_attempts * 3))s — xem logs/frontend.log"
  cat "$SCRIPT_DIR/logs/frontend.log"
  exit 1
fi

# =============================================================================
# 7. Summary
# =============================================================================
echo_step "🎉 HOÀN TẤT - Dự án đang chạy!"
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  Backend:  http://localhost:4000         │"
echo "  │  Frontend: http://localhost:$FRONTEND_PORT         │"
echo "  │  Backend PID:  $BACKEND_PID"
echo "  │  Frontend PID: $FRONTEND_PID"
echo "  │                                         │"
echo "  │  Logs:"
echo "  │  - Backend:  $SCRIPT_DIR/logs/backend.log"
echo "  │  - Frontend: $SCRIPT_DIR/logs/frontend.log"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  Để dừng dự án: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "  Lưu ý: Đảm bảo backend chạy đúng project /ScheduleWebNew/"
echo "         Nếu frontend báo 'Port 4000 connection failed',"
echo "         kiểm tra xem backend có đang chạy đúng process không."
echo ""

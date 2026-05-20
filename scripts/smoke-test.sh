#!/usr/bin/env bash
# Smoke test cho Phase 1.
# Chạy thủ công trong container backend:
#   docker exec -it browser-manager-backend bash /app/scripts/smoke-test.sh
#
# Kịch bản:
#   1. Start Xvfb trên display :100
#   2. Start x11vnc gắn vào :100, port 5901
#   3. Start websockify gateway 6001 -> localhost:5901
#   4. Launch Chromium headful với --remote-debugging-port=9223
#   5. Verify:
#        - CDP endpoint http://localhost:9223/json/version trả về Chromium info
#        - Websockify đang listen ở 6001
#   6. In hướng dẫn để mở Live View trên host
#
# Sau khi test xong, nhấn Ctrl+C để cleanup tất cả tiến trình.

set -euo pipefail

SLOT_ID="${SLOT_ID:-1}"
DISPLAY_NUM=$((99 + SLOT_ID))
DISPLAY=":${DISPLAY_NUM}"
VNC_PORT=$((5900 + SLOT_ID))
WS_PORT=$((6000 + SLOT_ID))
CDP_PORT=$((9222 + SLOT_ID))
PROFILE_DIR="/app/profiles_data/smoke_profile_${SLOT_ID}"

mkdir -p "${PROFILE_DIR}"
# Dọn lock cũ (nếu lần chạy trước crash)
rm -f "${PROFILE_DIR}/SingletonLock" \
      "${PROFILE_DIR}/SingletonCookie" \
      "${PROFILE_DIR}/SingletonSocket" || true

PIDS=()

cleanup() {
  echo ""
  echo "[smoke] Cleanup..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  # x11vnc đôi khi không bị giết hết bởi PID parent
  pkill -9 -f "x11vnc.*rfbport ${VNC_PORT}" 2>/dev/null || true
  pkill -9 -f "Xvfb ${DISPLAY}"             2>/dev/null || true
  pkill -9 -f "websockify ${WS_PORT}"       2>/dev/null || true
  echo "[smoke] Done."
}
trap cleanup EXIT INT TERM

echo "[smoke] Slot=${SLOT_ID}  DISPLAY=${DISPLAY}  VNC=${VNC_PORT}  WS=${WS_PORT}  CDP=${CDP_PORT}"
echo "[smoke] Profile dir: ${PROFILE_DIR}"

echo "[smoke] Starting Xvfb..."
Xvfb "${DISPLAY}" -screen 0 1920x1080x24 -nolisten tcp &
PIDS+=($!)
sleep 0.5

echo "[smoke] Starting x11vnc..."
x11vnc -display "${DISPLAY}" -nopw -listen localhost -xkb -forever -shared \
       -rfbport "${VNC_PORT}" -quiet &
PIDS+=($!)
sleep 0.5

echo "[smoke] Starting websockify ${WS_PORT} -> localhost:${VNC_PORT}..."
websockify "0.0.0.0:${WS_PORT}" "localhost:${VNC_PORT}" \
           --web=/usr/share/novnc >/tmp/websockify_${WS_PORT}.log 2>&1 &
PIDS+=($!)
sleep 0.5

echo "[smoke] Launching Chromium..."
# Playwright base image cung cấp chromium binary trong /ms-playwright; tìm path
CHROME_BIN="$(find /ms-playwright -maxdepth 4 -type f -name chrome 2>/dev/null | head -n1)"
if [[ -z "${CHROME_BIN}" ]]; then
  echo "[smoke] ERROR: Không tìm thấy Chromium trong /ms-playwright. Kiểm tra base image." >&2
  exit 1
fi
echo "[smoke] Chromium binary: ${CHROME_BIN}"

DISPLAY="${DISPLAY}" "${CHROME_BIN}" \
  --user-data-dir="${PROFILE_DIR}" \
  --no-sandbox \
  --no-first-run \
  --no-default-browser-check \
  --disable-dev-shm-usage \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-features=Translate,VizDisplayCompositor \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port="${CDP_PORT}" \
  --remote-allow-origins=* \
  about:blank 2> >(grep -vE 'bus\.cc|object_proxy\.cc|viz_main_impl\.cc|command_buffer_proxy_impl\.cc' >&2) &
PIDS+=($!)

echo "[smoke] Waiting for CDP to come up..."
for i in {1..20}; do
  if curl -sf "http://localhost:${CDP_PORT}/json/version" >/dev/null; then
    break
  fi
  sleep 0.5
done

echo ""
echo "===================== VERIFY ====================="
echo "[smoke] CDP /json/version:"
curl -sf "http://localhost:${CDP_PORT}/json/version" || { echo "FAIL"; exit 1; }
echo ""
echo "[smoke] Websockify listening:"
netstat -tlnp 2>/dev/null | grep ":${WS_PORT}\b" || echo "WARN: không thấy listen"
echo "[smoke] Xvfb processes:"
pgrep -af "Xvfb ${DISPLAY}" || true
echo "=================================================="
echo ""
echo "[smoke] Live View URL trên host:"
echo "    http://localhost:${WS_PORT}/vnc.html?host=localhost&port=${WS_PORT}&path=&autoconnect=true&resize=scale"
echo ""
echo "[smoke] CDP endpoint cho Playwright (chạy từ Windows host):"
echo "    http://localhost:${CDP_PORT}"
echo ""
echo "[smoke] Nhấn Ctrl+C để dừng và cleanup."
wait

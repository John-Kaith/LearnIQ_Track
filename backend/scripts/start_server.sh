#!/usr/bin/env bash
# Ubuntu startup helper: activates venv, runs uvicorn, opens a Cloudflare
# quick tunnel, and prints the public trycloudflare.com URL.
#
# Usage: ./start_server.sh
# Stop everything with Ctrl+C (kills both uvicorn and cloudflared).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
else
    echo "Could not find venv/bin/activate in backend/ or its parent." >&2
    exit 1
fi

UVICORN_LOG="/tmp/learniq_uvicorn.log"
TUNNEL_LOG="/tmp/learniq_tunnel.log"

echo "Starting backend (uvicorn)..."
uvicorn main:app --host 0.0.0.0 --port 8000 > "$UVICORN_LOG" 2>&1 &
UVICORN_PID=$!

cleanup() {
    echo ""
    echo "Stopping backend and tunnel..."
    kill "$UVICORN_PID" "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 2
if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "uvicorn failed to start. Log output:"
    cat "$UVICORN_LOG"
    exit 1
fi

echo "Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

echo "Waiting for public URL..."
URL=""
for i in $(seq 1 20); do
    URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -n1 || true)
    if [ -n "$URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo "Could not find the tunnel URL yet. Check $TUNNEL_LOG manually."
else
    echo ""
    echo "=================================================="
    echo " LearnIQ is live at: $URL"
    echo "=================================================="
fi

echo ""
echo "Backend and tunnel are running. Press Ctrl+C to stop both."
wait

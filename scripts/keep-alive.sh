#!/bin/bash
# Prescio server + tunnel keep-alive script
# Restarts processes if they die (SIGKILL from memory pressure)

PRESCIO_DIR="/Users/kooroot/.openclaw/workspace/Prescio"
NODE_BIN="/Users/kooroot/.nvm/versions/node/v24.13.0/bin"
LOG_DIR="$PRESCIO_DIR/apps/server/.data/logs"
mkdir -p "$LOG_DIR"

SERVER_PID=""
TUNNEL_PID=""
TUNNEL_URL=""

cleanup() {
  echo "[keep-alive] Shutting down..."
  [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null
  [ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

start_server() {
  echo "[keep-alive] Starting server..."
  cd "$PRESCIO_DIR/apps/server"
  PATH="$NODE_BIN:$PATH" NODE_OPTIONS="--max-old-space-size=256" \
    "$NODE_BIN/tsx" watch src/index.ts >> "$LOG_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  echo "[keep-alive] Server started (PID: $SERVER_PID)"
}

start_tunnel() {
  echo "[keep-alive] Starting tunnel..."
  cloudflared tunnel --url http://localhost:3001 > "$LOG_DIR/tunnel.log" 2>&1 &
  TUNNEL_PID=$!
  echo "[keep-alive] Tunnel started (PID: $TUNNEL_PID)"
  
  # Wait for tunnel URL
  for i in $(seq 1 15); do
    sleep 2
    TUNNEL_URL=$(grep -o 'https://[a-z-]*\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | tail -1)
    if [ -n "$TUNNEL_URL" ]; then
      echo "[keep-alive] Tunnel URL: $TUNNEL_URL"
      # Update wrangler.toml
      sed -i '' "s|API_BACKEND = \"https://.*trycloudflare.com\"|API_BACKEND = \"$TUNNEL_URL\"|" \
        "$PRESCIO_DIR/apps/web/wrangler.toml"
      # Update server .env
      sed -i '' "s|https://.*trycloudflare.com|$TUNNEL_URL|g" \
        "$PRESCIO_DIR/apps/server/.env"
      # Deploy workers
      echo "[keep-alive] Deploying workers..."
      cd "$PRESCIO_DIR/apps/web"
      PATH="$NODE_BIN:$PATH" npx wrangler deploy >> "$LOG_DIR/deploy.log" 2>&1
      echo "[keep-alive] Workers deployed"
      return
    fi
  done
  echo "[keep-alive] WARNING: Could not get tunnel URL"
}

# Clear zombie games on start
echo '[]' > "$PRESCIO_DIR/apps/server/.data/active-games.json" 2>/dev/null

# Initial start
start_server
sleep 3
start_tunnel

# Monitor loop
echo "[keep-alive] Monitoring... (check every 30s)"
while true; do
  sleep 30
  
  # Check server
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[keep-alive] $(date) Server died! Restarting..."
    # Clean port
    /usr/sbin/lsof -ti:3001 | xargs kill -9 2>/dev/null
    sleep 2
    echo '[]' > "$PRESCIO_DIR/apps/server/.data/active-games.json" 2>/dev/null
    start_server
    sleep 3
  fi
  
  # Check tunnel
  if ! kill -0 $TUNNEL_PID 2>/dev/null; then
    echo "[keep-alive] $(date) Tunnel died! Restarting..."
    sleep 2
    start_tunnel
  fi
done

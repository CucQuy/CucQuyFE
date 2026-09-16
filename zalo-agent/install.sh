#!/usr/bin/env bash
# Cai cucquy-zalo-agent lam LaunchAgent (macOS) — chay tren may co Zalo desktop
# la THANH VIEN nhom "Hoa don Tiem". Cai 1 lan, tu chay lai khi dang nhap.
set -euo pipefail

DEST="$HOME/.cucquy/zalo-agent"
LABEL="site.cucquy.zaloagent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SRC="$(cd "$(dirname "$0")" && pwd)"

# --- Env bat buoc ---
: "${ZALO_AGENT_TOKEN:?Can dat ZALO_AGENT_TOKEN (khop env BE PRINT... rieng cho zalo)}"
CUCQUY_API="${CUCQUY_API:-https://api.cucquy.site}"
ZALO_GROUP_ID="${ZALO_GROUP_ID:-1949125421175210627}"   # Hoa don Tiem
ZALO_MACHINE_NAME="${ZALO_MACHINE_NAME:-$(scutil --get ComputerName 2>/dev/null || hostname)}"
ZALO_CDP_PORT="${ZALO_CDP_PORT:-9222}"

command -v node >/dev/null || { echo "[LOI] Can Node.js (>=18)."; exit 1; }

echo "==> Copy agent -> $DEST"
mkdir -p "$DEST"
rsync -a --delete --exclude node_modules "$SRC/" "$DEST/"
( cd "$DEST" && npm install --omit=dev --no-audit --no-fund )

echo "==> Viet LaunchAgent $PLIST"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$(command -v node)</string><string>$DEST/agent.mjs</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>CUCQUY_API</key><string>$CUCQUY_API</string>
    <key>ZALO_AGENT_TOKEN</key><string>$ZALO_AGENT_TOKEN</string>
    <key>ZALO_GROUP_ID</key><string>$ZALO_GROUP_ID</string>
    <key>ZALO_MACHINE_NAME</key><string>$ZALO_MACHINE_NAME</string>
    <key>ZALO_CDP_PORT</key><string>$ZALO_CDP_PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DEST/agent.log</string>
  <key>StandardErrorPath</key><string>$DEST/agent.err.log</string>
</dict></plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "==> Da cai. Log: $DEST/agent.log"
echo "LUU Y: Zalo phai chay voi --remote-debugging-port=$ZALO_CDP_PORT va dang nhap nick"
echo "       la thanh vien nhom 'Hoa don Tiem'. Mo Zalo bang:"
echo "       open -a Zalo --args --remote-debugging-port=$ZALO_CDP_PORT"

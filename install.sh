#!/bin/bash
# install.sh — Animated Weather Desklet installer for Cinnamon
set -e

DEST="${HOME}/.local/share/cinnamon/desklets/weather-animated@zulus"
SRC="$(dirname "$0")"

echo "☀️ Installing Animated Weather Desklet..."

# Create destination
mkdir -p "$DEST"

# Copy files
cp -v "$SRC/desklet.js"       "$DEST/" 2>/dev/null || true
cp -v "$SRC/metadata.json"    "$DEST/" 2>/dev/null || true
cp -v "$SRC/settings-schema.json" "$DEST/" 2>/dev/null || true
cp -v "$SRC/stylesheet.css"   "$DEST/" 2>/dev/null || true

echo "✅ Installed to: $DEST"
echo ""
echo "⚠️  Restart Cinnamon: Ctrl+Alt+Esc"
echo "   Then: Right-click desktop → Add Desklet → Animated Weather"
echo ""
echo "🔑 Don't forget to get a free API key:"
echo "   https://openweathermap.org/api"
echo ""

# Check if curl exists and offer to create config
if command -v curl &>/dev/null; then
    echo "📡  Checking internet connectivity..."
    if curl -s --max-time 3 https://openweathermap.org >/dev/null 2>&1; then
        echo "✅ Internet OK"
    else
        echo "⚠️  No internet connection — you'll need to configure API key later"
    fi
fi

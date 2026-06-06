#!/bin/bash
# install.sh — Animated Weather Desklet installer for Cinnamon
# Works both from cloned repo and via curl | bash
set -e

REPO="https://raw.githubusercontent.com/Zulus-Code/cinnamon-animated-weather-desklet/master"
DEST="${HOME}/.local/share/cinnamon/desklets/weather-animated@zulus"

echo "☀️ Installing Animated Weather Desklet..."
echo ""

# Create destination
mkdir -p "$DEST"

# Check if we're in a git repo (local install)
if [ -f "desklet.js" ] && [ -f "metadata.json" ]; then
    echo "📁 Local install found, copying files..."
    cp -v desklet.js           "$DEST/"
    cp -v metadata.json        "$DEST/"
    cp -v settings-schema.json "$DEST/"
    cp -v stylesheet.css       "$DEST/"
else
    echo "📡 Downloading from GitHub..."
    for f in desklet.js metadata.json settings-schema.json stylesheet.css; do
        echo "  Downloading $f..."
        curl -sL "${REPO}/${f}" -o "${DEST}/${f}"
        if [ ! -s "${DEST}/${f}" ]; then
            echo "❌ Failed to download $f"
            exit 1
        fi
    done
fi

echo ""
echo "✅ Installed to: $DEST"
echo ""
echo "⚠️  Restart Cinnamon: Ctrl+Alt+Esc"
echo "   Then: Right-click desktop → Add Desklet → Animated Weather"
echo ""
echo "🔑 Get a free API key at: https://openweathermap.org/api"
echo ""

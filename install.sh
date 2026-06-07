#!/bin/bash
# install.sh — Animated Weather Desklet installer for Cinnamon
# Works both from cloned repo and via curl | bash
set -e

REPO="https://raw.githubusercontent.com/Zulus-Code/cinnamon-animated-weather-desklet/master"
DEST="${HOME}/.local/share/cinnamon/desklets/weather-animated@zulus"

echo "☀️ Installing Animated Weather Desklet..."
echo ""

echo "⚠️  NOTE: git clone is the recommended installation method:"
echo ""
echo "    git clone https://github.com/Zulus-Code/cinnamon-animated-weather-desklet.git \\"
echo "      ~/.local/share/cinnamon/desklets/weather-animated@zulus/"
echo ""

# Create destination
mkdir -p "$DEST"

# All required files for the desklet
FILES=(
    desklet.js
    constants.js
    weatherService.js
    renderer.js
    particleSystem.js
    sceneBuilder.js
    utils.js
    metadata.json
    settings-schema.json
    stylesheet.css
)

# Check if we're in a local repo (desklet.js exists next to install.sh)
if [ -f "metadata.json" ]; then
    echo "📁 Local install found, copying files..."
    for f in "${FILES[@]}"; do
        if [ -f "$f" ]; then
            cp -v "$f" "$DEST/"
        else
            echo "⚠️  WARNING: $f not found, skipping"
        fi
    done
    # Also copy translation files if available
    if [ -d "po" ]; then
        cp -r po "$DEST/"
    fi
else
    echo "📡 Downloading from GitHub..."
    for f in "${FILES[@]}"; do
        echo "  Downloading $f..."
        curl -sL "${REPO}/${f}" -o "${DEST}/${f}"
        if [ ! -s "${DEST}/${f}" ]; then
            echo "❌ Failed to download $f"
            exit 1
        fi
    done
    # Download translations
    mkdir -p "${DEST}/po"
    for pf in ru.po weather-animated@zulus.pot; do
        echo "  Downloading po/${pf}..."
        curl -sL "${REPO}/po/${pf}" -o "${DEST}/po/${pf}"
    done
fi

echo ""
echo "✅ Installed to: $DEST"
echo ""
echo "⚠️  Restart Cinnamon: Ctrl+Alt+Esc"
echo "   Then: Right-click desktop → Add Desklet → Анимированная погода (Animated Weather)"
echo ""
echo "📖 No API key required — Open-Meteo is free and works out of the box."
echo ""

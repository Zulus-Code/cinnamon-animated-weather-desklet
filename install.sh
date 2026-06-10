#!/bin/bash
# install.sh — Animated Weather Desklet installer for Cinnamon
# Works: local (git clone + ./install.sh), curl | bash, and make install
set -e

REPO="https://raw.githubusercontent.com/Zulus-Code/cinnamon-animated-weather-desklet/master"
DEST="${HOME}/.local/share/cinnamon/desklets/weather-animated@zulus"
VERSION="2.2.0"

# ── Colors ──
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'

info()  { echo -e " ${B}ℹ${N} $1"; }
ok()    { echo -e " ${G}✓${N} $1"; }
warn()  { echo -e " ${Y}⚠${N} $1"; }
err()   { echo -e " ${R}✗${N} $1"; }

# ── Flags ──
MODE="install"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --uninstall|-u) MODE="uninstall"; shift ;;
        --version|-v)   echo "Animated Weather Desklet v${VERSION}"; exit 0 ;;
        --help|-h)
            echo "Usage: ./install.sh [OPTION]"
            echo ""
            echo "  install      Copy desklet files (default)"
            echo "  --uninstall  Remove desklet files"
            echo "  --version    Show version"
            echo "  --help       This message"
            exit 0 ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Uninstall ──
if [[ "$MODE" == "uninstall" ]]; then
    echo "🗑️  Removing Animated Weather Desklet..."
    if [[ -d "$DEST" ]]; then
        rm -rf "$DEST"
        ok "Removed $DEST"
    else
        info "Not installed"
    fi
    exit 0
fi

# ── Install ──
echo "☀️  Animated Weather Desklet v${VERSION}"
echo ""

# All required files
FILES=(
    desklet.js constants.js weatherService.js renderer.js
    particleSystem.js sceneBuilder.js utils.js
    metadata.json settings-schema.json stylesheet.css
)

# Create destination
mkdir -p "$DEST"

# Local install (we're in the repo)
if [[ -f "metadata.json" ]]; then
    info "Local install — copying files..."
    for f in "${FILES[@]}"; do
        if [[ -f "$f" ]]; then
            cp "$f" "$DEST/" && ok "  $f"
        else
            warn "  $f not found, skipping"
        fi
    done
    if [[ -d "po" ]]; then
        cp -r po "$DEST/" && ok "  translations (po/)"
    fi
# Remote install (curl | bash)
else
    info "Downloading from GitHub..."
    for f in "${FILES[@]}"; do
        echo -n "  $f ... "
        curl -sL "${REPO}/${f}" -o "${DEST}/${f}"
        if [[ ! -s "${DEST}/${f}" ]]; then
            echo -e "${R}failed${N}"
            err "Could not download $f"
            exit 1
        fi
        echo -e "${G}done${N}"
    done
    # Translations
    mkdir -p "${DEST}/po"
    for pf in ru.po weather-animated@zulus.pot; do
        echo -n "  po/${pf} ... "
        curl -sL "${REPO}/po/${pf}" -o "${DEST}/po/${pf}" && echo -e "${G}done${N}" || warn "  po/${pf} unavailable"
    done
fi

# Version stamp
printf '%s' "$VERSION" > "$DEST/.version"

echo ""
ok "Installed to $DEST"
echo ""
echo -e " ${Y}Next steps:${N}"
echo "   1. Restart Cinnamon:  Ctrl+Alt+Esc"
echo "   2. Right-click desktop → Add desklet → Animated Weather"
echo ""
echo " 📖 Open-Meteo is free — no API key required."
echo ""

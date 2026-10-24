#!/usr/bin/env bash
# Re-renders the social preview image and app icons into public/ using headless Chrome.
# Usage: npm run social-images
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=../../public
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --force-device-scale-factor=1 --window-size="$2" --screenshot="$OUT/$3" "file://$PWD/$1" >/dev/null 2>&1; }
shot og.html 1200,630 og-image.png
shot icon.html 512,512 icon-512.png
# smaller icons are scaled down from the 512px render (macOS sips)
sips -Z 192 "$OUT/icon-512.png" --out "$OUT/icon-192.png" >/dev/null
sips -Z 180 "$OUT/icon-512.png" --out "$OUT/apple-touch-icon.png" >/dev/null
echo "done: og-image.png, icon-512.png, icon-192.png, apple-touch-icon.png"

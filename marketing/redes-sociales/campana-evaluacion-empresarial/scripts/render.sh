#!/bin/zsh
# Regenera los PNG 1080×1080 de la campaña a partir de los HTML editables.
# Uso:  ./scripts/render.sh            → renderiza propuesta A y B
#       ./scripts/render.sh a          → solo propuesta A
#       ./scripts/render.sh b          → solo propuesta B
# Requiere Google Chrome (macOS). Las fuentes Avenir Next / Avenir Next Condensed vienen con macOS.

set -e
ROOT="${0:A:h:h}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

render() {
  local dir="$ROOT/propuesta-$1"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1080 --allow-file-access-from-files \
    --virtual-time-budget=3000 \
    --screenshot="$dir/propuesta-$1.png" "file://$dir/propuesta-$1.html" >/dev/null 2>&1
  echo "✓ $dir/propuesta-$1.png"
}

targets=("$@")
(( ${#targets} )) || targets=(a b)
for t in $targets; do render $t; done

# Comparativa lado a lado (requiere Python 3 con Pillow)
if python3 -c "import PIL" 2>/dev/null; then
  python3 "$ROOT/scripts/comparativa.py" "$ROOT" && echo "✓ $ROOT/comparativa.png"
fi

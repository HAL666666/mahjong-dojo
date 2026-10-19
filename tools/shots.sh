#!/bin/sh
# 実行: sh tools/shots.sh — ローカルサーバーを立てて headless Chrome で screens/v4-*.png を撮る（390×844 @2x）
# 対局画面は ?autoplay=until:… で CPU に自動で打たせ、条件の局面で止める。牌山は毎回ランダム（仕込みなし）。
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-8765}
python3 -m http.server "$PORT" >/dev/null 2>&1 & SRV=$!
sleep 1
shot() { # 名前 高さ URL
  P=$(mktemp -d)
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --user-data-dir="$P" \
    --force-device-scale-factor=2 --window-size=390,"$2" --virtual-time-budget="${BUDGET:-600000}" \
    --screenshot="screens/v4-$1.png" "http://localhost:$PORT/index.html$3" >/dev/null 2>&1
  rm -rf "$P"; echo "screens/v4-$1.png"
}
shot home 844 '#home'
shot call 844 '?autoplay=until:call&explain=1#game'
shot melds 844 '?autoplay=until:melds#game'
shot win 1300 '?autoplay=until:openyaku#game'
shot danger 1508 '?autoplay=until:danger&explain=1#game'
shot results 844 '?autoplay=full#game'
kill $SRV

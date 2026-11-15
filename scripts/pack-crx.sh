#!/bin/bash
# 打包 .crx：使用固定私钥签名，保证扩展 ID 稳定、可自动更新。
# 私钥保存在 .keys/（不入库），丢失后扩展 ID 会变化，无法再走自动更新。
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/extension"
KEY="$ROOT/.keys/lingualens.pem"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -f "$KEY" ]; then
  mkdir -p "$ROOT/.keys"
  openssl genrsa -out "$KEY" 2048
fi

rm -f "$ROOT/public/extension.crx" "$ROOT/public/lingualens.crx"

"$CHROME" --pack-extension="$SRC" --pack-extension-key="$KEY" \
  --user-data-dir=/tmp/crxpack-profile --no-message-box >/dev/null 2>&1 || true

if [ ! -f "$ROOT/public/extension.crx" ]; then
  echo "pack failed: chrome 未生成 crx" >&2
  exit 1
fi

mv "$ROOT/public/extension.crx" "$ROOT/public/lingualens.crx"
ls -l "$ROOT/public/lingualens.crx"

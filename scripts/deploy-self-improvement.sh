#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT_DIR/wrangler.self-improvement.toml"
if [[ ! -f "$CONFIG" ]]; then
  echo "[CPB-01] Missing $CONFIG. Run: bash scripts/bootstrap-self-improvement.sh" >&2
  exit 1
fi
cd "$ROOT_DIR"
npx --yes wrangler@4 deploy --config "$CONFIG"

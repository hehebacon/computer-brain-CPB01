#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT_DIR/wrangler.self-improvement.toml"
[[ -f "$CONFIG" ]] || { echo "[CPB-01] Missing local Wrangler config. Run bootstrap first." >&2; exit 1; }
cd "$ROOT_DIR"
echo "[CPB-01] Checking Cloudflare authentication..."
npx --yes wrangler@4 whoami
echo "[CPB-01] Checking D1 migration tables..."
npx --yes wrangler@4 d1 execute "${CPB_D1_NAME:-cpb01-learning}" --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('knowledge_sources','knowledge_items','knowledge_evidence','update_runs','update_events','research_topics') ORDER BY name;" --config "$CONFIG"
echo "[CPB-01] Checking R2 bucket presence..."
npx --yes wrangler@4 r2 bucket list
if [[ -n "${CPB_WORKER_URL:-}" ]]; then
  command -v curl >/dev/null 2>&1 || { echo "curl is required when CPB_WORKER_URL is set." >&2; exit 1; }
  echo "[CPB-01] Checking Worker health endpoint..."
  curl --fail --silent --show-error "${CPB_WORKER_URL%/}/health"
  echo
else
  echo "[CPB-01] Set CPB_WORKER_URL to also verify the deployed /health endpoint."
fi
echo "[CPB-01] Verification commands completed. Confirm the D1 query returns all six tables and the R2 bucket list contains ${CPB_RECOVERY_BUCKET:-cpb01-recovery}."

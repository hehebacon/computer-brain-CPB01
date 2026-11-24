#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_NAME="${CPB_D1_NAME:-cpb01-learning}"
R2_BUCKET="${CPB_RECOVERY_BUCKET:-cpb01-recovery}"
WORKER_CONFIG="$ROOT_DIR/wrangler.self-improvement.toml"
REPOSITORY="${GITHUB_REPOSITORY:-hehebacon/computer-brain-CPB01}"
CRON="${CPB_RESEARCH_CRON:-0 */6 * * *}"

wrangler() { npx --yes wrangler@4 "$@"; }
fail() { printf '[CPB-01 setup] ERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '\n[CPB-01 setup] %s\n' "$*"; }

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
[[ -f migrations/0001_self_improvement.sql ]] || fail "Migration file is missing."
[[ -f worker/self-improvement-worker.js ]] || fail "Self-improvement Worker entry point is missing."

info "Checking Cloudflare authentication..."
wrangler whoami >/dev/null

json_value() {
  node --input-type=module -e '
    let raw="";
    for await (const chunk of process.stdin) raw += chunk;
    const start = raw.search(/[\[{]/);
    if (start < 0) process.exit(2);
    let value;
    try { value = JSON.parse(raw.slice(start)); } catch { process.exit(2); }
    const rows = Array.isArray(value) ? value : (value.result || value.buckets || value.databases || []);
    const row = rows.find(x => x.name === process.argv[1]);
    if (!row) process.exit(3);
    const result = row.uuid || row.database_id || row.id || row.name;
    if (!result) process.exit(4);
    process.stdout.write(String(result));
  ' "$1"
}

info "Finding or creating D1 database: $DB_NAME"
D1_LIST="$(wrangler d1 list --json)"
if D1_ID="$(printf '%s' "$D1_LIST" | json_value "$DB_NAME" 2>/dev/null)"; then
  info "D1 database already exists."
else
  wrangler d1 create "$DB_NAME"
  D1_LIST="$(wrangler d1 list --json)"
  D1_ID="$(printf '%s' "$D1_LIST" | json_value "$DB_NAME" 2>/dev/null)" || fail "Could not read the new D1 database ID from Wrangler JSON output."
fi

info "Finding or creating protected R2 bucket: $R2_BUCKET"
if wrangler r2 bucket info "$R2_BUCKET" --json >/dev/null 2>&1; then
  info "R2 bucket already exists."
else
  wrangler r2 bucket create "$R2_BUCKET"
fi

info "Writing local Wrangler config (ignored by Git; contains no secrets)."
cat > "$WORKER_CONFIG" <<EOF
name = "cpb01-self-improvement"
main = "worker/self-improvement-worker.js"
compatibility_date = "2026-11-23"

[vars]
GITHUB_REPOSITORY = "$REPOSITORY"

[[d1_databases]]
binding = "DB"
database_name = "$DB_NAME"
database_id = "$D1_ID"

[triggers]
crons = ["$CRON"]
EOF
chmod 600 "$WORKER_CONFIG"

info "Applying idempotent D1 migration..."
wrangler d1 execute "$DB_NAME" --remote --file=migrations/0001_self_improvement.sql --config "$WORKER_CONFIG"

info "Configuring Worker secrets."
cat <<'NOTICE'
Wrangler will prompt for each secret. Paste it only into the hidden Wrangler prompt.
Do not paste secrets into chat, source files, GitHub variables, or shell command arguments.
Use a repository-scoped GitHub token with Contents and Pull requests read/write only.
NOTICE
for secret_name in AGENT_API_SECRET GITHUB_TOKEN BRAVE_SEARCH_API_KEY; do
  printf '\nConfigure %s now? [Y/n] ' "$secret_name"
  read -r answer
  case "${answer:-Y}" in
    n|N|no|NO) fail "Missing required Worker secret: $secret_name. Re-run this script to finish setup." ;;
    *) wrangler secret put "$secret_name" --config "$WORKER_CONFIG" ;;
  esac
done

info "Deploying the dedicated self-improvement Worker..."
wrangler deploy --config "$WORKER_CONFIG"

info "Infrastructure setup completed."
printf '\nD1 database: %s\nR2 recovery bucket: %s (created separately; deliberately NOT bound to the agent broker)\nWorker: cpb01-self-improvement\nCron: %s\n' "$DB_NAME" "$R2_BUCKET" "$CRON"
printf '\nNext: run bash scripts/verify-self-improvement.sh\n'
printf 'The external proposal generator still needs to be connected to POST /propose; see README.md.\n'

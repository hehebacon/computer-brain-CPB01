#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
usage() { cat <<'EOF'
CPB-01 build helper
Usage:
  bash build.sh          Build the static site into ./dist
  bash build.sh clean    Remove generated ./dist
  bash build.sh serve    Build and serve ./dist at http://localhost:8000
EOF
}
build() {
 echo "[CPB-01] Checking source files..."
 for file in index.html brain.js input-engine.js universal-representation.js cognitive-core.js human-cognitive-systems.js; do
  if [[ ! -f "${ROOT_DIR}/${file}" ]]; then echo "[ERROR] Missing required file: ${file}" >&2; exit 1; fi
 done
 if ! grep -q 'input-engine.js' "${ROOT_DIR}/brain.js" || ! grep -q 'universal-representation.js' "${ROOT_DIR}/input-engine.js" || ! grep -q 'cognitive-core.js' "${ROOT_DIR}/brain.js" || ! grep -q 'human-cognitive-systems.js' "${ROOT_DIR}/cognitive-core.js"; then echo "[ERROR] Input engine dependency is missing" >&2; exit 1; fi
 rm -rf -- "${DIST_DIR}"
 mkdir -p -- "${DIST_DIR}"
 cp -- "${ROOT_DIR}/index.html" "${DIST_DIR}/index.html"
 cp -- "${ROOT_DIR}/brain.js" "${DIST_DIR}/brain.js"
 cp -- "${ROOT_DIR}/input-engine.js" "${DIST_DIR}/input-engine.js"
 cp -- "${ROOT_DIR}/universal-representation.js" "${DIST_DIR}/universal-representation.js"
 cp -- "${ROOT_DIR}/cognitive-core.js" "${DIST_DIR}/cognitive-core.js"
 cp -- "${ROOT_DIR}/human-cognitive-systems.js" "${DIST_DIR}/human-cognitive-systems.js"
 if [[ -f "${ROOT_DIR}/README.md" ]]; then cp -- "${ROOT_DIR}/README.md" "${DIST_DIR}/README.md"; fi
 echo "[CPB-01] Build complete. Output: ${DIST_DIR}"
}
clean() { rm -rf -- "${DIST_DIR}"; echo "[CPB-01] Removed dist/."; }
serve() {
 build
 if command -v python3 >/dev/null 2>&1; then
  cd -- "${DIST_DIR}"
  exec python3 -m http.server 8000
 else
  echo "[ERROR] python3 is required." >&2
  exit 1
 fi
}
case "${1:-build}" in
 build) build ;;
 clean) clean ;;
 serve) serve ;;
 -h|--help|help) usage ;;
 *) echo "[ERROR] Unknown command: $1" >&2; usage >&2; exit 2 ;;
esac

#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
output_dir="$(mktemp -d)"

cleanup() {
  rm -rf -- "${output_dir}"
}
trap cleanup EXIT

WRANGLER_WRITE_LOGS=false \
WRANGLER_LOG_PATH="${output_dir}/wrangler.log" \
timeout \
  --signal=TERM \
  --kill-after=10s \
  2m \
  "${project_root}/node_modules/.bin/wrangler" deploy \
    --config "${project_root}/index-worker/wrangler.jsonc" \
    --dry-run \
    --outdir "${output_dir}"

test -f "${output_dir}/index.js"
echo "Validated independent index Worker bundle."

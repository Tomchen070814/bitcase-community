#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

live_upstream_pattern='https://(skills\.sh|api\.github\.com|raw\.githubusercontent\.com)|searchGithubRadar|searchSkillsCatalog|inspectGithubSkill[[:space:]]*\('
secret_pattern='ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9]{32,}'

if rg -n "${live_upstream_pattern}" worker/index.ts; then
  echo "Site Worker still contains a live upstream search/read path." >&2
  exit 1
fi

if rg -n "${secret_pattern}" \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!.git/**' \
  --glob '!package-lock.json' \
  .; then
  echo "A credential-shaped value may have been committed." >&2
  exit 1
fi

rg -n 'snapshot_only' worker/index.ts tests/rendered-html.test.mjs
rg -n '0 \*/6 \* \* \*|30 \*/12 \* \* \*|15 2 \* \* \*' \
  index-worker/wrangler.jsonc index-worker/src/index.ts
rg -n 'skill_count_below_90_percent|parse_rate_below_95_percent|r2_original_missing' \
  index-worker/src/index.ts tests/index-worker.test.mjs

echo "Snapshot boundary and credential-shape audit passed."

# Self-hosting Bitcase

Bitcase has two deployable services: the public site and an independent
Cloudflare index Worker backed by D1 and R2. The browser keeps its own Skill
library and seven-day query fallback locally.

## Optional configuration

| Variable | Purpose |
| --- | --- |
| `BITCASE_INDEX_API_URL` | Public URL of the independent active-snapshot API. |
| `GITHUB_SKILL_TOKEN` | Optional server-only token for user-initiated exact-source visualization. |

The token stays server-side. Bitcase does not accept, store, or forward a
visitor's model API key. The index Worker uses separate `GITHUB_TOKEN` and
`SYNC_ADMIN_SECRET` Cloudflare Secrets.

## Commands

```bash
npm run install:ci
npm run dev
npm run lint
npm test
```

See [INDEX_WORKER.md](INDEX_WORKER.md) for production resource creation,
migrations, first sync, status checks, and rollback.

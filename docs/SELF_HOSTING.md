# Self-hosting

## Local development

```bash
npm ci
npm run dev
```

The Vite configuration starts a local Cloudflare-compatible runtime and local
D1 binding. This is the supported community development path.

## Environment

Copy `.env.example` to `.env.local` only when optional server features are
needed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_RADAR_TOKEN` | No | Higher GitHub API rate limit |
| `BITCASE_AI_PROVIDER` | No | `cloudflare` for production or `freellmapi` for local development |
| `BITCASE_AI_MODEL` | No | Cloudflare default: `@cf/moonshotai/kimi-k2.6` |
| `BITCASE_AI_DAILY_LIMIT` | No | Per-visitor daily request allowance |
| `BITCASE_AI_GLOBAL_DAILY_LIMIT` | No | Whole-site daily request allowance |
| `CLOUDFLARE_ACCOUNT_ID` | With Cloudflare AI | Server-side Cloudflare account identifier |
| `CLOUDFLARE_API_TOKEN` | With Cloudflare AI | Server-side token with Workers AI read and edit access |
| `BITCASE_AI_BASE_URL` | With FreeLLMAPI | Local or hosted FreeLLMAPI `/v1` endpoint |
| `FREELLMAPI_API_KEY` | With FreeLLMAPI | FreeLLMAPI unified server-side key |
| `BITCASE_OWNER_EMAIL` | No | Owner-only aggregate analytics route |

Never expose a token, key, account identifier, or owner identity through
`NEXT_PUBLIC_*`. The recommended hosted configuration calls Cloudflare Workers
AI directly. `localhost` FreeLLMAPI works only when Bitcase and FreeLLMAPI run
on the same machine. See [Kimi and FreeLLMAPI for Radar](FREELLMAPI.md).

## Authentication warning

The official deployment uses hosting-provided ChatGPT identity headers.
Independent deployments must replace this with a trusted server-side identity
provider before enabling account or cloud-library endpoints.

Do not allow clients to set `oai-authenticated-user-email` through a public
proxy. If a trusted identity adapter is absent, operate Bitcase in browser-local
mode.

## Deployment status

The current build and artifact scripts target OpenAI Sites and its
Cloudflare-compatible runtime. A vendor-neutral deployment package is planned
but is not yet supported in Beta 1.

The placeholder `project_id` in `.openai/hosting.json` must be replaced by the
deployment workflow that owns the target Site. It is not a credential.

## Database

Schema changes live in `db/schema.ts`; generated D1 migrations live in
`drizzle/`. Apply migrations in order and back up user libraries before
upgrading a public deployment.

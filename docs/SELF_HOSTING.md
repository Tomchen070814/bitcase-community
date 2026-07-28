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
| `BITCASE_AI_PROVIDER` | No | Set to `freellmapi` to enable Radar AI planning |
| `BITCASE_AI_BASE_URL` | With Radar AI | FreeLLMAPI `/v1` endpoint |
| `BITCASE_AI_MODEL` | No | Defaults to `kimi-k2.6` |
| `BITCASE_AI_DAILY_LIMIT` | No | Per-visitor request allowance |
| `FREELLMAPI_API_KEY` | With Radar AI | FreeLLMAPI unified server-side key |
| `BITCASE_OWNER_EMAIL` | No | Owner-only aggregate analytics route |

Never expose a token, key, or owner identity through `NEXT_PUBLIC_*`. Hosted
deployments need a public HTTPS FreeLLMAPI endpoint; `localhost` works only
when Bitcase and FreeLLMAPI run on the same machine. See
[FreeLLMAPI for Radar](FREELLMAPI.md).

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

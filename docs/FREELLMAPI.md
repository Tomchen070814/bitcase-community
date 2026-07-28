# Kimi and FreeLLMAPI for Radar

Bitcase uses Kimi K2.6 only to plan the three GitHub Radar discovery lanes.
Repository filtering, quality signals, `SKILL.md` inspection, and quarantine
remain deterministic Bitcase checks. If the AI service is not configured,
temporarily unavailable, or at its daily limit, Radar falls back to its local
query planner and continues working.

## Recommended hosted setup

The production adapter calls Cloudflare Workers AI's OpenAI-compatible chat
completions endpoint directly from the Bitcase Worker:

```dotenv
BITCASE_AI_PROVIDER=cloudflare
BITCASE_AI_MODEL=@cf/moonshotai/kimi-k2.6
BITCASE_AI_DAILY_LIMIT=3
BITCASE_AI_GLOBAL_DAILY_LIMIT=100
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-workers-ai-token
```

The account ID and token are server-side values. Never place them in a
`NEXT_PUBLIC_*` variable or browser code. The per-visitor limit reduces abuse;
the global limit bounds the site's aggregate daily use. Both limits reset by
UTC date.

## Local FreeLLMAPI alternative

[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) is useful for local
development and provider-routing experiments:

```dotenv
BITCASE_AI_PROVIDER=freellmapi
BITCASE_AI_BASE_URL=http://127.0.0.1:3001/v1
BITCASE_AI_MODEL=kimi-k2.6
BITCASE_AI_DAILY_LIMIT=3
BITCASE_AI_GLOBAL_DAILY_LIMIT=100
FREELLMAPI_API_KEY=freellmapi-...
```

Start FreeLLMAPI, add a provider credential that serves Kimi K2.6, and copy
its unified key into Bitcase. A hosted Bitcase Worker cannot reach a laptop's
`localhost`; using this adapter in production requires a publicly reachable
HTTPS FreeLLMAPI endpoint. FreeLLMAPI describes itself as single-user software
for personal experimentation, so the direct Cloudflare adapter is the default
for this public site.

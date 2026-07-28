# FreeLLMAPI for Radar

Bitcase can ask a self-hosted
[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) router to plan the
three GitHub Radar discovery lanes. Repository filtering, quality signals,
`SKILL.md` inspection, and quarantine remain deterministic Bitcase checks.
When the router is not configured or is temporarily unavailable, Radar falls
back to its local query planner and continues working.

## Model choice

The default is the FreeLLMAPI canonical model ID `kimi-k2.6`.

- Kimi K2.6 has multiple free provider routes in the live catalog, a 262K
  context window, tool support, and a larger recurring Cloudflare free budget.
- `gemini-3.5-flash` is the supported alternative when a 1M context window is
  more important than route redundancy. Its Google AI Studio free tier has a
  much lower daily request allowance.

FreeLLMAPI model limits are a live catalog, so recheck them before changing a
production policy.

## Local setup

1. Install and start FreeLLMAPI.
2. Add at least one provider credential that serves Kimi K2.6. Cloudflare
   Workers AI uses the combined `account_id:token` form. Adding another
   supported Kimi provider gives the router a fallback route.
3. Copy the unified key shown by FreeLLMAPI.
4. Configure Bitcase:

```dotenv
BITCASE_AI_PROVIDER=freellmapi
BITCASE_AI_BASE_URL=http://127.0.0.1:3001/v1
BITCASE_AI_MODEL=kimi-k2.6
BITCASE_AI_DAILY_LIMIT=3
FREELLMAPI_API_KEY=freellmapi-...
```

The key is server-side only. Never use a `NEXT_PUBLIC_` variable for it.

## Hosted setup

OpenAI Sites cannot reach a FreeLLMAPI process running on a laptop's
`localhost`. A hosted Bitcase deployment therefore needs:

- a publicly reachable HTTPS FreeLLMAPI base URL ending in `/v1`;
- its unified `FREELLMAPI_API_KEY`; and
- the upstream provider credentials stored inside the FreeLLMAPI router.

FreeLLMAPI describes itself as self-hosted and single-user and warns that it is
for personal experimentation rather than a production SLA. Keep Bitcase's
local planner fallback enabled and monitor upstream quota and availability.

# AgentChat integration

Bitcase exposes the four Skills in
[`Tomchen070814/AgentChat`](https://github.com/Tomchen070814/AgentChat) as
featured, individually inspectable entries:

| Entry | Source path | Purpose |
| --- | --- | --- |
| `AgentChat-OneWeb` | `skills/AgentChat-OneWeb/SKILL.md` | Route a prompt through a browser-provider fallback chain |
| `AgentChat-WebSubAgent` | `skills/AgentChat-WebSubAgent/SKILL.md` | Run the search, reasoning, synthesis, and review workflow |
| `AgentChat-IndependentTasks` | `skills/AgentChat-IndependentTasks/SKILL.md` | Dispatch independent tasks and optionally compile a PDF |
| `mcp-server` | `skills/mcp-server/SKILL.md` | Expose AgentChat providers to MCP clients |

The entries appear at the start of the Skills Network panel. Bitcase resolves
each exact GitHub `SKILL.md` link, inspects the complete repository, scopes the
result to the selected Skill, and applies the normal quarantine rules before
adding it to a library.

## Installation boundary

AgentChat Skills import code from sibling `skills/lib`, and three entries also
depend on `AgentChat-OneWeb`. Copying only one Skill folder will therefore
produce an incomplete installation.

The Bitcase Stack manifest marks these entries with
`installation.mode: "repository-clone"`, identifies the required repository
paths, and sets `copySingleSkillFolder: false`. A Codex handoff must ask before
cloning or installing, keep the repository bundle intact, run the declared
setup commands, and then report the actual installed path and content hash in
the installation handshake.

## Runtime requirements

- Node.js 18 or newer. Bitcase itself continues to require Node.js 22.13 or
  newer.
- Google Chrome launched with a dedicated remote-debugging profile.
- `playwright-core`, installed by `npm ci` at the AgentChat repository root.
- An interactive browser login to at least one supported provider: Gemini,
  ChatGPT, Claude, Qwen, Kimi, MiniMax, MiMo, or DeepSeek.
- For `mcp-server`: its local `@modelcontextprotocol/sdk` and `zod`
  dependencies.
- For the optional `AgentChat-IndependentTasks` PDF path: Python with
  Matplotlib, Pandoc, and Typst.

AgentChat does not require provider API keys. It reuses browser sessions, so
cookies and session data must stay in the dedicated Chrome profile and must
never be copied into Bitcase.

Optional AgentChat environment variables include `CHROMIUM_PATH`, `CDP_HOST`,
`CDP_PORT`, `CDP_URL`, `CHROME_PROFILE`, `PROXY_SERVER`, `GEMINI_URL`, and
`HEADLESS`. Start from AgentChat's `.env.example`; do not commit a populated
`.env`.

Bitcase's optional server-side `GITHUB_SKILL_TOKEN` is separate. It only raises
GitHub inspection rate limits and does not authenticate AgentChat providers.

## Security notes

Chrome remote debugging gives local processes access to the selected browser
profile. Bind CDP to localhost, use a dedicated profile, keep provider
credentials out of environment files, and review every Bitcase quarantine
finding before installation.

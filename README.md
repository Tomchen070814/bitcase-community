# Bitcase

<p align="center">
  <img src="public/showcase-cover.png" alt="Bitcase Skill operating library" width="100%">
</p>

<p align="center">
  An open Skill operating library for discovering, inspecting, matching, and handing reusable Agent Skills to Codex.
</p>

<p align="center">
  <a href="https://bitcase-skill-library.tomcjq070814.chatgpt.site">Live Beta</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="ROADMAP.md">Roadmap</a>
  ·
  <a href="SECURITY.md">Security</a>
</p>

> Beta software. Bitcase can surface suspicious instructions and incomplete
> repository scans, but it cannot prove that a third-party Skill is safe.
> Review the source and run Skills with least privilege.

## Why Bitcase exists

Agent Skills are scattered across GitHub repositories, registries, and local
folders. Saving links is easy; knowing what a Skill does, whether it is usable,
and which Skills belong in a project is not.

Bitcase turns a collection into an operating workflow:

1. discover a Skill from GitHub or skills.sh;
2. read every detected `SKILL.md`;
3. explain its purpose, limits, permissions, and risks;
4. deduplicate it by inspected content;
5. assemble the smallest project Skill Stack;
6. hand an auditable manifest to Codex; and
7. record whether each Skill was helpful, unused, conflicting, or failed.

## Beta capabilities

- Private, browser-local Skill library with import and export
- Project-to-Skill matching without spending model tokens
- GitHub Radar with maintenance, license, and repository-quality signals
- skills.sh Trending, Hot, and All-time discovery
- Exact Skill selection in repositories containing multiple `SKILL.md` files
- Source inspection, content hashing, quarantine, and reinspection
- Multilingual interface and Skill explanations in six languages
- Project Stack JSON and Codex installation handshake
- Per-Skill outcome feedback
- Optional ChatGPT identity, D1 cloud library, and scoped Codex Bridge tokens
- Installable PWA with offline shell

## Quick start

### Requirements

- Node.js 22.13 or newer
- npm
- Linux or WSL for the included build scripts

The Vite development server can run on macOS, but the verified build helpers
use GNU `timeout` and `flock`.

### Run locally

```bash
git clone https://github.com/Tomchen070814/bitcase-community.git
cd bitcase-community
npm ci
npm run dev
```

Open the local address printed by Vite. The development server uses a local D1
database; no hosted account or production credential is required.

Optional server-side variables:

```bash
cp .env.example .env.local
```

`GITHUB_RADAR_TOKEN` raises GitHub API limits but is not required for basic use.
Never expose this token through a client-side variable.

### Optional Kimi AI planning for Radar

Radar can use a self-hosted FreeLLMAPI router to plan its focus, adjacent, and
wildcard search lanes. The default model is `kimi-k2.6`; if the router or its
quota is unavailable, Radar automatically keeps working with its deterministic
local planner.

Set `BITCASE_AI_PROVIDER`, `BITCASE_AI_BASE_URL`, `BITCASE_AI_MODEL`, and the
server-only `FREELLMAPI_API_KEY` shown in `.env.example`. Hosted deployments
need a public HTTPS router URL because their worker cannot reach a laptop's
`localhost`. See [FreeLLMAPI for Radar](docs/FREELLMAPI.md).

### Validate a change

```bash
npm run lint
npm test
```

## Safety model

Bitcase uses defense in depth:

- exact URL and repository validation;
- complete detection of nested `SKILL.md` files;
- content hashes for change and duplicate detection;
- explicit findings with file, line, and excerpt;
- quarantine for incomplete or suspicious inspections;
- no claim that a registry ranking equals safety;
- a Codex-side handshake before “installed” is displayed.

See [SECURITY.md](SECURITY.md) for the disclosure process and
[the architecture notes](docs/ARCHITECTURE.md) for trust boundaries.

## AgentChat bundle

Bitcase includes four featured entries from
[`Tomchen070814/AgentChat`](https://github.com/Tomchen070814/AgentChat).
Each `SKILL.md` is selected and inspected separately, while the generated
Stack manifest preserves AgentChat's repository-level runtime dependencies.
See [AgentChat integration](docs/AGENTCHAT.md) for setup, environment, and
security details.

## Community and hosted service

This repository contains the complete Beta core, including the generic D1
account/library implementation. The official hosted Bitcase service may later
add separate catalog synchronization, recommendation infrastructure, abuse
controls, billing, team administration, and operational analytics.

Those services are not required to run the community edition. The boundary is
documented in [Community and Cloud](docs/COMMUNITY_CLOUD.md).

## Project status

`0.4.0-beta.1` is suitable for public testing, not security-critical
production use. Current priorities:

1. broader real-user testing;
2. registry synchronization through supported APIs;
3. stronger provenance and license verification;
4. reproducible Skill installation;
5. accessibility and mobile QA; and
6. independent account providers for deployments outside OpenAI Sites.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Security reports should not be
opened as public issues.

## License and marks

The source code is licensed under
[GNU AGPL v3.0 only](LICENSE). Commercial arrangements may be available for
copyright held by the project owner; see
[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

The AGPL license does not grant permission to imply endorsement by the Bitcase
project or reuse its project marks in a confusing product. See
[TRADEMARKS.md](TRADEMARKS.md).

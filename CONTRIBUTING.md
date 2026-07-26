# Contributing to Bitcase

Thank you for helping build a safer, more usable Skill ecosystem.

## Before opening code

- Search existing issues and discussions.
- For a large feature, open a proposal before implementation.
- Report vulnerabilities through the private process in `SECURITY.md`.
- Keep one pull request focused on one problem.

## Development

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm ci
npm run dev
```

Before submitting:

```bash
npm run lint
npm test
```

Add or update tests when behavior changes. Safety-related parsing must include
both a positive and a negative case.

## Product rules

- Never describe a heuristic result as proof of safety.
- Preserve exact source URLs and inspection hashes.
- Do not send project prompts, repository contents, or user Skill names through
  anonymous analytics.
- New user-visible copy must work in all six supported locales.
- Avoid model calls when deterministic local matching is sufficient.
- A repository with several `SKILL.md` files must not be represented as one
  undifferentiated Skill.

## Pull requests

Explain:

- what changed;
- why it changed;
- user and security impact;
- migration or compatibility impact; and
- validation performed.

## Licensing of contributions

Unless separately agreed in writing, contributions are accepted under
`AGPL-3.0-only`. The project does not currently require a contributor license
agreement.

This means the project owner may offer a separate commercial license only for
code for which the owner has the necessary rights. A community contribution
will not be relicensed outside the AGPL without the contributor's additional
permission.

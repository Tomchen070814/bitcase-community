# Bitcase

Bitcase helps you decide which Agent Skills belong in a project.

It has three jobs only:

1. Visualize Skills with their purpose, source, and available evidence.
2. Match local and internet Skills to a project brief.
3. Assemble a minimal, explainable Skill Stack.

## Product flow

Describe the project on the homepage. Bitcase then:

1. maps the brief to distinct project responsibilities;
2. searches the currently active, versioned Bitcase snapshot;
3. combines snapshot evidence with Skills already saved in the browser library;
4. returns the exact repository, commit-pinned file, content hash, check time,
   license, and review signal;
5. chooses the smallest set that covers distinct project responsibilities.

skills.sh and GitHub are background indexing sources. A visitor search never
waits for either upstream service. If the index API is unavailable, the browser
can reuse the same query's most recent successful result for seven days and
clearly marks it as potentially stale.

## Coverage-first matching

Bitcase does not fill five cards with the same kind of Skill. It first maps the
project to user-facing responsibilities, then chooses a source only when it
covers an uncovered responsibility. For example, a Skill-library website is
checked for source intake, Skill search/recommendation, persistence, interface,
and quality work—not only UI.

If a responsibility has no traceable source, Bitcase shows it as a gap rather
than quietly inserting an unrelated Skill. Already-read entries in the device's
Skill Library are considered with the active snapshot.

Source files can be English or Japanese, but Bitcase presents the role, match
reason, and capability summary in Chinese while preserving the original
language label and exact `SKILL.md` text for review.

The site has no onboarding modal, account page, subscription, analytics dashboard, shared model key, or user API-key setting.

## Evidence states

| State | Meaning |
| --- | --- |
| Catalog entry | A directory reference. Bitcase has not read its source content. |
| Local import | A file selected by the user in the current browser. |
| Source read | Bitcase read a real `SKILL.md` and recorded its hash and path. |

Static checks are risk signals, not a security certification. A source that needs review is shown as such.

## Run locally

```bash
npm run install:ci
npm run dev
```

Optional environment variable:

```text
BITCASE_INDEX_API_URL
```

It points the site Worker to the independently deployed Bitcase index Worker.
`GITHUB_SKILL_TOKEN` is optional and is used only for a visitor's explicit
exact-source visualization request. Never place a user API key in Bitcase.

The independent index Worker, D1/R2 schema, Cron configuration, and production
runbook are documented in [docs/INDEX_WORKER.md](docs/INDEX_WORKER.md).

## Validate a change

```bash
npm run lint
npm test
```

## License

AGPL-3.0-only. See [LICENSE](LICENSE).

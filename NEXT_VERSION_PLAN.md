# Bitcase 0.3.0 Alpha III plan

> Historical plan. The active product line is now `0.4.0-beta.1`; see
> `ROADMAP.md` for the Beta account and skills.sh network boundary.

## Product objective

Move Bitcase from a place that collects Skills into a verified path from idea
to execution:

> Discover → understand → trust → install → run → report the result.

The release is successful only when a first-time user can reach a working
Codex handoff without reading GitHub documentation or guessing whether a Skill
is installed.

## North-star metric

**Verified use rate:** the percentage of new sessions that produce a Skill
Stack and complete a Codex preflight or handoff.

Target for the public alpha:

- at least 60% of guided users create a first Stack;
- median time to first Stack below 5 minutes;
- at least 70% of exported Stacks pass Codex preflight without an unresolved
  source error;
- at least 20% of Radar saves later appear in a Stack;
- fewer than 10% of quarantined files are marked by testers as false alarms.

## P0 — verified execution loop

Implementation checkpoint: all three P0 workstreams are present in
`0.3.0-alpha.1`. They remain Alpha until external tests verify that beginners
can complete the round trip without assistance.

### 1. Codex installation handshake

Replace the current “download JSON and hope” boundary with an explicit
handshake:

- Bitcase exports source URL, exact `SKILL.md` path, content hash, permissions,
  inspection coverage, and responsibility for every Skill.
- Codex reports `installed`, `missing`, `changed`, `quarantined`, or
  `unavailable`.
- Installation or copying to a project always requires user confirmation.
- A changed content hash invalidates the previous verification.

Exit condition: a beginner can see which Skills will run before any project
work begins.

### 2. Quarantine inbox

Add a dedicated review surface for warning and blocked files:

- show the exact matched risk signal and affected lines;
- allow `review later`, `ignore this file`, `reinspect`, or `approve for this
  project`;
- never turn repository-level open-source status into a safety verdict;
- keep safe siblings usable.

Exit condition: every non-clean Skill has an understandable next action.

### 3. Post-project outcome

After a handoff, collect one structured result per Skill:

- useful;
- unused;
- conflicted;
- failed to install;
- source changed.

Use only anonymous categories in product analytics. Do not store project text,
Skill names, repository URLs, or user identity in telemetry.

Exit condition: Radar ranking can learn from real use, not only saves.

## P1 — discovery quality

### 4. Freshness and change watcher

- store the last inspected commit and content hash;
- mark changed Skills as requiring reinspection;
- show maintenance changes without repeatedly recommending the same repository;
- notify only when a material source change affects a saved Skill.

### 5. Search confidence

- display why a query matched each Skill;
- separate topic relevance, project fit, maintenance, and trust;
- use local/rule ranking first;
- reserve model reranking for a small ambiguous set and show when it was used.

### 6. Real project templates

Ship three complete templates:

- hardware test and measurement;
- data analysis and reporting;
- public web product.

Each template must reach a working Stack, preflight, export, and outcome
feedback.

## P2 — public-alpha growth

### 7. Shareable Stack snapshots

Create read-only, versioned Stack links without exposing a private library.
Recipients can inspect responsibilities, sources, hashes, and warnings before
importing.

### 8. Optional GitHub identity

Add GitHub authorization only after public rate limits are proven to block real
users. Request the minimum scopes and keep private-repository access out of the
first implementation.

### 9. Tester programme

Recruit 20 design partners:

- 8 Skill beginners;
- 8 engineers or active Codex users;
- 4 Skill authors or maintainers.

Run the same task-based test and record activation, time to first Stack,
handoff success, confusion points, and return use.

## Delivery sequence

| Sprint | Scope | Exit gate |
| --- | --- | --- |
| 0.3.0-a1 | Installation handshake and status model | Stack shows a real preflight result |
| 0.3.0-a2 | Quarantine inbox and source-change invalidation | Every warning has a safe next action |
| 0.3.0-a3 | Outcome feedback and three project templates | End-to-end beginner tests pass |
| 0.3.0-a4 | Shareable snapshots and public-alpha measurement | 20 external testers complete tasks |

## Explicitly out of scope

- independent email/password accounts;
- billing or paid tiers;
- silent one-click installation;
- automatic execution of third-party scripts;
- private GitHub repository access;
- broad AI reranking that spends tokens on every search.

Accounts and billing should not move forward until the verified use rate shows
that users repeatedly complete the core workflow.

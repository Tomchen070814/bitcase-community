# Changelog

All notable changes to Bitcase are documented here.

## [0.4.0-beta.11] - 2026-07-31

### Added

- Added an independent Cloudflare index Worker with D1 metadata, R2 complete
  source objects, version manifests, three scheduled sync jobs, source circuit
  breakers, atomic activation, and data rollback
- Added activation gates for 90% retained Skill count, 95% parse success, and
  complete R2 source availability
- Added deterministic active-snapshot search and edge response caching
- Added an exact-query IndexedDB fallback with a seven-day maximum age and a
  visible stale-data warning

### Changed

- Project matching now queries only an active index snapshot; visitor searches
  no longer call skills.sh, GitHub Search, repository trees, or raw GitHub files
- Legacy `/api/discover`, `/api/inspect`, and
  `/api/skills-network/resolve` routes now return `410 snapshot_only`
- User-initiated exact-source visualization remains available

### Tests

- Added regression coverage for snapshot-only routing, Worker proxy isolation,
  quality gates, R2 completeness, circuit breaking, Cron mapping, deterministic
  ranking, and coverage diversity

## [0.4.0-beta.10] - 2026-07-30

### Added

- Built the public `find-skills` search flow into project matching by querying
  the same skills.sh catalog endpoint used by the Skills CLI
- Added visible search provenance and optional install-count context without
  treating popularity as proof of project relevance

### Changed

- skills.sh now supplies individual Skill candidates before repository-level
  GitHub discovery
- Every catalog candidate must still resolve to and pass inspection of its
  current GitHub `SKILL.md`
- GitHub search now runs as a responsibility-gap fallback when the skills.sh
  index or the local Skill library does not cover the project

## [0.4.0-beta.9] - 2026-07-30

### Changed

- Project matching now recognizes social-content discovery, collection,
  taxonomy, and viral-outlier analysis as separate responsibilities
- GitHub repository discovery uses relevance order instead of recent-update
  order and samples each project responsibility evenly
- Candidate Skills must contain matching evidence in the inspected
  `SKILL.md`; paid-ad Search/PMax Skills no longer satisfy organic creator
  discovery requests
- Chinese requests prefer Chinese or English sources over Japanese
  alternatives when they cover the same responsibility

### Tests

- Added a regression scenario for low-follower viral-content collection and
  the former `campaign-architect` false positive

## [0.4.0-beta.1] - 2026-07-26

### Added

- skills.sh Trending, Hot, and All-time discovery
- Exact skills.sh URL import followed by GitHub source inspection
- Multi-`SKILL.md` repository selection
- ChatGPT-backed Beta account records
- D1-backed private Skill libraries and scoped Codex Bridge tokens
- Six-locale copy for the new Beta surfaces
- Open-source governance, security, and self-hosting documentation

### Security

- Registry data is treated as discovery evidence, not a final safety verdict
- Imported Skills are hashed, inspected, deduplicated, and quarantined when
  incomplete or suspicious

## [0.3.0-alpha.1] - 2026-07-25

### Added

- Codex installation handshake
- Quarantine inbox
- Per-Skill outcome tracking
- Beginner handoff sample

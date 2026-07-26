# Bitcase product roadmap

This file is the source-of-truth checklist for product iterations. Update it
whenever a checkpoint changes capability status or target windows.

## 0.4.0 Beta 1

The first Beta establishes two product-level boundaries:

- Bitcase accounts use platform-owned ChatGPT authentication. Bitcase stores
  account records, libraries, and revocable Bridge tokens, but never receives
  or stores a second password.
- skills.sh is the ecosystem discovery layer. Bitcase reads its public
  directory when available, accepts exact skills.sh Skill URLs, resolves the
  matching GitHub source, and reruns Bitcase's own file-level inspection before
  anything enters a library.

The official skills.sh API currently requires Vercel OIDC. Bitcase runs on
OpenAI Sites, so Beta 1 does not pretend to have an authenticated API
connection. Live public-directory reads fall back to a clearly labelled cached
selection, while exact skills.sh URL intake remains available.

### Open-source checkpoint

- Complete Beta core released under `AGPL-3.0-only`
- Public CI, security disclosure, contribution, and governance baseline
- Production Site identity and credentials removed from the public snapshot
- Visible source-code link included in the network application
- Community and future hosted-service boundaries documented

## Current core capabilities

| Capability | Status | Evidence |
| --- | --- | --- |
| Private Skill library | Live | Classification, search, JSON migration, cloud sync |
| Safe Skill intake | Live | Per-SKILL.md inspection, content hashing, clean/review/quarantine routing, safe-sibling intake, and reference-only repository storage |
| Token-efficient hybrid matching | Live | Rule retrieval plus local intent ranking |
| Skill Stack routing | Live | Layer ordering, responsibilities, readiness check, Codex prompt, and rich JSON handoff |
| Beginner Codex handoff | Live | Guided sample, three-step handoff, `/mention` command, installation boundary, and completion loop |
| Learning Skill Radar | Live | Three discovery lanes, saved and ignored dedupe, automatic source reading, structured GitHub errors, multi-SKILL.md intake, maintenance and risk context |
| Source-grounded Skill decisions | Live | Gives an immediate plain-language verdict, then reads SKILL.md and localized README evidence automatically; detailed workflow, requirements, limits, and source evidence stay available without enlarging the default card |
| Oversized repository fallback | Live | Large or truncated repositories return a useful explanation and coverage status; fully read files can be saved for Codex review while unread or high-risk files remain quarantined |
| First-device onboarding | Live | New browser profiles choose beginner, familiar, or expert paths; each path opens a tailored workflow and can be replayed from Account |
| Six-language experience | Live | Interface, structured capability summaries, use cases, and original-description comparison |
| PWA and Codex Bridge | Live | Installable shell, offline fallback, cloud library, revocable tokens |
| Beta accounts | Live | ChatGPT authentication, D1 account record, per-user cloud library, and sign-out |
| skills.sh network | Beta | Live public feed with labelled fallback, exact URL intake, and Bitcase source reinspection |
| Teams and billing | Next | Provider interfaces exist; team spaces and paid entitlements are not active |

## Product evidence

| Signal | Status | Privacy boundary |
| --- | --- | --- |
| Anonymous activation funnel | Live | Session-only random id; no account, email, Skill name, repository URL, or project text |
| Anonymous later-day return signal | Live | Stores only the prior visit date locally; no persistent visitor identity |
| Value completion | Live | Counts prompt copies and Stack exports, not their contents |
| One-tap usefulness feedback | Live | Stores only helpful, not helpful, or conflict |
| Acquisition source | Live | Coarse referrer class or sanitized `utm_source`; no full referrer URL |
| Owner insight view | Live | Available only to the configured owner identity |

Anonymous product events expire after 90 days and can be disabled from the
product. The purpose is to test whether users complete the value path, not to
profile individuals.

## Next release: Bitcase 0.4.1 Beta 2

The next release validates the open-source product with real users and replaces
the fragile public-page registry feed with a supported synchronization path.

| Priority | Workstream | Exit condition |
| --- | --- | --- |
| P0 | Supported registry sync | Sync the complete skills.sh metadata catalog through its documented API without bypassing limits |
| P0 | First contributor path | A new contributor can install, understand the architecture, pass CI, and submit one focused change |
| P0 | 20-person Beta programme | Beginners, engineers, and Skill authors complete the same measured task |
| P1 | Freshness watcher | A changed source hash invalidates prior verification without repeating dismissed recommendations |
| P1 | Deployment-neutral identity | Non-Sites deployments can replace authentication without trusting client-supplied headers |
| P1 | Three real project templates | Hardware, data, and web templates complete preflight and handoff |
| P2 | Shareable Stack snapshots | Recipients inspect sources, hashes, roles, and warnings before import |
| P2 | Team and billing experiment | Start only after repeated verified use is demonstrated |

## Target windows

| Workstream | Target window | Exit condition |
| --- | --- | --- |
| Open-source Beta 1 | Jul 2026 | Public repository, reproducible build, security policy, contribution path, and hosted source link |
| Beta 2 validation | Aug-Sep 2026 | Supported registry sync, 20 design partners, measurable activation and return, reliability fixes |
| Beta platform work | Sep-Nov 2026 | Optional model reranking, deployment-neutral accounts, team library, billing sandbox |
| V1 commercial readiness | Nov-Dec 2026 | Security review, privacy/legal baseline, pricing validation, support workflow |

Target windows are planning hypotheses, not external commitments. User evidence
can move or remove any item.

# Community Edition and Bitcase Cloud

## Included in this repository

- complete Beta interface and PWA;
- local Skill library;
- deterministic project matching;
- GitHub Radar and source inspection;
- skills.sh discovery and exact import;
- quarantine, Stack export, and Codex handshake;
- generic D1 account, cloud library, and Bridge token implementation; and
- privacy-bounded product analytics.

## Possible hosted-only services

The official service may later operate infrastructure that is not required by
the community edition:

- a supported skills.sh API synchronization service;
- translated metadata and explanation caches;
- personalized recommendation and ranking services;
- abuse prevention and operational monitoring;
- billing, subscription, and team administration;
- service-level support; and
- private aggregate operational dashboards.

The public application must continue to work in local mode without these
services.

## API compatibility

If hosted services are introduced, community-facing formats should remain
documented and portable:

- exported Skill library JSON;
- project Stack manifest;
- Codex installation handshake;
- per-Skill outcome categories; and
- stable source and content-hash identity.

Paid hosting should sell convenience, synchronization, scale, and support, not
trap user data.

# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `0.4.x-beta` | Yes |
| Earlier Alpha versions | No |

## Reporting a vulnerability

Do not open a public issue for:

- authentication or authorization bypasses;
- token exposure;
- cross-user data access;
- prompt-injection bypasses that lead to private data access or unsafe
  execution;
- stored or reflected cross-site scripting;
- server-side request forgery;
- unsafe repository parsing; or
- dependency vulnerabilities with a demonstrated Bitcase impact.

Use GitHub's private security advisory flow for this repository. Include:

1. the affected version or commit;
2. a minimal reproduction;
3. the expected and actual behavior;
4. the practical impact; and
5. any suggested mitigation.

Please do not include real credentials, private project content, or another
person's data in a report.

## Response targets

- Initial acknowledgement: within 5 business days
- Triage decision: within 10 business days
- Coordinated disclosure date: agreed after impact and fix scope are known

These are project targets, not guarantees.

## Security scope

Bitcase performs static, heuristic checks. A clean result does not prove that a
Skill is safe, correct, maintained, or appropriate for a particular project.
Users must review third-party code and grant the minimum necessary permissions.

Security audits shown by external registries are displayed as third-party
evidence and are not represented as Bitcase certification.

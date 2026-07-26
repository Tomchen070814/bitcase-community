import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeQuarantineItems,
  normalizeInstallationHandshake,
  stackFingerprint,
} from "../app/lib/alpha-three.ts";

const stack = [
  { id: "router", name: "Router", contentHash: "a".repeat(64) },
  { id: "builder", name: "Builder", contentHash: "b".repeat(64) },
];

test("Stack identity changes when inspected content changes", () => {
  const first = stackFingerprint(stack);
  const second = stackFingerprint([
    stack[0],
    { ...stack[1], contentHash: "c".repeat(64) },
  ]);
  assert.match(first, /^btc_stack_[a-f0-9]{8}$/);
  assert.notEqual(first, second);
});

test("Codex handshake requires every expected Skill", () => {
  const stackId = stackFingerprint(stack);
  const valid = normalizeInstallationHandshake(
    {
      schemaVersion: "1.0",
      kind: "bitcase.codex.installation-handshake",
      stackId,
      checkedAt: "2026-07-26T08:00:00.000Z",
      deviceLabel: "Windows workstation",
      skills: stack.map((skill) => ({
        skillId: skill.id,
        status: "installed",
        installedPath: `.agents/skills/${skill.id}/SKILL.md`,
        foundContentHash: skill.contentHash,
      })),
    },
    stackId,
    stack,
  );
  assert.equal(valid?.skills.length, 2);

  const incomplete = normalizeInstallationHandshake(
    {
      schemaVersion: "1.0",
      kind: "bitcase.codex.installation-handshake",
      stackId,
      checkedAt: "2026-07-26T08:00:00.000Z",
      skills: [
        {
          skillId: "router",
          status: "installed",
          foundContentHash: "a".repeat(64),
        },
      ],
    },
    stackId,
    stack,
  );
  assert.equal(incomplete, null);
});

test("hash mismatch overrides an installed claim", () => {
  const stackId = stackFingerprint(stack);
  const report = normalizeInstallationHandshake(
    {
      schemaVersion: "1.0",
      kind: "bitcase.codex.installation-handshake",
      stackId,
      checkedAt: "2026-07-26T08:00:00.000Z",
      skills: stack.map((skill, index) => ({
        skillId: skill.id,
        status: "installed",
        foundContentHash:
          index === 0 ? "f".repeat(64) : skill.contentHash,
      })),
    },
    stackId,
    stack,
  );
  assert.equal(report?.skills[0].status, "changed");
  assert.equal(report?.skills[1].status, "installed");
});

test("quarantine merge preserves explicit user decisions", () => {
  const prior = {
    id: "repo:path:hash",
    repositoryId: 1,
    repositoryName: "repo",
    fullName: "owner/repo",
    sourceUrl: "https://github.com/owner/repo",
    defaultBranch: "main",
    skillName: "skill",
    skillPath: "SKILL.md",
    contentHash: "a".repeat(64),
    findings: [],
    state: "ignored",
    approvedProjectId: null,
    capturedAt: "2026-07-25T00:00:00.000Z",
    reviewedAt: "2026-07-25T01:00:00.000Z",
    inspectionComplete: true,
  };
  const merged = mergeQuarantineItems(
    [prior],
    [
      {
        ...prior,
        state: "blocked",
        capturedAt: "2026-07-26T00:00:00.000Z",
        reviewedAt: null,
      },
    ],
  );
  assert.equal(merged[0].state, "ignored");
  assert.equal(merged[0].reviewedAt, prior.reviewedAt);
});

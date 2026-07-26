export const DEVICE_SKILL_STATUSES = [
  "installed",
  "missing",
  "changed",
  "quarantined",
  "unavailable",
] as const;

export type DeviceSkillStatus = (typeof DEVICE_SKILL_STATUSES)[number];

export type StackIdentityItem = {
  id: string;
  contentHash?: string | null;
};

export type DeviceSkillReport = {
  skillId: string;
  name: string;
  status: DeviceSkillStatus;
  installedPath: string | null;
  expectedContentHash: string | null;
  foundContentHash: string | null;
  detail: string | null;
};

export type InstallationHandshake = {
  schemaVersion: "1.0";
  kind: "bitcase.codex.installation-handshake";
  stackId: string;
  checkedAt: string;
  deviceLabel: string | null;
  skills: DeviceSkillReport[];
};

export type SkillOutcome =
  | "helpful"
  | "unused"
  | "conflicted"
  | "install_failed"
  | "source_changed";

export type SafetyFinding = {
  code: string;
  severity: "review" | "blocked";
  line: number | null;
  excerpt: string;
};

export type QuarantineState =
  | "review"
  | "blocked"
  | "approved"
  | "ignored";

export type QuarantineItem = {
  id: string;
  repositoryId: number;
  repositoryName: string;
  fullName: string;
  sourceUrl: string;
  defaultBranch: string;
  skillName: string;
  skillPath: string;
  contentHash: string;
  findings: SafetyFinding[];
  state: QuarantineState;
  approvedProjectId: string | null;
  capturedAt: string;
  reviewedAt: string | null;
  inspectionComplete: boolean;
};

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stackFingerprint(items: StackIdentityItem[]) {
  const identity = items
    .map((item) => `${item.id}:${item.contentHash || "unverified"}`)
    .join("|");
  return `btc_stack_${stableHash(identity)}`;
}

function nullableText(value: unknown, maxLength = 300) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

export function normalizeInstallationHandshake(
  value: unknown,
  expectedStackId: string,
  expectedSkills: Array<{ id: string; name: string; contentHash?: string | null }>,
): InstallationHandshake | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.kind !== "bitcase.codex.installation-handshake" ||
    candidate.schemaVersion !== "1.0" ||
    candidate.stackId !== expectedStackId ||
    !Array.isArray(candidate.skills)
  ) {
    return null;
  }

  const expected = new Map(expectedSkills.map((skill) => [skill.id, skill]));
  const seen = new Set<string>();
  const reports: DeviceSkillReport[] = [];

  for (const entry of candidate.skills) {
    if (!entry || typeof entry !== "object") return null;
    const report = entry as Record<string, unknown>;
    const skillId = nullableText(report.skillId, 160);
    const reportedStatus = nullableText(report.status, 32);
    if (
      !skillId ||
      seen.has(skillId) ||
      !expected.has(skillId) ||
      !DEVICE_SKILL_STATUSES.includes(
        reportedStatus as DeviceSkillStatus,
      )
    ) {
      return null;
    }
    seen.add(skillId);
    const skill = expected.get(skillId)!;
    const expectedContentHash = skill.contentHash || null;
    const foundContentHash = nullableText(report.foundContentHash, 128);
    const status =
      reportedStatus === "installed" &&
      expectedContentHash &&
      foundContentHash &&
      expectedContentHash !== foundContentHash
        ? "changed"
        : (reportedStatus as DeviceSkillStatus);
    reports.push({
      skillId,
      name: skill.name,
      status,
      installedPath: nullableText(report.installedPath, 500),
      expectedContentHash,
      foundContentHash,
      detail: nullableText(report.detail, 500),
    });
  }

  if (reports.length !== expected.size) return null;
  const checkedAt = nullableText(candidate.checkedAt, 64);
  if (!checkedAt || Number.isNaN(Date.parse(checkedAt))) return null;

  return {
    schemaVersion: "1.0",
    kind: "bitcase.codex.installation-handshake",
    stackId: expectedStackId,
    checkedAt,
    deviceLabel: nullableText(candidate.deviceLabel, 100),
    skills: reports,
  };
}

export function mergeQuarantineItems(
  current: QuarantineItem[],
  incoming: QuarantineItem[],
) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const previous = map.get(item.id);
    map.set(item.id, {
      ...item,
      state:
        previous?.state === "approved" || previous?.state === "ignored"
          ? previous.state
          : item.state,
      approvedProjectId:
        previous?.state === "approved"
          ? previous.approvedProjectId
          : item.approvedProjectId,
      reviewedAt: previous?.reviewedAt || item.reviewedAt,
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  );
}

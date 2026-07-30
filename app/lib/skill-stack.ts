export type StackLayer = "协调" | "领域" | "执行" | "增强";
export type StackSourceState = "catalog" | "local" | "read";

export type StackSkill = {
  id: string;
  tags: string[];
  layer: StackLayer;
  evidence: { state: StackSourceState };
};

export type StackCandidate<T extends StackSkill = StackSkill> = {
  skill: T;
  score: number;
};

function normalizeTerm(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function isReadyForStack(skill: StackSkill) {
  return skill.evidence.state === "read" || skill.evidence.state === "local";
}

function sharesResponsibility(first: StackSkill, second: StackSkill) {
  return first.tags.some((tag) =>
    second.tags.some((other) => normalizeTerm(other) === normalizeTerm(tag)),
  );
}

export function buildMinimalStack<T extends StackSkill>(
  matches: StackCandidate<T>[],
  preferredIds: string[] = [],
) {
  const includedLayers = new Set<StackLayer>();
  const stack: T[] = [];
  const preferred = new Set(preferredIds);
  const candidates = matches
    .filter((match) => isReadyForStack(match.skill))
    .sort((a, b) => {
      const aPreferred = preferred.has(a.skill.id) ? 1 : 0;
      const bPreferred = preferred.has(b.skill.id) ? 1 : 0;
      return bPreferred - aPreferred || b.score - a.score;
    });

  for (const match of candidates) {
    if (stack.length === 4) break;
    const sameLayer = stack.filter((skill) => skill.layer === match.skill.layer);
    const limitedLayer = match.skill.layer === "协调" || match.skill.layer === "执行";
    if ((limitedLayer && includedLayers.has(match.skill.layer)) || sameLayer.some((skill) => sharesResponsibility(skill, match.skill))) {
      continue;
    }
    stack.push(match.skill);
    includedLayers.add(match.skill.layer);
  }

  return stack;
}

import type { RadarInspectedSkill } from "./radar-inspection";
import type { RadarSearchRepository } from "./radar-search";
import {
  capabilityDefinitions,
  capabilityCoverage,
  planProject,
  sourceLanguageLabel,
  sourceLanguageOf,
  type ProjectPlan,
  type SourceLanguage,
} from "./project-plan.ts";

export type ComposedSkill = {
  id: string;
  name: string;
  description: string;
  originalDescription: string;
  responsibility: string;
  matchReason: string;
  capabilities: string[];
  sourceLanguage: SourceLanguage;
  source: string;
  sourceUrl: string;
  skillUrl: string;
  skillPath: string;
  contentHash: string;
  checkedAt: string;
  risk: "clear" | "review";
  coverage: string[];
  score: number;
  discovery: {
    source: "skills.sh" | "github" | "library";
    installs?: number;
  };
};

export type SavedSkillCandidate = Pick<
  ComposedSkill,
  | "id"
  | "name"
  | "description"
  | "originalDescription"
  | "capabilities"
  | "sourceLanguage"
  | "source"
  | "sourceUrl"
  | "skillUrl"
  | "skillPath"
  | "contentHash"
  | "checkedAt"
  | "risk"
>;

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  const ignored = new Set([
    "and",
    "the",
    "for",
    "with",
    "from",
    "this",
    "that",
    "use",
    "using",
    "skill",
    "skills",
    "agent",
    "project",
  ]);
  return Array.from(
    new Set(
      normalize(value)
        .match(/[a-z0-9][a-z0-9+._-]{2,}|[\u4e00-\u9fff]{2,}/g) || [],
    ),
  ).filter((token) => !ignored.has(token));
}

function overlap(first: string[], second: string[]) {
  const right = new Set(second);
  return first.filter((item) => right.has(item));
}

function languagePreference(language: SourceLanguage, preferred: SourceLanguage) {
  if (language === preferred || language === "mixed") return 30;
  if (preferred === "zh" && language === "en") return 8;
  if (preferred === "zh" && language === "ja") return -120;
  return 0;
}

const skillProductEvidence =
  /(agent skills?|SKILL\.md|skill (?:library|catalog|discovery|search|retrieval|recommendation|matching)|capability catalog|技能库|Skill 库|技能检索|Skill 检索|技能推荐|Skill 推荐)/i;
const organicSocialEvidence =
  /(social media|social network|creator|influencer|instagram|tiktok|youtube|xiaohongshu|douyin|bilibili|social post|social content|viral (?:content|post|video)|engagement rate|followers?|views?|社交媒体|社媒|创作者|博主|达人|网红|账号|抖音|小红书|视频号|B站|作品|帖子|视频|爆款|粉丝|播放量|互动率)/i;
const organicCreatorEvidence =
  /(creator|influencer|creator profile|social (?:post|content)|viral (?:content|post|video)|followers?|view(?:s)?[- ]to[- ]follower|instagram (?:post|creator)|tiktok (?:video|creator)|youtube (?:video|creator)|创作者|博主|达人|网红|账号|作品|帖子|视频|爆款|粉丝|播放量)/i;
const paidMediaEvidence =
  /(google ads|meta ads|paid media|paid search|search ads|performance max|pmax|ad groups?|campaign budget|bidding strategy|cost per acquisition|return on ad spend|roas|付费广告|广告账户|广告组|竞价策略|投放预算)/i;
function validatedCoverage(searchable: string, plan: ProjectPlan) {
  let coverage = capabilityCoverage(searchable, plan);

  if (plan.kind === "skill-library") {
    coverage = coverage.filter(
      (capability) =>
        capability.id !== "skill-discovery" ||
        skillProductEvidence.test(searchable),
    );
    if (paidMediaEvidence.test(searchable) && !skillProductEvidence.test(searchable)) {
      coverage = coverage.filter(
        (capability) =>
          !["skill-discovery", "skill-intake"].includes(capability.id),
      );
    }
  }

  if (plan.kind === "social-content-research") {
    if (!organicSocialEvidence.test(searchable)) return [];
    if (paidMediaEvidence.test(searchable) && !organicCreatorEvidence.test(searchable)) {
      return [];
    }
  }

  return coverage;
}

function localizedCapabilities(
  searchable: string,
  coverage: { label: string }[],
) {
  const labels = coverage.map((item) => item.label);
  const additional = [
    [/(react|next\.?(js)?|frontend|ui|ux|website|web app)/i, "Web 界面实现"],
    [/(database|storage|persistence|postgres|sqlite|schema|orm|d1)/i, "数据模型与持久化"],
    [/(github|repository|metadata|parser|parse|import|crawl)/i, "来源读取与元数据解析"],
    [/(search|retrieval|index|recommend|match|ranking)/i, "检索与推荐"],
    [/(security|audit|permission|validation)/i, "来源审阅与安全校验"],
    [/(test|tdd|qa|debug|coverage)/i, "测试与质量验证"],
    [/(deploy|release|ci\/cd|github actions)/i, "部署与持续交付"],
  ].flatMap(([pattern, label]) => (pattern as RegExp).test(searchable) ? [label as string] : []);
  return Array.from(new Set([...labels, ...additional])).slice(0, 4);
}

function chineseSummary(
  responsibility: string,
  capabilities: string[],
  language: SourceLanguage,
) {
  const capabilityText = capabilities.join("、") || responsibility;
  const originalLanguage = sourceLanguageLabel(language);
  if (language === "zh" || language === "mixed") {
    return `用于${responsibility}，覆盖${capabilityText}。`;
  }
  return `用于${responsibility}，覆盖${capabilityText}。Bitcase 已读取${originalLanguage}原文，并用中文整理了这项职责；展开可查看原始 SKILL.md 说明。`;
}

export function scoreInspectedSkill(
  brief: string,
  repository: RadarSearchRepository,
  skill: RadarInspectedSkill,
  plan: ProjectPlan = planProject(brief),
  discovery: ComposedSkill["discovery"] = { source: "github" },
): ComposedSkill | null {
  if (skill.status === "blocked" || skill.truncated) return null;
  const originalDescription =
    skill.description || skill.profile.overview || "该来源未提供简短说明。";
  const searchable = [
    skill.name,
    skill.path,
    originalDescription,
    ...skill.profile.capabilities,
    ...skill.profile.useWhen,
  ].join(" ");
  const coveredCapabilities = validatedCoverage(searchable, plan);
  if (!coveredCapabilities.length) return null;

  const briefTokens = tokens(brief);
  const skillTokens = tokens(searchable);
  const directHits = overlap(briefTokens, skillTokens);
  const sourceLanguage = sourceLanguageOf(searchable);
  const coverageScore = coveredCapabilities.reduce(
    (total, capability) => total + capability.priority * 30,
    0,
  );
  const popularitySignal =
    discovery.source === "skills.sh" && discovery.installs
      ? Math.min(18, Math.log10(Math.max(1, discovery.installs)) * 4)
      : 0;
  const score =
    coverageScore +
    directHits.length * 7 +
    languagePreference(sourceLanguage, plan.userLanguage) +
    popularitySignal;
  const responsibility = coveredCapabilities[0].label;
  const capabilities = localizedCapabilities(searchable, coveredCapabilities);
  const owner = repository.fullName.split("/")[0];
  const encodedPath = skill.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return {
    id: `${repository.fullName}:${skill.path}`,
    name: skill.name,
    description: chineseSummary(responsibility, capabilities, sourceLanguage),
    originalDescription,
    responsibility,
    matchReason:
      discovery.source === "skills.sh"
        ? `由 skills.sh 候选库召回，并已从真实 SKILL.md 中识别出「${coveredCapabilities.map((capability) => capability.label).join("、")}」能力证据。`
        : `已从真实 SKILL.md 中识别出「${coveredCapabilities.map((capability) => capability.label).join("、")}」能力证据。`,
    capabilities,
    sourceLanguage,
    source: repository.fullName,
    sourceUrl: repository.htmlUrl,
    skillUrl: `https://github.com/${owner}/${repository.name}/blob/${encodeURIComponent(repository.defaultBranch)}/${encodedPath}`,
    skillPath: skill.path,
    contentHash: skill.contentHash,
    checkedAt: new Date().toISOString(),
    risk: skill.status === "warning" ? "review" : "clear",
    coverage: coveredCapabilities.map((capability) => capability.id),
    score,
    discovery,
  };
}

export function scoreSavedSkill(
  brief: string,
  skill: SavedSkillCandidate,
  plan: ProjectPlan = planProject(brief),
): ComposedSkill | null {
  const originalDescription = skill.originalDescription || skill.description;
  const searchable = [
    skill.name,
    skill.skillPath,
    originalDescription,
    ...skill.capabilities,
  ].join(" ");
  const coveredCapabilities = validatedCoverage(searchable, plan);
  if (!coveredCapabilities.length) return null;
  const directHits = overlap(tokens(brief), tokens(searchable));
  const sourceLanguage = skill.sourceLanguage || sourceLanguageOf(searchable);
  const coverageScore = coveredCapabilities.reduce(
    (total, capability) => total + capability.priority * 30,
    0,
  );
  const score = coverageScore + directHits.length * 7 + languagePreference(sourceLanguage, plan.userLanguage) + 8;
  const responsibility = coveredCapabilities[0].label;
  const capabilities = localizedCapabilities(searchable, coveredCapabilities);
  return {
    ...skill,
    description: chineseSummary(responsibility, capabilities, sourceLanguage),
    originalDescription,
    responsibility,
    matchReason: `从你的已读取 Skill 库复用；原始 SKILL.md 含有「${coveredCapabilities.map((capability) => capability.label).join("、")}」能力证据。`,
    capabilities,
    sourceLanguage,
    coverage: coveredCapabilities.map((capability) => capability.id),
    score,
    discovery: { source: "library" },
  };
}

export function visualizeInspectedSkill(
  repository: RadarSearchRepository,
  skill: RadarInspectedSkill,
) {
  const definitions = capabilityDefinitions();
  const order = [
    "instrument",
    "commerce",
    "skill-intake",
    "skill-discovery",
    "data",
    "document",
    "communication",
    "visual",
    "auth",
    "persistence",
    "backend",
    "automation",
    "security",
    "testing",
    "delivery",
    "skill-ui",
    "engineering",
  ] as const;
  const plan: ProjectPlan = {
    kind: "general",
    kindLabel: "单个 Skill",
    userLanguage: "zh",
    searchTopics: [],
    capabilities: order.map((id) => ({
      id,
      label: definitions[id].label,
      query: definitions[id].query,
      priority: 1,
    })),
  };
  return scoreInspectedSkill(
    `${skill.name} ${skill.description} ${skill.profile.overview}`,
    repository,
    skill,
    plan,
  );
}

function isDuplicate(first: ComposedSkill, second: ComposedSkill) {
  if (first.name.toLocaleLowerCase() === second.name.toLocaleLowerCase()) return true;
  const sameCoverage = first.coverage.some((coverage) => second.coverage.includes(coverage));
  if (!sameCoverage) return false;
  const firstTerms = tokens(`${first.responsibility} ${first.capabilities.join(" ")}`);
  const secondTerms = tokens(`${second.responsibility} ${second.capabilities.join(" ")}`);
  const shared = overlap(firstTerms, secondTerms).length;
  return shared >= 2 && shared / Math.max(1, Math.min(firstTerms.length, secondTerms.length)) >= 0.6;
}

function uncoveredWeight(candidate: ComposedSkill, uncovered: Set<string>, plan: ProjectPlan) {
  return candidate.coverage.reduce((total, coverage) => {
    if (!uncovered.has(coverage)) return total;
    return total + (plan.capabilities.find((capability) => capability.id === coverage)?.priority || 0);
  }, 0);
}

function hasReadableAlternative(
  candidate: ComposedSkill,
  candidates: ComposedSkill[],
  uncovered: Set<string>,
  plan: ProjectPlan,
) {
  if (plan.userLanguage !== "zh" || candidate.sourceLanguage !== "ja") return false;
  const candidateCoverage = new Set(
    candidate.coverage.filter((coverage) => uncovered.has(coverage)),
  );
  return candidates.some(
    (alternative) =>
      alternative.id !== candidate.id &&
      alternative.sourceLanguage !== "ja" &&
      alternative.coverage.some((coverage) => candidateCoverage.has(coverage)),
  );
}

export function buildComposedStack(
  candidates: ComposedSkill[],
  plan: ProjectPlan,
  maximum = 6,
) {
  const stack: ComposedSkill[] = [];
  const remaining = new Set(plan.capabilities.map((capability) => capability.id));
  const candidatesByQuality = [...candidates].sort(
    (first, second) => second.score - first.score || first.name.localeCompare(second.name),
  );

  while (stack.length < maximum && remaining.size > 0) {
    const eligibleCandidates = candidatesByQuality
      .filter((candidate) => !stack.some((selected) => isDuplicate(selected, candidate)))
      .map((candidate) => ({ candidate, gain: uncoveredWeight(candidate, remaining, plan) }))
      .filter((item) => item.gain > 0);
    const next = eligibleCandidates
      .filter(
        ({ candidate }) =>
          !hasReadableAlternative(
            candidate,
            eligibleCandidates.map((item) => item.candidate),
            remaining,
            plan,
          ),
      )
      .sort(
        (first, second) =>
          second.gain - first.gain ||
          second.candidate.score - first.candidate.score ||
          first.candidate.name.localeCompare(second.candidate.name),
      )[0]?.candidate;
    if (!next) break;
    stack.push(next);
    next.coverage.forEach((coverage) => remaining.delete(coverage));
  }
  return stack;
}

export function stackCoverage(stack: ComposedSkill[], plan: ProjectPlan) {
  const coveredIds = new Set(stack.flatMap((skill) => skill.coverage));
  const covered = plan.capabilities.filter((capability) => coveredIds.has(capability.id));
  const missing = plan.capabilities.filter((capability) => !coveredIds.has(capability.id));
  return {
    covered: covered.map((capability) => capability.label),
    missing: missing.map((capability) => capability.label),
  };
}

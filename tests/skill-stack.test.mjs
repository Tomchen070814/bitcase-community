import assert from "node:assert/strict";
import test from "node:test";

import { buildMinimalStack, isReadyForStack } from "../app/lib/skill-stack.ts";
import {
  buildComposedStack,
  scoreInspectedSkill,
  stackCoverage,
} from "../app/lib/skill-compose.ts";
import { planProject } from "../app/lib/project-plan.ts";

const candidate = (id, layer, tags, state, score) => ({
  skill: { id, layer, tags, evidence: { state } },
  score,
});

test("never puts an unread catalog candidate into a minimal Stack", () => {
  const unread = candidate("catalog-only", "领域", ["CSV"], "catalog", 98);
  const local = candidate("local-csv", "领域", ["CSV"], "local", 62);

  assert.equal(isReadyForStack(unread.skill), false);
  assert.deepEqual(buildMinimalStack([unread, local]).map((skill) => skill.id), ["local-csv"]);
});

test("keeps distinct domain Skills while removing overlapping responsibilities", () => {
  const csv = candidate("csv", "领域", ["CSV", "data"], "read", 85);
  const pdf = candidate("pdf", "领域", ["PDF", "document"], "read", 76);
  const duplicateCsv = candidate("csv-alt", "领域", ["csv", "analysis"], "read", 81);

  assert.deepEqual(buildMinimalStack([csv, duplicateCsv, pdf]).map((skill) => skill.id), ["csv", "pdf"]);
});

test("respects a user's verified choice before using another compatible candidate", () => {
  const preferred = candidate("preferred", "执行", ["React"], "read", 58);
  const higherScored = candidate("higher-score", "执行", ["Web"], "read", 92);

  assert.deepEqual(buildMinimalStack([higherScored, preferred], ["preferred"]).map((skill) => skill.id), ["preferred"]);
});

test("extracts individual matching Skills from a larger repository result", () => {
  const repository = {
    name: "agent-skills",
    fullName: "example/agent-skills",
    htmlUrl: "https://github.com/example/agent-skills",
    defaultBranch: "main",
    topics: ["agent-skills", "data-analysis"],
  };
  const base = {
    status: "clean",
    notes: [],
    findings: [],
    truncated: false,
    contentHash: "a".repeat(64),
  };
  const csv = scoreInspectedSkill(
    "分析实验室 CSV 数据并制作图表",
    repository,
    {
      ...base,
      path: "skills/csv/SKILL.md",
      name: "csv-analysis",
      description: "Analyze CSV data and create charts.",
      profile: {
        overview: "CSV analysis",
        capabilities: ["CSV analysis", "data visualization"],
        useWhen: ["Analyze spreadsheet data"],
      },
    },
  );
  const seo = scoreInspectedSkill(
    "分析实验室 CSV 数据并制作图表",
    repository,
    {
      ...base,
      path: "skills/seo/SKILL.md",
      name: "seo-growth",
      description: "Improve search ranking for marketing pages.",
      profile: {
        overview: "SEO",
        capabilities: ["keyword strategy"],
        useWhen: ["Grow website traffic"],
      },
    },
  );
  assert.ok(csv);
  assert.equal(seo, null);
  assert.equal(buildComposedStack([csv], planProject("分析实验室 CSV 数据并制作图表")).length, 1);
  assert.match(csv.skillUrl, /skills\/csv\/SKILL\.md$/);
});

test("plans a Skill-library website as several responsibilities instead of five UI cards", () => {
  const plan = planProject("生成一个储存和管理 Skills 的网站，能够检索、推荐和组合 Skill Stack");
  assert.equal(plan.kind, "skill-library");
  assert.deepEqual(
    plan.capabilities.slice(0, 4).map((capability) => capability.id),
    ["skill-intake", "skill-discovery", "persistence", "skill-ui"],
  );
  assert.equal(plan.userLanguage, "zh");
});

test("infers the hidden responsibilities of common project archetypes", () => {
  const ecommerce = planProject("做一个可以登录、下单和支付的电商网站");
  assert.equal(ecommerce.kindLabel, "电商 Web 应用");
  assert.deepEqual(
    ecommerce.capabilities.slice(0, 6).map((capability) => capability.id),
    ["commerce", "persistence", "backend", "skill-ui", "auth", "security"],
  );

  const instruments = planProject("开发一个多台 Keysight 仪器自动采集并导出 CSV 的 Windows 程序");
  assert.equal(instruments.kind, "instrument-automation");
  assert.ok(instruments.capabilities.some((capability) => capability.id === "instrument"));
  assert.ok(instruments.capabilities.some((capability) => capability.id === "automation"));
  assert.ok(instruments.capabilities.some((capability) => capability.id === "data"));

  const portfolio = planProject("制作一个个人作品集网站");
  assert.equal(portfolio.kind, "content-site");
  assert.ok(portfolio.capabilities.some((capability) => capability.id === "visual"));
  assert.ok(portfolio.capabilities.some((capability) => capability.label === "界面设计与前端实现"));
  assert.ok(portfolio.capabilities.some((capability) => capability.id === "delivery"));
});

test("treats low-follower viral collection as social-content research instead of paid-ad search", () => {
  const brief = "自动搜索并收集符合我账号类型标签的低粉爆款作品";
  const plan = planProject(brief);
  assert.equal(plan.kind, "social-content-research");
  assert.deepEqual(
    plan.capabilities.slice(0, 4).map((capability) => capability.id),
    [
      "creator-discovery",
      "content-collection",
      "performance-ranking",
      "taxonomy",
    ],
  );
  assert.match(plan.searchTopics[0], /creator influencer discovery/);
  assert.match(plan.searchTopics[1], /follower ratio/);
});

test("rejects a paid-ad campaign Skill and keeps evidence-backed organic discovery Skills", () => {
  const brief = "自动搜索并收集符合我账号类型标签的低粉爆款作品";
  const plan = planProject(brief);
  const repository = {
    name: "marketing-skills",
    fullName: "example/marketing-skills",
    htmlUrl: "https://github.com/example/marketing-skills",
    defaultBranch: "main",
    topics: ["agent-skills"],
  };
  const inspected = (name, description, profile = {}) => ({
    status: "clean",
    notes: [],
    findings: [],
    truncated: false,
    contentHash: name.padEnd(64, "a").slice(0, 64),
    path: `skills/${name}/SKILL.md`,
    name,
    description,
    profile: {
      overview: description,
      capabilities: profile.capabilities || [],
      useWhen: profile.useWhen || [],
    },
  });

  const campaign = scoreInspectedSkill(
    brief,
    repository,
    inspected(
      "campaign-architect",
      "Design Google Ads Search and PMax account structures, ad groups, keywords, bidding and ROAS.",
    ),
    plan,
  );
  assert.equal(campaign, null);

  const candidates = [
    scoreInspectedSkill(
      brief,
      repository,
      inspected(
        "influencer-discovery",
        "Discover social media creators and influencer accounts by niche, follower range and engagement rate.",
      ),
      plan,
    ),
    scoreInspectedSkill(
      brief,
      repository,
      inspected(
        "social-content-collector",
        "Scrape social posts, collect creator videos, deduplicate results and export CSV on a schedule.",
      ),
      plan,
    ),
    scoreInspectedSkill(
      brief,
      repository,
      inspected(
        "viral-outlier-ranking",
        "Detect viral posts using views-to-follower ratio, engagement rate and outlier ranking.",
      ),
      plan,
    ),
    scoreInspectedSkill(
      brief,
      repository,
      inspected(
        "creator-taxonomy",
        "Classify creator profiles with account tagging, taxonomy and niche detection.",
      ),
      plan,
    ),
  ].filter(Boolean);
  const stack = buildComposedStack(candidates, plan);
  const coverage = stackCoverage(stack, plan);

  assert.ok(stack.length >= 3);
  assert.ok(coverage.covered.includes("创作者与账号发现"));
  assert.ok(coverage.covered.includes("作品搜索与数据采集"));
  assert.ok(coverage.covered.includes("低粉爆款识别与表现排名"));
  assert.ok(coverage.covered.includes("账号标签与内容分类"));
  assert.ok(stack.every((skill) => /真实 SKILL\.md/.test(skill.matchReason)));
});

test("prefers an English source over a Japanese alternative for a Chinese request", () => {
  const brief = "搜索低粉爆款作品并按互动率排名";
  const plan = planProject(`社交媒体账号：${brief}`);
  const repository = {
    name: "social-skills",
    fullName: "example/social-skills",
    htmlUrl: "https://github.com/example/social-skills",
    defaultBranch: "main",
    topics: ["agent-skills"],
  };
  const makeSkill = (name, description) => scoreInspectedSkill(
    brief,
    repository,
    {
      status: "clean",
      notes: [],
      findings: [],
      truncated: false,
      contentHash: name.padEnd(64, "b").slice(0, 64),
      path: `skills/${name}/SKILL.md`,
      name,
      description,
      profile: {
        overview: description,
        capabilities: [],
        useWhen: [],
      },
    },
    plan,
  );
  const japanese = makeSkill(
    "viral-ranking-ja",
    "バイラル投稿を分析する viral content engagement rate views-to-follower ratio.",
  );
  const english = makeSkill(
    "viral-ranking-en",
    "Rank viral social posts by engagement rate and views-to-follower ratio.",
  );
  assert.ok(japanese);
  assert.ok(english);
  assert.equal(buildComposedStack([japanese, english], plan, 1)[0].name, "viral-ranking-en");
});

test("keeps one UI Skill and reports uncovered responsibilities instead of filling a Stack with duplicates", () => {
  const plan = planProject("生成一个储存和管理 Skills 的网站");
  const repository = {
    name: "ui-skills",
    fullName: "example/ui-skills",
    htmlUrl: "https://github.com/example/ui-skills",
    defaultBranch: "main",
    topics: ["agent-skills"],
  };
  const base = {
    status: "clean",
    notes: [],
    findings: [],
    truncated: false,
    contentHash: "b".repeat(64),
    profile: {
      overview: "",
      capabilities: ["React frontend interface"],
      useWhen: ["Build a web UI"],
    },
  };
  const uiOne = scoreInspectedSkill("生成一个储存和管理 Skills 的网站", repository, {
    ...base,
    path: "skills/ui-one/SKILL.md",
    name: "ui-one",
    description: "Build React frontend interfaces.",
  }, plan);
  const uiTwo = scoreInspectedSkill("生成一个储存和管理 Skills 的网站", repository, {
    ...base,
    path: "skills/ui-two/SKILL.md",
    name: "ui-two",
    description: "Create responsive website user interfaces.",
  }, plan);
  assert.ok(uiOne);
  assert.ok(uiTwo);
  const stack = buildComposedStack([uiOne, uiTwo], plan);
  assert.equal(stack.length, 1);
  const coverage = stackCoverage(stack, plan);
  assert.deepEqual(coverage.covered, ["Skill 库界面与可视化"]);
  assert.ok(coverage.missing.includes("来源导入与 SKILL.md 解析"));
});

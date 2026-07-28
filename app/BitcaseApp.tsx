"use client";

import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  BellRinging,
  BracketsCurly,
  Broadcast,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  CircleNotch,
  Code,
  Copy,
  CreditCard,
  Database,
  DownloadSimple,
  FileText,
  FolderOpen,
  GitBranch,
  GlobeSimple,
  Info,
  Lightning,
  LinkSimple,
  MagicWand,
  MagnifyingGlass,
  Moon,
  Palette,
  PlugsConnected,
  Plus,
  RocketLaunch,
  SealCheck,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  Stack,
  Star,
  Sun,
  Toolbox,
  Trash,
  UploadSimple,
  UserCircle,
  Warning,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GreekSky } from "./GreekSky";
import {
  createTranslator,
  Locale,
  localeOptions,
  Translator,
  TranslationKey,
} from "./i18n";
import {
  localizeDecisionProfile,
  localizeSkillDescription,
} from "./skill-copy";
import {
  DeviceSkillReport,
  InstallationHandshake,
  mergeQuarantineItems,
  normalizeInstallationHandshake,
  QuarantineItem,
  SafetyFinding,
  SkillOutcome,
  stackFingerprint,
} from "./lib/alpha-three";
import {
  AnalyticsSummary,
  anonymousAnalyticsEnabled,
  countBucket,
  recordProductEvent,
  recordSessionStarted,
  setAnonymousAnalyticsEnabled,
} from "./lib/product-analytics";
import { planSkillIntake } from "./lib/radar-inspection";
import {
  SkillsNetworkEntry,
  SkillInstallation,
  SkillsNetworkResolved,
  SkillsNetworkView,
} from "./lib/skills-network";

type Category =
  | "设计"
  | "构建"
  | "工程"
  | "数据"
  | "文档"
  | "发布"
  | "路由";

type Skill = {
  id: string;
  name: string;
  description: string;
  category: Category;
  source: string;
  sourceUrl?: string;
  tags: string[];
  triggers: string[];
  layer: "路由" | "领域" | "执行" | "增强" | "风格";
  trust: "已验证" | "待验证";
  favorite?: boolean;
  builtIn?: boolean;
  contentHash?: string;
  skillPath?: string;
  auditStatus?: "clean" | "warning";
  auditNotes?: string[];
  auditFindings?: SafetyFinding[];
  artifactType?: "skill" | "resource";
  quarantineStatus?: "none" | "review";
  sourceInspectionComplete?: boolean;
  registryUrl?: string;
  registrySource?: SkillsNetworkEntry["origin"];
  installation?: SkillInstallation;
  descriptionI18n?: Partial<Record<Locale, string>>;
};

type OnboardingLevel = "beginner" | "familiar" | "expert";

type View =
  | "library"
  | "composer"
  | "stack"
  | "radar"
  | "quarantine"
  | "account"
  | "insights";
type Match = {
  skill: Skill;
  score: number;
  reasons: string[];
  components: {
    rule: number;
    intent: number;
    ai: number | null;
  };
};

type RadarSettings = {
  enabled: boolean;
  lastRun: string | null;
  scanCursor: number;
};

type SyncState = "local" | "loading" | "saving" | "synced" | "error";

type BridgeTokenInfo = {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type GithubRepo = {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string;
  stars: number;
  updatedAt: string;
  archived: boolean;
  license: string | null;
  topics: string[];
  fork?: boolean;
  defaultBranch: string;
  lane: "focus" | "adjacent" | "wildcard";
  auditStatus?: "unverified" | "clean" | "warning";
  auditNotes?: string[];
  skillPath?: string;
  skillFileCount?: number;
  contentHash?: string;
  inspection?: CandidateInspection;
  selectedSkillPath?: string;
  registryUrl?: string;
  registrySource?: SkillsNetworkEntry["origin"];
  installation?: SkillInstallation;
};

type SourceProfile = {
  overview: string;
  capabilities: string[];
  useWhen: string[];
  workflow: string[];
  requirements: string[];
  limitations: string[];
  examples: string[];
};

type CandidateInspection = {
  status: "clean" | "warning" | "blocked" | "missing";
  skillPath: string | null;
  notes?: string[];
  contentHash?: string;
  description?: string;
  fileCount: number;
  inspectedFileCount?: number;
  inspectionComplete?: boolean;
  readmePath?: string;
  profile: SourceProfile;
  skillFiles: Array<{
    path: string;
    name: string;
    description?: string;
    status: "clean" | "warning" | "blocked";
    notes: string[];
    findings: SafetyFinding[];
    contentHash: string;
    truncated?: boolean;
    profile: SourceProfile;
  }>;
};

type SkillInspectionFailure =
  | "invalid_repo"
  | "rate_limited"
  | "private_or_unavailable"
  | "skill_too_large"
  | "github_unavailable";

type RadarSearchFailure =
  | "invalid_search"
  | "rate_limited"
  | "github_unavailable";

class SkillInspectionClientError extends Error {
  readonly code: SkillInspectionFailure;
  readonly retryAt?: string;

  constructor(code: SkillInspectionFailure, retryAt?: string) {
    super(code);
    this.name = "SkillInspectionClientError";
    this.code = code;
    this.retryAt = retryAt;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "bitcase-alpha-library-v1";
const STACK_KEY = "bitcase-alpha-stack-v1";
const ONBOARDING_KEY = "bitcase-onboarding-v1";
const LOCALE_KEY = "bitcase-locale-v1";
const RADAR_KEY = "bitcase-radar-v1";
const RADAR_RESULTS_KEY = "bitcase-radar-results-v1";
const RADAR_DISMISSED_KEY = "bitcase-radar-dismissed-v1";
const RADAR_SEED_KEY = "bitcase-radar-seed-v1";
const RADAR_FEEDBACK_KEY = "bitcase-radar-feedback-v1";
const HANDSHAKE_KEY = "bitcase-installation-handshakes-v1";
const QUARANTINE_KEY = "bitcase-quarantine-inbox-v1";
const OUTCOME_KEY = "bitcase-skill-outcomes-v1";

type RadarFeedback = {
  likedTopics: string[];
  dislikedTopics: string[];
};

const seedSkills: Skill[] = [
  {
    id: "route-private-skills",
    name: "route-private-skills",
    description: "从私人库中选择最少且足够的 Skills，并安排调用顺序。",
    category: "路由",
    source: "私人 Skill",
    tags: ["路由", "选择", "项目", "依赖"],
    triggers: ["做一个项目", "选择 skills", "匹配技能", "私人库"],
    layer: "路由",
    trust: "已验证",
    favorite: true,
    builtIn: true,
  },
  {
    id: "design-taste-frontend",
    name: "design-taste-frontend",
    description: "为落地页、作品集和品牌页面提供反模板化的前端审美约束。",
    category: "设计",
    source: "GitHub",
    sourceUrl: "https://github.com/Leonxlnx/taste-skill",
    tags: ["前端", "视觉", "落地页", "品牌", "UI"],
    triggers: ["网站", "落地页", "前端设计", "视觉改版", "UI"],
    layer: "风格",
    trust: "已验证",
    favorite: true,
    builtIn: true,
  },
  {
    id: "sites-building",
    name: "sites-building",
    description: "构建、预览、保存并部署完整的网站和 Web App。",
    category: "构建",
    source: "OpenAI",
    tags: ["网站", "Web App", "部署", "React"],
    triggers: ["构建网站", "做一个 Web App", "部署", "网页"],
    layer: "执行",
    trust: "已验证",
    builtIn: true,
  },
  {
    id: "github",
    name: "github",
    description: "读取仓库、Issues 与 Pull Requests，定位项目上下文。",
    category: "工程",
    source: "OpenAI",
    tags: ["GitHub", "仓库", "PR", "Issue"],
    triggers: ["仓库", "Pull Request", "GitHub", "Issue"],
    layer: "执行",
    trust: "已验证",
    builtIn: true,
  },
  {
    id: "spreadsheets",
    name: "spreadsheets",
    description: "创建、修改、分析和可视化表格文件。",
    category: "数据",
    source: "OpenAI",
    tags: ["Excel", "CSV", "表格", "图表"],
    triggers: ["表格", "Excel", "CSV", "数据分析"],
    layer: "领域",
    trust: "已验证",
    builtIn: true,
  },
  {
    id: "pdf",
    name: "pdf",
    description: "读取、生成、渲染并检查视觉布局敏感的 PDF。",
    category: "文档",
    source: "OpenAI",
    tags: ["PDF", "文档", "排版", "表单"],
    triggers: ["PDF", "导出文档", "表单", "排版"],
    layer: "领域",
    trust: "已验证",
    builtIn: true,
  },
  {
    id: "imagegen",
    name: "imagegen",
    description: "生成或编辑照片、插画、纹理、精灵图等位图资产。",
    category: "设计",
    source: "OpenAI",
    tags: ["图片", "插画", "视觉", "素材"],
    triggers: ["生成图片", "插画", "视觉素材", "编辑图片"],
    layer: "增强",
    trust: "已验证",
    builtIn: true,
  },
  {
    id: "yeet",
    name: "github:yeet",
    description: "确认变更范围，提交分支并创建 Draft PR。",
    category: "发布",
    source: "OpenAI",
    tags: ["Git", "提交", "PR", "发布"],
    triggers: ["提交代码", "推到 GitHub", "创建 PR", "发布分支"],
    layer: "执行",
    trust: "已验证",
    builtIn: true,
  },
];

const categories: Array<"全部" | Category> = [
  "全部",
  "路由",
  "设计",
  "构建",
  "工程",
  "数据",
  "文档",
  "发布",
];

const categoryTranslation: Record<(typeof categories)[number], TranslationKey> = {
  全部: "all",
  路由: "categoryRoute",
  设计: "categoryDesign",
  构建: "categoryBuild",
  工程: "categoryEngineering",
  数据: "categoryData",
  文档: "categoryDocs",
  发布: "categoryRelease",
};

const layerTranslation: Record<Skill["layer"], TranslationKey> = {
  路由: "layerRoute",
  领域: "layerDomain",
  执行: "layerExecution",
  风格: "layerStyle",
  增强: "layerEnhance",
};

const layerOrder: Record<Skill["layer"], number> = {
  路由: 0,
  领域: 1,
  执行: 2,
  风格: 3,
  增强: 4,
};

const categoryIcons: Record<Category, ReactNode> = {
  路由: <SlidersHorizontal size={17} />,
  设计: <Palette size={17} />,
  构建: <BracketsCurly size={17} />,
  工程: <Code size={17} />,
  数据: <Database size={17} />,
  文档: <FileText size={17} />,
  发布: <RocketLaunch size={17} />,
};

const interestRules: Array<{ pattern: RegExp; topic: string }> = [
  {
    pattern:
      /(经济|經濟|金融|财经|財經|宏观|宏觀|会计|會計|投资|投資|econom|financ|accounting|macro|investment|économ|finanzas|economía)/i,
    topic: "economics finance",
  },
  {
    pattern: /(前端|frontend|web|网站|網站|react|ui|ux|design|デザイン|diseño)/i,
    topic: "frontend design",
  },
  {
    pattern: /(数据|資料|data|spreadsheet|excel|csv|analytics|分析)/i,
    topic: "data analysis",
  },
  {
    pattern: /(写作|寫作|writing|content|copy|文章|documentation|文档|文件)/i,
    topic: "writing documentation",
  },
  {
    pattern: /(图像|圖片|图片|image|illustration|visual|写真|imagen)/i,
    topic: "image generation",
  },
  {
    pattern: /(github|git|repository|仓库|倉庫|pull request|issue|ci)/i,
    topic: "github engineering",
  },
  {
    pattern: /(研究|research|science|paper|学术|學術|recherche)/i,
    topic: "research",
  },
  {
    pattern: /(marketing|市场|市場|营销|行銷|seo|growth)/i,
    topic: "marketing",
  },
];

const adjacentTopics: Record<string, string> = {
  economics: "data visualization forecasting",
  finance: "data visualization forecasting",
  frontend: "accessibility product design",
  data: "research automation",
  writing: "knowledge management research",
  image: "brand systems storytelling",
  github: "security review release automation",
  research: "knowledge management data extraction",
  marketing: "behavioral research analytics",
};

const ideaExpansions: Array<{ pattern: RegExp; terms: string[] }> = [
  {
    pattern: /(硬件|硬體|hardware|pcb|电路|電路|嵌入式|embedded|iot)/i,
    terms: ["embedded systems", "hardware automation", "pcb engineering"],
  },
  {
    pattern: /(经济|經濟|econom|finance|金融|投资|投資)/i,
    terms: ["economic analysis", "financial modeling", "market research"],
  },
  {
    pattern: /(ui|ux|前端|frontend|设计|設計|website|网站|網站)/i,
    terms: ["frontend accessibility", "product design", "design systems"],
  },
  {
    pattern: /(research|研究|论文|論文|paper|学术|學術)/i,
    terms: ["research workflow", "literature review", "knowledge synthesis"],
  },
  {
    pattern: /(安全|security|审计|審計|audit|prompt injection)/i,
    terms: ["agent skill security", "prompt injection audit", "supply chain"],
  },
];

const wildcardTopics = [
  "accessibility design systems",
  "embedded hardware automation",
  "research knowledge synthesis",
  "data storytelling visualization",
  "agent security review",
  "product discovery user research",
];

function normalizeRepoUrl(url: string) {
  return url.toLowerCase().replace(/\/+$/, "").replace(/\.git$/, "");
}

function normalizeLicense(value?: string | null) {
  return value && !/^(NOASSERTION|OTHER)$/i.test(value) ? value : null;
}

function expandIdeaSeed(seed: string) {
  const clean = seed.trim();
  if (!clean) return [];
  const expanded = new Set([clean]);
  ideaExpansions.forEach((rule) => {
    if (rule.pattern.test(clean)) {
      rule.terms.forEach((term) => expanded.add(term));
    }
  });
  return Array.from(expanded).slice(0, 4);
}

function getAdjacentTopic(primary: string) {
  const key = Object.keys(adjacentTopics).find((topic) =>
    primary.toLowerCase().includes(topic),
  );
  return key ? adjacentTopics[key] : "product design automation";
}

function getWildcardTopic(primary: string) {
  const primaryWords = new Set(primary.toLowerCase().split(/\s+/));
  return (
    wildcardTopics.find(
      (topic) =>
        !topic
          .toLowerCase()
          .split(/\s+/)
          .some((word) => primaryWords.has(word)),
    ) || wildcardTopics[0]
  );
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

function safeId(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-|-$/g, "") || `skill-${Date.now()}`
  );
}

function scoreSkills(
  brief: string,
  skills: Skill[],
  locale: Locale,
  t: Translator,
): Match[] {
  const input = brief.toLowerCase().trim();
  if (!input) return [];

  return skills
    .filter((skill) => skill.artifactType !== "resource")
    .map((skill) => {
      let ruleScore = 0;
      let intentScore = 0;
      const reasons: string[] = [];
      const skillText = [
        skill.name,
        skill.description,
        localizeSkillDescription(skill, locale),
        ...Object.values(skill.descriptionI18n || {}),
        ...skill.tags,
        ...skill.triggers,
      ]
        .join(" ")
        .toLowerCase();
      const triggerHits = skill.triggers.filter((trigger) =>
        input.includes(trigger.toLowerCase()),
      );
      const tagHits = skill.tags.filter((tag) =>
        input.includes(tag.toLowerCase()),
      );
      const nameHit = input.includes(skill.name.toLowerCase());

      if (triggerHits.length) {
        ruleScore += triggerHits.length * 5;
        reasons.push(`${t("triggers")}: ${triggerHits.slice(0, 2).join(", ")}`);
      }
      if (tagHits.length) {
        ruleScore += tagHits.length * 3;
        reasons.push(`${t("tags")}: ${tagHits.slice(0, 3).join(", ")}`);
      }
      if (nameHit) {
        ruleScore += 7;
        reasons.push(localizeSkillDescription(skill, locale));
      }
      if (
        skill.id === "route-private-skills" &&
        /(项目|專案|project|build|构建|製作|开发|開發|analyse|projet)/i.test(
          input,
        )
      ) {
        ruleScore += 4;
      }
      if (
        skill.id === "sites-building" &&
        /(网站|網站|网页|網頁|web app|webapp|frontend|前端|site)/i.test(input)
      ) {
        ruleScore += 6;
      }

      const intentPairs = [
        {
          brief:
            /(网站|網站|网页|網頁|web|frontend|landing|pwa|dashboard|界面|介面)/i,
          skill:
            /(网站|網站|web|frontend|react|ui|ux|design|部署|deploy|accessibility)/i,
        },
        {
          brief: /(研究|research|论文|論文|paper|资料|資料|知识|知識)/i,
          skill: /(研究|research|paper|document|pdf|知识|知識|资料|資料)/i,
        },
        {
          brief: /(数据|資料|分析|报表|報表|excel|csv|chart|visuali)/i,
          skill: /(data|数据|資料|spreadsheet|excel|csv|chart|分析|visuali)/i,
        },
        {
          brief: /(发布|發佈|上线|上線|deploy|release|pull request|pr)/i,
          skill: /(deploy|release|发布|發佈|github|git|pull request|pr)/i,
        },
        {
          brief: /(图片|圖片|插画|插畫|image|visual|brand|品牌)/i,
          skill: /(image|visual|图片|圖片|插画|插畫|brand|品牌|design)/i,
        },
        {
          brief: /(skill|技能|能力|路由|router|匹配|组合|組合|stack)/i,
          skill: /(skill|技能|route|路由|match|匹配|stack|组合|組合)/i,
        },
      ];
      const intentHits = intentPairs.filter(
        (pair) => pair.brief.test(input) && pair.skill.test(skillText),
      ).length;
      if (intentHits) {
        intentScore = Math.min(intentHits * 3, 9);
        reasons.push(t("intentMatch"));
      }

      const score = ruleScore + intentScore;
      return {
        skill,
        score,
        reasons,
        components: {
          rule: ruleScore,
          intent: intentScore,
          ai: null,
        },
      };
    })
    .filter((match) => match.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.skill.name.localeCompare(b.skill.name),
    );
}

function repositoryQualityScore(repo: GithubRepo) {
  const daysOld =
    (Date.now() - new Date(repo.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  let score = 42;
  if (daysOld < 90) score += 18;
  else if (daysOld < 180) score += 10;
  else if (daysOld > 365) score -= 14;
  if (repo.stars >= 25) score += 14;
  else if (repo.stars >= 5) score += 8;
  if (normalizeLicense(repo.license)) score += 12;
  if (repo.topics.some((topic) => /^(agent-skills?|skills?)$/i.test(topic))) {
    score += 10;
  }
  if (repo.archived) score -= 35;
  if (repo.fork) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function repositoryMaintenanceKey(repo: GithubRepo): TranslationKey {
  if (repo.archived) return "maintenanceArchived";
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(repo.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (daysSinceUpdate <= 90) return "maintenanceActive";
  if (daysSinceUpdate <= 365) return "maintenanceSlower";
  return "maintenanceStale";
}

function getStrengthKey(score: number): TranslationKey {
  if (score >= 9) return "strengthStrong";
  if (score >= 5) return "strengthUseful";
  return "strengthOptional";
}

function getConflicts(stack: Skill[], brief: string, locale: Locale) {
  const messages: Record<Locale, [string, string, string]> = {
    "zh-CN": [
      "Taste Skill 更适合品牌页与展示型前端。高密度产品界面只借用审美约束。",
      "当前有多个风格 Skill。建议只保留一个视觉主导，避免规则互相覆盖。",
      "项目没有明确图像需求，imagegen 可能扩大范围，可先作为可选增强。",
    ],
    "zh-TW": [
      "Taste Skill 更適合品牌頁與展示型前端。高密度產品介面只借用審美約束。",
      "目前有多個風格 Skill。建議只保留一個視覺主導，避免規則互相覆蓋。",
      "專案沒有明確圖像需求，imagegen 可能擴大範圍，可先作為可選增強。",
    ],
    en: [
      "Taste Skill is intended for brand and presentation surfaces. Use only its visual constraints in dense product UI.",
      "Several style Skills are active. Keep one visual lead to prevent competing rules.",
      "The brief has no clear image need. Keep imagegen as an optional enhancement.",
    ],
    ja: [
      "Taste Skill はブランド面向けです。高密度 UI では視覚ルールだけを使用してください。",
      "複数のスタイル Skill があります。視覚の主導役を一つに絞ってください。",
      "画像要件が明確ではありません。imagegen は任意の拡張として扱えます。",
    ],
    fr: [
      "Taste Skill vise les surfaces de marque. Utilisez seulement ses règles visuelles dans une interface dense.",
      "Plusieurs Skills de style sont actifs. Gardez une seule direction visuelle.",
      "Le projet ne demande pas clairement d'images. Gardez imagegen en option.",
    ],
    es: [
      "Taste Skill sirve para superficies de marca. Usa solo sus reglas visuales en una interfaz densa.",
      "Hay varias Skills de estilo. Mantén una sola dirección visual.",
      "El proyecto no pide imágenes claramente. Mantén imagegen como mejora opcional.",
    ],
  };
  const conflicts: string[] = [];
  if (
    stack.some((skill) => skill.id === "design-taste-frontend") &&
    /(后台|後台|dashboard|admin|管理系统|管理系統|高密度|上位机)/i.test(brief)
  ) {
    conflicts.push(messages[locale][0]);
  }
  if (stack.filter((skill) => skill.layer === "风格").length > 1) {
    conflicts.push(messages[locale][1]);
  }
  if (
    stack.some((skill) => skill.id === "imagegen") &&
    !/(图片|圖片|插画|插畫|视觉|視覺|image|illustration|visual|imagen)/i.test(
      brief,
    )
  ) {
    conflicts.push(messages[locale][2]);
  }
  return conflicts;
}

type SkillReadiness = {
  state: "ready" | "inspected" | "review" | "missing";
  evidence: string;
};

function getSkillReadiness(skill: Skill): SkillReadiness {
  if (skill.artifactType === "resource") {
    return { state: "missing", evidence: "reference-only" };
  }
  if (skill.builtIn && skill.trust === "已验证") {
    return { state: "ready", evidence: "verified-library-entry" };
  }
  if (skill.auditStatus === "warning") {
    return {
      state: "review",
      evidence: skill.skillPath || "static-review-warning",
    };
  }
  if (skill.contentHash && skill.skillPath) {
    return { state: "inspected", evidence: skill.skillPath };
  }
  if (skill.sourceUrl) {
    return { state: "review", evidence: skill.sourceUrl };
  }
  return { state: "missing", evidence: "no-readable-source" };
}

function skillResponsibility(skill: Skill, t: Translator) {
  const key: Record<Skill["layer"], TranslationKey> = {
    路由: "roleRoute",
    领域: "roleDomain",
    执行: "roleExecution",
    风格: "roleStyle",
    增强: "roleEnhance",
  };
  return t(key[skill.layer], { name: skill.name });
}

function buildStackManifest(
  stack: Skill[],
  brief: string,
  conflicts: string[],
  locale: Locale,
  t: Translator,
) {
  const stackId = stackFingerprint(stack);
  return {
    schemaVersion: "2.0",
    kind: "bitcase.codex.skill-stack",
    stackId,
    generatedAt: new Date().toISOString(),
    locale,
    project: {
      brief,
      conflicts,
    },
    important: {
      manifestIsNotInstaller: true,
      message: t("manifestWarning"),
    },
    beginnerHandoff: {
      putFileInProject: t("codexStepFile"),
      mentionFile: "/mention bitcase-codex-stack.json",
      pastePrompt: t("codexStepPrompt"),
    },
    codexPrompt: buildCodexPrompt(stack, brief, locale),
    installationHandshake: {
      required: true,
      responseFile: "bitcase-codex-handshake.json",
      instructions: t("handshakeManifestInstruction"),
      responseSchema: {
        schemaVersion: "1.0",
        kind: "bitcase.codex.installation-handshake",
        stackId,
        checkedAt: "ISO-8601 timestamp",
        deviceLabel: "optional local device label",
        skills: stack.map((skill) => ({
          skillId: skill.id,
          name: skill.name,
          status:
            "installed | missing | changed | quarantined | unavailable",
          installedPath: "local path or null",
          expectedContentHash: skill.contentHash || null,
          foundContentHash: "local SHA-256 or null",
          detail: "short reason without secrets or file contents",
        })),
      },
    },
    executionOrder: stack.map((skill, index) => {
      const readiness = getSkillReadiness(skill);
      return {
        order: index + 1,
        id: skill.id,
        name: skill.name,
        layer: skill.layer,
        responsibility: skillResponsibility(skill, t),
        description: localizeSkillDescription(skill, locale),
        source: {
          label: skill.source,
          url: skill.sourceUrl || null,
          skillPath: skill.skillPath || null,
        },
        installation: skill.installation || {
          mode: "single-skill-copy",
          target: `.agents/skills/${skill.id}`,
        },
        verification: {
          state: readiness.state,
          evidence: readiness.evidence,
          contentHash: skill.contentHash || null,
          notes: skill.auditNotes || [],
        },
        permissions: {
          installOrCopyRequiresApproval: true,
          secretAccess: "denied-unless-user-explicitly-approves",
          networkAccess:
            skill.auditNotes?.includes("execution-needs-review") ||
            skill.auditNotes?.includes("credential-exfiltration-risk")
              ? "review-required"
              : "not-declared",
        },
      };
    }),
    completionFeedback: {
      returnToBitcase: true,
      perSkill: true,
      options: [
        "helpful",
        "unused",
        "conflicted",
        "install_failed",
        "source_changed",
      ],
    },
  };
}

function buildCodexPrompt(
  stack: Skill[],
  brief: string,
  locale: Locale,
) {
  const skillList = stack
    .map(
      (skill, index) =>
        `${index + 1}. ${skill.name} [${skill.layer}]${
          skill.skillPath ? ` (${skill.skillPath})` : ""
        }`,
    )
    .join("\n");
  const prompts: Record<Locale, string> = {
    "zh-CN": `请读取我放在项目目录中的 bitcase-codex-stack.json，并按照 executionOrder 工作。

重要规则：
1. JSON 是路由清单，不代表 Skill 已经安装。不要只看到名称就假装已经使用。
2. 先检查当前会话是否存在同名 Skill。存在时读取完整 SKILL.md。
3. 如果没有安装，但清单提供 source.url 和 source.skillPath，先检查对应 SKILL.md，并在安装或复制到项目 .agents/skills 前征得我的同意。
4. 如果某个 Skill 无法读取，明确标记 unavailable，继续使用其余可用 Skills，不要编造内容。
5. 开始前先列出：启用的 Skill、每个 Skill 的职责、不可用项和冲突处理。
6. 按 installationHandshake.responseSchema 生成 bitcase-codex-handshake.json，不得写入密钥或文件内容。
7. 然后完成项目目标。结束时逐个 Skill 返回：helpful、unused、conflicted、install_failed 或 source_changed。

项目目标：
${brief}

期望顺序：
${skillList}`,
    "zh-TW": `請讀取專案目錄中的 bitcase-codex-stack.json，並依照 executionOrder 工作。

重要規則：
1. JSON 是路由清單，不代表 Skill 已安裝。不要只看到名稱就假裝已使用。
2. 先檢查目前工作階段是否有同名 Skill；若有，讀取完整 SKILL.md。
3. 若尚未安裝但有 source.url 與 source.skillPath，先檢查來源，並在安裝或複製至 .agents/skills 前取得我的同意。
4. 無法讀取的 Skill 要標記 unavailable，不可虛構內容。
5. 開始前列出啟用的 Skill、職責、不可用項目與衝突處理。
6. 依 installationHandshake.responseSchema 產生 bitcase-codex-handshake.json，不得包含密鑰或檔案內容。
7. 完成後逐個 Skill 回報：helpful、unused、conflicted、install_failed 或 source_changed。

專案目標：
${brief}

執行順序：
${skillList}`,
    en: `Read bitcase-codex-stack.json from the project folder and follow executionOrder.

Rules:
1. The JSON is a routing manifest, not proof that a Skill is installed. Never pretend to use a Skill from its name alone.
2. Check the current session for each exact Skill name. If present, read its full SKILL.md.
3. If missing and source.url plus source.skillPath are present, inspect that SKILL.md and ask before installing or copying it into .agents/skills.
4. Mark unreadable Skills as unavailable. Continue with the remaining verified Skills and never invent missing instructions.
5. Before implementation, list the active Skills, each responsibility, unavailable items, and conflict decisions.
6. Write bitcase-codex-handshake.json using installationHandshake.responseSchema. Never include secrets or file contents.
7. Complete the project, then report one outcome per Skill: helpful, unused, conflicted, install_failed, or source_changed.

Project goal:
${brief}

Expected order:
${skillList}`,
    ja: `プロジェクト内の bitcase-codex-stack.json を読み、executionOrder に従ってください。

規則：
1. JSON はルーティング表であり、Skill のインストール証明ではありません。名前だけで使用したことにしないでください。
2. 同名 Skill が現在のセッションにあるか確認し、ある場合は完全な SKILL.md を読みます。
3. 未導入で source.url と source.skillPath がある場合、内容を確認し、.agents/skills へ導入する前に許可を求めます。
4. 読めない Skill は unavailable と明示し、内容を作らないでください。
5. 作業前に有効な Skill、役割、利用不可項目、競合処理を示します。
6. installationHandshake.responseSchema に従い bitcase-codex-handshake.json を作成し、秘密情報やファイル内容は含めません。
7. 完了後、Skill ごとに helpful、unused、conflicted、install_failed、source_changed のいずれかを返します。

プロジェクト目標：
${brief}

実行順：
${skillList}`,
    fr: `Lisez bitcase-codex-stack.json dans le dossier du projet et suivez executionOrder.

Règles :
1. Le JSON est un manifeste de routage, pas une preuve d'installation. Ne prétendez jamais utiliser un Skill à partir de son seul nom.
2. Vérifiez chaque nom exact dans la session et lisez le SKILL.md complet s'il existe.
3. Si le Skill manque mais que source.url et source.skillPath existent, inspectez la source et demandez mon accord avant toute installation dans .agents/skills.
4. Marquez tout Skill illisible comme unavailable et n'inventez aucune instruction.
5. Avant le travail, listez les Skills actifs, leurs responsabilités, les éléments indisponibles et les conflits.
6. Créez bitcase-codex-handshake.json selon installationHandshake.responseSchema, sans secret ni contenu de fichier.
7. À la fin, indiquez pour chaque Skill : helpful, unused, conflicted, install_failed ou source_changed.

Objectif :
${brief}

Ordre prévu :
${skillList}`,
    es: `Lee bitcase-codex-stack.json desde la carpeta del proyecto y sigue executionOrder.

Reglas:
1. El JSON es un manifiesto de enrutamiento, no una prueba de instalación. No finjas usar una Skill solo por su nombre.
2. Comprueba cada nombre exacto en la sesión y lee el SKILL.md completo si existe.
3. Si falta pero hay source.url y source.skillPath, inspecciona la fuente y pide permiso antes de instalarla en .agents/skills.
4. Marca las Skills ilegibles como unavailable y no inventes instrucciones.
5. Antes de trabajar, enumera Skills activas, responsabilidades, elementos no disponibles y conflictos.
6. Crea bitcase-codex-handshake.json según installationHandshake.responseSchema, sin secretos ni contenido de archivos.
7. Al terminar, informa por Skill: helpful, unused, conflicted, install_failed o source_changed.

Objetivo:
${brief}

Orden esperado:
${skillList}`,
  };
  return prompts[locale];
}

function inferInterests(skills: Skill[], stackIds: string[]) {
  const scores = new Map<string, number>();
  skills.forEach((skill) => {
    const weight = skill.builtIn ? 1 : 4;
    const stackWeight = stackIds.includes(skill.id) ? 2 : 0;
    const source = [
      skill.name,
      skill.description,
      ...skill.tags,
      ...skill.triggers,
    ].join(" ");
    interestRules.forEach((rule) => {
      if (rule.pattern.test(source)) {
        scores.set(
          rule.topic,
          (scores.get(rule.topic) || 0) + weight + stackWeight,
        );
      }
    });
  });
  return Array.from(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic, score]) => ({ topic, score }));
}

function formatDate(value: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function withInspection(
  repo: GithubRepo,
  inspection: CandidateInspection,
): GithubRepo {
  const inspectionComplete = inspection.inspectionComplete !== false;
  return {
    ...repo,
    auditStatus:
      inspection.status === "blocked" ||
      inspection.status === "missing" ||
      !inspectionComplete
        ? "warning"
        : inspection.status,
    auditNotes: inspection.notes,
    skillPath: inspection.skillPath || undefined,
    skillFileCount: inspection.fileCount,
    contentHash: inspection.contentHash,
    inspection,
  };
}

function scopeInspectionToSelectedSkill(
  inspection: CandidateInspection,
  selectedSkillPath?: string,
): CandidateInspection {
  if (!selectedSkillPath) return inspection;
  const selected = inspection.skillFiles.find(
    (skillFile) => skillFile.path === selectedSkillPath,
  );
  if (!selected) return inspection;
  return {
    ...inspection,
    status: selected.status,
    skillPath: selected.path,
    contentHash: selected.contentHash,
    description: selected.description || inspection.description,
    fileCount: 1,
    inspectedFileCount: 1,
    skillFiles: [selected],
    profile: selected.profile,
  };
}

function quarantineFromInspection(
  repo: GithubRepo,
  inspection: CandidateInspection,
): QuarantineItem[] {
  const capturedAt = new Date().toISOString();
  return inspection.skillFiles
    .filter(
      (skillFile) =>
        skillFile.status === "warning" ||
        skillFile.status === "blocked" ||
        skillFile.truncated,
    )
    .map((skillFile) => {
      const state =
        skillFile.status === "blocked" || skillFile.truncated
          ? "blocked"
          : "review";
      const findings: SafetyFinding[] =
        skillFile.findings?.length
          ? skillFile.findings
          : skillFile.notes.map((code) => ({
              code,
              severity: state as SafetyFinding["severity"],
              line: null,
              excerpt: "",
            }));
      return {
        id: `${repo.id}:${skillFile.path}:${skillFile.contentHash}`,
        repositoryId: repo.id,
        repositoryName: repo.name,
        fullName: repo.fullName,
        sourceUrl: repo.htmlUrl,
        defaultBranch: repo.defaultBranch || "main",
        skillName: skillFile.name,
        skillPath: skillFile.path,
        contentHash: skillFile.contentHash,
        findings,
        state,
        approvedProjectId: null,
        capturedAt,
        reviewedAt: null,
        inspectionComplete: inspection.inspectionComplete !== false,
      };
    });
}

export type BitcaseViewer = {
  displayName: string;
  email: string;
};

type BetaAccount = {
  id: string;
  email: string;
  displayName: string;
  authProvider: "chatgpt";
  plan: "beta";
  locale: string;
  createdAt: string;
  lastSeenAt: string;
};

function GreekGuideMascot({
  t,
  onOpenGuide,
}: {
  t: Translator;
  onOpenGuide: () => void;
}) {
  function followPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const frameWidth = 46;
    const nextX = Math.max(
      5,
      Math.min(
        bounds.width - frameWidth - 5,
        event.clientX - bounds.left - frameWidth / 2,
      ),
    );
    target.style.setProperty("--mascot-x", `${nextX}px`);
    target.style.setProperty(
      "--mascot-facing",
      event.clientX - bounds.left >= bounds.width / 2 ? "1" : "-1",
    );
  }

  function resetPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.style.removeProperty("--mascot-x");
    event.currentTarget.style.removeProperty("--mascot-facing");
  }

  return (
    <button
      type="button"
      className="greek-guide-mascot"
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
      onClick={onOpenGuide}
      aria-label={t("mascotOpenGuide")}
    >
      <span className="mascot-kicker" aria-hidden="true">
        AGORA GUIDE · CLICK
      </span>
      <span className="mascot-callout" aria-hidden="true">
        <strong>Χαῖρε</strong>
        <small>{t("mascotHint")}</small>
      </span>
      <span className="mascot-actor" aria-hidden="true">
        <span className="mascot-sprite-window">
          <span className="mascot-sprite" />
        </span>
      </span>
      <span className="mascot-track" aria-hidden="true" />
    </button>
  );
}

export default function BitcaseApp({
  viewer,
}: {
  viewer: BitcaseViewer | null;
}) {
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("library");
  const [skills, setSkills] = useState<Skill[]>(seedSkills);
  const [stackIds, setStackIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("全部");
  const [brief, setBrief] = useState(
    "做一个私人 Skill 库 Web App，可以分类、搜索、自动匹配项目需要的 Skills，并导出组合清单。",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [isMatching, setIsMatching] = useState(false);
  const [hasMatched, setHasMatched] = useState(true);
  const [radarSettings, setRadarSettings] = useState<RadarSettings>({
    enabled: true,
    lastRun: null,
    scanCursor: 1,
  });
  const [radarResults, setRadarResults] = useState<GithubRepo[]>([]);
  const [radarSeed, setRadarSeed] = useState("");
  const [dismissedRepoIds, setDismissedRepoIds] = useState<number[]>([]);
  const [radarFeedback, setRadarFeedback] = useState<RadarFeedback>({
    likedTopics: [],
    dislikedTopics: [],
  });
  const [radarError, setRadarError] =
    useState<RadarSearchFailure | null>(null);
  const [isRadarLoading, setIsRadarLoading] = useState(false);
  const [skillsNetworkView, setSkillsNetworkView] =
    useState<SkillsNetworkView>("trending");
  const [skillsNetworkEntries, setSkillsNetworkEntries] = useState<
    SkillsNetworkEntry[]
  >([]);
  const [skillsNetworkSource, setSkillsNetworkSource] = useState<
    "live" | "fallback"
  >("fallback");
  const [skillsNetworkLoading, setSkillsNetworkLoading] = useState(false);
  const [skillsNetworkError, setSkillsNetworkError] = useState(false);
  const [skillsNetworkImporting, setSkillsNetworkImporting] =
    useState<string>("");
  const [inspectingRepoId, setInspectingRepoId] = useState<number | null>(null);
  const [inspectionAttemptedRepoIds, setInspectionAttemptedRepoIds] =
    useState<number[]>([]);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(
    viewer ? "loading" : "local",
  );
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [feedbackPrompt, setFeedbackPrompt] = useState(false);
  const [installationHandshakes, setInstallationHandshakes] = useState<
    Record<string, InstallationHandshake>
  >({});
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [skillOutcomes, setSkillOutcomes] = useState<
    Record<string, Record<string, SkillOutcome>>
  >({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLevel, setOnboardingLevel] =
    useState<OnboardingLevel | null>(null);
  const [analyticsAvailable, setAnalyticsAvailable] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const lastCloudSnapshot = useRef("");
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedLocale = readLocal<Locale>(LOCALE_KEY, "zh-CN");
      const savedTheme = readLocal<"light" | "dark">("bitcase-theme", "dark");
      const localSkills = readLocal(STORAGE_KEY, seedSkills);
      const localStackIds = readLocal<string[]>(STACK_KEY, []);
      setSkills(localSkills);
      setStackIds(localStackIds);
      setLocale(savedLocale);
      setTheme(savedTheme);
      const storedRadar = readLocal<Partial<RadarSettings>>(RADAR_KEY, {});
      setRadarSettings({
        enabled: storedRadar.enabled ?? true,
        lastRun: storedRadar.lastRun ?? null,
        scanCursor: storedRadar.scanCursor ?? 1,
      });
      setRadarResults(
        readLocal<GithubRepo[]>(RADAR_RESULTS_KEY, []).map((repo) => ({
          ...repo,
          defaultBranch: repo.defaultBranch || "main",
          lane: repo.lane || "focus",
          auditStatus: repo.auditStatus || "unverified",
        })),
      );
      setRadarSeed(readLocal<string>(RADAR_SEED_KEY, ""));
      setDismissedRepoIds(readLocal<number[]>(RADAR_DISMISSED_KEY, []));
      setRadarFeedback(
        readLocal<RadarFeedback>(RADAR_FEEDBACK_KEY, {
          likedTopics: [],
          dislikedTopics: [],
        }),
      );
      setInstallationHandshakes(
        readLocal<Record<string, InstallationHandshake>>(HANDSHAKE_KEY, {}),
      );
      setQuarantineItems(
        readLocal<QuarantineItem[]>(QUARANTINE_KEY, []),
      );
      setSkillOutcomes(
        readLocal<Record<string, Record<string, SkillOutcome>>>(
          OUTCOME_KEY,
          {},
        ),
      );
      setTelemetryEnabled(anonymousAnalyticsEnabled());
      const savedOnboarding = readLocal<{
        completed?: boolean;
        level?: OnboardingLevel;
      } | null>(ONBOARDING_KEY, null);
      const existingDevice =
        window.localStorage.getItem(STORAGE_KEY) !== null ||
        window.localStorage.getItem(RADAR_KEY) !== null;
      if (!savedOnboarding?.completed && !existingDevice) {
        setOnboardingOpen(true);
        setOnboardingLevel(savedOnboarding?.level || null);
      }
      document.documentElement.dataset.theme = savedTheme;
      document.documentElement.lang = savedLocale;
      const requestedView = new URLSearchParams(window.location.search).get(
        "view",
      );
      if (
        requestedView === "library" ||
        requestedView === "composer" ||
        requestedView === "stack" ||
        requestedView === "radar" ||
        requestedView === "quarantine" ||
        requestedView === "account"
      ) {
        setView(requestedView);
      }
      setHydrated(true);

      if (viewer) {
        void (async () => {
          try {
            setSyncState("loading");
            const response = await fetch("/api/library", {
              headers: { accept: "application/json" },
              cache: "no-store",
            });
            if (!response.ok) throw new Error(`library ${response.status}`);
            const remote = (await response.json()) as {
              skills?: Skill[];
              stackIds?: string[];
              updatedAt?: string | null;
            };

            if (remote.skills?.length) {
              const nextStack = Array.isArray(remote.stackIds)
                ? remote.stackIds
                : [];
              setSkills(remote.skills);
              setStackIds(nextStack);
              lastCloudSnapshot.current = JSON.stringify({
                skills: remote.skills,
                stackIds: nextStack,
              });
              setLastSynced(remote.updatedAt || new Date().toISOString());
            } else {
              const upload = await fetch("/api/library", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  skills: localSkills,
                  stackIds: localStackIds,
                }),
              });
              if (!upload.ok) throw new Error(`migration ${upload.status}`);
              const saved = (await upload.json()) as {
                updatedAt?: string | null;
              };
              lastCloudSnapshot.current = JSON.stringify({
                skills: localSkills,
                stackIds: localStackIds,
              });
              setLastSynced(saved.updatedAt || new Date().toISOString());
            }
            setCloudReady(true);
            setSyncState("synced");
          } catch {
            setSyncState("error");
          }
        })();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewer]);

  useEffect(() => {
    if (!hydrated) return;
    recordSessionStarted(locale);
  }, [hydrated, locale]);

  const loadAnalyticsSummary = useCallback(async () => {
    if (!viewer) return false;
    setAnalyticsLoading(true);
    try {
      const response = await fetch("/api/analytics/summary", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        setAnalyticsAvailable(false);
        return false;
      }
      const summary = (await response.json()) as AnalyticsSummary;
      setAnalyticsSummary(summary);
      setAnalyticsAvailable(true);
      return true;
    } catch {
      setAnalyticsAvailable(false);
      return false;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [viewer]);

  useEffect(() => {
    if (!hydrated || !viewer) return;
    const timer = window.setTimeout(() => void loadAnalyticsSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, loadAnalyticsSummary, viewer]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(STORAGE_KEY, skills);
  }, [skills, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(STACK_KEY, stackIds);
  }, [stackIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(RADAR_RESULTS_KEY, radarResults);
  }, [hydrated, radarResults]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(HANDSHAKE_KEY, installationHandshakes);
  }, [hydrated, installationHandshakes]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(QUARANTINE_KEY, quarantineItems);
  }, [hydrated, quarantineItems]);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(OUTCOME_KEY, skillOutcomes);
  }, [hydrated, skillOutcomes]);

  useEffect(() => {
    if (!hydrated || !viewer || !cloudReady) return;
    const snapshot = JSON.stringify({ skills, stackIds });
    if (snapshot === lastCloudSnapshot.current) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setSyncState("saving");
          const response = await fetch("/api/library", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: snapshot,
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`sync ${response.status}`);
          const saved = (await response.json()) as {
            updatedAt?: string | null;
          };
          lastCloudSnapshot.current = snapshot;
          setLastSynced(saved.updatedAt || new Date().toISOString());
          setSyncState("synced");
        } catch (error) {
          if ((error as Error).name !== "AbortError") setSyncState("error");
        }
      })();
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cloudReady, hydrated, skills, stackIds, viewer]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredSkills = useMemo(() => {
    const term = search.toLowerCase().trim();
    return skills.filter((skill) => {
      const matchesCategory =
        category === "全部" || skill.category === category;
      const haystack = [
        skill.name,
        skill.description,
        localizeSkillDescription(skill, locale),
        ...Object.values(skill.descriptionI18n || {}),
        skill.category,
        ...skill.tags,
        ...skill.triggers,
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [skills, search, category, locale]);

  const matches = useMemo(
    () =>
      scoreSkills(
        brief,
        skills.filter((skill) => skill.artifactType !== "resource"),
        locale,
        t,
      ),
    [brief, skills, locale, t],
  );
  const stack = useMemo(
    () =>
      stackIds
        .map((id) => skills.find((skill) => skill.id === id))
        .filter(
          (skill): skill is Skill =>
            Boolean(skill) && skill?.artifactType !== "resource",
        )
        .sort((a, b) => layerOrder[a.layer] - layerOrder[b.layer]),
    [stackIds, skills],
  );
  const stackId = useMemo(() => stackFingerprint(stack), [stack]);
  const projectScopeId = useMemo(
    () =>
      stackFingerprint([
        { id: "project-brief", contentHash: brief.trim() || "empty" },
      ]),
    [brief],
  );
  const installationHandshake = installationHandshakes[stackId] || null;
  const currentSkillOutcomes = skillOutcomes[stackId] || {};
  const quarantineCount = quarantineItems.filter(
    (item) =>
      item.state === "review" ||
      item.state === "blocked" ||
      (item.state === "approved" &&
        item.findings.length > 0 &&
        item.approvedProjectId !== projectScopeId),
  ).length;
  const conflicts = useMemo(
    () => getConflicts(stack, brief, locale),
    [stack, brief, locale],
  );
  const interests = useMemo(
    () => inferInterests(skills, stackIds),
    [skills, stackIds],
  );
  const savedRepoUrls = useMemo(
    () =>
      new Set(
        skills
          .map((skill) => skill.sourceUrl)
          .filter((url): url is string => Boolean(url))
          .map(normalizeRepoUrl),
      ),
    [skills],
  );
  const visibleRadarResults = useMemo(
    () =>
      radarResults.filter(
        (repo) =>
          !savedRepoUrls.has(normalizeRepoUrl(repo.htmlUrl)) &&
          !dismissedRepoIds.includes(repo.id),
      ),
    [dismissedRepoIds, radarResults, savedRepoUrls],
  );
  const candidateCount = visibleRadarResults.length;

  const navigate = useCallback(
    (next: View) => {
      setView(next);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [],
  );

  const loadSkillsNetwork = useCallback(
    async (nextView: SkillsNetworkView) => {
      setSkillsNetworkView(nextView);
      setSkillsNetworkLoading(true);
      setSkillsNetworkError(false);
      try {
        const response = await fetch(
          `/api/skills-network/feed?view=${encodeURIComponent(nextView)}`,
          {
            headers: { accept: "application/json" },
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          entries?: SkillsNetworkEntry[];
          source?: "live" | "fallback";
        } | null;
        if (!response.ok || !payload?.entries?.length) {
          throw new Error("skills network unavailable");
        }
        setSkillsNetworkEntries(payload.entries);
        setSkillsNetworkSource(payload.source || "fallback");
      } catch {
        setSkillsNetworkError(true);
      } finally {
        setSkillsNetworkLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !hydrated ||
      view !== "radar" ||
      skillsNetworkEntries.length ||
      skillsNetworkLoading
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => void loadSkillsNetwork(skillsNetworkView),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    loadSkillsNetwork,
    skillsNetworkEntries.length,
    skillsNetworkLoading,
    skillsNetworkView,
    view,
  ]);

  const runRadar = useCallback(
    async (silent = false) => {
      if (!interests.length && !radarSeed.trim()) {
        if (!silent) navigate("radar");
        return;
      }
      setIsRadarLoading(true);
      setRadarError(null);
      try {
        const primaryTopic =
          expandIdeaSeed(radarSeed)[0] ||
          radarFeedback.likedTopics[0] ||
          interests[0]?.topic ||
          "agent skills";
        const queryPlan: Array<{
          lane: GithubRepo["lane"];
          topic: string;
        }> = [
          { lane: "focus", topic: primaryTopic },
          { lane: "adjacent", topic: getAdjacentTopic(primaryTopic) },
          { lane: "wildcard", topic: getWildcardTopic(primaryTopic) },
        ];
        const response = await fetch("/api/radar/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            queries: queryPlan.map(({ lane, topic }, laneIndex) => ({
              lane,
              topic,
              page: ((radarSettings.scanCursor + laneIndex - 1) % 5) + 1,
            })),
          }),
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          results?: GithubRepo[];
          error?: RadarSearchFailure;
          retryAt?: string;
        } | null;
        if (!response.ok || !payload?.results) {
          const searchError = new Error(
            payload?.error || "github_unavailable",
          ) as Error & {
            code?: RadarSearchFailure;
            retryAt?: string;
          };
          searchError.code = payload?.error || "github_unavailable";
          searchError.retryAt = payload?.retryAt;
          throw searchError;
        }
        const payloads = queryPlan.map(({ lane }) =>
          payload.results!
            .filter((repo) => repo.lane === lane)
            .map((repo) => ({
              ...repo,
              auditStatus: "unverified" as const,
              auditNotes: [],
            })),
        );
        const seen = new Set<number>();
        const results = payloads
          .flat()
          .filter((repo) => {
            const text =
              `${repo.name} ${repo.description} ${repo.topics.join(" ")}`;
            return (
              /\bskills?\b/i.test(text) ||
              (/\b(codex|claude)\b/i.test(text) &&
                /\b(agent|workflow|plugin)\b/i.test(text))
            );
          })
          .filter((repo) => !repo.fork)
          .filter((repo) => {
            if (repo.lane === "wildcard") return true;
            const rejected = new Set(
              radarFeedback.dislikedTopics.map((topic) => topic.toLowerCase()),
            );
            const overlap = repo.topics.filter((topic) =>
              rejected.has(topic.toLowerCase()),
            ).length;
            return overlap < 2;
          })
          .filter((repo) => {
            if (
              seen.has(repo.id) ||
              dismissedRepoIds.includes(repo.id) ||
              savedRepoUrls.has(normalizeRepoUrl(repo.htmlUrl))
            ) {
              return false;
            }
            seen.add(repo.id);
            return true;
          })
          .sort((a, b) => {
            const score = (repo: GithubRepo) =>
              (/\bskills?\b/i.test(repo.name) ? 28 : 0) +
              (/\bskills?\b/i.test(repo.description) ? 14 : 0) +
              (repo.topics.some((topic) =>
                /^(agent-skills?|skills?)$/i.test(topic),
              )
                ? 24
                : 0) +
              (/\b(codex|claude)\b/i.test(
                `${repo.name} ${repo.description}`,
              )
                ? 8
                : 0) +
              (repo.license &&
              !/^(NOASSERTION|OTHER)$/i.test(repo.license)
                ? 4
                : 0) +
              Math.min(Math.log10(repo.stars + 1) * 3, 10) -
              (repo.archived ? 20 : 0);
            return score(b) - score(a);
          })
          .slice(0, 24);
        const now = new Date().toISOString();
        setInspectionAttemptedRepoIds([]);
        setRadarResults(results);
        setRadarSettings((current) => {
          const next = {
            ...current,
            lastRun: now,
            scanCursor: (current.scanCursor % 5) + 1,
          };
          writeLocal(RADAR_KEY, next);
          return next;
        });
        writeLocal(RADAR_RESULTS_KEY, results);
        recordProductEvent("radar_searched", locale, {
          resultBucket: countBucket(results.length),
          mode: radarSeed.trim() ? "idea" : "profile",
        });
        if (!silent && results.length) {
          setToast(t("toastRadarFound", { count: results.length }));
        }
      } catch (error) {
        const code =
          (error as Error & { code?: RadarSearchFailure }).code ||
          "github_unavailable";
        setRadarError(code);
        setRadarSettings((current) => {
          const next = { ...current, lastRun: new Date().toISOString() };
          writeLocal(RADAR_KEY, next);
          return next;
        });
      } finally {
        setIsRadarLoading(false);
      }
    },
    [
      dismissedRepoIds,
      interests,
      locale,
      navigate,
      radarSeed,
      radarFeedback,
      radarSettings.scanCursor,
      savedRepoUrls,
      t,
    ],
  );

  useEffect(() => {
    if (!hydrated || !radarSettings.enabled || isRadarLoading) return;
    const last = radarSettings.lastRun
      ? new Date(radarSettings.lastRun).getTime()
      : 0;
    const due = Date.now() - last > 24 * 60 * 60 * 1000;
    if (!due) return;
    const timer = window.setTimeout(() => void runRadar(true), 0);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    isRadarLoading,
    radarSettings.enabled,
    radarSettings.lastRun,
    runRadar,
  ]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    writeLocal("bitcase-theme", next);
  }

  function changeLocale(next: Locale) {
    setLocale(next);
    document.documentElement.lang = next;
    writeLocal(LOCALE_KEY, next);
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setToast(t("toastInstalled"));
      recordProductEvent("pwa_installed", locale, { surface: "pwa" });
    }
  }

  function skillNeedsQuarantineApproval(skill: Skill) {
    if (skill.quarantineStatus !== "review") return false;
    const item = quarantineItems.find(
      (candidate) => candidate.contentHash === skill.contentHash,
    );
    if (!item) return true;
    if (!item.findings.length) return false;
    return !(
      item.state === "approved" &&
      item.approvedProjectId === projectScopeId
    );
  }

  function toggleStack(id: string) {
    const target = skills.find((skill) => skill.id === id);
    if (target?.artifactType === "resource") {
      setToast(t("resourceCannotStack"));
      return;
    }
    if (
      target &&
      skillNeedsQuarantineApproval(target) &&
      !stackIds.includes(id)
    ) {
      setToast(t("toastQuarantineRequired"));
      navigate("quarantine");
      return;
    }
    setStackIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function autoAssemble() {
    setIsMatching(true);
    setHasMatched(false);
    window.setTimeout(() => {
      const selected = matches
        .filter((match) => match.score >= 5)
        .slice(0, 5)
        .map((match) => match.skill.id);
      setStackIds(selected);
      setIsMatching(false);
      setHasMatched(true);
      setToast(
        selected.length ? t("toastAssembled") : t("toastNoMatch"),
      );
      recordProductEvent("stack_assembled", locale, {
        stackBucket: countBucket(selected.length),
      });
    }, 520);
  }

  function addSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const sourceUrl = String(form.get("sourceUrl") || "").trim();
    const categoryValue = String(
      form.get("category") || "工程",
    ) as Category;
    const tags = String(form.get("tags") || "")
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const triggers = String(form.get("triggers") || "")
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!name || !description) return;
    const baseId = safeId(name);
    const id = skills.some((skill) => skill.id === baseId)
      ? `${baseId}-${Date.now()}`
      : baseId;
    setSkills((current) => [
      {
        id,
        name,
        description,
        category: categoryValue,
        source: sourceUrl.includes("github.com") ? "GitHub" : "Manual",
        sourceUrl: sourceUrl || undefined,
        tags,
        triggers,
        layer: categoryValue === "设计" ? "风格" : "领域",
        trust: "待验证",
        descriptionI18n: { [locale]: description },
      },
      ...current,
    ]);
    event.currentTarget.reset();
    setIsAddOpen(false);
    setToast(t("toastAdded", { name }));
    recordProductEvent("skill_added", locale, {
      source: sourceUrl.includes("github.com") ? "github" : "manual",
    });
  }

  const inspectCandidate = useCallback(
    async (repo: GithubRepo) => {
      const response = await fetch("/api/radar/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch || "main",
          locale,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        result?: CandidateInspection;
        error?: SkillInspectionFailure;
        retryAt?: string;
      } | null;
      if (!response.ok || !payload?.result) {
        throw new SkillInspectionClientError(
          payload?.error || "github_unavailable",
          payload?.retryAt,
        );
      }
      return payload.result;
    },
    [locale],
  );

  const handleInspectionError = useCallback(
    (error: unknown) => {
      if (error instanceof SkillInspectionClientError) {
        if (error.code === "rate_limited") {
          const retryTime =
            error.retryAt && !Number.isNaN(Date.parse(error.retryAt))
              ? new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(error.retryAt))
              : null;
          setToast(
            retryTime
              ? t("toastGithubRateLimitedAt", { time: retryTime })
              : t("toastGithubRateLimited"),
          );
        } else if (
          error.code === "private_or_unavailable" ||
          error.code === "invalid_repo"
        ) {
          setToast(t("toastRepoUnavailable"));
        } else if (error.code === "skill_too_large") {
          setToast(t("toastSkillTooLarge"));
        } else {
          setToast(t("toastGithubUnavailable"));
        }
      } else {
        setToast(t("toastSkillInspectionError"));
      }
    },
    [locale, t],
  );

  const explainCandidate = useCallback(
    async (repo: GithubRepo, announce = false) => {
      setInspectingRepoId(repo.id);
      try {
        const inspection = await inspectCandidate(repo);
        const inspectedRepo = withInspection(repo, inspection);
        const captured = quarantineFromInspection(repo, inspection);
        if (captured.length) {
          setQuarantineItems((current) =>
            mergeQuarantineItems(current, captured),
          );
        }
        setRadarResults((current) =>
          current.map((item) =>
            item.id === repo.id ? inspectedRepo : item,
          ),
        );
        if (!announce) return;
        if (inspection.status === "missing") {
          setToast(t("toastResourceAvailable"));
        } else if (inspection.status === "blocked") {
          const intake = planSkillIntake(inspection);
          setToast(
            intake.usableFiles.length
              ? t("toastSkillSelectiveAvailable", {
                  count: intake.usableFiles.length,
                })
              : t("toastSkillBlocked"),
          );
        } else {
          setToast(
            t("toastSkillExplained", {
              count: inspection.fileCount,
            }),
          );
        }
      } catch (error) {
        handleInspectionError(error);
      } finally {
        setInspectingRepoId(null);
      }
    },
    [handleInspectionError, inspectCandidate, t],
  );

  useEffect(() => {
    if (
      !hydrated ||
      view !== "radar" ||
      isRadarLoading ||
      inspectingRepoId !== null
    ) {
      return;
    }
    const next = visibleRadarResults.find(
      (repo) =>
        !repo.inspection &&
        !inspectionAttemptedRepoIds.includes(repo.id),
    );
    if (!next) return;
    const timer = window.setTimeout(() => {
      setInspectionAttemptedRepoIds((current) =>
        current.includes(next.id) ? current : [...current, next.id],
      );
      void explainCandidate(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    explainCandidate,
    hydrated,
    inspectingRepoId,
    inspectionAttemptedRepoIds,
    isRadarLoading,
    view,
    visibleRadarResults,
  ]);

  function saveRepositoryResource(
    repo: GithubRepo,
    inspection: CandidateInspection,
  ) {
    const descriptionI18n = Object.fromEntries(
      localeOptions.map(({ value }) => [
        value,
        localizeDecisionProfile(
          repo,
          inspection.profile,
          value,
          0,
        ).verdict,
      ]),
    ) as Partial<Record<Locale, string>>;
    const resource: Skill = {
      id: `github-resource-${repo.id}`,
      name: repo.name,
      description:
        descriptionI18n[locale] ||
        inspection.profile.overview ||
        repo.description,
      descriptionI18n,
      category: "工程",
      source: "GitHub Resource",
      sourceUrl: repo.htmlUrl,
      tags: repo.topics.slice(0, 5),
      triggers: [],
      layer: "增强",
      trust: "待验证",
      artifactType: "resource",
      quarantineStatus: "review",
      sourceInspectionComplete: inspection.inspectionComplete !== false,
      auditStatus: "warning",
      auditNotes: Array.from(
        new Set(["no-skill-file", ...(inspection.notes || [])]),
      ),
    };
    setSkills((current) => [resource, ...current]);
    setRadarResults((current) =>
      current.map((item) =>
        item.id === repo.id ? withInspection(item, inspection) : item,
      ),
    );
    setToast(t("toastResourceSaved", { name: repo.name }));
    recordProductEvent("radar_resource_saved", locale, {
      lane: repo.lane,
    });
  }

  async function saveCandidate(repo: GithubRepo) {
    setInspectingRepoId(repo.id);
    try {
      const repositoryInspection =
        repo.inspection || (await inspectCandidate(repo));
      const inspection = scopeInspectionToSelectedSkill(
        repositoryInspection,
        repo.selectedSkillPath,
      );
      const auditedRepo = withInspection(repo, inspection);
      const captured = quarantineFromInspection(repo, inspection);
      if (captured.length) {
        setQuarantineItems((current) =>
          mergeQuarantineItems(current, captured),
        );
      }
      setRadarResults((current) =>
        current.map((item) => (item.id === repo.id ? auditedRepo : item)),
      );
      if (inspection.status === "missing") {
        saveRepositoryResource(repo, inspection);
        return;
      }
      const intake = planSkillIntake(inspection);
      if (!intake.usableFiles.length) {
        setToast(
          intake.blockedFiles.length
            ? t("allSkillsBlocked")
            : t("toastSkillPartial"),
        );
        return;
      }
      if (
        intake.usableFiles.every((skillFile) =>
          skills.some(
            (skill) => skill.contentHash === skillFile.contentHash,
          ),
        )
      ) {
        setToast(t("toastSkillDuplicate"));
        return;
      }
      const knownHashes = new Set(
        skills
          .map((skill) => skill.contentHash)
          .filter((hash): hash is string => Boolean(hash)),
      );
      const additions: Skill[] = intake.usableFiles
        .filter((skillFile) => !knownHashes.has(skillFile.contentHash))
        .map((skillFile) => {
          const needsReview =
            skillFile.status === "warning" ||
            intake.requiresRepositoryReview;
          return {
            id: `github-${repo.id}-${safeId(skillFile.name)}-${skillFile.contentHash.slice(0, 8)}`,
            name: skillFile.name,
            description:
              skillFile.description ||
              inspection.description ||
              auditedRepo.description,
            category: "工程",
            source:
              repo.registrySource === "bitcase-featured"
                ? "Bitcase featured GitHub"
                : repo.registryUrl
                  ? "skills.sh via Bitcase"
                  : "GitHub Radar",
            sourceUrl: auditedRepo.htmlUrl,
            registryUrl: repo.registryUrl,
            registrySource: repo.registrySource,
            installation: repo.installation,
            tags: auditedRepo.topics.length
              ? auditedRepo.topics.slice(0, 5)
              : interests.map((item) => item.topic),
            triggers: interests.map((item) => item.topic),
            layer: "领域",
            trust: "待验证",
            artifactType: "skill",
            quarantineStatus: needsReview ? "review" : "none",
            sourceInspectionComplete:
              inspection.inspectionComplete !== false,
            contentHash: skillFile.contentHash,
            skillPath: skillFile.path,
            auditStatus: needsReview ? "warning" : "clean",
            auditNotes: Array.from(
              new Set([
                ...skillFile.notes,
                ...(intake.requiresRepositoryReview
                  ? ["repository-scan-incomplete"]
                  : []),
              ]),
            ),
            auditFindings: skillFile.findings || [],
          };
        });
      if (!additions.length) {
        setToast(t("toastSkillDuplicate"));
        return;
      }
      setSkills((current) => [...additions, ...current]);
      setRadarFeedback((current) => {
        const next = {
          ...current,
          likedTopics: Array.from(
            new Set([...repo.topics, ...current.likedTopics]),
          ).slice(0, 18),
        };
        writeLocal(RADAR_FEEDBACK_KEY, next);
        return next;
      });
      setToast(
        intake.blockedFiles.length
          ? t("toastRadarSavedSelective", {
              count: additions.length,
              blocked: intake.blockedFiles.length,
            })
          : intake.reviewFiles.length
            ? t("toastRadarSavedReview", { count: additions.length })
            : additions.length > 1
              ? t("toastRadarSavedMany", { count: additions.length })
              : t("toastRadarSaved", {
                  name: additions[0]?.name || auditedRepo.name,
                }),
      );
      recordProductEvent("radar_candidate_saved", locale, {
        lane: repo.lane,
        safety: intake.blockedFiles.length
          ? "selective"
          : intake.reviewFiles.length
            ? "review"
            : "clean",
      });
      if (repo.registryUrl) {
        recordProductEvent("skills_network_imported", locale, {
          safety: intake.reviewFiles.length ? "review" : "clean",
        });
      }
    } catch (error) {
      handleInspectionError(error);
    } finally {
      setInspectingRepoId(null);
    }
  }

  async function importSkillsNetworkSkill(input: string) {
    const value = input.trim();
    if (!value) {
      setToast(t("skillsNetworkPasteRequired"));
      return;
    }
    setSkillsNetworkImporting(value);
    try {
      const response = await fetch("/api/skills-network/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value, locale }),
      });
      const payload = (await response.json().catch(() => null)) as {
        result?: SkillsNetworkResolved;
        error?: string;
        retryAt?: string;
      } | null;
      if (!response.ok || !payload?.result) {
        if (payload?.error === "invalid_skills_url") {
          setToast(t("skillsNetworkInvalidUrl"));
        } else if (payload?.error === "skill_not_found") {
          setToast(t("skillsNetworkNotFound"));
        } else if (payload?.error === "rate_limited") {
          setToast(t("toastGithubRateLimited"));
        } else {
          setToast(t("skillsNetworkUnavailable"));
        }
        return;
      }
      const { repository, inspection, selectedSkillPath, entry } =
        payload.result;
      await saveCandidate({
        ...repository,
        inspection: inspection as CandidateInspection,
        selectedSkillPath,
        registryUrl: entry.url,
        registrySource: entry.origin,
        installation: entry.installation,
        auditStatus: "unverified",
        auditNotes: [],
      });
    } catch {
      setToast(t("skillsNetworkUnavailable"));
    } finally {
      setSkillsNetworkImporting("");
    }
  }

  function dismissCandidate(repo: GithubRepo) {
    setDismissedRepoIds((current) => {
      const next = current.includes(repo.id) ? current : [...current, repo.id];
      writeLocal(RADAR_DISMISSED_KEY, next);
      return next;
    });
    setRadarFeedback((current) => {
      const next = {
        ...current,
        dislikedTopics: Array.from(
          new Set([...repo.topics, ...current.dislikedTopics]),
        ).slice(0, 18),
      };
      writeLocal(RADAR_FEEDBACK_KEY, next);
      return next;
    });
    setToast(t("toastCandidateDismissed"));
    recordProductEvent("radar_candidate_dismissed", locale, {
      lane: repo.lane,
    });
  }

  function changeRadarSeed(value: string) {
    setRadarSeed(value);
    writeLocal(RADAR_SEED_KEY, value);
  }

  function deleteSkill(id: string) {
    const target = skills.find((skill) => skill.id === id);
    if (!target || target.builtIn) return;
    setSkills((current) => current.filter((skill) => skill.id !== id));
    setStackIds((current) => current.filter((item) => item !== id));
    setToast(t("toastRemoved"));
  }

  function exportStack() {
    if (stack.some(skillNeedsQuarantineApproval)) {
      setToast(t("toastQuarantineRequired"));
      navigate("quarantine");
      return;
    }
    downloadJson(
      "bitcase-codex-stack.json",
      buildStackManifest(stack, brief, conflicts, locale, t),
    );
    setToast(t("toastStackExported"));
    recordProductEvent("stack_exported", locale, {
      stackBucket: countBucket(stack.length),
    });
  }

  function copyCodexHandoff() {
    if (stack.some(skillNeedsQuarantineApproval)) {
      setToast(t("toastQuarantineRequired"));
      navigate("quarantine");
      return;
    }
    void copyText(buildCodexPrompt(stack, brief, locale));
    setToast(t("toastCopied"));
    recordProductEvent("prompt_copied", locale, {
      stackBucket: countBucket(stack.length),
    });
    recordProductEvent("codex_handoff_opened", locale, {
      stackBucket: countBucket(stack.length),
    });
  }

  function importInstallationHandshake(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          stackId?: unknown;
        };
        if (parsed.stackId !== stackId) {
          setToast(t("toastHandshakeWrongStack"));
          return;
        }
        const normalized = normalizeInstallationHandshake(
          parsed,
          stackId,
          stack.map((skill) => ({
            id: skill.id,
            name: skill.name,
            contentHash: skill.contentHash,
          })),
        );
        if (!normalized) throw new Error("invalid-handshake");
        setInstallationHandshakes((current) => ({
          ...current,
          [stackId]: normalized,
        }));
        const needsAttention = normalized.skills.filter(
          (skill) => skill.status !== "installed",
        ).length;
        setToast(
          needsAttention
            ? t("toastHandshakeNeedsAttention", {
                count: needsAttention,
              })
            : t("toastHandshakeImported"),
        );
        recordProductEvent("installation_handshake_imported", locale, {
          result: needsAttention ? "needs_attention" : "complete",
          stackBucket: countBucket(stack.length),
        });
      } catch {
        setToast(t("toastHandshakeInvalid"));
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = Array.isArray(parsed) ? parsed : parsed.skills;
        if (!Array.isArray(incoming)) throw new Error("invalid");
        const valid = incoming.filter(
          (item) => item?.id && item?.name && item?.description,
        ) as Skill[];
        setSkills((current) => {
          const map = new Map(current.map((skill) => [skill.id, skill]));
          valid.forEach((skill) => map.set(skill.id, skill));
          return Array.from(map.values());
        });
        setToast(t("toastImported", { count: valid.length }));
        recordProductEvent("library_imported", locale, {
          count: valid.length,
        });
      } catch {
        setToast(t("toastImportError"));
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function exportLibrary() {
    downloadJson("bitcase-library.json", { product: "Bitcase", skills });
    setToast(t("toastLibraryExported"));
  }

  function toggleRadar() {
    setRadarSettings((current) => {
      const next = { ...current, enabled: !current.enabled };
      writeLocal(RADAR_KEY, next);
      return next;
    });
  }

  function toggleTelemetry() {
    const next = !telemetryEnabled;
    setTelemetryEnabled(next);
    setAnonymousAnalyticsEnabled(next);
    if (next) recordSessionStarted(locale);
  }

  function submitSkillOutcome(skillId: string, outcome: SkillOutcome) {
    const nextForStack = {
      ...(skillOutcomes[stackId] || {}),
      [skillId]: outcome,
    };
    setSkillOutcomes((current) => ({
      ...current,
      [stackId]: nextForStack,
    }));
    recordProductEvent("skill_outcome_submitted", locale, { outcome });
    if (stack.every((skill) => nextForStack[skill.id])) {
      setFeedbackPrompt(false);
      setToast(t("outcomeAllRecorded"));
    } else {
      setToast(t("outcomeRecorded"));
    }
  }

  function updateQuarantineState(
    id: string,
    action: "review" | "ignore" | "approve",
  ) {
    const item = quarantineItems.find((candidate) => candidate.id === id);
    if (!item) return;
    if (action === "approve" && item.state === "blocked") {
      setToast(t("toastBlockedCannotApprove"));
      return;
    }
    const nextState =
      action === "ignore"
        ? "ignored"
        : action === "approve"
          ? "approved"
          : item.state === "blocked"
            ? "blocked"
            : "review";
    setQuarantineItems((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              state: nextState,
              approvedProjectId:
                action === "approve" ? projectScopeId : null,
              reviewedAt: new Date().toISOString(),
            }
          : candidate,
      ),
    );
    if (action === "approve") {
      setToast(t("toastQuarantineApproved"));
    } else if (action === "ignore") {
      const ignoredSkillIds = skills
        .filter((skill) => skill.contentHash === item.contentHash)
        .map((skill) => skill.id);
      setStackIds((current) =>
        current.filter((skillId) => !ignoredSkillIds.includes(skillId)),
      );
      setToast(t("toastQuarantineIgnored"));
    } else {
      setToast(t("toastReviewLater"));
    }
    recordProductEvent("quarantine_action", locale, {
      action,
      severity: item.state === "blocked" ? "blocked" : "review",
    });
  }

  async function reinspectQuarantine(item: QuarantineItem) {
    setInspectingRepoId(item.repositoryId);
    try {
      const repo: GithubRepo = {
        id: item.repositoryId,
        name: item.repositoryName,
        fullName: item.fullName,
        htmlUrl: item.sourceUrl,
        description: "",
        stars: 0,
        updatedAt: new Date().toISOString(),
        archived: false,
        license: null,
        topics: [],
        defaultBranch: item.defaultBranch,
        lane: "focus",
      };
      const inspection = await inspectCandidate(repo);
      const inspectedFile = inspection.skillFiles.find(
        (skillFile) => skillFile.path === item.skillPath,
      );
      if (!inspectedFile) throw new Error("skill-file-missing");
      const incoming = quarantineFromInspection(repo, inspection).filter(
        (candidate) => candidate.skillPath === item.skillPath,
      );
      const cleanReplacement: QuarantineItem = {
        ...item,
        id: `${item.repositoryId}:${inspectedFile.path}:${inspectedFile.contentHash}`,
        contentHash: inspectedFile.contentHash,
        findings: inspectedFile.findings || [],
        state: inspectedFile.status === "clean" ? "approved" : item.state,
        approvedProjectId:
          inspectedFile.status === "clean" ? null : item.approvedProjectId,
        capturedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        inspectionComplete: inspection.inspectionComplete !== false,
      };
      setQuarantineItems((current) =>
        mergeQuarantineItems(
          current.filter(
            (candidate) =>
              !(
                candidate.repositoryId === item.repositoryId &&
                candidate.skillPath === item.skillPath
              ),
          ),
          incoming.length ? incoming : [cleanReplacement],
        ),
      );
      setSkills((current) =>
        current.map((skill) =>
          normalizeRepoUrl(skill.sourceUrl || "") ===
            normalizeRepoUrl(item.sourceUrl) &&
          skill.skillPath === item.skillPath
            ? {
                ...skill,
                contentHash: inspectedFile.contentHash,
                auditStatus:
                  inspectedFile.status === "clean" ? "clean" : "warning",
                auditNotes: inspectedFile.notes,
                auditFindings: inspectedFile.findings || [],
                quarantineStatus:
                  inspectedFile.status === "clean" ? "none" : "review",
              }
            : skill,
        ),
      );
      setToast(
        inspectedFile.status === "clean"
          ? t("toastReinspectClean")
          : t("toastReinspectStillRisky"),
      );
      recordProductEvent("quarantine_action", locale, {
        action: "reinspect",
        severity:
          inspectedFile.status === "blocked" ? "blocked" : "review",
      });
    } catch (error) {
      handleInspectionError(error);
    } finally {
      setInspectingRepoId(null);
    }
  }

  function startDemo() {
    setBrief(t("demoBrief"));
    setHasMatched(false);
    navigate("composer");
  }

  function loadBeginnerSample() {
    const sampleStack = [
      "route-private-skills",
      "spreadsheets",
      "sites-building",
      "design-taste-frontend",
    ].filter((id) => skills.some((skill) => skill.id === id));
    setBrief(t("demoBrief"));
    setStackIds(sampleStack);
    setHasMatched(true);
    navigate("stack");
    setToast(t("toastSampleLoaded"));
    recordProductEvent("codex_sample_loaded", locale, {
      stackBucket: countBucket(sampleStack.length),
    });
  }

  function finishOnboarding(
    level: OnboardingLevel,
    destination: "sample" | "radar" | "library",
  ) {
    writeLocal(ONBOARDING_KEY, { completed: true, level });
    setOnboardingLevel(level);
    setOnboardingOpen(false);
    recordProductEvent("onboarding_completed", locale, { level });
    if (destination === "sample") {
      loadBeginnerSample();
    } else {
      navigate(destination);
    }
  }

  function skipOnboarding() {
    writeLocal(ONBOARDING_KEY, {
      completed: true,
      level: onboardingLevel || "expert",
    });
    setOnboardingOpen(false);
    recordProductEvent("onboarding_skipped", locale, {
      level: onboardingLevel || "unselected",
    });
  }

  function reopenOnboarding() {
    setOnboardingLevel(null);
    setOnboardingOpen(true);
  }

  function checkStackPreflight() {
    if (!installationHandshake) {
      setToast(t("toastHandshakeRequired"));
      return;
    }
    const needsAttention = installationHandshake.skills.filter(
      (skill) => skill.status !== "installed",
    ).length;
    setToast(
      needsAttention === 0
        ? t("toastPreflightPassed")
        : t("toastPreflightNeedsReview", {
            count: needsAttention,
          }),
    );
    recordProductEvent("stack_preflight_checked", locale, {
      stackBucket: countBucket(stack.length),
    });
  }

  async function openInsights() {
    const available = await loadAnalyticsSummary();
    if (available) navigate("insights");
  }

  async function syncNow() {
    if (!viewer) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F";
      return;
    }
    try {
      setSyncState("saving");
      const response = await fetch("/api/library", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skills, stackIds }),
      });
      if (!response.ok) throw new Error(`sync ${response.status}`);
      const saved = (await response.json()) as {
        updatedAt?: string | null;
      };
      lastCloudSnapshot.current = JSON.stringify({ skills, stackIds });
      setLastSynced(saved.updatedAt || new Date().toISOString());
      setCloudReady(true);
      setSyncState("synced");
      setToast(t("toastCloudSynced"));
    } catch {
      setSyncState("error");
      setToast(t("toastCloudError"));
    }
  }

  const syncLabel =
    syncState === "loading"
      ? t("syncLoading")
      : syncState === "saving"
        ? t("syncSaving")
        : syncState === "synced"
          ? t("syncReady")
          : syncState === "error"
            ? t("syncError")
            : t("localOnly");

  const viewLabels: Record<View, string> = {
    library: t("navLibrary"),
    composer: t("navMatch"),
    stack: t("navStack"),
    radar: t("navRadar"),
    quarantine: t("navQuarantine"),
    account: t("navAccount"),
    insights: t("navInsights"),
  };

  return (
    <main className="app-shell">
      <GreekSky />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="omega-mark">Ω</span>
          </div>
          <div>
            <strong>BITCASE</strong>
            <span>SKILL OPERATING LIBRARY</span>
          </div>
        </div>
        <GreekGuideMascot t={t} onOpenGuide={reopenOnboarding} />
        <div className="greek-frieze" aria-hidden="true" />

        <nav className="main-nav" aria-label={t("archive")}>
          <NavButton
            active={view === "library"}
            icon={<SquaresFour size={19} />}
            label={t("navLibrary")}
            count={skills.length}
            onClick={() => navigate("library")}
          />
          <NavButton
            active={view === "composer"}
            icon={<MagicWand size={19} />}
            label={t("navMatch")}
            onClick={() => navigate("composer")}
          />
          <NavButton
            active={view === "stack"}
            icon={<Stack size={19} />}
            label={t("navStack")}
            count={stack.length || undefined}
            onClick={() => navigate("stack")}
          />
          <NavButton
            active={view === "radar"}
            icon={<Broadcast size={19} />}
            label={t("navRadar")}
            count={candidateCount || undefined}
            onClick={() => navigate("radar")}
          />
          <NavButton
            active={view === "quarantine"}
            icon={<Warning size={19} />}
            label={t("navQuarantine")}
            count={quarantineCount || undefined}
            onClick={() => navigate("quarantine")}
          />
          <NavButton
            active={view === "account"}
            icon={<UserCircle size={19} />}
            label={t("navAccount")}
            onClick={() => navigate("account")}
          />
          {analyticsAvailable && (
            <NavButton
              active={view === "insights"}
              icon={<Database size={19} />}
              label={t("navInsights")}
              onClick={() => void openInsights()}
            />
          )}
        </nav>

        <div className="sidebar-spacer" />
        <div className="storage-card">
          {syncState === "loading" || syncState === "saving" ? (
            <CircleNotch className="spin" size={19} />
          ) : viewer ? (
            <PlugsConnected size={19} />
          ) : (
            <ShieldCheck size={19} />
          )}
          <div>
            <strong>{syncLabel}</strong>
            <span>{viewer ? t("cloudSyncDesc") : t("localDesc")}</span>
          </div>
        </div>
        <button className="nav-row muted" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          <span>
            {theme === "dark" ? t("switchLight") : t("switchDark")}
          </span>
        </button>
        <div className="alpha-line">
          <a
            href="https://github.com/Tomchen070814/bitcase-community"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={12} />
            SOURCE
          </a>
          <span>OPEN BETA</span>
          <span>ΜΗΧΑΝΗ</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <span className="omega-mark">Ω</span>
            </div>
            <strong>BITCASE</strong>
          </div>
          <div className="breadcrumb">
            <span>{t("archive")}</span>
            <ArrowRight size={14} />
            <strong>{viewLabels[view]}</strong>
          </div>
          <div className="top-actions">
            <a
              className="icon-button source-code-link"
              href="https://github.com/Tomchen070814/bitcase-community"
              target="_blank"
              rel="noreferrer"
              aria-label={t("sourceCode")}
              title={t("sourceCode")}
            >
              <GitBranch size={18} />
            </a>
            <LanguageMenu
              locale={locale}
              label={t("language")}
              onChange={changeLocale}
            />
            {installPrompt && (
              <button
                className="button secondary install-button"
                onClick={() => void installApp()}
              >
                <DownloadSimple size={17} />
                <span>{t("installApp")}</span>
              </button>
            )}
            <button
              className="icon-button mobile-theme"
              aria-label={t("theme")}
              title={t("theme")}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="button secondary import-button"
              onClick={() => importRef.current?.click()}
            >
              <UploadSimple size={17} />
              <span>{t("import")}</span>
            </button>
            <input
              ref={importRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={importLibrary}
            />
            <button
              className="button primary"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus size={17} weight="bold" />
              <span>{t("addSkill")}</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="view-transition"
            initial={
              reduceMotion ? false : { opacity: 0, y: 20, scale: 0.988 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 0, y: -12, scale: 0.996 }
            }
            transition={{
              duration: reduceMotion ? 0 : 0.42,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {view === "library" && (
              <LibraryView
                t={t}
                locale={locale}
                skills={filteredSkills}
                allSkills={skills}
                stackIds={stackIds}
                search={search}
                category={category}
                onSearch={setSearch}
                onCategory={setCategory}
                onToggleStack={toggleStack}
                onDelete={deleteSkill}
                onExport={exportLibrary}
                onOpenAdd={() => setIsAddOpen(true)}
                onStartDemo={startDemo}
              />
            )}
            {view === "composer" && (
              <ComposerView
                t={t}
                locale={locale}
                brief={brief}
                onBrief={setBrief}
                matches={matches}
                stackIds={stackIds}
                isMatching={isMatching}
                hasMatched={hasMatched}
                onMatch={autoAssemble}
                onToggle={toggleStack}
                onOpenStack={() => navigate("stack")}
              />
            )}
            {view === "stack" && (
              <StackView
                t={t}
                locale={locale}
                stack={stack}
                brief={brief}
                conflicts={conflicts}
                stackId={stackId}
                handshake={installationHandshake}
                outcomes={currentSkillOutcomes}
                onRemove={toggleStack}
                onExport={exportStack}
                onCopy={copyCodexHandoff}
                onCompose={() => navigate("composer")}
                onLoadSample={loadBeginnerSample}
                onCheckPreflight={checkStackPreflight}
                onImportHandshake={importInstallationHandshake}
                onOpenOutcomes={() => setFeedbackPrompt(true)}
              />
            )}
            {view === "radar" && (
              <RadarView
                t={t}
                locale={locale}
                interests={interests}
                settings={radarSettings}
                feedback={radarFeedback}
                results={visibleRadarResults}
                seed={radarSeed}
                isLoading={isRadarLoading}
                networkView={skillsNetworkView}
                networkEntries={skillsNetworkEntries}
                networkSource={skillsNetworkSource}
                networkLoading={skillsNetworkLoading}
                networkError={skillsNetworkError}
                networkImporting={skillsNetworkImporting}
                inspectingRepoId={inspectingRepoId}
                inspectionAttemptedRepoIds={inspectionAttemptedRepoIds}
                error={radarError}
                onToggle={toggleRadar}
                onRun={() => void runRadar(false)}
                onSeed={changeRadarSeed}
                onNetworkView={(nextView) =>
                  void loadSkillsNetwork(nextView)
                }
                onNetworkImport={(url) =>
                  void importSkillsNetworkSkill(url)
                }
                onExplain={(repo) => void explainCandidate(repo, true)}
                onSave={(repo) => void saveCandidate(repo)}
                onDismiss={dismissCandidate}
              />
            )}
            {view === "quarantine" && (
              <QuarantineView
                t={t}
                locale={locale}
                items={quarantineItems}
                projectScopeId={projectScopeId}
                inspectingRepoId={inspectingRepoId}
                onAction={updateQuarantineState}
                onReinspect={(item) => void reinspectQuarantine(item)}
              />
            )}
            {view === "account" && (
              <AccountView
                t={t}
                locale={locale}
                viewer={viewer}
                syncState={syncState}
                lastSynced={lastSynced}
                onSyncNow={() => void syncNow()}
                telemetryEnabled={telemetryEnabled}
                onToggleTelemetry={toggleTelemetry}
                showInsights={analyticsAvailable}
                onOpenInsights={() => void openInsights()}
                onOpenGuide={reopenOnboarding}
              />
            )}
            {view === "insights" && analyticsAvailable && (
              <InsightsView
                t={t}
                locale={locale}
                summary={analyticsSummary}
                isLoading={analyticsLoading}
                onRefresh={() => void loadAnalyticsSummary()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      <nav className="mobile-nav" aria-label={t("archive")}>
        <NavButton
          active={view === "library"}
          icon={<SquaresFour size={20} />}
          label={t("navLibrary")}
          onClick={() => navigate("library")}
        />
        <NavButton
          active={view === "composer"}
          icon={<MagicWand size={20} />}
          label={t("navMatch")}
          onClick={() => navigate("composer")}
        />
        <NavButton
          active={view === "stack"}
          icon={<Stack size={20} />}
          label={t("navStack")}
          count={stack.length || undefined}
          onClick={() => navigate("stack")}
        />
        <NavButton
          active={view === "radar"}
          icon={<Broadcast size={20} />}
          label={t("navRadar")}
          count={candidateCount || undefined}
          onClick={() => navigate("radar")}
        />
        <NavButton
          active={view === "quarantine"}
          icon={<Warning size={20} />}
          label={t("navQuarantine")}
          count={quarantineCount || undefined}
          onClick={() => navigate("quarantine")}
        />
        <NavButton
          active={view === "account"}
          icon={<UserCircle size={20} />}
          label={t("navAccount")}
          onClick={() => navigate("account")}
        />
      </nav>

      {isAddOpen && (
        <AddSkillModal
          t={t}
          onClose={() => setIsAddOpen(false)}
          onSubmit={addSkill}
        />
      )}
      {onboardingOpen && (
        <OnboardingModal
          t={t}
          level={onboardingLevel}
          onLevel={setOnboardingLevel}
          onFinish={finishOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={18} weight="fill" />
          {toast}
        </div>
      )}
      {feedbackPrompt && (
        <ValueFeedback
          t={t}
          stack={stack}
          outcomes={currentSkillOutcomes}
          onOutcome={submitSkillOutcome}
          onClose={() => setFeedbackPrompt(false)}
        />
      )}
    </main>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RotatingHeadline({ items }: { items: string[] }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || items.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [items.length, reduceMotion]);

  return (
    <h1 className="rotating-headline">
      <span className="visually-hidden">{items[0]}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          aria-hidden="true"
          key={items[index]}
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </h1>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button className={`nav-row ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {count !== undefined && <em>{count}</em>}
    </button>
  );
}

function LanguageMenu({
  locale,
  label,
  onChange,
}: {
  locale: Locale;
  label: string;
  onChange: (locale: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      localeOptions.findIndex((option) => option.value === locale),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current =
    localeOptions.find((option) => option.value === locale) || localeOptions[0];

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, [activeIndex, open]);

  function openMenu() {
    setActiveIndex(
      Math.max(
        0,
        localeOptions.findIndex((option) => option.value === locale),
      ),
    );
    setOpen(true);
  }

  function selectLocale(next: Locale) {
    onChange(next);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveActive(direction: 1 | -1) {
    setActiveIndex((currentIndex) => {
      const next =
        (currentIndex + direction + localeOptions.length) %
        localeOptions.length;
      window.requestAnimationFrame(() => optionRefs.current[next]?.focus());
      return next;
    });
  }

  return (
    <div className="language-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className="language-trigger"
        type="button"
        aria-label={`${label}: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <GlobeSimple size={17} />
        <span>{current.label}</span>
        <CaretDown size={13} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="language-popover"
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.16 }}
          >
            <div className="language-popover-head">
              <GlobeSimple size={16} />
              <strong>{label}</strong>
              <kbd>↑↓</kbd>
            </div>
            {localeOptions.map((option, index) => (
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === locale}
                className={
                  option.value === locale ? "language-option active" : "language-option"
                }
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => selectLocale(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveActive(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveActive(-1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setActiveIndex(0);
                    optionRefs.current[0]?.focus();
                  } else if (event.key === "End") {
                    event.preventDefault();
                    const last = localeOptions.length - 1;
                    setActiveIndex(last);
                    optionRefs.current[last]?.focus();
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectLocale(option.value);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                  } else if (event.key === "Tab") {
                    setOpen(false);
                  }
                }}
              >
                <span className="language-code">{option.short}</span>
                <span>{option.label}</span>
                {option.value === locale && <Check size={15} weight="bold" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LibraryView({
  t,
  locale,
  skills,
  allSkills,
  stackIds,
  search,
  category,
  onSearch,
  onCategory,
  onToggleStack,
  onDelete,
  onExport,
  onOpenAdd,
  onStartDemo,
}: {
  t: Translator;
  locale: Locale;
  skills: Skill[];
  allSkills: Skill[];
  stackIds: string[];
  search: string;
  category: (typeof categories)[number];
  onSearch: (value: string) => void;
  onCategory: (value: (typeof categories)[number]) => void;
  onToggleStack: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onOpenAdd: () => void;
  onStartDemo: () => void;
}) {
  const verified = allSkills.filter(
    (skill) => skill.trust === "已验证",
  ).length;
  const custom = allSkills.filter((skill) => !skill.builtIn).length;

  return (
    <div className="view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("libraryEyebrow")}</p>
          <RotatingHeadline
            items={[
              t("libraryTitle"),
              t("libraryTitleAltOne"),
              t("libraryTitleAltTwo"),
              t("libraryTitleAltThree"),
            ]}
          />
          <p>{t("libraryLead")}</p>
        </div>
        <div className="heading-stats" aria-label={t("navLibrary")}>
          <Stat
            value={String(allSkills.length).padStart(2, "0")}
            label={t("total")}
          />
          <Stat
            value={String(verified).padStart(2, "0")}
            label={t("verified")}
          />
          <Stat
            value={String(custom).padStart(2, "0")}
            label={t("custom")}
          />
        </div>
      </section>

      <section className="first-value-strip" aria-label={t("demoTitle")}>
        <div>
          <span>01</span>
          <p>{t("demoStepOne")}</p>
        </div>
        <ArrowRight size={16} />
        <div>
          <span>02</span>
          <p>{t("demoStepTwo")}</p>
        </div>
        <ArrowRight size={16} />
        <div>
          <span>03</span>
          <p>{t("demoStepThree")}</p>
        </div>
        <button className="button primary" onClick={onStartDemo}>
          <Lightning size={17} weight="fill" />
          {t("tryDemo")}
        </button>
      </section>

      <section className="tool-strip">
        <label className="search-box">
          <MagnifyingGlass size={19} />
          <span className="visually-hidden">{t("search")}</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          <kbd>/</kbd>
        </label>
        <div className="filter-tabs" aria-label={t("filter")}>
          {categories.map((item) => (
            <button
              key={item}
              className={item === category ? "active" : ""}
              onClick={() => onCategory(item)}
            >
              {t(categoryTranslation[item])}
            </button>
          ))}
        </div>
        <button
          className="icon-button export-button"
          onClick={onExport}
          title={t("exportLibrary")}
        >
          <DownloadSimple size={18} />
        </button>
      </section>

      {skills.length ? (
        <section className="skill-grid" aria-label={t("navLibrary")}>
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              t={t}
              locale={locale}
              skill={skill}
              selected={stackIds.includes(skill.id)}
              onToggle={() => onToggleStack(skill.id)}
              onDelete={() => onDelete(skill.id)}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <FolderOpen size={34} />
          <h2>{t("emptyLibrary")}</h2>
          <p>{t("emptyLibraryLead")}</p>
          <button className="button primary" onClick={onOpenAdd}>
            <Plus size={17} />
            {t("addSkill")}
          </button>
        </section>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SkillCard({
  t,
  locale,
  skill,
  selected,
  onToggle,
  onDelete,
}: {
  t: Translator;
  locale: Locale;
  skill: Skill;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isResource = skill.artifactType === "resource";

  function moveCard(event: ReactPointerEvent<HTMLElement>) {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x / rect.width - 0.5) * 4).toFixed(2);
    const rotateX = ((0.5 - y / rect.height) * 4).toFixed(2);
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);
    card.style.transform = `perspective(900px) translateY(-7px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  function resetCard(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.transform = "";
  }

  return (
    <article
      className={`skill-card ${selected ? "selected" : ""}`}
      onPointerMove={moveCard}
      onPointerLeave={resetCard}
    >
      <div className="card-top">
        <div className="category-icon">{categoryIcons[skill.category]}</div>
        <div
          className={`trust ${
            skill.trust === "已验证" ? "verified" : ""
          } ${isResource ? "resource" : ""}`}
        >
          {isResource ? (
            <Wrench size={15} />
          ) : skill.trust === "已验证" ? (
            <SealCheck size={15} weight="fill" />
          ) : (
            <Info size={15} />
          )}
          {isResource
            ? t("resourceLabel")
            : skill.trust === "已验证"
              ? t("trustVerified")
              : t("trustPending")}
        </div>
      </div>
      <div className="card-copy">
        <p>
          {t(layerTranslation[skill.layer])} / {skill.source}
        </p>
        <h2>{skill.name}</h2>
        <span>{localizeSkillDescription(skill, locale)}</span>
      </div>
      <div className="tag-list">
        {skill.tags.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="card-footer">
        {skill.sourceUrl ? (
          <a href={skill.sourceUrl} target="_blank" rel="noreferrer">
            <GitBranch size={16} />
            {t("viewSource")}
            <ArrowSquareOut size={13} />
          </a>
        ) : (
          <span className="source-label">
            <ShieldCheck size={16} />
            {skill.source}
          </span>
        )}
        <div className="card-actions">
          {!skill.builtIn && (
            <button
              className="icon-button danger"
              onClick={onDelete}
              title={t("removeSkill")}
            >
              <Trash size={16} />
            </button>
          )}
          <button
            className={`add-to-stack ${selected ? "selected" : ""}`}
            onClick={onToggle}
            disabled={isResource}
            title={isResource ? t("resourceCannotStack") : undefined}
          >
            {isResource ? (
              <Wrench size={16} />
            ) : selected ? (
              <Check size={16} weight="bold" />
            ) : (
              <Plus size={16} weight="bold" />
            )}
            {isResource
              ? t("referenceOnly")
              : selected
                ? t("loaded")
                : t("load")}
          </button>
        </div>
      </div>
    </article>
  );
}

function ComposerView({
  t,
  locale,
  brief,
  onBrief,
  matches,
  stackIds,
  isMatching,
  hasMatched,
  onMatch,
  onToggle,
  onOpenStack,
}: {
  t: Translator;
  locale: Locale;
  brief: string;
  onBrief: (value: string) => void;
  matches: Match[];
  stackIds: string[];
  isMatching: boolean;
  hasMatched: boolean;
  onMatch: () => void;
  onToggle: (id: string) => void;
  onOpenStack: () => void;
}) {
  return (
    <div className="view composer-view">
      <section className="page-heading composer-heading">
        <div>
          <p className="eyebrow">{t("matchEyebrow")}</p>
          <h1>{t("matchTitle")}</h1>
          <p>{t("matchLead")}</p>
        </div>
        <div className="route-mark" aria-hidden="true">
          <span>BRIEF</span>
          <ArrowsClockwise size={23} />
          <span>STACK</span>
        </div>
      </section>

      <section className="composer-grid">
        <div className="brief-panel panel">
          <div className="panel-label">
            <span>
              <FileText size={17} />
            </span>
            <div>
              <strong>{t("projectBrief")}</strong>
              <small>{t("projectBriefHint")}</small>
            </div>
          </div>
          <label htmlFor="project-brief">{t("whatBuild")}</label>
          <textarea
            id="project-brief"
            value={brief}
            onChange={(event) => onBrief(event.target.value)}
            placeholder={t("briefPlaceholder")}
          />
          <div className="brief-footer">
            <span>{t("characters", { count: brief.length })}</span>
            <button
              className="button primary match-button"
              onClick={onMatch}
              disabled={!brief.trim() || isMatching}
            >
              {isMatching ? (
                <CircleNotch className="spin" size={18} />
              ) : (
                <Lightning size={18} weight="fill" />
              )}
              {isMatching ? t("matching") : t("autoAssemble")}
            </button>
          </div>
        </div>

        <div className="match-panel panel">
          <div className="panel-label">
            <span>
              <Sparkle size={17} />
            </span>
            <div>
              <strong>{t("matchResult")}</strong>
              <small>
                {matches.length
                  ? t("matchFound", { count: matches.length })
                  : t("waitingBrief")}
              </small>
            </div>
          </div>

          <div className="engine-disclosure">
            <div>
              <span className="engine-live">
                <CheckCircle size={14} weight="fill" />
                {t("ruleEngineLive")}
              </span>
              <span className="engine-waiting">
                <Info size={14} />
                {t("aiRerankWaiting")}
              </span>
            </div>
            <p>{t("aiRerankLead")}</p>
          </div>

          {isMatching ? (
            <div className="matching-state" role="status">
              <div className="scan-line" />
              <Sparkle size={28} />
              <strong>{t("scanning")}</strong>
              <span>{t("scanningLead")}</span>
            </div>
          ) : matches.length ? (
            <div className={`match-list ${hasMatched ? "visible" : ""}`}>
              {matches.slice(0, 6).map((match, index) => {
                const selected = stackIds.includes(match.skill.id);
                const strengthKey = getStrengthKey(match.score);
                return (
                  <article className="match-row" key={match.skill.id}>
                    <span className="match-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="match-skill-icon">
                      {categoryIcons[match.skill.category]}
                    </div>
                    <div className="match-copy">
                      <div>
                        <strong>{match.skill.name}</strong>
                        <em className={`strength ${strengthKey}`}>
                          {t(strengthKey)}
                        </em>
                      </div>
                      <span>
                        {match.reasons[0] ||
                          localizeSkillDescription(match.skill, locale)}
                      </span>
                      <div
                        className="match-score-breakdown"
                        aria-label={t("scoreBreakdown")}
                      >
                        <em>
                          {t("ruleScore")} {match.components.rule}
                        </em>
                        <em>
                          {t("intentScore")} {match.components.intent}
                        </em>
                        <em className="pending">{t("aiScore")} N/A</em>
                      </div>
                    </div>
                    <button
                      className={`icon-button select-match ${
                        selected ? "selected" : ""
                      }`}
                      onClick={() => onToggle(match.skill.id)}
                      title={
                        selected ? t("removeFromStack") : t("addToStack")
                      }
                    >
                      {selected ? (
                        <Check size={17} weight="bold" />
                      ) : (
                        <Plus size={17} />
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-match">
              <MagicWand size={31} />
              <strong>{t("waitingDescription")}</strong>
              <span>{t("waitingDescriptionLead")}</span>
            </div>
          )}

          <button
            className="stack-link"
            onClick={onOpenStack}
            disabled={!stackIds.length}
          >
            {t("currentStack")}
            <span>{String(stackIds.length).padStart(2, "0")}</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}

function StackView({
  t,
  locale,
  stack,
  brief,
  conflicts,
  stackId,
  handshake,
  outcomes,
  onRemove,
  onExport,
  onCopy,
  onCompose,
  onLoadSample,
  onCheckPreflight,
  onImportHandshake,
  onOpenOutcomes,
}: {
  t: Translator;
  locale: Locale;
  stack: Skill[];
  brief: string;
  conflicts: string[];
  stackId: string;
  handshake: InstallationHandshake | null;
  outcomes: Record<string, SkillOutcome>;
  onRemove: (id: string) => void;
  onExport: () => void;
  onCopy: () => void;
  onCompose: () => void;
  onLoadSample: () => void;
  onCheckPreflight: () => void;
  onImportHandshake: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenOutcomes: () => void;
}) {
  const reportBySkill = new Map(
    (handshake?.skills || []).map((report) => [report.skillId, report]),
  );
  const outcomeCount = stack.filter((skill) => outcomes[skill.id]).length;
  return (
    <div className="view stack-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("stackEyebrow")}</p>
          <h1>{t("stackTitle")}</h1>
          <p>{t("stackLead")}</p>
        </div>
        <div className="stack-actions">
          <button
            className="button secondary"
            onClick={onCopy}
            disabled={!stack.length}
          >
            <Copy size={17} />
            {t("copyPrompt")}
          </button>
          <button
            className="button primary"
            onClick={onExport}
            disabled={!stack.length}
          >
            <DownloadSimple size={17} />
            {t("exportJson")}
          </button>
        </div>
      </section>

      {stack.length ? (
        <>
          <section className="bit-rail" aria-label={t("executionOrder")}>
            <div className="rail-handle">
              <Toolbox size={25} weight="fill" />
              <span>BITCASE</span>
            </div>
            <div className="rail-track">
              {stack.map((skill, index) => (
                <article className="bit" key={skill.id}>
                  <span className="bit-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="bit-neck" />
                  <div className="bit-body">
                    <div>
                      {categoryIcons[skill.category]}
                      <em>{t(layerTranslation[skill.layer])}</em>
                    </div>
                    <strong>{skill.name}</strong>
                    <button
                      onClick={() => onRemove(skill.id)}
                      aria-label={`${t("removeSkill")} ${skill.name}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="stack-detail-grid">
            <div className="panel execution-panel">
              <div className="panel-label">
                <span>
                  <GitBranch size={17} />
                </span>
                <div>
                  <strong>{t("executionOrder")}</strong>
                  <small>{t("dependencyHint")}</small>
                </div>
              </div>
              <ol className="execution-list">
                {stack.map((skill, index) => (
                  <li key={skill.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{skill.name}</strong>
                      <small>
                        {t(layerTranslation[skill.layer])} /{" "}
                        {localizeSkillDescription(skill, locale)}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="stack-side">
              <div className="panel brief-summary">
                <div className="summary-icon">
                  <FileText size={19} />
                </div>
                <div>
                  <span>{t("projectBriefLabel")}</span>
                  <p>{brief}</p>
                </div>
              </div>

              <div
                className={`panel conflict-panel ${
                  conflicts.length ? "has-conflict" : ""
                }`}
              >
                <div className="conflict-title">
                  {conflicts.length ? (
                    <Warning size={20} weight="fill" />
                  ) : (
                    <CheckCircle size={20} weight="fill" />
                  )}
                  <div>
                    <strong>
                      {conflicts.length
                        ? t("scopeWarning")
                        : t("checksPassed")}
                    </strong>
                    <span>
                      {conflicts.length
                        ? t("warningsCount", { count: conflicts.length })
                        : t("noConflict")}
                    </span>
                  </div>
                </div>
                {conflicts.length > 0 && (
                  <ul>
                    {conflicts.map((conflict) => (
                      <li key={conflict}>{conflict}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="codex-handoff panel">
            <div className="handoff-heading">
              <div className="handoff-icon">
                <PlugsConnected size={24} weight="duotone" />
              </div>
              <div>
                <span>{t("handoffEyebrow")}</span>
                <h2>{t("handoffTitle")}</h2>
                <p>{t("handoffLead")}</p>
              </div>
            </div>

            <div className="handoff-steps">
              <article>
                <span>1</span>
                <DownloadSimple size={20} />
                <strong>{t("codexStepDownloadTitle")}</strong>
                <p>{t("codexStepDownload")}</p>
              </article>
              <article>
                <span>2</span>
                <FolderOpen size={20} />
                <strong>{t("codexStepFileTitle")}</strong>
                <p>{t("codexStepFile")}</p>
              </article>
              <article>
                <span>3</span>
                <BracketsCurly size={20} />
                <strong>{t("codexStepPromptTitle")}</strong>
                <p>{t("codexStepPrompt")}</p>
                <code>/mention bitcase-codex-stack.json</code>
              </article>
            </div>

            <div className="manifest-warning">
              <Info size={18} />
              <p>
                <strong>{t("manifestWarningTitle")}</strong>
                {t("manifestWarning")}
              </p>
            </div>

            <div className="preflight-head">
              <div>
                <strong>{t("preflightTitle")}</strong>
                <span>
                  {handshake
                    ? t("handshakeCheckedAt", {
                        time: formatDate(handshake.checkedAt, locale),
                      })
                    : t("handshakeAwaiting")}
                </span>
              </div>
              <div className="preflight-controls">
                <label
                  className="button secondary"
                  htmlFor="bitcase-handshake-import"
                >
                  <UploadSimple size={16} />
                  {t("importHandshake")}
                </label>
                <input
                  id="bitcase-handshake-import"
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={onImportHandshake}
                />
                <button
                  className="button secondary"
                  onClick={onCheckPreflight}
                >
                  <ShieldCheck size={16} />
                  {t("runPreflight")}
                </button>
              </div>
            </div>

            <div className="preflight-list">
              {stack.map((skill) => {
                const sourceReadiness = getSkillReadiness(skill);
                const report = reportBySkill.get(skill.id);
                const deviceState = report?.status || "awaiting";
                const labelKey: Record<
                  DeviceSkillReport["status"] | "awaiting",
                  TranslationKey
                > = {
                  installed: "deviceInstalled",
                  missing: "deviceMissing",
                  changed: "deviceChanged",
                  quarantined: "deviceQuarantined",
                  unavailable: "deviceUnavailable",
                  awaiting: "deviceAwaiting",
                };
                return (
                  <article
                    className={`preflight-item ${deviceState}`}
                    key={skill.id}
                  >
                    <div>
                      {deviceState === "installed" ? (
                        <CheckCircle size={18} weight="fill" />
                      ) : (
                        <Warning size={18} weight="fill" />
                      )}
                      <div>
                        <strong>{skill.name}</strong>
                        <p>{skillResponsibility(skill, t)}</p>
                        <small>
                          {t("sourceVerificationStatus")}:{" "}
                          {t(
                            {
                              ready: "readinessReady",
                              inspected: "readinessInspected",
                              review: "readinessReview",
                              missing: "readinessMissing",
                            }[sourceReadiness.state] as TranslationKey,
                          )}
                        </small>
                        {report?.detail && <small>{report.detail}</small>}
                      </div>
                    </div>
                    <span>{t(labelKey[deviceState])}</span>
                  </article>
                );
              })}
            </div>

            <div className="handshake-note">
              <BracketsCurly size={17} />
              <div>
                <strong>{t("handshakeTitle")}</strong>
                <p>{t("handshakeLead")}</p>
                <code>{stackId}</code>
              </div>
            </div>

            <div className="handoff-actions">
              <button className="button primary" onClick={onExport}>
                <DownloadSimple size={17} />
                {t("downloadCodexJson")}
              </button>
              <button className="button secondary" onClick={onCopy}>
                <Copy size={17} />
                {t("copyCodexInstruction")}
              </button>
              <button className="button secondary" onClick={onOpenOutcomes}>
                <SealCheck size={17} />
                {t("recordOutcomes")} {outcomeCount}/{stack.length}
              </button>
              <button className="sample-link" onClick={onLoadSample}>
                <Sparkle size={16} />
                {t("loadBeginnerSample")}
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="empty-state stack-empty">
          <Wrench size={37} />
          <h2>{t("emptyStack")}</h2>
          <p>{t("emptyStackLead")}</p>
          <button className="button primary" onClick={onCompose}>
            <MagicWand size={17} />
            {t("startMatching")}
          </button>
          <button className="button secondary" onClick={onLoadSample}>
            <Sparkle size={17} />
            {t("loadBeginnerSample")}
          </button>
        </section>
      )}
    </div>
  );
}

function QuarantineView({
  t,
  locale,
  items,
  projectScopeId,
  inspectingRepoId,
  onAction,
  onReinspect,
}: {
  t: Translator;
  locale: Locale;
  items: QuarantineItem[];
  projectScopeId: string;
  inspectingRepoId: number | null;
  onAction: (
    id: string,
    action: "review" | "ignore" | "approve",
  ) => void;
  onReinspect: (item: QuarantineItem) => void;
}) {
  const stateKey: Record<QuarantineItem["state"], TranslationKey> = {
    review: "quarantineReview",
    blocked: "quarantineBlocked",
    approved: "quarantineApproved",
    ignored: "quarantineIgnored",
  };
  const displayState = (item: QuarantineItem): QuarantineItem["state"] =>
    item.state === "approved" &&
    item.findings.length > 0 &&
    item.approvedProjectId !== projectScopeId
      ? "review"
      : item.state;
  const findingKeys: Record<string, TranslationKey> = {
    "missing-name": "riskMissingName",
    "missing-description": "riskMissingDescription",
    "skill-content-truncated": "riskTruncated",
    "instruction-override": "riskInstructionOverride",
    "credential-exfiltration-risk": "riskCredentialExfiltration",
    "execution-needs-review": "riskExecution",
    "repository-scan-incomplete": "riskIncompleteScan",
  };
  const ordered = [...items].sort((a, b) => {
    const weight = { blocked: 0, review: 1, approved: 2, ignored: 3 };
    return weight[displayState(a)] - weight[displayState(b)];
  });
  const activeCount = items.filter(
    (item) => {
      const state = displayState(item);
      return state === "blocked" || state === "review";
    },
  ).length;

  return (
    <div className="view quarantine-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("quarantineEyebrow")}</p>
          <h1>{t("quarantineTitle")}</h1>
          <p>{t("quarantineLead")}</p>
        </div>
        <div className={`quarantine-count ${activeCount ? "active" : ""}`}>
          <Warning size={23} weight="fill" />
          <strong>{activeCount}</strong>
          <span>{t("quarantineOpenItems")}</span>
        </div>
      </section>

      {ordered.length ? (
        <section className="quarantine-list">
          {ordered.map((item) => {
            const reinspecting = inspectingRepoId === item.repositoryId;
            const state = displayState(item);
            return (
              <article
                className={`quarantine-card ${state}`}
                key={item.id}
              >
                <header>
                  <div>
                    <span>{item.fullName}</span>
                    <h2>{item.skillName}</h2>
                    <code>{item.skillPath}</code>
                  </div>
                  <em>{t(stateKey[state])}</em>
                </header>

                <div className="quarantine-findings">
                  {item.findings.length ? (
                    item.findings.map((finding, index) => (
                      <div key={`${finding.code}-${index}`}>
                        <Warning size={16} weight="fill" />
                        <div>
                          <strong>
                            {t(
                              findingKeys[finding.code] || "riskUnknown",
                            )}
                          </strong>
                          <span>
                            {finding.line
                              ? t("riskAtLine", { line: finding.line })
                              : t("riskNoLine")}
                          </span>
                          {finding.excerpt && (
                            <code>{finding.excerpt}</code>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>{t("riskNoFindings")}</p>
                  )}
                </div>

                <footer>
                  <span>
                    {t("quarantineCaptured", {
                      date: formatDate(item.capturedAt, locale),
                    })}
                  </span>
                  <div>
                    <a
                      className="button secondary"
                      href={`${item.sourceUrl}/blob/${item.defaultBranch}/${item.skillPath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowSquareOut size={15} />
                      {t("quarantineOpenSource")}
                    </a>
                    <button
                      className="button secondary"
                      onClick={() => onReinspect(item)}
                      disabled={reinspecting}
                    >
                      {reinspecting ? (
                        <CircleNotch className="spin" size={15} />
                      ) : (
                        <ArrowsClockwise size={15} />
                      )}
                      {t("quarantineReinspect")}
                    </button>
                    {(state === "review" || state === "blocked") && (
                      <>
                        <button
                          className="button secondary"
                          onClick={() => onAction(item.id, "review")}
                        >
                          {t("quarantineReviewLater")}
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => onAction(item.id, "ignore")}
                        >
                          <X size={15} />
                          {t("quarantineIgnore")}
                        </button>
                        <button
                          className="button primary"
                          onClick={() => onAction(item.id, "approve")}
                          disabled={state === "blocked"}
                          title={
                            state === "blocked"
                              ? t("quarantineBlockedCannotApprove")
                              : undefined
                          }
                        >
                          <ShieldCheck size={15} />
                          {t("quarantineApprove")}
                        </button>
                      </>
                    )}
                    {state === "ignored" && (
                      <button
                        className="button secondary"
                        onClick={() => onAction(item.id, "review")}
                      >
                        <ArrowsClockwise size={15} />
                        {t("quarantineRestore")}
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <ShieldCheck size={37} />
          <h2>{t("quarantineEmpty")}</h2>
          <p>{t("quarantineEmptyLead")}</p>
        </section>
      )}
    </div>
  );
}

function SkillsNetworkPanel({
  t,
  view,
  entries,
  source,
  loading,
  error,
  importing,
  onView,
  onImport,
}: {
  t: Translator;
  view: SkillsNetworkView;
  entries: SkillsNetworkEntry[];
  source: "live" | "fallback";
  loading: boolean;
  error: boolean;
  importing: string;
  onView: (view: SkillsNetworkView) => void;
  onImport: (url: string) => void;
}) {
  const [input, setInput] = useState("");
  const tabs: Array<[SkillsNetworkView, TranslationKey]> = [
    ["trending", "skillsNetworkTrending"],
    ["hot", "skillsNetworkHot"],
    ["all", "skillsNetworkAll"],
  ];

  return (
    <section className="skills-network panel">
      <div className="skills-network-head">
        <div>
          <div className="skills-network-title">
            <Broadcast size={22} weight="duotone" />
            <h2>{t("skillsNetworkTitle")}</h2>
          </div>
          <p>{t("skillsNetworkLead")}</p>
        </div>
        <a
          className="button secondary"
          href="https://skills.sh"
          target="_blank"
          rel="noreferrer"
        >
          <ArrowSquareOut size={16} />
          {t("skillsNetworkOpen")}
        </a>
      </div>

      <div className="skills-network-import">
        <label htmlFor="skills-network-url">
          {t("skillsNetworkUrlLabel")}
        </label>
        <div>
          <input
            id="skills-network-url"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="https://skills.sh/owner/repo/skill"
            inputMode="url"
          />
          <button
            className="button primary"
            disabled={!input.trim() || Boolean(importing)}
            onClick={() => onImport(input)}
          >
            {importing === input.trim() ? (
              <CircleNotch className="spin" size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            {t("skillsNetworkInspect")}
          </button>
        </div>
        <small>{t("skillsNetworkUrlHelp")}</small>
      </div>

      <div className="skills-network-toolbar">
        <div className="skills-network-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "active" : ""}
              disabled={loading}
              onClick={() => onView(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <span>
          {source === "live"
            ? t("skillsNetworkLive")
            : t("skillsNetworkFallback")}
        </span>
      </div>

      {error ? (
        <div className="skills-network-state">
          <Warning size={20} />
          <span>{t("skillsNetworkUnavailable")}</span>
          <button className="button secondary" onClick={() => onView(view)}>
            <ArrowsClockwise size={15} />
            {t("skillsNetworkRetry")}
          </button>
        </div>
      ) : loading && !entries.length ? (
        <div
          className="skills-network-skeletons"
          aria-label={t("skillsNetworkLoading")}
        >
          {[0, 1, 2, 3].map((item) => (
            <div key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : (
        <div className="skills-network-rail">
          {entries.slice(0, 12).map((entry) => (
            <article key={entry.id}>
              <header>
                <span>
                  {entry.rank ? `#${entry.rank}` : t("skillsNetworkListed")}
                </span>
                {entry.installsLabel && <em>{entry.installsLabel}</em>}
              </header>
              <h3>{entry.name || entry.slug}</h3>
              <p>{entry.source}</p>
              <footer>
                <a
                  className="icon-button"
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${t("skillsNetworkOpen")} ${entry.name}`}
                >
                  <ArrowSquareOut size={16} />
                </a>
                <button
                  className="button secondary"
                  disabled={Boolean(importing)}
                  onClick={() => onImport(entry.url)}
                >
                  {importing === entry.url ? (
                    <CircleNotch className="spin" size={15} />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  {t("skillsNetworkInspect")}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RadarView({
  t,
  locale,
  interests,
  settings,
  feedback,
  results,
  seed,
  isLoading,
  networkView,
  networkEntries,
  networkSource,
  networkLoading,
  networkError,
  networkImporting,
  inspectingRepoId,
  inspectionAttemptedRepoIds,
  error,
  onToggle,
  onRun,
  onSeed,
  onNetworkView,
  onNetworkImport,
  onExplain,
  onSave,
  onDismiss,
}: {
  t: Translator;
  locale: Locale;
  interests: Array<{ topic: string; score: number }>;
  settings: RadarSettings;
  feedback: RadarFeedback;
  results: GithubRepo[];
  seed: string;
  isLoading: boolean;
  networkView: SkillsNetworkView;
  networkEntries: SkillsNetworkEntry[];
  networkSource: "live" | "fallback";
  networkLoading: boolean;
  networkError: boolean;
  networkImporting: string;
  inspectingRepoId: number | null;
  inspectionAttemptedRepoIds: number[];
  error: RadarSearchFailure | null;
  onToggle: () => void;
  onRun: () => void;
  onSeed: (value: string) => void;
  onNetworkView: (view: SkillsNetworkView) => void;
  onNetworkImport: (url: string) => void;
  onExplain: (repo: GithubRepo) => void;
  onSave: (repo: GithubRepo) => void;
  onDismiss: (repo: GithubRepo) => void;
}) {
  const expandedSeed = expandIdeaSeed(seed);
  const laneConfig: Array<{
    id: GithubRepo["lane"];
    title: TranslationKey;
    lead: TranslationKey;
  }> = [
    { id: "focus", title: "laneFocus", lead: "laneFocusLead" },
    { id: "adjacent", title: "laneAdjacent", lead: "laneAdjacentLead" },
    { id: "wildcard", title: "laneWildcard", lead: "laneWildcardLead" },
  ];
  const hasSearchContext = Boolean(interests.length || seed.trim());

  return (
    <div className="view radar-view">
      <section className="page-heading radar-heading">
        <div>
          <p className="eyebrow">{t("radarEyebrow")}</p>
          <h1>{t("radarTitle")}</h1>
          <p>{t("radarLead")}</p>
        </div>
        <div className="radar-oracle" aria-hidden="true">
          <span />
          <Broadcast size={31} weight="duotone" />
          <em>{String(results.length).padStart(2, "0")}</em>
        </div>
      </section>

      <SkillsNetworkPanel
        t={t}
        view={networkView}
        entries={networkEntries}
        source={networkSource}
        loading={networkLoading}
        error={networkError}
        importing={networkImporting}
        onView={onNetworkView}
        onImport={onNetworkImport}
      />

      <section className="radar-cockpit">
        <div className="interest-panel panel">
          <div className="panel-label">
            <span>
              <Sparkle size={17} />
            </span>
            <div>
              <strong>{t("interests")}</strong>
              <small>{t("interestsHint")}</small>
            </div>
          </div>
          {interests.length ? (
            <div className="interest-cloud">
              {interests.map((interest, index) => (
                <span
                  key={interest.topic}
                  style={{ "--interest-index": index } as CSSProperties}
                >
                  {interest.topic}
                  <em>{interest.score}</em>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-copy">{t("noInterests")}</p>
          )}
        </div>

        <div className="automation-panel panel">
          <div className="automation-head">
            <div className="automation-icon">
              <BellRinging size={21} />
            </div>
            <div>
              <strong>{t("automation")}</strong>
              <span>
                {settings.enabled ? t("automationOn") : t("automationOff")}
              </span>
            </div>
            <button
              className={`switch ${settings.enabled ? "on" : ""}`}
              onClick={onToggle}
              aria-pressed={settings.enabled}
              aria-label={t("automation")}
            >
              <span />
            </button>
          </div>
          <p>{t("automationLead")}</p>
          <div className="automation-footer">
            <span>
              <CalendarBlank size={15} />
              {t("lastScan")}:{" "}
              {settings.lastRun
                ? formatDate(settings.lastRun, locale)
                : t("never")}
            </span>
            <button
              className="button primary radar-run"
              onClick={onRun}
              disabled={isLoading || !hasSearchContext}
            >
              {isLoading ? (
                <CircleNotch className="spin" size={17} />
              ) : (
                <Broadcast size={17} />
              )}
              {isLoading ? t("searchingGithub") : t("scanNow")}
            </button>
          </div>
        </div>

        <div className="idea-panel panel">
          <div className="panel-label">
            <span>
              <Lightning size={17} />
            </span>
            <div>
              <strong>{t("ideaSeed")}</strong>
              <small>{t("ideaSeedLead")}</small>
            </div>
          </div>
          <div className="idea-search">
            <label htmlFor="radar-seed" className="visually-hidden">
              {t("ideaSeed")}
            </label>
            <input
              id="radar-seed"
              value={seed}
              onChange={(event) => onSeed(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && hasSearchContext && !isLoading) {
                  onRun();
                }
              }}
              placeholder={t("ideaPlaceholder")}
            />
            <button
              className="button primary"
              onClick={onRun}
              disabled={isLoading || !hasSearchContext}
            >
              {isLoading ? (
                <CircleNotch className="spin" size={17} />
              ) : (
                <MagnifyingGlass size={17} />
              )}
              {t("seedSearch")}
            </button>
          </div>
          {expandedSeed.length > 1 && (
            <div className="seed-expansions" aria-label={t("expandedSearch")}>
              <span>{t("expandedSearch")}</span>
              {expandedSeed.map((term) => (
                <em key={term}>{term}</em>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="quality-note">
        <ShieldCheck size={18} />
        <div>
          <strong>{t("qualitySignals")}</strong>
          <span>
            {t("qualityLead")}{" "}
            {t("radarLearning", {
              liked: feedback.likedTopics.length,
              disliked: feedback.dislikedTopics.length,
            })}
          </span>
        </div>
      </div>

      {error ? (
        <section className="empty-state radar-state">
          <Warning size={35} />
          <h2>
            {error === "rate_limited"
              ? t("radarErrorRateLimited")
              : error === "invalid_search"
                ? t("radarErrorInvalid")
                : t("radarErrorUnavailable")}
          </h2>
          <p>{t("radarErrorAction")}</p>
          <button className="button secondary" onClick={onRun}>
            <ArrowsClockwise size={17} />
            {t("scanNow")}
          </button>
        </section>
      ) : isLoading && !results.length ? (
        <section className="radar-skeletons" aria-label={t("searchingGithub")}>
          {[0, 1, 2, 3].map((item) => (
            <div className="radar-skeleton" key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </section>
      ) : results.length ? (
        <div className="radar-lanes">
          {laneConfig.map((lane) => {
            const laneResults = results.filter(
              (repo) => repo.lane === lane.id,
            );
            if (!laneResults.length) return null;
            return (
              <section className="radar-lane" key={lane.id}>
                <div className="radar-lane-head">
                  <div>
                    <span>{String(laneResults.length).padStart(2, "0")}</span>
                    <div>
                      <h2>{t(lane.title)}</h2>
                      <p>{t(lane.lead)}</p>
                    </div>
                  </div>
                  <ArrowRight size={18} />
                </div>
                <div className="radar-rail">
                  {laneResults.map((repo) => (
                    <RepoCard
                      key={repo.id}
                      t={t}
                      locale={locale}
                      repo={repo}
                      isInspecting={inspectingRepoId === repo.id}
                      inspectionFailed={
                        inspectionAttemptedRepoIds.includes(repo.id) &&
                        inspectingRepoId !== repo.id &&
                        !repo.inspection
                      }
                      onExplain={() => onExplain(repo)}
                      onSave={() => onSave(repo)}
                      onDismiss={() => onDismiss(repo)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="empty-state radar-state">
          <Broadcast size={38} />
          <h2>{t("radarEmpty")}</h2>
          <p>{t("radarEmptyLead")}</p>
          <button
            className="button primary"
            onClick={onRun}
            disabled={!hasSearchContext}
          >
            <Broadcast size={17} />
            {t("scanNow")}
          </button>
        </section>
      )}
    </div>
  );
}

function RepoCard({
  t,
  locale,
  repo,
  isInspecting,
  inspectionFailed,
  onExplain,
  onSave,
  onDismiss,
}: {
  t: Translator;
  locale: Locale;
  repo: GithubRepo;
  isInspecting: boolean;
  inspectionFailed: boolean;
  onExplain: () => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const previewProfile: SourceProfile = {
    overview: repo.description,
    capabilities: [],
    useWhen: [],
    workflow: [],
    requirements: [],
    limitations: [],
    examples: [],
  };
  const decision = localizeDecisionProfile(
    repo,
    repo.inspection?.profile || previewProfile,
    locale,
    repo.inspection?.fileCount || 0,
  );
  const sourceReady = Boolean(repo.inspection);
  const inspectionComplete =
    repo.inspection?.inspectionComplete !== false;
  const intake = repo.inspection
    ? planSkillIntake(repo.inspection)
    : null;
  const usableSkillCount = intake?.usableFiles.length || 0;
  const blockedSkillCount = intake?.blockedFiles.length || 0;
  const maintenanceLabel = t(repositoryMaintenanceKey(repo));
  const recommendation =
    repo.lane === "focus"
      ? t("recommendationFocus")
      : repo.lane === "adjacent"
        ? t("recommendationAdjacent")
        : t("recommendationWildcard");
  const auditLabel =
    repo.auditStatus === "clean"
      ? t("skillFileClean")
      : repo.auditStatus === "warning"
        ? t("skillFileWarning")
        : t("skillFileUnverified");
  return (
    <article
      className={`repo-card ${sourceReady ? "analyzed" : "analyzing"}`}
    >
      <div className="repo-card-head">
        <div className="repo-glyph">
          <GitBranch size={20} />
        </div>
        <div>
          <span>{repo.fullName}</span>
          <h2>{repo.name}</h2>
        </div>
        <a
          className="repo-open"
          href={repo.htmlUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t("openGithub")} ${repo.name}`}
        >
          <ArrowSquareOut size={17} />
        </a>
      </div>
      <div className={`audit-chip ${repo.auditStatus || "unverified"}`}>
        {repo.auditStatus === "clean" ? (
          <ShieldCheck size={14} />
        ) : repo.auditStatus === "warning" ? (
          <Warning size={14} />
        ) : (
          <Info size={14} />
        )}
        <span>{auditLabel}</span>
        {repo.skillPath && <em>{repo.skillPath}</em>}
        {repo.skillFileCount && repo.skillFileCount > 1 && (
          <em>{t("skillFilesFound", { count: repo.skillFileCount })}</em>
        )}
      </div>
      <div className="repo-description">
        <div
          className={`repo-decision-lead ${
            sourceReady ? "source-ready" : "source-loading"
          }`}
        >
          <span>
            {sourceReady ? t("decisionTitle") : t("readingSources")}
          </span>
          <strong>{decision.kind}</strong>
          <p>{decision.verdict}</p>
        </div>
        {repo.inspection && (
          <div className="repo-safety-summary" aria-label={t("safetyRouting")}>
            {usableSkillCount > 0 && (
              <span className="safe">
                <CheckCircle size={13} weight="fill" />
                {t("safeSkillsCount", { count: usableSkillCount })}
              </span>
            )}
            {intake?.reviewFiles.length ? (
              <span className="review">
                <Warning size={13} />
                {t("reviewSkillsCount", {
                  count: intake.reviewFiles.length,
                })}
              </span>
            ) : null}
            {blockedSkillCount > 0 && (
              <span className="blocked">
                <X size={13} />
                {t("blockedSkillsCount", { count: blockedSkillCount })}
              </span>
            )}
            {repo.inspection.status === "missing" && (
              <span className="resource">
                <Wrench size={13} />
                {t("resourceNoSkill")}
              </span>
            )}
          </div>
        )}
        <div className="repo-decision-grid repo-glance-grid">
          <DecisionFacts
            title={t("decisionCapabilities")}
            facts={decision.capabilities.slice(0, 2)}
          />
          <DecisionFacts
            title={t("decisionUseWhen")}
            facts={decision.useWhen.slice(0, 2)}
          />
        </div>
        {repo.inspection && (
          <details className="repo-full-analysis">
            <summary>{t("fullAnalysis")}</summary>
            <div className="repo-full-analysis-body">
              {!inspectionComplete && (
                <p className="repo-analysis-status">
                  {t("toastSkillPartial")}
                </p>
              )}
              <div className="repo-decision-grid">
                <DecisionFacts
                  title={t("decisionWorkflow")}
                  facts={decision.workflow}
                />
                <DecisionFacts
                  title={t("decisionRequirements")}
                  facts={decision.requirements}
                />
                <DecisionFacts
                  title={t("decisionLimitations")}
                  facts={decision.limitations}
                  tone="warning"
                />
              </div>
              <div className="repo-skill-index">
                <strong>
                  {t("skillsInRepository", {
                    count: repo.inspection.fileCount,
                  })}
                </strong>
                <div>
                  {repo.inspection.skillFiles.map((skillFile) => (
                    <article
                      className={`skill-source-${skillFile.status}`}
                      key={skillFile.path}
                    >
                      <span>{skillFile.name}</span>
                      <code>
                        {skillFile.path} ·{" "}
                        {skillFile.status === "clean"
                          ? t("skillFileClean")
                          : skillFile.status === "warning"
                            ? t("skillFileWarning")
                            : t("skillFileBlocked")}
                      </code>
                      <p>
                        {skillFile.description ||
                          skillFile.profile.overview ||
                          t("sourceDescriptionMissing")}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="repo-source-evidence">
                <strong>{t("sourceEvidence")}</strong>
                {repo.inspection.readmePath && (
                  <p>
                    {t("readmeEvidence", {
                      path: repo.inspection.readmePath,
                    })}
                  </p>
                )}
              </div>
            </div>
          </details>
        )}
        <span className="repo-recommendation">
          <Sparkle size={14} />
          {recommendation}
        </span>
      </div>
      <div className="repo-meta">
        <span>
          <ShieldCheck size={14} />
          {t("qualityScore", { score: repositoryQualityScore(repo) })}
        </span>
        <span>
          <Star size={14} weight="fill" />
          {t("stars", { count: repo.stars })}
        </span>
        <span>
          <CalendarBlank size={14} />
          {t("updated", { date: formatDate(repo.updatedAt, locale) })}
        </span>
        <span>
          <ArrowsClockwise size={14} />
          {maintenanceLabel}
        </span>
        {repo.license && <span>{repo.license}</span>}
      </div>
      <div className="repo-actions">
        {repo.inspection && usableSkillCount > 0 ? (
          <button
            className="button repo-save"
            onClick={onSave}
            disabled={isInspecting}
          >
            {isInspecting ? (
              <CircleNotch className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            {isInspecting
              ? t("checkingSkillFile")
              : t("addAnalyzedSkills", {
                  count: usableSkillCount,
                })}
          </button>
        ) : repo.inspection?.status === "missing" ? (
          <button
            className="button repo-save resource-save"
            onClick={onSave}
            disabled={isInspecting}
          >
            <Wrench size={16} />
            {t("saveAsResource")}
          </button>
        ) : repo.inspection ? (
          <button className="button repo-save" disabled>
            <Warning size={16} />
            {t("allSkillsBlocked")}
          </button>
        ) : inspectionFailed ? (
          <button
            className="button repo-save"
            onClick={onExplain}
            disabled={isInspecting}
          >
            {isInspecting ? (
              <CircleNotch className="spin" size={16} />
            ) : (
              <FileText size={16} />
            )}
            {isInspecting ? t("readingSources") : t("deepExplain")}
          </button>
        ) : (
          <button className="button repo-save" disabled>
            <CircleNotch className="spin" size={16} />
            {t("readingSources")}
          </button>
        )}
        <button
          className="icon-button repo-dismiss"
          onClick={onDismiss}
          title={t("dismissCandidate")}
          aria-label={`${t("dismissCandidate")} ${repo.name}`}
          disabled={isInspecting}
        >
          <X size={16} />
        </button>
      </div>
    </article>
  );
}

function DecisionFacts({
  title,
  facts,
  tone = "default",
}: {
  title: string;
  facts: string[];
  tone?: "default" | "warning";
}) {
  if (!facts.length) return null;
  return (
    <section className={`decision-facts ${tone}`}>
      <strong>{title}</strong>
      <ul>
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </section>
  );
}

function AccountView({
  t,
  locale,
  viewer,
  syncState,
  lastSynced,
  onSyncNow,
  telemetryEnabled,
  onToggleTelemetry,
  showInsights,
  onOpenInsights,
  onOpenGuide,
}: {
  t: Translator;
  locale: Locale;
  viewer: BitcaseViewer | null;
  syncState: SyncState;
  lastSynced: string | null;
  onSyncNow: () => void;
  telemetryEnabled: boolean;
  onToggleTelemetry: () => void;
  showInsights: boolean;
  onOpenInsights: () => void;
  onOpenGuide: () => void;
}) {
  const [tokens, setTokens] = useState<BridgeTokenInfo[]>([]);
  const [revealedToken, setRevealedToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(Boolean(viewer));
  const [accountError, setAccountError] = useState(false);
  const bridgeEndpoint =
    typeof window === "undefined"
      ? "/api/bridge/library"
      : `${window.location.origin}/api/bridge/library`;

  const refreshTokens = useCallback(async () => {
    if (!viewer) return;
    try {
      const response = await fetch("/api/bridge/tokens", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { tokens?: BridgeTokenInfo[] };
      setTokens(data.tokens || []);
    } catch {
      // Library sync status already surfaces connectivity failures.
    }
  }, [viewer]);

  const refreshAccount = useCallback(async () => {
    if (!viewer) {
      setAccount(null);
      setAccountLoading(false);
      return;
    }
    setAccountLoading(true);
    setAccountError(false);
    try {
      const response = await fetch(
        `/api/account?locale=${encodeURIComponent(locale)}`,
        {
          headers: { accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error(`account ${response.status}`);
      const data = (await response.json()) as { account?: BetaAccount };
      if (!data.account) throw new Error("account missing");
      setAccount(data.account);
    } catch {
      setAccountError(true);
    } finally {
      setAccountLoading(false);
    }
  }, [locale, viewer]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshTokens();
      void refreshAccount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAccount, refreshTokens]);

  async function generateToken() {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/bridge/tokens", { method: "POST" });
      if (!response.ok) throw new Error(`token ${response.status}`);
      const data = (await response.json()) as { token: string };
      setRevealedToken(data.token);
      await refreshTokens();
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeTokens() {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/bridge/tokens", { method: "DELETE" });
      if (!response.ok) throw new Error(`revoke ${response.status}`);
      setRevealedToken("");
      await refreshTokens();
    } finally {
      setTokenBusy(false);
    }
  }

  const modules = [
    {
      icon: <UserCircle size={25} />,
      title: t("accountModule"),
      lead: t("accountModuleLead"),
      status: viewer ? t("signedIn") : t("signInRequired"),
      className: "account-auth",
    },
    {
      icon: <CreditCard size={25} />,
      title: t("billingModule"),
      lead: t("billingModuleLead"),
      status: t("backendPending"),
      className: "account-billing",
    },
    {
      icon: <PlugsConnected size={25} />,
      title: t("codexModule"),
      lead: t("codexModuleLead"),
      status: tokens.length ? t("bridgeActive") : t("bridgeNotConnected"),
      className: "account-codex",
    },
  ];
  const plans = [
    {
      name: t("planFree"),
      state: t("currentPlan"),
      lead: t("planFreeLead"),
      active: true,
    },
    {
      name: t("planPlus"),
      state: t("planned"),
      lead: t("planPlusLead"),
      active: false,
    },
    {
      name: t("planStudio"),
      state: t("planned"),
      lead: t("planStudioLead"),
      active: false,
    },
  ];

  return (
    <div className="view account-view">
      <section className="page-heading account-heading">
        <div>
          <p className="eyebrow">{t("accountEyebrow")}</p>
          <h1>{t("accountTitle")}</h1>
          <p>{t("accountLead")}</p>
        </div>
        <div className="open-access-seal">
          <ShieldCheck size={28} weight="duotone" />
          <div>
            <strong>{t("openAccess")}</strong>
            <span>{t("allUnlocked")}</span>
          </div>
        </div>
      </section>

      <section className="open-access-banner">
        <div className="banner-glyph">
          <span>Ω</span>
        </div>
        <div>
          <h2>{t("openAccess")}</h2>
          <p>{t("openAccessLead")}</p>
        </div>
        <span className="open-state">{t("allUnlocked")}</span>
      </section>

      <section className="beta-identity-panel panel">
        <div className="beta-identity-copy">
          <div className="module-icon">
            <UserCircle size={26} />
          </div>
          <div>
            <span>{t("betaIdentityEyebrow")}</span>
            <h2>
              {viewer ? t("betaIdentityReady") : t("betaIdentityTitle")}
            </h2>
            <p>{t("betaIdentityLead")}</p>
          </div>
        </div>
        {!viewer ? (
          <a
            className="button primary"
            href="/signin-with-chatgpt?return_to=%2F%3Fview%3Daccount"
          >
            <UserCircle size={17} />
            {t("createBetaAccount")}
          </a>
        ) : accountLoading ? (
          <div
            className="beta-account-skeleton"
            aria-label={t("accountLoading")}
          >
            <span />
            <span />
          </div>
        ) : accountError ? (
          <button
            className="button secondary"
            onClick={() => void refreshAccount()}
          >
            <ArrowsClockwise size={16} />
            {t("accountRetry")}
          </button>
        ) : (
          <div className="beta-identity-record">
            <div>
              <span>{t("signedInAs")}</span>
              <strong>{account?.displayName || viewer.displayName}</strong>
              <small>{account?.email || viewer.email}</small>
            </div>
            <div>
              <span>{t("betaPlan")}</span>
              <strong>{t("betaFreePlan")}</strong>
              <small>
                {account
                  ? t("memberSince", {
                      date: formatDate(account.createdAt, locale),
                    })
                  : t("currentPlan")}
              </small>
            </div>
            <a
              className="button secondary"
              href="/signout-with-chatgpt?return_to=%2F"
            >
              {t("signOut")}
            </a>
          </div>
        )}
      </section>

      <section className="privacy-panel panel">
        <div className="privacy-copy">
          <div className="module-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span>{t("privacyEyebrow")}</span>
            <h2>{t("privacyTitle")}</h2>
            <p>{t("privacyLead")}</p>
            <small>{t("privacyDetails")}</small>
          </div>
        </div>
        <div className="privacy-actions">
          {showInsights && (
            <button className="button secondary" onClick={onOpenInsights}>
              <Database size={17} />
              {t("openInsights")}
            </button>
          )}
          <button
            className={`switch ${telemetryEnabled ? "on" : ""}`}
            onClick={onToggleTelemetry}
            aria-pressed={telemetryEnabled}
            aria-label={t("anonymousAnalytics")}
          >
            <span />
          </button>
          <strong>
            {telemetryEnabled ? t("analyticsOn") : t("analyticsOff")}
          </strong>
        </div>
      </section>

      <section className="guide-reopen-panel panel">
        <div className="module-icon">
          <MagicWand size={24} />
        </div>
        <div>
          <span>{t("onboardingEyebrow")}</span>
          <h2>{t("reopenGuideTitle")}</h2>
          <p>{t("reopenGuideLead")}</p>
        </div>
        <button className="button secondary" onClick={onOpenGuide}>
          <RocketLaunch size={17} />
          {t("reopenGuide")}
        </button>
      </section>

      <section className="bridge-panel panel">
        <div className="bridge-panel-head">
          <div className="module-icon">
            <PlugsConnected size={25} />
          </div>
          <div>
            <span>{t("bridgeEyebrow")}</span>
            <h2>{t("bridgeTitle")}</h2>
            <p>{t("bridgeLead")}</p>
          </div>
          <div className={`sync-pill ${syncState}`}>
            {syncState === "loading" || syncState === "saving" ? (
              <CircleNotch className="spin" size={15} />
            ) : (
              <CheckCircle size={15} weight="fill" />
            )}
            {syncState === "loading"
              ? t("syncLoading")
              : syncState === "saving"
                ? t("syncSaving")
                : syncState === "synced"
                  ? t("syncReady")
                  : syncState === "error"
                    ? t("syncError")
                    : t("localOnly")}
          </div>
        </div>

        {!viewer ? (
          <div className="bridge-signin">
            <p>{t("signInToSync")}</p>
            <a
              className="button primary"
              href="/signin-with-chatgpt?return_to=%2F"
            >
              <UserCircle size={17} />
              {t("signInWithChatGPT")}
            </a>
          </div>
        ) : (
          <>
            <div className="bridge-identity">
              <div>
                <span>{t("signedInAs")}</span>
                <strong>{viewer.displayName}</strong>
                <small>{viewer.email}</small>
              </div>
              <div>
                <span>{t("lastSynced")}</span>
                <strong>
                  {lastSynced
                    ? formatDate(lastSynced, locale)
                    : t("neverSynced")}
                </strong>
              </div>
              <button className="button secondary" onClick={onSyncNow}>
                <ArrowsClockwise size={17} />
                {t("syncNow")}
              </button>
            </div>

            <div className="bridge-credentials">
              <div className="bridge-field">
                <label>{t("bridgeEndpoint")}</label>
                <div>
                  <code>{bridgeEndpoint}</code>
                  <button
                    className="icon-button"
                    aria-label={t("copy")}
                    onClick={() => void copyText(bridgeEndpoint)}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {revealedToken && (
                <div className="bridge-field token-reveal">
                  <label>{t("bridgeToken")}</label>
                  <div>
                    <code>{revealedToken}</code>
                    <button
                      className="icon-button"
                      aria-label={t("copy")}
                      onClick={() => void copyText(revealedToken)}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <p>
                    <Warning size={15} />
                    {t("tokenShownOnce")}
                  </p>
                </div>
              )}

              <div className="bridge-actions">
                <button
                  className="button primary"
                  disabled={tokenBusy}
                  onClick={() => void generateToken()}
                >
                  {tokenBusy ? (
                    <CircleNotch className="spin" size={17} />
                  ) : (
                    <Lightning size={17} />
                  )}
                  {tokens.length ? t("generateAnotherToken") : t("generateToken")}
                </button>
                {tokens.length > 0 && (
                  <button
                    className="button secondary danger-button"
                    disabled={tokenBusy}
                    onClick={() => void revokeTokens()}
                  >
                    <Trash size={17} />
                    {t("revokeTokens")}
                  </button>
                )}
                <span>
                  {tokens.length
                    ? t("activeTokens", { count: tokens.length })
                    : t("noActiveToken")}
                </span>
              </div>
            </div>

            <ol className="bridge-steps">
              <li>{t("bridgeStepOne")}</li>
              <li>{t("bridgeStepTwo")}</li>
              <li>{t("bridgeStepThree")}</li>
            </ol>
          </>
        )}
      </section>

      <section className="account-modules">
        {modules.map((module) => (
          <article
            className={`account-module ${module.className}`}
            key={module.title}
          >
            <div className="module-icon">{module.icon}</div>
            <span>{module.status}</span>
            <h2>{module.title}</h2>
            <p>{module.lead}</p>
          </article>
        ))}
      </section>

      <section className="plan-ledger panel">
        <div className="plan-ledger-head">
          <div>
            <strong>{t("navAccount")}</strong>
            <span>{t("openAccessLead")}</span>
          </div>
          <CheckCircle size={23} weight="fill" />
        </div>
        <div className="plan-rows">
          {plans.map((plan) => (
            <article className={plan.active ? "active" : ""} key={plan.name}>
              <div>
                <h3>{plan.name}</h3>
                <span>{plan.state}</span>
              </div>
              <p>{plan.lead}</p>
              <strong>
                {plan.active ? t("allUnlocked") : t("planned")}
              </strong>
            </article>
          ))}
        </div>
      </section>

      <ProductRoadmap t={t} />
      <MakerCard t={t} />
    </div>
  );
}

function InsightsView({
  t,
  locale,
  summary,
  isLoading,
  onRefresh,
}: {
  t: Translator;
  locale: Locale;
  summary: AnalyticsSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const maxDailySessions = Math.max(
    1,
    ...(summary?.daily.map((item) => item.sessions) || [1]),
  );
  const funnelBase = summary?.funnel[0]?.sessions || 0;

  return (
    <div className="view insights-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("insightsEyebrow")}</p>
          <h1>{t("insightsTitle")}</h1>
          <p>{t("insightsLead")}</p>
        </div>
        <button
          className="button secondary"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <CircleNotch className="spin" size={17} />
          ) : (
            <ArrowsClockwise size={17} />
          )}
          {t("refreshInsights")}
        </button>
      </section>

      {!summary ? (
        <section className="empty-state">
          <Database size={36} />
          <h2>{t("insightsEmpty")}</h2>
          <p>{t("insightsEmptyLead")}</p>
        </section>
      ) : (
        <>
          <section className="insight-metrics">
            {[
              [summary.totals.sessions, t("metricSessions")],
              [`${summary.rates.activation}%`, t("metricActivation")],
              [`${summary.rates.value}%`, t("metricValue")],
              [`${summary.rates.returning}%`, t("metricReturning")],
              [
                summary.totals.positiveFeedback +
                  summary.totals.negativeFeedback +
                  summary.totals.conflictFeedback,
                t("metricFeedback"),
              ],
            ].map(([value, label]) => (
              <article key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </section>

          <section className="insights-grid">
            <div className="panel funnel-panel">
              <div className="panel-label">
                <span>
                  <Lightning size={17} />
                </span>
                <div>
                  <strong>{t("valueFunnel")}</strong>
                  <small>{t("valueFunnelLead")}</small>
                </div>
              </div>
              <div className="funnel-list">
                {summary.funnel.map((stage, index) => {
                  const rate = funnelBase
                    ? Math.round((stage.sessions / funnelBase) * 100)
                    : 0;
                  return (
                    <div key={stage.key}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{t(`funnel${capitalize(stage.key)}` as TranslationKey)}</strong>
                        <i style={{ width: `${Math.max(3, rate)}%` }} />
                      </div>
                      <em>{stage.sessions}</em>
                      <small>{rate}%</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel daily-panel">
              <div className="panel-label">
                <span>
                  <CalendarBlank size={17} />
                </span>
                <div>
                  <strong>{t("recentUse")}</strong>
                  <small>{t("recentUseLead")}</small>
                </div>
              </div>
              <div className="daily-bars">
                {summary.daily.length ? (
                  summary.daily.map((day) => (
                    <div key={day.day}>
                      <span
                        style={{
                          height: `${Math.max(
                            8,
                            (day.sessions / maxDailySessions) * 100,
                          )}%`,
                        }}
                        title={`${day.sessions}`}
                      />
                      <small>
                        {new Intl.DateTimeFormat(locale, {
                          month: "numeric",
                          day: "numeric",
                        }).format(new Date(`${day.day}T00:00:00Z`))}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>{t("insightsEmptyLead")}</p>
                )}
              </div>
            </div>

            <div className="panel source-panel">
              <div className="panel-label">
                <span>
                  <GlobeSimple size={17} />
                </span>
                <div>
                  <strong>{t("acquisitionSources")}</strong>
                  <small>{t("acquisitionSourcesLead")}</small>
                </div>
              </div>
              <div className="source-list">
                {summary.sources.length ? (
                  summary.sources.map((source) => (
                    <div key={source.source}>
                      <strong>{source.source}</strong>
                      <span>{source.sessions}</span>
                    </div>
                  ))
                ) : (
                  <p>{t("insightsEmptyLead")}</p>
                )}
              </div>
            </div>

            <div className="panel research-note">
              <ShieldCheck size={24} />
              <div>
                <strong>{t("privacyBoundary")}</strong>
                <p>
                  {t("privacyBoundaryLead", {
                    days: summary.retentionDays,
                  })}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ValueFeedback({
  t,
  stack,
  outcomes,
  onOutcome,
  onClose,
}: {
  t: Translator;
  stack: Skill[];
  outcomes: Record<string, SkillOutcome>;
  onOutcome: (skillId: string, outcome: SkillOutcome) => void;
  onClose: () => void;
}) {
  const options: Array<{
    value: SkillOutcome;
    label: TranslationKey;
  }> = [
    { value: "helpful", label: "outcomeHelpful" },
    { value: "unused", label: "outcomeUnused" },
    { value: "conflicted", label: "outcomeConflicted" },
    { value: "install_failed", label: "outcomeInstallFailed" },
    { value: "source_changed", label: "outcomeSourceChanged" },
  ];
  return (
    <aside className="value-feedback" aria-label={t("outcomeTitle")}>
      <button
        className="feedback-close"
        onClick={onClose}
        aria-label={t("close")}
      >
        <X size={15} />
      </button>
      <span>{t("feedbackEyebrow")}</span>
      <strong>{t("outcomeTitle")}</strong>
      <p>{t("outcomeLead")}</p>
      <div className="skill-outcome-list">
        {stack.map((skill) => (
          <section key={skill.id}>
            <div>
              <strong>{skill.name}</strong>
              <small>{skillResponsibility(skill, t)}</small>
            </div>
            <div>
              {options.map((option) => (
                <button
                  key={option.value}
                  className={
                    outcomes[skill.id] === option.value ? "selected" : ""
                  }
                  onClick={() => onOutcome(skill.id, option.value)}
                >
                  {option.value === "helpful" && <Check size={13} />}
                  {option.value === "conflicted" && <Warning size={13} />}
                  {t(option.label)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function ProductRoadmap({ t }: { t: Translator }) {
  const capabilities = [
    [t("capLibrary"), t("capLibraryLead"), t("statusLive")],
    [t("capIntake"), t("capIntakeLead"), t("statusLive")],
    [t("capHybrid"), t("capHybridLead"), t("statusLive")],
    [t("capStack"), t("capStackLead"), t("statusLive")],
    [t("capRadar"), t("capRadarLead"), t("statusLive")],
    [t("capLanguage"), t("capLanguageLead"), t("statusLive")],
    [t("capBridge"), t("capBridgeLead"), t("statusLive")],
    [t("capPlatform"), t("capPlatformLead"), t("statusAlpha")],
  ] as const;
  const phases = [
    {
      title: t("phaseAlphaThree"),
      window: "JUL-AUG 2026",
      state: "active",
      lane: "2 / span 2",
    },
    {
      title: t("phasePublicAlpha"),
      window: "AUG-SEP 2026",
      state: "next",
      lane: "3 / span 2",
    },
    {
      title: t("phaseBeta"),
      window: "JUL-NOV 2026",
      state: "active",
      lane: "2 / span 5",
    },
    {
      title: t("phaseVOne"),
      window: "NOV-DEC 2026",
      state: "planned",
      lane: "6 / span 2",
    },
  ];

  return (
    <section className="roadmap-panel panel">
      <div className="roadmap-heading">
        <div>
          <span>{t("roadmapEyebrow")}</span>
          <h2>{t("roadmapTitle")}</h2>
          <p>{t("roadmapLead")}</p>
        </div>
        <CalendarBlank size={27} />
      </div>

      <div className="capability-grid">
        {capabilities.map(([title, lead, status], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{title}</h3>
              <p>{lead}</p>
            </div>
            <em
              className={
                status === t("statusLive")
                  ? "live"
                  : status === t("statusAlpha")
                    ? "alpha"
                    : "next"
              }
            >
              {status}
            </em>
          </article>
        ))}
      </div>

      <div className="gantt">
        <div className="gantt-axis" aria-hidden="true">
          <span>JUL</span>
          <span>AUG</span>
          <span>SEP</span>
          <span>OCT</span>
          <span>NOV</span>
          <span>DEC</span>
        </div>
        <div className="gantt-grid">
          {phases.map((phase) => (
            <div className="gantt-row" key={phase.title}>
              <strong>{phase.title}</strong>
              <span
                className={`gantt-bar ${phase.state}`}
                style={{ gridColumn: phase.lane }}
              >
                {phase.window}
              </span>
            </div>
          ))}
        </div>
        <p>{t("roadmapNote")}</p>
      </div>
    </section>
  );
}

function MakerCard({ t }: { t: Translator }) {
  return (
    <section className="maker-card">
      <div className="maker-mark" aria-hidden="true">
        Ω
      </div>
      <div>
        <span>{t("makerEyebrow")}</span>
        <h2>{t("makerTitle")}</h2>
        <p>{t("makerLead")}</p>
      </div>
      <a
        className="button secondary"
        href="https://github.com/Tomchen070814"
        target="_blank"
        rel="noreferrer"
      >
        <GitBranch size={17} />
        {t("findMaker")}
        <ArrowSquareOut size={15} />
      </a>
    </section>
  );
}

function OnboardingModal({
  t,
  level,
  onLevel,
  onFinish,
  onSkip,
}: {
  t: Translator;
  level: OnboardingLevel | null;
  onLevel: (level: OnboardingLevel) => void;
  onFinish: (
    level: OnboardingLevel,
    destination: "sample" | "radar" | "library",
  ) => void;
  onSkip: () => void;
}) {
  const paths: Array<{
    id: OnboardingLevel;
    icon: ReactNode;
    title: TranslationKey;
    lead: TranslationKey;
  }> = [
    {
      id: "beginner",
      icon: <Sparkle size={24} weight="duotone" />,
      title: "onboardingBeginner",
      lead: "onboardingBeginnerLead",
    },
    {
      id: "familiar",
      icon: <Toolbox size={24} weight="duotone" />,
      title: "onboardingFamiliar",
      lead: "onboardingFamiliarLead",
    },
    {
      id: "expert",
      icon: <RocketLaunch size={24} weight="duotone" />,
      title: "onboardingExpert",
      lead: "onboardingExpertLead",
    },
  ];
  const guide =
    level === "beginner"
      ? {
          title: t("beginnerGuideTitle"),
          lead: t("beginnerGuideLead"),
          steps: [
            t("beginnerGuideStepOne"),
            t("beginnerGuideStepTwo"),
            t("beginnerGuideStepThree"),
          ],
          action: t("beginnerGuideAction"),
          destination: "sample" as const,
        }
      : level === "familiar"
        ? {
            title: t("familiarGuideTitle"),
            lead: t("familiarGuideLead"),
            steps: [
              t("familiarGuideStepOne"),
              t("familiarGuideStepTwo"),
              t("familiarGuideStepThree"),
            ],
            action: t("familiarGuideAction"),
            destination: "radar" as const,
          }
        : level === "expert"
          ? {
              title: t("expertGuideTitle"),
              lead: t("expertGuideLead"),
              steps: [
                t("expertGuideStepOne"),
                t("expertGuideStepTwo"),
                t("expertGuideStepThree"),
              ],
              action: t("expertGuideAction"),
              destination: "library" as const,
            }
          : null;

  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <section
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <header className="onboarding-header">
          <div className="onboarding-mark" aria-hidden="true">
            Ω
          </div>
          <div>
            <p className="eyebrow">{t("onboardingEyebrow")}</p>
            <h2 id="onboarding-title">{t("onboardingTitle")}</h2>
            <p>{t("onboardingLead")}</p>
          </div>
          <button className="button ghost" onClick={onSkip}>
            {t("onboardingSkip")}
          </button>
        </header>

        <div className="onboarding-paths" aria-label={t("onboardingChoose")}>
          {paths.map((path) => (
            <button
              key={path.id}
              className={level === path.id ? "active" : ""}
              onClick={() => onLevel(path.id)}
              aria-pressed={level === path.id}
            >
              <span>{path.icon}</span>
              <strong>{t(path.title)}</strong>
              <small>{t(path.lead)}</small>
            </button>
          ))}
        </div>

        {guide ? (
          <motion.section
            className="onboarding-guide"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key={level}
          >
            <div>
              <span>{t("yourGuide")}</span>
              <h3>{guide.title}</h3>
              <p>{guide.lead}</p>
            </div>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button
              className="button primary"
              onClick={() => onFinish(level!, guide.destination)}
            >
              <ArrowRight size={17} />
              {guide.action}
            </button>
          </motion.section>
        ) : (
          <div className="onboarding-prompt">
            <MagicWand size={22} />
            <p>{t("onboardingChoose")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function AddSkillModal({
  t,
  onClose,
  onSubmit,
}: {
  t: Translator;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-skill-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{t("modalEyebrow")}</p>
            <h2 id="add-skill-title">{t("modalTitle")}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X size={19} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="field-row">
            <label>
              <span>{t("skillName")}</span>
              <input
                name="name"
                required
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </label>
            <label>
              <span>{t("category")}</span>
              <select name="category" defaultValue="工程">
                {categories.slice(1).map((item) => (
                  <option key={item} value={item}>
                    {t(categoryTranslation[item])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>{t("description")}</span>
            <textarea
              name="description"
              required
              placeholder={t("descPlaceholder")}
            />
          </label>
          <label>
            <span>{t("sourceUrl")}</span>
            <div className="input-with-icon">
              <LinkSimple size={18} />
              <input
                name="sourceUrl"
                type="url"
                placeholder="https://github.com/..."
              />
            </div>
          </label>
          <div className="field-row">
            <label>
              <span>{t("tags")}</span>
              <input name="tags" placeholder={t("tagsPlaceholder")} />
            </label>
            <label>
              <span>{t("triggers")}</span>
              <input name="triggers" placeholder={t("triggersPlaceholder")} />
            </label>
          </div>
          <div className="modal-note">
            <Info size={18} />
            <p>{t("modalNote")}</p>
          </div>
          <footer className="modal-footer">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              {t("cancel")}
            </button>
            <button className="button primary" type="submit">
              <Plus size={17} />
              {t("addToLibrary")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

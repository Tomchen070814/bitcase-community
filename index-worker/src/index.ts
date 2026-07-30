const RANKER_VERSION = "ranker-v5";
const SEARCH_CACHE_SECONDS = 300;
const CIRCUIT_OPEN_MS = 60 * 60 * 1000;
const MAX_SKILLS_PER_REPOSITORY = 2;

type SourceName = "skills.sh" | "github";
type SyncReason = SourceName | "full";
type RiskLevel = "clear" | "review";
type SourceLanguage = "zh" | "en" | "ja" | "mixed";

interface D1Result<T> {
  results?: T[];
  success?: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface R2Bucket {
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Env {
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  GITHUB_TOKEN?: string;
  SYNC_ADMIN_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

type Capability = {
  id: string;
  label: string;
  priority: number;
  patterns: RegExp;
  searchTerms: string[];
};

type IndexedSkill = {
  id: string;
  source: SourceName;
  sourceRef: string;
  repository: string;
  commitSha: string;
  defaultBranch: string;
  skillPath: string;
  name: string;
  description: string;
  searchText: string;
  capabilityIds: string[];
  sourceLanguage: SourceLanguage;
  risk: RiskLevel;
  license: string | null;
  sourceUrl: string;
  skillUrl: string;
  contentHash: string;
  checkedAt: string;
  installs: number | null;
  r2Key: string;
  rawContent?: string;
};

type SnapshotRow = {
  skill_id: string;
  source: SourceName;
  source_ref: string;
  repository: string;
  commit_sha: string;
  default_branch: string;
  skill_path: string;
  name: string;
  description: string;
  search_text: string;
  capabilities_json: string;
  source_language: SourceLanguage;
  risk: RiskLevel;
  license: string | null;
  source_url: string;
  skill_url: string;
  content_hash: string;
  checked_at: string;
  installs: number | null;
  r2_key: string;
};

type ActiveVersion = {
  version_id: string;
  built_at: string;
  ranker_version: string;
  skill_count: number;
};

type SourceAttempt = {
  source: SourceName;
  attempted: boolean;
  succeeded: boolean;
  discovered: number;
  skills: IndexedSkill[];
  error?: string;
};

const CAPABILITIES: Capability[] = [
  {
    id: "skill-intake",
    label: "来源导入与 SKILL.md 解析",
    priority: 6,
    patterns: /(skill\.md|source|github|repository|metadata|parse|parser|import|crawl|scrape|来源|仓库|元数据|解析|导入|抓取)/i,
    searchTerms: ["skill.md", "source", "github", "repository", "metadata", "parse", "来源", "仓库", "解析"],
  },
  {
    id: "skill-discovery",
    label: "Skill 检索、推荐与匹配",
    priority: 6,
    patterns: /(skill|search|discover|retrieval|recommend|ranking|match|index|检索|搜索|发现|推荐|匹配|排序|索引)/i,
    searchTerms: ["skill", "search", "retrieval", "recommend", "match", "检索", "推荐", "匹配"],
  },
  {
    id: "instrument",
    label: "仪器通信与设备控制",
    priority: 6,
    patterns: /(instrument|scpi|visa|gpib|usbtmc|serial|uart|keysight|keithley|fluke|仪器|设备控制|串口|万用表|源表|半参)/i,
    searchTerms: ["instrument", "scpi", "visa", "gpib", "serial", "仪器", "设备控制", "数据采集"],
  },
  {
    id: "automation",
    label: "自动化流程与任务编排",
    priority: 5,
    patterns: /(automation|workflow|orchestrat|schedule|cron|pipeline|batch|自动化|工作流|编排|定时|批处理)/i,
    searchTerms: ["automation", "workflow", "schedule", "cron", "自动化", "工作流", "定时"],
  },
  {
    id: "data",
    label: "数据处理与分析",
    priority: 5,
    patterns: /(data|csv|excel|spreadsheet|analysis|chart|plot|dataset|数据|表格|分析|图表)/i,
    searchTerms: ["data", "csv", "excel", "analysis", "chart", "数据", "分析", "图表"],
  },
  {
    id: "persistence",
    label: "数据模型与持久化",
    priority: 5,
    patterns: /(database|storage|persistence|postgres|mysql|sqlite|d1|schema|migration|cache|数据库|存储|持久化|表结构|迁移|缓存)/i,
    searchTerms: ["database", "storage", "schema", "migration", "cache", "数据库", "存储", "缓存"],
  },
  {
    id: "frontend",
    label: "界面设计与前端实现",
    priority: 4,
    patterns: /(frontend|react|next\.?js|website|web app|ui|ux|design system|dashboard|网页|网站|前端|界面|可视化|交互)/i,
    searchTerms: ["frontend", "react", "website", "ui", "ux", "前端", "界面", "网站"],
  },
  {
    id: "backend",
    label: "应用后端与接口",
    priority: 4,
    patterns: /(backend|api|server|worker|full.?stack|node\.?js|后端|服务端|接口|全栈)/i,
    searchTerms: ["backend", "api", "server", "worker", "后端", "服务端", "接口"],
  },
  {
    id: "security",
    label: "安全与输入校验",
    priority: 4,
    patterns: /(security|secure|audit|permission|threat|sanitize|validation|安全|审计|权限|风险|校验|验证)/i,
    searchTerms: ["security", "audit", "validation", "安全", "审计", "校验"],
  },
  {
    id: "testing",
    label: "测试与质量验证",
    priority: 3,
    patterns: /(test|testing|tdd|qa|quality|debug|review|coverage|测试|调试|质量|审查|覆盖率)/i,
    searchTerms: ["test", "testing", "quality", "debug", "测试", "质量", "调试"],
  },
  {
    id: "delivery",
    label: "部署与持续交付",
    priority: 3,
    patterns: /(deploy|deployment|release|publish|ci\/cd|github actions|发布|部署|持续集成|交付)/i,
    searchTerms: ["deploy", "release", "ci", "publish", "部署", "发布", "交付"],
  },
  {
    id: "document",
    label: "文档与报告交付",
    priority: 3,
    patterns: /(document|report|pdf|writing|slides|presentation|文档|报告|写作|演示)/i,
    searchTerms: ["document", "report", "pdf", "writing", "文档", "报告", "写作"],
  },
  {
    id: "visual",
    label: "图像与视觉内容",
    priority: 3,
    patterns: /(image|visual|illustration|brand|video|图片|图像|视觉|插画|品牌|视频)/i,
    searchTerms: ["image", "visual", "illustration", "图片", "图像", "视觉"],
  },
  {
    id: "communication",
    label: "沟通与协作",
    priority: 3,
    patterns: /(email|mail|calendar|slack|message|communication|邮件|日历|消息|沟通|协作)/i,
    searchTerms: ["email", "calendar", "slack", "message", "邮件", "日历", "沟通"],
  },
  {
    id: "engineering",
    label: "工程实现",
    priority: 3,
    patterns: /(code|coding|build|typescript|python|software|implementation|程序|代码|开发|实现|工程)/i,
    searchTerms: ["code", "build", "typescript", "python", "software", "代码", "开发", "实现"],
  },
];

const SKILLS_SH_QUERIES = [
  "software engineering",
  "data analysis",
  "web application",
  "workflow automation",
];

const GITHUB_REPOSITORY_QUERIES = [
  '"SKILL.md" agent skills',
  "codex skills automation",
];

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}

function normalizeQuery(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenize(value: string) {
  const normalized = normalizeQuery(value);
  const words = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}._+-]*/gu) || [];
  const han = normalized.match(/[\u3400-\u9fff]{2,4}/g) || [];
  return Array.from(new Set([...words, ...han])).filter((token) => token.length > 1);
}

function languageOf(value: string): SourceLanguage {
  const kana = (value.match(/[\u3040-\u30ff]/g) || []).length;
  const han = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  if (kana > 0) return "ja";
  if (han >= 2 && latin > han * 4) return "mixed";
  if (han >= 2) return "zh";
  return "en";
}

function extractFrontmatter(markdown: string) {
  const frontmatter = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  const value = (key: string) => {
    const match = frontmatter?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
    return match?.[1].trim().replace(/^["']|["']$/g, "") || "";
  };
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  const firstParagraph =
    markdown
      .replace(/^---\s*\n[\s\S]*?\n---/, "")
      .replace(/^#+\s+.*$/gm, "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .find((paragraph) => paragraph.length >= 12) || "";
  return {
    name: value("name") || firstHeading,
    description: value("description") || firstParagraph.slice(0, 600),
  };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function detectRisk(markdown: string): RiskLevel {
  return /(ignore (all|any|the) previous instructions|read ~\/\.ssh|read (the )?credentials|exfiltrat|disable security|curl[^|\n]*\|\s*(bash|sh)|rm\s+-rf)/i.test(
    markdown,
  )
    ? "review"
    : "clear";
}

function capabilityIdsFor(value: string) {
  const matched = CAPABILITIES.filter((capability) => capability.patterns.test(value)).map(
    (capability) => capability.id,
  );
  return matched.length ? matched : ["engineering"];
}

export async function parseSkillMarkdown(input: {
  source: SourceName;
  sourceRef: string;
  repository: string;
  commitSha: string;
  defaultBranch: string;
  skillPath: string;
  markdown: string;
  license?: string | null;
  installs?: number | null;
  checkedAt?: string;
}): Promise<IndexedSkill | null> {
  const { name, description } = extractFrontmatter(input.markdown);
  if (!name || !description || input.markdown.length > 400_000) return null;
  const contentHash = await sha256(input.markdown);
  const sourceUrl = `https://github.com/${input.repository}`;
  const skillUrl = `${sourceUrl}/blob/${encodeURIComponent(input.commitSha)}/${encodePath(input.skillPath)}`;
  const capabilityIds = capabilityIdsFor(`${name}\n${description}\n${input.markdown.slice(0, 60_000)}`);
  return {
    id: `${input.repository}:${input.skillPath}`,
    source: input.source,
    sourceRef: input.sourceRef,
    repository: input.repository,
    commitSha: input.commitSha,
    defaultBranch: input.defaultBranch,
    skillPath: input.skillPath,
    name,
    description: description.slice(0, 800),
    searchText: normalizeQuery(
      `${name}\n${description}\n${input.skillPath}\n${input.repository}\n${input.markdown.slice(0, 80_000)}`,
    ),
    capabilityIds,
    sourceLanguage: languageOf(`${description}\n${input.markdown.slice(0, 4_000)}`),
    risk: detectRisk(input.markdown),
    license: input.license || null,
    sourceUrl,
    skillUrl,
    contentHash,
    checkedAt: input.checkedAt || nowIso(),
    installs: input.installs ?? null,
    r2Key: `content/${contentHash}.md`,
    rawContent: input.markdown,
  };
}

function githubHeaders(env: Env) {
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "Bitcase-Index-Worker",
    "x-github-api-version": "2022-11-28",
  });
  if (env.GITHUB_TOKEN) headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  return headers;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, init: RequestInit = {}) {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) throw new Error(`upstream_${response.status}:${new URL(url).hostname}`);
  return (await response.json()) as T;
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  operation: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

type RepositoryCandidate = {
  fullName: string;
  defaultBranch: string;
  license: string | null;
  sourceRef: string;
  installs: number | null;
  skillSlug?: string;
};

async function inspectRepository(
  env: Env,
  candidate: RepositoryCandidate,
  source: SourceName,
) {
  const headers = githubHeaders(env);
  const commit = await fetchJson<{ sha?: string; commit?: { tree?: { sha?: string } } }>(
    `https://api.github.com/repos/${candidate.fullName}/commits/${encodeURIComponent(candidate.defaultBranch)}`,
    { headers },
  );
  if (!commit.sha) throw new Error(`repository_commit_missing:${candidate.fullName}`);
  const commitSha = commit.sha;
  const treeSha = commit.commit?.tree?.sha || commitSha;
  const tree = await fetchJson<{
    sha?: string;
    truncated?: boolean;
    tree?: { path?: string; type?: string }[];
  }>(
    `https://api.github.com/repos/${candidate.fullName}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
    { headers },
  );
  if (tree.truncated) throw new Error(`repository_tree_truncated:${candidate.fullName}`);
  const allPaths = (tree.tree || [])
    .filter((entry) => entry.type === "blob" && /(^|\/)SKILL\.md$/i.test(entry.path || ""))
    .map((entry) => entry.path!)
    .sort();
  const matchedPaths = allPaths.filter((path) => {
      if (!candidate.skillSlug || source === "github") return true;
      const normalizedPath = path.toLowerCase().replace(/[_\s]+/g, "-");
      return normalizedPath.includes(candidate.skillSlug!.toLowerCase().replace(/[_\s]+/g, "-"));
    });
  const paths = (matchedPaths.length ? matchedPaths : allPaths.length === 1 ? allPaths : [])
    .slice(0, MAX_SKILLS_PER_REPOSITORY);
  const parsed = await mapLimit(paths, 3, async (skillPath) => {
    const rawUrl = `https://raw.githubusercontent.com/${candidate.fullName}/${encodeURIComponent(commitSha)}/${encodePath(skillPath)}`;
    const response = await fetchWithTimeout(rawUrl, { headers });
    if (!response.ok) return null;
    const markdown = await response.text();
    return parseSkillMarkdown({
      source,
      sourceRef: candidate.sourceRef,
      repository: candidate.fullName,
      commitSha,
      defaultBranch: candidate.defaultBranch,
      skillPath,
      markdown,
      license: candidate.license,
      installs: candidate.installs,
    });
  });
  return {
    discovered: paths.length,
    skills: parsed.filter((skill): skill is IndexedSkill => Boolean(skill)),
  };
}

async function syncSkillsSh(env: Env): Promise<SourceAttempt> {
  const catalogs = await Promise.all(
    SKILLS_SH_QUERIES.map(async (query) => {
      const endpoint = new URL("https://skills.sh/api/search");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("limit", "30");
      const payload = await fetchJson<{
        skills?: { id?: string; name?: string; source?: string; installs?: number }[];
      }>(endpoint.toString(), {
        headers: { "user-agent": "Bitcase-Index-Worker", accept: "application/json" },
      });
      return payload.skills || [];
    }),
  );
  const candidates = new Map<string, RepositoryCandidate>();
  for (const entry of catalogs.flat()) {
    const id = typeof entry.id === "string" ? entry.id.replace(/^\/+|\/+$/g, "") : "";
    const parts = id.split("/");
    const source = typeof entry.source === "string" ? entry.source : parts.slice(0, 2).join("/");
    const sourceParts = source.split("/");
    if (sourceParts.length !== 2 || !sourceParts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) continue;
    const fullName = sourceParts.join("/");
    const skillSlug = parts.slice(2).join("/") || entry.name || "";
    const key = `${fullName}:${skillSlug}`;
    if (candidates.has(key)) continue;
    candidates.set(key, {
      fullName,
      defaultBranch: "main",
      license: null,
      sourceRef: `https://skills.sh/${id}`,
      installs: Number.isFinite(entry.installs) ? Number(entry.installs) : null,
      skillSlug,
    });
  }
  const selected = Array.from(candidates.values()).slice(0, 4);
  const resolved = await mapLimit(selected, 3, async (candidate) => {
    try {
      const metadata = await fetchJson<{
        default_branch?: string;
        license?: { spdx_id?: string | null } | null;
      }>(`https://api.github.com/repos/${candidate.fullName}`, { headers: githubHeaders(env) });
      return await inspectRepository(
        env,
        {
          ...candidate,
          defaultBranch: metadata.default_branch || candidate.defaultBranch,
          license: metadata.license?.spdx_id || null,
        },
        "skills.sh",
      );
    } catch {
      return { discovered: 0, skills: [] as IndexedSkill[] };
    }
  });
  const discovered = resolved.reduce((total, result) => total + result.discovered, 0);
  const skills = resolved.flatMap((result) => result.skills);
  if (!discovered || !skills.length) throw new Error("skills_sh_returned_no_parseable_skills");
  return { source: "skills.sh", attempted: true, succeeded: true, discovered, skills };
}

async function syncGithub(env: Env): Promise<SourceAttempt> {
  const searches = await Promise.all(
    GITHUB_REPOSITORY_QUERIES.map(async (query) => {
      const endpoint = new URL("https://api.github.com/search/repositories");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("per_page", "20");
      const payload = await fetchJson<{
        items?: {
          full_name?: string;
          default_branch?: string;
          archived?: boolean;
          fork?: boolean;
          license?: { spdx_id?: string | null } | null;
        }[];
      }>(endpoint.toString(), { headers: githubHeaders(env) });
      return payload.items || [];
    }),
  );
  const candidates = new Map<string, RepositoryCandidate>();
  for (const repository of searches.flat()) {
    if (
      !repository.full_name ||
      repository.archived ||
      repository.fork ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.full_name)
    ) {
      continue;
    }
    candidates.set(repository.full_name, {
      fullName: repository.full_name,
      defaultBranch: repository.default_branch || "main",
      license: repository.license?.spdx_id || null,
      sourceRef: `https://github.com/${repository.full_name}`,
      installs: null,
    });
  }
  const resolved = await mapLimit(Array.from(candidates.values()).slice(0, 4), 3, async (candidate) => {
    try {
      return await inspectRepository(env, candidate, "github");
    } catch {
      return { discovered: 0, skills: [] as IndexedSkill[] };
    }
  });
  const discovered = resolved.reduce((total, result) => total + result.discovered, 0);
  const skills = resolved.flatMap((result) => result.skills);
  if (!discovered || !skills.length) throw new Error("github_returned_no_parseable_skills");
  return { source: "github", attempted: true, succeeded: true, discovered, skills };
}

function snapshotRowToSkill(row: SnapshotRow): IndexedSkill {
  let capabilityIds: string[] = [];
  try {
    const parsed = JSON.parse(row.capabilities_json);
    if (Array.isArray(parsed)) capabilityIds = parsed.filter((value): value is string => typeof value === "string");
  } catch {
    capabilityIds = [];
  }
  return {
    id: row.skill_id,
    source: row.source,
    sourceRef: row.source_ref,
    repository: row.repository,
    commitSha: row.commit_sha,
    defaultBranch: row.default_branch,
    skillPath: row.skill_path,
    name: row.name,
    description: row.description,
    searchText: row.search_text,
    capabilityIds,
    sourceLanguage: row.source_language,
    risk: row.risk,
    license: row.license,
    sourceUrl: row.source_url,
    skillUrl: row.skill_url,
    contentHash: row.content_hash,
    checkedAt: row.checked_at,
    installs: row.installs,
    r2Key: row.r2_key,
  };
}

async function activeVersion(env: Env) {
  return env.DB.prepare(
    `SELECT v.version_id, v.built_at, v.ranker_version, v.skill_count
     FROM active_index a
     JOIN index_versions v ON v.version_id = a.version_id
     WHERE a.singleton = 1`,
  ).first<ActiveVersion>();
}

async function snapshotSkills(env: Env, versionId: string) {
  const result = await env.DB.prepare(
    `SELECT skill_id, source, source_ref, repository, commit_sha, default_branch,
            skill_path, name, description, search_text, capabilities_json,
            source_language, risk, license, source_url, skill_url, content_hash,
            checked_at, installs, r2_key
     FROM indexed_skills
     WHERE version_id = ?
     ORDER BY skill_id`,
  )
    .bind(versionId)
    .all<SnapshotRow>();
  return (result.results || []).map(snapshotRowToSkill);
}

export function nextCircuitState(
  consecutiveFailures: number,
  succeeded: boolean,
  now = Date.now(),
) {
  if (succeeded) {
    return { consecutiveFailures: 0, circuitOpenUntil: null as string | null, status: "healthy" };
  }
  const failures = consecutiveFailures + 1;
  return {
    consecutiveFailures: failures,
    circuitOpenUntil: failures >= 3 ? nowIso(now + CIRCUIT_OPEN_MS) : null,
    status: failures >= 3 ? "open" : "degraded",
  };
}

async function sourceState(env: Env, source: SourceName) {
  return env.DB.prepare(
    `SELECT consecutive_failures, circuit_open_until
     FROM source_state WHERE source = ?`,
  )
    .bind(source)
    .first<{ consecutive_failures: number; circuit_open_until: string | null }>();
}

async function canAttemptSource(env: Env, source: SourceName, now = Date.now()) {
  const state = await sourceState(env, source);
  return !state?.circuit_open_until || Date.parse(state.circuit_open_until) <= now;
}

async function recordSourceResult(
  env: Env,
  source: SourceName,
  succeeded: boolean,
  error?: string,
) {
  const previous = await sourceState(env, source);
  const next = nextCircuitState(previous?.consecutive_failures || 0, succeeded);
  const timestamp = nowIso();
  await env.DB.prepare(
    `INSERT INTO source_state (
       source, status, consecutive_failures, circuit_open_until,
       last_attempt_at, last_success_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source) DO UPDATE SET
       status = excluded.status,
       consecutive_failures = excluded.consecutive_failures,
       circuit_open_until = excluded.circuit_open_until,
       last_attempt_at = excluded.last_attempt_at,
       last_success_at = CASE
         WHEN excluded.last_success_at IS NOT NULL THEN excluded.last_success_at
         ELSE source_state.last_success_at
       END,
       last_error = excluded.last_error`,
  )
    .bind(
      source,
      next.status,
      next.consecutiveFailures,
      next.circuitOpenUntil,
      timestamp,
      succeeded ? timestamp : null,
      succeeded ? null : error || "source_failed",
    )
    .run();
}

async function attemptSource(env: Env, source: SourceName): Promise<SourceAttempt> {
  if (!(await canAttemptSource(env, source))) {
    return {
      source,
      attempted: false,
      succeeded: false,
      discovered: 0,
      skills: [],
      error: "circuit_open",
    };
  }
  try {
    const result = source === "skills.sh" ? await syncSkillsSh(env) : await syncGithub(env);
    await recordSourceResult(env, source, true);
    return result;
  } catch (error) {
    const message = errorMessage(error);
    await recordSourceResult(env, source, false, message);
    return { source, attempted: true, succeeded: false, discovered: 0, skills: [], error: message };
  }
}

function deduplicateSkills(skills: IndexedSkill[]) {
  const unique = new Map<string, IndexedSkill>();
  const ordered = [...skills].sort((first, second) => {
    const firstPriority = first.source === "skills.sh" ? 0 : 1;
    const secondPriority = second.source === "skills.sh" ? 0 : 1;
    return firstPriority - secondPriority || (second.installs || 0) - (first.installs || 0) || first.id.localeCompare(second.id);
  });
  for (const skill of ordered) {
    if (!unique.has(skill.id)) unique.set(skill.id, skill);
  }
  return Array.from(unique.values()).sort((first, second) => first.id.localeCompare(second.id));
}

export function evaluateSnapshotQuality(input: {
  previousCount: number;
  skillCount: number;
  discoveredCount: number;
  parsedCount: number;
  missingR2Objects: number;
}) {
  const errors: string[] = [];
  if (input.skillCount < 1) errors.push("empty_snapshot");
  if (
    input.previousCount > 0 &&
    input.skillCount < Math.ceil(input.previousCount * 0.9)
  ) {
    errors.push("skill_count_below_90_percent");
  }
  const parseRate = input.discoveredCount > 0 ? input.parsedCount / input.discoveredCount : 0;
  if (parseRate < 0.95) errors.push("parse_rate_below_95_percent");
  if (input.missingR2Objects > 0) errors.push("r2_original_missing");
  return { accepted: errors.length === 0, errors, parseRate };
}

async function versionIdFor(reason: SyncReason) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${timestamp}-${(await sha256(`${reason}:${crypto.randomUUID()}`)).slice(0, 8)}`;
}

async function insertVersion(
  env: Env,
  input: {
    versionId: string;
    status: string;
    reason: SyncReason;
    builtAt: string;
    previousVersionId: string | null;
    skillCount: number;
    discoveredCount: number;
    parsedCount: number;
    manifestKey: string | null;
    failureReason?: string | null;
  },
) {
  await env.DB.prepare(
    `INSERT INTO index_versions (
       version_id, status, build_reason, built_at, activated_at, skill_count,
       discovered_count, parsed_count, previous_version_id, ranker_version,
       manifest_key, failure_reason
     ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.versionId,
      input.status,
      input.reason,
      input.builtAt,
      input.skillCount,
      input.discoveredCount,
      input.parsedCount,
      input.previousVersionId,
      RANKER_VERSION,
      input.manifestKey,
      input.failureReason || null,
    )
    .run();
}

async function persistSkills(env: Env, versionId: string, skills: IndexedSkill[]) {
  const insert = `INSERT INTO indexed_skills (
    version_id, skill_id, source, source_ref, repository, commit_sha,
    default_branch, skill_path, name, description, search_text,
    capabilities_json, source_language, risk, license, source_url, skill_url,
    content_hash, checked_at, installs, r2_key
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (let offset = 0; offset < skills.length; offset += 50) {
    const chunk = skills.slice(offset, offset + 50).map((skill) =>
      env.DB.prepare(insert).bind(
        versionId,
        skill.id,
        skill.source,
        skill.sourceRef,
        skill.repository,
        skill.commitSha,
        skill.defaultBranch,
        skill.skillPath,
        skill.name,
        skill.description,
        skill.searchText,
        JSON.stringify(skill.capabilityIds),
        skill.sourceLanguage,
        skill.risk,
        skill.license,
        skill.sourceUrl,
        skill.skillUrl,
        skill.contentHash,
        skill.checkedAt,
        skill.installs,
        skill.r2Key,
      ),
    );
    await env.DB.batch(chunk);
  }
}

async function activateVersion(
  env: Env,
  versionId: string,
  previousVersionId: string | null,
) {
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  if (previousVersionId) {
    statements.push(
      env.DB.prepare(
        `UPDATE index_versions SET status = 'ready'
         WHERE version_id = ? AND status = 'active'`,
      ).bind(previousVersionId),
    );
  }
  statements.push(
    env.DB.prepare(
      `UPDATE index_versions SET status = 'active', activated_at = ?
       WHERE version_id = ? AND status = 'ready'`,
    ).bind(timestamp, versionId),
    env.DB.prepare(
      `INSERT INTO active_index (singleton, version_id, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         version_id = excluded.version_id,
         updated_at = excluded.updated_at`,
    ).bind(versionId, timestamp),
  );
  await env.DB.batch(statements);
}

async function storeRawContent(env: Env, skills: IndexedSkill[]) {
  for (const skill of skills) {
    if (!skill.rawContent) continue;
    await env.SNAPSHOTS.put(skill.r2Key, skill.rawContent, {
      httpMetadata: { contentType: "text/markdown; charset=utf-8" },
      customMetadata: {
        sha256: skill.contentHash,
        repository: skill.repository,
        path: skill.skillPath,
      },
    });
  }
}

async function countMissingR2Objects(env: Env, skills: IndexedSkill[]) {
  const checks = await mapLimit(skills, 8, (skill) => env.SNAPSHOTS.head(skill.r2Key));
  return checks.filter((object) => !object).length;
}

async function recordSyncRun(
  env: Env,
  input: {
    runId: string;
    reason: SyncReason;
    status: string;
    startedAt: string;
    finishedAt: string;
    versionId?: string | null;
    detail?: unknown;
  },
) {
  await env.DB.prepare(
    `INSERT INTO sync_runs (
       run_id, reason, status, started_at, finished_at, version_id, detail_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.runId,
      input.reason,
      input.status,
      input.startedAt,
      input.finishedAt,
      input.versionId || null,
      JSON.stringify(input.detail || {}),
    )
    .run();
}

export async function runSync(env: Env, reason: SyncReason) {
  const startedAt = nowIso();
  const runId = crypto.randomUUID();
  const active = await activeVersion(env);
  const previousSkills = active ? await snapshotSkills(env, active.version_id) : [];
  const sources: SourceName[] = reason === "full" ? ["skills.sh", "github"] : [reason];
  const attempts = await Promise.all(sources.map((source) => attemptSource(env, source)));
  const succeeded = attempts.filter((attempt) => attempt.succeeded);

  if (!succeeded.length) {
    await recordSyncRun(env, {
      runId,
      reason,
      status: active ? "preserved" : "failed",
      startedAt,
      finishedAt: nowIso(),
      versionId: active?.version_id,
      detail: { attempts },
    });
    if (active) {
      return {
        ok: true,
        status: "preserved",
        activeVersion: active.version_id,
        reason: "all_requested_sources_unavailable",
      };
    }
    throw new Error("initial_sync_failed");
  }

  const succeededSources = new Set(succeeded.map((attempt) => attempt.source));
  const preserved = previousSkills.filter((skill) => !succeededSources.has(skill.source));
  const skills = deduplicateSkills([
    ...preserved,
    ...succeeded.flatMap((attempt) => attempt.skills),
  ]);
  const preservedDiscovered = preserved.length;
  const discoveredCount =
    preservedDiscovered + succeeded.reduce((total, attempt) => total + attempt.discovered, 0);
  const parsedCount =
    preservedDiscovered + succeeded.reduce((total, attempt) => total + attempt.skills.length, 0);
  const versionId = await versionIdFor(reason);
  const builtAt = nowIso();
  const manifestKey = `versions/${versionId}/manifest.json`;

  await storeRawContent(env, skills);
  const missingR2Objects = await countMissingR2Objects(env, skills);
  const quality = evaluateSnapshotQuality({
    previousCount: active?.skill_count || 0,
    skillCount: skills.length,
    discoveredCount,
    parsedCount,
    missingR2Objects,
  });

  if (!quality.accepted) {
    await insertVersion(env, {
      versionId,
      status: "rejected",
      reason,
      builtAt,
      previousVersionId: active?.version_id || null,
      skillCount: skills.length,
      discoveredCount,
      parsedCount,
      manifestKey: null,
      failureReason: quality.errors.join(","),
    });
    await recordSyncRun(env, {
      runId,
      reason,
      status: "rejected",
      startedAt,
      finishedAt: nowIso(),
      versionId,
      detail: { attempts, quality },
    });
    return { ok: false, status: "rejected", activeVersion: active?.version_id || null, quality };
  }

  const manifest = {
    product: "Bitcase",
    schemaVersion: 1,
    versionId,
    rankerVersion: RANKER_VERSION,
    builtAt,
    previousVersionId: active?.version_id || null,
    sources: attempts.map((attempt) => ({
      source: attempt.source,
      attempted: attempt.attempted,
      succeeded: attempt.succeeded,
      discovered: attempt.discovered,
      error: attempt.error || null,
    })),
    quality,
    skills: skills.map((skill) => ({
      id: skill.id,
      repository: skill.repository,
      commitSha: skill.commitSha,
      skillPath: skill.skillPath,
      license: skill.license,
      contentHash: skill.contentHash,
      checkedAt: skill.checkedAt,
      r2Key: skill.r2Key,
    })),
  };
  await env.SNAPSHOTS.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  await insertVersion(env, {
    versionId,
    status: "building",
    reason,
    builtAt,
    previousVersionId: active?.version_id || null,
    skillCount: skills.length,
    discoveredCount,
    parsedCount,
    manifestKey,
  });
  await persistSkills(env, versionId, skills);
  await env.DB.prepare(`UPDATE index_versions SET status = 'ready' WHERE version_id = ?`)
    .bind(versionId)
    .run();
  await activateVersion(env, versionId, active?.version_id || null);
  await recordSyncRun(env, {
    runId,
    reason,
    status: "active",
    startedAt,
    finishedAt: nowIso(),
    versionId,
    detail: { attempts, quality },
  });
  return { ok: true, status: "active", activeVersion: versionId, quality };
}

function projectPlan(query: string) {
  const matched = CAPABILITIES.filter((capability) => capability.patterns.test(query));
  const capabilityIds = new Set(matched.map((capability) => capability.id));
  if (/(skill|skills|技能)/i.test(query)) {
    ["skill-intake", "skill-discovery", "persistence", "frontend", "backend", "security", "testing"].forEach(
      (id) => capabilityIds.add(id),
    );
  }
  if (/(instrument|scpi|visa|gpib|keysight|keithley|fluke|仪器|万用表|源表|半参)/i.test(query)) {
    ["instrument", "automation", "data", "engineering", "testing"].forEach((id) => capabilityIds.add(id));
  }
  if (!capabilityIds.size) {
    capabilityIds.add("engineering");
    capabilityIds.add("testing");
  }
  const capabilities = CAPABILITIES.filter((capability) => capabilityIds.has(capability.id)).sort(
    (first, second) => second.priority - first.priority || first.id.localeCompare(second.id),
  );
  const kindLabel = capabilityIds.has("instrument")
    ? "仪器自动化与数据采集"
    : capabilityIds.has("skill-discovery")
      ? "Skill 库与推荐产品"
      : capabilityIds.has("data")
        ? "数据处理工作流"
        : capabilityIds.has("frontend") || capabilityIds.has("backend")
          ? "Web 应用"
          : "工程项目";
  return { kindLabel, capabilities };
}

function stableLibrarySkills(value: unknown): IndexedSkill[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const skill = item as Record<string, unknown>;
    const required = [
      "id",
      "name",
      "description",
      "originalDescription",
      "source",
      "sourceUrl",
      "skillUrl",
      "skillPath",
      "contentHash",
      "checkedAt",
    ];
    if (required.some((key) => typeof skill[key] !== "string")) return [];
    const sourceUrl = String(skill.sourceUrl);
    const skillUrl = String(skill.skillUrl);
    if (!sourceUrl.startsWith("https://github.com/") || !skillUrl.startsWith("https://github.com/")) return [];
    const capabilities = Array.isArray(skill.capabilities)
      ? skill.capabilities.filter((capability): capability is string => typeof capability === "string")
      : [];
    const capabilityIds = CAPABILITIES.filter((definition) =>
      capabilities.some((capability) => definition.patterns.test(capability)),
    ).map((definition) => definition.id);
    return [
      {
        id: String(skill.id),
        source: "github" as const,
        sourceRef: sourceUrl,
        repository: String(skill.source),
        commitSha: "library",
        defaultBranch: "library",
        skillPath: String(skill.skillPath),
        name: String(skill.name),
        description: String(skill.originalDescription),
        searchText: normalizeQuery(
          `${skill.name}\n${skill.description}\n${skill.originalDescription}\n${capabilities.join("\n")}`,
        ),
        capabilityIds: capabilityIds.length ? capabilityIds : ["engineering"],
        sourceLanguage: ["zh", "en", "ja", "mixed"].includes(String(skill.sourceLanguage))
          ? (skill.sourceLanguage as SourceLanguage)
          : languageOf(String(skill.originalDescription)),
        risk: skill.risk === "review" ? "review" : "clear",
        license: null,
        sourceUrl,
        skillUrl,
        contentHash: String(skill.contentHash),
        checkedAt: String(skill.checkedAt),
        installs: null,
        r2Key: `library/${skill.contentHash}`,
      },
    ];
  });
}

export function rankSnapshot(
  query: string,
  snapshot: IndexedSkill[],
  library: IndexedSkill[] = [],
) {
  const plan = projectPlan(query);
  const tokens = tokenize(query);
  const libraryIds = new Set(library.map((skill) => skill.id));
  const merged = new Map(deduplicateSkills(snapshot).map((skill) => [skill.id, skill]));
  for (const skill of library) merged.set(skill.id, skill);
  const candidates = Array.from(merged.values()).map((skill) => {
    const name = normalizeQuery(skill.name);
    const description = normalizeQuery(skill.description);
    const searchText = skill.searchText;
    const covered = plan.capabilities.filter((capability) => skill.capabilityIds.includes(capability.id));
    const tokenScore = tokens.reduce((total, token) => {
      if (name.includes(token)) return total + 12;
      if (description.includes(token)) return total + 6;
      if (searchText.includes(token)) return total + 2;
      return total;
    }, 0);
    const capabilityScore = covered.reduce((total, capability) => total + capability.priority * 5, 0);
    const installScore = Math.min(4, Math.log10((skill.installs || 0) + 1));
    const libraryScore = libraryIds.has(skill.id) ? 8 : 0;
    return { skill, covered, baseScore: tokenScore + capabilityScore + installScore + libraryScore };
  });

  const selected: typeof candidates = [];
  const uncovered = new Set(plan.capabilities.map((capability) => capability.id));
  const remaining = candidates.filter((candidate) => candidate.baseScore > 0);
  while (remaining.length && selected.length < 6) {
    remaining.sort((first, second) => {
      const firstBonus = first.covered.reduce(
        (total, capability) => total + (uncovered.has(capability.id) ? capability.priority * 20 : 0),
        0,
      );
      const secondBonus = second.covered.reduce(
        (total, capability) => total + (uncovered.has(capability.id) ? capability.priority * 20 : 0),
        0,
      );
      return (
        second.baseScore + secondBonus - (first.baseScore + firstBonus) ||
        first.skill.name.localeCompare(second.skill.name) ||
        first.skill.id.localeCompare(second.skill.id)
      );
    });
    const candidate = remaining.shift()!;
    if (!candidate.covered.some((capability) => uncovered.has(capability.id)) && selected.length > 0) continue;
    selected.push(candidate);
    candidate.covered.forEach((capability) => uncovered.delete(capability.id));
  }

  const coveredLabels = plan.capabilities
    .filter((capability) => !uncovered.has(capability.id))
    .map((capability) => capability.label);
  const missingLabels = plan.capabilities
    .filter((capability) => uncovered.has(capability.id))
    .map((capability) => capability.label);
  return {
    project: query,
    plan: {
      kindLabel: plan.kindLabel,
      responsibilities: plan.capabilities.map((capability) => capability.label),
    },
    coverage: { covered: coveredLabels, missing: missingLabels },
    skills: selected.map(({ skill, covered }) => {
      const capabilityLabels = skill.capabilityIds
        .map((id) => CAPABILITIES.find((capability) => capability.id === id)?.label)
        .filter((label): label is string => Boolean(label));
      const responsibility = covered[0]?.label || capabilityLabels[0] || "工程实现";
      return {
        id: skill.id,
        name: skill.name,
        description:
          skill.sourceLanguage === "zh"
            ? skill.description
            : `用于${capabilityLabels.slice(0, 3).join("、") || responsibility}。原始说明：${skill.description}`,
        originalDescription: skill.description,
        responsibility,
        matchReason: `活动索引中的内容证据覆盖「${covered.map((capability) => capability.label).join("、") || responsibility}」。`,
        capabilities: capabilityLabels,
        sourceLanguage: skill.sourceLanguage,
        source: skill.repository,
        sourceUrl: skill.sourceUrl,
        skillUrl: skill.skillUrl,
        skillPath: skill.skillPath,
        contentHash: skill.contentHash,
        checkedAt: skill.checkedAt,
        risk: skill.risk,
        discovery: {
          source: libraryIds.has(skill.id) ? "library" : skill.source,
          ...(skill.installs ? { installs: skill.installs } : {}),
        },
      };
    }),
  };
}

function allowedOrigins(env: Env) {
  if (!env.ALLOWED_ORIGINS) return [];
  try {
    const parsed = JSON.parse(env.ALLOWED_ORIGINS);
    if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function corsHeaders(request: Request, env: Env) {
  const headers = new Headers({
    vary: "origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins(env).includes(origin)) headers.set("access-control-allow-origin", origin);
  return headers;
}

function originAllowed(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins(env).includes(origin);
}

async function readBody(request: Request, maximumBytes: number) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximumBytes) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function secureEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  return leftHash === rightHash;
}

async function isAdmin(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.SYNC_ADMIN_SECRET && token && (await secureEqual(token, env.SYNC_ADMIN_SECRET)));
}

function searchCache() {
  return (globalThis.caches as CacheStorage & { default?: Cache } | undefined)?.default;
}

async function handleSearch(request: Request, env: Env) {
  if (!originAllowed(request, env)) return json({ error: "forbidden_origin" }, { status: 403 });
  const body = await readBody(request, 96_000);
  const candidate = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const queryValue = typeof candidate.query === "string" ? candidate.query : candidate.brief;
  const query = typeof queryValue === "string" ? queryValue.trim() : "";
  if (query.length < 6 || query.length > 800) return json({ error: "invalid_query" }, { status: 400 });
  const active = await activeVersion(env);
  if (!active) return json({ error: "index_not_ready" }, { status: 503 });
  const library = stableLibrarySkills(candidate.library);
  const libraryFingerprint = await sha256(
    JSON.stringify(library.map((skill) => [skill.id, skill.contentHash]).sort()),
  );
  const cacheKeyHash = await sha256(`${active.version_id}\n${active.ranker_version}\n${normalizeQuery(query)}\n${libraryFingerprint}`);
  const cacheRequest = new Request(`https://cache.bitcase.internal/search/${cacheKeyHash}`, {
    method: "GET",
  });
  const cache = searchCache();
  const cached = await cache?.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    corsHeaders(request, env).forEach((value, key) => headers.set(key, value));
    headers.set("x-bitcase-cache", "hit");
    return new Response(cached.body, { status: cached.status, headers });
  }
  const skills = await snapshotSkills(env, active.version_id);
  const result = rankSnapshot(query, skills, library);
  const response = json(
    {
      ...result,
      search: {
        strategy: "active-snapshot",
        catalogCandidates: skills.length,
        githubFallbackUsed: false,
        indexVersion: active.version_id,
        rankerVersion: active.ranker_version,
        builtAt: active.built_at,
      },
    },
    {
      headers: {
        "cache-control": `public, max-age=${SEARCH_CACHE_SECONDS}, stale-while-revalidate=86400`,
        "x-bitcase-index-version": active.version_id,
        ...Object.fromEntries(corsHeaders(request, env)),
      },
    },
  );
  await cache?.put(cacheRequest, response.clone());
  return response;
}

async function handleStatus(request: Request, env: Env) {
  const active = await activeVersion(env);
  const states = await env.DB.prepare(
    `SELECT source, status, consecutive_failures, circuit_open_until,
            last_attempt_at, last_success_at, last_error
     FROM source_state ORDER BY source`,
  ).all<Record<string, unknown>>();
  return json(
    {
      ok: true,
      active: active || null,
      sources: states.results || [],
    },
    { headers: Object.fromEntries(corsHeaders(request, env)) },
  );
}

async function rollback(env: Env, requestedVersionId?: string) {
  const current = await activeVersion(env);
  if (!current) throw new Error("index_not_ready");
  let target: { version_id: string } | null = null;
  if (requestedVersionId) {
    target = await env.DB.prepare(
      `SELECT version_id FROM index_versions
       WHERE version_id = ? AND status IN ('ready', 'active')`,
    )
      .bind(requestedVersionId)
      .first<{ version_id: string }>();
  } else {
    target = await env.DB.prepare(
      `SELECT version_id FROM index_versions
       WHERE status = 'ready' AND version_id != ?
       ORDER BY built_at DESC LIMIT 1`,
    )
      .bind(current.version_id)
      .first<{ version_id: string }>();
  }
  if (!target) throw new Error("rollback_target_not_found");
  await activateVersion(env, target.version_id, current.version_id);
  return { ok: true, previousVersion: current.version_id, activeVersion: target.version_id };
}

export function cronReason(cron: string): SyncReason | null {
  if (cron === "0 */6 * * *") return "skills.sh";
  if (cron === "30 */12 * * *") return "github";
  if (cron === "15 2 * * *") return "full";
  return null;
}

async function handleRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (!originAllowed(request, env)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true, service: "bitcase-index-worker", rankerVersion: RANKER_VERSION });
  }
  if (url.pathname === "/api/index/status" && request.method === "GET") {
    if (!originAllowed(request, env)) return json({ error: "forbidden_origin" }, { status: 403 });
    return handleStatus(request, env);
  }
  if (url.pathname === "/api/search" && request.method === "POST") {
    return handleSearch(request, env);
  }
  if (url.pathname.startsWith("/api/admin/")) {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
    if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, { status: 401 });
    if (url.pathname === "/api/admin/rollback") {
      const body = await readBody(request, 4096);
      const versionId =
        body && typeof body === "object" && typeof (body as { versionId?: unknown }).versionId === "string"
          ? (body as { versionId: string }).versionId
          : undefined;
      try {
        return json(await rollback(env, versionId));
      } catch (error) {
        return json({ error: errorMessage(error) }, { status: 409 });
      }
    }
    const match = url.pathname.match(/^\/api\/admin\/sync\/(skills|github|full)$/);
    if (match) {
      const reason: SyncReason = match[1] === "skills" ? "skills.sh" : (match[1] as SyncReason);
      try {
        return json(await runSync(env, reason));
      } catch (error) {
        return json({ error: errorMessage(error) }, { status: 502 });
      }
    }
  }
  return json({ error: "not_found" }, { status: 404 });
}

const indexWorker = {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
  scheduled(
    controller: { cron: string },
    env: Env,
    ctx: ExecutionContext,
  ) {
    const reason = cronReason(controller.cron);
    if (reason) ctx.waitUntil(runSync(env, reason));
  },
};

export default indexWorker;
export { RANKER_VERSION };

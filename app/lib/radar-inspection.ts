export type RadarInspectionStatus =
  | "clean"
  | "warning"
  | "blocked"
  | "missing";

export type RadarInspectionResult = {
  status: RadarInspectionStatus;
  skillPath: string | null;
  notes?: string[];
  contentHash?: string;
  description?: string;
  fileCount: number;
  inspectedFileCount: number;
  inspectionComplete: boolean;
  skillFiles: RadarInspectedSkill[];
  readmePath?: string;
  profile: RadarSourceProfile;
};

export type RadarInspectedSkill = {
  path: string;
  name: string;
  description?: string;
  status: Exclude<RadarInspectionStatus, "missing">;
  notes: string[];
  findings: RadarSafetyFinding[];
  contentHash: string;
  truncated?: boolean;
  profile: RadarSourceProfile;
};

export type RadarSafetyFinding = {
  code: string;
  severity: "review" | "blocked";
  line: number | null;
  excerpt: string;
};

export type RadarSourceProfile = {
  overview: string;
  capabilities: string[];
  useWhen: string[];
  workflow: string[];
  requirements: string[];
  limitations: string[];
  examples: string[];
};

export type RadarIntakePlan = {
  usableFiles: RadarInspectedSkill[];
  blockedFiles: RadarInspectedSkill[];
  reviewFiles: RadarInspectedSkill[];
  requiresRepositoryReview: boolean;
};

export type RadarInspectionErrorCode =
  | "invalid_repo"
  | "rate_limited"
  | "private_or_unavailable"
  | "skill_too_large"
  | "github_unavailable";

export class RadarInspectionError extends Error {
  readonly code: RadarInspectionErrorCode;
  readonly httpStatus: number;
  readonly retryAt?: string;

  constructor(
    code: RadarInspectionErrorCode,
    httpStatus: number,
    retryAt?: string,
  ) {
    super(code);
    this.name = "RadarInspectionError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAt = retryAt;
  }
}

export function planSkillIntake(
  inspection: {
    skillFiles: RadarInspectedSkill[];
    inspectionComplete?: boolean;
  },
): RadarIntakePlan {
  const blockedFiles = inspection.skillFiles.filter(
    (skill) => skill.status === "blocked" || skill.truncated,
  );
  const usableFiles = inspection.skillFiles.filter(
    (skill) => skill.status !== "blocked" && !skill.truncated,
  );
  const reviewFiles = usableFiles.filter(
    (skill) =>
      skill.status === "warning" || inspection.inspectionComplete === false,
  );
  return {
    usableFiles,
    blockedFiles,
    reviewFiles,
    requiresRepositoryReview: inspection.inspectionComplete === false,
  };
}

type GithubSkillTarget = {
  fullName: string;
  defaultBranch?: string;
  locale?: string;
};

type GithubTree = {
  truncated?: boolean;
  tree?: Array<{ path?: string; type?: string }>;
};

type InspectOptions = {
  githubToken?: string;
  fetcher?: typeof fetch;
};

const MAX_SKILL_BYTES = 512 * 1024;
const MAX_README_BYTES = 768 * 1024;
const MAX_TREE_RESPONSE_BYTES = 24 * 1024 * 1024;
const MAX_SKILL_FILES = 96;
const SKILL_FETCH_CONCURRENCY = 6;
const GITHUB_API_VERSION = "2026-03-10";
const REPOSITORY_PATTERN =
  /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/;
const SUPPORTED_LOCALES = new Set([
  "zh-CN",
  "zh-TW",
  "en",
  "ja",
  "fr",
  "es",
]);

export function validateGithubSkillTarget(
  value: unknown,
): GithubSkillTarget | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const fullName =
    typeof candidate.fullName === "string" ? candidate.fullName.trim() : "";
  const defaultBranch =
    typeof candidate.defaultBranch === "string"
      ? candidate.defaultBranch.trim()
      : "main";
  const locale =
    typeof candidate.locale === "string" &&
    SUPPORTED_LOCALES.has(candidate.locale)
      ? candidate.locale
      : "en";
  if (
    !REPOSITORY_PATTERN.test(fullName) ||
    !BRANCH_PATTERN.test(defaultBranch) ||
    defaultBranch.includes("..") ||
    defaultBranch.startsWith("/") ||
    defaultBranch.endsWith("/")
  ) {
    return null;
  }
  return { fullName, defaultBranch, locale };
}

export async function inspectGithubSkill(
  target: GithubSkillTarget,
  options: InspectOptions = {},
): Promise<RadarInspectionResult> {
  const validated = validateGithubSkillTarget(target);
  if (!validated) {
    throw new RadarInspectionError("invalid_repo", 400);
  }

  const fetcher = options.fetcher || fetch;
  const branch = validated.defaultBranch || "main";
  const [owner, repository] = validated.fullName.split("/");
  const repositoryBase = `https://api.github.com/repos/${encodeURIComponent(
    owner,
  )}/${encodeURIComponent(repository)}`;
  const apiHeaders = githubHeaders(options.githubToken);
  const rawHeaders = new Headers({
    Accept: "text/plain",
    "User-Agent": "Bitcase-Radar-Alpha",
  });
  const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(
    owner,
  )}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}`;
  const treeResponse = await fetchGithub(
    fetcher,
    `${repositoryBase}/git/trees/${encodeURIComponent(
      branch,
    )}?recursive=1`,
    apiHeaders,
  );

  let skillPaths: string[] = [];
  if (treeResponse.status === 404) {
    const rootResponse = await fetchGithub(
      fetcher,
      `${rawBase}/SKILL.md`,
      rawHeaders,
    );
    if (rootResponse.status === 404) {
      throw new RadarInspectionError("private_or_unavailable", 404);
    }
    ensureReadableGithubResponse(rootResponse);
    const skillFile = await inspectSkillResponse("SKILL.md", rootResponse);
    return summarizeSkillFiles([skillFile]);
  }

  ensureReadableGithubResponse(treeResponse);
  const declaredTreeSize = Number(
    treeResponse.headers.get("content-length") || 0,
  );
  if (declaredTreeSize > MAX_TREE_RESPONSE_BYTES) {
    return inspectOversizedRepository(
      fetcher,
      rawBase,
      rawHeaders,
      validated.locale || "en",
      "repository-tree-too-large",
    );
  }

  const tree = await readGithubJson<GithubTree>(treeResponse);
  const treePaths = (tree.tree || [])
    .filter(
      (item) => item.type === "blob" && typeof item.path === "string",
    )
    .map((item) => item.path as string);
  skillPaths = (tree.tree || [])
    .filter(
      (item) =>
        item.type === "blob" &&
        typeof item.path === "string" &&
        /(^|\/)SKILL\.md$/i.test(item.path),
    )
    .map((item) => item.path as string)
    .sort((a, b) => {
      const depthDifference = a.split("/").length - b.split("/").length;
      return depthDifference || a.localeCompare(b);
    });

  const readmePath = chooseReadmePath(
    treePaths,
    validated.locale || "en",
  );
  let readmeProfile: RadarSourceProfile | undefined;
  if (readmePath) {
    const encodedReadmePath = readmePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const readmeResponse = await fetchGithub(
      fetcher,
      `${rawBase}/${encodedReadmePath}`,
      rawHeaders,
    );
    if (readmeResponse.ok) {
      const readme = await readLimitedText(
        readmeResponse,
        MAX_README_BYTES,
      );
      readmeProfile = extractSkillProfileFromMarkdown(readme.text);
      if (readme.truncated) {
        readmeProfile.limitations = takeFacts(
          [
            ...readmeProfile.limitations,
            "README was partially read because it exceeded Bitcase's safe preview limit.",
          ],
          4,
        );
      }
    }
  }

  if (!skillPaths.length) {
    return {
      status: "missing",
      skillPath: null,
      ...(tree.truncated
        ? { notes: ["repository-tree-partial"] }
        : {}),
      fileCount: 0,
      inspectedFileCount: 0,
      inspectionComplete: !tree.truncated,
      skillFiles: [],
      ...(readmePath ? { readmePath } : {}),
      profile: readmeProfile || emptySourceProfile(),
    };
  }

  const selectedSkillPaths = skillPaths.slice(0, MAX_SKILL_FILES);
  const skillFiles = await inspectSkillPaths(
    selectedSkillPaths,
    fetcher,
    rawBase,
    rawHeaders,
  );
  const inspectionComplete =
    !tree.truncated &&
    selectedSkillPaths.length === skillPaths.length &&
    skillFiles.every((skill) => !skill.truncated);

  return summarizeSkillFiles(skillFiles, readmeProfile, readmePath, {
    discoveredFileCount: skillPaths.length,
    inspectionComplete,
    notes: [
      ...(tree.truncated ? ["repository-tree-partial"] : []),
      ...(skillPaths.length > selectedSkillPaths.length
        ? ["skill-file-limit-reached"]
        : []),
    ],
  });
}

async function inspectSkillPaths(
  skillPaths: string[],
  fetcher: typeof fetch,
  rawBase: string,
  rawHeaders: Headers,
): Promise<RadarInspectedSkill[]> {
  const skillFiles: RadarInspectedSkill[] = [];
  for (
    let index = 0;
    index < skillPaths.length;
    index += SKILL_FETCH_CONCURRENCY
  ) {
    const batch = skillPaths.slice(
      index,
      index + SKILL_FETCH_CONCURRENCY,
    );
    const inspected = await Promise.all(
      batch.map(async (skillPath) => {
        const encodedPath = skillPath
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const response = await fetchGithub(
          fetcher,
          `${rawBase}/${encodedPath}`,
          rawHeaders,
        );
        if (response.status === 404) {
          throw new RadarInspectionError(
            "private_or_unavailable",
            404,
          );
        }
        ensureReadableGithubResponse(response);
        return inspectSkillResponse(skillPath, response);
      }),
    );
    skillFiles.push(...inspected);
  }
  return skillFiles;
}

async function inspectSkillResponse(
  skillPath: string,
  response: Response,
): Promise<RadarInspectedSkill> {
  const source = await readLimitedText(response, MAX_SKILL_BYTES);
  const text = source.text;
  const notes: string[] = [];
  const findings: RadarSafetyFinding[] = [];

  function addFinding(
    code: string,
    severity: RadarSafetyFinding["severity"],
    pattern?: RegExp,
    fallbackExcerpt = "",
  ) {
    const match = pattern?.exec(text);
    const index = match?.index ?? -1;
    const line =
      index >= 0 ? text.slice(0, index).split(/\r?\n/).length : null;
    const excerpt =
      index >= 0
        ? text
            .slice(index, index + 220)
            .split(/\r?\n/)[0]
            .trim()
        : fallbackExcerpt;
    notes.push(code);
    findings.push({
      code,
      severity,
      line,
      excerpt: excerpt.slice(0, 220),
    });
  }

  if (!/^---[\s\S]*?\bname\s*:/m.test(text)) {
    addFinding("missing-name", "review", undefined, "frontmatter.name");
  }
  if (!/^---[\s\S]*?\bdescription\s*:/m.test(text)) {
    addFinding(
      "missing-description",
      "review",
      undefined,
      "frontmatter.description",
    );
  }
  if (source.truncated) {
    addFinding(
      "skill-content-truncated",
      "blocked",
      undefined,
      "SKILL.md exceeds the safe inspection limit",
    );
  }

  const securityContext =
    /(security|scanner|scan |audit|review|detect|prompt injection|安全|审计|審計|検査)/i.test(
      text.slice(0, 4000),
    );
  const directOverridePattern =
    /(ignore (all |any )?previous instructions|disregard (all |any )?prior|new system prompt|override the system)/i;
  const credentialTargetPattern =
    /(~\/\.ssh|\.aws\/credentials|authorized_keys|\.git-credentials|api[_ -]?key|secret[_ -]?token)/i;
  const outboundExecutionPattern =
    /(curl|wget|requests?\.(post|put)|fetch\s*\(|webhook|socket\.connect|postinstall|eval\s*\(|exec\s*\()/i;
  const reviewExecutionPattern =
    /(postinstall|eval\s*\(|exec\s*\(|curl[^<\n]*https?:\/\/)/i;
  const directOverride =
    directOverridePattern.test(text) && !securityContext;
  const credentialTarget = credentialTargetPattern.test(text);
  const outboundExecution = outboundExecutionPattern.test(text);
  const dangerous = directOverride || (credentialTarget && outboundExecution);

  if (directOverride) {
    addFinding("instruction-override", "blocked", directOverridePattern);
  }
  if (credentialTarget && outboundExecution) {
    addFinding(
      "credential-exfiltration-risk",
      "blocked",
      credentialTargetPattern,
    );
  } else if (reviewExecutionPattern.test(text)) {
    addFinding(
      "execution-needs-review",
      "review",
      reviewExecutionPattern,
    );
  }

  return {
    status:
      dangerous || source.truncated
        ? "blocked"
        : notes.length
          ? "warning"
          : "clean",
    path: skillPath,
    name: frontmatterName(text) || fallbackSkillName(skillPath),
    notes,
    findings,
    contentHash: await sha256(
      source.truncated ? `${text}\n[BITCASE_TRUNCATED]` : text,
    ),
    description: frontmatterDescription(text),
    ...(source.truncated ? { truncated: true } : {}),
    profile: extractSkillProfileFromMarkdown(
      text,
      frontmatterDescription(text),
    ),
  };
}

function summarizeSkillFiles(
  skillFiles: RadarInspectedSkill[],
  readmeProfile?: RadarSourceProfile,
  readmePath?: string,
  options: {
    discoveredFileCount?: number;
    inspectionComplete?: boolean;
    notes?: string[];
  } = {},
): RadarInspectionResult {
  const inspectionComplete =
    options.inspectionComplete ??
    skillFiles.every((skill) => !skill.truncated);
  const baseStatus: RadarInspectionStatus = skillFiles.some(
    (skill) => skill.status === "blocked",
  )
    ? "blocked"
    : skillFiles.some((skill) => skill.status === "warning")
      ? "warning"
      : "clean";
  const status: RadarInspectionStatus =
    !inspectionComplete && baseStatus === "clean"
      ? "warning"
      : baseStatus;
  const notes = Array.from(
    new Set([
      ...skillFiles.flatMap((skill) => skill.notes),
      ...(options.notes || []),
    ]),
  );
  const primary = skillFiles[0];
  return {
    status,
    skillPath: primary?.path || null,
    notes,
    contentHash: primary?.contentHash,
    description: primary?.description,
    fileCount:
      options.discoveredFileCount ?? skillFiles.length,
    inspectedFileCount: skillFiles.length,
    inspectionComplete,
    skillFiles,
    ...(readmePath ? { readmePath } : {}),
    profile: mergeSourceProfiles(
      skillFiles.map((skill) => skill.profile),
      readmeProfile,
    ),
  };
}

export function extractSkillProfileFromMarkdown(
  text: string,
  declaredOverview = "",
): RadarSourceProfile {
  const normalized = text
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/m, "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n");
  const sections = parseMarkdownSections(normalized);
  const allLines = normalized.split(/\r?\n/);
  const overview =
    cleanFact(declaredOverview) ||
    firstParagraph(normalized) ||
    "";
  const capabilities = sectionFacts(sections, [
    /features?/i,
    /capabilit/i,
    /what (it|this).*(does|provides)/i,
    /goals?/i,
    /能力|功能|特性|できること|fonctionnalit|caracter[ií]sticas/i,
  ]);
  const useWhen = sectionFacts(sections, [
    /when to use/i,
    /use cases?/i,
    /triggers?/i,
    /best for/i,
    /适用|使用场景|何時使う|cas d.?usage|cuándo usar/i,
  ]);
  const workflow = sectionFacts(sections, [
    /workflow/i,
    /how it works/i,
    /process/i,
    /steps?/i,
    /usage/i,
    /工作流|使用方法|流程|使い方|fonctionnement|flujo/i,
  ]);
  const requirements = sectionFacts(sections, [
    /requirements?/i,
    /prerequisites?/i,
    /install/i,
    /setup/i,
    /dependencies/i,
    /配置|安装|依赖|要件|prérequis|requisitos/i,
  ]);
  const limitations = sectionFacts(sections, [
    /limitations?/i,
    /out of scope/i,
    /not for/i,
    /guardrails?/i,
    /caveats?/i,
    /security/i,
    /限制|不适用|安全|制約|limites?|seguridad/i,
  ]);
  const examples = sectionFacts(sections, [
    /examples?/i,
    /sample/i,
    /例子|示例|例|exemples?|ejemplos?/i,
  ]);

  return {
    overview,
    capabilities: takeFacts(
      capabilities.length
        ? capabilities
        : fallbackFacts(allLines, /(^[-*+]\s+)|capab|support|provide|allow/i),
      5,
    ),
    useWhen: takeFacts(
      useWhen.length
        ? useWhen
        : fallbackFacts(
            allLines,
            /when |use (this|it)|best for|适合|用于|useful for/i,
          ),
      4,
    ),
    workflow: takeFacts(
      workflow.length
        ? workflow
        : fallbackFacts(allLines, /^\s*\d+[.)]\s+/),
      5,
    ),
    requirements: takeFacts(
      requirements.length
        ? requirements
        : fallbackFacts(
            allLines,
            /\b(required?|install|setup|npm|npx|pip|docker|api key|token|git clone|submodule)\b/i,
          ),
      4,
    ),
    limitations: takeFacts(
      limitations.length
        ? limitations
        : fallbackFacts(
            allLines,
            /\b(must not|do not|avoid|unsupported|limitation|requires? review|risk)\b|不应|不要|限制/i,
          ),
      4,
    ),
    examples: takeFacts(examples, 3),
  };
}

function parseMarkdownSections(text: string) {
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current = { heading: "", lines: [] as string[] };
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (current.heading || current.lines.length) sections.push(current);
      current = { heading: cleanFact(heading[1]), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.heading || current.lines.length) sections.push(current);
  return sections;
}

function sectionFacts(
  sections: Array<{ heading: string; lines: string[] }>,
  patterns: RegExp[],
) {
  return sections
    .filter((section) =>
      patterns.some((pattern) => pattern.test(section.heading)),
    )
    .flatMap((section) => factsFromLines(section.lines));
}

function factsFromLines(lines: string[]) {
  const facts: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const value = cleanFact(paragraph.join(" "));
    if (value) facts.push(value);
    paragraph = [];
  };
  for (const line of lines) {
    const listItem = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (listItem) {
      flush();
      const value = cleanFact(listItem[1]);
      if (value) facts.push(value);
    } else if (!line.trim()) {
      flush();
    } else if (
      !/^\s*(?:[>|]|!\[|<|---|\|)/.test(line) &&
      !/^\s{4,}\S/.test(line)
    ) {
      paragraph.push(line.trim());
    }
  }
  flush();
  return facts;
}

function fallbackFacts(lines: string[], matcher: RegExp) {
  return lines
    .filter((line) => matcher.test(line))
    .map((line) => cleanFact(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")))
    .filter(Boolean);
}

function firstParagraph(text: string) {
  return (
    text
      .split(/\n\s*\n/)
      .map(cleanFact)
      .find(
        (paragraph) =>
          paragraph.length >= 24 &&
          !paragraph.startsWith("#") &&
          !/^(table of contents|contents)$/i.test(paragraph),
      ) || ""
  );
}

function cleanFact(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

function takeFacts(values: string[], limit: number) {
  return Array.from(
    new Set(values.filter((value) => value.length >= 6 && value.length <= 360)),
  ).slice(0, limit);
}

function emptySourceProfile(): RadarSourceProfile {
  return {
    overview: "",
    capabilities: [],
    useWhen: [],
    workflow: [],
    requirements: [],
    limitations: [],
    examples: [],
  };
}

function mergeSourceProfiles(
  skillProfiles: RadarSourceProfile[],
  readmeProfile?: RadarSourceProfile,
): RadarSourceProfile {
  const profiles = [...skillProfiles, ...(readmeProfile ? [readmeProfile] : [])];
  const merge = (key: keyof Omit<RadarSourceProfile, "overview">, limit: number) =>
    takeFacts(profiles.flatMap((profile) => profile[key]), limit);
  return {
    overview:
      skillProfiles.find((profile) => profile.overview)?.overview ||
      readmeProfile?.overview ||
      "",
    capabilities: merge("capabilities", 6),
    useWhen: merge("useWhen", 5),
    workflow: merge("workflow", 6),
    requirements: merge("requirements", 5),
    limitations: merge("limitations", 5),
    examples: merge("examples", 4),
  };
}

function chooseReadmePath(paths: string[], locale: string) {
  const rootReadmes = paths.filter(
    (path) => !path.includes("/") && /^readme(?:[._-].+)?\.md$/i.test(path),
  );
  const localeMatchers: Record<string, RegExp[]> = {
    "zh-CN": [/readme[._-](?:zh[-_]?cn|cn|chinese|zh)\.md/i],
    "zh-TW": [/readme[._-](?:zh[-_]?tw|tw|traditional)\.md/i],
    ja: [/readme[._-](?:ja|jp|japanese)\.md/i],
    fr: [/readme[._-](?:fr|french)\.md/i],
    es: [/readme[._-](?:es|spanish)\.md/i],
    en: [/^readme\.md$/i],
  };
  return (
    rootReadmes.find((path) =>
      (localeMatchers[locale] || []).some((pattern) => pattern.test(path)),
    ) ||
    rootReadmes.find((path) => /^readme\.md$/i.test(path)) ||
    rootReadmes[0]
  );
}

function githubHeaders(token?: string): Headers {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "Bitcase-Radar-Alpha",
  });
  if (token?.trim()) {
    headers.set("Authorization", `Bearer ${token.trim()}`);
  }
  return headers;
}

async function fetchGithub(
  fetcher: typeof fetch,
  url: string,
  headers: Headers,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });
  } catch {
    throw new RadarInspectionError("github_unavailable", 502);
  }

  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    throw new RadarInspectionError(
      "rate_limited",
      429,
      githubRetryAt(response.headers),
    );
  }
  if (response.status >= 500 || response.status === 403) {
    throw new RadarInspectionError("github_unavailable", 502);
  }
  return response;
}

function ensureReadableGithubResponse(response: Response): void {
  if (!response.ok) {
    throw new RadarInspectionError("github_unavailable", 502);
  }
}

async function readGithubJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new RadarInspectionError("github_unavailable", 502);
  }
}

async function readLimitedText(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const declaredSize = Number(
    response.headers.get("content-length") || 0,
  );
  try {
    if (!response.body) {
      const text = await response.text();
      const bytes = new TextEncoder().encode(text);
      return {
        text:
          bytes.byteLength > maxBytes
            ? new TextDecoder().decode(bytes.slice(0, maxBytes))
            : text,
        truncated: bytes.byteLength > maxBytes,
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let received = 0;
    let truncated = declaredSize > maxBytes;

    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return { text, truncated };
      }
      const remaining = maxBytes - received;
      const slice =
        value.byteLength > remaining
          ? value.subarray(0, remaining)
          : value;
      text += decoder.decode(slice, { stream: true });
      received += slice.byteLength;
      if (value.byteLength > remaining) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    if (received >= maxBytes) {
      truncated = true;
      await reader.cancel();
    }
    text += decoder.decode();
    return { text, truncated };
  } catch {
    throw new RadarInspectionError("github_unavailable", 502);
  }
}

async function inspectOversizedRepository(
  fetcher: typeof fetch,
  rawBase: string,
  rawHeaders: Headers,
  locale: string,
  note: string,
): Promise<RadarInspectionResult> {
  const localizedReadmes: Record<string, string[]> = {
    "zh-CN": [
      "README_CN.md",
      "README.zh-CN.md",
      "README_zh-CN.md",
      "README.md",
    ],
    "zh-TW": [
      "README_TW.md",
      "README.zh-TW.md",
      "README_zh-TW.md",
      "README.md",
    ],
    ja: ["README_JA.md", "README.ja.md", "README_ja.md", "README.md"],
    fr: ["README_FR.md", "README.fr.md", "README_fr.md", "README.md"],
    es: ["README_ES.md", "README.es.md", "README_es.md", "README.md"],
    en: ["README.md"],
  };
  let readmePath: string | undefined;
  let readmeProfile: RadarSourceProfile | undefined;

  for (const candidate of localizedReadmes[locale] || ["README.md"]) {
    const response = await fetchGithub(
      fetcher,
      `${rawBase}/${encodeURIComponent(candidate)}`,
      rawHeaders,
    );
    if (response.status === 404) continue;
    ensureReadableGithubResponse(response);
    const source = await readLimitedText(response, MAX_README_BYTES);
    readmePath = candidate;
    readmeProfile = extractSkillProfileFromMarkdown(source.text);
    if (source.truncated) {
      readmeProfile.limitations = takeFacts(
        [
          ...readmeProfile.limitations,
          "README was partially read because it exceeded Bitcase's safe preview limit.",
        ],
        4,
      );
    }
    break;
  }

  const rootSkillResponse = await fetchGithub(
    fetcher,
    `${rawBase}/SKILL.md`,
    rawHeaders,
  );
  const skillFiles: RadarInspectedSkill[] = [];
  if (rootSkillResponse.ok) {
    skillFiles.push(
      await inspectSkillResponse("SKILL.md", rootSkillResponse),
    );
  } else if (rootSkillResponse.status !== 404) {
    ensureReadableGithubResponse(rootSkillResponse);
  }

  if (skillFiles.length) {
    return summarizeSkillFiles(
      skillFiles,
      readmeProfile,
      readmePath,
      {
        discoveredFileCount: skillFiles.length,
        inspectionComplete: false,
        notes: [note],
      },
    );
  }

  return {
    status: "missing",
    skillPath: null,
    notes: [note],
    fileCount: 0,
    inspectedFileCount: 0,
    inspectionComplete: false,
    skillFiles: [],
    ...(readmePath ? { readmePath } : {}),
    profile: readmeProfile || emptySourceProfile(),
  };
}

function githubRetryAt(headers: Headers): string | undefined {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(Date.now() + retryAfter * 1000).toISOString();
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0
    ? new Date(reset * 1000).toISOString()
    : undefined;
}

function frontmatterDescription(text: string): string | undefined {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return undefined;
  const match = frontmatter[1].match(
    /^description\s*:\s*["']?(.+?)["']?\s*$/im,
  );
  const description = match?.[1]?.trim();
  if (!description || description === "|" || description === ">") {
    return undefined;
  }
  return description.slice(0, 600);
}

function frontmatterName(text: string): string | undefined {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return undefined;
  const match = frontmatter[1].match(
    /^name\s*:\s*["']?([^"'#\r\n]+?)["']?\s*$/im,
  );
  return match?.[1]?.trim().slice(0, 180) || undefined;
}

function fallbackSkillName(path: string): string {
  const parts = path.split("/");
  const parent = parts.length > 1 ? parts.at(-2) : "skill";
  return parent?.trim().slice(0, 180) || "skill";
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

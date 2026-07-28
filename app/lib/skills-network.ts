import { inspectGithubSkill } from "./radar-inspection.ts";
import type { RadarInspectionResult } from "./radar-inspection.ts";

export type SkillsNetworkView = "all" | "trending" | "hot";
export type SkillsNetworkOrigin =
  | "skills.sh"
  | "bitcase-featured"
  | "github";

export type SkillInstallation = {
  mode: "repository-clone";
  repositoryUrl: string;
  ref: string;
  copySingleSkillFolder: false;
  requiredRepositoryPaths: string[];
  setupCommands: string[];
  optionalEnvironmentVariables: string[];
  authentication: string[];
};

export type SkillsNetworkEntry = {
  id: string;
  name: string;
  source: string;
  slug: string;
  url: string;
  installUrl: string;
  installsLabel: string | null;
  rank: number | null;
  view: SkillsNetworkView;
  origin: SkillsNetworkOrigin;
  installation?: SkillInstallation;
};

export type SkillsNetworkResolved = {
  entry: SkillsNetworkEntry;
  repository: {
    id: number;
    name: string;
    fullName: string;
    htmlUrl: string;
    description: string;
    stars: number;
    updatedAt: string;
    archived: boolean;
    fork: boolean;
    defaultBranch: string;
    license: string | null;
    topics: string[];
    lane: "focus";
  };
  inspection: RadarInspectionResult;
  selectedSkillPath: string;
};

export type SkillsNetworkErrorCode =
  | "invalid_skills_url"
  | "skills_network_unavailable"
  | "skill_not_found";

export class SkillsNetworkError extends Error {
  readonly code: SkillsNetworkErrorCode;
  readonly httpStatus: number;

  constructor(code: SkillsNetworkErrorCode, httpStatus: number) {
    super(code);
    this.name = "SkillsNetworkError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type NetworkOptions = {
  fetcher?: typeof fetch;
  githubToken?: string;
};

const VIEW_PATHS: Record<SkillsNetworkView, string> = {
  all: "/",
  trending: "/trending",
  hot: "/hot",
};

const RESERVED_FIRST_SEGMENTS = new Set([
  "about",
  "agents",
  "api",
  "audits",
  "contact",
  "docs",
  "official",
  "privacy",
  "schemas",
  "security",
  "terms",
  "topics",
]);

const FALLBACK_ENTRIES: Array<
  Omit<SkillsNetworkEntry, "rank" | "view">
> = [
  {
    id: "vercel-labs/skills/find-skills",
    name: "find-skills",
    source: "vercel-labs/skills",
    slug: "find-skills",
    url: "https://skills.sh/vercel-labs/skills/find-skills",
    installUrl: "https://github.com/vercel-labs/skills",
    installsLabel: null,
    origin: "skills.sh",
  },
  {
    id: "anthropics/skills/frontend-design",
    name: "frontend-design",
    source: "anthropics/skills",
    slug: "frontend-design",
    url: "https://skills.sh/anthropics/skills/frontend-design",
    installUrl: "https://github.com/anthropics/skills",
    installsLabel: null,
    origin: "skills.sh",
  },
  {
    id: "vercel-labs/agent-skills/vercel-react-best-practices",
    name: "vercel-react-best-practices",
    source: "vercel-labs/agent-skills",
    slug: "vercel-react-best-practices",
    url: "https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices",
    installUrl: "https://github.com/vercel-labs/agent-skills",
    installsLabel: null,
    origin: "skills.sh",
  },
  {
    id: "mattpocock/skills/tdd",
    name: "tdd",
    source: "mattpocock/skills",
    slug: "tdd",
    url: "https://skills.sh/mattpocock/skills/tdd",
    installUrl: "https://github.com/mattpocock/skills",
    installsLabel: null,
    origin: "skills.sh",
  },
  {
    id: "vercel-labs/agent-skills/web-design-guidelines",
    name: "web-design-guidelines",
    source: "vercel-labs/agent-skills",
    slug: "web-design-guidelines",
    url: "https://skills.sh/vercel-labs/agent-skills/web-design-guidelines",
    installUrl: "https://github.com/vercel-labs/agent-skills",
    installsLabel: null,
    origin: "skills.sh",
  },
  {
    id: "remotion-dev/skills/remotion-best-practices",
    name: "remotion-best-practices",
    source: "remotion-dev/skills",
    slug: "remotion-best-practices",
    url: "https://skills.sh/remotion-dev/skills/remotion-best-practices",
    installUrl: "https://github.com/remotion-dev/skills",
    installsLabel: null,
    origin: "skills.sh",
  },
];

const AGENTCHAT_REPOSITORY = "Tomchen070814/AgentChat";
const AGENTCHAT_BRANCH = "master";
const AGENTCHAT_SKILLS = [
  "AgentChat-OneWeb",
  "AgentChat-WebSubAgent",
  "AgentChat-IndependentTasks",
  "mcp-server",
] as const;

const FEATURED_ENTRIES: Array<
  Omit<SkillsNetworkEntry, "rank" | "view">
> = AGENTCHAT_SKILLS.map((name) => {
  const skillPath = `skills/${name}/SKILL.md`;
  return {
    id: `${AGENTCHAT_REPOSITORY}/${normalizeSlug(name)}`,
    name,
    source: `${AGENTCHAT_REPOSITORY} · Bitcase featured`,
    slug: normalizeSlug(name),
    url: `https://github.com/${AGENTCHAT_REPOSITORY}/blob/${AGENTCHAT_BRANCH}/${skillPath}`,
    installUrl: `https://github.com/${AGENTCHAT_REPOSITORY}`,
    installsLabel: null,
    origin: "bitcase-featured",
    installation: agentChatInstallation(skillPath),
  };
});

export function validateSkillsNetworkView(
  value: string | null,
): SkillsNetworkView {
  return value === "all" || value === "hot" || value === "trending"
    ? value
    : "trending";
}

export function parseSkillsShSkillUrl(
  input: string,
): {
  id: string;
  owner: string;
  repository: string;
  source: string;
  slug: string;
  url: string;
  installUrl: string;
  origin: "skills.sh";
} | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "skills.sh" && hostname !== "www.skills.sh") return null;
  if (url.protocol !== "https:") return null;

  const segments = url.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);
  if (
    segments.length !== 3 ||
    RESERVED_FIRST_SEGMENTS.has(segments[0].toLowerCase()) ||
    segments.some(
      (segment) => !/^[a-zA-Z0-9_.-]{1,100}$/.test(segment),
    )
  ) {
    return null;
  }
  const [owner, repository, slug] = segments;
  const source = `${owner}/${repository}`;
  return {
    id: `${source}/${slug}`,
    owner,
    repository,
    source,
    slug,
    url: `https://skills.sh/${source}/${slug}`,
    installUrl: `https://github.com/${source}`,
    origin: "skills.sh",
  };
}

export function parseGithubSkillFileUrl(
  input: string,
): {
  id: string;
  owner: string;
  repository: string;
  source: string;
  slug: string;
  url: string;
  installUrl: string;
  branch: string;
  skillPath: string;
  origin: "bitcase-featured" | "github";
} | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    return null;
  }
  const segments = url.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);
  if (
    segments.length < 6 ||
    segments[2] !== "blob" ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  const [owner, repository, , branch, ...pathSegments] = segments;
  const skillPath = pathSegments.join("/");
  if (
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(owner) ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(repository) ||
    !/^[a-zA-Z0-9._-]{1,200}$/.test(branch) ||
    pathSegments.at(-1)?.toLowerCase() !== "skill.md" ||
    !pathSegments.every((segment) => /^[a-zA-Z0-9_. -]{1,160}$/.test(segment))
  ) {
    return null;
  }
  const source = `${owner}/${repository}`;
  const parent = pathSegments.at(-2) || repository;
  const slug = normalizeSlug(parent);
  const canonicalUrl = `https://github.com/${source}/blob/${branch}/${pathSegments
    .map(encodeURIComponent)
    .join("/")}`;
  return {
    id: `${source}/${slug}`,
    owner,
    repository,
    source,
    slug,
    url: canonicalUrl,
    installUrl: `https://github.com/${source}`,
    branch,
    skillPath,
    origin:
      source === AGENTCHAT_REPOSITORY &&
      branch === AGENTCHAT_BRANCH &&
      AGENTCHAT_SKILLS.some(
        (name) => skillPath === `skills/${name}/SKILL.md`,
      )
        ? "bitcase-featured"
        : "github",
  };
}

export function parseSkillsShFeedHtml(
  html: string,
  view: SkillsNetworkView,
): SkillsNetworkEntry[] {
  const entries = new Map<string, SkillsNetworkEntry>();
  const anchorPattern =
    /<a\b[^>]*href=["']\/([^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html))) {
    const parsed = parseSkillsShSkillUrl(
      `https://skills.sh/${match[1]}`,
    );
    if (!parsed || entries.has(parsed.id)) continue;
    const text = decodeHtml(stripTags(match[2])).replace(/\s+/g, " ").trim();
    const installs =
      text.match(/\b(\d+(?:[.,]\d+)?\s*[KMB]?)\s*(?:installs?)\b/i)?.[1] ||
      null;
    const rank = Number(text.match(/^\s*#?(\d{1,4})\b/)?.[1] || 0) || null;
    const humanName =
      text
        .replace(/^\s*#?\d+\s*/, "")
        .replace(/\b\d+(?:[.,]\d+)?\s*[KMB]?\s*(?:installs?)\b.*$/i, "")
        .trim()
        .split(/\s+/)[0] || parsed.slug;
    entries.set(parsed.id, {
      id: parsed.id,
      name: humanName === parsed.owner ? parsed.slug : humanName,
      source: parsed.source,
      slug: parsed.slug,
      url: parsed.url,
      installUrl: parsed.installUrl,
      installsLabel: installs,
      rank,
      view,
      origin: "skills.sh",
    });
    if (entries.size >= 24) break;
  }
  return Array.from(entries.values());
}

export async function fetchSkillsNetworkFeed(
  view: SkillsNetworkView,
  options: NetworkOptions = {},
): Promise<{ entries: SkillsNetworkEntry[]; source: "live" | "fallback" }> {
  const fetcher = options.fetcher || fetch;
  try {
    const response = await fetcher(
      `https://www.skills.sh${VIEW_PATHS[view]}`,
      {
        headers: {
          accept: "text/html",
          "user-agent": "Bitcase-Beta-Skills-Network",
        },
        redirect: "follow",
      },
    );
    if (!response.ok) throw new Error(`skills.sh ${response.status}`);
    const html = await response.text();
    const entries = parseSkillsShFeedHtml(html, view);
    if (entries.length >= 3) {
      return {
        entries: mergeFeaturedEntries(entries, view),
        source: "live",
      };
    }
  } catch {
    // A transparent cached fallback keeps discovery usable without pretending
    // that an authenticated skills.sh API connection exists.
  }
  return {
    entries: mergeFeaturedEntries(
      FALLBACK_ENTRIES.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        view,
      })),
      view,
    ),
    source: "fallback",
  };
}

export async function resolveSkillsNetworkSkill(
  input: string,
  locale: string,
  options: NetworkOptions = {},
): Promise<SkillsNetworkResolved> {
  const parsed =
    parseSkillsShSkillUrl(input) || parseGithubSkillFileUrl(input);
  if (!parsed) throw new SkillsNetworkError("invalid_skills_url", 400);

  const fetcher = options.fetcher || fetch;
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "Bitcase-Beta-Skills-Network",
    "x-github-api-version": "2026-03-10",
  });
  if (options.githubToken?.trim()) {
    headers.set("authorization", `Bearer ${options.githubToken.trim()}`);
  }

  let response: Response;
  try {
    response = await fetcher(
      `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner,
      )}/${encodeURIComponent(parsed.repository)}`,
      { headers, redirect: "follow" },
    );
  } catch {
    throw new SkillsNetworkError("skills_network_unavailable", 502);
  }
  if (!response.ok) {
    throw new SkillsNetworkError(
      response.status === 404
        ? "skill_not_found"
        : "skills_network_unavailable",
      response.status === 404 ? 404 : 502,
    );
  }

  const data = (await response.json()) as {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    updated_at: string;
    archived: boolean;
    fork: boolean;
    default_branch: string;
    license: { spdx_id?: string; name?: string } | null;
    topics?: string[];
  };
  const defaultBranch =
    "branch" in parsed ? parsed.branch : data.default_branch || "main";
  const inspection = await inspectGithubSkill(
    {
      fullName: parsed.source,
      defaultBranch,
      locale,
    },
    {
      fetcher,
      githubToken: options.githubToken,
    },
  );
  const selected =
    ("skillPath" in parsed
      ? inspection.skillFiles.find(
          (skill) => skill.path === parsed.skillPath,
        )
      : null) || selectSkillFile(inspection, parsed.slug);
  if (!selected) throw new SkillsNetworkError("skill_not_found", 404);

  return {
    entry: {
      id: parsed.id,
      name: selected.name || parsed.slug,
      source: parsed.source,
      slug: parsed.slug,
      url: parsed.url,
      installUrl: parsed.installUrl,
      installsLabel: null,
      rank: null,
      view: "all",
      origin: parsed.origin,
      ...("skillPath" in parsed &&
      parsed.origin === "bitcase-featured"
        ? { installation: agentChatInstallation(parsed.skillPath) }
        : {}),
    },
    repository: {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      description: data.description || data.full_name,
      stars: data.stargazers_count,
      updatedAt: data.updated_at,
      archived: data.archived,
      fork: data.fork,
      defaultBranch,
      license:
        data.license?.spdx_id &&
        !/^(NOASSERTION|OTHER)$/i.test(data.license.spdx_id)
          ? data.license.spdx_id
          : data.license?.name || null,
      topics: data.topics || [],
      lane: "focus",
    },
    inspection,
    selectedSkillPath: selected.path,
  };
}

function agentChatInstallation(skillPath: string): SkillInstallation {
  const requiredRepositoryPaths = [
    skillPath,
    "skills/lib",
    "scripts",
    ".env.example",
    "package.json",
    "package-lock.json",
  ];
  if (!skillPath.includes("/AgentChat-OneWeb/")) {
    requiredRepositoryPaths.push("skills/AgentChat-OneWeb");
  }
  if (skillPath.includes("/mcp-server/")) {
    requiredRepositoryPaths.push("skills/mcp-server/package.json");
  }
  return {
    mode: "repository-clone",
    repositoryUrl: `https://github.com/${AGENTCHAT_REPOSITORY}.git`,
    ref: AGENTCHAT_BRANCH,
    copySingleSkillFolder: false,
    requiredRepositoryPaths,
    setupCommands: [
      "npm ci",
      ...(skillPath.includes("/mcp-server/")
        ? ["npm install --prefix skills/mcp-server"]
        : []),
    ],
    optionalEnvironmentVariables: [
      "CHROMIUM_PATH",
      "CDP_HOST",
      "CDP_PORT",
      "CDP_URL",
      "CHROME_PROFILE",
      "PROXY_SERVER",
      "GEMINI_URL",
      "HEADLESS",
    ],
    authentication: [
      "Use a dedicated Chrome debug profile.",
      "Sign in interactively to at least one supported provider; do not place browser cookies in Bitcase.",
    ],
  };
}

function mergeFeaturedEntries(
  entries: SkillsNetworkEntry[],
  view: SkillsNetworkView,
) {
  const merged = new Map<string, SkillsNetworkEntry>();
  FEATURED_ENTRIES.forEach((entry) => {
    merged.set(entry.id, { ...entry, rank: null, view });
  });
  entries.forEach((entry) => {
    if (!merged.has(entry.id)) merged.set(entry.id, entry);
  });
  return Array.from(merged.values()).slice(0, 24);
}

function selectSkillFile(
  inspection: RadarInspectionResult,
  slug: string,
) {
  const normalizedSlug = normalizeSlug(slug);
  return (
    inspection.skillFiles.find((skill) => {
      const parts = skill.path.split("/");
      const parent = parts.at(-2) || "";
      return normalizeSlug(parent) === normalizedSlug;
    }) ||
    inspection.skillFiles.find(
      (skill) => normalizeSlug(skill.name) === normalizedSlug,
    ) ||
    (inspection.skillFiles.length === 1
      ? inspection.skillFiles[0]
      : null)
  );
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[\s_]+/g, "-");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export type RadarLane = "focus" | "adjacent" | "wildcard";

export type RadarSearchQuery = {
  lane: RadarLane;
  topic: string;
  page: number;
};

export type RadarSearchRepository = {
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
  lane: RadarLane;
};

export type RadarSearchErrorCode =
  | "invalid_search"
  | "rate_limited"
  | "github_unavailable";

export class RadarSearchError extends Error {
  readonly code: RadarSearchErrorCode;
  readonly httpStatus: number;
  readonly retryAt?: string;

  constructor(
    code: RadarSearchErrorCode,
    httpStatus: number,
    retryAt?: string,
  ) {
    super(code);
    this.name = "RadarSearchError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAt = retryAt;
  }
}

type SearchOptions = {
  githubToken?: string;
  fetcher?: typeof fetch;
};

const GITHUB_API_VERSION = "2026-03-10";
const LANES = new Set<RadarLane>(["focus", "adjacent", "wildcard"]);

export function validateRadarSearchQueries(
  value: unknown,
): RadarSearchQuery[] | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { queries?: unknown };
  if (!Array.isArray(candidate.queries) || candidate.queries.length !== 3) {
    return null;
  }

  const queries = candidate.queries.map((query) => {
    if (!query || typeof query !== "object") return null;
    const item = query as Record<string, unknown>;
    const lane = typeof item.lane === "string" ? item.lane : "";
    const topic = typeof item.topic === "string" ? item.topic.trim() : "";
    const page = Number(item.page);
    if (
      !LANES.has(lane as RadarLane) ||
      !/^[\p{L}\p{N}\s+._-]{2,120}$/u.test(topic) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 5
    ) {
      return null;
    }
    return { lane: lane as RadarLane, topic, page };
  });

  return queries.every(
    (query): query is RadarSearchQuery => Boolean(query),
  )
    ? queries
    : null;
}

export async function searchGithubRadar(
  queries: RadarSearchQuery[],
  options: SearchOptions = {},
): Promise<RadarSearchRepository[]> {
  const validated = validateRadarSearchQueries({ queries });
  if (!validated) throw new RadarSearchError("invalid_search", 400);

  const fetcher = options.fetcher || fetch;
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "Bitcase-Radar-Alpha",
  });
  if (options.githubToken?.trim()) {
    headers.set("Authorization", `Bearer ${options.githubToken.trim()}`);
  }

  const payloads = await Promise.all(
    validated.map(async ({ lane, topic, page }) => {
      const endpoint = new URL("https://api.github.com/search/repositories");
      endpoint.searchParams.set(
        "q",
        `"SKILL.md" ${topic} in:name,description,readme`,
      );
      endpoint.searchParams.set("sort", "updated");
      endpoint.searchParams.set("order", "desc");
      endpoint.searchParams.set("per_page", "12");
      endpoint.searchParams.set("page", String(page));

      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "GET",
          headers,
          redirect: "follow",
        });
      } catch {
        throw new RadarSearchError("github_unavailable", 502);
      }

      if (
        response.status === 429 ||
        (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" ||
            response.headers.has("retry-after")))
      ) {
        throw new RadarSearchError(
          "rate_limited",
          429,
          githubRetryAt(response.headers),
        );
      }
      if (!response.ok) {
        throw new RadarSearchError("github_unavailable", 502);
      }

      let data: {
        items?: Array<{
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
        }>;
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new RadarSearchError("github_unavailable", 502);
      }

      return (data.items || []).map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        description: repo.description || repo.full_name,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        archived: repo.archived,
        fork: repo.fork,
        defaultBranch: repo.default_branch || "main",
        license: normalizeLicense(
          repo.license?.spdx_id || repo.license?.name,
        ),
        topics: repo.topics || [],
        lane,
      }));
    }),
  );

  return payloads.flat();
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

function normalizeLicense(value?: string | null) {
  return value && !/^(NOASSERTION|OTHER)$/i.test(value) ? value : null;
}

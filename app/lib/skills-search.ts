export type SkillsCatalogQuery = {
  topic: string;
  responsibility: string;
  limit?: number;
};

export type SkillsCatalogEntry = {
  id: string;
  name: string;
  source: string;
  slug: string;
  url: string;
  installUrl: string;
  installs: number;
  responsibility: string;
  queryRank: number;
};

export type SkillsCatalogErrorCode =
  | "invalid_catalog_search"
  | "catalog_rate_limited"
  | "catalog_unavailable";

export class SkillsCatalogError extends Error {
  readonly code: SkillsCatalogErrorCode;
  readonly httpStatus: number;
  readonly retryAt?: string;

  constructor(
    code: SkillsCatalogErrorCode,
    httpStatus: number,
    retryAt?: string,
  ) {
    super(code);
    this.name = "SkillsCatalogError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAt = retryAt;
  }
}

type SearchOptions = {
  fetcher?: typeof fetch;
};

const SOURCE_PATTERN =
  /^[a-z0-9](?:[a-z0-9_.-]{0,99})\/[a-z0-9](?:[a-z0-9_.-]{0,99})$/i;
const SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9_.-]{0,159})$/i;

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function validateQueries(queries: SkillsCatalogQuery[]) {
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 8) {
    return null;
  }
  const validated = queries.map((query) => {
    const topic = cleanText(query?.topic, 120);
    const responsibility = cleanText(query?.responsibility, 80);
    const limit = Number.isFinite(query?.limit)
      ? Math.max(1, Math.min(10, Math.floor(query.limit || 1)))
      : 6;
    if (
      topic.length < 2 ||
      !/^[\p{L}\p{N}\s+._/-]+$/u.test(topic) ||
      !responsibility
    ) {
      return null;
    }
    return { topic, responsibility, limit };
  });
  return validated.every(
    (query): query is Required<SkillsCatalogQuery> => Boolean(query),
  )
    ? validated
    : null;
}

function canonicalEntry(
  value: unknown,
  responsibility: string,
  queryRank: number,
): SkillsCatalogEntry | null {
  if (!value || typeof value !== "object") return null;
  const skill = value as Record<string, unknown>;
  const source = cleanText(skill.source, 200);
  const rawId = cleanText(skill.id, 360);
  const name = cleanText(skill.name, 240);
  if (!SOURCE_PATTERN.test(source) || !rawId || !name) return null;

  const sourceSegments = source.split("/");
  const idSegments = rawId.split("/").filter(Boolean);
  const slug =
    idSegments.length >= 3 &&
    idSegments[0]?.toLocaleLowerCase() ===
      sourceSegments[0]?.toLocaleLowerCase() &&
    idSegments[1]?.toLocaleLowerCase() ===
      sourceSegments[1]?.toLocaleLowerCase()
      ? idSegments.at(-1) || ""
      : idSegments.length === 1
        ? idSegments[0]
        : "";
  if (!SEGMENT_PATTERN.test(slug)) return null;

  const id = `${source}/${slug}`;
  const installs = Number(skill.installs);
  return {
    id,
    name,
    source,
    slug,
    url: `https://skills.sh/${id}`,
    installUrl: `https://github.com/${source}`,
    installs:
      Number.isFinite(installs) && installs > 0 ? Math.floor(installs) : 0,
    responsibility,
    queryRank,
  };
}

export async function searchSkillsCatalog(
  queries: SkillsCatalogQuery[],
  options: SearchOptions = {},
): Promise<SkillsCatalogEntry[]> {
  const validated = validateQueries(queries);
  if (!validated) {
    throw new SkillsCatalogError("invalid_catalog_search", 400);
  }

  const fetcher = options.fetcher || fetch;
  const searches = await Promise.allSettled(
    validated.map(async ({ topic, responsibility, limit }) => {
      const endpoint = new URL("https://skills.sh/api/search");
      endpoint.searchParams.set("q", topic);
      endpoint.searchParams.set("limit", String(limit));
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "GET",
          headers: {
            accept: "application/json",
            "user-agent": "Bitcase-Skill-Discovery",
          },
          redirect: "follow",
        });
      } catch {
        throw new SkillsCatalogError("catalog_unavailable", 502);
      }
      if (response.status === 429) {
        throw new SkillsCatalogError(
          "catalog_rate_limited",
          429,
          retryAt(response.headers),
        );
      }
      if (!response.ok) {
        throw new SkillsCatalogError("catalog_unavailable", 502);
      }

      let data: { skills?: unknown[] };
      try {
        data = (await response.json()) as { skills?: unknown[] };
      } catch {
        throw new SkillsCatalogError("catalog_unavailable", 502);
      }
      return (Array.isArray(data.skills) ? data.skills : [])
        .slice(0, limit)
        .map((skill, index) =>
          canonicalEntry(skill, responsibility, index),
        )
        .filter((skill): skill is SkillsCatalogEntry => Boolean(skill));
    }),
  );
  const payloads = searches.flatMap((search) =>
    search.status === "fulfilled" ? [search.value] : [],
  );
  if (!payloads.length) {
    const firstFailure = searches.find(
      (search): search is PromiseRejectedResult =>
        search.status === "rejected",
    );
    if (firstFailure?.reason instanceof SkillsCatalogError) {
      throw firstFailure.reason;
    }
    throw new SkillsCatalogError("catalog_unavailable", 502);
  }

  const unique = new Map<string, SkillsCatalogEntry>();
  payloads.flat().forEach((entry) => {
    const existing = unique.get(entry.id);
    if (!existing || entry.queryRank < existing.queryRank) {
      unique.set(entry.id, entry);
    }
  });
  return Array.from(unique.values());
}

export function diversifySkillsCatalog(
  entries: SkillsCatalogEntry[],
  maximum = 6,
) {
  const groups = new Map<string, SkillsCatalogEntry[]>();
  entries.forEach((entry) => {
    const group = groups.get(entry.responsibility) || [];
    group.push(entry);
    groups.set(entry.responsibility, group);
  });
  groups.forEach((group) =>
    group.sort(
      (first, second) =>
        first.queryRank - second.queryRank ||
        second.installs - first.installs,
    ),
  );

  const selected: SkillsCatalogEntry[] = [];
  const responsibilities = Array.from(groups.keys());
  for (let rank = 0; selected.length < maximum; rank += 1) {
    let added = false;
    for (const responsibility of responsibilities) {
      const entry = groups.get(responsibility)?.[rank];
      if (!entry || selected.some((current) => current.id === entry.id)) {
        continue;
      }
      selected.push(entry);
      added = true;
      if (selected.length >= maximum) break;
    }
    if (!added) break;
  }
  return selected;
}

function retryAt(headers: Headers) {
  const retryAfter = Number(headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? new Date(Date.now() + retryAfter * 1000).toISOString()
    : undefined;
}

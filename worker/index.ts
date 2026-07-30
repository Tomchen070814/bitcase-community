import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  RadarInspectionError,
} from "../app/lib/radar-inspection";
import {
  resolveSkillsNetworkSkill,
  SkillsNetworkError,
} from "../app/lib/skills-network";
import {
  visualizeInspectedSkill,
} from "../app/lib/skill-compose";

interface Env {
  ASSETS: Fetcher;
  GITHUB_SKILL_TOKEN?: string;
  BITCASE_INDEX_API_URL?: string;
  NEXT_PUBLIC_BITCASE_INDEX_API_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get("origin");
  return !origin || origin === url.origin;
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

function snapshotApiUrl(env: Env) {
  const value = env.BITCASE_INDEX_API_URL || env.NEXT_PUBLIC_BITCASE_INDEX_API_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function proxySnapshotSearch(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
) {
  const base = snapshotApiUrl(env);
  if (!base) {
    return json({ error: "snapshot_service_unconfigured" }, { status: 503 });
  }
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (brief.length < 6 || brief.length > 800) {
    return json({ error: "invalid_brief" }, { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const endpoint = new URL("/api/search", base);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Bitcase-Site",
      },
      body: JSON.stringify({
        query: brief,
        locale: "zh-CN",
        library: Array.isArray(body.library) ? body.library : [],
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({ error: "snapshot_service_invalid_response" }));
    const headers = new Headers();
    const cacheControl = response.headers.get("cache-control");
    const indexVersion = response.headers.get("x-bitcase-index-version");
    if (cacheControl) headers.set("cache-control", cacheControl);
    if (indexVersion) headers.set("x-bitcase-index-version", indexVersion);
    return json(payload, { status: response.status, headers });
  } catch {
    return json({ error: "snapshot_service_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

async function handleApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (
    url.pathname === "/api/discover" ||
    url.pathname === "/api/inspect" ||
    url.pathname === "/api/skills-network/resolve"
  ) {
    return json(
      {
        error: "snapshot_only",
        message: "Live upstream discovery was removed. Search the active Bitcase snapshot instead.",
      },
      { status: 410 },
    );
  }

  if (url.pathname === "/api/compose") {
    if (method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
    if (!sameOrigin(request, url)) return json({ error: "forbidden_origin" }, { status: 403 });
    const body = await readBody(request, 96_000);
    if (!body || typeof body !== "object") return json({ error: "invalid_json" }, { status: 400 });
    return proxySnapshotSearch(request, env, body as Record<string, unknown>);
  }

  // Exact-source visualization is user initiated, so it may read the selected
  // skills.sh/GitHub source. Background discovery never runs in this site Worker.
  if (url.pathname === "/api/skills/visualize") {
    if (method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
    if (!sameOrigin(request, url)) return json({ error: "forbidden_origin" }, { status: 403 });
    const body = await readBody(request, 4096);
    const candidate = body && typeof body === "object" ? body as { url?: unknown } : {};
    const source = typeof candidate.url === "string" ? candidate.url.trim() : "";
    try {
      const resolved = await resolveSkillsNetworkSkill(source, "zh-CN", {
        githubToken: env.GITHUB_SKILL_TOKEN,
      });
      const selected = resolved.inspection.skillFiles.find(
        (skill) => skill.path === resolved.selectedSkillPath,
      );
      if (!selected) return json({ error: "skill_not_found" }, { status: 404 });
      const visualized = visualizeInspectedSkill(resolved.repository, selected);
      if (!visualized) return json({ error: "skill_not_visualizable" }, { status: 422 });
      const { score, ...skill } = visualized;
      void score;
      return json({ skill });
    } catch (error) {
      if (error instanceof SkillsNetworkError) return json({ error: error.code }, { status: error.httpStatus });
      if (error instanceof RadarInspectionError) return json({ error: error.code }, { status: error.httpStatus });
      return json({ error: "source_unavailable" }, { status: 502 });
    }
  }

  return null;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return (await handleApi(request, env)) || json({ error: "not_found" }, { status: 404 });
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

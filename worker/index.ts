/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  analyticsOwner,
  authenticateBridgeToken,
  authenticatedEmail,
  authenticatedIdentity,
  issueBridgeToken,
  json,
  listBridgeTokens,
  readBetaAccount,
  readAnalyticsSummary,
  readLibrary,
  recordProductEvent,
  revokeBridgeTokens,
  unauthorized,
  validateLibraryPayload,
  validateProductEvent,
  writeLibrary,
} from "../app/lib/bitcase-cloud";
import {
  inspectGithubSkill,
  RadarInspectionError,
} from "../app/lib/radar-inspection";
import {
  RadarSearchError,
  searchGithubRadar,
  validateRadarSearchQueries,
} from "../app/lib/radar-search";
import {
  fetchSkillsNetworkFeed,
  resolveSkillsNetworkSkill,
  SkillsNetworkError,
  validateSkillsNetworkView,
} from "../app/lib/skills-network";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BITCASE_OWNER_EMAIL?: string;
  GITHUB_RADAR_TOKEN?: string;
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

async function handleBitcaseApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const db = env.DB;

  if (url.pathname === "/api/account") {
    if (method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const identity = authenticatedIdentity(request);
    if (!identity) return unauthorized();
    const locale = url.searchParams.get("locale") || "en";
    return json({ account: await readBetaAccount(db, identity, locale) });
  }

  if (url.pathname === "/api/skills-network/feed") {
    if (method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const view = validateSkillsNetworkView(url.searchParams.get("view"));
    const feed = await fetchSkillsNetworkFeed(view);
    return json(feed, {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    });
  }

  if (url.pathname === "/api/skills-network/resolve") {
    if (method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return json({ error: "forbidden_origin" }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) {
      return json({ error: "payload_too_large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }
    const candidate =
      body && typeof body === "object"
        ? (body as { url?: unknown; locale?: unknown })
        : {};
    const input = typeof candidate.url === "string" ? candidate.url : "";
    const locale =
      typeof candidate.locale === "string" ? candidate.locale : "en";
    try {
      return json({
        result: await resolveSkillsNetworkSkill(input, locale, {
          githubToken: env.GITHUB_RADAR_TOKEN,
        }),
      });
    } catch (error) {
      if (error instanceof SkillsNetworkError) {
        return json({ error: error.code }, { status: error.httpStatus });
      }
      if (error instanceof RadarInspectionError) {
        return json(
          {
            error: error.code,
            ...(error.retryAt ? { retryAt: error.retryAt } : {}),
          },
          { status: error.httpStatus },
        );
      }
      return json(
        { error: "skills_network_unavailable" },
        { status: 502 },
      );
    }
  }

  if (url.pathname === "/api/radar/search") {
    if (method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return json({ error: "forbidden_origin" }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8192) {
      return json({ error: "payload_too_large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }
    const queries = validateRadarSearchQueries(body);
    if (!queries) {
      return json({ error: "invalid_search" }, { status: 400 });
    }
    try {
      const results = await searchGithubRadar(queries, {
        githubToken: env.GITHUB_RADAR_TOKEN,
      });
      return json(
        { results },
        {
          headers: {
            "cache-control": "public, max-age=120, s-maxage=900",
          },
        },
      );
    } catch (error) {
      if (error instanceof RadarSearchError) {
        return json(
          {
            error: error.code,
            ...(error.retryAt ? { retryAt: error.retryAt } : {}),
          },
          { status: error.httpStatus },
        );
      }
      return json({ error: "github_unavailable" }, { status: 502 });
    }
  }

  if (url.pathname === "/api/radar/inspect") {
    if (method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return json({ error: "forbidden_origin" }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) {
      return json({ error: "payload_too_large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }
    try {
      const result = await inspectGithubSkill(
        body as { fullName: string; defaultBranch?: string },
        { githubToken: env.GITHUB_RADAR_TOKEN },
      );
      return json({ result });
    } catch (error) {
      if (error instanceof RadarInspectionError) {
        return json(
          {
            error: error.code,
            ...(error.retryAt ? { retryAt: error.retryAt } : {}),
          },
          { status: error.httpStatus },
        );
      }
      return json({ error: "github_unavailable" }, { status: 502 });
    }
  }

  if (url.pathname === "/api/telemetry") {
    if (method !== "POST") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) {
      return json({ error: "payload_too_large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }
    const event = validateProductEvent(body);
    if (!event) {
      return json({ error: "invalid_event" }, { status: 400 });
    }
    try {
      await recordProductEvent(db, event);
      return json({ accepted: true }, { status: 202 });
    } catch (error) {
      console.warn("Bitcase telemetry storage unavailable", error);
      return json(
        { accepted: false, reason: "storage_unavailable" },
        { status: 202 },
      );
    }
  }

  if (url.pathname === "/api/analytics/summary") {
    if (method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    if (!analyticsOwner(request, env.BITCASE_OWNER_EMAIL)) {
      return json({ error: "not_found" }, { status: 404 });
    }
    return json(await readAnalyticsSummary(db));
  }

  if (url.pathname === "/api/library") {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();

    if (method === "GET") return json(await readLibrary(db, email));
    if (method === "PUT") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_json" }, { status: 400 });
      }
      const library = validateLibraryPayload(body);
      if (!library) {
        return json({ error: "invalid_library" }, { status: 400 });
      }
      return json(
        await writeLibrary(db, email, library.skills, library.stackIds),
      );
    }
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (url.pathname === "/api/bridge/tokens") {
    const email = authenticatedEmail(request);
    if (!email) return unauthorized();

    if (method === "GET") {
      return json({ tokens: await listBridgeTokens(db, email) });
    }
    if (method === "POST") {
      return json(await issueBridgeToken(db, email), { status: 201 });
    }
    if (method === "DELETE") {
      await revokeBridgeTokens(db, email);
      return json({ revoked: true });
    }
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (url.pathname === "/api/bridge/library") {
    if (method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405 });
    }
    const ownerEmail = await authenticateBridgeToken(db, request);
    if (!ownerEmail) {
      return json({ error: "invalid_or_revoked_token" }, { status: 401 });
    }
    const library = await readLibrary(db, ownerEmail);
    return json({
      product: "Bitcase",
      apiVersion: "v1",
      ...library,
    });
  }

  return null;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const response = await handleBitcaseApi(request, env);
      if (response) return response;
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

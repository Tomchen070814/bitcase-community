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
import {
  planRadarQueries,
  RadarAiError,
  validateRadarAiInput,
} from "../app/lib/radar-ai";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BITCASE_OWNER_EMAIL?: string;
  BITCASE_AI_PROVIDER?: string;
  BITCASE_AI_BASE_URL?: string;
  BITCASE_AI_MODEL?: string;
  BITCASE_AI_DAILY_LIMIT?: string;
  BITCASE_AI_GLOBAL_DAILY_LIMIT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  FREELLMAPI_API_KEY?: string;
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

  if (url.pathname === "/api/radar/plan") {
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
    const input = validateRadarAiInput(body);
    if (!input) {
      return json({ error: "invalid_ai_plan" }, { status: 400 });
    }

    const provider = env.BITCASE_AI_PROVIDER?.trim();
    const cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const cloudflareApiToken = env.CLOUDFLARE_API_TOKEN?.trim();
    const freeLlmApiKey = env.FREELLMAPI_API_KEY?.trim();
    const freeLlmBaseUrl = env.BITCASE_AI_BASE_URL?.trim();
    const providerSecret =
      provider === "cloudflare" ? cloudflareApiToken : freeLlmApiKey;
    const configured =
      (provider === "cloudflare" &&
        cloudflareAccountId &&
        cloudflareApiToken) ||
      (provider === "freellmapi" &&
        freeLlmBaseUrl &&
        freeLlmApiKey);
    if (!configured || !providerSecret) {
      return json({ error: "ai_not_configured" }, { status: 503 });
    }
    const model =
      env.BITCASE_AI_MODEL?.trim() ||
      (provider === "cloudflare"
        ? "@cf/moonshotai/kimi-k2.6"
        : "kimi-k2.6");
    const dailyLimit = clampDailyLimit(
      env.BITCASE_AI_DAILY_LIMIT,
      authenticatedEmail(request) ? 20 : 3,
    );
    const globalDailyLimit = clampDailyLimit(
      env.BITCASE_AI_GLOBAL_DAILY_LIMIT,
      100,
      10000,
    );
    const visitorAllowed = await consumeAiAllowance(
      db,
      aiActor(request),
      providerSecret,
      dailyLimit,
    );
    if (!visitorAllowed) {
      return json(
        { error: "ai_daily_limit", dailyLimit },
        { status: 429 },
      );
    }
    const globallyAllowed = await consumeAiAllowance(
      db,
      "bitcase-global",
      providerSecret,
      globalDailyLimit,
    );
    if (!globallyAllowed) {
      return json(
        { error: "ai_global_daily_limit", globalDailyLimit },
        { status: 429 },
      );
    }

    try {
      const plan =
        provider === "cloudflare"
          ? await planRadarQueries(input, {
              provider,
              accountId: cloudflareAccountId!,
              apiToken: cloudflareApiToken!,
              model,
            })
          : await planRadarQueries(input, {
              provider: "freellmapi",
              baseUrl: freeLlmBaseUrl!,
              apiKey: freeLlmApiKey!,
              model,
            });
      return json(
        { plan },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof RadarAiError) {
        return json({ error: error.code }, { status: error.httpStatus });
      }
      return json({ error: "ai_provider_error" }, { status: 502 });
    }
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

function aiActor(request: Request) {
  return (
    authenticatedEmail(request) ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function clampDailyLimit(
  value: string | undefined,
  fallback: number,
  maximum = 100,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(maximum, Math.floor(parsed)))
    : fallback;
}

async function consumeAiAllowance(
  db: D1Database,
  actor: string,
  secret: string,
  limit: number,
) {
  const day = new Date().toISOString().slice(0, 10);
  const actorHash = await hashAiActor(actor, secret);
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ai_generation_usage (
        usage_day TEXT NOT NULL,
        actor_hash TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (usage_day, actor_hash)
      )`,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO ai_generation_usage
         (usage_day, actor_hash, request_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(usage_day, actor_hash) DO UPDATE SET
         request_count = ai_generation_usage.request_count + 1,
         updated_at = excluded.updated_at`,
    )
    .bind(day, actorHash, new Date().toISOString())
    .run();
  const row = await db
    .prepare(
      `SELECT request_count
       FROM ai_generation_usage
       WHERE usage_day = ? AND actor_hash = ?`,
    )
    .bind(day, actorHash)
    .first<{ request_count: number }>();
  return Number(row?.request_count || 0) <= limit;
}

async function hashAiActor(actor: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(actor),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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

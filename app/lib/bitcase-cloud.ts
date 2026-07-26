export type StoredLibrary = {
  skills: unknown[];
  stackIds: string[];
  revision: number;
  updatedAt: string | null;
};

type LibraryRow = {
  skills_json: string;
  stack_json: string;
  revision: number;
  updated_at: string;
};

type TokenRow = {
  owner_email: string;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const TOKEN_PREFIX = "btc_live_";
const ANALYTICS_RETENTION_DAYS = 90;
const PRODUCT_EVENTS = new Set([
  "session_started",
  "return_visit",
  "skill_added",
  "library_imported",
  "radar_searched",
  "radar_candidate_saved",
  "radar_resource_saved",
  "radar_candidate_dismissed",
  "stack_assembled",
  "stack_preflight_checked",
  "stack_exported",
  "codex_handoff_opened",
  "codex_sample_loaded",
  "prompt_copied",
  "feedback_submitted",
  "installation_handshake_imported",
  "quarantine_action",
  "skill_outcome_submitted",
  "skills_network_imported",
  "onboarding_completed",
  "onboarding_skipped",
  "pwa_installed",
]);
const ANALYTICS_LOCALES = new Set([
  "zh-CN",
  "zh-TW",
  "en",
  "ja",
  "fr",
  "es",
]);

export function authenticatedEmail(request: Request): string | null {
  const email = request.headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  return email || null;
}

export function authenticatedIdentity(request: Request): {
  email: string;
  displayName: string | null;
} | null {
  const email = authenticatedEmail(request);
  if (!email) return null;
  const encodedName = request.headers.get(USER_FULL_NAME_HEADER);
  const displayName =
    encodedName &&
    request.headers.get(USER_FULL_NAME_ENCODING_HEADER) ===
      "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : null;
  return {
    email,
    displayName: normalizeDisplayName(displayName),
  };
}

export async function readBetaAccount(
  db: D1Database,
  identity: { email: string; displayName: string | null },
  locale = "en",
): Promise<{
  id: string;
  email: string;
  displayName: string;
  authProvider: "chatgpt";
  plan: "beta";
  locale: string;
  createdAt: string;
  lastSeenAt: string;
}> {
  const now = new Date().toISOString();
  const safeLocale = ANALYTICS_LOCALES.has(locale) ? locale : "en";
  await db
    .prepare(
      `INSERT INTO beta_accounts
         (id, email, display_name, auth_provider, plan, locale, created_at, last_seen_at)
       VALUES (?, ?, ?, 'chatgpt', 'beta', ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, beta_accounts.display_name),
         locale = excluded.locale,
         last_seen_at = excluded.last_seen_at`,
    )
    .bind(
      crypto.randomUUID(),
      identity.email,
      identity.displayName,
      safeLocale,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare(
      `SELECT id, email, display_name, auth_provider, plan, locale, created_at, last_seen_at
       FROM beta_accounts
       WHERE email = ?`,
    )
    .bind(identity.email)
    .first<{
      id: string;
      email: string;
      display_name: string | null;
      auth_provider: string;
      plan: string;
      locale: string;
      created_at: string;
      last_seen_at: string;
    }>();
  if (!row) throw new Error("account_not_persisted");
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    authProvider: "chatgpt",
    plan: "beta",
    locale: row.locale,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function unauthorized(): Response {
  return json(
    {
      error: "authentication_required",
      signInPath: "/signin-with-chatgpt?return_to=%2F",
    },
    { status: 401 },
  );
}

export function analyticsOwner(
  request: Request,
  ownerEmail: string | undefined,
): boolean {
  const viewerEmail = authenticatedEmail(request);
  return Boolean(
    viewerEmail &&
      ownerEmail &&
      viewerEmail === ownerEmail.trim().toLowerCase(),
  );
}

export function validateProductEvent(value: unknown): {
  eventName: string;
  sessionId: string;
  locale: string;
  acquisitionSource: string;
  metadata: Record<string, string>;
} | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  const eventName = typeof event.event === "string" ? event.event : "";
  const sessionId =
    typeof event.sessionId === "string" ? event.sessionId : "";
  const locale = typeof event.locale === "string" ? event.locale : "";
  if (
    event.version !== 1 ||
    !PRODUCT_EVENTS.has(eventName) ||
    !/^[a-zA-Z0-9_-]{16,64}$/.test(sessionId) ||
    !ANALYTICS_LOCALES.has(locale)
  ) {
    return null;
  }

  const acquisitionSource = normalizeAnalyticsLabel(
    event.acquisitionSource,
    "direct",
  );
  const inputMetadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  const allowedKeys = allowedMetadataKeys(eventName);
  const metadata = Object.fromEntries(
    Object.entries(inputMetadata)
      .filter(([key]) => allowedKeys.has(key))
      .slice(0, 4)
      .map(([key, item]) => [
        key,
        normalizeAnalyticsLabel(item, "unknown"),
      ]),
  );

  return {
    eventName,
    sessionId,
    locale,
    acquisitionSource,
    metadata,
  };
}

export async function recordProductEvent(
  db: D1Database,
  event: ReturnType<typeof validateProductEvent> & {},
): Promise<void> {
  const now = new Date().toISOString();
  const cutoff = new Date(
    Date.now() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO product_events
           (id, event_name, session_id, locale, acquisition_source, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        event.eventName,
        event.sessionId,
        event.locale,
        event.acquisitionSource,
        JSON.stringify(event.metadata),
        now,
      ),
    db
      .prepare("DELETE FROM product_events WHERE created_at < ?")
      .bind(cutoff),
  ]);
}

export async function readAnalyticsSummary(db: D1Database) {
  const totals = await db
    .prepare(
      `SELECT
         COUNT(*) AS events,
         COUNT(DISTINCT session_id) AS sessions,
         COUNT(DISTINCT CASE
           WHEN event_name IN ('skill_added', 'library_imported', 'radar_candidate_saved')
           THEN session_id END) AS activated_sessions,
         COUNT(DISTINCT CASE
           WHEN event_name IN ('stack_exported', 'prompt_copied')
           THEN session_id END) AS value_sessions,
         COUNT(DISTINCT CASE
           WHEN event_name = 'return_visit'
           THEN session_id END) AS returning_sessions,
         SUM(CASE
           WHEN event_name = 'feedback_submitted'
             AND json_extract(metadata_json, '$.outcome') = 'helpful'
           THEN 1 ELSE 0 END) AS positive_feedback,
         SUM(CASE
           WHEN event_name = 'feedback_submitted'
             AND json_extract(metadata_json, '$.outcome') = 'not_helpful'
           THEN 1 ELSE 0 END) AS negative_feedback
         ,SUM(CASE
           WHEN event_name = 'feedback_submitted'
             AND json_extract(metadata_json, '$.outcome') = 'conflict'
           THEN 1 ELSE 0 END) AS conflict_feedback
       FROM product_events`,
    )
    .first<Record<string, number | null>>();
  const funnel = await db
    .prepare(
      `SELECT
         COUNT(DISTINCT session_id) AS visited,
         COUNT(DISTINCT CASE
           WHEN event_name IN ('skill_added', 'library_imported', 'radar_candidate_saved')
           THEN session_id END) AS collected,
         COUNT(DISTINCT CASE
           WHEN event_name = 'stack_assembled'
           THEN session_id END) AS assembled,
         COUNT(DISTINCT CASE
           WHEN event_name IN ('stack_exported', 'prompt_copied')
           THEN session_id END) AS used
       FROM product_events`,
    )
    .first<Record<string, number | null>>();
  const eventRows = await db
    .prepare(
      `SELECT event_name AS name, COUNT(*) AS count,
         COUNT(DISTINCT session_id) AS sessions
       FROM product_events
       GROUP BY event_name
       ORDER BY count DESC`,
    )
    .all<{ name: string; count: number; sessions: number }>();
  const sourceRows = await db
    .prepare(
      `SELECT acquisition_source AS source,
         COUNT(DISTINCT session_id) AS sessions
       FROM product_events
       WHERE event_name = 'session_started'
       GROUP BY acquisition_source
       ORDER BY sessions DESC
       LIMIT 12`,
    )
    .all<{ source: string; sessions: number }>();
  const dailyRows = await db
    .prepare(
      `SELECT
         substr(created_at, 1, 10) AS day,
         COUNT(DISTINCT session_id) AS sessions,
         SUM(CASE WHEN event_name = 'radar_candidate_saved' THEN 1 ELSE 0 END) AS radar_saves,
         SUM(CASE WHEN event_name IN ('stack_exported', 'prompt_copied') THEN 1 ELSE 0 END) AS value_actions
       FROM product_events
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY substr(created_at, 1, 10)
       ORDER BY day ASC`,
    )
    .all<{
      day: string;
      sessions: number;
      radar_saves: number;
      value_actions: number;
    }>();

  const sessions = Number(totals?.sessions || 0);
  const activatedSessions = Number(totals?.activated_sessions || 0);
  const valueSessions = Number(totals?.value_sessions || 0);
  const returningSessions = Number(totals?.returning_sessions || 0);
  const positiveFeedback = Number(totals?.positive_feedback || 0);
  const negativeFeedback = Number(totals?.negative_feedback || 0);
  const conflictFeedback = Number(totals?.conflict_feedback || 0);
  const feedbackTotal =
    positiveFeedback + negativeFeedback + conflictFeedback;
  return {
    generatedAt: new Date().toISOString(),
    retentionDays: ANALYTICS_RETENTION_DAYS,
    totals: {
      sessions,
      events: Number(totals?.events || 0),
      activatedSessions,
      valueSessions,
      returningSessions,
      positiveFeedback,
      negativeFeedback,
      conflictFeedback,
    },
    rates: {
      activation: ratio(activatedSessions, sessions),
      value: ratio(valueSessions, sessions),
      returning: ratio(returningSessions, sessions),
      positiveFeedback: ratio(positiveFeedback, feedbackTotal),
    },
    funnel: (["visited", "collected", "assembled", "used"] as const).map(
      (key) => ({ key, sessions: Number(funnel?.[key] || 0) }),
    ),
    sources: sourceRows.results || [],
    events: eventRows.results || [],
    daily: (dailyRows.results || []).map((row) => ({
      day: row.day,
      sessions: Number(row.sessions || 0),
      radarSaves: Number(row.radar_saves || 0),
      valueActions: Number(row.value_actions || 0),
    })),
  };
}

export async function readLibrary(
  db: D1Database,
  ownerEmail: string,
): Promise<StoredLibrary> {
  const row = await db.prepare(
    `SELECT skills_json, stack_json, revision, updated_at
     FROM skill_libraries
     WHERE owner_email = ?`,
  )
    .bind(ownerEmail)
    .first<LibraryRow>();

  if (!row) {
    return { skills: [], stackIds: [], revision: 0, updatedAt: null };
  }

  return {
    skills: parseArray(row.skills_json),
    stackIds: parseStringArray(row.stack_json),
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export async function writeLibrary(
  db: D1Database,
  ownerEmail: string,
  skills: unknown[],
  stackIds: string[],
): Promise<StoredLibrary> {
  const updatedAt = new Date().toISOString();
  await db.prepare(
    `INSERT INTO skill_libraries
       (owner_email, skills_json, stack_json, revision, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(owner_email) DO UPDATE SET
       skills_json = excluded.skills_json,
       stack_json = excluded.stack_json,
       revision = skill_libraries.revision + 1,
       updated_at = excluded.updated_at`,
  )
    .bind(
      ownerEmail,
      JSON.stringify(skills),
      JSON.stringify(stackIds),
      updatedAt,
    )
    .run();

  return readLibrary(db, ownerEmail);
}

export function validateLibraryPayload(value: unknown): {
  skills: unknown[];
  stackIds: string[];
} | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { skills?: unknown; stackIds?: unknown };
  if (!Array.isArray(candidate.skills) || candidate.skills.length > 1000) {
    return null;
  }

  const skills = candidate.skills.filter(isSkillRecord);
  if (skills.length !== candidate.skills.length) return null;

  const stackIds = Array.isArray(candidate.stackIds)
    ? candidate.stackIds.filter(
        (item): item is string =>
          typeof item === "string" && item.length > 0 && item.length <= 180,
      )
    : [];
  if (
    Array.isArray(candidate.stackIds) &&
    stackIds.length !== candidate.stackIds.length
  ) {
    return null;
  }
  return { skills, stackIds };
}

export async function issueBridgeToken(
  db: D1Database,
  ownerEmail: string,
): Promise<{
  token: string;
  prefix: string;
  createdAt: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `${TOKEN_PREFIX}${base64Url(bytes)}`;
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const prefix = `${token.slice(0, 16)}…`;

  await db.prepare(
    `INSERT INTO bridge_tokens
       (id, owner_email, token_hash, token_prefix, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, ownerEmail, tokenHash, prefix, createdAt)
    .run();

  return { token, prefix, createdAt };
}

export async function listBridgeTokens(
  db: D1Database,
  ownerEmail: string,
): Promise<
  Array<{
    id: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>
> {
  const result = await db.prepare(
    `SELECT id, token_prefix, created_at, last_used_at
     FROM bridge_tokens
     WHERE owner_email = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(ownerEmail)
    .all<{
      id: string;
      token_prefix: string;
      created_at: string;
      last_used_at: string | null;
    }>();

  return (result.results || []).map((row) => ({
    id: row.id,
    prefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function revokeBridgeTokens(
  db: D1Database,
  ownerEmail: string,
): Promise<void> {
  await db.prepare(
    `UPDATE bridge_tokens
     SET revoked_at = ?
     WHERE owner_email = ? AND revoked_at IS NULL`,
  )
    .bind(new Date().toISOString(), ownerEmail)
    .run();
}

export async function authenticateBridgeToken(
  db: D1Database,
  request: Request,
): Promise<string | null> {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token?.startsWith(TOKEN_PREFIX)) return null;

  const tokenHash = await hashToken(token);
  const row = await db.prepare(
    `SELECT owner_email
     FROM bridge_tokens
     WHERE token_hash = ? AND revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first<TokenRow>();
  if (!row) return null;

  await db.prepare(
    `UPDATE bridge_tokens SET last_used_at = ? WHERE token_hash = ?`,
  )
    .bind(new Date().toISOString(), tokenHash)
    .run();
  return row.owner_email;
}

function isSkillRecord(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 180 &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    item.name.length <= 180 &&
    typeof item.description === "string" &&
    item.description.length <= 4000 &&
    Array.isArray(item.tags) &&
    Array.isArray(item.triggers)
  );
}

function parseArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStringArray(value: string): string[] {
  return parseArray(value).filter((item): item is string => typeof item === "string");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function allowedMetadataKeys(eventName: string) {
  switch (eventName) {
    case "session_started":
      return new Set(["surface"]);
    case "return_visit":
      return new Set(["gap"]);
    case "skill_added":
      return new Set(["source"]);
    case "library_imported":
      return new Set(["count"]);
    case "radar_searched":
      return new Set(["resultBucket", "mode"]);
    case "radar_candidate_saved":
      return new Set(["lane", "safety"]);
    case "radar_resource_saved":
    case "radar_candidate_dismissed":
      return new Set(["lane"]);
    case "stack_assembled":
    case "stack_preflight_checked":
      return new Set(["stackBucket"]);
    case "stack_exported":
    case "codex_handoff_opened":
    case "codex_sample_loaded":
    case "prompt_copied":
      return new Set(["stackBucket"]);
    case "feedback_submitted":
      return new Set(["outcome"]);
    case "installation_handshake_imported":
      return new Set(["result", "stackBucket"]);
    case "quarantine_action":
      return new Set(["action", "severity"]);
    case "skill_outcome_submitted":
      return new Set(["outcome"]);
    case "skills_network_imported":
      return new Set(["safety"]);
    case "onboarding_completed":
    case "onboarding_skipped":
      return new Set(["level"]);
    case "pwa_installed":
      return new Set(["surface"]);
    default:
      return new Set<string>();
  }
}

function normalizeAnalyticsLabel(value: unknown, fallback: string) {
  const normalized =
    typeof value === "number"
      ? String(Math.max(0, Math.min(9999, Math.round(value))))
      : typeof value === "string"
        ? value.trim().toLowerCase()
        : "";
  return /^[a-z0-9_+-]{1,32}$/.test(normalized) ? normalized : fallback;
}

function ratio(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeDisplayName(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim() || "";
  return normalized && normalized.length <= 120 ? normalized : null;
}

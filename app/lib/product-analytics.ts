"use client";

import type { Locale } from "../i18n";

export type ProductEventName =
  | "session_started"
  | "return_visit"
  | "skill_added"
  | "library_imported"
  | "radar_searched"
  | "radar_candidate_saved"
  | "radar_resource_saved"
  | "radar_candidate_dismissed"
  | "stack_assembled"
  | "stack_preflight_checked"
  | "stack_exported"
  | "codex_handoff_opened"
  | "codex_sample_loaded"
  | "prompt_copied"
  | "feedback_submitted"
  | "installation_handshake_imported"
  | "quarantine_action"
  | "skill_outcome_submitted"
  | "skills_network_imported"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "pwa_installed";

export type AnalyticsSummary = {
  generatedAt: string;
  retentionDays: number;
  totals: {
    sessions: number;
    events: number;
    activatedSessions: number;
    valueSessions: number;
    returningSessions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    conflictFeedback: number;
  };
  rates: {
    activation: number;
    value: number;
    returning: number;
    positiveFeedback: number;
  };
  funnel: Array<{
    key: "visited" | "collected" | "assembled" | "used";
    sessions: number;
  }>;
  sources: Array<{ source: string; sessions: number }>;
  events: Array<{ name: ProductEventName; count: number; sessions: number }>;
  daily: Array<{
    day: string;
    sessions: number;
    radarSaves: number;
    valueActions: number;
  }>;
};

export const ANALYTICS_PREFERENCE_KEY = "bitcase-anonymous-analytics-v1";

const SESSION_KEY = "bitcase-session-v1";
const STARTED_KEY = "bitcase-session-started-v1";
const LAST_VISIT_DAY_KEY = "bitcase-last-visit-day-v1";

export function anonymousAnalyticsEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ANALYTICS_PREFERENCE_KEY) !== "off";
}

export function setAnonymousAnalyticsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ANALYTICS_PREFERENCE_KEY,
    enabled ? "on" : "off",
  );
  if (!enabled) {
    window.localStorage.removeItem(LAST_VISIT_DAY_KEY);
  }
}

export function recordSessionStarted(locale: Locale) {
  if (typeof window === "undefined" || !anonymousAnalyticsEnabled()) return;
  if (window.sessionStorage.getItem(STARTED_KEY) === "yes") return;
  window.sessionStorage.setItem(STARTED_KEY, "yes");
  const today = new Date().toISOString().slice(0, 10);
  const lastVisitDay = window.localStorage.getItem(LAST_VISIT_DAY_KEY);
  recordProductEvent("session_started", locale, {
    surface: window.matchMedia("(display-mode: standalone)").matches
      ? "pwa"
      : "web",
  });
  if (lastVisitDay && lastVisitDay !== today) {
    recordProductEvent("return_visit", locale, { gap: "later_day" });
  }
  window.localStorage.setItem(LAST_VISIT_DAY_KEY, today);
}

export function recordProductEvent(
  event: ProductEventName,
  locale: Locale,
  metadata: Record<string, string | number> = {},
) {
  if (typeof window === "undefined" || !anonymousAnalyticsEnabled()) return;

  const payload = {
    version: 1,
    event,
    sessionId: getSessionId(),
    locale,
    acquisitionSource: getAcquisitionSource(),
    metadata,
  };

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt the product workflow.
  });
}

export function countBucket(value: number) {
  if (value <= 0) return "0";
  if (value <= 3) return "1-3";
  if (value <= 8) return "4-8";
  return "9+";
}

function getSessionId() {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const sessionId =
    globalThis.crypto?.randomUUID?.() ||
    Array.from(
      globalThis.crypto?.getRandomValues?.(new Uint8Array(16)) ||
        Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
  window.sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function getAcquisitionSource() {
  const params = new URLSearchParams(window.location.search);
  const campaignSource = sanitizeSource(params.get("utm_source"));
  if (campaignSource) {
    window.sessionStorage.setItem("bitcase-acquisition-source-v1", campaignSource);
    return campaignSource;
  }

  const stored = window.sessionStorage.getItem(
    "bitcase-acquisition-source-v1",
  );
  if (stored) return stored;

  const host = safeReferrerHost();
  const source =
    host.includes("github.") ? "github"
    : host.includes("producthunt.") ? "producthunt"
    : host.includes("openai.") || host.includes("chatgpt.") ? "openai"
    : host.includes("ycombinator.") ? "hackernews"
    : host.includes("reddit.") ? "reddit"
    : host.includes("linkedin.") ? "linkedin"
    : host.includes("x.com") || host.includes("twitter.") ? "x"
    : host ? "other_referral"
    : "direct";
  window.sessionStorage.setItem("bitcase-acquisition-source-v1", source);
  return source;
}

function safeReferrerHost() {
  try {
    return document.referrer ? new URL(document.referrer).hostname : "";
  } catch {
    return "";
  }
}

function sanitizeSource(value: string | null) {
  const normalized = value?.trim().toLowerCase() || "";
  return /^[a-z0-9_-]{1,32}$/.test(normalized) ? normalized : "";
}

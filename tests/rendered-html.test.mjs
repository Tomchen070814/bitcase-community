import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${label}-${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const baseEnv = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const context = { waitUntil() {}, passThroughOnException() {} };

test("renders the Bitcase task-first entry", async () => {
  const worker = await loadWorker("home");
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    baseEnv,
    context,
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /描述项目，配齐 Skills/);
  assert.match(html, /生成我的 Skill Stack/);
  assert.match(html, /Skill 库/);
  assert.doesNotMatch(html, /Skill Radar/);
});

test("visualizes one exact SKILL.md source for the personal library", async () => {
  const worker = await loadWorker("visualize-skill");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.github.com/repos/example/data-skills") {
      return Response.json({
        id: 51,
        name: "data-skills",
        full_name: "example/data-skills",
        html_url: "https://github.com/example/data-skills",
        description: "Data skills",
        stargazers_count: 12,
        updated_at: "2026-07-29T00:00:00.000Z",
        archived: false,
        fork: false,
        default_branch: "main",
        license: { spdx_id: "MIT" },
        topics: ["agent-skills"],
      });
    }
    if (url.endsWith("/git/trees/main?recursive=1")) {
      return Response.json({
        truncated: false,
        tree: [{ type: "blob", path: "skills/csv/SKILL.md" }],
      });
    }
    if (url.endsWith("/skills/csv/SKILL.md")) {
      return new Response(`---
name: csv-analysis
description: Analyze CSV datasets and create charts.
---

Use this skill to validate data, analyze CSV files, and create visual reports.`);
    }
    return new Response("Not found", { status: 404 });
  };
  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/skills/visualize", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          url: "https://github.com/example/data-skills/blob/main/skills/csv/SKILL.md",
        }),
      }),
      baseEnv,
      context,
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.skill.name, "csv-analysis");
    assert.equal(body.skill.responsibility, "数据处理与分析");
    assert.equal(body.skill.sourceLanguage, "en");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serves an installable PWA manifest without Radar shortcuts", async () => {
  const worker = await loadWorker("manifest");
  const response = await worker.fetch(
    new Request("http://localhost/manifest.webmanifest"),
    baseEnv,
    context,
  );
  const manifest = await response.json();
  assert.equal(response.status, 200);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.shortcuts.length, 1);
  assert.equal(manifest.shortcuts[0].short_name, "匹配");
});

test("returns 410 snapshot_only for every removed live-discovery route", async () => {
  const worker = await loadWorker("snapshot-only");
  for (const path of ["/api/discover", "/api/inspect", "/api/skills-network/resolve"]) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`, { method: "POST" }),
      baseEnv,
      context,
    );
    const body = await response.json();
    assert.equal(response.status, 410);
    assert.equal(body.error, "snapshot_only");
  }
});

test("keeps unrelated removed Radar routes unavailable", async () => {
  const worker = await loadWorker("legacy-api");
  const response = await worker.fetch(
    new Request("http://localhost/api/radar/inspect", { method: "POST" }),
    baseEnv,
    context,
  );
  assert.equal(response.status, 404);
});

test("validates a project brief before contacting the snapshot service", async () => {
  const worker = await loadWorker("compose-validation");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("unexpected", { status: 500 });
  };
  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ brief: "短" }),
      }),
      { ...baseEnv, BITCASE_INDEX_API_URL: "https://index.example" },
      context,
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("proxies compose only to the independent active-snapshot API", async () => {
  const worker = await loadWorker("snapshot-compose");
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  globalThis.fetch = async (input, init) => {
    calledUrl = String(input);
    assert.equal(calledUrl, "https://index.example/api/search");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.query, "分析实验室 CSV 数据并生成图表");
    assert.deepEqual(body.library, []);
    return Response.json(
      {
        project: body.query,
        plan: { kindLabel: "数据处理工作流", responsibilities: ["数据处理与分析"] },
        coverage: { covered: ["数据处理与分析"], missing: [] },
        skills: [{ id: "example/csv:SKILL.md", name: "csv-analysis" }],
        search: {
          strategy: "active-snapshot",
          indexVersion: "20260731-a91c",
          rankerVersion: "ranker-v5",
          builtAt: "2026-07-31T00:00:00.000Z",
        },
      },
      {
        headers: {
          "cache-control": "public, max-age=300",
          "x-bitcase-index-version": "20260731-a91c",
        },
      },
    );
  };
  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ brief: "分析实验室 CSV 数据并生成图表" }),
      }),
      { ...baseEnv, BITCASE_INDEX_API_URL: "https://index.example/" },
      context,
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.search.strategy, "active-snapshot");
    assert.equal(body.search.indexVersion, "20260731-a91c");
    assert.equal(response.headers.get("x-bitcase-index-version"), "20260731-a91c");
    assert.equal(calledUrl, "https://index.example/api/search");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails closed when the snapshot API is not configured", async () => {
  const worker = await loadWorker("snapshot-unconfigured");
  const response = await worker.fetch(
    new Request("http://localhost/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ brief: "分析实验室 CSV 数据并生成图表" }),
    }),
    baseEnv,
    context,
  );
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "snapshot_service_unconfigured");
});

test("blocks cross-origin compose requests before snapshot access", async () => {
  const worker = await loadWorker("compose-origin");
  const response = await worker.fetch(
    new Request("http://localhost/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ brief: "分析实验室 CSV 数据并生成图表" }),
    }),
    { ...baseEnv, BITCASE_INDEX_API_URL: "https://index.example" },
    context,
  );
  assert.equal(response.status, 403);
});

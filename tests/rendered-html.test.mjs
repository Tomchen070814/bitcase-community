import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("serves an installable PWA manifest", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("manifest-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/manifest.webmanifest"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/manifest\+json\b/i,
  );
  const manifest = await response.json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "192x192" && icon.type === "image/png",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
    ),
  );
});

test("service worker never caches private API routes", async () => {
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(source, /SHELL_ASSETS\s*=\s*\[[^\]]*\/api\//s);
});

test("anonymous telemetry stores only the allowlisted event shape", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("telemetry-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return { sql, values };
        },
      };
    },
    async batch(statements) {
      writes.push(...statements);
      return [];
    },
  };

  const response = await worker.fetch(
    new Request("http://localhost/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 1,
        event: "stack_exported",
        sessionId: "9b122cab-75c4-4e55-9c9f-53c8480c5fc1",
        locale: "zh-CN",
        acquisitionSource: "github",
        metadata: {
          stackBucket: "4-8",
          projectBrief: "private project text must not be stored",
        },
      }),
    }),
    { DB: db },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 202);
  assert.equal(writes.length, 2);
  const storedValues = JSON.stringify(writes[0].values);
  assert.match(storedValues, /stackBucket/);
  assert.doesNotMatch(storedValues, /private project text/);
});

test("private insight summary is hidden from non-owners", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("insight-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/analytics/summary", {
      headers: { "oai-authenticated-user-email": "visitor@example.com" },
    }),
    {
      DB: {},
      BITCASE_OWNER_EMAIL: "owner@example.com",
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 404);
});

test("Radar inspects SKILL.md through the same-origin worker", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("radar-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  const skill = `---
name: example-skill
description: Checks a repository before release
---

Review the repository and report actionable findings.
`;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get("user-agent"), "Bitcase-Radar-Alpha");
    if (url.includes("/git/trees/main?recursive=1")) {
      return Response.json({
        truncated: false,
        tree: [{ type: "blob", path: "SKILL.md" }],
      });
    }
    assert.match(
      url,
      /^https:\/\/raw\.githubusercontent\.com\/example\/skill\/main\/SKILL\.md/,
    );
    return new Response(skill, {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "content-length": String(Buffer.byteLength(skill)),
      },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/radar/inspect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          fullName: "example/skill",
          defaultBranch: "main",
        }),
      }),
      { DB: {} },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.result.status, "clean");
    assert.equal(payload.result.skillPath, "SKILL.md");
    assert.equal(
      payload.result.description,
      "Checks a repository before release",
    );
    assert.match(payload.result.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(payload).includes(skill), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Radar reports GitHub rate limits with a retry time", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("radar-limit-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  const reset = Math.floor(Date.now() / 1000) + 900;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
      status: 403,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(reset),
      },
    });

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/radar/inspect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          fullName: "example/skill",
          defaultBranch: "main",
        }),
      }),
      { DB: {} },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 429);
    assert.equal(payload.error, "rate_limited");
    assert.equal(payload.retryAt, new Date(reset * 1000).toISOString());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Radar discovers nested SKILL.md files with one GitHub API lookup", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("radar-nested-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  const skill = `---
name: nested-skill
description: Lives below the repository root
---
`;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("/git/trees/main?recursive=1")) {
      return new Response(
        JSON.stringify({
          truncated: false,
          tree: [{ type: "blob", path: "skills/nested/SKILL.md" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.endsWith("/main/skills/nested/SKILL.md")) {
      return new Response(skill, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/radar/inspect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          fullName: "example/skill",
          defaultBranch: "main",
        }),
      }),
      { DB: {} },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.result.status, "clean");
    assert.equal(payload.result.skillPath, "skills/nested/SKILL.md");
    assert.equal(requestedUrls.length, 2);
    assert.equal(
      requestedUrls.filter((url) => url.startsWith("https://api.github.com"))
        .length,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

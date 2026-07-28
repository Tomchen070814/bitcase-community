import assert from "node:assert/strict";
import test from "node:test";
import {
  planRadarQueries,
  RadarAiError,
  validateRadarAiInput,
} from "../app/lib/radar-ai.ts";

const input = {
  seed: "帮助硬件工程师整理测试流程",
  locale: "zh-CN",
  interests: ["hardware testing", "technical documentation"],
  likedTopics: ["automation"],
  dislikedTopics: ["marketing"],
};

test("validates and bounds Radar AI context", () => {
  const result = validateRadarAiInput(input);
  assert.equal(result?.seed, input.seed);
  assert.deepEqual(result?.interests, input.interests);
  assert.equal(
    validateRadarAiInput({
      seed: "",
      interests: [],
      likedTopics: [],
      dislikedTopics: [],
    }),
    null,
  );
});

test("calls the FreeLLMAPI OpenAI-compatible endpoint with Kimi K2.6", async () => {
  const plan = await planRadarQueries(input, {
    provider: "freellmapi",
    baseUrl: "https://router.example.com/v1",
    apiKey: "freellmapi-test-key",
    model: "kimi-k2.6",
    fetcher: async (url, init) => {
      assert.equal(
        url,
        "https://router.example.com/v1/chat/completions",
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer freellmapi-test-key",
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "kimi-k2.6");
      assert.match(body.messages[1].content, /hardware testing/);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  queries: [
                    {
                      lane: "focus",
                      topic: "hardware test automation",
                      rationale: "直接匹配硬件测试工作流。",
                    },
                    {
                      lane: "adjacent",
                      topic: "engineering test documentation",
                      rationale: "补充测试记录与交接能力。",
                    },
                    {
                      lane: "wildcard",
                      topic: "scientific reproducibility workflow",
                      rationale: "借鉴科研复现方法。",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(plan.provider, "freellmapi");
  assert.equal(plan.model, "kimi-k2.6");
  assert.deepEqual(
    plan.queries.map((query) => query.lane),
    ["focus", "adjacent", "wildcard"],
  );
});

test("calls Cloudflare Workers AI directly with Kimi K2.6", async () => {
  const plan = await planRadarQueries(input, {
    provider: "cloudflare",
    accountId: "0123456789abcdef0123456789abcdef",
    apiToken: "cloudflare-test-token",
    model: "@cf/moonshotai/kimi-k2.6",
    fetcher: async (url, init) => {
      assert.equal(
        url,
        "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions",
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer cloudflare-test-token",
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "@cf/moonshotai/kimi-k2.6");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  queries: [
                    {
                      lane: "focus",
                      topic: "hardware test automation",
                      rationale: "Directly matches hardware testing.",
                    },
                    {
                      lane: "adjacent",
                      topic: "engineering test documentation",
                      rationale: "Adds durable test documentation.",
                    },
                    {
                      lane: "wildcard",
                      topic: "scientific reproducibility workflow",
                      rationale: "Transfers reproducibility practices.",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(plan.provider, "cloudflare");
  assert.equal(plan.model, "@cf/moonshotai/kimi-k2.6");
});

test("rejects unsafe endpoints and invalid model output", async () => {
  await assert.rejects(
    () =>
      planRadarQueries(input, {
        provider: "freellmapi",
        baseUrl: "http://router.example.com/v1",
        apiKey: "test-key",
        model: "kimi-k2.6",
      }),
    (error) =>
      error instanceof RadarAiError &&
      error.code === "ai_not_configured",
  );

  await assert.rejects(
    () =>
      planRadarQueries(input, {
        provider: "freellmapi",
        baseUrl: "http://127.0.0.1:3001/v1",
        apiKey: "test-key",
        model: "kimi-k2.6",
        fetcher: async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"queries":[]}' } }],
            }),
            { status: 200 },
          ),
      }),
    (error) =>
      error instanceof RadarAiError &&
      error.code === "ai_invalid_response",
  );

  await assert.rejects(
    () =>
      planRadarQueries(input, {
        provider: "cloudflare",
        accountId: "not-an-account-id",
        apiToken: "test-token",
        model: "@cf/moonshotai/kimi-k2.6",
      }),
    (error) =>
      error instanceof RadarAiError &&
      error.code === "ai_not_configured",
  );
});

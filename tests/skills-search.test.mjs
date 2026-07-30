import assert from "node:assert/strict";
import test from "node:test";

import {
  diversifySkillsCatalog,
  searchSkillsCatalog,
  SkillsCatalogError,
} from "../app/lib/skills-search.ts";

test("searches the same public skills.sh catalog endpoint as find-skills", async () => {
  const requested = [];
  const entries = await searchSkillsCatalog(
    [
      {
        topic: "data analysis spreadsheet",
        responsibility: "data",
        limit: 4,
      },
      {
        topic: "testing quality assurance",
        responsibility: "testing",
        limit: 4,
      },
    ],
    {
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        requested.push(url);
        assert.equal(url.origin, "https://skills.sh");
        assert.equal(url.pathname, "/api/search");
        assert.equal(url.searchParams.get("limit"), "4");
        assert.equal(
          new Headers(init?.headers).get("user-agent"),
          "Bitcase-Skill-Discovery",
        );
        const isData = url.searchParams.get("q")?.includes("spreadsheet");
        return Response.json({
          skills: isData
            ? [
                {
                  id: "example/skills/csv-analysis",
                  name: "CSV Analysis",
                  source: "example/skills",
                  installs: 2400,
                },
                {
                  id: "wrong-source/skill",
                  name: "Rejected",
                  source: "not a repository",
                  installs: 999999,
                },
              ]
            : [
                {
                  id: "example/quality/tdd",
                  name: "TDD",
                  source: "example/quality",
                  installs: 800,
                },
              ],
        });
      },
    },
  );

  assert.equal(requested.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ["example/skills/csv-analysis", "example/quality/tdd"],
  );
  assert.equal(entries[0].url, "https://skills.sh/example/skills/csv-analysis");
  assert.equal(entries[0].responsibility, "data");
  assert.equal(entries[0].installs, 2400);
});

test("diversifies catalog candidates across project responsibilities", () => {
  const entry = (id, responsibility, queryRank, installs) => ({
    id,
    name: id,
    source: "example/skills",
    slug: id,
    url: `https://skills.sh/example/skills/${id}`,
    installUrl: "https://github.com/example/skills",
    responsibility,
    queryRank,
    installs,
  });
  const selected = diversifySkillsCatalog(
    [
      entry("ui-one", "ui", 0, 9000),
      entry("ui-two", "ui", 1, 8000),
      entry("storage", "persistence", 0, 100),
      entry("testing", "testing", 0, 50),
    ],
    3,
  );
  assert.deepEqual(
    selected.map((item) => item.id),
    ["ui-one", "storage", "testing"],
  );
});

test("rejects invalid catalog queries before making a request", async () => {
  await assert.rejects(
    () =>
      searchSkillsCatalog(
        [{ topic: "x", responsibility: "data" }],
        {
          fetcher: async () => {
            throw new Error("must not fetch");
          },
        },
      ),
    (error) =>
      error instanceof SkillsCatalogError &&
      error.code === "invalid_catalog_search",
  );
});

test("keeps successful responsibility searches when another catalog query fails", async () => {
  const entries = await searchSkillsCatalog(
    [
      { topic: "data analysis", responsibility: "data" },
      { topic: "testing quality", responsibility: "testing" },
    ],
    {
      fetcher: async (input) => {
        const query = new URL(String(input)).searchParams.get("q");
        if (query?.includes("testing")) {
          return new Response("busy", { status: 503 });
        }
        return Response.json({
          skills: [{
            id: "example/data/csv",
            name: "CSV",
            source: "example/data",
            installs: 10,
          }],
        });
      },
    },
  );
  assert.deepEqual(entries.map((entry) => entry.id), ["example/data/csv"]);
});

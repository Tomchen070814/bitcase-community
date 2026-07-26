import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSkillsShFeedHtml,
  parseSkillsShSkillUrl,
  resolveSkillsNetworkSkill,
} from "../app/lib/skills-network.ts";

test("accepts only exact skills.sh skill URLs", () => {
  assert.deepEqual(
    parseSkillsShSkillUrl(
      "https://skills.sh/vercel-labs/skills/find-skills",
    ),
    {
      id: "vercel-labs/skills/find-skills",
      owner: "vercel-labs",
      repository: "skills",
      source: "vercel-labs/skills",
      slug: "find-skills",
      url: "https://skills.sh/vercel-labs/skills/find-skills",
      installUrl: "https://github.com/vercel-labs/skills",
    },
  );
  assert.equal(parseSkillsShSkillUrl("https://skills.sh/docs/api"), null);
  assert.equal(
    parseSkillsShSkillUrl(
      "https://github.com/vercel-labs/skills/find-skills",
    ),
    null,
  );
});

test("extracts unique skills from the public skills.sh directory HTML", () => {
  const html = `
    <a href="/vercel-labs/skills/find-skills">#1 find-skills 2.7M installs</a>
    <a href="/anthropics/skills/frontend-design">#2 frontend-design 704.7K installs</a>
    <a href="/vercel-labs/skills/find-skills">duplicate</a>
    <a href="/docs/api">API docs</a>
  `;
  const entries = parseSkillsShFeedHtml(html, "trending");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, "vercel-labs/skills/find-skills");
  assert.equal(entries[0].rank, 1);
  assert.equal(entries[0].installsLabel, "2.7M");
  assert.equal(entries[1].view, "trending");
});

test("resolves one skills.sh URL to its exact SKILL.md in a multi-skill repo", async () => {
  const fetcher = async (input) => {
    const url = String(input);
    if (url === "https://api.github.com/repos/example/catalog") {
      return Response.json({
        id: 42,
        name: "catalog",
        full_name: "example/catalog",
        html_url: "https://github.com/example/catalog",
        description: "Example skill catalog",
        stargazers_count: 18,
        updated_at: "2026-07-25T00:00:00.000Z",
        archived: false,
        fork: false,
        default_branch: "main",
        license: { spdx_id: "MIT" },
        topics: ["agent-skills"],
      });
    }
    if (
      url ===
      "https://api.github.com/repos/example/catalog/git/trees/main?recursive=1"
    ) {
      return Response.json({
        truncated: false,
        tree: [
          { type: "blob", path: "skills/first/SKILL.md" },
          { type: "blob", path: "skills/second/SKILL.md" },
        ],
      });
    }
    if (
      url ===
      "https://raw.githubusercontent.com/example/catalog/main/skills/first/SKILL.md"
    ) {
      return new Response(`---
name: first
description: First example workflow
---

Use this for the first workflow.
`);
    }
    if (
      url ===
      "https://raw.githubusercontent.com/example/catalog/main/skills/second/SKILL.md"
    ) {
      return new Response(`---
name: second
description: Second example workflow
---

Use this for the second workflow.
`);
    }
    return new Response("Not found", { status: 404 });
  };

  const resolved = await resolveSkillsNetworkSkill(
    "https://skills.sh/example/catalog/second",
    "en",
    { fetcher },
  );
  assert.equal(resolved.selectedSkillPath, "skills/second/SKILL.md");
  assert.equal(resolved.inspection.fileCount, 2);
  assert.equal(resolved.repository.fullName, "example/catalog");
});

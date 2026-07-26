import assert from "node:assert/strict";
import test from "node:test";
import { localizeDecisionProfile } from "../app/skill-copy.ts";

const emptyProfile = {
  overview: "",
  capabilities: [],
  useWhen: [],
  workflow: [],
  requirements: [],
  limitations: [],
  examples: [],
};

test("distinguishes the four repository types shown in the Radar critique", () => {
  const cases = [
    [
      {
        name: "skill-of-skills",
        description:
          "The autonomous discovery engine indexes skills, plugins, MCP servers, and agents.",
        topics: ["discovery-engine", "skills"],
      },
      1,
      "Skill 索引与发现引擎",
    ],
    [
      {
        name: "OpenCaw",
        description:
          "Standardizes instructions, roles, commands, architecture guidance, and sub-agent orchestration.",
        topics: ["codex", "claude"],
      },
      12,
      "Agent 工程操作框架",
    ],
    [
      {
        name: "token-goat",
        description:
          "Token burn reducer with file interception, compact context, and cached MCP calls.",
        topics: ["token", "context"],
      },
      1,
      "Token 与上下文优化层",
    ],
    [
      {
        name: "aigent-os",
        description:
          "Persistent memory across sessions with checkpoints so users never re-brief the agent.",
        topics: ["memory", "context"],
      },
      1,
      "Agent 跨会话记忆层",
    ],
  ];

  for (const [repository, skillCount, expectedKind] of cases) {
    assert.equal(
      localizeDecisionProfile(
        repository,
        emptyProfile,
        "zh-CN",
        skillCount,
      ).kind,
      expectedKind,
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticatedIdentity,
  readBetaAccount,
} from "../app/lib/bitcase-cloud.ts";

test("normalizes the authenticated ChatGPT identity", () => {
  const request = new Request("https://bitcase.example/api/account", {
    headers: {
      "oai-authenticated-user-email": " User@Example.com ",
      "oai-authenticated-user-full-name": "Louis%20Chen",
      "oai-authenticated-user-full-name-encoding":
        "percent-encoded-utf-8",
    },
  });

  assert.deepEqual(authenticatedIdentity(request), {
    email: "user@example.com",
    displayName: "Louis Chen",
  });
});

test("creates a durable Beta account without storing a password", async () => {
  const writes = [];
  const accountRow = {
    id: "account-1",
    email: "user@example.com",
    display_name: "Louis Chen",
    auth_provider: "chatgpt",
    plan: "beta",
    locale: "zh-CN",
    created_at: "2026-07-26T00:00:00.000Z",
    last_seen_at: "2026-07-26T00:00:00.000Z",
  };
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              writes.push({ sql, values });
            },
            async first() {
              return accountRow;
            },
          };
        },
      };
    },
  };

  const account = await readBetaAccount(
    db,
    { email: "user@example.com", displayName: "Louis Chen" },
    "zh-CN",
  );

  assert.equal(account.plan, "beta");
  assert.equal(account.authProvider, "chatgpt");
  assert.equal(account.displayName, "Louis Chen");
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO beta_accounts/);
  assert.doesNotMatch(writes[0].sql, /password|credential/i);
});

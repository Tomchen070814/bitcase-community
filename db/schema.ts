import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const betaAccounts = sqliteTable(
  "beta_accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    authProvider: text("auth_provider").notNull().default("chatgpt"),
    plan: text("plan").notNull().default("beta"),
    locale: text("locale").notNull().default("en"),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("beta_accounts_email_unique").on(table.email),
    index("beta_accounts_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const skillLibraries = sqliteTable("skill_libraries", {
  ownerEmail: text("owner_email").primaryKey(),
  skillsJson: text("skills_json").notNull(),
  stackJson: text("stack_json").notNull().default("[]"),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const bridgeTokens = sqliteTable(
  "bridge_tokens",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("bridge_tokens_hash_unique").on(table.tokenHash),
    index("bridge_tokens_owner_idx").on(table.ownerEmail),
  ],
);

export const productEvents = sqliteTable(
  "product_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    sessionId: text("session_id").notNull(),
    locale: text("locale").notNull(),
    acquisitionSource: text("acquisition_source").notNull().default("direct"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("product_events_created_idx").on(table.createdAt),
    index("product_events_event_idx").on(table.eventName),
    index("product_events_session_idx").on(table.sessionId),
  ],
);

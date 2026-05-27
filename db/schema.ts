import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "snoozed",
  "booked",
  "closed",
]);

export const messageDirectionEnum = pgEnum("message_direction", ["in", "out"]);

export const messageSenderEnum = pgEnum("message_sender", [
  "lead",
  "setter",
  "automation",
  "claude",
  "system",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sent",
  "failed",
]);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "ready",
  "accepted",
  "rejected",
  "superseded",
  "error",
]);

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  manychatApiKeyEncrypted: text("manychat_api_key_encrypted").notNull(),
  webhookToken: text("webhook_token").notNull().unique(),
  claudeSystemPrompt: text("claude_system_prompt")
    .notNull()
    .default(
      "You are a friendly, concise setter for an Instagram-DM funnel. Suggest the next single message to send. Match the conversation tone, keep it under 280 characters, drive toward booking a call when context supports it. Output only the message text — no preamble, no quotes."
    ),
  claudeModel: text("claude_model").notNull().default("claude-opus-4-7"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id").notNull(),
    igUsername: text("ig_username"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    status: conversationStatusEnum("status").notNull().default("open"),
    unreadCount: integer("unread_count").notNull().default(0),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_page_subscriber_uq").on(t.pageId, t.subscriberId),
    index("conversations_last_msg_idx").on(t.lastMessageAt),
    index("conversations_status_idx").on(t.status),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    sender: messageSenderEnum("sender").notNull(),
    text: text("text").notNull(),
    status: messageStatusEnum("status").notNull().default("sent"),
    error: text("error"),
    automationId: uuid("automation_id"),
    suggestionId: uuid("suggestion_id"),
    externalMessageId: text("external_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("messages_conv_extid_uq")
      .on(t.conversationId, t.externalMessageId)
      .where(sql`${t.externalMessageId} IS NOT NULL`),
    index("messages_conv_created_idx").on(t.conversationId, t.createdAt),
  ]
);

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("automations_page_sort_idx").on(t.pageId, t.sortOrder)]
);

export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    triggeredByMessageId: uuid("triggered_by_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    status: suggestionStatusEnum("status").notNull().default("pending"),
    text: text("text"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    error: text("error"),
    jobId: text("job_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("suggestions_conv_status_idx").on(t.conversationId, t.status),
  ]
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id"),
  conversationId: uuid("conversation_id"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const magicLinks = pgTable("magic_links", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const pagesRelations = relations(pages, ({ many }) => ({
  conversations: many(conversations),
  automations: many(automations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  page: one(pages, { fields: [conversations.pageId], references: [pages.id] }),
  messages: many(messages),
  suggestions: many(suggestions),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [suggestions.conversationId],
    references: [conversations.id],
  }),
  triggeredByMessage: one(messages, {
    fields: [suggestions.triggeredByMessageId],
    references: [messages.id],
  }),
}));

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;

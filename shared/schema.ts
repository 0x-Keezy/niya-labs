import { pgTable, serial, text, integer, timestamp, varchar, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id"),
  visitorName: text("visitor_name"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  emotion: text("emotion"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatQueue = pgTable("chat_queue", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  visitorName: text("visitor_name").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  position: integer("position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const viewers = pgTable("viewers", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull().unique(),
  name: text("name").notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  messageCount: integer("message_count").default(0),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  visitorId: text("visitor_id"),
  title: varchar("title", { length: 255 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
});

export const memoryFacts = pgTable("memory_facts", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id"),
  factType: varchar("fact_type", { length: 50 }).notNull(),
  content: text("content").notNull(),
  importance: integer("importance").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const emotionalState = pgTable("emotional_state", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id"),
  emotion: varchar("emotion", { length: 50 }).notNull(),
  intensity: integer("intensity").default(50),
  trigger: text("trigger"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  count: integer("count").default(1),
  windowStart: timestamp("window_start").defaultNow().notNull(),
});

export const xDrafts = pgTable("x_drafts", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  replyToTweetId: varchar("reply_to_tweet_id", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  tweetId: varchar("tweet_id", { length: 50 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  postedAt: timestamp("posted_at"),
});

// Server-side session store for the admin dashboard. The raw session token
// lives only in the browser's HttpOnly cookie; we persist only its HMAC
// hash so a DB leak cannot be used to forge a live session.
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
export type AdminSession = typeof adminSessions.$inferSelect;

export const sessionMessagesRelation = relations(chatSessions, ({ many }) => ({
  messages: many(chatMessages),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export const insertChatQueueSchema = createInsertSchema(chatQueue).omit({ id: true });
export const insertViewerSchema = createInsertSchema(viewers).omit({ id: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true });
export const insertMemoryFactSchema = createInsertSchema(memoryFacts).omit({ id: true });
export const insertEmotionalStateSchema = createInsertSchema(emotionalState).omit({ id: true });
export const insertRateLimitSchema = createInsertSchema(rateLimits).omit({ id: true });
export const insertXDraftSchema = createInsertSchema(xDrafts).omit({ id: true, createdAt: true, postedAt: true, tweetId: true, errorMessage: true });

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatQueue = typeof chatQueue.$inferSelect;
export type InsertChatQueue = z.infer<typeof insertChatQueueSchema>;
export type Viewer = typeof viewers.$inferSelect;
export type InsertViewer = z.infer<typeof insertViewerSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type MemoryFact = typeof memoryFacts.$inferSelect;
export type InsertMemoryFact = z.infer<typeof insertMemoryFactSchema>;
export type EmotionalState = typeof emotionalState.$inferSelect;
export type InsertEmotionalState = z.infer<typeof insertEmotionalStateSchema>;
export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type XDraft = typeof xDrafts.$inferSelect;
export type InsertXDraft = z.infer<typeof insertXDraftSchema>;

// --- Nyla Tools (Chrome extension) ---
// Cache of the per-token microstructure analysis returned by
// /api/nyla-tools/microstructure. The endpoint is hot-cached for 10 min so
// rapid CA switches in the side panel don't burn BscScan / Moralis quotas.
export const nylaMicrostructureCache = pgTable("nyla_microstructure_cache", {
  ca: varchar("ca", { length: 42 }).primaryKey(),
  data: jsonb("data").notNull(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});
export type NylaMicrostructureCache = typeof nylaMicrostructureCache.$inferSelect;

// Wallet age cache for the Day 7 tier system. Looked up from BscScan
// txlist (oldest tx). Cached for 7 days because wallet age changes
// monotonically and is cheap to be slightly stale.
export const nylaWalletAge = pgTable("nyla_wallet_age", {
  address: varchar("address", { length: 42 }).primaryKey(),
  firstTxTimestamp: timestamp("first_tx_timestamp"),
  ageDays: integer("age_days").notNull(),
  tier: varchar("tier", { length: 16 }).notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});
export type NylaWalletAge = typeof nylaWalletAge.$inferSelect;

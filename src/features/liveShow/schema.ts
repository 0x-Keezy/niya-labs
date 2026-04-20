import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatQueue = pgTable("chat_queue", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  visitorName: text("visitor_name").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  position: integer("position"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const viewers = pgTable("viewers", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull().unique(),
  name: text("name").notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  messageCount: integer("message_count").default(0),
  walletAddress: text("wallet_address"),
  ipAddress: text("ip_address"),
});

export const chatQueueRelations = relations(chatQueue, ({ one }: { one: any }) => ({
  viewer: one(viewers, {
    fields: [chatQueue.visitorId],
    references: [viewers.visitorId],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }: { one: any }) => ({
  viewer: one(viewers, {
    fields: [chatMessages.visitorId],
    references: [viewers.visitorId],
  }),
}));

export const insertChatQueueSchema = createInsertSchema(chatQueue).omit({
  id: true,
  createdAt: true,
  position: true,
  status: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertViewerSchema = createInsertSchema(viewers).omit({
  id: true,
  lastSeen: true,
  messageCount: true,
});

export const broadcastMedia = pgTable("broadcast_media", {
  id: serial("id").primaryKey(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull().default("youtube"),
  title: text("title"),
  addedBy: text("added_by"),
  status: text("status").notNull().default("queued"),
  playedAt: timestamp("played_at"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const broadcastState = pgTable("broadcast_state", {
  id: serial("id").primaryKey(),
  currentMediaId: integer("current_media_id"),
  startedAt: timestamp("started_at"),
  isPaused: boolean("is_paused").default(false),
  pausedAt: integer("paused_at"),
  viewerCount: integer("viewer_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const broadcastReactions = pgTable("broadcast_reactions", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  reaction: text("reaction").notNull(),
  timestamp: integer("timestamp"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBroadcastMediaSchema = createInsertSchema(broadcastMedia).omit({
  id: true,
  createdAt: true,
  playedAt: true,
  status: true,
});

export const insertBroadcastReactionSchema = createInsertSchema(broadcastReactions).omit({
  id: true,
  createdAt: true,
});

export type ChatQueueItem = typeof chatQueue.$inferSelect;
export type InsertChatQueueItem = z.infer<typeof insertChatQueueSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type Viewer = typeof viewers.$inferSelect;
export type InsertViewer = z.infer<typeof insertViewerSchema>;
export type BroadcastMedia = typeof broadcastMedia.$inferSelect;
export type InsertBroadcastMedia = z.infer<typeof insertBroadcastMediaSchema>;
export type BroadcastState = typeof broadcastState.$inferSelect;
export type BroadcastReaction = typeof broadcastReactions.$inferSelect;
export type InsertBroadcastReaction = z.infer<typeof insertBroadcastReactionSchema>;

// Audio broadcast for TTS synchronization across all viewers
export const broadcastAudio = pgTable("broadcast_audio", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id"),
  audioData: text("audio_data"), // Base64 encoded audio or URL
  text: text("text").notNull(),
  emotion: text("emotion"),
  duration: integer("duration"), // Duration in milliseconds
  status: text("status").notNull().default("pending"), // pending, playing, completed
  playedAt: timestamp("played_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Current avatar state for synchronization
export const avatarState = pgTable("avatar_state", {
  id: serial("id").primaryKey(),
  isSpeaking: boolean("is_speaking").default(false),
  currentEmotion: text("current_emotion").default("neutral"),
  currentAudioId: integer("current_audio_id"),
  lipSyncData: text("lip_sync_data"), // JSON for lip sync timing
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertBroadcastAudioSchema = createInsertSchema(broadcastAudio).omit({
  id: true,
  createdAt: true,
  playedAt: true,
});

export type BroadcastAudio = typeof broadcastAudio.$inferSelect;
export type InsertBroadcastAudio = z.infer<typeof insertBroadcastAudioSchema>;
export type AvatarState = typeof avatarState.$inferSelect;

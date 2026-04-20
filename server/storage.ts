import { 
  chatMessages, chatQueue, viewers, chatSessions, memoryFacts, emotionalState, xDrafts, rateLimits,
  type ChatMessage, type InsertChatMessage,
  type ChatQueue, type InsertChatQueue,
  type Viewer, type InsertViewer,
  type ChatSession, type InsertChatSession,
  type MemoryFact, type InsertMemoryFact,
  type EmotionalState, type InsertEmotionalState,
  type XDraft, type InsertXDraft
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

export interface IStorage {
  saveMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getMessages(limit?: number): Promise<ChatMessage[]>;
  getMessagesByVisitor(visitorId: string, limit?: number): Promise<ChatMessage[]>;
  
  addToQueue(item: InsertChatQueue): Promise<ChatQueue>;
  getQueue(): Promise<ChatQueue[]>;
  updateQueueStatus(id: number, status: string): Promise<void>;
  removeFromQueue(id: number): Promise<void>;
  
  upsertViewer(viewer: InsertViewer): Promise<Viewer>;
  getViewer(visitorId: string): Promise<Viewer | undefined>;
  getActiveViewers(sinceMinutes?: number): Promise<Viewer[]>;
  
  createSession(session: InsertChatSession): Promise<ChatSession>;
  getSession(sessionId: string): Promise<ChatSession | undefined>;
  updateSessionLastMessage(sessionId: string): Promise<void>;
  
  saveFact(fact: InsertMemoryFact): Promise<MemoryFact>;
  getFacts(visitorId?: string, limit?: number): Promise<MemoryFact[]>;
  
  saveEmotionalState(state: InsertEmotionalState): Promise<EmotionalState>;
  getEmotionalHistory(visitorId?: string, limit?: number): Promise<EmotionalState[]>;
  
  createDraft(draft: InsertXDraft): Promise<XDraft>;
  getDrafts(status?: string, limit?: number): Promise<XDraft[]>;
  getDraft(id: number): Promise<XDraft | undefined>;
  updateDraftStatus(id: number, status: string, tweetId?: string, errorMessage?: string): Promise<XDraft | undefined>;
  deleteDraft(id: number): Promise<void>;
  
  checkRateLimit(identifier: string, endpoint: string, windowMs: number, maxCount: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
  recordRateLimit(identifier: string, endpoint: string, windowMs?: number): Promise<void>;
  /** Atomic check-and-increment. Serializes concurrent requests from the
   *  same (identifier, endpoint, window) bucket using SELECT FOR UPDATE,
   *  so two requests arriving simultaneously can't both pass when exactly
   *  one slot is left. Prefer this over the split check+record pair. */
  checkAndConsumeRateLimit(
    identifier: string,
    endpoint: string,
    windowMs: number,
    maxCount: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
}

export class DatabaseStorage implements IStorage {
  async saveMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [saved] = await db.insert(chatMessages).values(message).returning();
    return saved;
  }

  async getMessages(limit = 50): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt)).limit(limit);
  }

  async getMessagesByVisitor(visitorId: string, limit = 50): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.visitorId, visitorId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async addToQueue(item: InsertChatQueue): Promise<ChatQueue> {
    const [saved] = await db.insert(chatQueue).values(item).returning();
    return saved;
  }

  async getQueue(): Promise<ChatQueue[]> {
    return db.select().from(chatQueue)
      .where(eq(chatQueue.status, "pending"))
      .orderBy(chatQueue.position);
  }

  async updateQueueStatus(id: number, status: string): Promise<void> {
    await db.update(chatQueue).set({ status }).where(eq(chatQueue.id, id));
  }

  async removeFromQueue(id: number): Promise<void> {
    await db.delete(chatQueue).where(eq(chatQueue.id, id));
  }

  async upsertViewer(viewer: InsertViewer): Promise<Viewer> {
    const existing = await this.getViewer(viewer.visitorId);
    if (existing) {
      await db.update(viewers)
        .set({ lastSeen: new Date(), name: viewer.name })
        .where(eq(viewers.visitorId, viewer.visitorId));
      return { ...existing, lastSeen: new Date(), name: viewer.name };
    }
    const [saved] = await db.insert(viewers).values(viewer).returning();
    return saved;
  }

  async getViewer(visitorId: string): Promise<Viewer | undefined> {
    const [viewer] = await db.select().from(viewers).where(eq(viewers.visitorId, visitorId));
    return viewer || undefined;
  }

  async getActiveViewers(sinceMinutes = 5): Promise<Viewer[]> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return db.select().from(viewers).where(gte(viewers.lastSeen, since));
  }

  async createSession(session: InsertChatSession): Promise<ChatSession> {
    const [saved] = await db.insert(chatSessions).values(session).returning();
    return saved;
  }

  async getSession(sessionId: string): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId));
    return session || undefined;
  }

  async updateSessionLastMessage(sessionId: string): Promise<void> {
    await db.update(chatSessions)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatSessions.sessionId, sessionId));
  }

  async saveFact(fact: InsertMemoryFact): Promise<MemoryFact> {
    const [saved] = await db.insert(memoryFacts).values(fact).returning();
    return saved;
  }

  async getFacts(visitorId?: string, limit = 20): Promise<MemoryFact[]> {
    if (visitorId) {
      return db.select().from(memoryFacts)
        .where(eq(memoryFacts.visitorId, visitorId))
        .orderBy(desc(memoryFacts.importance))
        .limit(limit);
    }
    return db.select().from(memoryFacts)
      .orderBy(desc(memoryFacts.importance))
      .limit(limit);
  }

  async saveEmotionalState(state: InsertEmotionalState): Promise<EmotionalState> {
    const [saved] = await db.insert(emotionalState).values(state).returning();
    return saved;
  }

  async getEmotionalHistory(visitorId?: string, limit = 10): Promise<EmotionalState[]> {
    if (visitorId) {
      return db.select().from(emotionalState)
        .where(eq(emotionalState.visitorId, visitorId))
        .orderBy(desc(emotionalState.timestamp))
        .limit(limit);
    }
    return db.select().from(emotionalState)
      .orderBy(desc(emotionalState.timestamp))
      .limit(limit);
  }

  async createDraft(draft: InsertXDraft): Promise<XDraft> {
    const [saved] = await db.insert(xDrafts).values(draft).returning();
    return saved;
  }

  async getDrafts(status?: string, limit = 50): Promise<XDraft[]> {
    if (status) {
      return db.select().from(xDrafts)
        .where(eq(xDrafts.status, status))
        .orderBy(desc(xDrafts.createdAt))
        .limit(limit);
    }
    return db.select().from(xDrafts)
      .orderBy(desc(xDrafts.createdAt))
      .limit(limit);
  }

  async getDraft(id: number): Promise<XDraft | undefined> {
    const [draft] = await db.select().from(xDrafts).where(eq(xDrafts.id, id));
    return draft || undefined;
  }

  async updateDraftStatus(id: number, status: string, tweetId?: string, errorMessage?: string): Promise<XDraft | undefined> {
    const updateData: Partial<XDraft> = { status };
    if (tweetId) updateData.tweetId = tweetId;
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (status === 'posted') updateData.postedAt = new Date();
    
    const [updated] = await db.update(xDrafts)
      .set(updateData)
      .where(eq(xDrafts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDraft(id: number): Promise<void> {
    await db.delete(xDrafts).where(eq(xDrafts.id, id));
  }

  async checkRateLimit(identifier: string, endpoint: string, windowMs: number, maxCount: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowBucket = Math.floor(now / windowMs);
    const windowStart = new Date(windowBucket * windowMs);
    const resetAt = new Date((windowBucket + 1) * windowMs);
    
    
    const records = await db.select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.identifier, identifier),
          eq(rateLimits.endpoint, endpoint),
          eq(rateLimits.windowStart, windowStart)
        )
      );

    const totalCount = records.reduce((sum, r) => sum + (r.count || 0), 0);
    const remaining = Math.max(0, maxCount - totalCount);

    return { allowed: totalCount < maxCount, remaining, resetAt };
  }

  async recordRateLimit(identifier: string, endpoint: string, windowMs: number = 60000): Promise<void> {
    const now = Date.now();
    const windowBucket = Math.floor(now / windowMs);
    const windowStart = new Date(windowBucket * windowMs);
    
    const [existing] = await db.select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.identifier, identifier),
          eq(rateLimits.endpoint, endpoint),
          eq(rateLimits.windowStart, windowStart)
        )
      )
      .limit(1);

    if (existing) {
      await db.update(rateLimits)
        .set({ count: (existing.count || 0) + 1 })
        .where(eq(rateLimits.id, existing.id));
    } else {
      await db.insert(rateLimits).values({
        identifier,
        endpoint,
        count: 1,
        windowStart: windowStart,
      });
    }
  }

  async checkAndConsumeRateLimit(
    identifier: string,
    endpoint: string,
    windowMs: number,
    maxCount: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowBucket = Math.floor(now / windowMs);
    const windowStart = new Date(windowBucket * windowMs);
    const resetAt = new Date((windowBucket + 1) * windowMs);

    // Drizzle transactions map to BEGIN/COMMIT on the underlying pg client.
    // Using `.for("update")` on the SELECT makes concurrent callers with the
    // same (identifier, endpoint, windowStart) queue up on the row lock,
    // eliminating the race where two requests both read count<max and both
    // try to increment.
    return db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(rateLimits)
        .where(
          and(
            eq(rateLimits.identifier, identifier),
            eq(rateLimits.endpoint, endpoint),
            eq(rateLimits.windowStart, windowStart),
          ),
        )
        .for("update");

      const totalCount = rows.reduce((sum, r) => sum + (r.count || 0), 0);
      if (totalCount >= maxCount) {
        return { allowed: false, remaining: 0, resetAt };
      }

      // Consume one slot before committing the transaction.
      const existing = rows[0];
      if (existing) {
        await tx
          .update(rateLimits)
          .set({ count: (existing.count || 0) + 1 })
          .where(eq(rateLimits.id, existing.id));
      } else {
        await tx.insert(rateLimits).values({
          identifier,
          endpoint,
          count: 1,
          windowStart,
        });
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxCount - totalCount - 1),
        resetAt,
      };
    });
  }
}

export const storage = new DatabaseStorage();

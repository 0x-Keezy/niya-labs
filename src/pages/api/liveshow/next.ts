// Build timestamp: 2026-01-12T09:45:00Z - Forces fresh deployment
import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatQueue, chatMessages, viewers } from "@/features/liveShow/schema";
import { eq, sql, and, asc } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("[API liveshow/next] Request received:", req.method);
  
  if (handleCors(req, res)) return;
  
  let db;
  try {
    db = getDb();
    if (!db) {
      console.error("[API liveshow/next] DB not available - no connection string");
      return res.status(503).json({ error: "Database not available", hasNext: false });
    }
  } catch (e: any) {
    console.error("[API liveshow/next] DB connection error:", e.message);
    return res.status(503).json({ error: "Database connection failed", hasNext: false });
  }

  if (req.method === "GET") {
    try {
      // Step 1: Find next pending item
      const [pendingItem] = await db
        .select()
        .from(chatQueue)
        .where(eq(chatQueue.status, "pending"))
        .orderBy(asc(chatQueue.createdAt))
        .limit(1);

      if (!pendingItem) {
        return res.status(200).json({ hasNext: false });
      }

      // Step 2: Claim it by updating status (with guard to prevent race conditions)
      // Only update if still pending - if another process claimed it, this will affect 0 rows
      const updateResult = await db
        .update(chatQueue)
        .set({ status: "processing" })
        .where(and(
          eq(chatQueue.id, pendingItem.id),
          eq(chatQueue.status, "pending")
        ))
        .returning();

      // If no rows affected, another process claimed this item - try again or return empty
      if (!updateResult || updateResult.length === 0) {
        console.log("[API liveshow/next] Race condition - item already claimed, returning empty");
        return res.status(200).json({ hasNext: false });
      }

      const claimedItem = updateResult[0];
      console.log("[API liveshow/next] Successfully claimed queue item:", claimedItem.id);

      return res.status(200).json({
        hasNext: true,
        item: claimedItem,
      });
    } catch (e: any) {
      console.error("[API liveshow/next] Failed to get next in queue:", e.message);
      return res.status(500).json({ error: e.message, hasNext: false });
    }
  }

  if (req.method === "POST") {
    try {
      const { queueId, response, emotion } = req.body;

      if (!queueId) {
        return res.status(400).json({ error: "queueId required" });
      }

      const [queueItem] = await db
        .select()
        .from(chatQueue)
        .where(eq(chatQueue.id, queueId))
        .limit(1);

      if (!queueItem) {
        return res.status(404).json({ error: "Queue item not found" });
      }

      await db
        .update(chatQueue)
        .set({ status: "answered" })
        .where(eq(chatQueue.id, queueId));

      // NOTE: Assistant response is saved by chat.ts saveToLiveshow() -> /api/liveshow/messages
      // Do NOT insert here to avoid duplicate messages

      // Update viewer record (non-critical - don't fail the whole request if this fails)
      try {
        await db
          .update(viewers)
          .set({ 
            messageCount: sql`${viewers.messageCount} + 1`,
            lastSeen: new Date(),
          })
          .where(eq(viewers.visitorId, queueItem.visitorId));
      } catch (viewerErr: any) {
        console.warn("[API liveshow/next] Viewer update failed (non-critical):", viewerErr.message);
      }

      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("Failed to process queue item:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

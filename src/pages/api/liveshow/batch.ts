import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatQueue, viewers } from "@/features/liveShow/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("[API liveshow/batch] Request received:", req.method);
  
  if (handleCors(req, res)) return;
  
  let db;
  try {
    db = getDb();
    if (!db) {
      console.error("[API liveshow/batch] DB not available");
      return res.status(503).json({ error: "Database not available", items: [] });
    }
  } catch (e: any) {
    console.error("[API liveshow/batch] DB connection error:", e.message);
    return res.status(503).json({ error: "Database connection failed", items: [] });
  }

  if (req.method === "GET") {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const pendingItems = await db
        .select()
        .from(chatQueue)
        .where(eq(chatQueue.status, "pending"))
        .orderBy(asc(chatQueue.createdAt))
        .limit(limit);

      if (!pendingItems || pendingItems.length === 0) {
        return res.status(200).json({ items: [], count: 0 });
      }

      const itemIds = pendingItems.map(item => item.id);
      
      const updateResult = await db
        .update(chatQueue)
        .set({ status: "processing" })
        .where(and(
          inArray(chatQueue.id, itemIds),
          eq(chatQueue.status, "pending")
        ))
        .returning();

      if (!updateResult || updateResult.length === 0) {
        console.log("[API liveshow/batch] Race condition - items already claimed");
        return res.status(200).json({ items: [], count: 0 });
      }

      console.log("[API liveshow/batch] Claimed", updateResult.length, "queue items");

      return res.status(200).json({
        items: updateResult,
        count: updateResult.length,
      });
    } catch (e: any) {
      console.error("[API liveshow/batch] Failed to get batch:", e.message);
      return res.status(500).json({ error: e.message, items: [] });
    }
  }

  if (req.method === "POST") {
    try {
      const { queueIds, response, revert } = req.body;

      if (!queueIds || !Array.isArray(queueIds) || queueIds.length === 0) {
        return res.status(400).json({ error: "queueIds array required" });
      }

      // If reverting, set back to pending status
      if (revert) {
        await db
          .update(chatQueue)
          .set({ status: "pending" })
          .where(inArray(chatQueue.id, queueIds));
        console.log("[API liveshow/batch] Reverted", queueIds.length, "items to pending");
        return res.status(200).json({ success: true, reverted: queueIds.length });
      }

      await db
        .update(chatQueue)
        .set({ status: "answered" })
        .where(inArray(chatQueue.id, queueIds));

      const queueItems = await db
        .select()
        .from(chatQueue)
        .where(inArray(chatQueue.id, queueIds));

      // Update viewer records (non-critical - don't fail the whole request if this fails)
      try {
        const visitorIds = [...new Set(queueItems.map(item => item.visitorId))];
        
        for (const visitorId of visitorIds) {
          await db
            .update(viewers)
            .set({ 
              lastSeen: new Date(),
            })
            .where(eq(viewers.visitorId, visitorId));
        }
      } catch (viewerErr: any) {
        console.warn("[API liveshow/batch] Viewer update failed (non-critical):", viewerErr.message);
      }

      console.log("[API liveshow/batch] Marked", queueIds.length, "items as answered");
      return res.status(200).json({ success: true, processed: queueIds.length });
    } catch (e: any) {
      console.error("[API liveshow/batch] Failed to complete batch:", e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatQueue, viewers } from "@/features/liveShow/schema";
import { eq, sql, gte } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (handleCors(req, res)) return;
  
  let db;
  try {
    db = getDb();
  } catch (e: any) {
    console.error("[API liveshow/stats] DB connection error:", e.message);
    return res.status(503).json({ error: "Database connection failed" });
  }
  
  if (!db) {
    return res.status(503).json({ error: "Database not available" });
  }

  if (req.method === "GET") {
    try {
      const [queueStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatQueue)
        .where(eq(chatQueue.status, "pending"));

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [viewerStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(viewers)
        .where(gte(viewers.lastSeen, fiveMinutesAgo));

      return res.status(200).json({
        queueLength: queueStats.count,
        activeViewers: viewerStats.count,
      });
    } catch (e: any) {
      console.error("Failed to get stats:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

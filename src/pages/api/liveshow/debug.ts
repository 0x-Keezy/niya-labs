import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatMessages, chatQueue } from "@/features/liveShow/schema";
import { desc, eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Debug endpoint leaks chat queue state — never expose it in production.
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    const db = getDb();
    if (!db) {
      debug.error = "Database connection not available";
      return res.status(500).json(debug);
    }

    const recentMessages = await db
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);

    const pendingQueue = await db
      .select()
      .from(chatQueue)
      .where(eq(chatQueue.status, "pending"))
      .limit(10);

    const allQueue = await db
      .select()
      .from(chatQueue)
      .orderBy(desc(chatQueue.createdAt))
      .limit(10);

    debug.recentMessages = recentMessages;
    debug.recentMessagesCount = recentMessages.length;
    debug.pendingQueueCount = pendingQueue.length;
    debug.pendingQueue = pendingQueue;
    debug.allRecentQueue = allQueue;

    return res.status(200).json(debug);
  } catch (error: any) {
    debug.error = error.message;
    return res.status(500).json(debug);
  }
}

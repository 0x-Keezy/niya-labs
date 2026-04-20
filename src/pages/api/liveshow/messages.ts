import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatMessages, insertChatMessageSchema } from "@/features/liveShow/schema";
import { desc, eq } from "drizzle-orm";
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
    console.error("[API liveshow/messages] DB connection error:", e.message);
    return res.status(503).json({ error: "Database connection failed" });
  }
  
  if (!db) {
    return res.status(503).json({ error: "Database not available" });
  }

  if (req.method === "GET") {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const afterId = parseInt(req.query.afterId as string) || 0;

      let query = db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.isPublic, true))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);

      const messages = await query;

      return res.status(200).json(messages.reverse());
    } catch (e: any) {
      console.error("Failed to get messages:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { userMessage, assistantResponse } = req.body;
      
      // Handle chat message format - only save non-empty content
      if (userMessage !== undefined || assistantResponse !== undefined) {
        const results = [];
        
        // Save user message only if provided and not from LiveShow queue flow
        // (LiveShow queue messages are saved by /api/liveshow/queue with visitor wallet name)
        if (userMessage && userMessage.trim()) {
          const [userMsg] = await db
            .insert(chatMessages)
            .values({
              role: "user",
              content: userMessage.trim(),
              visitorName: "Chat",
              isPublic: true,
            })
            .returning();
          results.push(userMsg);
        }
        
        // Only save non-empty assistant responses
        if (assistantResponse && assistantResponse.trim()) {
          const [assistantMsg] = await db
            .insert(chatMessages)
            .values({
              role: "assistant",
              content: assistantResponse.trim(),
              isPublic: true,
            })
            .returning();
          results.push(assistantMsg);
        }
        
        return res.status(201).json(results);
      }
      
      // Fallback to original schema validation
      const parsed = insertChatMessageSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const [newMessage] = await db
        .insert(chatMessages)
        .values(parsed.data)
        .returning();

      return res.status(201).json(newMessage);
    } catch (e: any) {
      console.error("Failed to add message:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

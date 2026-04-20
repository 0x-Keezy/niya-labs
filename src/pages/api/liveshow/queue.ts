import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/features/liveShow/db";
import { chatQueue, chatMessages, viewers, insertChatQueueSchema } from "@/features/liveShow/schema";
import { eq, and, sql, asc, or } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";

const FREE_MESSAGE_LIMIT = 1;

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (handleCors(req, res)) return;
  
  let db;
  try {
    db = getDb();
  } catch (e: any) {
    console.warn("[API liveshow/queue] DB connection error (graceful fallback):", e.message);
    if (req.method === "GET") {
      return res.status(200).json([]);
    }
    return res.status(503).json({ error: "Database connection failed" });
  }
  
  if (!db) {
    if (req.method === "GET") {
      return res.status(200).json([]);
    }
    return res.status(503).json({ error: "Database not available" });
  }

  if (req.method === "GET") {
    try {
      const pending = await db
        .select()
        .from(chatQueue)
        .where(eq(chatQueue.status, "pending"))
        .orderBy(asc(chatQueue.createdAt))
        .limit(50);

      const queueWithPositions = pending.map((item: any, index: number) => ({
        ...item,
        position: index + 1,
      }));

      return res.status(200).json(queueWithPositions);
    } catch (e: any) {
      console.warn("[API liveshow/queue] Failed to get queue (graceful fallback):", e.message);
      return res.status(200).json([]);
    }
  }

  if (req.method === "POST") {
    try {
      const parsed = insertChatQueueSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { visitorId, visitorName, message } = parsed.data;
      const rawWalletAddress = req.body.walletAddress?.toLowerCase() || null;
      const walletAddress = rawWalletAddress && isValidEthAddress(rawWalletAddress) ? rawWalletAddress : null;
      const clientIp = getClientIp(req);

      let existingViewer: any[] = [];
      let ipMessageCount = 0;
      
      try {
        existingViewer = await db
          .select()
          .from(viewers)
          .where(eq(viewers.visitorId, visitorId))
          .limit(1);
        
        if (clientIp && clientIp !== 'unknown') {
          const ipQueueCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(chatQueue)
            .innerJoin(viewers, eq(chatQueue.visitorId, viewers.visitorId))
            .where(eq(viewers.ipAddress, clientIp));
          
          ipMessageCount = ipQueueCount[0]?.count || 0;
        }

        if (existingViewer.length === 0) {
          await db.insert(viewers).values({
            visitorId,
            name: visitorName,
            ipAddress: clientIp,
            walletAddress,
            messageCount: 0,
          });
          existingViewer = await db
            .select()
            .from(viewers)
            .where(eq(viewers.visitorId, visitorId))
            .limit(1);
        } else {
          const updateData: any = { lastSeen: new Date(), name: visitorName };
          if (walletAddress && !existingViewer[0].walletAddress) {
            updateData.walletAddress = walletAddress;
          }
          if (clientIp && !existingViewer[0].ipAddress) {
            updateData.ipAddress = clientIp;
          }
          await db
            .update(viewers)
            .set(updateData)
            .where(eq(viewers.visitorId, visitorId));
        }
      } catch (viewerErr: any) {
        console.warn("[API liveshow/queue] Viewer update failed (non-critical):", viewerErr.message);
      }

      const displayOnly = req.body.displayOnly === true || !message?.trim();
      
      if (displayOnly) {
        if (req.body.saveUserMessage) {
          const displayContent = req.body.displayMessage || message;
          await db.insert(chatMessages).values({
            visitorId,
            visitorName,
            role: "user",
            content: displayContent,
            isPublic: true,
          });
        }
        return res.status(201).json({
          displayOnly: true,
          message: "Sticker saved for display only",
        });
      }

      const viewer = existingViewer[0];
      const visitorMessageCount = viewer?.messageCount || 0;
      const totalMessageCount = Math.max(visitorMessageCount, ipMessageCount);
      const hasVerifiedWallet = !!viewer?.walletAddress;
      const hasPendingWallet = !!walletAddress && !viewer?.walletAddress;

      if (totalMessageCount >= FREE_MESSAGE_LIMIT && !hasVerifiedWallet && !hasPendingWallet) {
        return res.status(403).json({ 
          error: "wallet_required",
          message: "You've used your free message. Connect your wallet to continue chatting!",
          messageCount: totalMessageCount,
          freeLimit: FREE_MESSAGE_LIMIT,
        });
      }

      const COOLDOWN_SECONDS = 60;
      const lastMessage = await db
        .select({ createdAt: chatQueue.createdAt })
        .from(chatQueue)
        .where(eq(chatQueue.visitorId, visitorId))
        .orderBy(sql`${chatQueue.createdAt} DESC`)
        .limit(1);

      if (lastMessage.length > 0) {
        const lastTime = new Date(lastMessage[0].createdAt).getTime();
        const now = Date.now();
        const secondsSinceLastMessage = Math.floor((now - lastTime) / 1000);
        
        if (secondsSinceLastMessage < COOLDOWN_SECONDS) {
          const waitTime = COOLDOWN_SECONDS - secondsSinceLastMessage;
          return res.status(429).json({ 
            error: `Please wait ${waitTime} seconds before sending another message.` 
          });
        }
      }

      const [newItem] = await db
        .insert(chatQueue)
        .values({
          visitorId,
          visitorName,
          message,
          status: "pending",
        })
        .returning();

      try {
        await db
          .update(viewers)
          .set({ messageCount: sql`${viewers.messageCount} + 1` })
          .where(eq(viewers.visitorId, visitorId));
      } catch (e) {
        console.warn("[API liveshow/queue] Failed to increment message count");
      }

      if (req.body.saveUserMessage) {
        const displayContent = req.body.displayMessage || message;
        await db.insert(chatMessages).values({
          visitorId,
          visitorName,
          role: "user",
          content: displayContent,
          isPublic: true,
        });
      }

      const position = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatQueue)
        .where(eq(chatQueue.status, "pending"));

      const hasWallet = hasVerifiedWallet || hasPendingWallet;
      
      return res.status(201).json({
        ...newItem,
        position: position[0].count,
        remainingFreeMessages: hasWallet ? "unlimited" : Math.max(0, FREE_MESSAGE_LIMIT - totalMessageCount - 1),
      });
    } catch (e: any) {
      console.error("Failed to add to queue:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

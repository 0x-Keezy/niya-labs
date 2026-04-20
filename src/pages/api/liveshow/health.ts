import { NextApiRequest, NextApiResponse } from "next";
import { getDb, pool } from "@/features/liveShow/db";
import { sql } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlHost: process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.includes('@') 
        ? process.env.DATABASE_URL.split('@')[1]?.split('/')[0] 
        : 'unknown'
      : 'not-set',
  };

  try {
    const db = getDb();
    if (!db) {
      diagnostics.dbStatus = "no-connection";
      diagnostics.error = "Database connection not available";
      return res.status(500).json(diagnostics);
    }

    diagnostics.dbStatus = "pool-created";

    const result = await db.execute(sql`SELECT 1 as test`);
    diagnostics.dbStatus = "connected";
    diagnostics.queryResult = "success";

    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    diagnostics.tables = tables.rows.map((r: any) => r.table_name);

    const tablesList = diagnostics.tables as string[];
    const chatTablesExist = {
      chat_messages: tablesList?.includes('chat_messages'),
      chat_queue: tablesList?.includes('chat_queue'),
      viewers: tablesList?.includes('viewers'),
    };
    diagnostics.chatTablesExist = chatTablesExist;

    return res.status(200).json(diagnostics);
  } catch (error: any) {
    diagnostics.dbStatus = "error";
    diagnostics.error = error.message;
    diagnostics.errorCode = error.code;
    return res.status(500).json(diagnostics);
  }
}

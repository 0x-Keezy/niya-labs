// Minimal stub for legacy compatibility after amicaLife removal
import type { NextApiRequest, NextApiResponse } from "next";

interface SSEClient {
  res: NextApiResponse;
}

interface ApiLogEntry {
  sessionId: string;
  timestamp: string;
  inputType?: string;
  outputType?: string;
  response?: string;
  error?: string;
}

export const sseClients: SSEClient[] = [];
export const apiLogs: ApiLogEntry[] = [];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ status: 'ok', message: 'Handler stub' });
}

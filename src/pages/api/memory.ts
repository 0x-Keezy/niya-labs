import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../server/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  try {
    switch (action) {
      case 'saveMessage': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const message = await storage.saveMessage(req.body);
        return res.status(200).json(message);
      }

      case 'getMessages': {
        const { visitorId, limit } = req.query;
        const messages = visitorId 
          ? await storage.getMessagesByVisitor(visitorId as string, Number(limit) || 50)
          : await storage.getMessages(Number(limit) || 50);
        return res.status(200).json(messages);
      }

      case 'saveFact': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const fact = await storage.saveFact(req.body);
        return res.status(200).json(fact);
      }

      case 'getFacts': {
        const { visitorId, limit } = req.query;
        const facts = await storage.getFacts(visitorId as string, Number(limit) || 20);
        return res.status(200).json(facts);
      }

      case 'saveEmotionalState': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const state = await storage.saveEmotionalState(req.body);
        return res.status(200).json(state);
      }

      case 'getEmotionalHistory': {
        const { visitorId, limit } = req.query;
        const history = await storage.getEmotionalHistory(visitorId as string, Number(limit) || 10);
        return res.status(200).json(history);
      }

      case 'createSession': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const session = await storage.createSession(req.body);
        return res.status(200).json(session);
      }

      case 'getSession': {
        const { sessionId } = req.query;
        const session = await storage.getSession(sessionId as string);
        return res.status(200).json(session || null);
      }

      case 'upsertViewer': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const viewer = await storage.upsertViewer(req.body);
        return res.status(200).json(viewer);
      }

      case 'getActiveViewers': {
        const { sinceMinutes } = req.query;
        const viewers = await storage.getActiveViewers(Number(sinceMinutes) || 5);
        return res.status(200).json(viewers);
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Memory API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

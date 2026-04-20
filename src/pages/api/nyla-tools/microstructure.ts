import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";
import { getDb } from "@/features/liveShow/db";
import { nylaMicrostructureCache } from "@/features/nylaTools/schema";
import { computeMicrostructure } from "@/features/nylaTools/microstructure";
import type { MicrostructureResult } from "@/features/nylaTools/schema";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface RequestBody {
  ca?: unknown;
  source?: unknown;
  /** When true, skip the DB cache lookup and force a live recompute. Still
   *  writes the fresh result to cache so subsequent calls benefit. Used by
   *  the Refresh button in the side panel. */
  fresh?: unknown;
}

interface SuccessResponse {
  data: MicrostructureResult;
  cached: boolean;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- input validation ---
  const body = (req.body ?? {}) as RequestBody;
  if (typeof body.ca !== "string" || !ADDRESS_REGEX.test(body.ca)) {
    return res.status(400).json({ error: "Invalid contract address" });
  }
  const ca = body.ca.toLowerCase();
  const source = typeof body.source === 'string' ? body.source : undefined;
  const fresh = body.fresh === true;

  // --- env keys (rotate between keys to avoid 40k CU/day limit) ---
  const moralisApiKey = [
    process.env.MORALIS_API_KEY,
    process.env.MORALIS_API_KEY_2,
  ].filter((k): k is string => !!k);
  if (moralisApiKey.length === 0) {
    console.error(
      "[API] nyla-tools/microstructure missing MORALIS_API_KEY",
    );
    return res.status(503).json({
      error: "Microstructure backend not configured (missing API key)",
    });
  }
  const gmgnApiKey = process.env.GMGN_API_KEY ?? null;

  // --- db (best effort — we still serve fresh data if db is down) ---
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch (e: any) {
    console.error("[API] nyla-tools/microstructure db error:", e?.message);
    db = null;
  }

  // --- cache lookup (skip when the caller asked for a fresh recompute) ---
  if (db && !fresh) {
    try {
      const rows = await db
        .select()
        .from(nylaMicrostructureCache)
        .where(eq(nylaMicrostructureCache.ca, ca))
        .limit(1);
      const row = rows[0];
      if (row && row.computedAt) {
        const ageMs = Date.now() - new Date(row.computedAt).getTime();
        const cachedData = row.data as MicrostructureResult;
        // Cache-bust: re-compute if result predates LP/cluster fixes.
        const version = (cachedData as any)._cacheVersion ?? 0;
        if (ageMs < CACHE_TTL_MS && version >= 2) {
          // Apply source-based LP override post-cache (cache key doesn't
          // include source, so a fourmeme visit after a dexscreener visit
          // would return the wrong LP status without this).
          if (source === 'fourmeme' && cachedData.lp?.lockProvider !== 'bonding-curve') {
            cachedData.lp = { locked: true, lockedShare: 100, lockProvider: 'bonding-curve' };
          }
          return res.status(200).json({
            data: cachedData,
            cached: true,
          });
        }
      }
    } catch (e: any) {
      console.warn(
        "[API] nyla-tools/microstructure cache read failed:",
        e?.message,
      );
    }
  }

  // --- compute ---
  let result: MicrostructureResult;
  try {
    result = await computeMicrostructure(ca, { moralisApiKey, gmgnApiKey }, source);
  } catch (e: any) {
    console.error("[API] nyla-tools/microstructure compute error:", e);
    return res
      .status(502)
      .json({ error: e?.message || "Microstructure compute failed" });
  }

  // --- cache write (best effort) ---
  if (db) {
    try {
      await db
        .insert(nylaMicrostructureCache)
        .values({ ca, data: result, computedAt: new Date() })
        .onConflictDoUpdate({
          target: nylaMicrostructureCache.ca,
          set: { data: result, computedAt: new Date() },
        });
    } catch (e: any) {
      console.warn(
        "[API] nyla-tools/microstructure cache write failed:",
        e?.message,
      );
    }
  }

  return res.status(200).json({ data: result, cached: false });
}

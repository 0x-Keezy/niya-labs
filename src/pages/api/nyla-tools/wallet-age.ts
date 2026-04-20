// POST /api/nyla-tools/wallet-age
//
// Returns the wallet's on-chain age on BSC and the resulting Nyla Tools tier.
// Mirrors the orchestration pattern of nyla-tools/microstructure.ts:
//   - Validate input
//   - Best-effort DB cache lookup (7-day TTL)
//   - On miss, hit BscScan, classify, store, return
//
// Tier rules per PRD §5: <90d → scout, 90-365d → analyst, >365d → pro.
// A wallet that has never transacted on BSC is treated as scout with
// ageDays = 0 — same outcome as a brand-new wallet.

import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { handleCors } from "@/features/liveShow/cors";
import { getDb } from "@/features/liveShow/db";
import {
  nylaWalletAge,
  tierFromAgeDays,
  type WalletAgeResult,
} from "@/features/nylaTools/schema";
import { fetchFirstWalletTxTimestamp } from "@/features/nylaTools/moralis";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface RequestBody {
  address?: unknown;
}

interface SuccessResponse {
  data: WalletAgeResult;
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

  const body = (req.body ?? {}) as RequestBody;
  if (typeof body.address !== "string" || !ADDRESS_REGEX.test(body.address)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  const address = body.address.toLowerCase();

  const moralisApiKey = [
    process.env.MORALIS_API_KEY,
    process.env.MORALIS_API_KEY_2,
  ].filter((k): k is string => !!k);
  if (moralisApiKey.length === 0) {
    console.error("[API] nyla-tools/wallet-age missing MORALIS_API_KEY");
    return res
      .status(503)
      .json({ error: "Wallet-age backend not configured (missing API key)" });
  }

  // --- db (best effort) ---
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch (e: any) {
    console.error("[API] nyla-tools/wallet-age db error:", e?.message);
    db = null;
  }

  // --- cache lookup ---
  if (db) {
    try {
      const rows = await db
        .select()
        .from(nylaWalletAge)
        .where(eq(nylaWalletAge.address, address))
        .limit(1);
      const row = rows[0];
      if (row && row.cachedAt) {
        const ageMs = Date.now() - new Date(row.cachedAt).getTime();
        if (ageMs < CACHE_TTL_MS) {
          return res.status(200).json({
            data: {
              address: row.address,
              firstTxTimestamp: row.firstTxTimestamp
                ? Math.floor(new Date(row.firstTxTimestamp).getTime() / 1000)
                : null,
              ageDays: row.ageDays,
              tier: tierFromAgeDays(row.ageDays),
            },
            cached: true,
          });
        }
      }
    } catch (e: any) {
      console.warn(
        "[API] nyla-tools/wallet-age cache read failed:",
        e?.message,
      );
    }
  }

  // --- compute ---
  let firstTs: number | null;
  try {
    firstTs = await fetchFirstWalletTxTimestamp(address, moralisApiKey);
  } catch (e: any) {
    console.error("[API] nyla-tools/wallet-age moralis error:", e?.message);
    return res
      .status(502)
      .json({ error: e?.message || "Wallet-age lookup failed" });
  }

  const ageDays =
    firstTs != null
      ? Math.max(0, Math.floor((Date.now() / 1000 - firstTs) / 86400))
      : 0;
  const tier = tierFromAgeDays(ageDays);
  const result: WalletAgeResult = {
    address,
    firstTxTimestamp: firstTs,
    ageDays,
    tier,
  };

  // --- cache write (best effort) ---
  if (db) {
    try {
      const firstTxDate = firstTs ? new Date(firstTs * 1000) : null;
      await db
        .insert(nylaWalletAge)
        .values({
          address,
          firstTxTimestamp: firstTxDate,
          ageDays,
          tier,
          cachedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: nylaWalletAge.address,
          set: {
            firstTxTimestamp: firstTxDate,
            ageDays,
            tier,
            cachedAt: new Date(),
          },
        });
    } catch (e: any) {
      console.warn(
        "[API] nyla-tools/wallet-age cache write failed:",
        e?.message,
      );
    }
  }

  return res.status(200).json({ data: result, cached: false });
}

// Thin client for the Niya Tools backend (Next.js running in the parent
// monorepo). All third-party API calls that need an API key (BscScan,
// Moralis, Grok-3-mini, etc.) live behind these endpoints so the keys
// never ship in the extension bundle.
//
// During hackathon development the backend runs on localhost:5000 (Next.js
// dev server). Post-hack this becomes a Vercel/Railway URL.

import type { MicrostructureResult, Tier } from './types';

const BACKEND_BASE = 'http://localhost:5000';

interface MicrostructureResponse {
  data: MicrostructureResult;
  cached: boolean;
}

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`BackendError ${status}: ${message}`);
    this.name = 'BackendError';
    this.status = status;
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody?.error) msg = errBody.error;
    } catch {
      // ignore
    }
    throw new BackendError(res.status, msg);
  }
  return (await res.json()) as T;
}

/**
 * POST /api/nyla-tools/microstructure
 * Returns the cached MicrostructureResult or computes one fresh.
 *
 * Pass `fresh: true` to force the backend to skip its 10-min DB cache and
 * recompute from Moralis / GoPlus / GMGN live. Used by the Refresh button
 * in the side panel so a user can invalidate a stale result on demand
 * without waiting for the TTL.
 */
export async function fetchMicrostructure(
  ca: string,
  signal?: AbortSignal,
  source?: string,
  fresh?: boolean,
): Promise<MicrostructureResponse> {
  return postJson<MicrostructureResponse>(
    '/api/nyla-tools/microstructure',
    { ca, source, fresh: fresh === true ? true : undefined },
    signal,
  );
}

// --- Wallet age (Day 7) ---

export interface WalletAgeData {
  address: string;
  firstTxTimestamp: number | null; // unix seconds
  ageDays: number;
  tier: Tier;
}

interface WalletAgeResponse {
  data: WalletAgeData;
  cached: boolean;
}

/**
 * POST /api/nyla-tools/wallet-age
 * Returns the wallet's BSC age and the resulting tier.
 */
export async function fetchWalletAge(
  address: string,
  signal?: AbortSignal,
): Promise<WalletAgeResponse> {
  return postJson<WalletAgeResponse>(
    '/api/nyla-tools/wallet-age',
    { address },
    signal,
  );
}

// --- Narration (Day 10) ---

interface NarrationPayload {
  ca: string;
  symbol: string;
  data: {
    rugRiskScore: number;
    riskHeadline: string;
    top10EffectiveShare: number;
    topHolderShare: number;
    lpLocked: boolean;
    lpLockedShare: number;
    lockProvider: string | null;
    sniperCount: number | null;
    sniperSharePct: number | null;
    tokenAgeDays: number | null;
    totalHolders: number;
  };
}

interface NarrationResponse {
  narration: string;
  cached: boolean;
  /** Provider that generated the narration ("dgrid" or legacy "xai"). */
  provider?: 'dgrid' | 'xai';
  /** Resolved model ID — surfaced in the UI attribution line. */
  model?: string;
}

/**
 * POST /api/nyla-tools/narrate
 * Returns a natural-language narration of the token's microstructure.
 */
export async function fetchNarration(
  payload: NarrationPayload,
  signal?: AbortSignal,
): Promise<NarrationResponse> {
  return postJson<NarrationResponse>(
    '/api/nyla-tools/narrate',
    payload,
    signal,
  );
}

// --- Ask Niya (Day 10.5) ---

interface AskNiyaPayload {
  question: string;
  ca?: string;
  context?: Record<string, unknown>;
  /**
   * Optional DGrid model ID (`provider/model`) to use. If omitted or not in
   * the server allow-list, the API falls back to the environment default.
   */
  model?: string;
}

interface AskNiyaResponse {
  answer: string;
  cached: boolean;
  /** Provider that actually answered ("dgrid" or legacy "xai"). */
  provider?: 'dgrid' | 'xai';
  /** Resolved model ID — shown in the UI attribution line. */
  model?: string;
}

/**
 * POST /api/nyla-tools/ask
 * Returns an AI-generated answer to the user's question about the token.
 */
export async function fetchAskNiya(
  payload: AskNiyaPayload,
  signal?: AbortSignal,
): Promise<AskNiyaResponse> {
  return postJson<AskNiyaResponse>(
    '/api/nyla-tools/ask',
    payload,
    signal,
  );
}

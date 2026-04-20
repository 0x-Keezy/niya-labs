// Moralis Web3 Data API client used by Nyla Tools microstructure analysis.
// Used as the primary source for holder distribution because BscScan free
// tier does not expose a paginated holders endpoint. Falls back to BscScan
// counts when Moralis is unavailable.
//
// Free tier: 40k compute units / day. Each call below is 1-5 CU.
//
// Docs: https://docs.moralis.io/web3-data-api/evm/reference

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2";

export class MoralisError extends Error {
  constructor(message: string) {
    super(`MoralisError: ${message}`);
    this.name = "MoralisError";
  }
}

export class MoralisNotFoundError extends MoralisError {
  constructor(path: string, status: number) {
    super(`No data for ${path} (HTTP ${status})`);
    this.name = "MoralisNotFoundError";
  }
}

async function call<T>(
  path: string,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<T> {
  const keys = Array.isArray(apiKey) ? apiKey : [apiKey];
  let lastError: Error | null = null;
  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetch(`${MORALIS_BASE}${path}`, {
        headers: {
          accept: "application/json",
          "X-API-Key": keys[i],
        },
        signal,
      });
      // 401 = key exhausted or invalid — try next key if available.
      if (res.status === 401 && i < keys.length - 1) {
        console.debug("[moralis] key", i + 1, "returned 401, trying next key");
        continue;
      }
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          throw new MoralisNotFoundError(path, res.status);
        }
        throw new MoralisError(`HTTP ${res.status} ${res.statusText} for ${path}`);
      }
      return (await res.json()) as T;
    } catch (e) {
      lastError = e as Error;
      if (e instanceof MoralisNotFoundError) throw e;
      // Network error — try next key if available.
      if (i < keys.length - 1) continue;
      throw e;
    }
  }
  throw lastError ?? new MoralisError("All API keys exhausted");
}

// --- holders ---

interface RawHolder {
  owner_address: string;
  balance: string;
  balance_formatted: string;
  is_contract?: boolean;
  percentage_relative_to_total_supply?: number;
}

interface HoldersResponse {
  total: number | null;
  result: RawHolder[];
}

export interface HolderRow {
  address: string;
  balance: string;
  share: number; // percent of total supply 0-100
  isContract: boolean;
}

export interface HoldersSummary {
  totalHolders: number;
  topHolders: HolderRow[];
}

/**
 * Fetch the top N holders of a BSC ERC20. Moralis returns rows already
 * sorted by balance descending and gives us the share-of-supply percentage
 * directly, which is exactly what we need for the rug-risk heuristic.
 */
export async function fetchTokenHolders(
  ca: string,
  limit: number,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<HoldersSummary> {
  const path = `/erc20/${ca}/owners?chain=bsc&order=DESC&limit=${Math.min(limit, 100)}`;
  const body = await call<HoldersResponse>(path, apiKey, signal);

  const topHolders: HolderRow[] = (body.result ?? []).map((h) => ({
    address: h.owner_address,
    balance: h.balance,
    share: typeof h.percentage_relative_to_total_supply === "number"
      ? h.percentage_relative_to_total_supply
      : 0,
    isContract: Boolean(h.is_contract),
  }));

  return {
    totalHolders: typeof body.total === "number" ? body.total : topHolders.length,
    topHolders,
  };
}

// --- metadata ---

interface RawTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  total_supply: string;
  total_supply_formatted: string;
  created_at?: string;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  createdAt: string | null;
}

export async function fetchTokenMetadata(
  ca: string,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<TokenMetadata | null> {
  const path = `/erc20/metadata?chain=bsc&addresses%5B0%5D=${ca}`;
  const body = await call<RawTokenMetadata[]>(path, apiKey, signal);
  if (!Array.isArray(body) || body.length === 0) return null;
  const m = body[0];
  return {
    address: m.address,
    name: m.name ?? "",
    symbol: m.symbol ?? "",
    decimals: parseInt(m.decimals ?? "18", 10) || 18,
    totalSupply: m.total_supply ?? "0",
    createdAt: m.created_at ?? null,
  };
}

// --- token transfers (used by sniper detection) ---

interface RawTokenTransfer {
  transaction_hash: string;
  block_number: string;
  block_timestamp: string;
  from_address: string;
  to_address: string;
  value: string;
}

interface TokenTransfersResponse {
  result?: RawTokenTransfer[];
}

/**
 * Normalised token transfer row used by the sniper detector. Mirrors the
 * shape that the old BscScan client emitted (`./bscscan.ts::TokenTx`) so
 * the orchestrator doesn't need to change.
 */
export interface TokenTx {
  hash: string;
  blockNumber: string;
  timeStamp: string; // unix seconds, as string
  from: string;
  to: string;
  value: string; // raw integer string
}

/**
 * Fetch the first N token transfers in chronological order. Used by
 * `computeSnipers` to enumerate the wallets that bought in the very early
 * blocks. Replaces the BscScan `tokentx` call which is no longer free for
 * BSC after the Etherscan v2 migration.
 */
export async function fetchTokenTransfers(
  ca: string,
  limit: number,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<TokenTx[]> {
  const path = `/erc20/${ca}/transfers?chain=bsc&order=ASC&limit=${Math.min(limit, 100)}`;
  let body: TokenTransfersResponse;
  try {
    body = await call<TokenTransfersResponse>(path, apiKey, signal);
  } catch (e) {
    if (e instanceof MoralisNotFoundError) return [];
    throw e;
  }
  return (body.result ?? []).map((t) => ({
    hash: t.transaction_hash,
    blockNumber: t.block_number,
    timeStamp: String(
      Math.floor(new Date(t.block_timestamp).getTime() / 1000),
    ),
    from: t.from_address,
    to: t.to_address,
    value: t.value,
  }));
}

// --- wallet token balance (used by sniper share calculation) ---

interface RawWalletErc20 {
  token_address: string;
  balance: string;
  decimals: number;
}

/**
 * Get the raw token balance held by a wallet for a specific token. Returns
 * "0" if the wallet has never held the token. Replaces the BscScan
 * `tokenbalance` call.
 */
export async function fetchWalletTokenBalance(
  walletAddress: string,
  ca: string,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<string> {
  const path = `/${walletAddress}/erc20?chain=bsc&token_addresses%5B0%5D=${ca}`;
  let body: RawWalletErc20[];
  try {
    body = await call<RawWalletErc20[]>(path, apiKey, signal);
  } catch (e) {
    if (e instanceof MoralisNotFoundError) return "0";
    throw e;
  }
  if (!Array.isArray(body) || body.length === 0) return "0";
  return body[0].balance ?? "0";
}

// --- wallet history (used by wallet-age lookup) ---

interface WalletHistoryTx {
  hash: string;
  block_timestamp: string; // ISO 8601
  block_number: string;
  from_address?: string;
  to_address?: string;
  value?: string; // native BNB value in wei
}

interface WalletHistoryResponse {
  result?: WalletHistoryTx[];
}

/**
 * Returns the unix timestamp (seconds) of the address's earliest BSC tx,
 * or `null` if it has never transacted on BSC. Used by the wallet-age
 * lookup to compute the user's tier — replaces the BscScan path which
 * is no longer free for BSC after the Etherscan v2 migration.
 */
export async function fetchFirstWalletTxTimestamp(
  address: string,
  apiKey: string | string[],
  signal?: AbortSignal,
): Promise<number | null> {
  const path = `/wallets/${address}/history?chain=bsc&order=ASC&limit=1`;
  let body: WalletHistoryResponse;
  try {
    body = await call<WalletHistoryResponse>(path, apiKey, signal);
  } catch (e) {
    if (e instanceof MoralisNotFoundError) return null;
    throw e;
  }
  const first = body.result?.[0];
  if (!first?.block_timestamp) return null;
  const ts = Math.floor(new Date(first.block_timestamp).getTime() / 1000);
  return Number.isFinite(ts) ? ts : null;
}

// --- wallet funder (used by cluster/sybil detection) ---

/**
 * Identify who first funded a wallet with BNB. Fetches the earliest
 * transactions and returns the `from_address` of the first incoming native
 * transfer. Returns `null` if no funding tx is found or on error.
 */
export async function fetchWalletFunder(
  address: string,
  apiKey: string | string[],
): Promise<string | null> {
  const lower = address.toLowerCase();
  const path = `/wallets/${lower}/history?chain=bsc&order=ASC&limit=10`;
  let body: WalletHistoryResponse;
  try {
    body = await call<WalletHistoryResponse>(path, apiKey);
  } catch (e) {
    if (e instanceof MoralisNotFoundError) return null;
    console.warn("[nyla-tools] fetchWalletFunder failed for", lower, e);
    return null;
  }

  // Debug: log the first result so we can verify the response shape.
  if (body.result?.[0]) {
    console.debug(
      "[nyla-tools] wallet history sample for",
      lower.slice(0, 10),
      ":",
      JSON.stringify(body.result[0]).slice(0, 300),
    );
  }

  for (const tx of body.result ?? []) {
    // Look for the first incoming native tx (BNB funding).
    if (
      tx.to_address?.toLowerCase() === lower &&
      tx.value &&
      tx.value !== "0" &&
      Number(tx.value) > 0
    ) {
      return tx.from_address?.toLowerCase() ?? null;
    }
  }
  // Secondary: any incoming tx (including zero-value contract interactions)
  // where someone else initiated a transfer TO this wallet.
  for (const tx of body.result ?? []) {
    if (
      tx.to_address?.toLowerCase() === lower &&
      tx.from_address &&
      tx.from_address.toLowerCase() !== lower
    ) {
      return tx.from_address.toLowerCase();
    }
  }

  // Fallback: if no incoming tx at all, use the `from_address` of the very
  // first transaction (whoever interacted with this wallet first).
  const first = body.result?.[0];
  if (first?.from_address && first.from_address.toLowerCase() !== lower) {
    return first.from_address.toLowerCase();
  }
  return null;
}

// BscScan API client used by the Nyla Tools microstructure orchestrator.
// All functions take `apiKey` as a parameter rather than reading from env so
// the orchestrator can pass it in once and unit-testing stays trivial.
//
// As of late 2024, BscScan migrated to Etherscan's unified Multichain V2
// API. Legacy `api.bscscan.com` is deprecated; we now hit
// `api.etherscan.io/v2/api?chainid=56&...` with the same module/action
// surface. The same Etherscan/BscScan API key works on both. The free
// tier limit remains 5 req/s, 100k req/day.
//
// Docs: https://docs.etherscan.io/etherscan-v2

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";
const BSC_CHAIN_ID = "56";

export class BscScanError extends Error {
  constructor(message: string) {
    super(`BscScanError: ${message}`);
    this.name = "BscScanError";
  }
}

interface BscScanResponse<T> {
  status: string; // "1" success, "0" error / no result
  message: string;
  result: T;
}

async function call<T>(
  params: Record<string, string>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<T> {
  const qs = new URLSearchParams({
    chainid: BSC_CHAIN_ID,
    ...params,
    apikey: apiKey,
  }).toString();
  const url = `${ETHERSCAN_V2_BASE}?${qs}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new BscScanError(`HTTP ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as BscScanResponse<T>;
  // BscScan uses status "0" both for actual errors AND for "no records found",
  // which is not an error for our use cases. The caller decides.
  if (body.status === "0" && body.message !== "No transactions found" && body.message !== "No records found") {
    throw new BscScanError(`${body.message}: ${JSON.stringify(body.result)}`);
  }
  return body.result;
}

// --- tokeninfo ---

interface RawTokenInfo {
  contractAddress: string;
  tokenName: string;
  symbol: string;
  divisor: string;
  tokenType: string;
  totalSupply: string;
  blueCheckmark: string;
  description: string;
  website: string;
  email: string;
  blog: string;
  reddit: string;
  slack: string;
  facebook: string;
  twitter: string;
  bitcointalk: string;
  github: string;
  telegram: string;
  wechat: string;
  linkedin: string;
  discord: string;
  whitepaper: string;
  tokenPriceUSD: string;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export async function fetchTokenInfo(
  ca: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<TokenInfo | null> {
  // tokeninfo is a Pro endpoint on Etherscan v2 — on free BscScan we fall
  // back to stats/tokensupply + reading metadata from the first holders
  // endpoint. To keep things robust on free tier we just call tokensupply.
  const totalSupply = await call<string>(
    { module: "stats", action: "tokensupply", contractaddress: ca },
    apiKey,
    signal,
  );
  return {
    name: "",
    symbol: "",
    decimals: 18, // BSC default — most ERC20s
    totalSupply,
  };
}

// --- contract creation ---

interface RawContractCreator {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}

export async function fetchContractCreator(
  ca: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ creator: string; txHash: string } | null> {
  const result = await call<RawContractCreator[] | string>(
    { module: "contract", action: "getcontractcreation", contractaddresses: ca },
    apiKey,
    signal,
  );
  if (typeof result === "string" || !Array.isArray(result) || result.length === 0) {
    return null;
  }
  const row = result[0];
  return { creator: row.contractCreator, txHash: row.txHash };
}

// --- token transfers (sniper detection) ---

export interface TokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

/**
 * First N token transfers in chronological order. Used by the sniper
 * heuristic — wallets that received tokens in the first ~30 transfers
 * after deployment are flagged.
 */
export async function fetchFirstTxs(
  ca: string,
  limit: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<TokenTx[]> {
  const result = await call<TokenTx[] | string>(
    {
      module: "account",
      action: "tokentx",
      contractaddress: ca,
      page: "1",
      offset: String(Math.min(limit, 100)),
      sort: "asc",
    },
    apiKey,
    signal,
  );
  if (typeof result === "string" || !Array.isArray(result)) return [];
  return result;
}

// --- account balance ---

/**
 * Returns the raw token balance (no decimal scaling) of `address` for `ca`.
 * Used to look up the dev wallet's current holdings.
 */
export async function fetchTokenBalance(
  ca: string,
  address: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const result = await call<string>(
    {
      module: "account",
      action: "tokenbalance",
      contractaddress: ca,
      address,
      tag: "latest",
    },
    apiKey,
    signal,
  );
  return result || "0";
}

// --- normal txs (used by wallet-age lookup) ---

interface RawNormalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  isError: string;
}

/**
 * Returns the timestamp (unix seconds) of the address's oldest BSC tx, or
 * `null` if it has never transacted on BSC. Used by the wallet-age lookup
 * to compute the user's tier.
 */
export async function fetchFirstNormalTxTimestamp(
  address: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const result = await call<RawNormalTx[] | string>(
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "1",
      sort: "asc",
    },
    apiKey,
    signal,
  );
  if (typeof result === "string" || !Array.isArray(result) || result.length === 0) {
    return null;
  }
  const ts = parseInt(result[0].timeStamp, 10);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Detect whether `address` is a contract by checking its bytecode.
 * BscScan returns "0x" for EOAs and a non-empty hex string for contracts.
 */
export async function isContractAddress(
  address: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const result = await call<string>(
      { module: "proxy", action: "eth_getCode", address, tag: "latest" },
      apiKey,
      signal,
    );
    return typeof result === "string" && result !== "0x" && result.length > 2;
  } catch {
    // Be conservative — assume EOA if the call fails.
    return false;
  }
}

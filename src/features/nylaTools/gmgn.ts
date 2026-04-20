// GMGN API client for Niya Tools.
// Provides token security checks, holder classification, and metadata
// that Moralis does not offer. Used as a complementary data source —
// Moralis remains the primary source for holder balances and transfers.
//
// **Implementation note (post-hackathon migration):** we now shell out to
// the official `gmgn-cli` npm package instead of calling openapi.gmgn.ai
// directly. The OpenAPI requires Ed25519 request signing with a key pair
// registered in the GMGN portal (GMGN_API_KEY + GMGN_PRIVATE_KEY), and
// the CLI handles all of that plus the IPv4-only quirk and the 1-call/5s
// rate limit. Credentials live in `~/.config/gmgn/.env` (the CLI picks
// them up automatically). The old HTTP-based code is kept below in a
// fallback comment for reference.
//
// Keys are server-only — they never ship in the extension bundle because
// gmgn.ts only runs inside the Next.js API route.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CHAIN = "bsc";

// Invoke the gmgn-cli entry script directly with Node. Using `npx.cmd`
// on Windows triggers `spawn EINVAL` on Node 20+ (security hardening
// around .bat/.cmd files after CVE-2024-27980). Calling the script by
// path side-steps the whole issue and is also faster — no npx overhead.
const NODE_BIN = process.execPath;
const GMGN_CLI_ENTRY = path.resolve(
  process.cwd(),
  "node_modules/gmgn-cli/dist/index.js",
);

// Single call timeout. GMGN typically replies in <2s; give headroom for
// network + rate-limit backoff inside the CLI.
const CLI_TIMEOUT_MS = 15_000;

export class GmgnError extends Error {
  constructor(message: string) {
    super(`GmgnError: ${message}`);
    this.name = "GmgnError";
  }
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Run `gmgn-cli <args> --raw` and JSON-parse stdout. */
async function runCli<T = unknown>(args: string[], signal?: AbortSignal): Promise<T> {
  const fullArgs = [GMGN_CLI_ENTRY, ...args, "--raw"];
  try {
    const { stdout } = await execFileAsync(NODE_BIN, fullArgs, {
      cwd: process.cwd(),
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      // `signal` aborts the child on demand (e.g. request cancelled).
      signal,
      windowsHide: true,
    });
    const trimmed = stdout.trim();
    if (!trimmed) throw new GmgnError("empty CLI output");
    return JSON.parse(trimmed) as T;
  } catch (e: any) {
    // execFile rejects for non-zero exit, signal abort, or parse failure.
    if (e?.name === "AbortError") throw e;
    const msg = e?.stderr?.toString() || e?.message || String(e);
    throw new GmgnError(`cli failed: ${msg.substring(0, 200)}`);
  }
}

// --- Token security ---

interface RawTokenSecurity {
  is_honeypot?: boolean | number;
  is_open_source?: boolean | number;
  is_renounced?: boolean | number;
  is_blacklist?: boolean | number;
  buy_tax?: number | string;
  sell_tax?: number | string;
  average_tax?: number | string;
  can_take_back_ownership?: boolean | number;
  slippage_modifiable?: boolean | number;
  // CLI v1.x fields:
  open_source?: number;
  honeypot?: number;
  renounced?: number;
  blacklist?: number;
}

export interface GmgnTokenSecurity {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  canTakeOwnership: boolean;
  canModifyTax: boolean;
  ownerAddress: string | null;
  ownerPercentage: number;
}

export async function fetchTokenSecurity(
  ca: string,
  _apiKey: string, // kept for signature compat; CLI reads its own key file
  signal?: AbortSignal,
): Promise<GmgnTokenSecurity | null> {
  try {
    const raw = await runCli<RawTokenSecurity>(
      ["token", "security", "--chain", CHAIN, "--address", ca.toLowerCase()],
      signal,
    );
    if (!raw) return null;
    return {
      // The CLI emits both the legacy boolean and a 0/1 int; toBool handles both.
      isHoneypot: toBool(raw.is_honeypot) || raw.honeypot === 1,
      // Taxes come as decimal fractions ("0.05" = 5%). Convert to percent.
      buyTax: toNum(raw.buy_tax) * 100,
      sellTax: toNum(raw.sell_tax) * 100,
      isOpenSource: toBool(raw.is_open_source) || raw.open_source === 1,
      canTakeOwnership: toBool(raw.can_take_back_ownership),
      canModifyTax: toBool(raw.slippage_modifiable),
      // CLI does not currently expose owner address/percent on BSC in the
      // same shape as the old API — leave them null for now.
      ownerAddress: null,
      ownerPercentage: 0,
    };
  } catch (e) {
    console.warn("[niya-tools] GMGN security fetch failed:", e);
    return null;
  }
}

// --- Top holders with tags ---

interface RawGmgnHolder {
  address?: string;
  balance?: number | string;
  amount_percentage?: number | string;
  wallet_tag_v2?: string;
  is_suspicious?: boolean;
  exchange?: string;
  native_transfer?: { name?: string | null } | null;
  addr_type?: number;
}

export interface GmgnHolder {
  address: string;
  balance: string;
  percentage: number;
  tags: string[];
  isContract: boolean;
}

/**
 * Map a raw holder row into the shape `microstructure.ts` consumes.
 * Tags are synthesised from the multiple GMGN signals:
 *   - `exchange` / native_transfer.name → "cex"
 *   - large amount_percentage → "whale"
 *   - is_suspicious → "suspicious"
 *   - wallet_tag_v2 (TOP1..TOPN) is skipped — it's a ranking, not behaviour.
 */
function mapHolder(h: RawGmgnHolder): GmgnHolder {
  const tags: string[] = [];
  const native = h.native_transfer ?? null;
  const nativeName =
    native && typeof native === "object" && typeof native.name === "string"
      ? native.name
      : "";
  if (nativeName.toLowerCase().includes("binance") || h.exchange) tags.push("cex");
  // amount_percentage is a fraction (0.0169 = 1.69%). 1% of supply = whale-ish.
  const pct = toNum(h.amount_percentage) * 100;
  if (pct >= 1) tags.push("whale");
  if (h.is_suspicious) tags.push("suspicious");
  return {
    address: (h.address ?? "").toLowerCase(),
    balance: String(h.balance ?? "0"),
    percentage: pct,
    tags,
    isContract: h.addr_type === 1,
  };
}

export async function fetchTopHolders(
  ca: string,
  _apiKey: string,
  signal?: AbortSignal,
): Promise<GmgnHolder[]> {
  try {
    const raw = await runCli<{ list?: RawGmgnHolder[] }>(
      [
        "token",
        "holders",
        "--chain",
        CHAIN,
        "--address",
        ca.toLowerCase(),
        "--limit",
        "100",
      ],
      signal,
    );
    const list = Array.isArray(raw?.list) ? raw!.list! : [];
    const mapped = list
      .filter((h): h is RawGmgnHolder => !!h?.address)
      .map(mapHolder);

    // Parallel enrichment: ask for the smart-money / renowned wallet lists
    // and merge their tags into the main top-100 by address. Each filter is
    // a separate CLI call, but they run concurrently inside the 10-min
    // microstructure cache so in practice this happens once per token.
    const [smart, renowned] = await Promise.allSettled([
      runCli<{ list?: RawGmgnHolder[] }>(
        [
          "token", "holders", "--chain", CHAIN, "--address", ca.toLowerCase(),
          "--tag", "smart_degen", "--limit", "100",
        ],
        signal,
      ),
      runCli<{ list?: RawGmgnHolder[] }>(
        [
          "token", "holders", "--chain", CHAIN, "--address", ca.toLowerCase(),
          "--tag", "renowned", "--limit", "100",
        ],
        signal,
      ),
    ]);
    const smartSet = new Set<string>(
      smart.status === "fulfilled" && Array.isArray(smart.value?.list)
        ? smart.value!.list!.map((h) => (h.address ?? "").toLowerCase()).filter(Boolean)
        : [],
    );
    const renownedSet = new Set<string>(
      renowned.status === "fulfilled" && Array.isArray(renowned.value?.list)
        ? renowned.value!.list!.map((h) => (h.address ?? "").toLowerCase()).filter(Boolean)
        : [],
    );
    for (const h of mapped) {
      if (smartSet.has(h.address)) h.tags.push("smart_money");
      if (renownedSet.has(h.address)) h.tags.push("renowned");
    }
    return mapped;
  } catch (e) {
    console.warn("[niya-tools] GMGN top holders fetch failed:", e);
    return [];
  }
}

// --- Token info ---

interface RawGmgnTokenInfo {
  holder_count?: number | string;
  circulating_supply?: number | string;
  total_supply?: number | string;
  creation_timestamp?: number;
  open_timestamp?: number;
  liquidity?: number | string;
  price?: number | string;
}

export interface GmgnTokenInfo {
  totalHolders: number | null;
  marketCap: number | null;
  createdAt: number | null;
}

export async function fetchTokenInfo(
  ca: string,
  _apiKey: string,
  signal?: AbortSignal,
): Promise<GmgnTokenInfo | null> {
  try {
    const raw = await runCli<RawGmgnTokenInfo>(
      ["token", "info", "--chain", CHAIN, "--address", ca.toLowerCase()],
      signal,
    );
    if (!raw) return null;
    const holders = toNum(raw.holder_count);
    const supply = toNum(raw.circulating_supply ?? raw.total_supply);
    const price = toNum(raw.price);
    const mc = supply > 0 && price > 0 ? supply * price : 0;
    const ts = raw.creation_timestamp ?? raw.open_timestamp ?? null;
    return {
      totalHolders: holders > 0 ? holders : null,
      marketCap: mc > 0 ? mc : null,
      createdAt: typeof ts === "number" && ts > 0 ? ts : null,
    };
  } catch (e) {
    console.warn("[niya-tools] GMGN token info fetch failed:", e);
    return null;
  }
}

// --- Wallet stats (not currently exposed by `gmgn-cli token ...`) ---

export interface GmgnWalletStats {
  firstTxTimestamp: number | null;
  txCount: number;
  pnlUsd: number;
  winRate: number;
  isSmartMoney: boolean;
}

/**
 * Stubbed — the CLI currently exposes wallet stats only under `portfolio`
 * and `track` subcommands that need different args. `microstructure.ts`
 * doesn't call this right now, so returning null is safe. Keep the
 * signature so callers still typecheck.
 */
export async function fetchWalletStats(
  _address: string,
  _apiKey: string,
  _signal?: AbortSignal,
): Promise<GmgnWalletStats | null> {
  return null;
}

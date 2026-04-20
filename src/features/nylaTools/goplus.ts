// GoPlus Security API client for Nyla Tools.
// Replaces GMGN for token security checks (GMGN is blocked by Cloudflare).
// GoPlus is free, public, no API key required.
//
// Docs: https://docs.gopluslabs.io/reference/token-security-api
// BSC chain_id: 56

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BSC_CHAIN_ID = "56";

export interface GoPlusLpHolder {
  address: string;
  tag: string | null;
  isLocked: boolean;
  percent: number; // 0-100 (converted from GoPlus 0-1 scale)
}

export interface GoPlusTokenSecurity {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  canTakeOwnership: boolean;
  canModifyTax: boolean;
  ownerAddress: string | null;
  ownerPercentage: number;
  creatorAddress: string | null;
  lpHolders: GoPlusLpHolder[];
  holderCount: number | null;
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : 0);
  return Number.isFinite(n) ? n : 0;
}

interface RawGoPlusLpHolder {
  address?: string;
  tag?: string;
  is_locked?: number;
  is_contract?: number;
  balance?: string;
  percent?: string; // 0-1 scale
}

interface RawGoPlusResult {
  is_honeypot?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_open_source?: string;
  can_take_back_ownership?: string;
  slippage_modifiable?: string;
  owner_address?: string;
  owner_percent?: string;
  holder_count?: string;
  creator_address?: string;
  creator_percent?: string;
  lp_holders?: RawGoPlusLpHolder[];
}

interface GoPlusResponse {
  code: number;
  message: string;
  result: Record<string, RawGoPlusResult>;
}

export async function fetchTokenSecurity(
  ca: string,
  signal?: AbortSignal,
): Promise<GoPlusTokenSecurity | null> {
  try {
    const lower = ca.toLowerCase();
    const url = `${GOPLUS_BASE}/token_security/${BSC_CHAIN_ID}?contract_addresses=${lower}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      console.warn(`[niya-tools] GoPlus HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as GoPlusResponse;
    if (body.code !== 1) {
      console.warn(`[niya-tools] GoPlus code ${body.code}: ${body.message}`);
      return null;
    }
    const raw = body.result[lower];
    if (!raw) return null;

    return {
      isHoneypot: toBool(raw.is_honeypot),
      buyTax: toNum(raw.buy_tax) * 100,
      sellTax: toNum(raw.sell_tax) * 100,
      isOpenSource: toBool(raw.is_open_source),
      canTakeOwnership: toBool(raw.can_take_back_ownership),
      canModifyTax: toBool(raw.slippage_modifiable),
      ownerAddress:
        typeof raw.owner_address === "string" && raw.owner_address.length > 2
          ? raw.owner_address.toLowerCase()
          : null,
      ownerPercentage: toNum(raw.owner_percent),
      creatorAddress:
        typeof raw.creator_address === "string" && raw.creator_address.length > 2
          ? raw.creator_address.toLowerCase()
          : null,
      lpHolders: (raw.lp_holders ?? [])
        .filter((h): h is RawGoPlusLpHolder => !!h?.address)
        .map((h) => ({
          address: (h.address ?? "").toLowerCase(),
          tag:
            typeof h.tag === "string" && h.tag.length > 0 ? h.tag : null,
          isLocked: h.is_locked === 1,
          percent: toNum(h.percent) * 100,
        })),
      holderCount: (() => {
        const c = parseInt(raw.holder_count ?? "", 10);
        return c > 0 ? c : null;
      })(),
    };
  } catch (e) {
    console.warn("[niya-tools] GoPlus security fetch failed:", e);
    return null;
  }
}

/**
 * GoPlus also returns holder_count in the security response.
 * This is a convenience wrapper to avoid a second API call.
 */
export async function fetchHolderCount(
  ca: string,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const lower = ca.toLowerCase();
    const url = `${GOPLUS_BASE}/token_security/${BSC_CHAIN_ID}?contract_addresses=${lower}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as GoPlusResponse;
    if (body.code !== 1) return null;
    const raw = body.result[lower];
    if (!raw?.holder_count) return null;
    const count = parseInt(raw.holder_count, 10);
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

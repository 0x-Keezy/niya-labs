// Nyla Tools — Drizzle table re-exports + shared TS types for the
// microstructure pipeline. The actual table definition lives in
// `shared/schema.ts` so drizzle-kit picks it up for migrations; this file
// is the import surface for the rest of the feature.

export { nylaMicrostructureCache, nylaWalletAge } from "../../../shared/schema";
export type { NylaMicrostructureCache, NylaWalletAge } from "../../../shared/schema";

// Tier thresholds (days). Mirror in extension/src/sidepanel/store.ts
// when computing tier locally as a fallback.
export const TIER_DAYS = {
  analyst: 90,
  pro: 365,
} as const;

export type WalletTier = "scout" | "analyst" | "pro";

export function tierFromAgeDays(days: number): WalletTier {
  if (days >= TIER_DAYS.pro) return "pro";
  if (days >= TIER_DAYS.analyst) return "analyst";
  return "scout";
}

export interface WalletAgeResult {
  address: string;
  firstTxTimestamp: number | null; // unix seconds, null if no txs
  ageDays: number;
  tier: WalletTier;
}

// --- Microstructure result shape ---
//
// Same shape is consumed by the extension via `extension/src/lib/types.ts`.
// If you change anything here, mirror it there.

// Matches `HolderCategory` in `./knownContracts.ts`. Redeclared here as a
// string-literal union so the on-the-wire schema does not depend on the
// registry file (keeps the type surface stable if the registry grows).
export type HolderCategory =
  | "burn"
  | "staking"
  | "exchange"
  | "bridge"
  | "dex"
  | "locker"
  | "launchpad";

export interface MicrostructureHolder {
  address: string;
  share: number; // percent of supply, 0-100
  isContract: boolean;
  label: string | null; // human-readable name when we recognise the contract
  category: HolderCategory | null; // classification; null = regular wallet or unknown contract
  gmgnTags?: string[]; // enrichment from GMGN (whale, cex, smart_money, renowned, suspicious, …)
}

export interface MicrostructureLp {
  locked: boolean;
  lockedShare: number; // 0-100, percent of LP supply locked or burned
  lockProvider: "unicrypt" | "pinklock" | "burned" | "bonding-curve" | null;
}

export interface MicrostructureSnipers {
  // null when we intentionally did not compute this (e.g. token too old for
  // sniper detection to be meaningful). `skipped` disambiguates from "we
  // tried and found zero". When `skipped === true`, count/sharePct are null.
  count: number | null;
  sharePct: number | null;
  skipped: boolean;
}

export interface MicrostructureDevWallet {
  address: string | null;
  currentShare: number;
}

export interface MicrostructureSecurity {
  isHoneypot: boolean | null;
  buyTax: number | null;      // percent 0-100
  sellTax: number | null;     // percent 0-100
  isOpenSource: boolean | null;
  canTakeOwnership: boolean | null;
  canModifyTax: boolean | null;
}

export interface MicrostructureResult {
  ca: string;
  totalHolders: number;
  // Raw sum of the top-10 holders' shares. Includes staking pools, exchange
  // custody, burn addresses, LP lockers, etc. Useful for display but NOT
  // directly usable as a rug-risk signal on mature tokens.
  top10Share: number;
  // Top-10 share after removing addresses in non-circulating categories
  // (burn / staking / exchange / bridge / locker). This is the number the
  // rug-risk score is computed from.
  top10EffectiveShare: number;
  topHolderShare: number;
  topHolders: MicrostructureHolder[];
  lp: MicrostructureLp;
  snipers: MicrostructureSnipers;
  devWallet: MicrostructureDevWallet;
  // Days since token creation per Moralis metadata, or null if unknown.
  tokenAgeDays: number | null;
  rugRiskScore: number; // 0-100
  riskHeadline: string;
  computedAt: number; // unix seconds
  // GMGN security data (null when GMGN API key is not configured).
  security: MicrostructureSecurity | null;
  // Cluster/sybil detection (null when detection was skipped or failed).
  clusters: MicrostructureClusters | null;
  // Cache version — bumped when structural changes invalidate cached results.
  _cacheVersion?: number;
}

export interface MicrostructureClusters {
  detected: boolean;
  walletCount: number;       // wallets in the largest cluster
  combinedSharePct: number;  // combined share of the largest cluster, 0-100
}

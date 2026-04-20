// Shared types for the Niya Tools extension.
// Scout / Analyst / Pro are tier labels gated by on-chain wallet age per PRD §5.

export type Tier = 'scout' | 'analyst' | 'pro';

export type HostSite = 'dexscreener' | 'pancakeswap' | 'fourmeme' | 'gmgn' | 'unknown';

/** A BSC contract address detected from the host page URL. */
export interface DetectedAddress {
  ca: string;
  source: HostSite;
  detectedAt: number;
}

/** Messages exchanged between content script, background and side panel. */
export type BgMessage =
  | { type: 'ca-detected'; payload: DetectedAddress }
  | { type: 'get-current-ca' }
  | { type: 'current-ca'; payload: DetectedAddress | null };

// --- Market data types (Day 2) ---

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d';

export const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];

/** A single OHLCV candle, times in UNIX seconds (lightweight-charts format). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// --- Microstructure types (Day 3, extended Day 7.7) ---
// Mirrored from `../src/features/nylaTools/schema.ts` in the parent
// monorepo. Keep both files in sync.

export type HolderCategory =
  | 'burn'
  | 'staking'
  | 'exchange'
  | 'bridge'
  | 'dex'
  | 'locker'
  | 'launchpad';

export interface MicrostructureHolder {
  address: string;
  share: number; // percent of supply, 0-100
  isContract: boolean;
  label: string | null; // human-readable name when we recognise the contract
  category: HolderCategory | null; // classification; null = regular wallet
  /** GMGN enrichment tags (whale, cex, smart_money, renowned, suspicious, …).
   *  Only populated when the address appears in both Moralis' top-100 and
   *  GMGN's tagged sets, so it's typically present for memecoin holders and
   *  mostly empty for bluechip top holders (CEX custody wallets etc.). */
  gmgnTags?: string[];
}

export interface MicrostructureLp {
  locked: boolean;
  lockedShare: number; // 0-100, percent of LP supply locked or burned
  lockProvider: 'unicrypt' | 'pinklock' | 'burned' | 'bonding-curve' | null;
}

export interface MicrostructureSnipers {
  // null when we intentionally did not compute this (mature token).
  // `skipped === true` disambiguates from "we measured and found zero".
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
  // Raw sum of the top 10 holders' shares. Includes staking pools,
  // exchange custody, burn addresses, LP lockers, etc. Display-only.
  top10Share: number;
  // Top 10 share excluding non-circulating categories. This is the
  // number the rug-risk score is computed from.
  top10EffectiveShare: number;
  topHolderShare: number;
  topHolders: MicrostructureHolder[];
  lp: MicrostructureLp;
  snipers: MicrostructureSnipers;
  devWallet: MicrostructureDevWallet;
  tokenAgeDays: number | null;
  rugRiskScore: number;
  riskHeadline: string;
  computedAt: number;
  // GMGN security data (null when GMGN is not configured).
  security: MicrostructureSecurity | null;
  // Cluster/sybil detection (null when detection was skipped or failed).
  clusters: MicrostructureClusters | null;
  // Internal cache-versioning; bumped by the backend when structural changes
  // need to invalidate stale DB-cached results.
  _cacheVersion?: number;
}

export interface MicrostructureClusters {
  detected: boolean;
  walletCount: number;       // wallets in the largest cluster
  combinedSharePct: number;  // combined share of the largest cluster, 0-100
}

// --- Browser wallet (Day 7.6) ---
//
// We do not talk to `window.ethereum` from the side panel at all. MetaMask
// does not inject providers into chrome-extension:// origins, and the
// MAIN-world bridge through chrome.scripting was unreliable (it returned
// whichever account the active dapp had selected, not the user's actual
// wallet). Instead the side panel asks the user to paste their public BSC
// address into a text input — Nyla Tools is read-only by design, so we
// never need a signature.

/** Summary of a trading pair as returned by the DexScreener token endpoint. */
export interface PairSummary {
  pairAddress: string;
  chainId: string;
  dexId: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  /** Fully diluted valuation in USD. Memecoin traders anchor on this. */
  fdv: number;
  /** Circulating market cap in USD when DexScreener provides it; falls back to FDV. */
  marketCap: number;
  baseToken: {
    symbol: string;
    name: string;
    address: string;
  };
  quoteToken: {
    symbol: string;
    address: string;
  };
  url: string;
}

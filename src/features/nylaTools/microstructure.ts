// Microstructure orchestrator for Nyla Tools.
// Combines Moralis calls into a single MicrostructureResult that the side
// panel renders as Scout Mode cards.
//
// This file owns the rug-risk heuristic. It is intentionally simple and
// transparent — every contributing factor maps to a UI card so the user
// can see *why* a token is flagged.
//
// Day 7.7 changes: use the `knownContracts` registry so staking pools,
// exchange custody, burn addresses and LP lockers are labelled and can be
// excluded from the "effective" top-10 share used for scoring. Sniper
// detection is gated behind token age (meaningless on mature tokens).

import {
  fetchTokenHolders,
  fetchTokenMetadata,
  fetchTokenTransfers,
  fetchWalletFunder,
  fetchWalletTokenBalance,
  type HolderRow,
  type TokenTx,
} from "./moralis";
import {
  fetchTokenSecurity as fetchGoPlusSecurity,
  type GoPlusLpHolder,
} from "./goplus";
// GMGN enrichment (re-enabled via gmgn-cli subprocess — the CLI handles
// Ed25519 signing + IPv4-only + rate limiting internally). Credentials
// live in ~/.config/gmgn/.env; see src/features/nylaTools/gmgn.ts header.
import { fetchTopHolders as fetchGmgnTopHolders } from "./gmgn";
import {
  isNonCirculatingCategory,
  lookupKnownContract,
} from "./knownContracts";
import type {
  HolderCategory,
  MicrostructureClusters,
  MicrostructureDevWallet,
  MicrostructureHolder,
  MicrostructureLp,
  MicrostructureResult,
  MicrostructureSecurity,
  MicrostructureSnipers,
} from "./schema";

export interface MicrostructureKeys {
  moralisApiKey: string | string[];
  gmgnApiKey: string | null; // null → skip GMGN enrichment
}

// Tokens older than this threshold skip sniper detection entirely — the
// "first 30 transfers" are from years ago and the result is noise.
const SNIPER_MAX_AGE_DAYS = 30;

function isBurnAddress(addr: string): boolean {
  const k = lookupKnownContract(addr);
  return k?.category === "burn";
}

/**
 * Pure scoring heuristic. Takes the EFFECTIVE top-10 share (i.e. already
 * excluding staking / exchange / burn / bridge / locker addresses) so that
 * blue-chips like CAKE and BUSD are not falsely flagged as concentrated.
 *
 * `snipers.count === null` means we intentionally skipped the check (mature
 * token); in that case this factor contributes nothing to the score.
 */
export function computeRugRiskScore(input: {
  top10EffectiveShare: number;
  topHolderShare?: number;
  totalHolders?: number;
  lp: MicrostructureLp;
  snipers: MicrostructureSnipers;
  devWallet: MicrostructureDevWallet;
  security?: MicrostructureSecurity | null;
  tokenAgeDays?: number | null;
  clusters?: MicrostructureClusters | null;
}): number {
  let score = 0;
  const age = input.tokenAgeDays;
  const isBondingCurve = input.lp.lockProvider === 'bonding-curve';

  // Token age factor — reduced for launchpad tokens (young by nature).
  if (isBondingCurve) {
    if (age == null) score += 5;
    else if (age < 1) score += 10;
    else if (age < 7) score += 5;
  } else {
    if (age == null) score += 15;
    else if (age < 1) score += 20;
    else if (age < 7) score += 15;
    else if (age < 30) score += 10;
    else if (age < 90) score += 5;
  }

  if (input.top10EffectiveShare > 80) score += 35;
  else if (input.top10EffectiveShare > 60) score += 20;
  else if (input.top10EffectiveShare > 40) score += 10;

  // LP: bonding curve = no penalty (liquidity managed by curve).
  if (isBondingCurve) {
    // no LP penalty
  } else if (!input.lp.locked || input.lp.lockedShare < 5) {
    score += 25;
  } else if (input.lp.lockedShare < 50) {
    score += 10;
  }

  // Only contribute if we actually measured snipers.
  if (input.snipers.sharePct != null) {
    if (input.snipers.sharePct > 30) score += 20;
    else if (input.snipers.sharePct > 15) score += 10;
  }

  if (input.devWallet.currentShare > 10) score += 15;
  else if (input.devWallet.currentShare > 5) score += 5;

  // Low holder count — suspiciously thin distribution.
  if (input.totalHolders != null) {
    if (input.totalHolders < 50) score += 15;
    else if (input.totalHolders < 200) score += 10;
  }

  // Top single holder concentration (unlabelled whales are riskier).
  if (input.topHolderShare != null && input.topHolderShare > 10) {
    score += 10;
  }

  // GoPlus security factors (when available).
  if (input.security) {
    if (input.security.isHoneypot) score += 40;
    if ((input.security.sellTax ?? 0) > 10) score += 15;
    if (input.security.canTakeOwnership) score += 10;
    if ((input.security.buyTax ?? 0) > 10) score += 10;
    if (input.security.canModifyTax) score += 10;
    if (input.security.isOpenSource === false) score += 5;
  }

  // Wallet cluster / sybil detection — multiple top holders funded by
  // the same source wallet is a strong manipulation signal.
  if (input.clusters?.detected) {
    if (input.clusters.combinedSharePct > 30) score += 25;
    else if (input.clusters.combinedSharePct > 15) score += 15;
    else score += 10;
  }

  // Minimum floor — lower for bonding curve tokens.
  if (isBondingCurve) {
    if (age != null && age < 2) score = Math.max(score, 30);
    else if (age != null && age < 7) score = Math.max(score, 15);
  } else {
    if (age != null && age < 2) score = Math.max(score, 55);
    else if (age != null && age < 7) score = Math.max(score, 30);
  }

  return Math.max(0, Math.min(100, score));
}

function buildHeadline(input: {
  score: number;
  top10EffectiveShare: number;
  topHolderShare?: number;
  totalHolders?: number;
  lp: MicrostructureLp;
  snipers: MicrostructureSnipers;
  devWallet: MicrostructureDevWallet;
  tokenAgeDays?: number | null;
  clusters?: MicrostructureClusters | null;
}): string {
  // Pick the single biggest contributor and lead with it. The LLM layer
  // (Day 8) generates the long-form copy; this fallback works without LLM.
  const reasons: { weight: number; text: string }[] = [];
  if (input.tokenAgeDays != null && input.tokenAgeDays < 7) {
    reasons.push({
      weight: 85,
      text: `Token is only ${input.tokenAgeDays} day(s) old`,
    });
  }
  if (input.top10EffectiveShare > 60) {
    reasons.push({
      weight: input.top10EffectiveShare,
      text: `Top 10 wallets control ${input.top10EffectiveShare.toFixed(
        0,
      )}% of circulating supply`,
    });
  }
  if ((!input.lp.locked || input.lp.lockedShare < 5) && input.lp.lockProvider !== 'bonding-curve') {
    reasons.push({ weight: 90, text: "Liquidity is not meaningfully locked" });
  }
  if (input.totalHolders != null && input.totalHolders < 50) {
    reasons.push({
      weight: 88,
      text: `Only ${input.totalHolders} holders — extremely thin distribution`,
    });
  } else if (input.totalHolders != null && input.totalHolders < 200) {
    reasons.push({
      weight: 75,
      text: `Only ${input.totalHolders} holders — thin distribution`,
    });
  }
  if (input.topHolderShare != null && input.topHolderShare > 10) {
    reasons.push({
      weight: 78,
      text: `Largest wallet holds ${input.topHolderShare.toFixed(1)}% of supply`,
    });
  }
  if (
    input.snipers.sharePct != null &&
    input.snipers.count != null &&
    input.snipers.sharePct > 15
  ) {
    reasons.push({
      weight: 80 + input.snipers.sharePct,
      text: `${input.snipers.count} sniper wallets still hold ${input.snipers.sharePct.toFixed(
        0,
      )}%`,
    });
  }
  if (input.devWallet.currentShare > 5) {
    reasons.push({
      weight: 70 + input.devWallet.currentShare,
      text: `Deployer wallet still holds ${input.devWallet.currentShare.toFixed(1)}%`,
    });
  }
  if (input.clusters?.detected) {
    reasons.push({
      weight: 92,
      text: `${input.clusters.walletCount} wallets funded by the same source hold ${input.clusters.combinedSharePct.toFixed(0)}% of supply`,
    });
  }

  if (reasons.length === 0) {
    if (input.lp.lockProvider === 'bonding-curve') {
      return "Launched via bonding curve — distribution is the main risk factor.";
    }
    if (input.score < 25) {
      if (input.lp.locked) {
        return "Distribution looks healthy and liquidity is locked.";
      }
      return "Distribution looks healthy.";
    }
    return "No single critical risk factor detected.";
  }

  reasons.sort((a, b) => b.weight - a.weight);
  return reasons[0].text + ".";
}

/**
 * Convert a Moralis HolderRow list into the on-the-wire shape and compute
 * top-1 / top-10 raw and effective share. Effective share excludes
 * non-circulating categories (burn / staking / exchange / bridge / locker)
 * so that blue-chips with large staking pools aren't falsely concentrated.
 */
function summarizeHolders(rows: HolderRow[]): {
  topHolders: MicrostructureHolder[];
  topHolderShare: number;
  top10Share: number;
  top10EffectiveShare: number;
} {
  const top10 = rows.slice(0, 10);
  const topHolders: MicrostructureHolder[] = top10.map((h) => {
    const known = lookupKnownContract(h.address);
    const category: HolderCategory | null = known?.category ?? null;
    return {
      address: h.address,
      share: h.share,
      isContract: h.isContract || known !== null,
      label: known?.label ?? null,
      category,
    };
  });
  const topHolderShare = top10.length > 0 ? top10[0].share : 0;
  const top10Share = top10.reduce((sum, h) => sum + h.share, 0);
  const top10EffectiveShare = topHolders.reduce(
    (sum, h) => (isNonCirculatingCategory(h.category) ? sum : sum + h.share),
    0,
  );
  return {
    topHolders,
    topHolderShare,
    top10Share,
    top10EffectiveShare,
  };
}

/**
 * Sniper detection: from the first 30 token transfers, collect the unique
 * `to` addresses (excluding the deployer and burn addresses), then look up
 * how much of supply they currently hold combined. The result is a rough
 * upper bound on early-bird wallets that haven't sold yet.
 *
 * Only meaningful for young tokens — the caller gates on token age and
 * passes `skipped: true` when the token is too old to measure.
 */
async function computeSnipers(
  ca: string,
  firstTxs: TokenTx[],
  deployer: string | null,
  totalSupplyRaw: number,
  moralisApiKey: string | string[],
): Promise<MicrostructureSnipers> {
  if (totalSupplyRaw <= 0) {
    return { count: 0, sharePct: 0, skipped: false };
  }
  const deployerLower = deployer?.toLowerCase() ?? "";
  const sniperAddrs = new Set<string>();
  for (const tx of firstTxs) {
    const to = tx.to?.toLowerCase();
    if (!to) continue;
    if (to === deployerLower) continue;
    if (isBurnAddress(to)) continue;
    sniperAddrs.add(to);
    if (sniperAddrs.size >= 30) break;
  }

  let combinedRaw = 0;
  // Cap the lookups to avoid burning Moralis CU budget.
  const addrsArr = Array.from(sniperAddrs).slice(0, 30);
  for (const addr of addrsArr) {
    try {
      const bal = await fetchWalletTokenBalance(addr, ca, moralisApiKey);
      combinedRaw += Number(bal || "0");
    } catch (e) {
      console.warn("[nyla-tools] sniper balance fetch failed", addr, e);
    }
  }
  const sharePct = (combinedRaw / totalSupplyRaw) * 100;
  return {
    count: addrsArr.length,
    sharePct: Math.min(100, Math.max(0, sharePct)),
    skipped: false,
  };
}

/**
 * Infer LP lock state from the token's top holders. If any top holder is a
 * known LP locker (UniCrypt, PinkLock) or a burn address, we count its share
 * towards `lockedShare` and flag `locked: true`.
 *
 * Uses the same registry as holder labelling so both stay in sync.
 */
function inferLp(rows: HolderRow[]): MicrostructureLp {
  let lockedShare = 0;
  let provider: MicrostructureLp["lockProvider"] = null;
  for (const h of rows) {
    const known = lookupKnownContract(h.address);
    if (!known) continue;
    if (known.category === "burn") {
      lockedShare += h.share;
      provider = provider ?? "burned";
    } else if (known.category === "locker") {
      lockedShare += h.share;
      // Prefer an explicit provider over the generic "burned" fallback.
      if (known.label.toLowerCase().includes("unicrypt")) {
        provider = "unicrypt";
      } else if (known.label.toLowerCase().includes("pink")) {
        provider = "pinklock";
      } else {
        provider = provider ?? "unicrypt";
      }
    } else if (known.category === "launchpad") {
      lockedShare += h.share;
      provider = "bonding-curve";
    }
  }
  return {
    locked: lockedShare > 0,
    lockedShare: Math.min(100, lockedShare),
    lockProvider: provider,
  };
}

/**
 * Infer LP lock state from GoPlus lp_holders data. This inspects the actual
 * LP pair token holders (not the project token holders), which is far more
 * accurate than scanning top token holders against a registry.
 */
function inferLpFromGoPlus(
  lpHolders: GoPlusLpHolder[],
): MicrostructureLp | null {
  if (lpHolders.length === 0) return null;

  let lockedShare = 0;
  let provider: MicrostructureLp["lockProvider"] = null;

  for (const h of lpHolders) {
    if (!h.isLocked) continue;
    lockedShare += h.percent;

    const tag = (h.tag ?? "").toLowerCase();
    if (
      tag.includes("dead") ||
      tag.includes("burn") ||
      h.address === "0x000000000000000000000000000000000000dead" ||
      h.address === "0x0000000000000000000000000000000000000000"
    ) {
      provider = provider ?? "burned";
    } else if (tag.includes("unicrypt")) {
      provider = "unicrypt";
    } else if (tag.includes("pink")) {
      provider = "pinklock";
    } else {
      provider = provider ?? "burned";
    }
  }

  if (lockedShare <= 0) return null;

  return {
    locked: true,
    lockedShare: Math.min(100, lockedShare),
    lockProvider: provider,
  };
}

/**
 * Compute days since the token was created from the Moralis `created_at`
 * ISO-8601 string. Returns null if the metadata is missing or unparseable.
 */
function computeTokenAgeDays(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = (Date.now() - t) / 86_400_000;
  return days >= 0 ? Math.floor(days) : null;
}

/**
 * Helper: check whether an address is a known exchange.
 */
function isExchangeAddress(addr: string): boolean {
  return lookupKnownContract(addr)?.category === "exchange";
}

/**
 * Find the largest cluster from a funder→wallets map. Returns the count and
 * combined share of the biggest group (2+ wallets sharing the same funder).
 */
function findBestCluster(
  funderMap: Map<string, { address: string; share: number }[]>,
): { count: number; share: number } {
  let bestCount = 0;
  let bestShare = 0;
  for (const group of funderMap.values()) {
    if (group.length >= 2) {
      const share = group.reduce((sum, g) => sum + g.share, 0);
      if (group.length > bestCount || (group.length === bestCount && share > bestShare)) {
        bestCount = group.length;
        bestShare = share;
      }
    }
  }
  return { count: bestCount, share: bestShare };
}

/**
 * Cluster / sybil detection with 2-hop funder tracing.
 *
 * Hop 1: For each top-holder wallet, find who funded it.
 * If 2+ wallets share the same funder → cluster detected.
 *
 * Hop 2: If no cluster at hop 1, trace funder-of-funder. Manipulation often
 * goes through intermediate wallets: master → intermediary → holder. If 2+
 * intermediary funders share the same "grandparent" funder → cluster detected.
 */
async function detectClusters(
  topHolders: MicrostructureHolder[],
  moralisApiKey: string | string[],
): Promise<MicrostructureClusters> {
  const wallets = topHolders.filter(
    (h) => h.category === null && !h.isContract,
  );
  console.debug(
    "[nyla-tools] cluster detection:",
    wallets.length, "eligible wallets out of", topHolders.length, "top holders",
  );
  if (wallets.length < 2) {
    return { detected: false, walletCount: 0, combinedSharePct: 0 };
  }

  // --- Hop 1: direct funders ---
  const hop1Results = await Promise.allSettled(
    wallets.map((w) => fetchWalletFunder(w.address, moralisApiKey)),
  );

  // Map: wallet index → its funder (non-exchange).
  const walletFunder: (string | null)[] = [];
  const hop1Map = new Map<string, { address: string; share: number }[]>();
  for (let i = 0; i < wallets.length; i++) {
    const r = hop1Results[i];
    const funder =
      r.status === "fulfilled" && r.value && !isExchangeAddress(r.value)
        ? r.value
        : null;
    walletFunder.push(funder);
    if (funder) {
      if (!hop1Map.has(funder)) hop1Map.set(funder, []);
      hop1Map.get(funder)!.push({
        address: wallets[i].address,
        share: wallets[i].share,
      });
    }
  }

  const resolvedCount = Array.from(hop1Map.values()).flat().length;
  console.debug(
    "[nyla-tools] hop1 funders resolved:",
    resolvedCount, "of", wallets.length, "wallets →",
    hop1Map.size, "unique funders",
  );

  const hop1Best = findBestCluster(hop1Map);
  if (hop1Best.count >= 2) {
    console.debug(
      "[nyla-tools] cluster found at hop 1:",
      hop1Best.count, "wallets, combined share",
      hop1Best.share.toFixed(1) + "%",
    );
    return {
      detected: true,
      walletCount: hop1Best.count,
      combinedSharePct: Math.min(100, hop1Best.share),
    };
  }

  // --- Hop 2: funder-of-funder ---
  // Collect unique hop-1 funders that are not themselves top holders.
  const topHolderAddrs = new Set(wallets.map((w) => w.address));
  const uniqueFunders = [...new Set(walletFunder.filter(Boolean) as string[])]
    .filter((f) => !topHolderAddrs.has(f));

  if (uniqueFunders.length < 2) {
    return { detected: false, walletCount: 0, combinedSharePct: 0 };
  }

  const hop2Results = await Promise.allSettled(
    uniqueFunders.map((f) => fetchWalletFunder(f, moralisApiKey)),
  );

  // Map: hop-1 funder → its funder (grandparent).
  const grandparentOf = new Map<string, string>();
  for (let i = 0; i < uniqueFunders.length; i++) {
    const r = hop2Results[i];
    if (r.status === "fulfilled" && r.value && !isExchangeAddress(r.value)) {
      grandparentOf.set(uniqueFunders[i], r.value);
    }
  }

  // Build grandparent → wallets map.
  const hop2Map = new Map<string, { address: string; share: number }[]>();
  for (let i = 0; i < wallets.length; i++) {
    const funder = walletFunder[i];
    if (!funder) continue;
    const grandparent = grandparentOf.get(funder);
    if (!grandparent) continue;
    if (!hop2Map.has(grandparent)) hop2Map.set(grandparent, []);
    hop2Map.get(grandparent)!.push({
      address: wallets[i].address,
      share: wallets[i].share,
    });
  }

  // Log group sizes for debugging.
  for (const [gp, group] of hop2Map) {
    if (group.length >= 2) {
      console.debug(
        "[nyla-tools] hop2 cluster candidate: grandparent",
        gp.slice(0, 10) + "...",
        "funds", group.length, "wallets, combined",
        group.reduce((s, g) => s + g.share, 0).toFixed(1) + "%",
      );
    }
  }

  console.debug(
    "[nyla-tools] hop2 grandparents:",
    hop2Map.size, "unique grandparents for",
    uniqueFunders.length, "funders",
  );

  const hop2Best = findBestCluster(hop2Map);
  if (hop2Best.count >= 2) {
    console.debug(
      "[nyla-tools] cluster found at hop 2:",
      hop2Best.count, "wallets, combined share",
      hop2Best.share.toFixed(1) + "%",
    );
  }

  return {
    detected: hop2Best.count >= 2,
    walletCount: hop2Best.count,
    combinedSharePct: Math.min(100, hop2Best.share),
  };
}

/**
 * Run the full microstructure pipeline against Moralis.
 * This is the function the API endpoint calls on cache miss.
 */
export async function computeMicrostructure(
  ca: string,
  keys: MicrostructureKeys,
  source?: string,
): Promise<MicrostructureResult> {
  const lower = ca.toLowerCase();

  // Run independent calls in parallel to keep cold-call latency low.
  // GoPlus replaces GMGN for security data (GMGN blocked by Cloudflare).
  // Fan out to all data sources in parallel. GMGN is best-effort — its
  // enrichment layers tags onto the Moralis top holders; if it fails,
  // we still render a full panel from Moralis + GoPlus.
  const [holders, metadata, goplusSecurity, gmgnHolders] =
    await Promise.all([
      fetchTokenHolders(lower, 100, keys.moralisApiKey).catch((e) => {
        console.warn("[nyla-tools] moralis holders failed:", e);
        return { totalHolders: 0, topHolders: [] as HolderRow[] };
      }),
      fetchTokenMetadata(lower, keys.moralisApiKey).catch((e) => {
        console.warn("[nyla-tools] moralis metadata failed:", e);
        return null;
      }),
      fetchGoPlusSecurity(lower).catch(() => null),
      keys.gmgnApiKey
        ? fetchGmgnTopHolders(lower, keys.gmgnApiKey).catch((e) => {
            console.warn("[nyla-tools] GMGN holders failed:", e);
            return [];
          })
        : Promise.resolve([]),
    ]);
  const goplusHolderCount = goplusSecurity?.holderCount ?? null;
  // Build an address → tags map so we can enrich Moralis holders below.
  // Only holders present in both Moralis' top-10 and GMGN's tag set get
  // tags rendered in the UI — blue-chip tokens (BNB, USDC, SHIB) tend to
  // have long-term passive whales in the top and active traders further
  // down, so overlap is small. On fresh memecoins the overlap is high.
  const gmgnTagsByAddr = new Map<string, string[]>();
  for (const h of gmgnHolders) {
    if (h.tags.length > 0) gmgnTagsByAddr.set(h.address, h.tags);
  }

  // --- holders summary ---
  const { topHolders, topHolderShare, top10Share, top10EffectiveShare } =
    summarizeHolders(holders.topHolders);

  // --- GMGN tag enrichment ---
  // For each Moralis top-10 holder, attach GMGN's behavioural tags (whale,
  // cex, smart_money, renowned, suspicious) when the address is in the
  // tagged set. Mutates the already-summarised holders in place so the
  // score heuristics below can factor them in.
  for (const h of topHolders) {
    const tags = gmgnTagsByAddr.get(h.address.toLowerCase());
    if (tags && tags.length > 0) h.gmgnTags = tags;
  }

  // --- LP inference ---
  // Priority 1: GoPlus lp_holders (inspects LP pair token — most accurate).
  // Priority 2: Holder-based inference (scans token holders for known lockers).
  let lp = goplusSecurity?.lpHolders
    ? inferLpFromGoPlus(goplusSecurity.lpHolders) ?? inferLp(holders.topHolders)
    : inferLp(holders.topHolders);

  // Source-based fallback: if the token was detected on Four.meme and
  // inferLp didn't find a bonding curve contract among holders, force it.
  if (lp.lockProvider !== 'bonding-curve' && source === 'fourmeme') {
    lp = { locked: true, lockedShare: 100, lockProvider: 'bonding-curve' };
  }

  // Creator-based detection — works from ANY site.
  // GoPlus returns the deployer; if it's a known launchpad contract, the
  // token was created via bonding curve and LP is managed by the platform.
  if (lp.lockProvider !== 'bonding-curve' && goplusSecurity?.creatorAddress) {
    const creatorInfo = lookupKnownContract(goplusSecurity.creatorAddress);
    if (creatorInfo?.category === 'launchpad') {
      lp = { locked: true, lockedShare: 100, lockProvider: 'bonding-curve' };
    }
  }

  // --- supply (for sniper share calculations) ---
  const totalSupplyRaw = Number(metadata?.totalSupply ?? "0") || 0;

  // --- token age ---
  const tokenAgeDays = computeTokenAgeDays(metadata?.createdAt ?? null);

  // --- snipers (gated by token age) ---
  let snipers: MicrostructureSnipers;
  if (tokenAgeDays == null || tokenAgeDays > SNIPER_MAX_AGE_DAYS) {
    // Mature token (or unknown age): skip the expensive first-transfers +
    // balance fan-out. Sniper detection on a token that launched years ago
    // is noise.
    snipers = { count: null, sharePct: null, skipped: true };
  } else {
    const firstTxs = await fetchTokenTransfers(
      lower,
      30,
      keys.moralisApiKey,
    ).catch((e) => {
      console.warn("[nyla-tools] moralis first transfers failed:", e);
      return [] as TokenTx[];
    });
    snipers = await computeSnipers(
      lower,
      firstTxs,
      null,
      totalSupplyRaw,
      keys.moralisApiKey,
    );
  }

  // --- dev wallet (dropped — no free Moralis equivalent) ---
  const devWallet: MicrostructureDevWallet = {
    address: null,
    currentShare: 0,
  };

  // --- GoPlus security data ---
  const security: MicrostructureSecurity | null = goplusSecurity
    ? {
        isHoneypot: goplusSecurity.isHoneypot,
        buyTax: goplusSecurity.buyTax,
        sellTax: goplusSecurity.sellTax,
        isOpenSource: goplusSecurity.isOpenSource,
        canTakeOwnership: goplusSecurity.canTakeOwnership,
        canModifyTax: goplusSecurity.canModifyTax,
      }
    : null;

  // --- totalHolders: prefer GoPlus if larger than Moralis cap ---
  const totalHolders =
    goplusHolderCount && goplusHolderCount > holders.totalHolders
      ? goplusHolderCount
      : holders.totalHolders;

  // --- cluster / sybil detection ---
  let clusters: MicrostructureClusters | null = null;
  try {
    clusters = await detectClusters(topHolders, keys.moralisApiKey);
  } catch (e) {
    console.warn("[nyla-tools] cluster detection failed:", e);
  }

  // --- score ---
  const rugRiskScore = computeRugRiskScore({
    top10EffectiveShare,
    topHolderShare,
    totalHolders,
    lp,
    snipers,
    devWallet,
    security,
    tokenAgeDays,
    clusters,
  });
  const riskHeadline = buildHeadline({
    score: rugRiskScore,
    top10EffectiveShare,
    topHolderShare,
    totalHolders,
    lp,
    snipers,
    devWallet,
    tokenAgeDays,
    clusters,
  });

  return {
    ca: lower,
    totalHolders,
    top10Share,
    top10EffectiveShare,
    topHolderShare,
    topHolders,
    lp,
    snipers,
    devWallet,
    tokenAgeDays,
    rugRiskScore,
    riskHeadline,
    computedAt: Math.floor(Date.now() / 1000),
    security,
    clusters,
    _cacheVersion: 2, // bump to invalidate stale cache entries
  };
}

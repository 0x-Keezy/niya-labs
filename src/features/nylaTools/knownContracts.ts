// Registry of well-known BSC contracts we need to classify when computing
// holder concentration. The goal is to distinguish "legitimate" non-circulating
// supply (staking pools, burn addresses, exchange custody, bridge escrows, LP
// lockers) from "whale wallets that could dump", because the former should NOT
// count against the rug-risk score.
//
// This list is intentionally conservative and hand-curated. Adding every
// exchange subwallet on BSC would be maintenance hell, but covering the top
// ~25 addresses already filters out >90% of the "fake concentration" noise on
// BSC blue-chips like CAKE and BUSD.
//
// Keys are lowercase 40-char BSC addresses. Every key MUST stay lowercase or
// `lookupKnownContract` will miss.

export type HolderCategory =
  | "burn"
  | "staking"
  | "exchange"
  | "bridge"
  | "dex"
  | "locker"
  | "launchpad";

export interface KnownContract {
  label: string;
  category: HolderCategory;
}

export const BSC_KNOWN_CONTRACTS: Record<string, KnownContract> = {
  // --- burn ---
  "0x0000000000000000000000000000000000000000": {
    label: "Null burn",
    category: "burn",
  },
  "0x000000000000000000000000000000000000dead": {
    label: "Dead burn",
    category: "burn",
  },

  // --- PancakeSwap staking ---
  "0x73feaa1ee314f8c655e354234017be2193c9e24e": {
    label: "PancakeSwap MasterChef",
    category: "staking",
  },
  "0x45c54210128a065de780c4b0df3d16664f7f859e": {
    label: "PancakeSwap MasterChef V2",
    category: "staking",
  },
  "0xa5f8c5dbd5f286960b9d90548680ae5ebff07652": {
    label: "PancakeSwap CAKE Pool",
    category: "staking",
  },

  // --- Binance hot / cold wallets ---
  "0x8894e0a0c962cb723c1976a4421c95949be2d4e3": {
    label: "Binance Hot 2",
    category: "exchange",
  },
  "0xf977814e90da44bfa03b6295a0616a897441acec": {
    label: "Binance Cold",
    category: "exchange",
  },
  "0xe2fc31f816a9b94326492132018c3aecc4a93ae1": {
    label: "Binance Hot 3",
    category: "exchange",
  },
  "0x3c783c21a0383057d128bae431894a5c19f9cf06": {
    label: "Binance Peg Deposit",
    category: "exchange",
  },
  "0x28c6c06298d514db089934071355e5743bf21d60": {
    label: "Binance Hot 14",
    category: "exchange",
  },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": {
    label: "Binance Hot 15",
    category: "exchange",
  },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": {
    label: "Binance Hot 16",
    category: "exchange",
  },
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": {
    label: "Binance Hot 17",
    category: "exchange",
  },
  "0x9696f59e4d72e237be84ffd425dcad154bf96976": {
    label: "Binance Hot 18",
    category: "exchange",
  },
  "0x4976a4a02f38326660d17bf34b431dc6e2eb2327": {
    label: "Binance Peg",
    category: "exchange",
  },
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": {
    label: "Binance 8",
    category: "exchange",
  },

  // --- Other exchanges ---
  "0x68b22215ff74e3606bd5e6c1de8c2d68180c85f7": {
    label: "OKX",
    category: "exchange",
  },
  "0x7793cd85c11a924478d358d49b05b37e91b5810f": {
    label: "Gate.io",
    category: "exchange",
  },
  "0xeb2d2f1b8c558a40207669291fda468e50c8a0bb": {
    label: "KuCoin",
    category: "exchange",
  },
  "0x2b5634c42055806a59e9107ed44d43c426e58258": {
    label: "KuCoin 2",
    category: "exchange",
  },

  // --- Bridges ---
  "0x0000000000000000000000000000000000001004": {
    label: "BNB TokenHub",
    category: "bridge",
  },
  "0xb7d6d7a6dd1f514b2f4fbcbf1fac5127ceebcdcf": {
    label: "Stargate Router",
    category: "bridge",
  },
  "0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe": {
    label: "Multichain Router",
    category: "bridge",
  },
  "0xd1c5966f9f5ee6881ff6b261bbeda45972b1b5f3": {
    label: "Celer cBridge",
    category: "bridge",
  },

  // --- LP lockers ---
  "0x7ee058420e5937496f5a2096f04caa7721cf70cc": {
    label: "UniCrypt V2",
    category: "locker",
  },
  "0xc765bddb93b0d1c1a88282ba0fa6b2d00e3e0c83": {
    label: "PinkLock V2",
    category: "locker",
  },
  "0x71b5759d73262fbb223956913ecf4ecc51057641": {
    label: "PinkLock V1",
    category: "locker",
  },
  "0x407993575c91ce7643a4d4ccacc9a98c36ee1bbe": {
    label: "PinkSale Lock",
    category: "locker",
  },

  // --- Launchpads (bonding curve) ---
  "0x5c952063c7fc8610ffdb798152d69f0b9550762b": {
    label: "Four.meme Token Manager V2",
    category: "launchpad",
  },
  "0xec4549cadce5da21df6e6422d448034b5233bfbc": {
    label: "Four.meme Token Manager V1",
    category: "launchpad",
  },
  "0xf251f83e40a78868fcfa3fa4599dad6494e46034": {
    label: "Four.meme Helper V3",
    category: "launchpad",
  },
  "0xa858947aad3d12f24fbbc0449d72e4b52b11f47b": {
    label: "Flap Token Manager",
    category: "launchpad",
  },
};

export function lookupKnownContract(addr: string): KnownContract | null {
  return BSC_KNOWN_CONTRACTS[addr.toLowerCase()] ?? null;
}

/**
 * Categories that represent "non-circulating" or "non-whale" supply —
 * concentration at these addresses is not a rug-risk signal and should be
 * excluded from the effective top-10 share used for scoring.
 *
 * Note `dex` is intentionally NOT in this set: a DEX router holding a lot of
 * supply could signal real concentration pushed through a single pool.
 */
const NON_CIRCULATING_CATEGORIES: ReadonlySet<HolderCategory> = new Set<HolderCategory>([
  "burn",
  "staking",
  "exchange",
  "bridge",
  "locker",
  "launchpad",
]);

export function isNonCirculatingCategory(category: HolderCategory | null): boolean {
  return category !== null && NON_CIRCULATING_CATEGORIES.has(category);
}

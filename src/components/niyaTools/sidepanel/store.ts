import { create } from 'zustand';
import type { DetectedAddress, Tier } from '../lib/types';
import { webStorage } from '../lib/webAdapter';

interface NiyaState {
  currentCa: DetectedAddress | null;
  tier: Tier;
  userAddress: string | null;
  walletAgeDays: number | null;
  setCurrentCa: (ca: DetectedAddress | null) => void;
  setTier: (tier: Tier) => void;
  setUserWallet: (
    address: string | null,
    ageDays: number | null,
    tier: Tier,
  ) => void;
}

// Tier thresholds (days). Mirror of TIER_DAYS in
// ../../src/features/nylaTools/schema.ts (parent monorepo) — keep in sync.
const ANALYST_DAYS = 90;
const PRO_DAYS = 365;

export function tierFromAgeDays(days: number): Tier {
  if (days >= PRO_DAYS) return 'pro';
  if (days >= ANALYST_DAYS) return 'analyst';
  return 'scout';
}

const STORAGE_KEY = 'niya.wallet';

interface PersistedWallet {
  address: string;
  ageDays: number;
  tier: Tier;
}

// Persisted slice = wallet info only. We deliberately do NOT persist
// `currentCa` — that's per-tab / per-page state owned by the router.
function persistWallet(payload: PersistedWallet | null) {
  if (payload) {
    void webStorage.set(STORAGE_KEY, payload);
  } else {
    void webStorage.remove(STORAGE_KEY);
  }
}

export const useNiyaStore = create<NiyaState>((set) => ({
  currentCa: null,
  // Web defaults to 'analyst' so Analyst Panel + Strategy overlays are
  // visible out of the box. The extension dynamically computes tier from
  // wallet-age via a background worker; web has no wallet connect flow
  // yet, so we unlock the middle tier by default and let the user toggle
  // via the tier selector in the TopBar for demo purposes.
  tier: 'analyst',
  userAddress: null,
  walletAgeDays: null,
  setCurrentCa: (ca) => set({ currentCa: ca }),
  setTier: (tier) => set({ tier }),
  setUserWallet: (address, ageDays, tier) => {
    set({ userAddress: address, walletAgeDays: ageDays, tier });
    persistWallet(
      address && ageDays != null ? { address, ageDays, tier } : null,
    );
  },
}));

/**
 * Restore wallet info from localStorage on boot.
 * Called once from App.tsx; safe to call multiple times.
 */
export async function hydrateWalletFromStorage(): Promise<void> {
  const payload = await webStorage.get<PersistedWallet>(STORAGE_KEY);
  if (payload && typeof payload.address === 'string') {
    useNiyaStore.getState().setUserWallet(
      payload.address,
      payload.ageDays,
      payload.tier,
    );
  }
}

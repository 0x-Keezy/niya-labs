import { create } from 'zustand';
import type { DetectedAddress, Tier } from '../lib/types';

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
// `currentCa` — that's per-tab state owned by the background worker.
function persistWallet(payload: PersistedWallet | null) {
  try {
    if (payload) {
      void chrome.storage?.local.set({ [STORAGE_KEY]: payload });
    } else {
      void chrome.storage?.local.remove(STORAGE_KEY);
    }
  } catch {
    // Storage may not be available outside the extension runtime (e.g.
    // Vite preview); fail silently — store still works in-memory.
  }
}

export const useNiyaStore = create<NiyaState>((set) => ({
  currentCa: null,
  tier: 'scout',
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
 * Restore wallet info from chrome.storage.local on side-panel boot.
 * Called once from App.tsx; safe to call multiple times.
 */
export async function hydrateWalletFromStorage(): Promise<void> {
  try {
    const stored = await chrome.storage?.local.get(STORAGE_KEY);
    const payload = stored?.[STORAGE_KEY] as PersistedWallet | undefined;
    if (payload && typeof payload.address === 'string') {
      useNiyaStore.getState().setUserWallet(
        payload.address,
        payload.ageDays,
        payload.tier,
      );
    }
  } catch {
    // ignore
  }
}

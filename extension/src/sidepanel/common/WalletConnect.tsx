// Wallet "connect" — paste-only since Day 7.6.
//
// Why no MetaMask? MetaMask doesn't inject `window.ethereum` into
// chrome-extension:// origins, and the MAIN-world bridge through
// chrome.scripting that we tried in Day 7.5 returned the wrong account
// (whichever wallet the active dapp had selected, not the user's actual
// MetaMask). Niya Tools is read-only by design — we never need a signature
// — so we just ask the user to paste their public BSC address. This is
// what Bubblemaps, DexCheck, and similar scout tools do.

import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useNiyaStore, tierFromAgeDays } from '../store';
import { fetchWalletAge, BackendError } from '../../lib/backend';
import { shortenAddress } from '../../lib/format';
import type { Tier } from '../../lib/types';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const TIER_STYLES: Record<Tier, string> = {
  scout: 'bg-niya-gold/20 text-niya-gold border-niya-gold/40',
  analyst: 'bg-niya-up/20 text-niya-up border-niya-up/40',
  pro: 'bg-niya-accent/20 text-niya-accent border-niya-accent/40',
};

export default function WalletConnect() {
  const { tier, userAddress, walletAgeDays, setUserWallet } = useNiyaStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolveAndStore(address: string) {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetchWalletAge(address);
      setUserWallet(resp.data.address, resp.data.ageDays, resp.data.tier);
      setInput('');
    } catch (e: unknown) {
      console.warn('[Niya Tools] wallet-age fetch failed:', e);
      // Even if the backend is down we can still mark the wallet as
      // tracked and default the tier to scout — better than blocking.
      setUserWallet(address, 0, tierFromAgeDays(0));
      setInput('');
      if (e instanceof BackendError) {
        setError(`Tier lookup failed (${e.status})`);
      } else {
        setError('Backend offline \u2014 tier defaults to Scout');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!ADDRESS_REGEX.test(trimmed)) {
      setError('Invalid BSC address');
      return;
    }
    void resolveAndStore(trimmed.toLowerCase());
  }

  function handleClear() {
    setUserWallet(null, null, 'scout');
    setError(null);
    setInput('');
  }

  // --- render ---

  if (!userAddress) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex max-w-[200px] flex-col items-end gap-1"
      >
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste BSC address"
            spellCheck={false}
            disabled={busy}
            title="Read-only — Niya Tools never requests signatures"
            className="w-[140px] rounded-lg border border-niya-border bg-niya-bg px-2 py-1 font-mono text-[10px] text-niya-ink placeholder:text-niya-ink-2 focus:border-niya-gold/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="rounded-lg border border-niya-gold/40 bg-niya-gold/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-niya-gold transition-colors duration-200 hover:bg-niya-gold/20 disabled:opacity-40"
          >
            {busy ? '…' : 'Track'}
          </button>
        </div>
        {error && (
          <span className="rounded border border-niya-accent-2/30 bg-niya-accent-2/10 px-1.5 py-0.5 text-right text-[10px] leading-tight text-niya-accent-2">
            {error}
          </span>
        )}
      </form>
    );
  }

  const ageLabel =
    walletAgeDays != null
      ? walletAgeDays === 0
        ? 'new wallet'
        : `${walletAgeDays}d`
      : '—';

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={clsx(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider',
          TIER_STYLES[tier],
        )}
      >
        {tier.toUpperCase()}
      </span>
      <button
        type="button"
        onClick={handleClear}
        className="font-mono text-[9px] text-niya-ink-2 transition-colors duration-200 hover:text-niya-gold"
        title={`${userAddress} · ${ageLabel} on BSC · click to clear`}
      >
        {shortenAddress(userAddress)} · {ageLabel}
      </button>
    </div>
  );
}

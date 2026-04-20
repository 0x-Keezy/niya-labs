// Liquidity card. Combines the off-chain liquidity USD figure (from
// DexScreener, available via the parent App.tsx pair fetch) with the
// LP-lock signal computed by the microstructure orchestrator.
//
// LP lock detection limitation: as of Day 3, we infer locking from the
// top-token-holders list, not the LP-pair contract itself. This catches
// the common case where UniCrypt / PinkLock / a burn address holds the
// LP, but can miss exotic setups. Day 9 upgrades the detection.

import clsx from 'clsx';
import type { MicrostructureLp, PairSummary } from '../../lib/types';
import { formatUsd } from '../../lib/format';

interface LiquidityCardProps {
  lp: MicrostructureLp;
  pair: PairSummary | null;
}

interface BadgeStyle {
  text: string;
  classes: string;
}

function badgeFor(lp: MicrostructureLp): BadgeStyle {
  if (lp.locked && lp.lockProvider === 'burned') {
    return {
      text: '🔥 Burned',
      classes: 'bg-niya-up/15 text-niya-up border-niya-up/40',
    };
  }
  if (lp.locked) {
    const provider = lp.lockProvider ?? 'locker';
    return {
      text: `🔒 Locked · ${provider}`,
      classes: 'bg-niya-up/15 text-niya-up border-niya-up/40',
    };
  }
  return {
    text: '⚠ Unlocked',
    classes: 'bg-niya-accent-2/15 text-niya-accent-2 border-niya-accent-2/40',
  };
}

export default function LiquidityCard({ lp, pair }: LiquidityCardProps) {
  const badge = badgeFor(lp);

  return (
    <div className="rounded-xl border border-niya-border bg-niya-panel p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-niya-ink-2">
          Liquidity
        </div>
        <div className="font-mono text-xs text-niya-ink">
          {pair ? formatUsd(pair.liquidityUsd) : '—'}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={clsx(
            'inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-bold',
            badge.classes,
          )}
        >
          {badge.text}
        </span>
        {lp.locked && lp.lockedShare > 0 && (
          <span className="text-[11px] text-niya-ink-2">
            <span className="text-niya-ink">{lp.lockedShare.toFixed(1)}%</span> of
            tracked LP
          </span>
        )}
      </div>

      {!lp.locked && (
        <div className="mt-2 text-[11px] text-niya-ink-2">
          No locker or burn address detected among top holders.
        </div>
      )}
    </div>
  );
}

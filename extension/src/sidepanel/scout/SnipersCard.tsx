// Sniper detection card. Shows how many of the first 30 token transfers
// went to wallets that *still hold* the token, plus their combined share
// of supply right now.
//
// Day 7.7: tokens older than ~30 days skip sniper detection entirely at
// the backend, and in that case `snipers.skipped === true` with null
// numbers. We render a neutral "Mature token · N/A" state instead of
// showing a misleading zero.

import clsx from 'clsx';
import type { MicrostructureSnipers } from '../../lib/types';

interface SnipersCardProps {
  snipers: MicrostructureSnipers;
}

function shareColor(share: number): string {
  if (share > 30) return 'text-niya-accent-2';
  if (share > 15) return 'text-niya-gold';
  return 'text-niya-up';
}

export default function SnipersCard({ snipers }: SnipersCardProps) {
  const skipped =
    snipers.skipped || snipers.count == null || snipers.sharePct == null;

  return (
    <div className="rounded-xl border border-niya-border bg-niya-panel p-4">
      <div className="text-[10px] uppercase tracking-wider text-niya-ink-2">
        Snipers
      </div>

      {skipped ? (
        <>
          <div className="mt-2 font-display text-2xl font-bold text-niya-ink/60">
            —
          </div>
          <p className="mt-1 text-[11px] text-niya-ink-2">
            Mature token · sniper detection N/A
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-niya-ink-2">
            Sniper analysis only runs on tokens launched in the last 30 days,
            where the first transfers still signal intent.
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
                Wallets
              </div>
              <div className="font-display text-2xl font-bold text-niya-ink">
                {snipers.count}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
                Share of supply
              </div>
              <div
                className={clsx(
                  'font-display text-2xl font-bold',
                  shareColor(snipers.sharePct ?? 0),
                )}
              >
                {(snipers.sharePct ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-niya-ink-2">
            Wallets that bought in the first 30 token transfers and still hold
            today.
          </p>
        </>
      )}
    </div>
  );
}

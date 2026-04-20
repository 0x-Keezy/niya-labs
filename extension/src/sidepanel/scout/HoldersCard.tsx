// Holder concentration card. Shows top-1, raw top-10 and effective top-10
// shares, a table of the top 5 holders with category pills, and a deep
// link out to BscScan for the full list.
//
// Day 7.7: surfaces the category labels provided by the backend
// (PancakeSwap MasterChef, Binance Hot, Dead burn, etc.) so the user can
// tell apart non-circulating supply from real whales. The effective top-10
// (raw minus staking/exchange/burn/bridge/locker) is what the rug-risk
// score is computed from and is the primary number coloured by severity.

import clsx from 'clsx';
import type { HolderCategory, MicrostructureResult } from '../../lib/types';
import { shortenAddress } from '../../lib/format';

interface HoldersCardProps {
  result: MicrostructureResult;
}

function shareColor(share: number): string {
  if (share >= 20) return 'text-niya-accent-2';
  if (share >= 10) return 'text-niya-gold';
  return 'text-niya-ink';
}

interface CategoryPillStyle {
  icon: string;
  label: string;
  className: string;
}

const CATEGORY_PILLS: Record<HolderCategory, CategoryPillStyle> = {
  burn: {
    icon: '🔥',
    label: 'Burn',
    className: 'bg-niya-up/20 text-niya-up',
  },
  staking: {
    icon: '🥞',
    label: 'Staking',
    className: 'bg-niya-gold/20 text-niya-gold',
  },
  exchange: {
    icon: '🏦',
    label: 'CEX',
    className: 'bg-niya-experimental/30 text-niya-ink/90',
  },
  bridge: {
    icon: '🌉',
    label: 'Bridge',
    className: 'bg-niya-experimental/30 text-niya-ink/90',
  },
  locker: {
    icon: '🔒',
    label: 'Lock',
    className: 'bg-niya-up/20 text-niya-up',
  },
  dex: {
    icon: '🔁',
    label: 'DEX',
    className: 'bg-niya-panel-2 text-niya-ink/80',
  },
  launchpad: {
    icon: '🚀',
    label: 'Launchpad',
    className: 'bg-niya-gold/20 text-niya-gold',
  },
};

function formatTotalHolders(n: number): string {
  // For BUSD-scale tokens we get millions; Intl handles locale grouping.
  if (n >= 1000) return n.toLocaleString('en-US');
  return String(n);
}

export default function HoldersCard({ result }: HoldersCardProps) {
  const {
    totalHolders,
    topHolderShare,
    top10Share,
    top10EffectiveShare,
    topHolders,
    ca,
  } = result;
  const empty = topHolders.length === 0;

  // Only show "100+" when we clearly fell back to the /owners page length
  // (stats endpoint missing). Real Moralis stats for BUSD etc. give numbers
  // much larger than 100, which we show verbatim.
  const totalDisplay =
    totalHolders === 100 && topHolders.length === 100
      ? '100+'
      : formatTotalHolders(totalHolders);

  const top5 = topHolders.slice(0, 5);

  return (
    <div className="rounded-xl border border-niya-border bg-niya-panel p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-niya-ink-2">
          Holders
        </div>
        <div className="font-mono text-xs text-niya-ink">
          {empty ? '—' : totalDisplay}
        </div>
      </div>

      {empty ? (
        <div className="mt-3 text-xs text-niya-ink-2">
          Holder data unavailable.
        </div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-niya-panel-2/40 p-2">
              <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
                Top 1
              </div>
              <div
                className={clsx(
                  'font-display text-base font-bold',
                  shareColor(topHolderShare),
                )}
              >
                {topHolderShare.toFixed(1)}%
              </div>
            </div>
            <div
              className="rounded-lg bg-niya-panel-2/40 p-2"
              title="Raw top-10 share — includes staking, burn, and exchange custody."
            >
              <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
                Top 10
              </div>
              <div className="font-display text-base font-bold text-niya-ink/70">
                {top10Share.toFixed(1)}%
              </div>
            </div>
            <div
              className="rounded-lg bg-niya-panel-2/40 p-2"
              title="Effective top-10 share — excludes known staking, burn, exchange and bridge addresses. The rug-risk score uses this number."
            >
              <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
                Effective
              </div>
              <div
                className={clsx(
                  'font-display text-base font-bold',
                  shareColor(top10EffectiveShare),
                )}
              >
                {top10EffectiveShare.toFixed(1)}%
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {top5.map((h, i) => {
              const pill = h.category ? CATEGORY_PILLS[h.category] : null;
              return (
                <li
                  key={h.address}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-3 text-right text-niya-ink-2">
                      {i + 1}
                    </span>
                    <span
                      className="truncate font-mono text-niya-ink/80"
                      title={h.label ? `${h.label} · ${h.address}` : h.address}
                    >
                      {h.label ?? shortenAddress(h.address)}
                    </span>
                    {pill ? (
                      <span
                        className={clsx(
                          'shrink-0 rounded px-1 text-[8px] uppercase tracking-wider',
                          pill.className,
                        )}
                      >
                        {pill.icon} {pill.label}
                      </span>
                    ) : h.isContract ? (
                      <span className="shrink-0 rounded bg-niya-panel-2 px-1 text-[8px] uppercase tracking-wider text-niya-ink/70">
                        Contract
                      </span>
                    ) : null}
                  </span>
                  <span className={clsx('font-mono', shareColor(h.share))}>
                    {h.share.toFixed(2)}%
                  </span>
                </li>
              );
            })}
          </ul>

          <a
            href={`https://bscscan.com/token/${ca}#balances`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[11px] text-niya-ink-2 transition-colors duration-200 hover:text-niya-gold"
          >
            View on BscScan →
          </a>
        </>
      )}
    </div>
  );
}

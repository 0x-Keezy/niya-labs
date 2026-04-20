import type { MicrostructureResult } from '../../lib/types';
import LedgerRow from './LedgerRow';

interface MicrostructureLedgerProps {
  result: MicrostructureResult | null;
  /** Error from the microstructure fetch, if any. Rendered so users see
   *  e.g. "Backend unreachable" instead of the generic empty-state copy. */
  error?: { message: string; status?: number } | null;
  /** True while the fetch is in flight. Renders a small hint so the empty
   *  state isn't confused with a real "no data" result. */
  loading?: boolean;
  /** Optional callback for the refresh button. When omitted, the button is
   *  not rendered. Calling it should force the backend to bypass its cache. */
  onRefresh?: () => void;
}

function holderState(pct: number): 'crit' | 'warn' | 'good' {
  if (pct > 50) return 'crit';
  if (pct > 25) return 'warn';
  return 'good';
}

function topOneState(pct: number): 'crit' | 'warn' | 'good' {
  if (pct > 20) return 'crit';
  if (pct > 10) return 'warn';
  return 'good';
}

function lockedShareState(pct: number): 'crit' | 'warn' | 'good' {
  if (pct === 0) return 'crit';
  if (pct < 50) return 'warn';
  return 'good';
}

function sniperState(count: number): 'crit' | 'warn' | 'good' {
  if (count > 30) return 'crit';
  if (count > 15) return 'warn';
  return 'good';
}

function ageState(days: number): 'warn' | 'good' {
  return days < 7 ? 'warn' : 'good';
}

function formatHolderCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function MicrostructureLedger({
  result,
  error,
  loading,
  onRefresh,
}: MicrostructureLedgerProps) {
  return (
    <section style={{ padding: '22px 20px' }}>
      {/* Header */}
      <div className="niya-section-label mb-2 flex items-center justify-between">
        <span>MICROSTRUCTURE</span>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <span
            className="font-body italic text-niya-ink-3"
            style={{ fontSize: '10px' }}
          >
            on-chain, no spin
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title={loading ? 'Refreshing…' : 'Refresh (bypass cache)'}
              className="flex items-center justify-center rounded-full text-niya-ink-3 transition-colors hover:bg-niya-pink-soft hover:text-niya-accent disabled:opacity-40"
              style={{
                width: '22px',
                height: '22px',
                fontSize: '12px',
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: loading ? 'rotate(360deg)' : 'none',
                  transition: 'transform 0.8s linear',
                  animation: loading ? 'niya-spin 1.8s ease-in-out infinite' : 'none',
                }}
              >
                ⟳
              </span>
            </button>
          )}
        </div>
      </div>

      {loading && !result ? (
        <p
          className="mt-3 font-body text-niya-ink-mute"
          style={{ fontSize: '12px' }}
        >
          Loading on-chain data…
        </p>
      ) : error ? (
        <p
          className="mt-3 font-body"
          style={{ fontSize: '12px', color: '#ff617f' }}
        >
          {error.message}
          {error.status ? ` (HTTP ${error.status})` : ''}
        </p>
      ) : !result ? (
        <p
          className="mt-3 font-body text-niya-ink-mute"
          style={{ fontSize: '12px' }}
        >
          No microstructure data available yet.
        </p>
      ) : (
        <div>
          {/* 1. Top 10 holders (effective) */}
          <LedgerRow
            label="Top 10 holders"
            value={`${result.top10EffectiveShare.toFixed(1)}%`}
            qualifier="(effective)"
            state={holderState(result.top10EffectiveShare)}
          />

          {/* 2. Top-1 share */}
          <LedgerRow
            label="Top-1 share"
            value={`${result.topHolderShare.toFixed(1)}%`}
            state={topOneState(result.topHolderShare)}
          />

          {/* 3. Raw top 10 */}
          <LedgerRow
            label="Raw top 10"
            value={`${result.top10Share.toFixed(1)}%`}
            qualifier="(incl. staking/CEX)"
            state="neutral"
          />

          {/* 4. LP status */}
          <LedgerRow
            label="LP status"
            value={
              result.lp.locked
                ? `Locked${result.lp.lockProvider ? ` (${result.lp.lockProvider})` : ''}`
                : `Unlocked${result.lp.lockProvider ? ` (${result.lp.lockProvider})` : ''}`
            }
            state={result.lp.locked ? 'good' : 'crit'}
          />

          {/* 5. Locked % */}
          <LedgerRow
            label="Locked %"
            value={`${result.lp.lockedShare.toFixed(1)}%`}
            state={lockedShareState(result.lp.lockedShare)}
          />

          {/* 6. Snipers */}
          {result.snipers.skipped ? (
            <LedgerRow
              label="Snipers"
              value="N/A"
              qualifier="mature token"
              state="neutral"
            />
          ) : (
            <LedgerRow
              label="Snipers"
              value={String(result.snipers.count ?? 0)}
              qualifier={
                result.snipers.sharePct != null
                  ? `${result.snipers.sharePct.toFixed(1)}% of supply`
                  : undefined
              }
              state={sniperState(result.snipers.count ?? 0)}
            />
          )}

          {/* 7. Token age */}
          {result.tokenAgeDays == null ? (
            <LedgerRow
              label="Token age"
              value="Unknown"
              state="warn"
            />
          ) : (
            <LedgerRow
              label="Token age"
              value={`${result.tokenAgeDays}d`}
              state={ageState(result.tokenAgeDays)}
            />
          )}

          {/* 8. Total holders */}
          <LedgerRow
            label="Total holders"
            value={formatHolderCount(result.totalHolders)}
            state="neutral"
          />

          {/* 9–12. GMGN security data (when available) */}
          {result.security && (
            <>
              <LedgerRow
                label="Honeypot"
                value={result.security.isHoneypot ? 'Yes' : 'No'}
                state={result.security.isHoneypot ? 'crit' : 'good'}
              />
              {result.security.buyTax != null && (
                <LedgerRow
                  label="Buy tax"
                  value={`${result.security.buyTax.toFixed(1)}%`}
                  state={result.security.buyTax > 10 ? 'warn' : 'good'}
                />
              )}
              {result.security.sellTax != null && (
                <LedgerRow
                  label="Sell tax"
                  value={`${result.security.sellTax.toFixed(1)}%`}
                  state={
                    (result.security.sellTax ?? 0) > 20
                      ? 'crit'
                      : (result.security.sellTax ?? 0) > 5
                        ? 'warn'
                        : 'good'
                  }
                />
              )}
              <LedgerRow
                label="Contract source"
                value={result.security.isOpenSource ? 'Open' : 'Closed'}
                state={result.security.isOpenSource ? 'good' : 'warn'}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

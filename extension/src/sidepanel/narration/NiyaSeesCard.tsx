import { useEffect, useState, useRef } from 'react';
import type { MicrostructureResult } from '../../lib/types';
import { fetchNarration } from '../../lib/backend';
import { validateNarration, FALLBACK_NARRATION } from '../../lib/vocab';

interface NiyaSeesCardProps {
  ca: string | null;
  symbol?: string;
  microResult: MicrostructureResult | null;
  loading: boolean;
}

export default function NiyaSeesCard({
  ca,
  symbol = '',
  microResult,
  loading,
}: NiyaSeesCardProps) {
  const [narration, setNarration] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const prevCaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ca || !microResult) {
      setNarration(null);
      return;
    }
    // Don't re-fetch if the CA hasn't changed
    if (ca === prevCaRef.current && narration) return;
    prevCaRef.current = ca;

    const controller = new AbortController();
    setFetching(true);

    fetchNarration(
      {
        ca,
        symbol,
        data: {
          rugRiskScore: microResult.rugRiskScore,
          riskHeadline: microResult.riskHeadline,
          top10EffectiveShare: microResult.top10EffectiveShare,
          topHolderShare: microResult.topHolderShare,
          lpLocked: microResult.lp.locked,
          lpLockedShare: microResult.lp.lockedShare,
          lockProvider: microResult.lp.lockProvider,
          sniperCount: microResult.snipers.count,
          sniperSharePct: microResult.snipers.sharePct,
          tokenAgeDays: microResult.tokenAgeDays,
          totalHolders: microResult.totalHolders,
        },
      },
      controller.signal,
    )
      .then((resp) => {
        const clean = validateNarration(resp.narration);
        setNarration(clean);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[Niya Tools] narration fetch failed:', err);
        setNarration(FALLBACK_NARRATION);
      })
      .finally(() => setFetching(false));

    return () => controller.abort();
  }, [ca, microResult]);

  const showShimmer = loading || fetching;

  return (
    <section
      className="bg-niya-panel-3"
      style={{ padding: '22px 20px' }}
    >
      {/* Header */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        <span className="text-niya-accent" style={{ fontSize: '14px' }}>
          &#10022;
        </span>
        <span
          className="font-body uppercase text-niya-ink"
          style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.22em',
          }}
        >
          WHAT NIYA SEES
        </span>
      </div>

      {/* Body */}
      <div className="mt-3">
        {showShimmer ? (
          <div className="flex flex-col gap-2">
            <div className="h-3 w-full niya-shimmer rounded" />
            <div className="h-3 w-3/4 niya-shimmer rounded" style={{ animationDelay: '150ms' }} />
            <div className="h-3 w-1/2 niya-shimmer rounded" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <p
            className="font-display text-niya-ink-2 animate-fade-in"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {narration ?? (
              <span className="italic text-niya-ink-mute">
                Analyzing on-chain data for this token&hellip;
              </span>
            )}
          </p>
        )}
      </div>

      {/* Source footer */}
      <p
        className="mt-3 font-mono text-niya-ink-mute"
        style={{ fontSize: '9px' }}
      >
        {narration && !showShimmer
          ? `grok-3-mini \u00b7 ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC`
          : 'microstructure \u00b7 on-chain data'}
      </p>
    </section>
  );
}

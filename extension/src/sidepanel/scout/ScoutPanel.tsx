// Scout Mode orchestrator. Owns the microstructure fetch lifecycle so
// App.tsx stays magro and the panel can be retried/error-bounded
// independently from the chart + pair fetches above it.
//
// State machine:
//   idle → loading → success | error
// A `retryToken` counter increments when the user clicks Retry, which
// re-runs the effect via the dependency array.

import { useEffect, useState } from 'react';
import { fetchMicrostructure, BackendError } from '../../lib/backend';
import type {
  MicrostructureResult,
  PairSummary,
} from '../../lib/types';
import RugRiskCard from './RugRiskCard';
import HoldersCard from './HoldersCard';
import LiquidityCard from './LiquidityCard';
import SnipersCard from './SnipersCard';

interface ScoutPanelProps {
  ca: string | null;
  pair: PairSummary | null;
}

interface ScoutError {
  message: string;
  status?: number;
}

function describeError(err: unknown): ScoutError {
  if (err instanceof BackendError) {
    if (err.status === 503) {
      return {
        status: 503,
        message: 'Backend not configured. Set BSCSCAN_API_KEY and MORALIS_API_KEY in .env.local.',
      };
    }
    if (err.status === 502) {
      return { status: 502, message: 'Microstructure compute failed. Try again.' };
    }
    if (err.status === 400) {
      return { status: 400, message: 'Invalid contract address.' };
    }
    return { status: err.status, message: err.message };
  }
  return {
    message: 'Backend unreachable. Check your connection and try again.',
  };
}

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSec);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SkeletonStack() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl border border-niya-border bg-niya-panel"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

interface ErrorCardProps {
  error: ScoutError;
  onRetry: () => void;
}

function ErrorCard({ error, onRetry }: ErrorCardProps) {
  return (
    <div className="rounded-xl border border-niya-accent-2/30 bg-niya-panel p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-niya-accent-2">
            Scout Mode unavailable
          </div>
          <p className="mt-1 text-xs text-niya-ink/90">{error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-niya-border bg-niya-panel-2/40 px-3 py-1 text-[11px] font-bold text-niya-ink transition-colors duration-200 hover:border-niya-gold hover:text-niya-gold"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScoutPanel({ ca, pair }: ScoutPanelProps) {
  const [result, setResult] = useState<MicrostructureResult | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ScoutError | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!ca) {
      // Pair hasn't resolved yet (or failed). Stay quiet — App.tsx already
      // surfaces pair-fetch errors above us, so we don't need to duplicate.
      setLoading(false);
      setError(null);
      setResult(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);

    fetchMicrostructure(ca, controller.signal)
      .then((resp) => {
        if (controller.signal.aborted) return;
        setResult(resp.data);
        setCached(resp.cached);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        console.warn('[Niya Tools] microstructure fetch failed:', err);
        setError(describeError(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [ca, retryToken]);

  if (!ca) {
    return (
      <div className="rounded-xl border border-niya-border bg-niya-panel p-3 text-[11px] text-niya-ink-2">
        Waiting for token data…
      </div>
    );
  }
  if (loading) return <SkeletonStack />;
  if (error)
    return <ErrorCard error={error} onRetry={() => setRetryToken((n) => n + 1)} />;
  if (!result) return null;

  return (
    <div className="space-y-3">
      <RugRiskCard result={result} />
      <HoldersCard result={result} />
      <LiquidityCard lp={result.lp} pair={pair} />
      <SnipersCard snipers={result.snipers} />
      <div className="text-center text-[9px] uppercase tracking-wider text-niya-ink-2">
        Computed {timeAgo(result.computedAt)} · {cached ? 'cached' : 'fresh'}
      </div>
    </div>
  );
}

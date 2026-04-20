// Shared hook for fetching microstructure data.
// Extracted from ScoutPanel.tsx so VerdictCard, FindingsSection, and
// MicrostructureLedger can all consume the same data without prop drilling.

import { useEffect, useState } from 'react';
import { fetchMicrostructure, BackendError } from '../../lib/backend';
import type { MicrostructureResult } from '../../lib/types';

export interface MicroError {
  message: string;
  status?: number;
}

function describeError(err: unknown): MicroError {
  if (err instanceof BackendError) {
    if (err.status === 503)
      return { status: 503, message: 'Backend not configured. Set MORALIS_API_KEY in .env.local.' };
    if (err.status === 502)
      return { status: 502, message: 'Microstructure compute failed. Try again.' };
    if (err.status === 400)
      return { status: 400, message: 'Invalid contract address.' };
    return { status: err.status, message: err.message };
  }
  return { message: 'Backend unreachable. Is the dev server running on localhost:5000?' };
}

export interface UseMicrostructureReturn {
  result: MicrostructureResult | null;
  cached: boolean;
  loading: boolean;
  error: MicroError | null;
  /** Refetch the same CA. Forces a cache bypass on the backend so the
   *  refresh button always returns live data, not a <10min stale row. */
  retry: () => void;
}

export function useMicrostructure(ca: string | null, source?: string): UseMicrostructureReturn {
  const [result, setResult] = useState<MicrostructureResult | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MicroError | null>(null);
  // Refetch trigger — the `fresh` flag tells the backend to bypass its DB
  // cache. Auto CA-changes run with fresh=false (cache hit is fine); only
  // the user-initiated retry() sets fresh=true.
  const [refetch, setRefetch] = useState<{ token: number; fresh: boolean }>(
    { token: 0, fresh: false },
  );

  useEffect(() => {
    if (!ca) {
      setLoading(false);
      setError(null);
      setResult(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);

    fetchMicrostructure(ca, controller.signal, source, refetch.fresh)
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
  }, [ca, refetch]);

  return {
    result,
    cached,
    loading,
    error,
    retry: () => setRefetch((r) => ({ token: r.token + 1, fresh: true })),
  };
}

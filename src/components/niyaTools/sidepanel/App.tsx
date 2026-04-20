import { useEffect, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useNiyaStore, hydrateWalletFromStorage } from './store';
import type {
  Candle,
  DetectedAddress,
  HostSite,
  PairSummary,
  Timeframe,
} from '../lib/types';
import {
  fetchPairOrToken,
  pickBestBscPair,
  TokenNotListedError,
} from '../lib/dexscreener';
import { fetchOhlcv } from '../lib/geckoterminal';
import { useMicrostructure } from './hooks/useMicrostructure';

// Layout components (Día 9 — pixel-perfect mockup)
import TopBar from './topbar/TopBar';
import HeadlineCard from './headline/HeadlineCard';
import VerdictCard from './verdict/VerdictCard';
import FindingsSection from './findings/FindingsSection';
import ChartSection from './chart/ChartSection';
import AnalystPanel from './analyst/AnalystPanel';
import NiyaSeesCard from './narration/NiyaSeesCard';
import MicrostructureLedger from './ledger/MicrostructureLedger';
import AlertsSection from './alerts/AlertsSection';
import AskNiyaSection from './ask/AskNiyaSection';

import SignatureFooter from './footer/SignatureFooter';

interface AnalystChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

function Placeholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <img
        src="/niya-logo.png"
        alt="Niya"
        className="h-16 w-16 rounded-2xl"
      />
      <h2 className="font-display text-lg font-bold text-niya-ink">
        Paste a BNB Chain token to start
      </h2>
      <p className="max-w-xs text-xs text-niya-ink-3">
        Drop any ERC-20 contract address (starts with{' '}
        <span className="font-mono">0x</span>, 40 hex chars) above and Niya
        will pull microstructure data in a few seconds.
      </p>
    </div>
  );
}

interface AppProps {
  /** Contract address coming from the URL ?ca=… or the input above. */
  ca?: string | null;
  /** Optional source hint — lets the backend apply source-specific logic
   *  (e.g. Four.meme bonding-curve LP override). */
  source?: HostSite;
}

export default function App({ ca: externalCa = null, source: externalSource }: AppProps) {
  const { currentCa, tier, setCurrentCa } = useNiyaStore();
  const [pair, setPair] = useState<PairSummary | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [chartRefs, setChartRefs] = useState<AnalystChartRefs>({
    chart: null,
    candleSeries: null,
  });

  // Microstructure data — shared across VerdictCard, FindingsSection, Ledger
  const tokenCa = pair?.baseToken.address ?? null;
  const micro = useMicrostructure(tokenCa, currentCa?.source);

  // Restore connected wallet from localStorage on first mount.
  useEffect(() => {
    void hydrateWalletFromStorage();
  }, []);

  // Web port: the CA comes from the parent page (URL query param or a
  // manual paste input above). When it changes, rebuild the detected
  // address record. No chrome.runtime messaging.
  useEffect(() => {
    if (!externalCa || !/^0x[a-fA-F0-9]{40}$/.test(externalCa)) {
      setCurrentCa(null);
      return;
    }
    const detected: DetectedAddress = {
      ca: externalCa.toLowerCase(),
      source: externalSource ?? 'unknown',
      detectedAt: Date.now(),
    };
    setCurrentCa(detected);
  }, [externalCa, externalSource, setCurrentCa]);

  // Fetch pair metadata when CA changes.
  useEffect(() => {
    if (!currentCa) {
      setPair(null);
      setCandles([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPair(null);
    setCandles([]);

    console.log('[Niya Tools] resolving CA:', currentCa.ca);
    fetchPairOrToken(currentCa.ca, controller.signal)
      .then((pairs) => {
        if (controller.signal.aborted) return;
        const best = pickBestBscPair(pairs);
        if (!best) {
          setError('No BSC pair found for this token');
          setLoading(false);
          return;
        }
        console.log(
          '[Niya Tools] resolved pair:',
          best.pairAddress,
          '→ token',
          best.baseToken.address,
          best.baseToken.symbol,
        );
        setPair(best);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[Niya Tools] fetchPairOrToken failed:', err);
        if (err instanceof TokenNotListedError) {
          setError('Token not listed on DexScreener');
        } else {
          setError('Failed to load pair data');
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [currentCa, reloadToken]);

  // Fetch OHLCV when pair or timeframe changes.
  useEffect(() => {
    if (!pair) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchOhlcv(pair.pairAddress, timeframe, 200, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCandles(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[Niya Tools] fetchOhlcv failed:', err);
        setError('Failed to load chart data');
        setLoading(false);
      });

    return () => controller.abort();
  }, [pair, timeframe, reloadToken]);

  // Auto-refresh OHLCV every 30s, gated by visibility.
  useEffect(() => {
    if (!pair) return;
    let cancelled = false;

    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const data = await fetchOhlcv(pair.pairAddress, timeframe, 200);
        if (cancelled) return;
        setCandles(data);
      } catch (err) {
        console.warn('[Niya Tools] auto-refresh failed:', err);
      }
    };

    const id = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pair, timeframe]);

  const handleRetry = () => setReloadToken((n) => n + 1);

  // Analyst Mode gates
  const pairAgeHours =
    candles.length > 0
      ? (Date.now() / 1000 - candles[0].time) / 3600
      : 0;
  const analystEligible =
    tier !== 'scout' &&
    !!pair &&
    pair.liquidityUsd >= 50_000 &&
    pairAgeHours >= 48;

  return (
    <div className="niya-panel-frame flex h-full flex-col">
      <div className="niya-panel-inner flex h-full flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          {!currentCa ? (
            <Placeholder />
          ) : (
            <>
              {/* Headline */}
              {pair && (
                <>
                  <HeadlineCard pair={pair} ca={currentCa.ca} />
                  <div className="niya-section-divider" />
                </>
              )}

              {/* Verdict */}
              {micro.result && (
                <>
                  <VerdictCard result={micro.result} />
                  <div className="niya-section-divider" />
                </>
              )}
              {micro.loading && (
                <>
                  <div className="p-5">
                    <div className="h-44 niya-shimmer rounded-2xl" />
                  </div>
                  <div className="niya-section-divider" />
                </>
              )}

              {/* Findings */}
              {micro.result && (
                <>
                  <FindingsSection result={micro.result} tier={tier} />
                  <div className="niya-section-divider" />
                </>
              )}

              {/* Chart */}
              <ChartSection
                candles={candles}
                loading={loading}
                error={error}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                onRetry={handleRetry}
                onChartReady={setChartRefs}
                analystEligible={analystEligible}
                chartRefs={chartRefs}
                tier={tier}
                pairAgeHours={pairAgeHours}
              />
              <div className="niya-section-divider" />

              {/* Analyst overlays (mounted imperatively on chart) */}
              {analystEligible && candles.length > 0 && (
                <AnalystPanel candles={candles} chartRefs={chartRefs} />
              )}

              {/* What Niya Sees — Analyst+ */}
              {tier !== 'scout' && (
                <>
                  <NiyaSeesCard
                    ca={tokenCa}
                    symbol={pair?.baseToken.symbol ?? ''}
                    microResult={micro.result}
                    loading={micro.loading}
                  />
                  <div className="niya-section-divider" />
                </>
              )}

              {/* Microstructure Ledger */}
              <MicrostructureLedger
                result={micro.result}
                error={micro.error}
                loading={micro.loading}
                onRefresh={micro.retry}
              />
              <div className="niya-section-divider" />

              {/* Alerts */}
              <AlertsSection microResult={micro.result} pair={pair} />
              <div className="niya-section-divider" />

              {/* Ask Niya */}
              <AskNiyaSection ca={tokenCa} microResult={micro.result} pair={pair} />
            </>
          )}
        </main>

        <SignatureFooter />
      </div>
    </div>
  );
}

import { useCallback, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Candle, Tier, Timeframe } from '../../lib/types';
import Chart from '../chart/Chart';
import TimeframeSelector from '../chart/TimeframeSelector';
import StrategiesOverlay, { type StrategiesAnalysis } from './StrategiesOverlay';

interface AnalystChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

interface ChartSectionProps {
  candles: Candle[];
  loading: boolean;
  error: string | null;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  onRetry?: () => void;
  onChartReady?: (refs: AnalystChartRefs) => void;
  analystEligible: boolean;
  chartRefs: AnalystChartRefs;
  tier: Tier;
  pairAgeHours: number;
}

export default function ChartSection({
  candles,
  loading,
  error,
  timeframe,
  onTimeframeChange,
  onRetry,
  onChartReady,
  analystEligible,
  chartRefs,
  tier,
  pairAgeHours,
}: ChartSectionProps) {
  const [strategiesEnabled, setStrategiesEnabled] = useState(false);
  const [analysis, setAnalysis] = useState<StrategiesAnalysis | null>(null);

  const handleAnalysis = useCallback((a: StrategiesAnalysis) => {
    setAnalysis(a);
  }, []);

  return (
    <section style={{ padding: '22px 20px 14px' }}>
      {/* Header */}
      <div className="niya-section-label mb-3 flex items-center justify-between">
        <span>PRICE CHART</span>
        <TimeframeSelector
          value={timeframe}
          onChange={onTimeframeChange}
          disabled={loading}
        />
      </div>

      {/* Chart */}
      <Chart
        candles={candles}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onChartReady={onChartReady}
      />

      {/* Caption */}
      <p
        className="mt-2 font-body text-niya-ink-3"
        style={{ fontSize: '11px' }}
      >
        GeckoTerminal &middot; 200 candles &middot;{' '}
        <em>auto-refresh 30s</em>
      </p>

      {/* Experimental strategies toggle — Analyst+ only, not Scout */}
      {analystEligible && tier !== 'scout' && (
        <div
          className="mt-3 flex items-center justify-between rounded-[10px] border border-dashed border-niya-border-2 bg-niya-panel-2"
          style={{ padding: '8px 12px', gap: '12px' }}
        >
          {/* Left side */}
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-white"
              style={{
                fontSize: '8px',
                background: '#856292',
                borderRadius: '3px',
                padding: '0.5px 6px',
              }}
            >
              BETA
            </span>
            <span
              className="font-body text-niya-ink"
              style={{ fontSize: '11px', fontWeight: 700 }}
            >
              Niya Strategies
            </span>
            <span
              className="font-body italic text-niya-ink-3"
              style={{ fontSize: '10px' }}
            >
              experimental overlays
            </span>
          </div>

          {/* Right side — toggle */}
          <button
            type="button"
            className={`niya-exp-switch${strategiesEnabled ? ' on' : ''}`}
            onClick={() => setStrategiesEnabled((prev) => !prev)}
            aria-pressed={strategiesEnabled}
            aria-label="Toggle experimental strategies"
          />
        </div>
      )}

      {/* Interest score badge — shown when strategies are active */}
      {strategiesEnabled && analysis && analysis.interest.score > 0 && (
        <div
          className="mt-2 flex items-center gap-2"
          style={{ padding: '0 4px' }}
        >
          <span
            className="font-mono"
            style={{ fontSize: '11px', color: '#856292', fontWeight: 700 }}
          >
            Interest: {analysis.interest.score}/89
          </span>
          <span
            className="font-body text-niya-ink-3"
            style={{ fontSize: '10px' }}
          >
            {analysis.interest.label}
          </span>
        </div>
      )}

      {/* Strategies overlays — mounted on chart when toggle is ON */}
      {strategiesEnabled && analystEligible && (
        <StrategiesOverlay
          candles={candles}
          chartRefs={chartRefs}
          enabled={strategiesEnabled}
          pairAgeHours={pairAgeHours}
          onAnalysis={handleAnalysis}
        />
      )}
    </section>
  );
}

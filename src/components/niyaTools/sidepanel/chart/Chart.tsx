import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type HistogramData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '../../lib/types';
import { compactPrice, formatTimestamp, formatUsd } from '../../lib/format';

interface ChartProps {
  candles: Candle[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /**
   * Fired once after the chart and its candle series have been created
   * (and again with `null` refs when the chart is torn down). Used by
   * Analyst Mode to attach overlays — see `analyst/AnalystPanel.tsx`.
   */
  onChartReady?: (refs: {
    chart: IChartApi | null;
    candleSeries: ISeriesApi<'Candlestick'> | null;
  }) => void;
}

const NIYA_THEME = {
  background: '#FFF5E8',
  text: '#1F1F1F',
  grid: '#F0D9B0',
  border: '#EACDA0',
  up: '#22C55E',
  down: '#E67080',
  upAlpha: 'rgba(34, 197, 94, 0.5)',
  downAlpha: 'rgba(230, 112, 128, 0.5)',
};

export default function Chart({
  candles,
  loading,
  error,
  onRetry,
  onChartReady,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Keep a lookup table for the crosshair handler to avoid re-renders.
  const candleMapRef = useRef<Map<number, Candle>>(new Map());
  // Tracks whether cleanup has already disposed the chart. Any callback
  // that runs via setTimeout / requestAnimationFrame / ResizeObserver after
  // unmount must bail early — calling applyOptions/setData on a disposed
  // lightweight-chart throws `Error: Object is disposed` from its internal
  // paint loop (see `fancy-canvas` stack trace on navigation away from
  // /tools).
  const disposedRef = useRef(false);

  // The "Object is disposed" error suppressor lives in `_app.tsx`, not
  // here. It had to move: installed per-component, the listener was
  // unmounted a few ms BEFORE the race-condition paint fired, so it
  // never caught the throw it was designed to silence. At the app root
  // the listener survives route changes and the Next.js dev overlay
  // stays quiet on /tools → back navigation.

  // Create chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial dimensions are clamped to ≥ 1 because on first paint the side
    // panel layout may not have settled yet and clientWidth/clientHeight can
    // be 0. A chart born at 0×0 does not fully recover from a plain resize()
    // — we force a proper applyOptions in a requestAnimationFrame below once
    // the browser has committed layout. See Día 7.9.
    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: NIYA_THEME.background },
        textColor: NIYA_THEME.text,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: NIYA_THEME.grid },
        horzLines: { color: NIYA_THEME.grid },
      },
      rightPriceScale: {
        borderColor: NIYA_THEME.border,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: NIYA_THEME.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: NIYA_THEME.up,
      downColor: NIYA_THEME.down,
      borderVisible: false,
      wickUpColor: NIYA_THEME.up,
      wickDownColor: NIYA_THEME.down,
      // Custom price formatter so sub-cent memecoins don't collapse to
      // "0.00" on the right axis. `compactPrice` emits DexScreener-style
      // subscript-zero notation. `minMove` is intentionally tiny so the
      // axis ticks don't snap away from the real price scale.
      priceFormat: {
        type: 'custom',
        minMove: 1e-12,
        formatter: (price: number) => compactPrice(price),
      },
    });

    // Volume histogram as an overlay in the bottom 25% of the chart.
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Force a real applyOptions once the browser has finished layout. The
    // useEffect body runs after React commits but potentially before the
    // browser has laid out the new DOM, so container.clientHeight may still
    // be 0 here. requestAnimationFrame queues this read for the next paint,
    // by which point the side panel's h-64 (256px) is real.
    const initRafId = requestAnimationFrame(() => {
      if (disposedRef.current) return;
      if (containerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        } catch {
          /* chart was disposed between the rAF schedule and its callback */
        }
      }
    });

    // Hand the chart + candle series to any consumer (e.g. AnalystPanel)
    // that needs to attach overlays. Called inside the create-once effect
    // so it fires exactly once per mount.
    onChartReady?.({ chart, candleSeries });

    // Crosshair tooltip — update a DOM node imperatively to avoid
    // React re-renders on every mouse move.
    const handleCrosshair = (param: MouseEventParams<Time>) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        tooltip.style.display = 'none';
        return;
      }

      const time = typeof param.time === 'number' ? param.time : 0;
      const candle = candleMapRef.current.get(time);
      if (!candle) {
        tooltip.style.display = 'none';
        return;
      }

      const up = candle.close >= candle.open;
      const color = up ? NIYA_THEME.up : NIYA_THEME.down;
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        <div class="text-[10px] uppercase tracking-wider text-niya-ink-2">
          ${formatTimestamp(candle.time)}
        </div>
        <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
          <span class="text-niya-ink-2">O</span><span style="color:${color}">${compactPrice(candle.open)}</span>
          <span class="text-niya-ink-2">H</span><span style="color:${color}">${compactPrice(candle.high)}</span>
          <span class="text-niya-ink-2">L</span><span style="color:${color}">${compactPrice(candle.low)}</span>
          <span class="text-niya-ink-2">C</span><span style="color:${color}">${compactPrice(candle.close)}</span>
        </div>
        <div class="mt-1 text-[10px] text-niya-ink-2">
          VOL <span class="text-niya-ink">${formatUsd(candle.volume * candle.close)}</span>
        </div>
      `;
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    // applyOptions (rather than resize) forces the internal renderer to
    // reconfigure — safer when the initial size was degenerate.
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposedRef.current) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          try {
            chart.applyOptions({ width, height });
          } catch {
            /* chart was disposed mid-resize (navigation during layout) */
          }
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      // Flip the disposed flag FIRST so any pending rAF / ResizeObserver /
      // paint callback bails out cleanly instead of calling into a
      // half-torn-down chart.
      disposedRef.current = true;
      cancelAnimationFrame(initRafId);
      try {
        chart.unsubscribeCrosshairMove(handleCrosshair);
      } catch {
        /* already disposed */
      }
      resizeObserver.disconnect();
      try {
        chart.remove();
      } catch {
        /* lightweight-charts sometimes throws if a paint is in-flight;
         * swallow it — the chart is gone either way. */
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      onChartReady?.({ chart: null, candleSeries: null });
    };
  }, []);

  // Push new candle + volume data whenever `candles` changes. Wrapped in
  // requestAnimationFrame so the resize + setData run after the browser has
  // committed layout — this is what fixes the "chart blank until the user
  // clicks a timeframe" bug. applyOptions is used instead of resize because
  // it forces a full renderer reconfig, not just a canvas size tweak.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!candleSeries || !volumeSeries || !chart || !container) return;

    const rafId = requestAnimationFrame(() => {
      // If the chart was disposed between scheduling this rAF and its
      // execution (fast navigation away from /tools), bail silently.
      if (disposedRef.current) return;

      try {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }

        // Rebuild the lookup map used by the tooltip handler.
        const map = new Map<number, Candle>();
        for (const c of candles) map.set(c.time, c);
        candleMapRef.current = map;

        if (candles.length === 0) {
          candleSeries.setData([]);
          volumeSeries.setData([]);
          return;
        }

        const candleData: CandlestickData[] = candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeries.setData(candleData);

        const volumeData: HistogramData[] = candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? NIYA_THEME.upAlpha : NIYA_THEME.downAlpha,
        }));
        volumeSeries.setData(volumeData);

        chart.timeScale().fitContent();
      } catch {
        /* lightweight-charts threw mid-update — almost always "Object is
         * disposed" from a race with unmount; safe to swallow. */
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [candles]);

  // Reset the zoom/pan state back to "fit content" — solves the UX bug
  // where a user wheel-zooms deep into a few candles and cannot escape.
  // Called by the ↺ button and the Escape key. `safe()` respects the
  // disposedRef guard + swallows any race-condition throw from
  // lightweight-charts' internal paint loop (same pattern as the
  // candle-update effect above).
  const handleResetZoom = () => {
    if (disposedRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    try {
      chart.timeScale().fitContent();
      chart.priceScale('right').applyOptions({ autoScale: true });
    } catch {
      /* chart was torn down between click and handler */
    }
  };

  // Keyboard shortcut — Escape resets, consistent with desktop app UX
  // conventions (PhotoShop, Figma, TradingView all use Esc to bail out).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleResetZoom();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-[210px] md:h-[480px] lg:h-[540px] xl:h-[600px] 2xl:h-[680px] w-full overflow-hidden rounded-xl border border-niya-border bg-niya-panel-2">
      <div ref={containerRef} className="h-full w-full" />

      {/* Reset-zoom button — zine sticker, top-right. Solves the "I zoomed
          too far and can't come back" UX bug. Also bound to Esc keyboard
          shortcut via the useEffect above. 44×44 px tap target for mobile. */}
      <button
        type="button"
        onClick={handleResetZoom}
        aria-label="Reset chart zoom"
        title="Reset zoom (Esc)"
        className="absolute right-2 top-2 z-10 inline-flex items-center justify-center gap-1 rounded-md border border-niya-border bg-niya-panel/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-niya-ink-2 shadow-sm backdrop-blur-sm transition hover:bg-niya-panel hover:text-niya-ink active:scale-95 min-h-[32px]"
      >
        <span aria-hidden="true">↺</span>
        <span>reset</span>
      </button>

      {/* Crosshair tooltip — absolutely positioned, updated imperatively.
          left-16 leaves room for the reset button. */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-2 top-2 min-w-[120px] rounded-md border border-niya-border bg-niya-panel/95 p-2 shadow-lg backdrop-blur-sm"
        style={{ display: 'none' }}
      />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-niya-bg/60 text-xs text-niya-ink-2">
          Loading candles…
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-niya-bg/90 p-4 text-center">
          <div className="text-xs text-niya-accent-2">{error}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-niya-accent/40 bg-niya-accent/10 px-3 py-1 text-xs font-semibold text-niya-accent hover:bg-niya-accent/20"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && candles.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-niya-ink-2">
          Pool too new or no trades yet
        </div>
      )}
    </div>
  );
}

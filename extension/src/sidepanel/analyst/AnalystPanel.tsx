// Analyst Mode panel (Day 6).
//
// Computes Floor/Ceiling, trendlines and deep retrace zones from the
// current candle window, then mounts them as overlays on the existing
// `Chart` instance via the refs handed up by `onChartReady`. Also renders a
// compact descriptive table below the chart so users get the levels in
// readable form even if the chart is too cramped to label.
//
// Cleanup is critical here: lightweight-charts holds onto every priceLine
// and lineSeries we create, and the chart is a singleton mounted in
// `Chart.tsx`. Each time the candles change we tear down the previous batch
// of overlays *before* attaching new ones. The cleanup is wrapped in
// try/catch because if the parent has already torn down the chart (during a
// fast token switch) the references are stale and any call would throw.

import { useEffect, useMemo, useRef } from 'react';
import {
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '../../lib/types';
import { compactPrice } from '../../lib/format';
import {
  detectFloorCeiling,
  detectTrendlines,
  computeEntryZones,
  type SRLevel,
  type Trendline,
  type EntryZone,
} from '../../lib/ta';

interface AnalystChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

interface AnalystPanelProps {
  candles: Candle[];
  chartRefs: AnalystChartRefs;
}

const COLORS = {
  floor: '#22C55E',
  ceiling: '#E67080',
  trendline: '#B8812A',
  deepRetrace: '#856292',
};

interface OverlaySet {
  priceLines: Array<{ series: ISeriesApi<'Candlestick'>; line: IPriceLine }>;
  lineSeries: ISeriesApi<'Line'>[];
}

export default function AnalystPanel({ candles, chartRefs }: AnalystPanelProps) {
  const overlayRef = useRef<OverlaySet>({ priceLines: [], lineSeries: [] });

  const analysis = useMemo(() => {
    const sr = detectFloorCeiling(candles);
    const trendlines = detectTrendlines(candles);
    const entryZones = computeEntryZones(candles);
    return { ...sr, trendlines, entryZones };
  }, [candles]);

  useEffect(() => {
    const { chart, candleSeries } = chartRefs;
    if (!chart || !candleSeries) return;

    // Tear down anything from a previous render before drawing new overlays.
    teardown(overlayRef.current, chart);
    overlayRef.current = { priceLines: [], lineSeries: [] };

    const set: OverlaySet = { priceLines: [], lineSeries: [] };

    for (const lvl of analysis.floors) {
      const line = candleSeries.createPriceLine({
        price: lvl.price,
        color: COLORS.floor,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: `Floor ${compactPrice(lvl.price)}`,
      });
      set.priceLines.push({ series: candleSeries, line });
    }

    for (const lvl of analysis.ceilings) {
      const line = candleSeries.createPriceLine({
        price: lvl.price,
        color: COLORS.ceiling,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: `Ceiling ${compactPrice(lvl.price)}`,
      });
      set.priceLines.push({ series: candleSeries, line });
    }

    for (const tl of analysis.trendlines) {
      const series = chart.addLineSeries({
        color: COLORS.trendline,
        lineStyle: LineStyle.Solid,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([
        { time: tl.start.time as UTCTimestamp, value: tl.start.price },
        { time: tl.end.time as UTCTimestamp, value: tl.end.price },
      ]);
      set.lineSeries.push(series);
    }

    for (const zone of analysis.entryZones) {
      const line = candleSeries.createPriceLine({
        price: zone.level,
        color: COLORS.deepRetrace,
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: false,
        title: '',
      });
      set.priceLines.push({ series: candleSeries, line });
    }

    overlayRef.current = set;

    return () => {
      teardown(overlayRef.current, chart);
      overlayRef.current = { priceLines: [], lineSeries: [] };
    };
  }, [analysis, chartRefs]);

  return (
    <div className="rounded-xl border border-niya-border bg-niya-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-niya-ink-2">
          Analyst overlays
        </div>
        <div className="text-[9px] uppercase tracking-wider text-niya-gold">
          ✦ Tier
        </div>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <Row label="Ceilings" empty="None nearby">
          {analysis.ceilings.length > 0 &&
            analysis.ceilings.map((l) => (
              <PriceChip key={`c${l.price}`} level={l} color={COLORS.ceiling} />
            ))}
        </Row>
        <Row label="Floors" empty="None nearby">
          {analysis.floors.length > 0 &&
            analysis.floors.map((l) => (
              <PriceChip key={`f${l.price}`} level={l} color={COLORS.floor} />
            ))}
        </Row>
        <Row label="Deep retrace" empty="No swing yet">
          {analysis.entryZones.length > 0 &&
            analysis.entryZones.map((z) => <FibChip key={z.label} zone={z} />)}
        </Row>
        {analysis.trendlines.length > 0 && (
          <Row label="Trendlines">
            {analysis.trendlines.map((t, i) => (
              <TrendlineChip key={i} tl={t} />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

function teardown(set: OverlaySet, chart: IChartApi) {
  for (const { series, line } of set.priceLines) {
    try {
      series.removePriceLine(line);
    } catch {
      /* chart already disposed */
    }
  }
  for (const ls of set.lineSeries) {
    try {
      chart.removeSeries(ls);
    } catch {
      /* chart already disposed */
    }
  }
}

function Row({
  label,
  empty,
  children,
}: {
  label: string;
  empty?: string;
  children: React.ReactNode;
}) {
  // React renders `false` / `null` as nothing, so we detect emptiness by
  // counting children at the array level. Cheap and avoids extra state.
  const childArray = Array.isArray(children) ? children.flat() : [children];
  const hasContent = childArray.some((c) => c !== false && c != null);

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[9px] uppercase tracking-wider text-niya-ink-2">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {hasContent ? (
          children
        ) : (
          <span className="text-[10px] italic text-niya-ink-2/70">{empty}</span>
        )}
      </div>
    </div>
  );
}

function PriceChip({ level, color }: { level: SRLevel; color: string }) {
  return (
    <span
      className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-niya-ink"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}11` }}
    >
      {compactPrice(level.price)}
    </span>
  );
}

function FibChip({ zone }: { zone: EntryZone }) {
  return (
    <span
      className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-niya-ink"
      style={{
        borderColor: `${COLORS.deepRetrace}55`,
        backgroundColor: `${COLORS.deepRetrace}11`,
      }}
    >
      <span className="text-niya-ink-2">{zone.label}</span>{' '}
      {compactPrice(zone.level)}
    </span>
  );
}

function TrendlineChip({ tl }: { tl: Trendline }) {
  const arrow = tl.kind === 'floor' ? '↗' : '↘';
  return (
    <span
      className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-niya-ink"
      style={{
        borderColor: `${COLORS.trendline}55`,
        backgroundColor: `${COLORS.trendline}11`,
      }}
    >
      {arrow} {compactPrice(tl.start.price)} → {compactPrice(tl.end.price)}
    </span>
  );
}

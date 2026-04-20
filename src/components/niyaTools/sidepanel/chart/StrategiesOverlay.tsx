// Niya Strategies overlays — DTFX zones, premium/discount midline,
// round numbers. All rendered in purple (#856292) on the chart.

import { useEffect, useMemo, useRef } from 'react';
import {
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
} from 'lightweight-charts';
import type { Candle } from '../../lib/types';
import {
  detectSwings,
  detectDtfxZones,
  detectPremiumDiscount,
  computeInterestScore,
  computeRoundLevels,
  type DtfxZone,
  type InterestResult,
  type MarketSide,
} from '../../lib/ta';

interface StrategiesChartRefs {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

export interface StrategiesAnalysis {
  zones: DtfxZone[];
  roundLevels: number[];
  interest: InterestResult;
  side: MarketSide;
}

interface StrategiesOverlayProps {
  candles: Candle[];
  chartRefs: StrategiesChartRefs;
  enabled: boolean;
  pairAgeHours: number;
  onAnalysis?: (a: StrategiesAnalysis) => void;
}

const PURPLE = '#856292';
const PURPLE_DIM = 'rgba(133,98,146,0.45)';

interface OverlaySet {
  priceLines: Array<{ series: ISeriesApi<'Candlestick'>; line: IPriceLine }>;
}

function teardown(set: OverlaySet) {
  for (const { series, line } of set.priceLines) {
    try {
      series.removePriceLine(line);
    } catch {
      /* chart already disposed */
    }
  }
}

const ZONE_STYLES: Record<DtfxZone['kind'], { style: LineStyle; width: 1 | 2 }> = {
  zone1: { style: LineStyle.Solid, width: 2 },
  zone2: { style: LineStyle.Dashed, width: 1 },
  zone3: { style: LineStyle.SparseDotted, width: 1 },
};

export default function StrategiesOverlay({
  candles,
  chartRefs,
  enabled,
  pairAgeHours,
  onAnalysis,
}: StrategiesOverlayProps) {
  const overlayRef = useRef<OverlaySet>({ priceLines: [] });

  const analysis = useMemo((): StrategiesAnalysis => {
    const empty: StrategiesAnalysis = {
      zones: [],
      roundLevels: [],
      interest: {
        score: 0, zone2Hit: false, daveFilter: false,
        cheapSide: false, roundNumber: false, volumeSpike: false,
        label: 'No signal',
      },
      side: 'neutral',
    };
    if (!enabled || candles.length < 12) return empty;

    const currentPrice = candles[candles.length - 1].close;
    const swings = detectSwings(candles);
    const zones = detectDtfxZones(candles, swings);
    const side = detectPremiumDiscount(currentPrice, swings);
    const interest = computeInterestScore(candles, currentPrice, pairAgeHours);
    const roundLevels = computeRoundLevels(currentPrice);

    return { zones, roundLevels, interest, side };
  }, [candles, enabled, pairAgeHours]);

  // Notify parent of analysis changes (for interest score badge)
  useEffect(() => {
    onAnalysis?.(analysis);
  }, [analysis, onAnalysis]);

  useEffect(() => {
    const { candleSeries } = chartRefs;
    if (!candleSeries || !enabled) {
      teardown(overlayRef.current);
      overlayRef.current = { priceLines: [] };
      return;
    }

    teardown(overlayRef.current);
    const set: OverlaySet = { priceLines: [] };

    // DTFX Zone bands — two lines per zone (top + bottom)
    for (const zone of analysis.zones) {
      const { style, width } = ZONE_STYLES[zone.kind];
      for (const price of [zone.low, zone.high]) {
        const line = candleSeries.createPriceLine({
          price,
          color: PURPLE,
          lineStyle: style,
          lineWidth: width,
          axisLabelVisible: zone.kind === 'zone2',
          title: price === zone.high ? zone.label : '',
        });
        set.priceLines.push({ series: candleSeries, line });
      }
    }

    // Premium/Discount midline
    if (analysis.zones.length > 0) {
      const allPrices = analysis.zones.flatMap((z) => [z.low, z.high]);
      const midline = (Math.min(...allPrices) + Math.max(...allPrices)) / 2;
      const line = candleSeries.createPriceLine({
        price: midline,
        color: PURPLE_DIM,
        lineStyle: LineStyle.LargeDashed,
        lineWidth: 1,
        axisLabelVisible: false,
        title: 'Midline',
      });
      set.priceLines.push({ series: candleSeries, line });
    }

    // Round-number levels
    for (const price of analysis.roundLevels) {
      const line = candleSeries.createPriceLine({
        price,
        color: PURPLE_DIM,
        lineStyle: LineStyle.SparseDotted,
        lineWidth: 1,
        axisLabelVisible: false,
        title: '',
      });
      set.priceLines.push({ series: candleSeries, line });
    }

    overlayRef.current = set;

    return () => {
      teardown(overlayRef.current);
      overlayRef.current = { priceLines: [] };
    };
  }, [analysis, chartRefs, enabled]);

  return null;
}

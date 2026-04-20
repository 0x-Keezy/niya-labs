// Pure technical-analysis helpers used by Analyst Mode (Day 6).
//
// All functions are deterministic and side-effect free so they can be
// memoised in React without surprises. They operate on the same `Candle`
// shape that flows from GeckoTerminal into the chart, in unix seconds.
//
// Algorithms are intentionally simple — pivots → cluster → top-N — because
// the goal is "non-technical traders see roughly where the levels are",
// not "match TradingView pixel-for-pixel".
//
// Vocabulary: this codebase uses "floor" and "ceiling" instead of the
// traditional "support" and "resistance" per the Niya brand guidelines.

import type { Candle } from './types';

export interface Pivot {
  time: number;
  price: number;
  kind: 'high' | 'low';
}

export interface SRLevel {
  price: number;
  strength: number;
  kind: 'floor' | 'ceiling';
}

export interface Trendline {
  start: { time: number; price: number };
  end: { time: number; price: number };
  slope: number; // price units per second
  kind: 'floor' | 'ceiling';
}

export interface EntryZone {
  low: number;
  high: number;
  label: '0.382' | '0.5' | '0.618';
  level: number; // the actual fib level price
}

/**
 * Wilder-style ATR. Returns the most recent ATR value as a single number.
 * `period` defaults to 14 — same as TradingView. Falls back to a fraction of
 * the average price when there isn't enough data so callers always get a
 * positive tolerance.
 */
export function computeAtr(candles: Candle[], period = 14): number {
  if (candles.length < 2) {
    return candles[0] ? candles[0].close * 0.01 : 0;
  }
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
    trs.push(tr);
  }
  const span = Math.min(period, trs.length);
  // Simple average over the last `span` true-ranges. Wilder smoothing
  // would be marginally better but adds noise for ~negligible gain on
  // the timescales we plot.
  const slice = trs.slice(-span);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / span;
}

/**
 * A bar is a high pivot if its `high` is strictly greater than the highs of
 * the `lookback` bars on either side. Analogous for low pivots.
 * Bars within `lookback` of either edge cannot be pivots and are skipped.
 */
export function findPivots(candles: Candle[], lookback = 5): Pivot[] {
  const pivots: Pivot[] = [];
  if (candles.length < lookback * 2 + 1) return pivots;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) {
        isHigh = false;
      }
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) {
        isLow = false;
      }
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ time: c.time, price: c.high, kind: 'high' });
    if (isLow) pivots.push({ time: c.time, price: c.low, kind: 'low' });
  }

  return pivots;
}

/**
 * Group pivots whose prices are within `atrTolerance` of each other into
 * floor/ceiling levels. Strength is the number of pivots in the cluster.
 * Clusters with fewer than 2 pivots are dropped — a single pivot is not a level.
 */
export function clusterPivots(
  pivots: Pivot[],
  atrTolerance: number,
): SRLevel[] {
  if (pivots.length === 0 || atrTolerance <= 0) return [];

  // Process highs and lows separately so a high pivot at $1.00 doesn't merge
  // with a low pivot at $1.00 into the same level — they have different
  // semantic meaning.
  const buckets = (kind: 'high' | 'low'): SRLevel[] => {
    const sorted = pivots
      .filter((p) => p.kind === kind)
      .sort((a, b) => a.price - b.price);
    if (sorted.length === 0) return [];

    const out: SRLevel[] = [];
    let cluster: Pivot[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = cluster[cluster.length - 1];
      if (sorted[i].price - prev.price <= atrTolerance) {
        cluster.push(sorted[i]);
      } else {
        if (cluster.length >= 2) {
          const avg =
            cluster.reduce((acc, p) => acc + p.price, 0) / cluster.length;
          out.push({
            price: avg,
            strength: cluster.length,
            kind: kind === 'high' ? 'ceiling' : 'floor',
          });
        }
        cluster = [sorted[i]];
      }
    }
    if (cluster.length >= 2) {
      const avg = cluster.reduce((acc, p) => acc + p.price, 0) / cluster.length;
      out.push({
        price: avg,
        strength: cluster.length,
        kind: kind === 'high' ? 'ceiling' : 'floor',
      });
    }
    return out;
  };

  return [...buckets('high'), ...buckets('low')];
}

/**
 * Top-3 floors and ceilings by strength, then by proximity to the
 * current price. Empty arrays if not enough data.
 */
export function detectFloorCeiling(candles: Candle[]): {
  floors: SRLevel[];
  ceilings: SRLevel[];
} {
  if (candles.length < 12) return { floors: [], ceilings: [] };

  const atr = computeAtr(candles);
  const tolerance = atr * 0.5;
  const pivots = findPivots(candles, 5);
  const levels = clusterPivots(pivots, tolerance);
  const lastClose = candles[candles.length - 1].close;

  const sortByStrength = (a: SRLevel, b: SRLevel) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    return Math.abs(a.price - lastClose) - Math.abs(b.price - lastClose);
  };

  const floors = levels
    .filter((l) => l.kind === 'floor' && l.price < lastClose)
    .sort(sortByStrength)
    .slice(0, 3);
  const ceilings = levels
    .filter((l) => l.kind === 'ceiling' && l.price > lastClose)
    .sort(sortByStrength)
    .slice(0, 3);

  return { floors, ceilings };
}

/**
 * Pick at most one floor trendline (rising lows) and one ceiling
 * trendline (falling highs) from the most recent pivots in view. Lines
 * with near-zero slope are dropped — the floor/ceiling levels already cover those.
 */
export function detectTrendlines(candles: Candle[]): Trendline[] {
  if (candles.length < 12) return [];
  const pivots = findPivots(candles, 5);
  const lows = pivots.filter((p) => p.kind === 'low');
  const highs = pivots.filter((p) => p.kind === 'high');

  const out: Trendline[] = [];
  const range = candles[candles.length - 1].time - candles[0].time;
  // Slope epsilon: anything that moves less than 0.5% of the average price
  // across the entire visible window is considered flat.
  const avgPrice =
    candles.reduce((acc, c) => acc + c.close, 0) / candles.length;
  const flatEps = (avgPrice * 0.005) / Math.max(range, 1);

  // Floor: take the two most recent low pivots; require the second to be
  // higher than the first (rising trendline).
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    if (b.price > a.price && b.time > a.time) {
      const slope = (b.price - a.price) / (b.time - a.time);
      if (Math.abs(slope) > flatEps) {
        out.push({
          start: { time: a.time, price: a.price },
          end: { time: b.time, price: b.price },
          slope,
          kind: 'floor',
        });
      }
    }
  }

  // Ceiling: two most recent high pivots, falling.
  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    if (b.price < a.price && b.time > a.time) {
      const slope = (b.price - a.price) / (b.time - a.time);
      if (Math.abs(slope) > flatEps) {
        out.push({
          start: { time: a.time, price: a.price },
          end: { time: b.time, price: b.price },
          slope,
          kind: 'ceiling',
        });
      }
    }
  }

  return out;
}

/**
 * Deep retrace areas (0.382 / 0.5 / 0.618) of the most recent swing.
 * The "swing" is the highest high and lowest low among the most recent
 * 60 candles — coarse but enough to anchor the levels somewhere reasonable
 * for a chart that the user is actively staring at.
 */
export function computeEntryZones(candles: Candle[]): EntryZone[] {
  if (candles.length < 12) return [];
  const window = candles.slice(-60);
  let highIdx = 0;
  let lowIdx = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i].high > window[highIdx].high) highIdx = i;
    if (window[i].low < window[lowIdx].low) lowIdx = i;
  }
  if (highIdx === lowIdx) return [];

  const swingHigh = window[highIdx].high;
  const swingLow = window[lowIdx].low;
  const range = swingHigh - swingLow;
  if (range <= 0) return [];

  // Direction matters only for the band ordering, not the math.
  const fib = (ratio: number) => swingHigh - range * ratio;
  const band = (level: number): { low: number; high: number } => {
    const half = level * 0.005; // ±0.5%
    return { low: level - half, high: level + half };
  };

  const ratios: Array<{ ratio: number; label: EntryZone['label'] }> = [
    { ratio: 0.382, label: '0.382' },
    { ratio: 0.5, label: '0.5' },
    { ratio: 0.618, label: '0.618' },
  ];

  return ratios.map(({ ratio, label }) => {
    const level = fib(ratio);
    const b = band(level);
    return { low: b.low, high: b.high, label, level };
  });
}

// -----------------------------------------------------------------------
// Niya Strategies — zone detection, interest scoring, directional filter
// -----------------------------------------------------------------------

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  kind: 'high' | 'low';
}

export interface DtfxZone {
  high: number;
  low: number;
  kind: 'zone1' | 'zone2' | 'zone3';
  label: string;
  direction: 'bullish' | 'bearish';
  anchorTime: number;
}

export type MarketSide = 'cheap' | 'expensive' | 'neutral';

export interface InterestResult {
  score: number;
  zone2Hit: boolean;
  daveFilter: boolean;
  cheapSide: boolean;
  roundNumber: boolean;
  volumeSpike: boolean;
  label: string;
}

/**
 * Fractal swing detector with configurable lookback.
 * Tighter than `findPivots` (default left=3, right=3) to produce more
 * swing points for zone and directional-filter logic.
 */
export function detectSwings(
  candles: Candle[],
  leftBars = 3,
  rightBars = 3,
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < leftBars + rightBars + 1) return swings;

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= leftBars; j++) {
      if (candles[i - j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low) isLow = false;
    }
    for (let j = 1; j <= rightBars; j++) {
      if (candles[i + j].high >= c.high) isHigh = false;
      if (candles[i + j].low <= c.low) isLow = false;
    }

    if (isHigh) swings.push({ index: i, time: c.time, price: c.high, kind: 'high' });
    if (isLow) swings.push({ index: i, time: c.time, price: c.low, kind: 'low' });
  }

  return swings.sort((a, b) => a.index - b.index);
}

/**
 * DTFX-style three-zone detection.
 *
 * Zone 1 ("Origin zone"): body range of the most recent extreme candle.
 * Zone 2 ("Primary reaction band"): ATR-scaled band in the trend direction.
 * Zone 3 ("Backup band"): ATR-scaled band against the trend direction.
 *
 * Returns empty if fewer than 2 swings are found.
 */
export function detectDtfxZones(
  candles: Candle[],
  swings: SwingPoint[],
): DtfxZone[] {
  if (swings.length < 2 || candles.length < 12) return [];

  const atr = computeAtr(candles);
  const lastHigh = [...swings].reverse().find((s) => s.kind === 'high');
  const lastLow = [...swings].reverse().find((s) => s.kind === 'low');
  if (!lastHigh || !lastLow) return [];

  const bullish = lastHigh.index > lastLow.index;
  const anchor = bullish ? lastLow : lastHigh;
  const anchorCandle = candles[anchor.index];
  if (!anchorCandle) return [];

  const bodyHigh = Math.max(anchorCandle.open, anchorCandle.close);
  const bodyLow = Math.min(anchorCandle.open, anchorCandle.close);
  const halfAtr = atr * 0.5;

  if (bullish) {
    return [
      { low: bodyLow, high: bodyHigh, kind: 'zone1', label: 'Origin zone', direction: 'bullish', anchorTime: anchor.time },
      { low: bodyHigh, high: bodyHigh + halfAtr, kind: 'zone2', label: 'Primary reaction band', direction: 'bullish', anchorTime: anchor.time },
      { low: bodyLow - halfAtr, high: bodyLow, kind: 'zone3', label: 'Backup band', direction: 'bullish', anchorTime: anchor.time },
    ];
  }

  return [
    { low: bodyLow, high: bodyHigh, kind: 'zone1', label: 'Origin zone', direction: 'bearish', anchorTime: anchor.time },
    { low: bodyLow - halfAtr, high: bodyLow, kind: 'zone2', label: 'Primary reaction band', direction: 'bearish', anchorTime: anchor.time },
    { low: bodyHigh, high: bodyHigh + halfAtr, kind: 'zone3', label: 'Backup band', direction: 'bearish', anchorTime: anchor.time },
  ];
}

/**
 * Cheap/expensive side of the most recent swing range.
 * Below the midpoint = "cheap" (favorable for longs).
 * Above the midpoint = "expensive" (favorable for shorts).
 */
export function detectPremiumDiscount(
  currentPrice: number,
  swings: SwingPoint[],
): MarketSide {
  const lastHigh = [...swings].reverse().find((s) => s.kind === 'high');
  const lastLow = [...swings].reverse().find((s) => s.kind === 'low');
  if (!lastHigh || !lastLow) return 'neutral';

  const mid = (lastHigh.price + lastLow.price) / 2;
  if (currentPrice < mid) return 'cheap';
  if (currentPrice > mid) return 'expensive';
  return 'neutral';
}

/**
 * Dave Teaches directional filter.
 * "Never long from a low that didn't make a new high."
 * longAllowed: most recent swing high > previous swing high (higher high).
 * shortAllowed: most recent swing low < previous swing low (lower low).
 */
export function computeDaveFilter(swings: SwingPoint[]): {
  longAllowed: boolean;
  shortAllowed: boolean;
} {
  const highs = swings.filter((s) => s.kind === 'high');
  const lows = swings.filter((s) => s.kind === 'low');

  const longAllowed =
    highs.length >= 2
      ? highs[highs.length - 1].price > highs[highs.length - 2].price
      : true;
  const shortAllowed =
    lows.length >= 2
      ? lows[lows.length - 1].price < lows[lows.length - 2].price
      : true;

  return { longAllowed, shortAllowed };
}

/**
 * Round-number price levels near the current price.
 * E.g. $0.0042 → [$0.004, $0.005]; $2.34 → [$2.00, $3.00].
 */
export function computeRoundLevels(currentPrice: number): number[] {
  if (currentPrice <= 0) return [];

  const mag = Math.pow(10, Math.floor(Math.log10(currentPrice)));
  const step = mag;
  const base = Math.floor(currentPrice / step) * step;
  const levels: number[] = [];

  for (let i = -1; i <= 2; i++) {
    const lvl = base + step * i;
    if (lvl > 0 && Math.abs(lvl - currentPrice) / currentPrice < 0.5) {
      levels.push(lvl);
    }
  }

  return levels;
}

/**
 * Niya Strategies interest score (0–89).
 *
 * Factors:
 *   Zone 2 hit       +30  (price inside the primary reaction band)
 *   Dave filter       +20  (structural directional confirmation)
 *   Cheap side        +10  (price on the favorable side of the swing)
 *   Round number      +10  (near a psychological level)
 *   Volume expanding  +10  (recent volume above average)
 *
 * Capped at 89 — never imply certainty. Tokens < 48h old return score 0.
 */
export function computeInterestScore(
  candles: Candle[],
  currentPrice: number,
  pairAgeHours: number,
): InterestResult {
  const empty: InterestResult = {
    score: 0,
    zone2Hit: false,
    daveFilter: false,
    cheapSide: false,
    roundNumber: false,
    volumeSpike: false,
    label: 'No signal',
  };

  if (pairAgeHours < 48 || candles.length < 12) {
    return { ...empty, label: pairAgeHours < 48 ? 'Too young to score' : 'Not enough data' };
  }

  const swings = detectSwings(candles);
  if (swings.length < 2) return empty;

  const zones = detectDtfxZones(candles, swings);
  const zone2 = zones.find((z) => z.kind === 'zone2');
  const side = detectPremiumDiscount(currentPrice, swings);
  const dave = computeDaveFilter(swings);
  const roundLevels = computeRoundLevels(currentPrice);

  // Factor 1: price inside Zone 2
  const zone2Hit = zone2
    ? currentPrice >= zone2.low && currentPrice <= zone2.high
    : false;

  // Factor 2: Dave filter matches current direction
  const direction = zones.length > 0 ? zones[0].direction : 'bullish';
  const daveFilter = direction === 'bullish' ? dave.longAllowed : dave.shortAllowed;

  // Factor 3: on the cheap side for a bullish bias (or expensive for bearish)
  const cheapSide =
    direction === 'bullish' ? side === 'cheap' : side === 'expensive';

  // Factor 4: near a round number (within 1%)
  const roundNumber = roundLevels.some(
    (lvl) => Math.abs(lvl - currentPrice) / currentPrice < 0.01,
  );

  // Factor 5: volume expanding (last 3 bars > 1.5× avg of last 20)
  let volumeSpike = false;
  if (candles.length >= 20) {
    const last20 = candles.slice(-20);
    const avgVol = last20.reduce((s, c) => s + (c.volume ?? 0), 0) / 20;
    const last3 = candles.slice(-3);
    const recentVol = last3.reduce((s, c) => s + (c.volume ?? 0), 0) / 3;
    volumeSpike = avgVol > 0 && recentVol > avgVol * 1.5;
  }

  let score = 0;
  if (zone2Hit) score += 30;
  if (daveFilter) score += 20;
  if (cheapSide) score += 10;
  if (roundNumber) score += 10;
  if (volumeSpike) score += 10;

  score = Math.min(score, 89);

  let label = 'No signal';
  if (score >= 70) label = 'High interest zone';
  else if (score >= 40) label = 'Moderate interest';
  else if (score >= 20) label = 'Low interest';

  return { score, zone2Hit, daveFilter, cheapSide, roundNumber, volumeSpike, label };
}

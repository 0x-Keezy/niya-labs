// Shared number formatting helpers used by the side panel UI and the chart
// tooltip. Centralised so the PairHeader and the crosshair overlay stay in sync.

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

/**
 * Format a price for display. Handles memecoin-scale numbers using
 * subscript-zero notation like DexScreener: $0.0₅1234 = 0.000001234.
 */
export function compactPrice(p: number): string {
  if (!Number.isFinite(p) || p === 0) return '—';
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;

  // p < 0.0001 → use subscript-zero compact form.
  // Count leading zeros after the decimal point.
  const str = p.toFixed(20); // plenty of precision
  const match = /^0\.(0+)(\d+)/.exec(str);
  if (!match) return `$${p.toExponential(3)}`;
  const zeros = match[1].length;
  const sigDigits = match[2].slice(0, 4); // keep 4 significant digits
  return `$0.0${toSubscript(zeros)}${sigDigits}`;
}

/** Format a USD amount with K/M suffixes. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Truncate a 0x address to a `0x1234…abcd` form. Used by the Scout cards
 * (HoldersCard, devWallet display) and any UI that links out to BscScan.
 */
export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 2) return addr || '';
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Format a UNIX second timestamp as a short local date/time. */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

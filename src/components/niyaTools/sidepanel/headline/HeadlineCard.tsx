import { useState } from 'react';
import type { PairSummary } from '../../lib/types';
import { compactPrice } from '../../lib/format';

interface HeadlineCardProps {
  pair: PairSummary;
  ca: string;
}

export default function HeadlineCard({ pair, ca }: HeadlineCardProps) {
  const [copied, setCopied] = useState(false);

  const symbol = pair.baseToken.symbol;
  const price = compactPrice(pair.priceUsd);
  const change = pair.priceChange24h;
  const isPositive = change >= 0;

  // Build the dotted CA display: "0x7af3 · 9e21 · b29c · BNB CHAIN"
  const prefix = ca.slice(0, 6);           // "0x7af3"
  const mid = ca.slice(6, 10);             // next 4 chars
  const tail = ca.slice(-4);               // last 4
  const caDisplay = `${prefix} \u00B7 ${mid} \u00B7 ${tail} \u00B7 BNB CHAIN`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may fail in extension context; fallback ignored
    }
  };

  return (
    <div style={{ padding: '22px 20px 20px' }}>
      <div
        className="grid items-end"
        style={{ gridTemplateColumns: '1fr auto', gap: '16px' }}
      >
        {/* LEFT: ticker-stack */}
        <div className="min-w-0">
          <p
            className="font-body text-niya-ink-mute uppercase"
            style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.2em' }}
          >
            ACTIVE TOKEN
          </p>

          <p
            className="font-display text-niya-ink"
            style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            <span className="text-niya-pink" style={{ fontWeight: 500 }}>$</span>
            {symbol}
          </p>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="font-mono text-niya-ink-mute truncate"
              style={{ fontSize: '10px' }}
            >
              {caDisplay}
            </span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 text-niya-ink-mute hover:text-niya-pink transition-all duration-150 hover:scale-110 active:scale-90"
              title={copied ? 'Copied!' : 'Copy CA'}
              style={{ fontSize: '10px', lineHeight: 1 }}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT: price-stack */}
        <div className="text-right">
          <p
            className="font-display text-niya-ink"
            style={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {price}
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: isPositive ? '#16A34A' : '#D67A67',
            }}
          >
            {isPositive ? '+' : ''}{change.toFixed(1)}% &middot; 24h
          </p>
        </div>
      </div>
    </div>
  );
}

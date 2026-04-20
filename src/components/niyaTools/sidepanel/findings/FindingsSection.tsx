// Transforms a MicrostructureResult into an array of on-chain findings
// gated by the user's tier, then renders them as FindingCard components.

import type { MicrostructureResult, Tier } from '../../lib/types';
import FindingCard from './FindingCard';

interface FindingsSectionProps {
  result: MicrostructureResult;
  tier: Tier;
}

interface Finding {
  letter: string;
  title: string;
  explanation: string;
  note?: string;
  state: 'crit' | 'warn' | 'good';
}

function buildFindings(result: MicrostructureResult): Finding[] {
  const findings: Finding[] = [];

  // A — Holder concentration
  const eff = result.top10EffectiveShare;
  if (eff > 50) {
    findings.push({
      letter: 'A',
      title: 'Holder concentration:',
      explanation: `Top 10 wallets hold ${eff.toFixed(1)}% of circulating supply.`,
      note: `raw: ${result.top10Share.toFixed(1)}% (includes staking/CEX)`,
      state: 'crit',
    });
  } else if (eff > 25) {
    findings.push({
      letter: 'A',
      title: 'Holder concentration:',
      explanation: `Moderate concentration \u2014 top 10 hold ${eff.toFixed(1)}%.`,
      note: `raw: ${result.top10Share.toFixed(1)}% (includes staking/CEX)`,
      state: 'warn',
    });
  } else {
    findings.push({
      letter: 'A',
      title: 'Holder concentration:',
      explanation: `Healthy distribution \u2014 top 10 hold only ${eff.toFixed(1)}%.`,
      note: `raw: ${result.top10Share.toFixed(1)}% (includes staking/CEX)`,
      state: 'good',
    });
  }

  // B — LP lock
  const { lp } = result;
  if (!lp.locked) {
    findings.push({
      letter: 'B',
      title: 'LP lock:',
      explanation:
        'Liquidity is unlocked. The deployer can remove it at any time.',
      state: 'crit',
    });
  } else if (lp.lockedShare < 50) {
    findings.push({
      letter: 'B',
      title: 'LP lock:',
      explanation: `Liquidity partially locked (${lp.lockedShare.toFixed(1)}% via ${lp.lockProvider ?? 'unknown'}).`,
      state: 'warn',
    });
  } else {
    findings.push({
      letter: 'B',
      title: 'LP lock:',
      explanation: `Liquidity locked (${lp.lockedShare.toFixed(1)}% via ${lp.lockProvider ?? 'unknown'}).`,
      state: 'good',
    });
  }

  // C — Snipers (only when not skipped)
  if (!result.snipers.skipped) {
    const { count, sharePct } = result.snipers;
    const c = count ?? 0;
    const s = sharePct ?? 0;
    if (s > 30) {
      findings.push({
        letter: 'C',
        title: 'Snipers:',
        explanation: `Early wallets still hold ${s.toFixed(1)}% \u2014 ${c} sniper wallets detected.`,
        note: 'first 30 transfers analyzed',
        state: 'crit',
      });
    } else if (s > 15) {
      findings.push({
        letter: 'C',
        title: 'Snipers:',
        explanation: `${c} early wallets hold ${s.toFixed(1)}% of supply.`,
        note: 'first 30 transfers analyzed',
        state: 'warn',
      });
    } else {
      findings.push({
        letter: 'C',
        title: 'Snipers:',
        explanation: `Minimal sniper presence (${c} wallets, ${s.toFixed(1)}%).`,
        note: 'first 30 transfers analyzed',
        state: 'good',
      });
    }
  }

  // D — Token age
  if (result.tokenAgeDays === null) {
    findings.push({
      letter: 'D',
      title: 'Token age:',
      explanation: 'Token age unknown.',
      state: 'warn',
    });
  } else if (result.tokenAgeDays < 7) {
    findings.push({
      letter: 'D',
      title: 'Token age:',
      explanation: `Token is only ${result.tokenAgeDays} days old. Higher volatility expected.`,
      state: 'warn',
    });
  } else {
    findings.push({
      letter: 'D',
      title: 'Token age:',
      explanation: `Token has been active for ${result.tokenAgeDays} days.`,
      state: 'good',
    });
  }

  // I — Wallet clusters / sybil detection
  const cl = result.clusters;
  if (cl?.detected) {
    if (cl.combinedSharePct > 25) {
      findings.push({
        letter: 'I',
        title: 'Wallet cluster:',
        explanation: `${cl.walletCount} top holders funded by the same wallet hold ${cl.combinedSharePct.toFixed(0)}% of supply.`,
        state: 'crit',
      });
    } else {
      findings.push({
        letter: 'I',
        title: 'Wallet cluster:',
        explanation: `${cl.walletCount} top holders share a common funder (${cl.combinedSharePct.toFixed(0)}%).`,
        state: 'warn',
      });
    }
  }

  // E–H — GMGN security data (when available)
  const sec = result.security;
  if (sec) {
    if (sec.isHoneypot) {
      findings.push({
        letter: 'E',
        title: 'Honeypot:',
        explanation: 'This contract appears to be a honeypot \u2014 sells may be blocked.',
        state: 'crit',
      });
    } else if (sec.isHoneypot === false) {
      findings.push({
        letter: 'E',
        title: 'Honeypot:',
        explanation: 'No honeypot mechanism detected.',
        state: 'good',
      });
    }

    const sellTax = sec.sellTax ?? 0;
    if (sellTax > 20) {
      findings.push({
        letter: 'F',
        title: 'Sell tax:',
        explanation: `High sell tax of ${sellTax.toFixed(1)}%.`,
        state: 'crit',
      });
    } else if (sellTax > 5) {
      findings.push({
        letter: 'F',
        title: 'Sell tax:',
        explanation: `Sell tax is ${sellTax.toFixed(1)}%.`,
        note: sec.buyTax != null ? `buy tax: ${sec.buyTax.toFixed(1)}%` : undefined,
        state: 'warn',
      });
    }

    if (sec.canTakeOwnership) {
      findings.push({
        letter: 'G',
        title: 'Ownership:',
        explanation: 'Owner can reclaim ownership of the contract.',
        state: 'warn',
      });
    }

    if (sec.isOpenSource === false) {
      findings.push({
        letter: 'H',
        title: 'Source code:',
        explanation: 'Contract source is not verified (not open source).',
        state: 'warn',
      });
    }
  }

  return findings;
}

function gateByTier(findings: Finding[], tier: Tier): Finding[] {
  // All findings have letters A, B, optionally C, and D.
  // Scout: A + B (first 2)
  // Analyst: A + B + C (if C exists, else A + B + D — 3 total or 2 if neither)
  // Pro: all

  if (tier === 'pro') return findings;

  const a = findings.find((f) => f.letter === 'A');
  const b = findings.find((f) => f.letter === 'B');
  const c = findings.find((f) => f.letter === 'C');
  const d = findings.find((f) => f.letter === 'D');

  if (tier === 'scout') {
    return [a, b].filter(Boolean) as Finding[];
  }

  // Analyst: A, B, then C if it exists, else D
  const result = [a, b].filter(Boolean) as Finding[];
  if (c) result.push(c);
  else if (d) result.push(d);
  return result;
}

export default function FindingsSection({
  result,
  tier,
}: FindingsSectionProps) {
  const allFindings = buildFindings(result);
  const visible = gateByTier(allFindings, tier);

  return (
    <section style={{ padding: '22px 20px 6px' }}>
      <div className="niya-section-label">
        <span className="l">ON-CHAIN FINDINGS</span>
        <span className="r">{visible.length} items</span>
      </div>

      {visible.map((f, i) => (
        <div key={f.letter} className={`animate-slide-up niya-stagger-${i + 1}`}>
          <FindingCard
            letter={f.letter}
            title={f.title}
            explanation={f.explanation}
            note={f.note}
            state={f.state}
          />
        </div>
      ))}
    </section>
  );
}

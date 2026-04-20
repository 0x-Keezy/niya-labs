import { useEffect, useState, useCallback } from 'react';
import type { MicrostructureResult, PairSummary } from '../../lib/types';
import {
  type ActionRule,
  parseRule,
  loadRules,
  saveRules,
  evaluateRules,
} from '../../lib/actionRules';

interface AlertsSectionProps {
  microResult?: MicrostructureResult | null;
  pair?: PairSummary | null;
}

export default function AlertsSection({
  microResult,
  pair,
}: AlertsSectionProps) {
  const [rules, setRules] = useState<ActionRule[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load rules from storage on mount, seed defaults if empty
  useEffect(() => {
    loadRules().then((loaded) => {
      if (loaded.length === 0) {
        const defaults: ActionRule[] = [
          {
            id: 'default-1',
            text: 'Ping me if top holder sells more than 20%',
            metric: 'topHolderShare',
            operator: '>=',
            threshold: 20,
            status: 'paused',
            createdAt: 0,
            triggeredAt: null,
          },
          {
            id: 'default-2',
            text: 'Ping me if rug risk goes above 70',
            metric: 'rugRiskScore',
            operator: '>=',
            threshold: 70,
            status: 'paused',
            createdAt: 0,
            triggeredAt: null,
          },
          {
            id: 'default-3',
            text: 'Ping me if LP lock drops below 50%',
            metric: 'lpLockedShare',
            operator: '<=',
            threshold: 50,
            status: 'paused',
            createdAt: 0,
            triggeredAt: null,
          },
        ];
        setRules(defaults);
        void saveRules(defaults);
      } else {
        setRules(loaded);
      }
    });
  }, []);

  // Evaluate rules whenever microstructure data changes
  useEffect(() => {
    if (!microResult || rules.length === 0) return;

    const evalData = {
      rugRiskScore: microResult.rugRiskScore,
      top10EffectiveShare: microResult.top10EffectiveShare,
      topHolderShare: microResult.topHolderShare,
      sniperCount: microResult.snipers.count,
      sniperSharePct: microResult.snipers.sharePct,
      lpLockedShare: microResult.lp.lockedShare,
      priceChange24h: pair?.priceChange24h,
      liquidityUsd: pair?.liquidityUsd,
    };

    const updated = evaluateRules(rules, evalData);
    // Check if any rule status actually changed
    const changed = updated.some(
      (r, i) => r.status !== rules[i]?.status,
    );
    if (changed) {
      setRules(updated);
      void saveRules(updated);

      // Fire Chrome notification for newly triggered rules
      const newlyTriggered = updated.filter(
        (r, i) => r.status === 'triggered' && rules[i]?.status === 'active',
      );
      for (const rule of newlyTriggered) {
        try {
          chrome.notifications?.create(`niya-rule-${rule.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime?.getURL?.('icons/128.png') ?? '',
            title: 'Niya Alert Triggered',
            message: rule.text,
          });
        } catch {
          // Notifications may not be available
        }
      }
    }
  }, [microResult, pair]);

  const handleAdd = useCallback(() => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) return;

    const parsed = parseRule(trimmed);
    if (!parsed) {
      setError('Could not understand that rule. Try: "If rug risk goes above 60"');
      return;
    }

    const newRule: ActionRule = {
      id: crypto.randomUUID(),
      text: trimmed,
      metric: parsed.metric,
      operator: parsed.operator,
      threshold: parsed.threshold,
      status: 'active',
      createdAt: Date.now(),
      triggeredAt: null,
    };

    const updated = [...rules, newRule];
    setRules(updated);
    void saveRules(updated);
    setInput('');
  }, [input, rules]);

  const handleRemove = useCallback(
    (id: string) => {
      const updated = rules.filter((r) => r.id !== id);
      setRules(updated);
      void saveRules(updated);
    },
    [rules],
  );

  return (
    <section style={{ padding: '22px 20px' }}>
      {/* Header */}
      <div className="niya-section-label mb-3 flex items-center justify-between">
        <span>YOUR ACTIVE RULES</span>
        <span
          className="font-body italic text-niya-ink-3"
          style={{ fontSize: '10px' }}
        >
          alerts
        </span>
      </div>

      {/* Rule rows */}
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="mb-2 grid items-center rounded-xl border border-niya-border bg-niya-panel-2"
          style={{
            gridTemplateColumns: '1fr auto auto',
            padding: '12px 14px',
            gap: '8px',
          }}
        >
          <p
            className="font-body text-niya-ink-2"
            style={{ fontSize: '12px', fontWeight: 500 }}
          >
            {rule.text}
          </p>
          <button
            type="button"
            onClick={() => {
              if (rule.status === 'triggered') return;
              const next = rule.status === 'paused' ? 'active' : 'paused';
              const updated = rules.map((r) =>
                r.id === rule.id ? { ...r, status: next as ActionRule['status'] } : r,
              );
              setRules(updated);
              void saveRules(updated);
            }}
            className="flex items-center gap-1.5"
            title={rule.status === 'paused' ? 'Click to activate' : rule.status === 'active' ? 'Click to pause' : ''}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: '6px',
                height: '6px',
                background:
                  rule.status === 'triggered'
                    ? '#B8812A'
                    : rule.status === 'paused'
                      ? '#9B9B9B'
                      : '#16A34A',
              }}
            />
            <span
              className="font-body uppercase"
              style={{
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color:
                  rule.status === 'triggered'
                    ? '#B8812A'
                    : rule.status === 'paused'
                      ? '#9B9B9B'
                      : '#16A34A',
              }}
            >
              {rule.status === 'triggered'
                ? 'TRIGGERED'
                : rule.status === 'paused'
                  ? 'PAUSED'
                  : 'ARMED'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleRemove(rule.id)}
            className="text-niya-ink-mute transition-colors hover:text-niya-accent"
            style={{ fontSize: '14px', lineHeight: 1 }}
            title="Remove rule"
          >
            &times;
          </button>
        </div>
      ))}

      {/* Fallback when no rules exist */}
      {rules.length === 0 && (
        <p
          className="mb-2 font-body italic text-niya-ink-mute"
          style={{ fontSize: '11px' }}
        >
          No active rules. Add one below.
        </p>
      )}

      {/* New rule input */}
      <div
        className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-niya-border-2 bg-niya-panel"
        style={{ padding: '7px 7px 7px 14px' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Write a new rule…"
          className="flex-1 border-0 bg-transparent font-body text-niya-ink outline-0 placeholder:text-niya-ink-3"
          style={{ fontSize: '12px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="flex flex-shrink-0 items-center justify-center rounded-md bg-niya-pink-soft text-niya-accent transition-colors hover:bg-niya-accent hover:text-white"
          style={{
            width: '28px',
            height: '28px',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p
          className="mt-1.5 font-body text-niya-accent-2"
          style={{ fontSize: '10px' }}
        >
          {error}
        </p>
      )}
    </section>
  );
}

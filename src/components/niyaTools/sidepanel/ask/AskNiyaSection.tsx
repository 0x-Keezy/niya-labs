import { useState, useRef, useCallback } from 'react';
import type { MicrostructureResult, PairSummary } from '../../lib/types';
import { fetchAskNiya, BackendError } from '../../lib/backend';
import { validateNarration } from '../../lib/vocab';

interface AskNiyaSectionProps {
  ca?: string | null;
  microResult?: MicrostructureResult | null;
  pair?: PairSummary | null;
}

/**
 * Curated allow-list of DGrid models shown in the picker. MUST stay in sync
 * with DGRID_MODELS in `src/features/llm/dgrid.ts` (the server validates each
 * ID against the same list). See https://dgrid.ai/models for the full catalog
 * of 200+ models the gateway routes to.
 */
const MODEL_OPTIONS = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'OpenAI' },
  { id: 'xai/grok-3-mini', label: 'Grok 3 mini', provider: 'xAI' },
  { id: 'anthropic/claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', provider: 'Qwen' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'DeepSeek' },
] as const;

type ModelId = (typeof MODEL_OPTIONS)[number]['id'];

const DEFAULT_MODEL: ModelId = 'openai/gpt-4o-mini';

export default function AskNiyaSection({
  ca,
  microResult,
  pair,
}: AskNiyaSectionProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  // Track the model/provider that actually answered — may differ from the
  // selected one if the server's env default overrode the request.
  const [answerMeta, setAnswerMeta] = useState<{
    provider: 'dgrid' | 'xai';
    model: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAsk = useCallback(() => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setAnswerMeta(null);

    const context = microResult
      ? {
          rugRiskScore: microResult.rugRiskScore,
          riskHeadline: microResult.riskHeadline,
          top10EffectiveShare: microResult.top10EffectiveShare,
          topHolderShare: microResult.topHolderShare,
          lpLockedShare: microResult.lp.lockedShare,
          sniperCount: microResult.snipers.count,
          tokenAgeDays: microResult.tokenAgeDays,
          totalHolders: microResult.totalHolders,
          priceChange24h: pair?.priceChange24h,
          liquidityUsd: pair?.liquidityUsd,
          symbol: pair?.baseToken.symbol,
        }
      : undefined;

    fetchAskNiya(
      { question: trimmed, ca: ca ?? undefined, context, model },
      controller.signal,
    )
      .then((resp) => {
        setAnswer(validateNarration(resp.answer));
        if (resp.provider && resp.model) {
          setAnswerMeta({ provider: resp.provider, model: resp.model });
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[Niya Tools] ask fetch failed:', err);
        if (err instanceof BackendError) {
          setError(`Failed (${err.status})`);
        } else {
          setError('Could not reach Niya. Is the backend running?');
        }
      })
      .finally(() => setLoading(false));
  }, [question, loading, ca, microResult, pair, model]);

  return (
    <section
      className="bg-niya-panel-2"
      style={{ padding: '20px 20px 22px' }}
    >
      {/* Prompt text + model picker — stacks vertically under ~400 px so the */}
      {/* label and dropdown get full width on mobile web. `sm:` (not `md:`)  */}
      {/* keeps the layout identical inside the 400 px Chrome side panel.    */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <p
          className="font-body text-niya-ink-3"
          style={{ fontSize: '12px', fontWeight: 500 }}
        >
          Still uncertain?{' '}
          <span
            className="not-italic text-niya-accent"
            style={{ fontWeight: 700 }}
          >
            Ask Niya.
          </span>
        </p>
        {/* DGrid model picker — lets the user swap the underlying LLM without */}
        {/* leaving the page. The server re-validates the ID against the same  */}
        {/* allow-list, so this is safe to expose.                             */}
        <label
          className="flex items-center gap-1.5 font-mono text-niya-ink-mute"
          style={{ fontSize: '10px' }}
          title="Powered by DGrid AI Gateway — routes to 200+ models via one API"
        >
          <span>model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            disabled={loading}
            className="rounded-md border border-niya-border bg-niya-panel text-niya-ink disabled:opacity-50"
            style={{
              fontSize: '10px',
              padding: '2px 4px',
              fontFamily: 'inherit',
            }}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} · {opt.provider}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Input field */}
      <div
        className="flex items-center rounded-[14px] border border-niya-border bg-niya-panel"
        style={{ padding: '7px 7px 7px 14px', gap: '10px' }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk();
          }}
          placeholder="Type your question..."
          disabled={loading}
          className="flex-1 border-0 bg-transparent font-body text-niya-ink outline-0 placeholder:text-niya-ink-mute disabled:opacity-50"
          style={{ fontSize: '13px' }}
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={loading || question.trim().length === 0}
          className="font-body text-niya-tan-ink disabled:opacity-40 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '9px 16px',
            borderRadius: '10px',
            border: '1px solid #E8C899',
            background: 'linear-gradient(180deg, #F5DCB8 0%, #ECC592 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>

      {/* Answer display */}
      {answer && (
        <div
          className="mt-3 rounded-xl border border-niya-border bg-niya-panel animate-slide-up"
          style={{ padding: '14px' }}
        >
          <p
            className="font-display text-niya-ink-2"
            style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.5 }}
          >
            {answer}
          </p>
          <p
            className="mt-2 font-mono text-niya-ink-mute"
            style={{ fontSize: '9px' }}
          >
            {/* Attribution line — shows provider + model so users know where */}
            {/* the answer came from. "via dgrid" is the bounty-visible badge.*/}
            {answerMeta ? `${answerMeta.model} via ${answerMeta.provider}` : model}
            {' · '}
            {new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'UTC',
            })}{' '}
            UTC
          </p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="mt-3 flex flex-col gap-2" style={{ padding: '14px 0' }}>
          <div className="h-3 w-full niya-shimmer rounded" />
          <div className="h-3 w-3/4 niya-shimmer rounded" style={{ animationDelay: '150ms' }} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p
          className="mt-2 font-body text-niya-accent-2"
          style={{ fontSize: '10px' }}
        >
          {error}
        </p>
      )}
    </section>
  );
}

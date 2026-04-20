// User-defined alert rules: parsing natural-language conditions, persisting
// to chrome.storage.local, and evaluating against live token data.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleMetric =
  | 'rugRiskScore'
  | 'top10EffectiveShare'
  | 'topHolderShare'
  | 'sniperCount'
  | 'sniperSharePct'
  | 'lpLockedShare'
  | 'priceChange24h'
  | 'liquidityUsd';

export type RuleOperator = '>' | '<' | '>=' | '<=';

export interface ActionRule {
  id: string;
  text: string; // original natural-language input
  metric: RuleMetric;
  operator: RuleOperator;
  threshold: number;
  status: 'active' | 'triggered' | 'paused';
  createdAt: number; // unix ms
  triggeredAt: number | null;
}

interface EvalData {
  rugRiskScore?: number;
  top10EffectiveShare?: number;
  topHolderShare?: number;
  sniperCount?: number | null;
  sniperSharePct?: number | null;
  lpLockedShare?: number;
  priceChange24h?: number;
  liquidityUsd?: number;
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'niya.actionRules';

// ---------------------------------------------------------------------------
// Metric patterns — order matters: more specific patterns must come first so
// "liquidity lock" is matched before the generic "liquidity" / "liq" pattern.
// ---------------------------------------------------------------------------

const METRIC_PATTERNS: { re: RegExp; metric: RuleMetric }[] = [
  { re: /rug\s*risk/i, metric: 'rugRiskScore' },
  { re: /top[\s-]*10|concentration/i, metric: 'top10EffectiveShare' },
  { re: /top[\s-]*1(?:\s|$)|top[\s-]*holder/i, metric: 'topHolderShare' },
  { re: /sniper\s*count|snipers/i, metric: 'sniperCount' },
  { re: /sniper\s*share|sniper\s*%/i, metric: 'sniperSharePct' },
  { re: /lp\s*lock|liquidity\s*lock/i, metric: 'lpLockedShare' },
  { re: /price\s*change|24h/i, metric: 'priceChange24h' },
  { re: /liquidity|liq/i, metric: 'liquidityUsd' },
];

// ---------------------------------------------------------------------------
// Operator patterns
// ---------------------------------------------------------------------------

const OP_ABOVE: RuleOperator = '>=';
const OP_BELOW: RuleOperator = '<=';

const OPERATOR_PATTERNS: { re: RegExp; op: RuleOperator }[] = [
  { re: /goes\s*above/i, op: OP_ABOVE },
  { re: /exceeds/i, op: OP_ABOVE },
  { re: /above/i, op: OP_ABOVE },
  { re: /over/i, op: OP_ABOVE },
  { re: /greater\s*than/i, op: OP_ABOVE },
  { re: /goes\s*below/i, op: OP_BELOW },
  { re: /drops\s*below/i, op: OP_BELOW },
  { re: /below/i, op: OP_BELOW },
  { re: /under/i, op: OP_BELOW },
  { re: /less\s*than/i, op: OP_BELOW },
];

// ---------------------------------------------------------------------------
// parseRule
// ---------------------------------------------------------------------------

export function parseRule(
  text: string,
): { metric: RuleMetric; operator: RuleOperator; threshold: number } | null {
  if (!text) return null;

  // --- metric ---
  let metric: RuleMetric | null = null;
  for (const { re, metric: m } of METRIC_PATTERNS) {
    if (re.test(text)) {
      metric = m;
      break;
    }
  }
  if (!metric) return null;

  // --- operator ---
  let operator: RuleOperator | null = null;
  for (const { re, op } of OPERATOR_PATTERNS) {
    if (re.test(text)) {
      operator = op;
      break;
    }
  }
  if (!operator) return null;

  // --- threshold ---
  // Match a number with optional decimals and optional k/K suffix.
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!numMatch) return null;
  let threshold = parseFloat(numMatch[1]);
  if (numMatch[2]) threshold *= 1_000;
  if (!Number.isFinite(threshold)) return null;

  return { metric, operator, threshold };
}

// ---------------------------------------------------------------------------
// loadRules / saveRules
// ---------------------------------------------------------------------------

export async function loadRules(): Promise<ActionRule[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    return Array.isArray(stored) ? (stored as ActionRule[]) : [];
  } catch {
    // Vite dev mode — chrome.storage may not be available.
    return [];
  }
}

export async function saveRules(rules: ActionRule[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
  } catch {
    // Vite dev mode — silently ignore.
  }
}

// ---------------------------------------------------------------------------
// evaluateRules
// ---------------------------------------------------------------------------

function compare(value: number, op: RuleOperator, threshold: number): boolean {
  switch (op) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
  }
}

export function evaluateRules(
  rules: ActionRule[],
  data: EvalData,
): ActionRule[] {
  return rules.map((rule) => {
    if (rule.status === 'triggered' || rule.status === 'paused') return rule;

    const value = data[rule.metric];
    if (value === null || value === undefined) return rule;

    if (compare(value, rule.operator, rule.threshold)) {
      return { ...rule, status: 'triggered' as const, triggeredAt: Date.now() };
    }
    return rule;
  });
}

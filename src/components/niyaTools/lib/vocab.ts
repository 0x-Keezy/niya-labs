// Vocabulary constants for the Niya brand.
// "support" → "floor", "resistance" → "ceiling", etc.
// The banned-words linter (scripts/check-banned.js) enforces this.

/** Words that must NEVER appear in user-visible UI text. */
export const BANNED_WORDS = [
  'support',
  'resistance',
  'fibonacci',
  'order block',
  'CHoCH',
  'BOS',
  'FVG',
  'SMC',
  'ICT',
  'DTFX',
];

/** Fallback narration when the LLM endpoint is unavailable. */
export const FALLBACK_NARRATION =
  'Unable to generate analysis at this time. Review the on-chain findings above for a summary of the token microstructure.';

/**
 * Validates that a narration from the LLM doesn't contain banned vocabulary.
 * Returns the text if clean, or the fallback if contaminated.
 */
export function validateNarration(text: string): string {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      console.warn(`[Niya Tools] narration contained banned word "${word}", using fallback`);
      return FALLBACK_NARRATION;
    }
  }
  return text;
}

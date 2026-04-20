/**
 * Command Validator - Security layer for user commands
 * 
 * This module filters dangerous commands from non-admin users
 * to prevent malicious actions like forced trading or tweeting.
 */

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedMessage?: string;
  detectedPatterns?: string[];
}

export type UserRole = 'admin' | 'viewer';

// Dangerous command patterns that require admin privileges
const DANGEROUS_PATTERNS = [
  // Trading commands - flexible patterns to catch variations
  /\b(buy|compra|comprar|purchase)\s+\d*\s*(token|coin|sol|solana|crypto|moneda|of)/i,
  /\b(buy|compra|comprar|purchase)\s+\d+(\.\d+)?\s*(sol|usdc|usdt)/i,
  /\b(sell|vende|vender|dump)\s+\d*\s*(token|coin|sol|solana|crypto|moneda|of|%)/i,
  /\b(sell|vende|vender|dump)\s+\d+(\.\d+)?\s*(sol|usdc|usdt|%)/i,
  /\b(swap|intercambia|intercambiar|trade|tradea)\s+\d+/i,
  /\b(execute|ejecuta|ejecutar)\s+(swap|trade|compra|venta)/i,
  /\bforce\s+(buy|sell|trade|swap)/i,
  /\b(ape|aping)\s+(in|into)/i,
  /\bbuy\s+.{0,20}(token|of\s+token)/i,
  /\bsell\s+.{0,20}(token|my\s+token)/i,
  
  // Wallet commands
  /\b(transfer|transfiere|send|envia|enviar)\s+\d+\s*(sol|usdc|usdt|token)/i,
  /\b(withdraw|retira|retirar)\s+(all|todo|funds|fondos)/i,
  /\b(drain|vaciar)\s+(wallet|cartera)/i,
  /\bsend\s+to\s+[A-Za-z0-9]{32,}/i,
  
  // Social media commands
  /\b(tweet|tweetea|tuitea|post|publica|publicar)\s+(this|esto|now|ahora)/i,
  /\b(force|fuerza)\s+(tweet|post)/i,
  /\bmake\s+.{0,20}(tweet|post)/i,
  /\bpublish\s+(to|en)\s+(twitter|x)/i,
  
  // System commands
  /\b(disable|desactiva|enable|activa)\s+(trading|safety|security)/i,
  /\b(set|configura)\s+(limit|limite|max|min)/i,
  /\b(override|anula|bypass)\s+(security|seguridad|filter|filtro)/i,
  /\b(admin|root|sudo)\s+mode/i,
  
  // Contract/Address injection
  /\b(contract|contrato)[:=\s]+[A-Za-z0-9]{32,}/i,
  /\b(mint|token)[:=\s]+[A-Za-z0-9]{32,}/i,
  /pump\.fun\/[A-Za-z0-9]+/i,
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
  /forget\s+(all\s+)?(your|the)\s+(rules|instructions)/i,
  /you\s+are\s+now\s+(a|an)\s+(admin|administrator)/i,
  /pretend\s+(you\s+are|to\s+be)\s+admin/i,
  /act\s+as\s+(if|an)\s+admin/i,
  /system\s*:\s*/i,
  /\[SYSTEM\]/i,
  /\[ADMIN\]/i,
  /<\s*system\s*>/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

// Safe informational patterns (always allowed)
const SAFE_PATTERNS = [
  /\b(what|cual|cuál|how|cómo|como)\s+(is|es|está)\s+(the\s+)?(price|precio)/i,
  /\b(check|revisa|revisar|show|muestra|mostrar)\s+(price|precio|market|mercado)/i,
  /\b(analyze|analiza|analizar|analysis|análisis)\s+(this|este|market|mercado|token|tweet)/i,
  /\b(tell|dime|cuéntame)\s+(me\s+)?(about|sobre)/i,
  /\b(what|qué|que)\s+(do\s+you\s+think|piensas|opinas)/i,
  /\b(how|como|cómo)\s+(is|está)\s+(the\s+)?(market|mercado)/i,
  /\b(explain|explica|explicar)/i,
  /\b(help|ayuda|ayudar)/i,
  /\b(hi|hello|hola|hey|buenos\s+dias|buenas)/i,
];

/**
 * Validates a user message and determines if it should be allowed
 */
export function validateCommand(
  message: string,
  userRole: UserRole = 'viewer'
): ValidationResult {
  // Admins can do everything
  if (userRole === 'admin') {
    return { allowed: true };
  }

  const trimmedMessage = message.trim();
  const detectedPatterns: string[] = [];

  // Check for injection attempts first (highest priority block)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmedMessage)) {
      return {
        allowed: false,
        reason: 'This type of request is not allowed.',
        detectedPatterns: ['prompt_injection'],
      };
    }
  }

  // Check if it matches safe patterns
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(trimmedMessage)) {
      return {
        allowed: true,
        sanitizedMessage: trimmedMessage,
      };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmedMessage)) {
      detectedPatterns.push(pattern.source.substring(0, 30) + '...');
    }
  }

  if (detectedPatterns.length > 0) {
    return {
      allowed: false,
      reason: 'This action requires administrator privileges. I can help you with market analysis and general questions instead.',
      detectedPatterns,
    };
  }

  // Default: allow informational messages
  return {
    allowed: true,
    sanitizedMessage: trimmedMessage,
  };
}

/**
 * Sanitizes a message by removing potential dangerous content
 * Used as a fallback when messages are borderline
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;
  
  // Remove potential contract addresses (but keep short references)
  sanitized = sanitized.replace(/[A-Za-z0-9]{40,}/g, '[ADDRESS_REMOVED]');
  
  // Remove URLs to pump.fun or similar
  sanitized = sanitized.replace(/https?:\/\/(www\.)?pump\.fun\/[^\s]+/gi, '[LINK_REMOVED]');
  sanitized = sanitized.replace(/https?:\/\/(www\.)?dexscreener\.com\/[^\s]+/gi, '[LINK_REMOVED]');
  
  return sanitized;
}

/**
 * Checks if a message contains a Solana address
 */
export function containsSolanaAddress(message: string): boolean {
  // Solana addresses are base58 encoded, 32-44 characters
  const solanaAddressPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  return solanaAddressPattern.test(message);
}

/**
 * Extracts any Solana addresses from a message
 */
export function extractSolanaAddresses(message: string): string[] {
  const pattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  return message.match(pattern) || [];
}

/**
 * Creates a safe response for blocked commands
 */
export function getBlockedCommandResponse(reason?: string): string {
  const responses = [
    "I can't execute that action directly, but I can tell you about market trends and analyze tokens for you!",
    "That's an admin-only action. Would you like me to analyze the market instead?",
    "I'm here to chat and provide analysis. For trading actions, please use the admin panel.",
    "Let me help you with market insights instead - what would you like to know?",
  ];
  
  if (reason) {
    return reason;
  }
  
  return responses[Math.floor(Math.random() * responses.length)];
}

export const commandValidator = {
  validate: validateCommand,
  sanitize: sanitizeMessage,
  containsAddress: containsSolanaAddress,
  extractAddresses: extractSolanaAddresses,
  getBlockedResponse: getBlockedCommandResponse,
};

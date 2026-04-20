/**
 * BNB Chain Transaction Validator
 *
 * Validates EVM transactions for BNB Chain to ensure only authorized
 * contracts and operations are executed by the autonomous agent.
 *
 * Hardcoded addresses here (WBNB, PancakeSwap router, Four.meme
 * TokenManager2) are PUBLIC on-chain contracts — safe to commit, but tied
 * to our allow-list. If you fork, review docs/PUBLIC_CONTRACTS.md to see
 * which ones to keep and which to replace with your own.
 */

export interface AllowedContract {
  address: string;
  name: string;
  description: string;
  required: boolean;
}

export interface ValidationResult {
  valid: boolean;
  contractsUsed: string[];
  blockedContracts: string[];
  warnings: string[];
  details: string;
}

const BSC_CHAIN_ID = 56;

const REQUIRED_CONTRACTS: AllowedContract[] = [
  {
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    name: 'WBNB',
    description: 'Wrapped BNB token contract',
    required: true,
  },
];

const DEFAULT_ALLOWED_CONTRACTS: AllowedContract[] = [
  {
    address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    name: 'PancakeSwap Router V2',
    description: 'PancakeSwap DEX router for token swaps',
    required: false,
  },
  {
    address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
    name: 'PancakeSwap Router V3',
    description: 'PancakeSwap V3 smart router',
    required: false,
  },
  {
    address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
    name: 'four.meme',
    description: 'four.meme bonding curve launch platform',
    required: false,
  },
];

const STORAGE_KEY = 'niya_allowed_contracts';

class TransactionValidator {
  private allowedContracts: Map<string, AllowedContract> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    [...REQUIRED_CONTRACTS, ...DEFAULT_ALLOWED_CONTRACTS].forEach(contract => {
      this.allowedContracts.set(contract.address.toLowerCase(), contract);
    });
    this.initialized = true;
  }

  loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const customContracts: AllowedContract[] = JSON.parse(stored);
        customContracts.forEach(contract => {
          if (!this.isRequiredContract(contract.address)) {
            this.allowedContracts.set(contract.address.toLowerCase(), contract);
          }
        });
      }
    } catch (e) {
      console.error('[TransactionValidator] Failed to load custom contracts:', e);
    }
  }

  saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const customContracts = Array.from(this.allowedContracts.values())
        .filter(c => !c.required);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customContracts));
    } catch (e) {
      console.error('[TransactionValidator] Failed to save custom contracts:', e);
    }
  }

  private isRequiredContract(address: string): boolean {
    return REQUIRED_CONTRACTS.some(c => c.address.toLowerCase() === address.toLowerCase());
  }

  private isValidEVMAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  addContract(address: string, name: string, description: string = ''): boolean {
    if (!this.isValidEVMAddress(address)) {
      console.error('[TransactionValidator] Invalid contract address:', address);
      return false;
    }

    const normalizedAddress = address.toLowerCase();
    if (this.allowedContracts.has(normalizedAddress)) {
      console.warn('[TransactionValidator] Contract already in allowlist:', address);
      return false;
    }

    this.allowedContracts.set(normalizedAddress, {
      address: normalizedAddress,
      name,
      description,
      required: false,
    });
    
    this.saveToStorage();
    console.log('[TransactionValidator] Added contract to allowlist:', name, address);
    return true;
  }

  removeContract(address: string): boolean {
    const normalizedAddress = address.toLowerCase();
    
    if (this.isRequiredContract(normalizedAddress)) {
      console.error('[TransactionValidator] Cannot remove required contract:', address);
      return false;
    }

    if (!this.allowedContracts.has(normalizedAddress)) {
      console.warn('[TransactionValidator] Contract not in allowlist:', address);
      return false;
    }

    this.allowedContracts.delete(normalizedAddress);
    this.saveToStorage();
    console.log('[TransactionValidator] Removed contract from allowlist:', address);
    return true;
  }

  getAllowedContracts(): AllowedContract[] {
    return Array.from(this.allowedContracts.values());
  }

  getCustomContracts(): AllowedContract[] {
    return Array.from(this.allowedContracts.values()).filter(c => !c.required);
  }

  isAllowed(address: string): boolean {
    return this.allowedContracts.has(address.toLowerCase());
  }

  validateTransaction(to: string, chainId: number): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      contractsUsed: [],
      blockedContracts: [],
      warnings: [],
      details: '',
    };

    if (chainId !== BSC_CHAIN_ID) {
      result.valid = false;
      result.details = `BLOCKED: Wrong chain. Expected BNB Chain (${BSC_CHAIN_ID}), got ${chainId}`;
      return result;
    }

    if (!to) {
      result.valid = false;
      result.details = 'BLOCKED: Contract creation transactions are not allowed';
      return result;
    }

    if (!this.isValidEVMAddress(to)) {
      result.valid = false;
      result.details = 'BLOCKED: Invalid destination address format';
      return result;
    }

    const normalizedTo = to.toLowerCase();
    result.contractsUsed = [normalizedTo];

    if (!this.isAllowed(normalizedTo)) {
      result.blockedContracts.push(to);
      result.valid = false;
      result.details = `BLOCKED: Transaction to unauthorized contract: ${to}`;
    } else {
      const contract = this.allowedContracts.get(normalizedTo);
      result.details = `Transaction validated. Target: ${contract?.name || to}`;
    }

    return result;
  }

  validateAndLog(to: string, chainId: number, context: string = 'Unknown'): ValidationResult {
    const result = this.validateTransaction(to, chainId);
    
    if (result.valid) {
      console.log(`[TransactionValidator] [${context}] APPROVED:`, result.details);
      if (result.warnings.length > 0) {
        console.warn(`[TransactionValidator] [${context}] Warnings:`, result.warnings);
      }
    } else {
      console.error(`[TransactionValidator] [${context}] BLOCKED:`, result.details);
      console.error(`[TransactionValidator] [${context}] Blocked contracts:`, result.blockedContracts);
    }
    
    return result;
  }
}

export const transactionValidator = new TransactionValidator();

export function initializeTransactionValidator(): void {
  transactionValidator.loadFromStorage();
  console.log('[TransactionValidator] Initialized with', transactionValidator.getAllowedContracts().length, 'allowed contracts');
}

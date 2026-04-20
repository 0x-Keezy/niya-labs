export interface AIProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  defaultModel: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'grok',
    name: 'Grok (xAI)',
    apiUrl: 'https://api.x.ai/v1',
    apiKeyEnvVar: 'NEXT_PUBLIC_XAI_API_KEY',
    models: ['grok-3-latest', 'grok-2-latest', 'grok-2-vision-latest'],
    defaultModel: 'grok-3-latest',
    supportsStreaming: true,
    supportsVision: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'NEXT_PUBLIC_OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    supportsStreaming: true,
    supportsVision: true
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    apiUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'NEXT_PUBLIC_ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
    defaultModel: 'claude-3-5-sonnet-latest',
    supportsStreaming: true,
    supportsVision: true
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    apiUrl: 'http://localhost:11434/v1',
    apiKeyEnvVar: '',
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'qwen2.5'],
    defaultModel: 'llama3.2',
    supportsStreaming: true,
    supportsVision: false
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    apiKeyEnvVar: 'NEXT_PUBLIC_DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    supportsStreaming: true,
    supportsVision: false
  },
  {
    id: 'groq',
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'NEXT_PUBLIC_GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    supportsStreaming: true,
    supportsVision: false
  }
];

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function getProviderConfig(providerId: string): { apiUrl: string; model: string; apiKey: string } | null {
  const provider = getProviderById(providerId);
  if (!provider) return null;
  
  const apiKey = provider.apiKeyEnvVar 
    ? (typeof window !== 'undefined' 
        ? localStorage.getItem(`provider_${providerId}_apiKey`) || '' 
        : '')
    : '';
  
  const model = typeof window !== 'undefined'
    ? localStorage.getItem(`provider_${providerId}_model`) || provider.defaultModel
    : provider.defaultModel;
  
  return {
    apiUrl: provider.apiUrl,
    model,
    apiKey
  };
}

export function saveProviderConfig(providerId: string, apiKey: string, model?: string): void {
  if (typeof window === 'undefined') return;
  
  const provider = getProviderById(providerId);
  if (!provider) return;
  
  if (apiKey) {
    localStorage.setItem(`provider_${providerId}_apiKey`, apiKey);
  }
  if (model) {
    localStorage.setItem(`provider_${providerId}_model`, model);
  }
  localStorage.setItem('activeProviderId', providerId);
}

export function getActiveProviderId(): string {
  if (typeof window === 'undefined') return 'grok';
  return localStorage.getItem('activeProviderId') || 'grok';
}

export function setActiveProviderId(providerId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('activeProviderId', providerId);
}

export default {
  providers: AI_PROVIDERS,
  getProviderById,
  getProviderConfig,
  saveProviderConfig,
  getActiveProviderId,
  setActiveProviderId
};

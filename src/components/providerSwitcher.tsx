import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDownIcon, CheckIcon, KeyIcon } from '@heroicons/react/24/outline';
import { AI_PROVIDERS, getActiveProviderId, setActiveProviderId, saveProviderConfig, getProviderConfig, type AIProvider } from '@/features/stores/providerStore';

interface ProviderSwitcherProps {
  onProviderChange?: (providerId: string) => void;
  className?: string;
}

export function ProviderSwitcher({ onProviderChange, className }: ProviderSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState('grok');
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    setActiveId(getActiveProviderId());
  }, []);

  const activeProvider = AI_PROVIDERS.find(p => p.id === activeId) || AI_PROVIDERS[0];

  const handleSelectProvider = (provider: AIProvider) => {
    const config = getProviderConfig(provider.id);
    if (provider.apiKeyEnvVar && (!config?.apiKey)) {
      setShowApiKeyInput(provider.id);
      setSelectedModel(provider.defaultModel);
    } else {
      setActiveId(provider.id);
      setActiveProviderId(provider.id);
      onProviderChange?.(provider.id);
      setIsOpen(false);
    }
  };

  const handleSaveApiKey = () => {
    if (showApiKeyInput) {
      saveProviderConfig(showApiKeyInput, apiKey, selectedModel);
      setActiveId(showApiKeyInput);
      setActiveProviderId(showApiKeyInput);
      onProviderChange?.(showApiKeyInput);
      setShowApiKeyInput(null);
      setApiKey('');
      setIsOpen(false);
    }
  };

  return (
    <div className={clsx("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center justify-between gap-2 px-4 py-3",
          "bg-white/10 hover:bg-white/20 rounded-lg transition-colors",
          "border border-white/20"
        )}
        data-testid="button-provider-switcher"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
            {activeProvider.name.charAt(0)}
          </div>
          <div className="text-left">
            <div className="text-white text-sm font-medium">{activeProvider.name}</div>
            <div className="text-white/50 text-xs">{activeProvider.defaultModel}</div>
          </div>
        </div>
        <ChevronDownIcon className={clsx("w-4 h-4 text-white/50 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl rounded-lg border border-white/20 overflow-hidden z-50">
          {showApiKeyInput ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyIcon className="w-5 h-5 text-cyan-400" />
                <span className="text-white text-sm">Enter API Key for {AI_PROVIDERS.find(p => p.id === showApiKeyInput)?.name}</span>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-400"
                data-testid="input-api-key"
              />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400"
                data-testid="select-model"
              >
                {AI_PROVIDERS.find(p => p.id === showApiKeyInput)?.models.map(model => (
                  <option key={model} value={model} className="bg-gray-900">{model}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowApiKeyInput(null); setApiKey(''); }}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey}
                  className="flex-1 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-white text-sm transition-colors"
                  data-testid="button-save-api-key"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="py-1">
              {AI_PROVIDERS.map(provider => {
                const isActive = provider.id === activeId;
                const config = getProviderConfig(provider.id);
                const hasKey = !provider.apiKeyEnvVar || config?.apiKey;
                
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSelectProvider(provider)}
                    className={clsx(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors",
                      isActive ? "bg-cyan-500/20" : "hover:bg-white/10"
                    )}
                    data-testid={`button-provider-${provider.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold",
                        isActive ? "bg-gradient-to-br from-cyan-400 to-blue-500" : "bg-white/20"
                      )}>
                        {provider.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="text-white text-sm">{provider.name}</div>
                        <div className="text-white/50 text-xs flex items-center gap-1">
                          {provider.defaultModel}
                          {!hasKey && <span className="text-yellow-400 ml-1">(needs API key)</span>}
                        </div>
                      </div>
                    </div>
                    {isActive && <CheckIcon className="w-4 h-4 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProviderSwitcher;

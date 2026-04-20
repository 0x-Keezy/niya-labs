import { useState, useEffect, useCallback } from 'react';
import { Lock, ExternalLink } from 'lucide-react';

const BSC_CHAIN_ID = '0x38';
const BSC_CHAIN_CONFIG = {
  chainId: BSC_CHAIN_ID,
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

interface BNBWalletConnectProps {
  onConnected?: (address: string) => void;
  onDisconnected?: () => void;
  children?: React.ReactNode;
}

type WalletProvider = {
  name: string;
  provider: any;
};

function detectWalletProviders(): WalletProvider[] {
  if (typeof window === 'undefined') return [];
  const providers: WalletProvider[] = [];
  const win = window as any;
  
  if (win.phantom?.ethereum) {
    providers.push({ name: 'Phantom', provider: win.phantom.ethereum });
  }
  if (win.trustwallet?.ethereum) {
    providers.push({ name: 'Trust Wallet', provider: win.trustwallet.ethereum });
  }
  if (win.coinbaseWalletExtension) {
    providers.push({ name: 'Coinbase', provider: win.coinbaseWalletExtension });
  }
  if (win.okxwallet) {
    providers.push({ name: 'OKX Wallet', provider: win.okxwallet });
  }
  if (win.rabby) {
    providers.push({ name: 'Rabby', provider: win.rabby });
  }
  if (win.ethereum && !providers.some(p => p.provider === win.ethereum)) {
    const isMetaMask = win.ethereum.isMetaMask;
    providers.push({ name: isMetaMask ? 'MetaMask' : 'Browser Wallet', provider: win.ethereum });
  }
  
  return providers;
}

export function BNBWalletConnect({ onConnected, onDisconnected, children }: BNBWalletConnectProps) {
  const [address, setAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('');
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const getEthereum = useCallback(() => {
    if (selectedProvider) return selectedProvider;
    const providers = detectWalletProviders();
    return providers.length > 0 ? providers[0].provider : null;
  }, [selectedProvider]);
  
  useEffect(() => {
    const wallets = detectWalletProviders();
    setAvailableWallets(wallets);
  }, []);

  const checkNetwork = useCallback((chainId: string) => {
    const normalizedChainId = chainId.toLowerCase();
    const isBSC = normalizedChainId === BSC_CHAIN_ID.toLowerCase();
    setWrongNetwork(!isBSC);
    setCurrentChainId(chainId);
    return isBSC;
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const checkConnection = async () => {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          onConnected?.(accounts[0]);
          
          const chainId = await ethereum.request({ method: 'eth_chainId' });
          checkNetwork(chainId);
        }
      } catch (err) {
        console.error('Failed to check connection:', err);
      }
    };

    checkConnection();

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress('');
        setIsConnected(false);
        onDisconnected?.();
      } else {
        setAddress(accounts[0]);
        setIsConnected(true);
        onConnected?.(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      checkNetwork(chainId);
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [getEthereum, checkNetwork, onConnected, onDisconnected]);

  const handleConnect = async (wallet?: WalletProvider) => {
    const provider = wallet?.provider || getEthereum();
    if (!provider) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    
    if (wallet) {
      setSelectedProvider(wallet.provider);
      setWalletName(wallet.name);
    }

    setIsPending(true);
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        if (wallet) setWalletName(wallet.name);
        onConnected?.(accounts[0]);
        
        const chainId = await provider.request({ method: 'eth_chainId' });
        if (!checkNetwork(chainId)) {
          await handleSwitchNetwork();
        }
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsPending(false);
    }
  };

  const handleDisconnect = () => {
    setAddress('');
    setIsConnected(false);
    onDisconnected?.();
  };

  const handleSwitchNetwork = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BSC_CHAIN_CONFIG],
          });
        } catch (addError) {
          console.error('Failed to add BNB Chain:', addError);
        }
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <p className="text-gray-700 text-sm font-bold mb-1">Connect wallet to chat</p>
        <p className="text-gray-400 text-xs mb-4 flex items-center gap-1">
          Chat with <Lock className="w-3 h-3" /> Niya (BNB Chain)
        </p>
        {availableWallets.length > 1 ? (
          <div className="space-y-2">
            {availableWallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet)}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F5D89A] hover:bg-[#E8D4A8] text-[#6B5344] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                data-testid={`button-connect-${wallet.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-[#6B5344] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                {wallet.name}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => handleConnect()}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F5D89A] hover:bg-[#E8D4A8] text-[#6B5344] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            data-testid="button-connect-wallet"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-[#6B5344] border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Connect EVM Wallet
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-400 text-sm">
          {walletName && <span className="text-gray-500">{walletName}: </span>}
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
        <button
          onClick={handleDisconnect}
          className="text-red-500/70 hover:text-red-500 text-xs"
          data-testid="button-disconnect-wallet"
        >
          Disconnect
        </button>
      </div>
      {wrongNetwork && (
        <div className="mb-3 p-2 bg-orange-100 border border-orange-300 rounded-lg">
          <p className="text-orange-800 text-xs mb-2">Wrong network! Please switch to BNB Chain.</p>
          <button
            onClick={handleSwitchNetwork}
            className="w-full text-xs bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg transition-colors"
            data-testid="button-switch-network"
          >
            Switch to BNB Chain
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

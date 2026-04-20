import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Zap, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface RankingToken {
  symbol: string;
  priceChangePercent: number;
  price: number;
  type?: 'gainer' | 'loser' | 'volume';
}

interface MarketRankings {
  topGainers: RankingToken[];
  topLosers: RankingToken[];
  topVolume: RankingToken[];
  timestamp: number;
}

interface MemeToken {
  symbol: string;
  priceChangePercent: number;
  volume24h: number;
  timestamp: number;
}

type TabType = 'gainers' | 'losers' | 'meme';

const BINANCE_BASE = 'https://api.binance.com';

const KNOWN_MEME_BASES = [
  'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'NEIRO',
  'TURBO', 'BOME', 'POPCAT', 'MOG', 'BRETT', 'PNUT', 'GOAT', 'MOODENG', 'ACT',
];

export function BinanceIntelligenceWidget() {
  const [rankings, setRankings] = useState<MarketRankings | null>(null);
  const [memeTokens, setMemeTokens] = useState<MemeToken[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('gainers');
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const tickers: any[] = await response.json();

      const usdtPairs = tickers.filter(
        (t) =>
          t.symbol.endsWith('USDT') &&
          !t.symbol.includes('DOWN') &&
          !t.symbol.includes('UP') &&
          !t.symbol.includes('BULL') &&
          !t.symbol.includes('BEAR') &&
          parseFloat(t.quoteVolume) > 1_000_000
      );

      const toRanking = (t: any, type: RankingToken['type']): RankingToken => ({
        symbol: t.symbol.replace('USDT', ''),
        priceChangePercent: parseFloat(t.priceChangePercent),
        price: parseFloat(t.lastPrice),
        type,
      });

      const gainers = [...usdtPairs]
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, 6)
        .map((t) => toRanking(t, 'gainer'));

      const losers = [...usdtPairs]
        .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
        .slice(0, 6)
        .map((t) => toRanking(t, 'loser'));

      setRankings({ topGainers: gainers, topLosers: losers, topVolume: [], timestamp: Date.now() });

      const memes = tickers
        .filter((t) => {
          const base = t.symbol.replace('USDT', '');
          return t.symbol.endsWith('USDT') && KNOWN_MEME_BASES.some((m) => base.startsWith(m));
        })
        .map((t): MemeToken => ({
          symbol: t.symbol.replace('USDT', ''),
          priceChangePercent: parseFloat(t.priceChangePercent),
          volume24h: parseFloat(t.quoteVolume),
          timestamp: Date.now(),
        }))
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 6);

      setMemeTokens(memes);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      console.error('[BinanceWidget] Fetch error:', e);
      setError('Could not load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatChange = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const formatPrice = (val: number) => {
    if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (val >= 1) return `$${val.toFixed(2)}`;
    return `$${val.toFixed(5)}`;
  };

  const getTokenList = (): (RankingToken | MemeToken)[] => {
    if (!rankings) return [];
    if (activeTab === 'gainers') return rankings.topGainers;
    if (activeTab === 'losers') return rankings.topLosers;
    return memeTokens;
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'gainers', label: 'Gainers', icon: <TrendingUp size={10} /> },
    { id: 'losers', label: 'Losers', icon: <TrendingDown size={10} /> },
    { id: 'meme', label: 'Meme', icon: <Zap size={10} /> },
  ];

  return (
    <div
      className="min-w-[200px]"
      data-testid="binance-intelligence-widget"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base text-gray-500 font-bold">MARKET</span>
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Refresh"
            data-testid="refresh-binance-widget"
          >
            <RefreshCw size={11} className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Toggle"
            data-testid="toggle-binance-widget"
          >
            {isExpanded
              ? <ChevronUp size={12} className="text-gray-400" />
              : <ChevronDown size={12} className="text-gray-400" />
            }
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`binance-tab-${tab.id}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: activeTab === tab.id ? '#000' : '#f3f4f6',
                  color: activeTab === tab.id ? '#fff' : '#6b7280',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-5 rounded bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-gray-400 py-1">{error}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {getTokenList().map((token, idx) => {
                const change = token.priceChangePercent;
                const isGreen = change >= 0;
                const price = 'price' in token ? (token as RankingToken).price : undefined;

                return (
                  <div
                    key={`${token.symbol}-${idx}`}
                    className="flex items-center justify-between py-0.5"
                    data-testid={`binance-token-${token.symbol}-${idx}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isGreen
                        ? <TrendingUp size={10} className="text-green-500 flex-shrink-0" />
                        : <TrendingDown size={10} className="text-red-500 flex-shrink-0" />
                      }
                      <span className="text-xs font-bold text-black">{token.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {price !== undefined && (
                        <span className="text-xs text-gray-400 font-mono">{formatPrice(price)}</span>
                      )}
                      <span
                        className={`text-xs font-bold ${isGreen ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {formatChange(change)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-400 pt-1">Binance Agent Skills</p>
        </div>
      )}
    </div>
  );
}

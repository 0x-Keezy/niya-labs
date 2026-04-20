import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Rocket, CheckCircle, XCircle, Loader2, ExternalLink, Copy } from 'lucide-react';
import { emotionStore } from '@/features/emotions/emotionStore';
import { Mood } from '@/features/emotions/types';

const expressions = [
  { name: 'default', label: 'Default' },
  { name: 'angry', label: 'Angry' },
  { name: 'blush', label: 'Blush' },
  { name: 'crying', label: 'Crying' },
  { name: 'dizzy', label: 'Dizzy' },
  { name: 'love', label: 'Love' },
  { name: 'stars', label: 'Stars' },
  { name: 'sweat', label: 'Sweat' },
  { name: 'girlish', label: 'Girlish' },
  { name: 'halo', label: 'Halo' },
  { name: 'shrink', label: 'Shrink' },
];

const moods: { mood: Mood; label: string }[] = [
  { mood: 'calm', label: 'Calm' },
  { mood: 'happy', label: 'Happy' },
  { mood: 'excited', label: 'Excited' },
  { mood: 'smug', label: 'Smug' },
  { mood: 'annoyed', label: 'Annoyed' },
  { mood: 'angry', label: 'Angry' },
  { mood: 'sad', label: 'Sad' },
  { mood: 'surprised', label: 'Surprised' },
  { mood: 'focused', label: 'Focused' },
];

interface AdminExpressionPanelProps {
  onClose: () => void;
}

interface SystemConfig {
  walletAddress?: string;
  hasPrivateKey?: boolean;
  privateKeyWarning?: string | null;
  contractAddresses?: { tokenManager2: string; agentIdentifier: string };
}

interface AgentStatus {
  isAgent: boolean;
  nftCount?: number;
  error?: string;
}

interface LaunchResult {
  isAgent: boolean;
  agentNftCount?: number;
  imgUrl?: string;
  createArg?: string;
  fourMemeSignature?: string;
  txData?: { to: string; data: string; value: string; description: string };
  instructions?: string[];
  error?: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${ok ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 hover:bg-white/10 rounded transition-colors" title="Copy">
      <Copy className="w-3 h-3 text-white/60" />
      {copied && <span className="sr-only">Copied!</span>}
    </button>
  );
}

export function AdminExpressionPanel({ onClose }: AdminExpressionPanelProps) {
  const [selectedExpression, setSelectedExpression] = useState('default');
  const [selectedMood, setSelectedMood] = useState<Mood>('calm');
  const [intensity, setIntensity] = useState(70);
  const [showMoods, setShowMoods] = useState(false);
  const [isLive2DReady, setIsLive2DReady] = useState(false);

  const [showLaunch, setShowLaunch] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [dailyVolumeBnb, setDailyVolumeBnb] = useState(100);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerResult, setRegisterResult] = useState<{ txHash?: string; agentId?: number; error?: string } | null>(null);

  const adminSecret = typeof window !== 'undefined' ? localStorage.getItem('niya_admin_secret') || '' : '';

  useEffect(() => {
    const checkReady = () => {
      const controls = (window as any).live2dControls;
      const ready = controls?.isReady === true;
      setIsLive2DReady(ready);
    };
    checkReady();
    const handleReady = () => checkReady();
    window.addEventListener('live2d-ready', handleReady);
    const pollInterval = setInterval(() => {
      if ((window as any).live2dControls?.isReady) {
        checkReady();
        clearInterval(pollInterval);
      }
    }, 500);
    return () => {
      window.removeEventListener('live2d-ready', handleReady);
      clearInterval(pollInterval);
    };
  }, []);

  const fetchLaunchConfig = async () => {
    setLoadingConfig(true);
    try {
      const secret = localStorage.getItem('niya_admin_secret') || '';
      const res = await fetch('/api/admin/four-meme-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'config' }),
      });
      const data = await res.json();
      if (data.success) setSystemConfig(data.system);
    } catch {
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchAgentStatus = async () => {
    setLoadingAgent(true);
    try {
      const secret = localStorage.getItem('niya_admin_secret') || '';
      const res = await fetch('/api/admin/four-meme-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'verify-agent' }),
      });
      const data = await res.json();
      setAgentStatus({ isAgent: data.isAgent, nftCount: data.nftCount, error: data.error });
    } catch {
    } finally {
      setLoadingAgent(false);
    }
  };

  useEffect(() => {
    if (showLaunch) {
      fetchLaunchConfig();
      fetchAgentStatus();
    }
  }, [showLaunch]);

  const triggerExpression = (expressionName: string) => {
    const controls = (window as any).live2dControls;
    if (controls?.isReady) {
      controls.triggerExpression(expressionName);
      setSelectedExpression(expressionName);
    }
  };

  const triggerMood = (mood: Mood) => {
    emotionStore.setEmotion(mood, intensity / 100, 'Admin preview', 'manual');
    setSelectedMood(mood);
  };

  const resetToDefault = () => {
    const controls = (window as any).live2dControls;
    if (controls?.isReady) controls.triggerExpression('default');
    emotionStore.reset();
    setSelectedExpression('default');
    setSelectedMood('calm');
  };

  const prepareLaunch = async () => {
    setLaunchLoading(true);
    setLaunchResult(null);
    try {
      const secret = localStorage.getItem('niya_admin_secret') || '';
      const res = await fetch('/api/admin/four-meme-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'prepare' }),
      });
      const data = await res.json();
      setLaunchResult(data);
    } catch (e: any) {
      setLaunchResult({ isAgent: false, error: e.message || 'Request failed' });
    } finally {
      setLaunchLoading(false);
    }
  };

  const registerAgent = async () => {
    setRegisterLoading(true);
    setRegisterResult(null);
    try {
      const secret = localStorage.getItem('niya_admin_secret') || '';
      const res = await fetch('/api/admin/four-meme-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action: 'register-8004' }),
      });
      const data = await res.json();
      if (data.success) {
        setRegisterResult({ txHash: data.txHash, agentId: data.agentId });
        await fetchAgentStatus();
      } else {
        setRegisterResult({ error: data.error || 'Registration failed' });
      }
    } catch (e: any) {
      setRegisterResult({ error: e.message || 'Request failed' });
    } finally {
      setRegisterLoading(false);
    }
  };

  const estimatedDailyBnb = +(dailyVolumeBnb * 0.03 * 0.80).toFixed(4);
  const estimatedMonthlyBnb = +(estimatedDailyBnb * 30).toFixed(3);

  return (
    <div className="absolute top-16 left-4 z-30 bg-black/85 backdrop-blur-sm rounded-xl border border-[#C9A86C]/50 shadow-xl w-72 max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 bg-black/90 p-3 border-b border-[#C9A86C]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#F5D89A] font-bold text-sm">Admin Panel</span>
          <span
            className={`w-2 h-2 rounded-full ${isLive2DReady ? 'bg-green-500' : 'bg-red-500'}`}
            title={isLive2DReady ? 'Live2D Ready' : 'Live2D Not Ready'}
            data-testid="indicator-live2d-status"
          />
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors" data-testid="button-close-expression-panel">
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <div className="text-[#E8D4A8] text-xs font-medium mb-2">Expressions</div>
          <div className="grid grid-cols-3 gap-1.5">
            {expressions.map((exp) => (
              <button
                key={exp.name}
                onClick={() => triggerExpression(exp.name)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                  selectedExpression === exp.name
                    ? 'bg-[#F5D89A] text-[#6B5344]'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
                data-testid={`button-admin-expression-${exp.name}`}
              >
                {exp.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowMoods(!showMoods)}
          className="w-full flex items-center justify-between text-[#E8D4A8] text-xs font-medium py-2 border-t border-[#C9A86C]/20"
        >
          <span>Moods (Emotion System)</span>
          {showMoods ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showMoods && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs">Intensity:</span>
              <input
                type="range" min="10" max="100" value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="flex-1 h-1 accent-[#F5D89A]"
              />
              <span className="text-white/60 text-xs w-8">{intensity}%</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {moods.map((m) => (
                <button
                  key={m.mood}
                  onClick={() => triggerMood(m.mood)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    selectedMood === m.mood
                      ? 'bg-[#C9A86C] text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                  data-testid={`button-admin-mood-${m.mood}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={resetToDefault}
          className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded transition-colors border border-red-500/30"
          data-testid="button-admin-reset-expression"
        >
          Reset to Default
        </button>

        <button
          onClick={() => setShowLaunch(!showLaunch)}
          className="w-full flex items-center justify-between text-[#E8D4A8] text-xs font-medium py-2 border-t border-[#C9A86C]/20"
          data-testid="button-admin-toggle-launch"
        >
          <div className="flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5 text-[#F5D89A]" />
            <span>Token Launch (four.meme)</span>
          </div>
          {showLaunch ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showLaunch && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-white/50 text-xs font-medium uppercase tracking-wider">System Status</div>
              {loadingConfig || loadingAgent ? (
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <StatusBadge
                    ok={!!agentStatus?.isAgent}
                    label={agentStatus?.isAgent
                      ? `AI Agent Verified (${agentStatus.nftCount} NFTs)`
                      : agentStatus?.error
                        ? `Agent check failed: ${agentStatus.error.slice(0, 30)}`
                        : 'Not yet registered as AI Agent'}
                  />
                  <StatusBadge
                    ok={!!systemConfig?.hasPrivateKey}
                    label={systemConfig?.hasPrivateKey ? 'Private Key: Configured' : 'Private Key: Missing — add BNB_PRIVATE_KEY'}
                  />

                  {agentStatus && !agentStatus.isAgent && systemConfig?.hasPrivateKey && (
                    <div className="mt-2 space-y-2">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                        <p className="text-blue-300 text-xs font-medium mb-1">Step 1: Register AI Agent Identity</p>
                        <p className="text-blue-200/70 text-xs">Register Niya as an EIP-8004 AI Agent on BSC. Required before creating tokens.</p>
                      </div>
                      <button
                        onClick={registerAgent}
                        disabled={registerLoading}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-300 text-xs font-bold rounded-lg transition-colors border border-blue-500/40"
                        data-testid="button-register-8004"
                      >
                        {registerLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Registering... (may take 30s)</span>
                          </>
                        ) : (
                          <span>Register EIP-8004 AI Agent NFT</span>
                        )}
                      </button>
                      {registerResult && (
                        registerResult.error ? (
                          <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                            <p className="text-red-300 text-xs break-all">{registerResult.error}</p>
                          </div>
                        ) : (
                          <div className="bg-green-500/10 border border-green-500/30 rounded p-2 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-green-300 text-xs font-bold">Agent Registered!</span>
                            </div>
                            {registerResult.txHash && (
                              <div className="flex items-center gap-1">
                                <span className="text-white/40 text-xs font-mono truncate">{registerResult.txHash.slice(0, 16)}...</span>
                                <a href={`https://bscscan.com/tx/${registerResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#C9A86C] hover:text-[#F5D89A]">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                            {registerResult.agentId !== undefined && (
                              <p className="text-white/60 text-xs">Agent ID: #{registerResult.agentId}</p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {systemConfig?.walletAddress && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-white/40 text-xs font-mono truncate">{systemConfig.walletAddress.slice(0, 10)}...{systemConfig.walletAddress.slice(-6)}</span>
                      <a
                        href={`https://bscscan.com/address/${systemConfig.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#C9A86C] hover:text-[#F5D89A]"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-lg p-2.5 space-y-1.5">
              <div className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Token Configuration</div>
              {[
                ['Name', 'Niya Agent'],
                ['Ticker', 'NIYA'],
                ['Label', 'AI'],
                ['Total Supply', '1,000,000,000'],
                ['Tax Rate', '3% per trade'],
                ['→ To Niya Wallet', '80%'],
                ['→ To Liquidity', '20%'],
                ['AntiSniper Mode', 'Disabled'],
                ['Dev Buy', '0.7 BNB'],
                ['Bonding Curve', '24 BNB target'],
                ['Website', 'niyaagent.com'],
                ['Twitter', '@NiyaAgent'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{k}</span>
                  <span className="text-white/80 font-mono">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-white/5 rounded-lg p-2.5 space-y-2">
              <div className="text-white/50 text-xs font-medium uppercase tracking-wider">Fee Revenue Estimator</div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs w-24 flex-shrink-0">Daily Vol (BNB):</span>
                <input
                  type="range" min="10" max="10000" step="10" value={dailyVolumeBnb}
                  onChange={(e) => setDailyVolumeBnb(Number(e.target.value))}
                  className="flex-1 h-1 accent-[#F5D89A]"
                  data-testid="slider-daily-volume"
                />
                <span className="text-white/80 text-xs w-14 text-right font-mono">{dailyVolumeBnb} BNB</span>
              </div>
              <div className="flex justify-between text-xs border-t border-white/10 pt-2">
                <span className="text-white/50">Daily → Niya wallet</span>
                <span className="text-[#F5D89A] font-bold font-mono">{estimatedDailyBnb} BNB</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Monthly → Niya wallet</span>
                <span className="text-green-400 font-bold font-mono">{estimatedMonthlyBnb} BNB</span>
              </div>
              <div className="text-white/30 text-xs">Daily Vol × 3% fee × 80% to wallet</div>
            </div>

            {!systemConfig?.hasPrivateKey && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                <p className="text-yellow-300 text-xs font-medium mb-1">Action Required</p>
                <p className="text-yellow-200/70 text-xs">Add <code className="bg-black/30 px-1 rounded">BNB_PRIVATE_KEY</code> to Replit Secrets to enable token launch.</p>
              </div>
            )}

            <button
              onClick={prepareLaunch}
              disabled={launchLoading || !systemConfig?.hasPrivateKey}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#F0B90B]/20 hover:bg-[#F0B90B]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[#F0B90B] text-xs font-bold rounded-lg transition-colors border border-[#F0B90B]/40"
              data-testid="button-prepare-launch"
            >
              {launchLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing... (may take 30s)</span>
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Prepare Token Launch</span>
                </>
              )}
            </button>

            {launchResult && (
              <div className="space-y-2">
                {launchResult.error ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                    <p className="text-red-300 text-xs font-medium mb-1">Error</p>
                    <p className="text-red-200/70 text-xs break-all">{launchResult.error}</p>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-300 text-xs font-bold">Launch Prepared Successfully</span>
                    </div>

                    {launchResult.isAgent && (
                      <StatusBadge ok label="Wallet verified as AI Agent Creator" />
                    )}

                    {launchResult.imgUrl && (
                      <div className="text-xs">
                        <span className="text-white/50">Image URL: </span>
                        <a href={launchResult.imgUrl} target="_blank" rel="noopener noreferrer" className="text-[#C9A86C] hover:underline text-xs break-all">{launchResult.imgUrl.slice(0, 50)}...</a>
                      </div>
                    )}

                    {launchResult.createArg && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/50 text-xs">createArg (for on-chain tx)</span>
                          <CopyButton text={launchResult.createArg} />
                        </div>
                        <div className="bg-black/40 rounded p-1.5 text-white/60 text-xs font-mono break-all max-h-16 overflow-y-auto">{launchResult.createArg.slice(0, 80)}...</div>
                      </div>
                    )}

                    {launchResult.fourMemeSignature && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/50 text-xs">signature (four.meme)</span>
                          <CopyButton text={launchResult.fourMemeSignature} />
                        </div>
                        <div className="bg-black/40 rounded p-1.5 text-white/60 text-xs font-mono break-all max-h-16 overflow-y-auto">{launchResult.fourMemeSignature.slice(0, 80)}...</div>
                      </div>
                    )}

                    {launchResult.instructions && (
                      <div className="space-y-1 border-t border-green-500/20 pt-2">
                        <div className="text-white/50 text-xs font-medium">Next Steps:</div>
                        {launchResult.instructions.map((step, i) => (
                          <p key={i} className="text-white/60 text-xs leading-relaxed">{step}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

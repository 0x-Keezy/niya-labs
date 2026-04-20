import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, SparklesIcon, CpuChipIcon, GlobeAltIcon, HeartIcon } from '@heroicons/react/24/outline';
import { Tv, MessageCircle, Mic, Bot, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

interface AboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'about' | 'features' | 'tech' | 'lore';

export function AboutPanel({ isOpen, onClose }: AboutPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('about');

  const TABS: { id: TabId; label: string; icon: typeof SparklesIcon }[] = [
    { id: 'about', label: t('About Niya'), icon: SparklesIcon },
    { id: 'features', label: t('Features'), icon: CpuChipIcon },
    { id: 'tech', label: t('Tech'), icon: GlobeAltIcon },
    { id: 'lore', label: t('Lore'), icon: HeartIcon },
  ];

  const FEATURES = [
    { title: t('Live2D Avatar'), desc: t('live2d_desc'), Icon: Tv },
    { title: t('AI Chat'), desc: t('ai_chat_desc'), Icon: MessageCircle },
    { title: t('Voice Synthesis'), desc: t('voice_desc'), Icon: Mic },
    { title: t('Autonomous Operations'), desc: t('autonomous_desc'), Icon: Bot },
    { title: t('Market Commentary'), desc: t('market_desc'), Icon: TrendingUp },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90dvh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBjeD0iMjAiIGN5PSIyMCIgcj0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <HeartIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">NIYA</h2>
                <p className="text-white/80 text-sm">{t('Autonomous AI Companion')} • {t('Powered by DGrid')}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="btn-close-about"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200 bg-gray-50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-amber-600 border-b-2 border-amber-500 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[min(60dvh,520px)] overflow-y-auto">
          {activeTab === 'about' && (
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                {t('about_niya_text')}
              </p>
              <div className="bg-gradient-to-r from-amber-500/10 to-amber-400/10 rounded-xl p-4 border border-amber-500/20">
                <p className="text-amber-600 font-medium text-sm">
                  &quot;{t('niya_quote')}&quot;
                </p>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <feature.Icon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                    <p className="text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tech' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Live2D Cubism 5', type: t('Avatar') },
                  { name: 'PIXI.js 7', type: t('Rendering') },
                  { name: 'xAI Grok 3', type: t('LLM') },
                  { name: 'ElevenLabs', type: 'TTS' },
                  { name: 'ElizaOS', type: t('Agent') },
                  { name: 'Next.js 14', type: t('Framework') },
                  { name: 'DexScreener', type: t('DeFi') },
                  { name: 'Socket.IO', type: t('Realtime') },
                ].map((tech) => (
                  <div key={tech.name} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900 text-sm">{tech.name}</p>
                    <p className="text-xs text-amber-600">{tech.type}</p>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">Version 1.0.0 • February 2026</p>
              </div>
            </div>
          )}

          {activeTab === 'lore' && (
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                {t('lore_intro')}
              </p>
              <div className="bg-gradient-to-br from-amber-500/5 to-amber-400/10 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-amber-600">{t('Appearance')}</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• {t('appearance_list_1')}</li>
                  <li>• {t('appearance_list_2')}</li>
                  <li>• {t('appearance_list_3')}</li>
                  <li>• {t('appearance_list_4')}</li>
                  <li>• {t('appearance_list_5')}</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{t('Personality')}</h4>
                <p className="text-sm text-gray-700">
                  {t('personality_text')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <a 
            href="https://niyaagent.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:underline flex items-center gap-1"
          >
            niyaagent.com
            <GlobeAltIcon className="w-4 h-4" />
          </a>
          <a 
            href="https://x.com/NiyaAgent" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-amber-600 transition-colors"
          >
            @NiyaAgent
          </a>
        </div>
      </div>
    </div>
  );
}

export default AboutPanel;

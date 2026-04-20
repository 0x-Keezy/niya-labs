import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicPage, FormRow } from './common';
import { emotionStore } from '@/features/emotions/emotionStore';
import { Mood } from '@/features/emotions/types';
import { IconMoodSmile, IconMoodSad, IconMoodAngry, IconMoodCrazyHappy, IconMoodNervous, IconMoodConfuzed, IconCandy, IconDeviceGamepad2, IconSparkles } from '@tabler/icons-react';

const emotionExpressions = [
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
  { name: 'flying_heads', label: 'Mind Blown' },
  { name: 'flying_heads1', label: 'Mind Blown 2' },
  { name: 'forward_tilt', label: 'Leaning' },
];

const activityExpressions = [
  { name: 'eat_sugar', label: 'Eating Candy' },
  { name: 'play_games', label: 'Gaming' },
  { name: 'microphone', label: 'Singing' },
  { name: 'satchel', label: 'Carrying Bag' },
  { name: 'left_spoon', label: 'Holding Spoon' },
  { name: 'right_fork', label: 'Holding Fork' },
  { name: 'right_candy', label: 'Holding Candy' },
];

const appearanceExpressions = [
  { name: 'candy_ears', label: 'Candy Ears' },
  { name: 'braids_long', label: 'Long Braids' },
  { name: 'braids_left', label: 'Left Braid' },
  { name: 'braids_right', label: 'Right Braid' },
  { name: 'post_hair', label: 'Hair Up' },
  { name: 'bare_legs', label: 'Bare Legs' },
  { name: 'shorts', label: 'Shorts' },
  { name: 'stickers_legs', label: 'Leg Stickers' },
  { name: 'ears_disappear', label: 'Hide Ears' },
];

const specialExpressions = [
  { name: 'cancel_handheld', label: 'Remove Item' },
  { name: 'aura_levitating', label: 'Mystical Aura' },
  { name: 'black', label: 'Dark Mode' },
  { name: 'watermark', label: 'Watermark' },
];

const moods: { mood: Mood; label: string; icon: typeof IconMoodSmile }[] = [
  { mood: 'calm', label: 'Calm', icon: IconMoodSmile },
  { mood: 'happy', label: 'Happy', icon: IconMoodCrazyHappy },
  { mood: 'excited', label: 'Excited', icon: IconMoodCrazyHappy },
  { mood: 'smug', label: 'Smug', icon: IconMoodSmile },
  { mood: 'annoyed', label: 'Annoyed', icon: IconMoodNervous },
  { mood: 'angry', label: 'Angry', icon: IconMoodAngry },
  { mood: 'sad', label: 'Sad', icon: IconMoodSad },
  { mood: 'surprised', label: 'Surprised', icon: IconMoodConfuzed },
  { mood: 'focused', label: 'Focused', icon: IconMoodSmile },
];

type ExpressionTab = 'emotion' | 'activity' | 'appearance' | 'special';

export function ExpressionPreviewPage() {
  const { t } = useTranslation();
  const [selectedExpression, setSelectedExpression] = useState('default');
  const [selectedMood, setSelectedMood] = useState<Mood>('calm');
  const [intensity, setIntensity] = useState(70);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExpressionTab>('emotion');

  const triggerExpression = (expressionName: string) => {
    if (typeof window !== 'undefined' && window.live2dControls) {
      window.live2dControls.triggerExpression(expressionName);
      setSelectedExpression(expressionName);
      setLastTriggered(`Expression: ${expressionName}`);
    }
  };

  const triggerMood = (mood: Mood) => {
    emotionStore.setEmotion(mood, intensity / 100, 'Admin preview test', 'manual');
    setSelectedMood(mood);
    setLastTriggered(`Mood: ${mood} (${intensity}%)`);
  };

  const resetToDefault = () => {
    if (typeof window !== 'undefined' && window.live2dControls) {
      window.live2dControls.triggerExpression('default');
      window.live2dControls.triggerExpression('cancel_handheld');
    }
    emotionStore.reset();
    setSelectedExpression('default');
    setSelectedMood('calm');
    setLastTriggered('Reset to default');
  };

  const getCurrentExpressions = () => {
    switch (activeTab) {
      case 'emotion': return emotionExpressions;
      case 'activity': return activityExpressions;
      case 'appearance': return appearanceExpressions;
      case 'special': return specialExpressions;
      default: return emotionExpressions;
    }
  };

  const getTabIcon = (tab: ExpressionTab) => {
    switch (tab) {
      case 'emotion': return IconMoodSmile;
      case 'activity': return IconDeviceGamepad2;
      case 'appearance': return IconSparkles;
      case 'special': return IconCandy;
    }
  };

  return (
    <BasicPage
      title={t("Expression Preview")}
      description={t("Test and preview all 34 Live2D expressions organized by category.")}
    >
      <div className="space-y-6">
        {lastTriggered && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-sm">
            Last triggered: {lastTriggered}
          </div>
        )}

        <div>
          <h3 className="text-amber-400 font-medium mb-3">Expression Categories</h3>
          <div className="flex gap-2 mb-4">
            {(['emotion', 'activity', 'appearance', 'special'] as ExpressionTab[]).map((tab) => {
              const Icon = getTabIcon(tab);
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'
                  }`}
                  data-testid={`tab-expression-${tab}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          <p className="text-slate-400 text-xs mb-3">
            {activeTab === 'emotion' && 'Expressions that show emotions and reactions.'}
            {activeTab === 'activity' && 'Expressions for activities like eating, gaming, singing.'}
            {activeTab === 'appearance' && 'Change outfits, hairstyles, and accessories.'}
            {activeTab === 'special' && 'Special effects and utility expressions.'}
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {getCurrentExpressions().map((exp) => (
              <button
                key={exp.name}
                onClick={() => triggerExpression(exp.name)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedExpression === exp.name
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'
                }`}
                data-testid={`button-expression-${exp.name}`}
              >
                {exp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-amber-400 font-medium mb-3">Mood States (Emotion System)</h3>
          <p className="text-slate-400 text-xs mb-3">Test the emotion system by triggering different mood states. These automatically map to expressions.</p>
          
          <FormRow label={t("Intensity")}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="100"
                value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-slate-300 text-sm w-12">{intensity}%</span>
            </div>
          </FormRow>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {moods.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.mood}
                  onClick={() => triggerMood(m.mood)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 justify-center ${
                    selectedMood === m.mood
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600'
                  }`}
                  data-testid={`button-mood-${m.mood}`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-slate-300 text-xs font-medium mb-2">Mood → Expression Mapping:</h4>
            <div className="text-slate-400 text-xs space-y-1">
              <p><span className="text-amber-400">Calm</span> → Default</p>
              <p><span className="text-amber-400">Happy</span> → Girlish (high: Love)</p>
              <p><span className="text-amber-400">Excited</span> → Stars (high: Aura)</p>
              <p><span className="text-amber-400">Smug</span> → Halo (high: Stars)</p>
              <p><span className="text-amber-400">Annoyed</span> → Sweat (high: Angry)</p>
              <p><span className="text-amber-400">Angry</span> → Angry</p>
              <p><span className="text-amber-400">Sad</span> → Crying</p>
              <p><span className="text-amber-400">Surprised</span> → Dizzy (high: Mind Blown)</p>
              <p><span className="text-amber-400">Focused</span> → Shrink (high: Leaning)</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <button
            onClick={resetToDefault}
            className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg font-medium transition-all"
            data-testid="button-reset-expression"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </BasicPage>
  );
}

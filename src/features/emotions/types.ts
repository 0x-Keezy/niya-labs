export type Mood = 
  | 'calm'
  | 'happy'
  | 'excited'
  | 'smug'
  | 'annoyed'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'focused';

export type EmotionTriggerSource = 
  | 'market'
  | 'chat'
  | 'system'
  | 'manual'
  | 'activity';

export interface EmotionState {
  mood: Mood;
  intensity: number;
  reason: string;
  source: EmotionTriggerSource;
  timestamp: number;
}

export interface MarketTriggerData {
  percentChange: number;
  timeframeMinutes: number;
  symbol: string;
}

export interface ChatTriggerData {
  type: 'compliment' | 'question' | 'spam' | 'trolling' | 'greeting' | 'neutral';
  message?: string;
}

export interface SystemTriggerData {
  type: 'thinking' | 'error' | 'ready' | 'speaking' | 'idle';
}

export interface ActivityTriggerData {
  type: 'eating' | 'gaming' | 'singing' | 'carrying' | 'using_tools';
  context?: string;
}

export type Live2DExpression = 
  | 'default'
  | 'angry'
  | 'bare_legs'
  | 'black'
  | 'blush'
  | 'braids_long'
  | 'braids_left'
  | 'braids_right'
  | 'cancel_handheld'
  | 'candy_ears'
  | 'crying'
  | 'dizzy'
  | 'ears_disappear'
  | 'eat_sugar'
  | 'flying_heads'
  | 'flying_heads1'
  | 'forward_tilt'
  | 'girlish'
  | 'halo'
  | 'left_spoon'
  | 'love'
  | 'microphone'
  | 'play_games'
  | 'post_hair'
  | 'right_candy'
  | 'right_fork'
  | 'satchel'
  | 'shorts'
  | 'shrink'
  | 'stars'
  | 'stickers_legs'
  | 'sweat'
  | 'aura_levitating'
  | 'watermark';

export type ExpressionCategory = 'emotion' | 'activity' | 'appearance' | 'special';

export interface ExpressionInfo {
  name: Live2DExpression;
  category: ExpressionCategory;
  description: string;
  triggers: string[];
}

export const EXPRESSION_INFO: ExpressionInfo[] = [
  { name: 'default', category: 'emotion', description: 'Normal state', triggers: ['calm', 'idle'] },
  { name: 'angry', category: 'emotion', description: 'Angry face', triggers: ['angry mood', 'market crash'] },
  { name: 'blush', category: 'emotion', description: 'Blushing', triggers: ['compliment', 'embarrassed'] },
  { name: 'crying', category: 'emotion', description: 'Crying', triggers: ['sad mood', 'major loss'] },
  { name: 'dizzy', category: 'emotion', description: 'Confused/dizzy', triggers: ['surprised', 'confused'] },
  { name: 'girlish', category: 'emotion', description: 'Cute/happy', triggers: ['happy mood', 'good news'] },
  { name: 'halo', category: 'emotion', description: 'Angelic/smug', triggers: ['smug mood', 'feeling proud'] },
  { name: 'love', category: 'emotion', description: 'Heart eyes', triggers: ['excited', 'big pump'] },
  { name: 'shrink', category: 'emotion', description: 'Focused/thinking', triggers: ['focused mood', 'processing'] },
  { name: 'stars', category: 'emotion', description: 'Sparkling eyes', triggers: ['excited', 'market pump'] },
  { name: 'sweat', category: 'emotion', description: 'Nervous/worried', triggers: ['annoyed', 'market dip'] },
  { name: 'flying_heads', category: 'emotion', description: 'Mind blown', triggers: ['very surprised'] },
  { name: 'flying_heads1', category: 'emotion', description: 'Mind blown alt', triggers: ['very surprised'] },
  { name: 'forward_tilt', category: 'emotion', description: 'Leaning forward', triggers: ['intense focus'] },
  { name: 'eat_sugar', category: 'activity', description: 'Eating candy', triggers: ['talking about food', 'snack time'] },
  { name: 'play_games', category: 'activity', description: 'Gaming', triggers: ['gaming talk', 'playing'] },
  { name: 'microphone', category: 'activity', description: 'Singing/speaking', triggers: ['singing', 'karaoke'] },
  { name: 'satchel', category: 'activity', description: 'Carrying bag', triggers: ['carrying items'] },
  { name: 'left_spoon', category: 'activity', description: 'Holding spoon', triggers: ['eating', 'cooking'] },
  { name: 'right_fork', category: 'activity', description: 'Holding fork', triggers: ['eating', 'cooking'] },
  { name: 'right_candy', category: 'activity', description: 'Holding candy', triggers: ['candy talk', 'treats'] },
  { name: 'candy_ears', category: 'appearance', description: 'Candy on ears', triggers: ['special event'] },
  { name: 'braids_long', category: 'appearance', description: 'Long braids', triggers: ['style change'] },
  { name: 'braids_left', category: 'appearance', description: 'Left braid only', triggers: ['style change'] },
  { name: 'braids_right', category: 'appearance', description: 'Right braid only', triggers: ['style change'] },
  { name: 'post_hair', category: 'appearance', description: 'Hair up', triggers: ['style change'] },
  { name: 'bare_legs', category: 'appearance', description: 'No stockings', triggers: ['outfit change'] },
  { name: 'shorts', category: 'appearance', description: 'Wearing shorts', triggers: ['outfit change'] },
  { name: 'stickers_legs', category: 'appearance', description: 'Leg stickers', triggers: ['cute decoration'] },
  { name: 'ears_disappear', category: 'appearance', description: 'Hide ears', triggers: ['disguise mode'] },
  { name: 'cancel_handheld', category: 'special', description: 'Remove held item', triggers: ['reset hands'] },
  { name: 'aura_levitating', category: 'special', description: 'Mystical aura', triggers: ['big pump', 'special moment'] },
  { name: 'black', category: 'special', description: 'Dark mode', triggers: ['dramatic moment'] },
  { name: 'watermark', category: 'special', description: 'Show watermark', triggers: ['streaming'] },
];

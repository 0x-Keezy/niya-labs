import { Mood, Live2DExpression } from './types';

interface ExpressionMapping {
  expression: Live2DExpression;
  fallback: Live2DExpression;
  intensityBoost?: Live2DExpression;
}

const moodToExpressionMap: Record<Mood, ExpressionMapping> = {
  calm: { expression: 'default', fallback: 'default' },
  happy: { expression: 'girlish', fallback: 'stars', intensityBoost: 'love' },
  excited: { expression: 'stars', fallback: 'love', intensityBoost: 'aura_levitating' },
  smug: { expression: 'halo', fallback: 'girlish', intensityBoost: 'stars' },
  annoyed: { expression: 'sweat', fallback: 'dizzy', intensityBoost: 'angry' },
  angry: { expression: 'angry', fallback: 'sweat' },
  sad: { expression: 'crying', fallback: 'sweat' },
  surprised: { expression: 'dizzy', fallback: 'stars', intensityBoost: 'flying_heads' },
  focused: { expression: 'shrink', fallback: 'default', intensityBoost: 'forward_tilt' },
};

export function moodToExpression(mood: Mood, intensity: number = 0.5): Live2DExpression {
  const mapping = moodToExpressionMap[mood];
  
  if (!mapping) {
    return 'default';
  }

  let expression = mapping.expression;

  if (intensity >= 0.8 && mapping.intensityBoost) {
    expression = mapping.intensityBoost;
  }

  return expression;
}

export function getExpressionForEmotion(
  mood: Mood, 
  intensity: number,
  reason?: string
): { expression: Live2DExpression; shouldBlush: boolean; additionalExpression?: Live2DExpression } {
  const expression = moodToExpression(mood, intensity);
  
  const blushTriggers = ['compliment', 'praise', 'cute', 'beautiful', 'love', 'adorable', 'sweet'];
  const shouldBlush = reason ? blushTriggers.some(t => reason.toLowerCase().includes(t)) : false;

  let additionalExpression: Live2DExpression | undefined;
  
  if (reason) {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('candy') || lowerReason.includes('sweet') || lowerReason.includes('food') || lowerReason.includes('eat')) {
      additionalExpression = 'eat_sugar';
    } else if (lowerReason.includes('game') || lowerReason.includes('play') || lowerReason.includes('gaming')) {
      additionalExpression = 'play_games';
    } else if (lowerReason.includes('sing') || lowerReason.includes('song') || lowerReason.includes('karaoke')) {
      additionalExpression = 'microphone';
    } else if (lowerReason.includes('pump') && intensity >= 0.9) {
      additionalExpression = 'aura_levitating';
    }
  }

  return { expression, shouldBlush, additionalExpression };
}

export function getActivityExpression(activity: string): Live2DExpression {
  const activityMap: Record<string, Live2DExpression> = {
    'eating': 'eat_sugar',
    'snacking': 'eat_sugar',
    'candy': 'right_candy',
    'gaming': 'play_games',
    'playing': 'play_games',
    'singing': 'microphone',
    'karaoke': 'microphone',
    'streaming': 'microphone',
    'carrying': 'satchel',
    'cooking': 'left_spoon',
    'eating_formal': 'right_fork',
  };
  
  return activityMap[activity.toLowerCase()] || 'default';
}

export function getAppearanceExpression(style: string): Live2DExpression {
  const styleMap: Record<string, Live2DExpression> = {
    'casual': 'shorts',
    'summer': 'bare_legs',
    'cute': 'candy_ears',
    'braids': 'braids_long',
    'braids_left': 'braids_left',
    'braids_right': 'braids_right',
    'hair_up': 'post_hair',
    'stickers': 'stickers_legs',
    'incognito': 'ears_disappear',
    'dark': 'black',
    'mystical': 'aura_levitating',
  };
  
  return styleMap[style.toLowerCase()] || 'default';
}

export function getAvailableExpressions(): Live2DExpression[] {
  return [
    'default',
    'angry',
    'bare_legs',
    'black',
    'blush',
    'braids_long',
    'braids_left',
    'braids_right',
    'cancel_handheld',
    'candy_ears',
    'crying',
    'dizzy',
    'ears_disappear',
    'eat_sugar',
    'flying_heads',
    'flying_heads1',
    'forward_tilt',
    'girlish',
    'halo',
    'left_spoon',
    'love',
    'microphone',
    'play_games',
    'post_hair',
    'right_candy',
    'right_fork',
    'satchel',
    'shorts',
    'shrink',
    'stars',
    'stickers_legs',
    'sweat',
    'aura_levitating',
    'watermark',
  ];
}

export function getEmotionExpressions(): Live2DExpression[] {
  return ['default', 'angry', 'blush', 'crying', 'dizzy', 'girlish', 'halo', 'love', 'shrink', 'stars', 'sweat', 'flying_heads', 'flying_heads1', 'forward_tilt'];
}

export function getActivityExpressions(): Live2DExpression[] {
  return ['eat_sugar', 'play_games', 'microphone', 'satchel', 'left_spoon', 'right_fork', 'right_candy'];
}

export function getAppearanceExpressions(): Live2DExpression[] {
  return ['candy_ears', 'braids_long', 'braids_left', 'braids_right', 'post_hair', 'bare_legs', 'shorts', 'stickers_legs', 'ears_disappear'];
}

export function getSpecialExpressions(): Live2DExpression[] {
  return ['cancel_handheld', 'aura_levitating', 'black', 'watermark'];
}

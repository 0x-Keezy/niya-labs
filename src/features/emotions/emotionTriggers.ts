import { emotionStore } from './emotionStore';
import { MarketTriggerData, ChatTriggerData, SystemTriggerData, ActivityTriggerData, Mood, Live2DExpression } from './types';
import { getActivityExpression } from './emotionMapper';

let currentActivityExpression: Live2DExpression | null = null;

export function triggerMarketEmotion(data: MarketTriggerData): void {
  const { percentChange, symbol } = data;
  
  let mood: Mood;
  let intensity: number;
  let reason: string;

  const absChange = Math.abs(percentChange);

  if (percentChange >= 10) {
    mood = 'excited';
    intensity = Math.min(1, 0.7 + absChange / 50);
    reason = `${symbol} pumping +${percentChange.toFixed(1)}%! Sweet gains!`;
  } else if (percentChange >= 5) {
    mood = 'happy';
    intensity = 0.6 + absChange / 30;
    reason = `${symbol} up +${percentChange.toFixed(1)}%`;
  } else if (percentChange >= 2) {
    mood = 'smug';
    intensity = 0.5;
    reason = `${symbol} gaining +${percentChange.toFixed(1)}%`;
  } else if (percentChange <= -10) {
    mood = 'sad';
    intensity = Math.min(1, 0.7 + absChange / 50);
    reason = `${symbol} dumping ${percentChange.toFixed(1)}%...`;
  } else if (percentChange <= -5) {
    mood = 'annoyed';
    intensity = 0.6 + absChange / 30;
    reason = `${symbol} down ${percentChange.toFixed(1)}%`;
  } else if (percentChange <= -2) {
    mood = 'annoyed';
    intensity = 0.4;
    reason = `${symbol} dipping ${percentChange.toFixed(1)}%`;
  } else {
    mood = 'calm';
    intensity = 0.5;
    reason = `${symbol} stable`;
  }

  emotionStore.setEmotion(mood, intensity, reason, 'market');
}

export function triggerChatEmotion(data: ChatTriggerData): void {
  let mood: Mood;
  let intensity: number;
  let reason: string;

  switch (data.type) {
    case 'compliment':
      mood = 'happy';
      intensity = 0.8;
      reason = 'received compliment - so sweet!';
      break;
    case 'question':
      mood = 'focused';
      intensity = 0.6;
      reason = 'answering question';
      break;
    case 'spam':
      mood = 'annoyed';
      intensity = 0.7;
      reason = 'chat spam';
      break;
    case 'trolling':
      mood = 'smug';
      intensity = 0.6;
      reason = 'dealing with troll';
      break;
    case 'greeting':
      mood = 'happy';
      intensity = 0.5;
      reason = 'new viewer saying hi';
      break;
    default:
      mood = 'calm';
      intensity = 0.5;
      reason = 'chatting';
  }

  if (data.message) {
    const msg = data.message.toLowerCase();
    if (msg.includes('candy') || msg.includes('sweet') || msg.includes('food') || msg.includes('eat') || msg.includes('snack')) {
      triggerActivityEmotion({ type: 'eating', context: 'food talk' });
    } else if (msg.includes('game') || msg.includes('play') || msg.includes('gaming')) {
      triggerActivityEmotion({ type: 'gaming', context: 'gaming talk' });
    } else if (msg.includes('sing') || msg.includes('song') || msg.includes('music') || msg.includes('karaoke')) {
      triggerActivityEmotion({ type: 'singing', context: 'music talk' });
    }
  }

  emotionStore.setEmotion(mood, intensity, reason, 'chat');
}

export function triggerSystemEmotion(data: SystemTriggerData): void {
  let mood: Mood;
  let intensity: number;
  let reason: string;

  switch (data.type) {
    case 'thinking':
      mood = 'focused';
      intensity = 0.7;
      reason = 'processing...';
      break;
    case 'error':
      mood = 'annoyed';
      intensity = 0.6;
      reason = 'something went wrong';
      break;
    case 'ready':
      mood = 'happy';
      intensity = 0.6;
      reason = 'ready to go!';
      break;
    case 'speaking':
      mood = 'happy';
      intensity = 0.5;
      reason = 'talking';
      break;
    case 'idle':
    default:
      mood = 'calm';
      intensity = 0.5;
      reason = 'idle';
  }

  emotionStore.setEmotion(mood, intensity, reason, 'system');
}

export function triggerActivityEmotion(data: ActivityTriggerData): void {
  const expression = getActivityExpression(data.type);
  currentActivityExpression = expression;
  
  if (typeof window !== 'undefined' && (window as any).live2dControls?.triggerExpression) {
    (window as any).live2dControls.triggerExpression(expression);
  }
  
  console.log(`[Activity] Triggered activity expression: ${expression} (${data.type})`);
}

export function clearActivityExpression(): void {
  currentActivityExpression = null;
  if (typeof window !== 'undefined' && (window as any).live2dControls?.triggerExpression) {
    (window as any).live2dControls.triggerExpression('cancel_handheld');
  }
}

export function getCurrentActivityExpression(): Live2DExpression | null {
  return currentActivityExpression;
}

export function setManualEmotion(mood: Mood, intensity: number = 0.7, reason: string = 'manual'): void {
  emotionStore.setEmotion(mood, intensity, reason, 'manual');
}

export function detectEmotionFromMessage(message: string): ChatTriggerData {
  const lower = message.toLowerCase();
  
  const complimentWords = ['cute', 'adorable', 'sweet', 'lovely', 'beautiful', 'amazing', 'awesome', 'great', 'love you', 'best'];
  const greetingWords = ['hi', 'hello', 'hey', 'gm', 'good morning', 'good night', 'gn', 'yo', 'sup'];
  const spamPatterns = /(.)\1{4,}|^[A-Z\s]{10,}$/;
  
  if (complimentWords.some(w => lower.includes(w))) {
    return { type: 'compliment', message };
  }
  
  if (greetingWords.some(w => lower.startsWith(w) || lower === w)) {
    return { type: 'greeting', message };
  }
  
  if (spamPatterns.test(message)) {
    return { type: 'spam', message };
  }
  
  if (lower.includes('?')) {
    return { type: 'question', message };
  }
  
  return { type: 'neutral', message };
}

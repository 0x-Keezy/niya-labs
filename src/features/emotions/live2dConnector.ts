import { emotionStore } from './emotionStore';
import { getExpressionForEmotion } from './emotionMapper';
import { EmotionState, Live2DExpression } from './types';

declare global {
  interface Window {
    live2dControls?: {
      triggerMotion: (group: string, index?: number) => void;
      triggerExpression: (name: string) => void;
      expressions: string[];
      motions: string[];
      isReady: boolean;
    };
  }
}

let isConnected = false;
let unsubscribe: (() => void) | null = null;
let currentExpression: Live2DExpression = 'default';

function applyExpression(expression: Live2DExpression): void {
  if (typeof window === 'undefined') return;
  
  const controls = window.live2dControls;
  if (!controls?.isReady) {
    console.warn('[EmotionConnector] Live2D not ready yet');
    return;
  }

  if (expression === currentExpression) return;

  try {
    controls.triggerExpression(expression);
    currentExpression = expression;
    console.log(`[EmotionConnector] Applied expression: ${expression}`);
  } catch (e) {
    console.warn('[EmotionConnector] Failed to apply expression:', e);
  }
}

function handleEmotionChange(state: EmotionState): void {
  const { expression, shouldBlush } = getExpressionForEmotion(
    state.mood,
    state.intensity,
    state.reason
  );

  if (shouldBlush && expression !== 'blush') {
    applyExpression('blush');
    setTimeout(() => {
      applyExpression(expression);
    }, 2000);
  } else {
    applyExpression(expression);
  }
}

export function connectEmotionsToLive2D(): void {
  if (isConnected) return;
  
  if (typeof window === 'undefined') return;

  const tryConnect = () => {
    if (window.live2dControls?.isReady) {
      unsubscribe = emotionStore.subscribe(handleEmotionChange);
      isConnected = true;
      console.log('[EmotionConnector] Connected to Live2D');
    }
  };

  if (window.live2dControls?.isReady) {
    tryConnect();
  } else {
    window.addEventListener('live2d-ready', tryConnect);
    window.addEventListener('live2d-model-loaded', tryConnect);
  }
}

export function disconnectEmotionsFromLive2D(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  isConnected = false;
  currentExpression = 'default';
}

export function isEmotionConnectorActive(): boolean {
  return isConnected;
}

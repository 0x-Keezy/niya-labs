import { useState, useEffect, useCallback } from 'react';
import { emotionStore } from './emotionStore';
import { EmotionState, Mood, Live2DExpression } from './types';
import { getExpressionForEmotion } from './emotionMapper';

export function useEmotionState(): EmotionState {
  const [state, setState] = useState<EmotionState>(emotionStore.getState());

  useEffect(() => {
    const unsubscribe = emotionStore.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return state;
}

export function useCurrentMood(): Mood {
  const state = useEmotionState();
  return state.mood;
}

export function useCurrentExpression(): Live2DExpression {
  const state = useEmotionState();
  const { expression } = getExpressionForEmotion(state.mood, state.intensity, state.reason);
  return expression;
}

export function useEmotionController() {
  const setEmotion = useCallback((
    mood: Mood,
    intensity: number = 0.7,
    reason: string = 'manual'
  ) => {
    emotionStore.setEmotion(mood, intensity, reason, 'manual');
  }, []);

  const reset = useCallback(() => {
    emotionStore.reset();
  }, []);

  return { setEmotion, reset };
}

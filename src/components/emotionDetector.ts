export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry';

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy: [
    'happy', 'glad', 'joy', 'excited', 'wonderful', 'great', 'amazing', 'love',
    'fantastic', 'awesome', 'excellent', 'perfect', 'yay', 'hooray', 'haha',
    'lol', 'smile', 'laugh', 'fun', 'enjoy', 'celebrate', 'congrats', 'congratulations',
    'feliz', 'alegre', 'genial', 'increíble', 'perfecto', 'excelente'
  ],
  sad: [
    'sad', 'sorry', 'unfortunately', 'regret', 'miss', 'lonely', 'depressed',
    'disappointed', 'upset', 'cry', 'tears', 'heartbreak', 'loss', 'grief',
    'mourn', 'melancholy', 'blue', 'down', 'unhappy',
    'triste', 'lamento', 'desafortunadamente', 'perdida'
  ],
  surprised: [
    'wow', 'whoa', 'oh', 'really', 'seriously', 'amazing', 'incredible',
    'unbelievable', 'shocking', 'unexpected', 'omg', 'what', 'no way',
    'can\'t believe', 'astonished', 'stunned', 'mind-blown',
    'guau', 'increíble', 'sorprendente', 'impresionante'
  ],
  angry: [
    'angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate', 'terrible',
    'awful', 'horrible', 'disgusting', 'outrageous', 'unacceptable',
    'ridiculous', 'stupid', 'damn', 'hell',
    'enojado', 'furioso', 'terrible', 'horrible'
  ],
  neutral: []
};

const EMOTION_PATTERNS: Record<Emotion, RegExp[]> = {
  happy: [/:\)|:D|😊|😄|😁|🎉|❤️|💖|👍/],
  sad: [/:\(|😢|😭|💔|😞|😔/],
  surprised: [/:O|:o|😮|😲|🤯|❗|❓/],
  angry: [/>:\(|😠|😡|🤬|💢/],
  neutral: []
};

export function detectEmotion(text: string): Emotion {
  const lowerText = text.toLowerCase();
  
  const scores: Record<Emotion, number> = {
    happy: 0,
    sad: 0,
    surprised: 0,
    angry: 0,
    neutral: 0
  };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[emotion] += 1;
      }
    }
  }

  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [Emotion, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[emotion] += 2;
      }
    }
  }

  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= 2) {
    scores.surprised += 1;
    scores.happy += 0.5;
  }

  const questions = (text.match(/\?/g) || []).length;
  if (questions >= 2) {
    scores.surprised += 0.5;
  }

  let maxEmotion: Emotion = 'neutral';
  let maxScore = 0;

  for (const [emotion, score] of Object.entries(scores) as [Emotion, number][]) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  return maxScore > 0 ? maxEmotion : 'neutral';
}

export function getEmotionExpression(emotion: Emotion): string {
  const expressionMap: Record<Emotion, string> = {
    happy: 'smile',
    sad: 'sad',
    surprised: 'surprise',
    angry: 'angry',
    neutral: 'default'
  };
  
  return expressionMap[emotion];
}

export default { detectEmotion, getEmotionExpression };

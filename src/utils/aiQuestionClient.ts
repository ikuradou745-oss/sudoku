import { Question } from '../types';

// Fallback high-quality AI questions if network/offline
const AI_FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'ai_fb_01',
    type: 'matching',
    difficulty: '5kyu',
    japanese: '【AI生成】きもちと表情を線で繋ごう！',
    english: 'Match feelings and expressions',
    correctAnswer: 'all',
    matchingPairs: [
      { id: 'p1', left: 'happy', right: '☺️ うれしい' },
      { id: 'p2', left: 'sad', right: '😢 かなしい' },
      { id: 'p3', left: 'good', right: '👍 いいね' },
      { id: 'p4', left: 'angry', right: '😡 おこった' },
    ],
    explanation: 'AIが厳選した感情を表す基本英単語です！',
    isAiGenerated: true,
  },
  {
    id: 'ai_fb_02',
    type: 'blank',
    difficulty: '5kyu',
    japanese: '【AI生成】彼女は放課後にテニスを練習します。',
    english: 'She practices tennis after school.',
    promptSentence: 'She ____ tennis after school.',
    choices: ['practices', 'practice', 'practicing', 'practiced'],
    correctAnswer: 'practices',
    explanation: '主語が三人称単数の「She」で現在の動作なので、動詞に -s をつけます。',
    isAiGenerated: true,
  },
  {
    id: 'ai_fb_03',
    type: 'order',
    difficulty: '5kyu',
    japanese: '【AI生成】私の友達はとても親切です。',
    english: 'My best friend is very kind.',
    wordOptions: ['My', 'best', 'friend', 'is', 'very', 'kind.'],
    correctAnswer: 'My best friend is very kind.',
    explanation: '主語「My best friend」＋ be動詞「is」＋「very kind」の語順です。',
    isAiGenerated: true,
  },
  {
    id: 'ai_fb_04',
    type: 'matching',
    difficulty: '5kyu',
    japanese: '【AI生成】季節とシンボルを線で繋ごう！',
    english: 'Match seasons and symbols',
    correctAnswer: 'all',
    matchingPairs: [
      { id: 'p1', left: 'spring', right: '🌸 春' },
      { id: 'p2', left: 'summer', right: '☀️ 夏' },
      { id: 'p3', left: 'fall', right: '🍁 秋' },
      { id: 'p4', left: 'winter', right: '❄️ 冬' },
    ],
    explanation: '四季の英単語（spring, summer, fall, winter）を覚えよう！',
    isAiGenerated: true,
  }
];

export async function fetchAiQuestion(): Promise<Question> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.question) {
        return {
          ...data.question,
          isAiGenerated: true,
        };
      }
    }
  } catch {
    // Return fallback gracefully
  }

  // Pick random fallback
  const fallback = AI_FALLBACK_QUESTIONS[Math.floor(Math.random() * AI_FALLBACK_QUESTIONS.length)];
  return {
    ...fallback,
    id: `ai_fb_${Date.now()}`,
    isAiGenerated: true,
  };
}

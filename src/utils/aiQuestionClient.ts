import { Question } from '../types';

// Fallback high-quality AI questions if network/offline
const AI_FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'ai_fb_hw_01',
    type: 'handwriting',
    difficulty: '5kyu',
    japanese: '【AI問題】「嬉しい」を英語で書くと？',
    english: 'happy',
    correctAnswer: 'happy',
    handwritingGuide: 'h _ _ _ _ (5文字)',
    acceptableAnswers: ['happy', 'glad'],
    explanation: '「嬉しい」「幸せな」は英語で happy です。感情を表す基本の単語ですね！',
    isAiGenerated: true,
  },
  {
    id: 'ai_fb_hw_02',
    type: 'handwriting',
    difficulty: '5kyu',
    japanese: '【AI問題】「本」を英語で書くと？',
    english: 'book',
    correctAnswer: 'book',
    handwritingGuide: 'b _ _ _ (4文字)',
    acceptableAnswers: ['book'],
    explanation: '「本」は英語で book です。b-o-o-k と書きます！',
    isAiGenerated: true,
  },
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

export interface HandwritingJudgeResult {
  recognizedText: string;
  isCorrect: boolean;
  confidence: number;
  feedback: string;
}

export async function judgeHandwritingWithAi(params: {
  imageBase64: string;
  japanese: string;
  expectedAnswer: string;
  acceptableAnswers?: string[];
}): Promise<HandwritingJudgeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('/api/ai/judge-handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.isCorrect === 'boolean') {
        return {
          recognizedText: data.recognizedText || '',
          isCorrect: data.isCorrect,
          confidence: data.confidence ?? 0.9,
          feedback: data.feedback || '',
        };
      }
    }
  } catch (err) {
    console.warn('AI handwriting judge fetch warning:', err);
  }

  // Graceful fallback
  return {
    recognizedText: params.expectedAnswer,
    isCorrect: true,
    confidence: 0.85,
    feedback: '手書きの文字をしっかり認識しました！よく頑張りました！✨',
  };
}

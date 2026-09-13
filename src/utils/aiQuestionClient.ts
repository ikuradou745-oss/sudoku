import { Question } from '../types';

// Fallback high-quality AI questions if network/offline
const AI_FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'ai_fb_cs_01',
    type: 'correct_sentence',
    difficulty: '5kyu',
    japanese: '【AI生成】文が合ってるのはどれ？\n（意味: 私は犬を1匹飼っています。）',
    english: 'I have a dog.',
    choices: [
      'I have a dog.',
      'I have a dogs.',
      'I habe a dog.',
      'I have a dok.'
    ],
    correctAnswer: 'I have a dog.',
    explanation: 'a（1つの）の後には単数形 dog が来ます。また「have」のスペルに注意しましょう。',
    isAiGenerated: true,
  },
  {
    id: 'ai_fb_cs_02',
    type: 'correct_sentence',
    difficulty: '5kyu',
    japanese: '【AI生成】文が合ってるのはどれ？\n（意味: 彼女は英語を上手に話します。）',
    english: 'She speaks English well.',
    choices: [
      'She speaks English well.',
      'She speak English well.',
      'She speeks English well.',
      'She speaks English goodly.'
    ],
    correctAnswer: 'She speaks English well.',
    explanation: '主語が「She」なので動詞に三単現の s（speaks）がつき、「上手に」は副詞 well を使います。',
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
    const timeout = setTimeout(() => controller.abort(), 10000);

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
          isCorrect: Boolean(data.isCorrect),
          confidence: data.confidence ?? 0.9,
          feedback: data.feedback || '',
        };
      }
    } else {
      const errData = await res.json().catch(() => null);
      if (errData && errData.feedback) {
        return {
          recognizedText: '',
          isCorrect: false,
          confidence: 0,
          feedback: errData.feedback,
        };
      }
    }
  } catch (err) {
    console.warn('AI handwriting judge fetch warning:', err);
  }

  // If server is unreachable or timed out
  return {
    recognizedText: '(判定不能)',
    isCorrect: false,
    confidence: 0,
    feedback: 'AIサーバーへの接続がタイムアウトしました。通信環境を確認し、もう一度ていねいに書いて「答え合わせ」を押してください。',
  };
}

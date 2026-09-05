export type QuestionType = 'order' | 'blank' | 'translate' | 'dialogue' | 'listening';

export type QuestionDifficulty = '5kyu' | '4kyu' | 'long' | 'challenge';

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  japanese: string;
  english: string;
  // For 'blank': prompt with '____'
  promptSentence?: string;
  // For 'order': scrambled words
  wordOptions?: string[];
  // For 'blank', 'translate', 'dialogue', 'listening'
  choices?: string[];
  correctAnswer: string;
  explanation?: string;
  audioPrompt?: string;
}

export interface Modifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  bonusPercent: number; // 30 or 50
  active: boolean;
}

export interface UserStats {
  energy: number; // ⚡️
  streak: number;
  lastDailyDate: string | null; // e.g. "2026-09-05"
  completedSessions: number;
  perfectSessions: number;
}

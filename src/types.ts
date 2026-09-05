export type QuestionType = 'order' | 'blank' | 'translate' | 'dialogue';

export type QuestionDifficulty = '5kyu' | '4kyu' | 'long';

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  japanese: string;
  english: string;
  // For 'blank': prompt with '____'
  promptSentence?: string;
  // For 'order': scrambled words (strictly 5 to 6 words)
  wordOptions?: string[];
  // For 'blank', 'translate', 'dialogue'
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
  bonusPercent: number; // 30
  active: boolean;
}

export interface UserStats {
  energy: number; // ⚡️
  streak: number;
  lastDailyDate: string | null; // e.g. "2026-09-05"
  completedSessions: number;
  perfectSessions: number;
  userName?: string; // Max 12 chars
  avatarUrl?: string | null; // Base64 data URL from pixel/freehand canvas
}

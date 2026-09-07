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

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'heaven';

export interface UserStats {
  userId?: string;
  energy: number; // ⚡️
  streak: number;
  lastDailyDate: string | null; // e.g. "2026-09-05"
  completedSessions: number;
  perfectSessions: number;
  userName?: string; // Max 12 chars
  avatarUrl?: string | null; // Base64 data URL from pixel/freehand canvas
  battleWins?: number;
  // Ranked System
  rating?: number; // e.g. 0 ~ 600+
  rankTier?: RankTier;
  placementDone?: boolean;
  rankedWins?: number;
  rankedLosses?: number;
  lastActiveTime?: number;
}

export interface OnlineUserPresence {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  rankTier: RankTier;
  lastActive: number; // timestamp
  isOnline: boolean;
  lastLoginDate: string; // YYYY-MM-DD
}

export interface RankedMatchPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rating: number;
  rankTier: RankTier;
  team?: 'red' | 'blue';
  progress: number; // 0 to 10
  score: number;
  mistakes: number;
  lives: number; // 3 to 0
  isKO: boolean;
  finished: boolean;
  finishTime?: number;
  isBot?: boolean;
}

export interface RankedMatchSession {
  matchId: string;
  mode: '1vs1' | '2vs2' | 'placement';
  players: RankedMatchPlayer[];
  teams?: {
    teamRed: RankedMatchPlayer[];
    teamBlue: RankedMatchPlayer[];
  };
  questions?: Question[];
  status: 'countdown' | 'in_game' | 'finished';
  winnerSide?: 'player1' | 'player2' | 'teamRed' | 'teamBlue' | 'draw';
  winnerIds?: string[];
  createdAt: number;
  seed: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isLeader: boolean;
  isReady: boolean;
  isBot?: boolean;
  progress?: number; // 0 to 10
  score?: number;
  mistakes?: number;
  lives?: number; // 3 to 0
  isKO?: boolean;
  finished?: boolean;
  finishTime?: number;
}

export interface BattleRoom {
  id: string;
  name: string;
  leaderId: string;
  maxPlayers: number; // 2 to 8
  players: RoomPlayer[];
  modifiers: Modifier[];
  status: 'waiting' | 'countdown' | 'in_game' | 'finished';
  createdAt: number;
  seed: number;
}

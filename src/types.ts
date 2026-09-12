export type QuestionType = 'order' | 'blank' | 'translate' | 'dialogue' | 'matching' | 'handwriting';

export type QuestionDifficulty = '5kyu' | '4kyu' | 'long';

export interface MatchingPair {
  id: string;
  left: string; // e.g. "happy" or English word
  right: string; // e.g. "☺️ うれしい" or Japanese/Emoji/Meaning
  leftAudio?: string;
}

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
  // For 'matching' (点繋ぎ)
  matchingPairs?: MatchingPair[];
  // For 'handwriting' (手書き問題)
  handwritingGuide?: string;
  acceptableAnswers?: string[];
  // For AI questions
  isAiGenerated?: boolean;
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

export type MainGoodsId = 'pencil' | 'marker';
export type SubGoodsId = 'eraser' | 'ruler' | 'hat';

export interface GoodsItem {
  id: MainGoodsId | SubGoodsId;
  type: 'main' | 'sub';
  name: string;
  icon: string;
  price: number; // 0 for initial, 15000 for purchasable
  chargePercentPerCorrect?: number; // e.g. 25
  description: string;
  abilityDetail: string;
}

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
  // Goods Equipment System
  equippedMainGoods?: MainGoodsId;
  equippedSubGoods?: SubGoodsId;
  unlockedGoods?: string[];
  // Rewards & Codes
  claimedBonusCodes?: string[];
  hasOpenedRewardModal?: boolean;
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
  activity?: string; // e.g. "レッスン受講中 ✏️", "単語練習中 📖"
}

export interface LobbyUser {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: 'idle' | 'in_queue' | 'in_match';
  mode?: '1vs1' | '2vs2';
  roomCode?: string | null;
  joinedAt: number;
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

import { UserStats } from '../types';

const STORAGE_KEY = 'uolingo_user_stats_v2';

export function getStoredUserStats(): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const userId = parsed.userId || `u_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const rating = typeof parsed.rating === 'number' ? parsed.rating : 0;
      return {
        userId,
        energy: typeof parsed.energy === 'number' ? parsed.energy : 10,
        streak: typeof parsed.streak === 'number' ? parsed.streak : 1,
        lastDailyDate: parsed.lastDailyDate || null,
        completedSessions: parsed.completedSessions || 0,
        perfectSessions: parsed.perfectSessions || 0,
        userName: parsed.userName || 'うおリンゴ会員',
        avatarUrl: parsed.avatarUrl || null,
        battleWins: parsed.battleWins || 0,
        rating,
        rankTier: parsed.rankTier || (rating >= 600 ? 'heaven' : rating >= 400 ? 'diamond' : rating >= 300 ? 'platinum' : rating >= 200 ? 'gold' : rating >= 100 ? 'silver' : 'bronze'),
        placementDone: !!parsed.placementDone,
        rankedWins: parsed.rankedWins || 0,
        rankedLosses: parsed.rankedLosses || 0,
      };
    }
  } catch {
    // Ignore error
  }
  const newUserId = `u_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    userId: newUserId,
    energy: 10,
    streak: 1,
    lastDailyDate: null,
    completedSessions: 0,
    perfectSessions: 0,
    userName: 'うおリンゴ会員',
    avatarUrl: null,
    battleWins: 0,
    rating: 0,
    rankTier: 'bronze',
    placementDone: false,
    rankedWins: 0,
    rankedLosses: 0,
  };
}

export function saveUserStats(stats: UserStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore error
  }
}

// Get the current daily cycle identifier based on 9:00 AM cutoff.
export function getCurrentDailyCycleKey(now: Date = new Date()): string {
  const cycleDate = new Date(now.getTime());
  if (cycleDate.getHours() < 9) {
    // Before 9:00 AM belongs to previous day
    cycleDate.setDate(cycleDate.getDate() - 1);
  }
  const year = cycleDate.getFullYear();
  const month = String(cycleDate.getMonth() + 1).padStart(2, '0');
  const day = String(cycleDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get the previous (yesterday's) daily cycle identifier based on 9:00 AM cutoff.
export function getYesterdayDailyCycleKey(now: Date = new Date()): string {
  const cycleDate = new Date(now.getTime());
  if (cycleDate.getHours() < 9) {
    cycleDate.setDate(cycleDate.getDate() - 2);
  } else {
    cycleDate.setDate(cycleDate.getDate() - 1);
  }
  const year = cycleDate.getFullYear();
  const month = String(cycleDate.getMonth() + 1).padStart(2, '0');
  const day = String(cycleDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 連勝倍率 (1連勝: 1.0倍, 2連勝: 2.0倍, 3連勝: 3.0倍, 4連勝: 4.0倍, 5連勝以上: 最大5.0倍)
export function getDailyStreakMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  if (streak === 2) return 2.0;
  if (streak === 3) return 3.0;
  if (streak === 4) return 4.0;
  return 5.0; // 最大5倍
}

// 現在有効な連勝数（昨日または今日やっていれば維持、間が空いたら0）
export function getEffectiveDailyStreak(lastDailyDate: string | null, currentStreak: number): number {
  if (!lastDailyDate) return 0;
  const todayKey = getCurrentDailyCycleKey();
  const yesterdayKey = getYesterdayDailyCycleKey();

  if (lastDailyDate === todayKey || lastDailyDate === yesterdayKey) {
    return Math.max(1, currentStreak);
  }
  return 0; // 途切れた
}

// 次回デイリーセットクリア時の連勝数
export function calculateNextDailyStreak(lastDailyDate: string | null, currentStreak: number): number {
  const todayKey = getCurrentDailyCycleKey();
  if (lastDailyDate === todayKey) {
    return Math.max(1, currentStreak);
  }
  const yesterdayKey = getYesterdayDailyCycleKey();
  if (lastDailyDate === yesterdayKey) {
    return Math.max(1, currentStreak) + 1;
  }
  return 1; // 途切れていた場合は1連勝目からスタート
}

// デイリーセット報酬計算 (基本15⚡️ × 連勝倍率(最大5倍) × パーフェクト2倍)
export function calculateDailyReward(streak: number, isPerfect: boolean = false): {
  baseReward: number;
  multiplier: number;
  streakBonus: number;
  perfectBonus: number;
  totalReward: number;
} {
  const baseReward = 15;
  const multiplier = getDailyStreakMultiplier(streak);
  const withMultiplier = Math.round(baseReward * multiplier);
  const streakBonus = withMultiplier - baseReward;
  const totalReward = isPerfect ? withMultiplier * 2 : withMultiplier;
  const perfectBonus = isPerfect ? withMultiplier : 0;

  return {
    baseReward,
    multiplier,
    streakBonus,
    perfectBonus,
    totalReward,
  };
}

// Check if user has already completed the daily set for the current 9:00 AM cycle
export function isDailyCompletedToday(lastDailyDate: string | null): boolean {
  if (!lastDailyDate) return false;
  const currentCycle = getCurrentDailyCycleKey();
  return lastDailyDate === currentCycle;
}

// Get string like "XX時間XX分後 (09:00)"
export function getNextResetTimeString(): string {
  const now = new Date();
  const nextReset = new Date(now.getTime());
  
  if (now.getHours() >= 9) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  nextReset.setHours(9, 0, 0, 0);

  const diffMs = nextReset.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${diffHours}時間${diffMinutes}分後 (09:00)`;
}

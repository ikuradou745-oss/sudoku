import { UserStats } from '../types';

const STORAGE_KEY = 'uolingo_user_stats_v2';

export function getStoredUserStats(): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        energy: typeof parsed.energy === 'number' ? parsed.energy : 10,
        streak: typeof parsed.streak === 'number' ? parsed.streak : 1,
        lastDailyDate: parsed.lastDailyDate || null,
        completedSessions: parsed.completedSessions || 0,
        perfectSessions: parsed.perfectSessions || 0,
        userName: parsed.userName || 'うおリンゴ会員',
        avatarUrl: parsed.avatarUrl || null,
      };
    }
  } catch {
    // Ignore error
  }
  return {
    energy: 10,
    streak: 1,
    lastDailyDate: null,
    completedSessions: 0,
    perfectSessions: 0,
    userName: 'うおリンゴ会員',
    avatarUrl: null,
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

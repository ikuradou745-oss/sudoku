import { RankingRecord } from '../types';

const RANKING_LOCAL_KEY = 'uowlingo_ranking_top5_v1';

// Seed initial top 5 challengers
const DEFAULT_TOP5: RankingRecord[] = [
  {
    id: 'seed-1',
    userId: 'seed_sakura',
    userName: 'さくら🌸',
    avatarUrl: null,
    score: 20,
    date: '2026-10-01',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed-2',
    userId: 'seed_takeshi',
    userName: 'たけし⚡️',
    avatarUrl: null,
    score: 15,
    date: '2026-10-01',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'seed-3',
    userId: 'seed_yuuki',
    userName: 'ゆうき🐱',
    avatarUrl: null,
    score: 12,
    date: '2026-10-02',
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'seed-4',
    userId: 'seed_misaki',
    userName: 'みさき🌟',
    avatarUrl: null,
    score: 9,
    date: '2026-10-02',
    createdAt: Date.now() - 21600000,
  },
  {
    id: 'seed-5',
    userId: 'seed_kenta',
    userName: 'けんた🎮',
    avatarUrl: null,
    score: 6,
    date: '2026-10-03',
    createdAt: Date.now() - 3600000,
  },
];

export function getLocalRankings(): RankingRecord[] {
  try {
    const raw = localStorage.getItem(RANKING_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 5);
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_TOP5;
}

export function saveLocalRankings(list: RankingRecord[]): void {
  try {
    const sorted = [...list].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt).slice(0, 5);
    localStorage.setItem(RANKING_LOCAL_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
}

export async function fetchTop5Rankings(): Promise<RankingRecord[]> {
  try {
    const res = await fetch('/api/ranking');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rankings) && data.rankings.length > 0) {
        saveLocalRankings(data.rankings);
        return data.rankings.slice(0, 5);
      }
    }
  } catch {
    // fallback
  }
  return getLocalRankings();
}

export async function submitRankingScore(record: {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  score: number;
}): Promise<{
  rank: number; // 1 to 5, or -1 if not in top 5
  isFirstPlace: boolean;
  rankings: RankingRecord[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const newEntry: RankingRecord = {
    id: `rank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: record.userId,
    userName: record.userName,
    avatarUrl: record.avatarUrl || null,
    score: record.score,
    date: today,
    createdAt: Date.now(),
  };

  // Try server first
  try {
    const res = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: newEntry }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rankings)) {
        saveLocalRankings(data.rankings);
        return {
          rank: data.rank ?? -1,
          isFirstPlace: data.isFirstPlace ?? (data.rank === 1),
          rankings: data.rankings.slice(0, 5),
        };
      }
    }
  } catch {
    // server fallback
  }

  // Local fallback calculation
  const current = getLocalRankings();
  const combined = [...current, newEntry].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  const updatedTop5 = combined.slice(0, 5);
  saveLocalRankings(updatedTop5);

  const foundIndex = updatedTop5.findIndex((r) => r.id === newEntry.id);
  const rank = foundIndex !== -1 ? foundIndex + 1 : -1;
  const isFirstPlace = rank === 1;

  return {
    rank,
    isFirstPlace,
    rankings: updatedTop5,
  };
}

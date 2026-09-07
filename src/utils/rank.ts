import { RankTier } from '../types';

export interface RankInfo {
  tier: RankTier;
  name: string;
  icon: string;
  minRating: number;
  maxRating: number;
  bgGradient: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
}

export const RANK_TIERS: Record<RankTier, RankInfo> = {
  bronze: {
    tier: 'bronze',
    name: 'ブロンズ',
    icon: '🥉',
    minRating: 0,
    maxRating: 100,
    bgGradient: 'from-[#D97706]/10 to-[#92400E]/10',
    textColor: 'text-[#B45309]',
    borderColor: 'border-[#D97706]',
    badgeBg: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
  },
  silver: {
    tier: 'silver',
    name: 'シルバー',
    icon: '🥈',
    minRating: 100,
    maxRating: 200,
    bgGradient: 'from-[#94A3B8]/10 to-[#475569]/10',
    textColor: 'text-[#475569]',
    borderColor: 'border-[#94A3B8]',
    badgeBg: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
  },
  gold: {
    tier: 'gold',
    name: 'ゴールド',
    icon: '🥇',
    minRating: 200,
    maxRating: 300,
    bgGradient: 'from-[#F59E0B]/10 to-[#D97706]/10',
    textColor: 'text-[#D97706]',
    borderColor: 'border-[#F59E0B]',
    badgeBg: 'bg-[#FFFBEB] text-[#B45309] border-[#FCD34D]',
  },
  platinum: {
    tier: 'platinum',
    name: 'プラチナ',
    icon: '💠',
    minRating: 300,
    maxRating: 400,
    bgGradient: 'from-[#06B6D4]/10 to-[#0284C7]/10',
    textColor: 'text-[#0284C7]',
    borderColor: 'border-[#06B6D4]',
    badgeBg: 'bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]',
  },
  diamond: {
    tier: 'diamond',
    name: 'ダイヤモンド',
    icon: '💎',
    minRating: 400,
    maxRating: 600,
    bgGradient: 'from-[#8B5CF6]/15 to-[#3B82F6]/15',
    textColor: 'text-[#7C3AED]',
    borderColor: 'border-[#8B5CF6]',
    badgeBg: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]',
  },
  heaven: {
    tier: 'heaven',
    name: 'ヘブン',
    icon: '👑',
    minRating: 600,
    maxRating: 9999,
    bgGradient: 'from-[#EC4899]/20 via-[#8B5CF6]/20 to-[#3B82F6]/20',
    textColor: 'text-[#DB2777]',
    borderColor: 'border-[#F472B6]',
    badgeBg: 'bg-gradient-to-r from-[#FCE7F3] to-[#EDE9FE] text-[#BE185D] border-[#FBCFE8]',
  },
};

export function getRankTier(rating: number): RankTier {
  if (rating >= 600) return 'heaven';
  if (rating >= 400) return 'diamond';
  if (rating >= 300) return 'platinum';
  if (rating >= 200) return 'gold';
  if (rating >= 100) return 'silver';
  return 'bronze';
}

export function getRankInfo(rating: number): RankInfo {
  const tier = getRankTier(rating);
  return RANK_TIERS[tier];
}

// Calculate Rating Change on Match End
export function calculateRatingDelta(
  isWinner: boolean,
  score: number = 0,
  mistakes: number = 0,
  speedSeconds: number = 60
): number {
  if (isWinner) {
    // Win: +15 ~ +25
    let delta = 20;
    if (mistakes === 0) delta += 3; // Flawless bonus
    if (speedSeconds < 40) delta += 2; // Speed bonus
    if (score > 1200) delta += 1;
    return Math.min(25, Math.max(15, delta));
  } else {
    // Loss: -5 ~ -15
    let delta = -10;
    if (mistakes >= 3) delta -= 3;
    if (score < 400) delta -= 2;
    return Math.max(-15, Math.min(-5, delta));
  }
}

// Placement Match Evaluation (初回判定戦)
export interface PlacementResult {
  initialRating: number;
  initialTier: RankTier;
  tierName: string;
  reason: string;
}

export function evaluatePlacementMatch(
  correctCount: number,
  mistakes: number,
  isKO: boolean,
  totalTimeSec: number
): PlacementResult {
  if (isKO || correctCount <= 4) {
    return {
      initialRating: 40,
      initialTier: 'bronze',
      tierName: 'ブロンズ',
      reason: '基礎力を鍛えてステップアップを目指そう！',
    };
  }

  if (correctCount <= 7 || mistakes >= 2) {
    return {
      initialRating: 140,
      initialTier: 'silver',
      tierName: 'シルバー',
      reason: '安定した英語力！シルバーから高みを目指せます！',
    };
  }

  if (correctCount === 10 && mistakes === 0 && totalTimeSec < 45) {
    return {
      initialRating: 350,
      initialTier: 'platinum',
      tierName: 'プラチナ',
      reason: '圧巻の全問正解＆超ハイスピード！最上位プラチナ認定！',
    };
  }

  // 8~10 questions with 0~1 mistakes
  return {
    initialRating: 250,
    initialTier: 'gold',
    tierName: 'ゴールド',
    reason: '高い正解率と素早い判断力！ゴールドランク認定！',
  };
}

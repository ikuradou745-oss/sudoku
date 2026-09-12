import React from 'react';

export interface UserTitle {
  id: string;
  name: string;
  description: string;
  colorClass: string;
  textStyle?: React.CSSProperties;
  badgeClass: string;
  unlockCondition: string;
  sparkle?: boolean;
}

export const TITLES: Record<string, UserTitle> = {
  beginner: {
    id: 'beginner',
    name: 'ビギナー',
    description: '初期装備の基本称号。',
    colorClass: 'text-[#3C3C3C]',
    badgeClass: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
    unlockCondition: '初期から所持',
  },
  today_login: {
    id: 'today_login',
    name: '今日ログインした人',
    description: '今日アプリにログインした熱心なプレイヤーの証！',
    colorClass: 'text-[#059669] font-black',
    textStyle: {
      color: '#059669',
      fontWeight: 900,
    },
    badgeClass: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
    unlockCondition: 'ログインするだけで獲得',
  },
  eiken_challenger: {
    id: 'eiken_challenger',
    name: '英検チャレンジャー',
    description: 'ストーリーステージ50に到達した実力者の称号！',
    colorClass: 'text-[#0284C7] font-black',
    textStyle: {
      color: '#0284C7',
      fontWeight: 900,
    },
    badgeClass: 'bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]',
    unlockCondition: 'ストーリーステージ50到達',
  },
  word_master: {
    id: 'word_master',
    name: '単語マスター',
    description: 'ストーリーステージ100に到達した語彙力の達人！',
    colorClass: 'text-[#9333EA] font-black',
    textStyle: {
      color: '#9333EA',
      fontWeight: 900,
    },
    badgeClass: 'bg-[#FAF5FF] text-[#9333EA] border-[#E9D5FF]',
    unlockCondition: 'ストーリーステージ100到達',
  },
  gold: {
    id: 'gold',
    name: 'ゴールド',
    description: 'ストーリーステージ150到達の超特権称号！名前が眩しい金色に輝きます。',
    colorClass: 'text-[#D97706] font-black',
    textStyle: {
      color: '#B45309',
      backgroundImage: 'linear-gradient(135deg, #B45309 0%, #F59E0B 45%, #FEF08A 55%, #D97706 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 900,
      filter: 'drop-shadow(0 1px 1px rgba(245, 158, 11, 0.4))',
    },
    badgeClass: 'bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] text-[#92400E] border-[#F59E0B] shadow-xs font-black',
    sparkle: true,
    unlockCondition: 'ストーリーステージ150到達',
  },
  story_conqueror: {
    id: 'story_conqueror',
    name: 'ストーリー制覇者',
    description: '全200ステージを完全踏破した伝説の英語マスター！',
    colorClass: 'text-[#DC2626] font-black',
    textStyle: {
      color: '#DC2626',
      backgroundImage: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 35%, #8B5CF6 70%, #EC4899 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 900,
      filter: 'drop-shadow(0 1px 2px rgba(239, 68, 68, 0.3))',
    },
    badgeClass: 'bg-gradient-to-r from-[#FEE2E2] via-[#EDE9FE] to-[#FCE7F3] text-[#7C3AED] border-[#C084FC] shadow-xs font-black',
    sparkle: true,
    unlockCondition: 'ストーリーステージ200到達',
  },
};

export function getAllTitles(): UserTitle[] {
  return Object.values(TITLES);
}

export function getTitle(id?: string): UserTitle {
  if (!id) return TITLES.beginner;
  return TITLES[id] || TITLES.beginner;
}

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
  week_login: {
    id: 'week_login',
    name: '1週間ログインした人',
    description: '通算または連続で1週間（7日）以上ログインした継続の達人！',
    colorClass: 'text-[#0284C7] font-black',
    textStyle: {
      color: '#0284C7',
      fontWeight: 900,
    },
    badgeClass: 'bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]',
    unlockCondition: 'ログイン7日以上達成',
  },
  month_login: {
    id: 'month_login',
    name: '1ヶ月ログインした人',
    description: '通算または連続で1ヶ月（30日）以上ログインした不動の英語学習者！',
    colorClass: 'text-[#7C3AED] font-black',
    textStyle: {
      color: '#7C3AED',
      fontWeight: 900,
    },
    badgeClass: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
    unlockCondition: 'ログイン30日以上達成',
  },
  three_months_login: {
    id: 'three_months_login',
    name: '3ヶ月ログインした人',
    description: '通算または連続で3ヶ月（90日）以上ログインした超ベテラン学習者！',
    colorClass: 'text-[#DB2777] font-black',
    textStyle: {
      color: '#DB2777',
      backgroundImage: 'linear-gradient(135deg, #DB2777 0%, #EA580C 50%, #7C3AED 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontWeight: 900,
      filter: 'drop-shadow(0 1px 1px rgba(219, 39, 119, 0.3))',
    },
    badgeClass: 'bg-gradient-to-r from-[#FCE7F3] via-[#FFEDD5] to-[#F3E8FF] text-[#9D174D] border-[#F472B6] shadow-2xs font-black',
    sparkle: true,
    unlockCondition: 'ログイン90日以上達成',
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
};

export function getAllTitles(): UserTitle[] {
  return Object.values(TITLES);
}

export function getTitle(id?: string): UserTitle {
  if (!id) return TITLES.beginner;
  return TITLES[id] || TITLES.beginner;
}

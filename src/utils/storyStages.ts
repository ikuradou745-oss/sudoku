import { Question } from '../types';
import { QUESTION_BANK } from '../data/questions';

export interface StoryMilestone {
  stage: number;
  rewardType: 'energy' | 'title' | 'sub_goods';
  rewardLabel: string;
  energyAmount?: number;
  titleId?: string;
  goodsId?: string;
  icon: string;
}

export const STORY_MILESTONES: Record<number, StoryMilestone> = {
  50: {
    stage: 50,
    rewardType: 'energy',
    rewardLabel: '3,000⚡️ ＆ 称号「英検チャレンジャー」',
    energyAmount: 3000,
    titleId: 'eiken_challenger',
    icon: '🎁',
  },
  100: {
    stage: 100,
    rewardType: 'energy',
    rewardLabel: '7,500⚡️ ＆ 称号「単語マスター」',
    energyAmount: 7500,
    titleId: 'word_master',
    icon: '💎',
  },
  150: {
    stage: 150,
    rewardType: 'title',
    rewardLabel: '限定称号「ゴールド」（名前が金色に輝く！）',
    titleId: 'gold',
    icon: '👑',
  },
  200: {
    stage: 200,
    rewardType: 'sub_goods',
    rewardLabel: 'サブグッズ「鉛筆削り」＆ 称号「ストーリー制覇者」',
    goodsId: 'pencil_sharpener',
    titleId: 'story_conqueror',
    icon: '🏆',
  },
};

export interface StoryStageMeta {
  stage: number;
  chapter: number;
  chapterName: string;
  gradeLevel: string;
  title: string;
  description: string;
  milestone?: StoryMilestone;
}

export function getStoryStageMeta(stage: number): StoryStageMeta {
  const milestone = STORY_MILESTONES[stage];

  if (stage <= 50) {
    return {
      stage,
      chapter: 1,
      chapterName: '第1章: 英検5級 基礎編',
      gradeLevel: '英検5級 基礎',
      title: stage === 50 ? '第50関門: 英検5級 卒業試練' : `ステージ ${stage}: 身近な英語と基本の言葉`,
      description: stage === 50 ? 'クリアで3,000⚡️獲得！' : 'アルファベット・基本単語・be動詞・日常のあいさつ',
      milestone,
    };
  }
  if (stage <= 100) {
    return {
      stage,
      chapter: 2,
      chapterName: '第2章: 英検5級 発展〜英検4級 初級編',
      gradeLevel: '英検5級〜4級 初級',
      title: stage === 100 ? '第100関門: 英検4級 突入試練' : `ステージ ${stage}: 日常会話と過去形`,
      description: stage === 100 ? 'クリアで7,500⚡️獲得！' : '一般動詞・疑問詞（When/Where）・過去形と日常の出来事',
      milestone,
    };
  }
  if (stage <= 150) {
    return {
      stage,
      chapter: 3,
      chapterName: '第3章: 英検4級 応用編',
      gradeLevel: '英検4級 応用',
      title: stage === 150 ? '第150関門: 黄金の試練' : `ステージ ${stage}: 助動詞と比較表現`,
      description: stage === 150 ? 'クリアで限定称号「ゴールド」獲得！' : '助動詞（will/must）・比較級・接続詞（because/when）',
      milestone,
    };
  }
  return {
    stage,
    chapter: 4,
    chapterName: '第4章: 英検4級〜3級 マスター編',
    gradeLevel: '英検3〜4級 マスター',
    title: stage === 200 ? '第200関門: 最終試練・鉛筆削り獲得戦' : `ステージ ${stage}: 長文読解と重要構文`,
    description: stage === 200 ? 'クリアで伝説のサブグッズ「鉛筆削り」獲得！' : '不定詞・動名詞・受動態・現在完了の重要構文',
    milestone,
  };
}

// Deterministic Pseudo-Random Number Generator based on stage seed
function createPrng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Returns strictly 3 questions tailored to the requested stage (1 to 200).
 * Difficulty smoothly increases from Eiken 5 to Eiken 3~4.
 */
export function getStoryStageQuestions(stageNumber: number): Question[] {
  const prng = createPrng(stageNumber * 77 + 13);

  // Divide bank by difficulty
  const e5Questions = QUESTION_BANK.filter((q) => q.difficulty === '5kyu');
  const e4Questions = QUESTION_BANK.filter((q) => q.difficulty === '4kyu');
  const longQuestions = QUESTION_BANK.filter((q) => q.difficulty === 'long');
  const handwritingQuestions = QUESTION_BANK.filter((q) => q.type === 'handwriting');
  const matchingQuestions = QUESTION_BANK.filter((q) => q.type === 'matching');

  // Determine difficulty distribution based on stage
  let poolA: Question[] = [];
  let poolB: Question[] = [];
  let poolC: Question[] = [];

  if (stageNumber <= 30) {
    // Stage 1~30: Pure Eiken 5 basics
    poolA = e5Questions.filter((q) => q.type === 'translate' || q.type === 'blank');
    poolB = e5Questions.filter((q) => q.type === 'order' || q.type === 'blank');
    poolC = [...handwritingQuestions, ...matchingQuestions, ...e5Questions];
  } else if (stageNumber <= 70) {
    // Stage 31~70: Eiken 5 full + starting Eiken 4
    poolA = e5Questions;
    poolB = e4Questions.length > 0 ? e4Questions : e5Questions;
    poolC = [...handwritingQuestions, ...matchingQuestions, ...e5Questions];
  } else if (stageNumber <= 120) {
    // Stage 71~120: Eiken 4 core
    poolA = e4Questions;
    poolB = e4Questions.filter((q) => q.type === 'order' || q.type === 'dialogue');
    poolC = [...longQuestions, ...handwritingQuestions, ...e4Questions];
  } else if (stageNumber <= 160) {
    // Stage 121~160: Eiken 4 advanced
    poolA = e4Questions;
    poolB = longQuestions.length > 0 ? longQuestions : e4Questions;
    poolC = [...longQuestions, ...e4Questions, ...handwritingQuestions];
  } else {
    // Stage 161~200: Eiken 4 to 3 master (long sentences, advanced dialogue, handwriting)
    poolA = longQuestions.length > 0 ? longQuestions : e4Questions;
    poolB = e4Questions;
    poolC = [...longQuestions, ...handwritingQuestions, ...e4Questions];
  }

  // Ensure pools are non-empty
  if (poolA.length === 0) poolA = QUESTION_BANK;
  if (poolB.length === 0) poolB = QUESTION_BANK;
  if (poolC.length === 0) poolC = QUESTION_BANK;

  const pickFrom = (pool: Question[], usedIds: Set<string>): Question => {
    const available = pool.filter((q) => !usedIds.has(q.id));
    const targetPool = available.length > 0 ? available : pool;
    const index = Math.floor(prng() * targetPool.length);
    const chosen = targetPool[index] || QUESTION_BANK[0];
    usedIds.add(chosen.id);
    return chosen;
  };

  const used = new Set<string>();
  const q1 = pickFrom(poolA, used);
  const q2 = pickFrom(poolB, used);
  const q3 = pickFrom(poolC, used);

  return [q1, q2, q3];
}

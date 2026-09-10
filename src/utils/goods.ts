import { GoodsItem, MainGoodsId, SubGoodsId } from '../types';

export const MAIN_GOODS: Record<MainGoodsId, GoodsItem> = {
  pencil: {
    id: 'pencil',
    type: 'main',
    name: 'えんぴつ',
    icon: '✏️',
    price: 0,
    chargePercentPerCorrect: 25,
    description: '初期装備の定番えんぴつ。正解するたびに25%チャージ！',
    abilityDetail: '問題に正解してゲージが100%になると発動可能！えんぴつがスラスラと手書き風に問題のヒントを書いて教えてくれます。',
  },
  marker: {
    id: 'marker',
    type: 'main',
    name: 'マーカーペン',
    icon: '🖊️',
    price: 15000,
    description: '15,000⚡️で購入できるミス無効化マーカー！',
    abilityDetail: 'レッスン・試合中1度だけ、ミスをしてもマーカーペンでその問題を落書きして無効化！ライフを失わずにもう一度同じ問題に再挑戦できます。',
  },
};

export const SUB_GOODS: Record<SubGoodsId, GoodsItem> = {
  eraser: {
    id: 'eraser',
    type: 'sub',
    name: '消しゴム',
    icon: '🧽',
    price: 0,
    chargePercentPerCorrect: 25,
    description: '初期装備の万能消しゴム。正解するたびに25%チャージ！',
    abilityDetail: 'ゲージが100%になると発動可能！選択問題では不正解の選択肢を半分消去（50:50）。並び替え問題では文の前半が自動で完成した状態にしてくれます。',
  },
  ruler: {
    id: 'ruler',
    type: 'sub',
    name: 'ものさし',
    icon: '📏',
    price: 15000,
    description: '15,000⚡️で購入できる計測ものさし！',
    abilityDetail: 'レッスン・試合中ランダムに1回発動！定規が飛び出して長さを測るように文字数を計測。並び替え問題なら「〇 〇〇〇〇 〇 〇〇〇〇」のように文字数枠を表示し、選択問題なら正解単語の文字数（haveなら「〇〇〇〇」）を定規とともに表示します。',
  },
  hat: {
    id: 'hat',
    type: 'sub',
    name: '帽子',
    icon: '🧢',
    price: 15000,
    description: '15,000⚡️で購入できるエナジー帽子！',
    abilityDetail: '装備しているだけでもらえる⚡️が50%増えます！（レッスンやランクマッチなど、すべての獲得⚡️が常に1.5倍にアップ）',
  },
};

export function getAllGoods(): GoodsItem[] {
  return [...Object.values(MAIN_GOODS), ...Object.values(SUB_GOODS)];
}

export function getMainGoods(id?: MainGoodsId): GoodsItem {
  return MAIN_GOODS[id || 'pencil'] || MAIN_GOODS.pencil;
}

export function getSubGoods(id?: SubGoodsId): GoodsItem {
  return SUB_GOODS[id || 'eraser'] || SUB_GOODS.eraser;
}

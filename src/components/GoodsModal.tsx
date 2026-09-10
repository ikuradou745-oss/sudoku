import { useState } from 'react';
import { 
  X, 
  Check, 
  Zap,
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { UserStats, GoodsItem, MainGoodsId, SubGoodsId } from '../types';
import { getAllGoods } from '../utils/goods';
import { audio } from '../utils/audio';

interface GoodsModalProps {
  stats: UserStats;
  onEquipGoods: (type: 'main' | 'sub', id: MainGoodsId | SubGoodsId) => void;
  onBuyGoods: (goods: GoodsItem) => void;
  onClose: () => void;
}

// Visual theme and appearances for the stationery goods
const GOODS_VISUALS: Record<string, { appearanceTitle: string; appearanceNote: string; badgeColor: string; bgGradient: string }> = {
  pencil: {
    appearanceTitle: '木製クラシックHBえんぴつ',
    appearanceNote: '先端が尖った削りたての濃い芯。手書き風の筆跡で問題のヒントをノートに直接描いてくれる。',
    badgeColor: 'text-[#1CB0F6] bg-[#EBF7FD] border-[#BDE3F8]',
    bgGradient: 'from-[#EBF7FD] to-[#D5EEFC]',
  },
  marker: {
    appearanceTitle: 'ネオンイエロー蛍光マーカーペン',
    appearanceNote: '鮮やかな蛍光インクの太軸マーカー。間違えた問題をサッと上から塗りつぶして落書き無効化！',
    badgeColor: 'text-[#9333EA] bg-[#F5EDFD] border-[#DDB6FC]',
    bgGradient: 'from-[#FAF5FF] to-[#F3E8FF]',
  },
  eraser: {
    appearanceTitle: 'ホワイト消しゴム (ペントップ型)',
    appearanceNote: '角がしっかり残ったまっさらな消しゴム。迷った選択肢や単語の余計な部分をきれいに消し去る。',
    badgeColor: 'text-[#58A700] bg-[#EEFDEB] border-[#C2F3B6]',
    bgGradient: 'from-[#F0FDF4] to-[#DCFCE7]',
  },
  ruler: {
    appearanceTitle: '30cm アクリル透明ものさし',
    appearanceNote: '目盛りがくっきりと刻まれた精密定規。英単語の文字数枠をビシッと測って枠線ガイドを投影。',
    badgeColor: 'text-[#EA580C] bg-[#FFF7ED] border-[#FED7AA]',
    bgGradient: 'from-[#FFF7ED] to-[#FFEDD5]',
  },
};

export function GoodsModal({
  stats,
  onEquipGoods,
  onBuyGoods,
  onClose,
}: GoodsModalProps) {
  const allGoods = getAllGoods();
  const [selectedGoodsId, setSelectedGoodsId] = useState<MainGoodsId | SubGoodsId>(allGoods[0].id);
  const [purchaseConfirmGoods, setPurchaseConfirmGoods] = useState<GoodsItem | null>(null);

  const equippedMain = stats.equippedMainGoods || 'pencil';
  const equippedSub = stats.equippedSubGoods || 'eraser';
  const unlocked = stats.unlockedGoods || ['pencil', 'eraser'];

  const selectedGoods = allGoods.find((g) => g.id === selectedGoodsId) || allGoods[0];
  const isSelectedEquipped = selectedGoods.type === 'main' 
    ? equippedMain === selectedGoods.id 
    : equippedSub === selectedGoods.id;
  const isSelectedUnlocked = unlocked.includes(selectedGoods.id);
  const canAfford = stats.energy >= selectedGoods.price;

  const visual = GOODS_VISUALS[selectedGoods.id] || GOODS_VISUALS.pencil;

  const handleEquip = (goods: GoodsItem) => {
    audio.playCorrect();
    onEquipGoods(goods.type, goods.id);
  };

  const handleConfirmBuy = (goods: GoodsItem) => {
    if (stats.energy < goods.price) {
      audio.playWrong();
      return;
    }
    audio.playEnergyGet();
    onBuyGoods(goods);
    setPurchaseConfirmGoods(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="goods-split-modal"
        className="w-full max-w-3xl bg-white rounded-3xl border-2 border-[#E5E5E5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F3E8FF] border-2 border-[#D8B4FE] flex items-center justify-center text-xl shadow-xs">
              🎒
            </div>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C] flex items-center gap-2">
                <span>グッズ</span>
                <span className="text-xs font-bold text-[#9333EA] bg-[#F5EDFD] px-2.5 py-0.5 rounded-full border border-[#DDB6FC]">
                  ステーショナリー
                </span>
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                左側でグッズを選び、右側で説明・見た目・購入価格を確認して装備！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Energy pill */}
            <div className="flex items-center gap-1.5 bg-[#FFF9E6] border-2 border-[#FFD966] px-3.5 py-1.5 rounded-2xl shadow-xs">
              <span className="text-sm">⚡️</span>
              <span className="text-sm font-black text-[#FF9600] font-mono">
                {stats.energy.toLocaleString()}
              </span>
            </div>

            <button
              id="close-goods-modal-btn"
              onClick={() => {
                audio.playTap();
                onClose();
              }}
              className="w-9 h-9 rounded-2xl bg-white border-2 border-[#E5E5E5] text-[#777777] hover:text-[#3C3C3C] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Split Layout: Left List | Right Detail */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: List of Goods Names */}
          <div className="md:col-span-5 border-b-2 md:border-b-0 md:border-r-2 border-[#E5E5E5] bg-[#FAFAFA] p-3 sm:p-4 overflow-y-auto space-y-2.5">
            <div className="text-xs font-black text-[#777777] px-1 pb-1 flex items-center justify-between">
              <span>グッズ一覧</span>
              <span className="text-[11px] text-[#AFAFAF]">全4種</span>
            </div>

            {allGoods.map((goods) => {
              const isSelected = goods.id === selectedGoodsId;
              const isEquipped = goods.type === 'main' ? equippedMain === goods.id : equippedSub === goods.id;
              const isUnlocked = unlocked.includes(goods.id);

              return (
                <button
                  key={goods.id}
                  id={`goods-item-${goods.id}`}
                  onClick={() => {
                    audio.playTap();
                    setSelectedGoodsId(goods.id);
                  }}
                  className={`w-full p-3 rounded-2xl border-2 text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#A855F7] shadow-md ring-2 ring-[#A855F7]/25'
                      : 'bg-white border-[#E5E5E5] hover:border-[#D0D0D0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-xl shrink-0">
                      {goods.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-[#3C3C3C]">
                          {goods.name}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          goods.type === 'main' 
                            ? 'bg-[#EBF7FD] text-[#1CB0F6]' 
                            : 'bg-[#EEFDEB] text-[#58A700]'
                        }`}>
                          {goods.type === 'main' ? 'メイン' : 'サブ'}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-[#888888] mt-0.5">
                        {isEquipped ? (
                          <span className="text-[#58CC02] font-black flex items-center gap-0.5">
                            <Check className="w-3 h-3 stroke-[3]" /> 装備中
                          </span>
                        ) : isUnlocked ? (
                          <span>所持済み</span>
                        ) : (
                          <span className="text-[#FF9600] font-mono">⚡️ {goods.price.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    isSelected ? 'text-[#A855F7] translate-x-0.5' : 'text-[#CCCCCC]'
                  }`} />
                </button>
              );
            })}

            {/* Current Equipped Summary Card in Left Pane */}
            <div className="mt-4 p-3 rounded-2xl bg-white border border-[#E5E5E5] text-xs space-y-1.5">
              <div className="font-black text-[#777777] text-[11px]">現在の装備スロット</div>
              <div className="flex items-center justify-between bg-[#F9FAFB] p-2 rounded-xl">
                <span className="text-[#666666]">メイン:</span>
                <span className="font-bold text-[#1CB0F6]">
                  {allGoods.find((g) => g.id === equippedMain)?.icon} {allGoods.find((g) => g.id === equippedMain)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#F9FAFB] p-2 rounded-xl">
                <span className="text-[#666666]">サブ:</span>
                <span className="font-bold text-[#58A700]">
                  {allGoods.find((g) => g.id === equippedSub)?.icon} {allGoods.find((g) => g.id === equippedSub)?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Goods Appearance, Description, Price, Action */}
          <div className="md:col-span-7 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between space-y-5 bg-white">
            <div className="space-y-4">
              {/* Header of selected goods */}
              <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FAF5FF] to-[#F3E8FF] border-2 border-[#D8B4FE] flex items-center justify-center text-3xl shadow-xs">
                    {selectedGoods.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-[#2B2B2B]">
                        {selectedGoods.name}
                      </h3>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${visual.badgeColor}`}>
                        {selectedGoods.type === 'main' ? 'メイングッズ' : 'サブグッズ'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#777777] mt-0.5">
                      {selectedGoods.type === 'main' 
                        ? '1回のプレイでメイン枠に1つ装備できます' 
                        : '1回のプレイでサブ枠に1つ装備できます'}
                    </div>
                  </div>
                </div>

                {isSelectedEquipped && (
                  <span className="text-xs font-black bg-[#58CC02] text-white px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    装備中
                  </span>
                )}
              </div>

              {/* 1. 見た目 (Appearance) */}
              <div className="space-y-1.5">
                <div className="text-xs font-black text-[#777777] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />
                  <span>グッズの見た目</span>
                </div>
                <div className={`p-3.5 rounded-2xl bg-gradient-to-r ${visual.bgGradient} border border-[#E5E5E5] text-xs`}>
                  <div className="font-black text-[#3C3C3C] text-sm mb-1">
                    {visual.appearanceTitle}
                  </div>
                  <p className="text-[#555555] font-bold leading-relaxed">
                    {visual.appearanceNote}
                  </p>
                </div>
              </div>

              {/* 2. 説明と技 (Description & In-Game Ability) */}
              <div className="space-y-1.5">
                <div className="text-xs font-black text-[#777777] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1CB0F6]" />
                  <span>グッズの説明・効果</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E5E5] space-y-2 text-xs">
                  <div className="font-bold text-[#4B4B4B] leading-relaxed">
                    {selectedGoods.description}
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E5E5E5] text-[#3C3C3C] font-bold leading-relaxed">
                    <span className="text-[#9333EA] font-black mr-1">【発動効果】</span>
                    {selectedGoods.abilityDetail}
                  </div>
                </div>
              </div>

              {/* 3. 購入価格 (Price) */}
              <div className="space-y-1.5">
                <div className="text-xs font-black text-[#777777] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#FF9600]" />
                  <span>購入価格</span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FFFDF5] border border-[#FFD966]">
                  <div>
                    <span className="text-xs font-bold text-[#777777]">必要なエネルギー:</span>
                    <div className="text-lg font-black text-[#3C3C3C] font-mono flex items-center gap-1">
                      {selectedGoods.price === 0 ? (
                        <span className="text-[#58CC02]">無料 (初期所持)</span>
                      ) : (
                        <>
                          <span className="text-base">⚡️</span>
                          <span>{selectedGoods.price.toLocaleString()}</span>
                          <span className="text-xs text-[#777777] font-normal">コイン</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-[#777777]">あなたの所持:</span>
                    <div className={`text-sm font-black font-mono ${canAfford || isSelectedUnlocked ? 'text-[#FF9600]' : 'text-[#FF4B4B]'}`}>
                      ⚡️ {stats.energy.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Button */}
            <div className="pt-2 border-t border-[#F0F0F0]">
              {isSelectedEquipped ? (
                <button
                  disabled
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#F0FDF4] border-2 border-[#58CC02] text-[#58A700] font-black text-sm flex items-center justify-center gap-2 cursor-default"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  現在装備中
                </button>
              ) : isSelectedUnlocked ? (
                <button
                  id="equip-selected-goods-btn"
                  onClick={() => handleEquip(selectedGoods)}
                  className="duo-btn duo-btn-purple w-full py-3.5 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>{selectedGoods.icon}</span>
                  <span>このグッズを装備する</span>
                </button>
              ) : (
                <button
                  id="buy-selected-goods-btn"
                  onClick={() => setPurchaseConfirmGoods(selectedGoods)}
                  disabled={!canAfford}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                    canAfford
                      ? 'duo-btn duo-btn-green text-white'
                      : 'duo-btn duo-btn-gray opacity-60 cursor-not-allowed text-[#AFAFAF]'
                  }`}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>
                    {canAfford 
                      ? `${selectedGoods.price.toLocaleString()}⚡️ で購入して装備` 
                      : `エネルギーが足りません (${selectedGoods.price.toLocaleString()}⚡️必要)`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Purchase Confirmation Dialog */}
        {purchaseConfirmGoods && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 border-2 border-[#E5E5E5] text-center shadow-2xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF9E6] border-2 border-[#FFD966] text-3xl flex items-center justify-center mx-auto shadow-xs">
                {purchaseConfirmGoods.icon}
              </div>
              <div>
                <h4 className="text-lg font-black text-[#3C3C3C]">
                  {purchaseConfirmGoods.name} を購入しますか？
                </h4>
                <p className="text-xs font-bold text-[#777777] mt-1">
                  {purchaseConfirmGoods.price.toLocaleString()} ⚡️ を消費して解放します。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    audio.playTap();
                    setPurchaseConfirmGoods(null);
                  }}
                  className="duo-btn duo-btn-gray py-3 rounded-2xl font-black text-xs text-[#777777] cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleConfirmBuy(purchaseConfirmGoods)}
                  className="duo-btn duo-btn-green py-3 rounded-2xl font-black text-xs text-white cursor-pointer"
                >
                  購入して装備
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  Lock, 
  Info,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { UserStats, GoodsItem, MainGoodsId, SubGoodsId } from '../types';
import { MAIN_GOODS, SUB_GOODS } from '../utils/goods';
import { audio } from '../utils/audio';

interface GoodsModalProps {
  stats: UserStats;
  onEquipGoods: (type: 'main' | 'sub', id: MainGoodsId | SubGoodsId) => void;
  onBuyGoods: (goods: GoodsItem) => void;
  onClose: () => void;
}

export function GoodsModal({
  stats,
  onEquipGoods,
  onBuyGoods,
  onClose,
}: GoodsModalProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'sub'>('main');
  const [purchaseConfirmGoods, setPurchaseConfirmGoods] = useState<GoodsItem | null>(null);

  const equippedMain = stats.equippedMainGoods || 'pencil';
  const equippedSub = stats.equippedSubGoods || 'eraser';
  const unlocked = stats.unlockedGoods || ['pencil', 'eraser'];

  const handleEquip = (type: 'main' | 'sub', id: MainGoodsId | SubGoodsId) => {
    audio.playCorrect();
    onEquipGoods(type, id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl border-2 border-[#E5E5E5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF7FD] border-2 border-[#BDE3F8] flex items-center justify-center text-xl shadow-xs">
              🎒
            </div>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C] flex items-center gap-1.5">
                <span>ステーショナリーグッズ</span>
                <span className="text-xs font-bold text-[#1CB0F6] bg-[#EBF7FD] px-2 py-0.5 rounded-full border border-[#BDE3F8]">
                  装備・ショップ
                </span>
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                メインとサブを各1つ装備して特別な技を発揮！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Energy pill */}
            <div className="flex items-center gap-1 bg-[#FFF9E6] border-2 border-[#FFD966] px-3 py-1 rounded-xl shadow-xs">
              <span className="text-sm">⚡️</span>
              <span className="text-sm font-black text-[#FF9600] font-mono">
                {stats.energy.toLocaleString()}
              </span>
            </div>

            <button
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

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 p-2 bg-[#F7F7F7] border-b-2 border-[#E5E5E5] gap-2">
          <button
            onClick={() => {
              audio.playTap();
              setActiveTab('main');
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'main'
                ? 'bg-white text-[#1CB0F6] border-2 border-[#1CB0F6] shadow-xs'
                : 'text-[#777777] hover:bg-white/60 border-2 border-transparent'
            }`}
          >
            <span>✏️ メイングッズ</span>
            <span className="text-[10px] bg-[#EBF7FD] text-[#1CB0F6] px-1.5 py-0.5 rounded-md font-mono">
              {MAIN_GOODS[equippedMain]?.name} 装備中
            </span>
          </button>

          <button
            onClick={() => {
              audio.playTap();
              setActiveTab('sub');
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'sub'
                ? 'bg-white text-[#58A700] border-2 border-[#58CC02] shadow-xs'
                : 'text-[#777777] hover:bg-white/60 border-2 border-transparent'
            }`}
          >
            <span>🧽 サブグッズ</span>
            <span className="text-[10px] bg-[#EEFDEB] text-[#58A700] px-1.5 py-0.5 rounded-md font-mono">
              {SUB_GOODS[equippedSub]?.name} 装備中
            </span>
          </button>
        </div>

        {/* Goods List Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'main' ? (
            <div className="space-y-4">
              <div className="text-xs font-black text-[#777777] flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#1CB0F6]" />
                <span>メイングッズは1つ装備できます。</span>
              </div>

              {Object.values(MAIN_GOODS).map((goods) => {
                const isEquipped = equippedMain === goods.id;
                const isUnlocked = unlocked.includes(goods.id);
                const canAfford = stats.energy >= goods.price;

                return (
                  <div
                    key={goods.id}
                    className={`p-4 rounded-3xl border-2 transition-all ${
                      isEquipped
                        ? 'bg-[#F0F9FF] border-[#1CB0F6] shadow-md ring-2 ring-[#1CB0F6]/20'
                        : isUnlocked
                        ? 'bg-white border-[#E5E5E5] hover:border-[#CCCCCC]'
                        : 'bg-[#FAFAFA] border-[#E5E5E5] opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center text-3xl shadow-xs shrink-0">
                          {goods.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-[#3C3C3C]">
                              {goods.name}
                            </h3>
                            {isEquipped && (
                              <span className="text-[11px] font-black bg-[#1CB0F6] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                装備中
                              </span>
                            )}
                            {!isUnlocked && (
                              <span className="text-[11px] font-black bg-[#E5E5E5] text-[#777777] px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                未解放
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#777777] mt-0.5">
                            {goods.description}
                          </div>
                        </div>
                      </div>

                      {/* Price Tag */}
                      <div className="shrink-0 text-right">
                        {goods.price === 0 ? (
                          <span className="text-xs font-black text-[#58CC02] bg-[#EEFDEB] px-2.5 py-1 rounded-full border border-[#D5F5C8]">
                            初期装備 (無料)
                          </span>
                        ) : (
                          <span className="text-xs font-black text-[#FF9600] bg-[#FFF9E6] px-2.5 py-1 rounded-full border border-[#FFD966] font-mono flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 fill-[#FF9600]" />
                            {goods.price.toLocaleString()} ⚡️
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ability Detail Box */}
                    <div className="mt-3 p-3 rounded-2xl bg-white border border-[#E5E5E5] text-xs space-y-1">
                      <div className="font-black text-[#3C3C3C] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF9600]" />
                        <span>特殊能力（スキル）:</span>
                      </div>
                      <p className="font-bold text-[#555555] leading-relaxed">
                        {goods.abilityDetail}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="mt-3.5 flex items-center justify-end">
                      {isEquipped ? (
                        <div className="text-xs font-black text-[#1CB0F6] flex items-center gap-1 py-1.5 px-3 bg-[#EBF7FD] rounded-xl border border-[#BDE3F8]">
                          <ShieldCheck className="w-4 h-4" />
                          <span>現在セットされています</span>
                        </div>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleEquip('main', goods.id as MainGoodsId)}
                          className="duo-btn duo-btn-blue py-2.5 px-5 rounded-2xl text-xs font-black cursor-pointer shadow-xs"
                        >
                          このグッズを装備する
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            audio.playTap();
                            setPurchaseConfirmGoods(goods);
                          }}
                          disabled={!canAfford}
                          className={`py-2.5 px-5 rounded-2xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            canAfford
                              ? 'duo-btn duo-btn-green'
                              : 'bg-[#E5E5E5] text-[#AFAFAF] cursor-not-allowed border-2 border-[#D0D0D0]'
                          }`}
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>15,000⚡️ で購入して装備</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-black text-[#777777] flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#58CC02]" />
                <span>サブグッズは1つ装備できます。</span>
              </div>

              {Object.values(SUB_GOODS).map((goods) => {
                const isEquipped = equippedSub === goods.id;
                const isUnlocked = unlocked.includes(goods.id);
                const canAfford = stats.energy >= goods.price;

                return (
                  <div
                    key={goods.id}
                    className={`p-4 rounded-3xl border-2 transition-all ${
                      isEquipped
                        ? 'bg-[#F4FDF0] border-[#58CC02] shadow-md ring-2 ring-[#58CC02]/20'
                        : isUnlocked
                        ? 'bg-white border-[#E5E5E5] hover:border-[#CCCCCC]'
                        : 'bg-[#FAFAFA] border-[#E5E5E5] opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center text-3xl shadow-xs shrink-0">
                          {goods.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-[#3C3C3C]">
                              {goods.name}
                            </h3>
                            {isEquipped && (
                              <span className="text-[11px] font-black bg-[#58CC02] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                装備中
                              </span>
                            )}
                            {!isUnlocked && (
                              <span className="text-[11px] font-black bg-[#E5E5E5] text-[#777777] px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                未解放
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#777777] mt-0.5">
                            {goods.description}
                          </div>
                        </div>
                      </div>

                      {/* Price Tag */}
                      <div className="shrink-0 text-right">
                        {goods.price === 0 ? (
                          <span className="text-xs font-black text-[#58CC02] bg-[#EEFDEB] px-2.5 py-1 rounded-full border border-[#D5F5C8]">
                            初期装備 (無料)
                          </span>
                        ) : (
                          <span className="text-xs font-black text-[#FF9600] bg-[#FFF9E6] px-2.5 py-1 rounded-full border border-[#FFD966] font-mono flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 fill-[#FF9600]" />
                            {goods.price.toLocaleString()} ⚡️
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ability Detail Box */}
                    <div className="mt-3 p-3 rounded-2xl bg-white border border-[#E5E5E5] text-xs space-y-1">
                      <div className="font-black text-[#3C3C3C] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF9600]" />
                        <span>特殊能力（スキル）:</span>
                      </div>
                      <p className="font-bold text-[#555555] leading-relaxed">
                        {goods.abilityDetail}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="mt-3.5 flex items-center justify-end">
                      {isEquipped ? (
                        <div className="text-xs font-black text-[#58A700] flex items-center gap-1 py-1.5 px-3 bg-[#EEFDEB] rounded-xl border border-[#D5F5C8]">
                          <ShieldCheck className="w-4 h-4" />
                          <span>現在セットされています</span>
                        </div>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleEquip('sub', goods.id as SubGoodsId)}
                          className="duo-btn duo-btn-green py-2.5 px-5 rounded-2xl text-xs font-black cursor-pointer shadow-xs"
                        >
                          このグッズを装備する
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            audio.playTap();
                            setPurchaseConfirmGoods(goods);
                          }}
                          disabled={!canAfford}
                          className={`py-2.5 px-5 rounded-2xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            canAfford
                              ? 'duo-btn duo-btn-green'
                              : 'bg-[#E5E5E5] text-[#AFAFAF] cursor-not-allowed border-2 border-[#D0D0D0]'
                          }`}
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>15,000⚡️ で購入して装備</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Purchase Confirmation Modal / Dialog */}
        {purchaseConfirmGoods && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl border-2 border-[#E5E5E5] p-5 shadow-2xl space-y-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-[#FFF9E6] border-2 border-[#FFD966] text-4xl flex items-center justify-center mx-auto shadow-xs">
                {purchaseConfirmGoods.icon}
              </div>

              <div>
                <h3 className="text-lg font-black text-[#3C3C3C]">
                  {purchaseConfirmGoods.name} を購入しますか？
                </h3>
                <p className="text-xs font-bold text-[#777777] mt-1">
                  15,000⚡️ を消費してこのグッズを解放し、即座に装備します。
                </p>
                <div className="mt-2 text-xs font-mono font-bold text-[#FF9600] bg-[#FFF9E6] py-1 px-3 rounded-xl inline-block border border-[#FFD966]">
                  所持: {stats.energy.toLocaleString()}⚡️ → 購入後: {(stats.energy - 15000).toLocaleString()}⚡️
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPurchaseConfirmGoods(null)}
                  className="duo-btn duo-btn-gray flex-1 py-3 rounded-2xl text-xs font-black cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmBuy(purchaseConfirmGoods)}
                  className="duo-btn duo-btn-green flex-1 py-3 rounded-2xl text-xs font-black cursor-pointer shadow-md"
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

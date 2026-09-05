import { useState } from 'react';
import { X, Play, Zap, Sparkles } from 'lucide-react';
import { Modifier } from '../types';
import { DEFAULT_MODIFIERS } from '../data/questions';
import { audio } from '../utils/audio';

interface ModifierModalProps {
  onClose: () => void;
  onStart: (selectedModifiers: Modifier[]) => void;
}

export function ModifierModal({ onClose, onStart }: ModifierModalProps) {
  const [modifiers, setModifiers] = useState<Modifier[]>(DEFAULT_MODIFIERS);

  const toggleModifier = (id: string) => {
    audio.playTap();
    setModifiers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  const activeMods = modifiers.filter((m) => m.active);
  const totalBonusPercent = activeMods.reduce((sum, m) => sum + m.bonusPercent, 0);
  const baseReward = 5;
  const bonusMultiplier = 1 + totalBonusPercent / 100;
  const estimatedReward = Math.round(baseReward * bonusMultiplier);
  const perfectReward = Math.round(estimatedReward * 2);

  const handleStart = () => {
    audio.playTap();
    onStart(modifiers);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="modifier-select-modal"
        className="duo-card w-full max-w-lg p-6 bg-white max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#E5E5E5] mb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡️</span>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C]">
                モディファイア設定
              </h2>
              <p className="text-xs font-bold text-[#AFAFAF]">
                難易度を上げて⚡️報酬をアップさせよう！
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-10 h-10 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modifiers List */}
        <div className="space-y-3 mb-6">
          {modifiers.map((mod) => {
            const isSelected = mod.active;
            return (
              <div
                key={mod.id}
                onClick={() => toggleModifier(mod.id)}
                className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-[#58CC02] bg-[#F7FFF0] shadow-xs'
                    : 'border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#F9F9F9]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{mod.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#3C3C3C] text-base">
                        {mod.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black text-white ${
                        mod.id === 'challengeMode' ? 'bg-[#FF9600]' : 'bg-[#58CC02]'
                      }`}>
                        +{mod.bonusPercent}%
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#777777] mt-0.5">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Checkbox button */}
                <div
                  className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center font-black transition-all ${
                    isSelected
                      ? 'bg-[#58CC02] border-[#58A700] text-white'
                      : 'border-[#E5E5E5] bg-[#F7F7F7]'
                  }`}
                >
                  {isSelected && '✓'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reward Preview Card */}
        <div className="p-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl mb-6">
          <div className="flex items-center justify-between text-sm font-bold text-[#777777] mb-2">
            <span>適用モディファイア</span>
            <span className="font-black text-[#3C3C3C]">
              {activeMods.length} 個 (+{totalBonusPercent}%)
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-2">
            <div className="flex items-center gap-1.5 text-sm font-black text-[#3C3C3C]">
              <Zap className="w-4 h-4 text-[#FFC800] fill-[#FFC800]" />
              <span>クリア獲得報酬:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-[#58CC02]">
                +{estimatedReward} ⚡️
              </span>
              <span className="text-xs font-bold text-[#AFAFAF] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC800]" />
                パーフェクト時: +{perfectReward} ⚡️
              </span>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          id="start-practice-btn"
          onClick={handleStart}
          className="duo-btn duo-btn-green w-full h-14 rounded-2xl text-lg font-black flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>スタート</span>
        </button>
      </div>
    </div>
  );
}

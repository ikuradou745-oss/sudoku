import { Sparkles, Check } from 'lucide-react';
import { MainGoodsId, SubGoodsId } from '../types';
import { MAIN_GOODS, SUB_GOODS } from '../utils/goods';

interface GoodsHUDProps {
  equippedMain: MainGoodsId;
  equippedSub: SubGoodsId;
  mainCharge: number; // 0, 25, 50, 75, 100
  subCharge: number;  // 0, 25, 50, 75, 100
  markerUsed: boolean;
  rulerTriggered: boolean;
  rulerActiveOnQuestion: boolean;
  pencilActive: boolean;
  eraserActive: boolean;
  onActivatePencil: () => void;
  onActivateEraser: () => void;
}

export function GoodsHUD({
  equippedMain,
  equippedSub,
  mainCharge,
  subCharge,
  markerUsed,
  rulerTriggered,
  rulerActiveOnQuestion,
  pencilActive,
  eraserActive,
  onActivatePencil,
  onActivateEraser,
}: GoodsHUDProps) {
  const main = MAIN_GOODS[equippedMain] || MAIN_GOODS.pencil;
  const sub = SUB_GOODS[equippedSub] || SUB_GOODS.eraser;

  return (
    <div className="w-full bg-white/95 backdrop-blur-xs border-2 border-[#E5E5E5] rounded-2xl p-2.5 shadow-xs mb-3">
      <div className="grid grid-cols-2 gap-2">
        {/* Main Goods Slot */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{main.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-[#3C3C3C] truncate">
                  {main.name}
                </span>
                <span className="text-[9px] font-bold text-[#1CB0F6] bg-[#EBF7FD] px-1 py-0.2 rounded shrink-0">
                  メイン
                </span>
              </div>

              {equippedMain === 'pencil' ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* Gauge Bar */}
                  <div className="w-14 h-2 bg-[#E5E5E5] rounded-full overflow-hidden shrink-0">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        mainCharge >= 100 ? 'bg-[#58CC02] animate-pulse' : 'bg-[#1CB0F6]'
                      }`}
                      style={{ width: `${mainCharge}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-black text-[#777777]">
                    {mainCharge}%
                  </span>
                </div>
              ) : (
                <div className="text-[10px] font-bold mt-0.5">
                  {markerUsed ? (
                    <span className="text-[#AFAFAF]">ミス無効化 使用済</span>
                  ) : (
                    <span className="text-[#EA580C] font-black">ミス無効化 [1回可]</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Trigger for Pencil */}
          {equippedMain === 'pencil' && (
            <div>
              {pencilActive ? (
                <span className="text-[10px] font-black text-[#58A700] bg-[#EEFDEB] px-2 py-1 rounded-lg border border-[#D5F5C8] flex items-center gap-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                  発動中
                </span>
              ) : mainCharge >= 100 ? (
                <button
                  type="button"
                  onClick={onActivatePencil}
                  className="duo-btn duo-btn-blue py-1 px-2.5 rounded-xl text-[10px] font-black flex items-center gap-1 animate-bounce cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                  <span>ヒント発動!</span>
                </button>
              ) : (
                <span className="text-[9px] font-bold text-[#AFAFAF] bg-[#EEEEEE] px-1.5 py-0.5 rounded">
                  4問でMAX
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sub Goods Slot */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{sub.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-[#3C3C3C] truncate">
                  {sub.name}
                </span>
                <span className="text-[9px] font-bold text-[#58A700] bg-[#EEFDEB] px-1 py-0.2 rounded shrink-0">
                  サブ
                </span>
              </div>

              {equippedSub === 'eraser' ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* Gauge Bar */}
                  <div className="w-14 h-2 bg-[#E5E5E5] rounded-full overflow-hidden shrink-0">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        subCharge >= 100 ? 'bg-[#58CC02] animate-pulse' : 'bg-[#58A700]'
                      }`}
                      style={{ width: `${subCharge}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-black text-[#777777]">
                    {subCharge}%
                  </span>
                </div>
              ) : (
                <div className="text-[10px] font-bold mt-0.5">
                  {rulerActiveOnQuestion ? (
                    <span className="text-[#1CB0F6] font-black animate-pulse">📏 長さ計測中!</span>
                  ) : rulerTriggered ? (
                    <span className="text-[#AFAFAF]">文字数計測 済</span>
                  ) : (
                    <span className="text-[#777777]">ランダム発動待機</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Trigger for Eraser */}
          {equippedSub === 'eraser' && (
            <div>
              {eraserActive ? (
                <span className="text-[10px] font-black text-[#58A700] bg-[#EEFDEB] px-2 py-1 rounded-lg border border-[#D5F5C8] flex items-center gap-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                  発動中
                </span>
              ) : subCharge >= 100 ? (
                <button
                  type="button"
                  onClick={onActivateEraser}
                  className="duo-btn duo-btn-green py-1 px-2.5 rounded-xl text-[10px] font-black flex items-center gap-1 animate-bounce cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                  <span>50:50発動!</span>
                </button>
              ) : (
                <span className="text-[9px] font-bold text-[#AFAFAF] bg-[#EEEEEE] px-1.5 py-0.5 rounded">
                  4問でMAX
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

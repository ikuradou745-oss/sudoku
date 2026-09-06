import { X, Trophy, Lock, ShieldCheck, Flame } from 'lucide-react';
import { audio } from '../utils/audio';

interface RankedMatchModalProps {
  onClose: () => void;
}

export function RankedMatchModal({ onClose }: RankedMatchModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="ranked-match-modal"
        className="duo-card w-full max-w-md p-6 bg-white text-center animate-in fade-in zoom-in duration-150"
      >
        {/* Top Header */}
        <div className="flex justify-between items-center pb-3 border-b-2 border-[#E5E5E5] mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFF9E6] text-[#FF9600] border-2 border-[#FFD966] flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-[#3C3C3C]">
              ランクマッチ
            </h2>
          </div>
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preparation Notice */}
        <div className="py-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[#FFF0F0] border-4 border-[#FFD0D0] flex items-center justify-center text-[#FF4B4B] mb-4 shadow-xs">
            <Lock className="w-10 h-10" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F0] text-[#FF4B4B] text-xs font-black mb-2">
            <Flame className="w-3.5 h-3.5" />
            <span>シーズン1 準備中</span>
          </div>

          <h3 className="text-2xl font-black text-[#3C3C3C] mb-2">
            現在準備中です
          </h3>
          <p className="text-sm font-bold text-[#777777] leading-relaxed max-w-xs mx-auto mb-6">
            レートと階級を賭けた白熱の真剣勝負！<br />
            まずは「部屋（カスタムルーム）」での対戦をお楽しみください。
          </p>

          {/* Tier preview */}
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-4 text-left space-y-2 mb-6">
            <div className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2">
              予定されているランク階級
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-black">
              <div className="p-2 rounded-xl bg-white border border-[#E5E5E5] flex items-center gap-2">
                <span>🥉</span> <span>ブロンズ (Rate ~1000)</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#E5E5E5] flex items-center gap-2">
                <span>🥈</span> <span>シルバー (Rate ~1400)</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#E5E5E5] flex items-center gap-2">
                <span>🥇</span> <span>ゴールド (Rate ~1800)</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#E5E5E5] flex items-center gap-2 text-[#84D8FF]">
                <span>💎</span> <span>ダイヤ (Rate ~2200)</span>
              </div>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="duo-btn duo-btn-gray w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-[#58CC02]" />
            <span>対戦トップへ戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
}

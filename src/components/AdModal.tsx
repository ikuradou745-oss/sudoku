import { useState, useEffect } from 'react';
import { Sparkles, Heart, Clock } from 'lucide-react';
import { audio } from '../utils/audio';

interface AdModalProps {
  onAdComplete: () => void;
  onCancel: () => void;
}

export const SPONSORS = [
  {
    title: 'うおリンゴ プレミアム 🌟',
    description: '広告なし・無制限ライフで英語力をさらに爆速アップ！',
    tag: 'SPONSORED',
    color: '#58CC02',
  },
  {
    title: '英検 4級・5級 完全攻略ノート 📘',
    description: '基礎文法・重要熟語をたった10分でマスターしよう！',
    tag: 'RECOMMENDED',
    color: '#1CB0F6',
  },
];

export function AdModal({ onAdComplete, onCancel }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(5);
  const [adStarted] = useState<boolean>(true);
  const sponsor = SPONSORS[0];

  useEffect(() => {
    if (!adStarted) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          audio.playEnergyGet();
          onAdComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adStarted, onAdComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="simulated-ad-card"
        className="duo-card w-full max-w-md p-6 bg-white text-center"
      >
        {/* Ad Tag & Timer */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#E5E5E5] text-[#777777]">
            {sponsor.tag}
          </span>
          <div className="flex items-center gap-1 text-xs font-black text-[#AFAFAF] bg-[#F7F7F7] px-3 py-1 rounded-full border border-[#E5E5E5]">
            <Clock className="w-3.5 h-3.5" />
            <span>あと {secondsLeft} 秒で復活</span>
          </div>
        </div>

        {/* Sponsor Banner Display */}
        <div className="p-6 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-3xl mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#58CC02] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-[#3C3C3C] mb-1">
            {sponsor.title}
          </h3>
          <p className="text-xs font-bold text-[#777777]">
            {sponsor.description}
          </p>
        </div>

        {/* Revive Reward info */}
        <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-[#FFF0F0] border border-[#FFD0D0] rounded-2xl text-[#FF4B4B] font-black text-sm">
          <Heart className="w-5 h-5 fill-[#FF4B4B]" />
          <span>視聴完了でライフが ❤️❤️❤️ (3つ) に復活します！</span>
        </div>

        {/* Action Button */}
        {secondsLeft > 0 ? (
          <div className="w-full h-12 bg-[#E5E5E5] rounded-2xl flex items-center justify-center text-[#AFAFAF] font-black text-sm">
            再生中... ({secondsLeft})
          </div>
        ) : (
          <button
            onClick={onAdComplete}
            className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5 fill-white" />
            <span>ライフ3で復活する！</span>
          </button>
        )}

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="mt-3 text-xs font-bold text-[#AFAFAF] hover:text-[#777777]"
        >
          広告視聴をやめてホームへ戻る
        </button>
      </div>
    </div>
  );
}

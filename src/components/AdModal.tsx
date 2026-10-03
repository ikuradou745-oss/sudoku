import { useState, useEffect } from 'react';
import { Heart, Clock, ExternalLink } from 'lucide-react';
import { audio } from '../utils/audio';

interface AdModalProps {
  onAdComplete: () => void;
  onCancel: () => void;
}

export const SPONSORS = [
  {
    title: 'ティックエディション 🎬🎮',
    description: 'コマで動画を作ったり、プログラムでゲームを作れるプログラミング・クリエイティブ教材！',
    tag: 'おすすめ教材',
    color: '#1CB0F6',
    url: 'https://sinnbunntukuru-948369357413.asia-south1.run.app/',
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

  const handleOpenSponsor = () => {
    audio.playTap();
    window.open(sponsor.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="simulated-ad-card"
        className="duo-card w-full max-w-md p-6 bg-white text-center shadow-2xl border-4 border-[#1CB0F6]"
      >
        {/* Ad Tag & Timer */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#EBF7FD] text-[#0284C7] border border-[#BAE6FD]">
            {sponsor.tag}
          </span>
          <div className="flex items-center gap-1 text-xs font-black text-[#AFAFAF] bg-[#F7F7F7] px-3 py-1 rounded-full border border-[#E5E5E5]">
            <Clock className="w-3.5 h-3.5" />
            <span>あと {secondsLeft} 秒で復活</span>
          </div>
        </div>

        {/* Sponsor Banner Display */}
        <div className="p-5 bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE] border-2 border-[#BAE6FD] rounded-3xl mb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#1CB0F6] to-[#0284C7] flex items-center justify-center text-white shadow-md text-3xl">
            🎬
          </div>
          <h3 className="text-xl font-black text-[#0369A1] mb-1.5 flex items-center justify-center gap-1.5">
            <span>{sponsor.title}</span>
          </h3>
          <p className="text-xs font-bold text-[#334155] leading-relaxed mb-3">
            {sponsor.description}
          </p>

          <button
            onClick={handleOpenSponsor}
            className="duo-btn duo-btn-blue py-1.5 px-4 rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>ティックエディションを見に行く ↗</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Revive Reward info */}
        <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-[#FFF0F0] border border-[#FFD0D0] rounded-2xl text-[#FF4B4B] font-black text-sm">
          <Heart className="w-5 h-5 fill-[#FF4B4B]" />
          <span>視聴完了でライフが ❤️❤️❤️ (3つ) に復活します！</span>
        </div>

        {/* Action Button */}
        {secondsLeft > 0 ? (
          <div className="w-full h-12 bg-[#E5E5E5] rounded-2xl flex items-center justify-center text-[#AFAFAF] font-black text-sm">
            広告視聴中... ({secondsLeft})
          </div>
        ) : (
          <button
            onClick={onAdComplete}
            className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Heart className="w-5 h-5 fill-white" />
            <span>ライフ3で復活する！</span>
          </button>
        )}

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="mt-3 text-xs font-bold text-[#AFAFAF] hover:text-[#777777] cursor-pointer"
        >
          広告視聴をやめてホームへ戻る
        </button>
      </div>
    </div>
  );
}

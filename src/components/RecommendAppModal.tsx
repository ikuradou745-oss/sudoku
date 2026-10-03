import { useState } from 'react';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  X, 
  Film,
  Gamepad2,
  GraduationCap
} from 'lucide-react';
import { audio } from '../utils/audio';

const PROMO_URL = 'https://sinnbunntukuru-948369357413.asia-south1.run.app/';
const PROMO_TITLE = 'ティックエディション';
const PROMO_DESC = 'コマで動画を作ったり、プログラムでゲームを作れるプログラミング・クリエイティブ教材です！';

interface RecommendAppModalProps {
  onClose: () => void;
  onClaimBonus?: () => void;
  hasClaimedBonus?: boolean;
}

export function RecommendAppModal({
  onClose,
  onClaimBonus,
  hasClaimedBonus = false,
}: RecommendAppModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [justClaimed, setJustClaimed] = useState<boolean>(false);

  // Copy link handler
  const handleCopyLink = () => {
    audio.playTap();
    navigator.clipboard.writeText(PROMO_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = PROMO_URL;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Open App in New Tab Handler + Claim 1000⚡️ reward
  const handleOpenAppAndClaim = () => {
    audio.playLevelComplete();
    if (!hasClaimedBonus && onClaimBonus) {
      onClaimBonus();
      setJustClaimed(true);
    }
    window.open(PROMO_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div 
        id="recommend-app-modal"
        className="duo-card w-full max-w-lg p-6 bg-white relative my-auto shadow-2xl border-4 border-[#FFD966]"
      >
        {/* Close Button Top-Right */}
        <button
          onClick={() => {
            audio.playTap();
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F7F7F7] hover:bg-[#EBEBEB] text-[#777777] hover:text-[#3C3C3C] border border-[#E5E5E5] flex items-center justify-center cursor-pointer transition-all active:scale-95"
          title="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#58CC02] text-white flex items-center gap-1 shadow-2xs">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>教育・クリエイティブ教材</span>
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FFF9E6] border border-[#FFD966] text-[#A57800] flex items-center gap-1 animate-pulse">
            <Sparkles className="w-3 h-3 text-[#FF9600]" />
            <span>やってくれたら1000⚡️！</span>
          </span>
        </div>

        {/* Main Required Header Text */}
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-black text-[#3C3C3C] tracking-tight leading-tight flex items-center gap-2">
            <span>これもやって欲しいです。</span>
            <span className="text-2xl">🎬🎮</span>
          </h2>
          <p className="text-xs font-bold text-[#777777] mt-1 break-all bg-[#F7F7F7] p-2.5 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#AFAFAF] select-none mr-1">URL:</span>
            <a 
              href={PROMO_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#1CB0F6] hover:underline font-mono text-[11px]"
            >
              {PROMO_URL}
            </a>
          </p>
        </div>

        {/* App Showcase Card: ティックエディション */}
        <div className="p-4 bg-gradient-to-br from-[#FFFBEB] via-[#FFFDF5] to-[#ECFEFF] border-2 border-[#FED7AA] rounded-2xl mb-4 relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1CB0F6] to-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-md text-2xl">
              🎬
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-[#3C3C3C]">
                  {PROMO_TITLE}
                </h3>
                <span className="text-[10px] font-black bg-[#FF9600] text-white px-2 py-0.5 rounded-full">
                  無料・教材ツール
                </span>
              </div>
              <p className="text-xs font-bold text-[#555555] mt-1 leading-snug">
                {PROMO_DESC}
              </p>
            </div>
          </div>

          {/* Key Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#FED7AA]/60 text-xs font-bold">
            <div className="flex items-start gap-2 bg-white/90 p-2.5 rounded-xl border border-[#E0F2FE]">
              <Film className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-[#0369A1] block">コマで動画をつくる</span>
                <span className="text-[11px] text-[#666666]">
                  コマ撮りアニメやパラパラ動画を直感的に制作！
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/90 p-2.5 rounded-xl border border-[#DCFCE7]">
              <Gamepad2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-[#15803D] block">プログラムでゲームをつくる</span>
                <span className="text-[11px] text-[#666666]">
                  自分だけのオリジナルゲームをプログラミング！
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1000⚡️ Reward Banner */}
        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-[#FFF9E6] to-[#FEF3C7] border-2 border-[#FFD966] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-bounce">⚡️</span>
            <div>
              <div className="text-xs font-black text-[#A57800]">
                {hasClaimedBonus || justClaimed
                  ? '🎉 1000⚡️ 獲得済み！ありがとうございます！'
                  : 'やってくれたら 1000⚡️ ゲット！'}
              </div>
              <div className="text-[11px] font-bold text-[#B45309]">
                {hasClaimedBonus || justClaimed
                  ? 'エネルギーがチャージされました！学習を思いっきり楽しもう！'
                  : 'ボタンを押して「ティックエディション」を開くと 1000⚡️ をプレゼント！'}
              </div>
            </div>
          </div>
          {(hasClaimedBonus || justClaimed) && (
            <span className="text-xs bg-[#58CC02] text-white font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs shrink-0">
              <Check className="w-3.5 h-3.5" />
              1000⚡️済
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Main Action: 今すぐやってみる (1000⚡️ゲット！) */}
          <button
            onClick={handleOpenAppAndClaim}
            className="duo-btn duo-btn-green w-full py-4 px-4 rounded-2xl text-base font-black flex items-center justify-center gap-2.5 shadow-md cursor-pointer group"
          >
            <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>
              {hasClaimedBonus || justClaimed
                ? 'ティックエディション を開く 🎬🎮↗'
                : '今すぐやってみる（1000⚡️ゲット！）🎬🎮↗'}
            </span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="duo-btn duo-btn-gray w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#58CC02]" />
                <span className="text-[#58CC02]">リンクをコピーしました！</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#777777]" />
                <span>URLをコピーする 📋</span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Close Button to Continue Game */}
        <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold text-[#AFAFAF]">
            ページを開くたびにご案内中 🐟🍎
          </span>
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="duo-btn duo-btn-gray py-2 px-5 rounded-xl text-xs font-black cursor-pointer hover:bg-[#F0F0F0]"
          >
            うおwりんご を遊ぶ（閉じる）
          </button>
        </div>
      </div>
    </div>
  );
}

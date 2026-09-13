import { useState, useEffect } from 'react';
import { Ban, AlertTriangle, Clock, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { BanRecord } from '../types';
import { clearBanInfo, verifyAdminCode } from '../utils/adminAuth';
import { audio } from '../utils/audio';

interface BannedScreenProps {
  ban: BanRecord;
  onUnban: () => void;
}

export function BannedScreen({ ban, onUnban }: BannedScreenProps) {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [showAdminUnlock, setShowAdminUnlock] = useState<boolean>(false);
  const [adminCode, setAdminCode] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSuccess, setUnlockSuccess] = useState<boolean>(false);

  useEffect(() => {
    const updateCountdown = () => {
      if (ban.isPermanent || !ban.expiresAt) {
        setTimeLeftStr('永久 (無期限)');
        return;
      }

      const diff = ban.expiresAt - Date.now();
      if (diff <= 0) {
        clearBanInfo();
        onUnban();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeftStr(`${hours}時間 ${mins}分 ${secs}秒`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [ban, onUnban]);

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    audio.playTap();

    try {
      const res = await verifyAdminCode(adminCode);
      if (res.success) {
        setUnlockSuccess(true);
        audio.playCorrect();
        setTimeout(() => {
          clearBanInfo();
          onUnban();
        }, 700);
      } else {
        audio.playWrong();
        setUnlockError(res.error || 'コードが正しくありません。');
      }
    } catch {
      setUnlockError('認証処理エラーが発生しました。');
    }
  };

  return (
    <div 
      id="banned-screen"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1F1F] text-white overflow-y-auto select-none"
    >
      <div className="w-full max-w-lg bg-[#2B2B2B] rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-[#FF4B4B] text-center">
        
        {/* Large Ban Icon */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-[#FF4B4B]/20 border-2 border-[#FF4B4B] flex items-center justify-center text-[#FF4B4B] shadow-inner">
          <Ban className="w-12 h-12 animate-pulse" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          🚫 アカウント利用停止 (BAN)
        </h1>

        {/* Reload Violation Specific Warning (Requested in Prompt) */}
        {ban.bannedByReload && (
          <div className="mb-6 p-4 bg-[#FF4B4B]/20 border-3 border-[#FF4B4B] rounded-2xl text-left shadow-lg animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-[#FF4B4B] text-xl sm:text-2xl font-black mb-2">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <span>再読み込みが発見されました。</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#FF9E9E] leading-relaxed">
              BANルーレット実行中にページの再読み込み・離脱が検知されたため、ルール違反ペナルティとして即座にBANが執行されました。
            </p>
          </div>
        )}

        {/* Ban Details Card */}
        <div className="bg-[#202020] rounded-2xl p-4 border border-[#3C3C3C] text-left space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs font-bold border-b border-[#333333] pb-2">
            <span className="text-[#AFAFAF]">対象ユーザー</span>
            <span className="text-white font-mono">{ban.userName} ({ban.userId.slice(0, 10)}...)</span>
          </div>

          <div className="flex items-center justify-between text-xs font-bold border-b border-[#333333] pb-2">
            <span className="text-[#AFAFAF]">BAN種別</span>
            <span className="font-black text-[#FF4B4B]">{ban.isPermanent ? '永久BAN' : ban.durationLabel}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-bold border-b border-[#333333] pb-2">
            <span className="text-[#AFAFAF] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>残り時間</span>
            </span>
            <span className="font-black text-[#FFC800] font-mono text-sm">
              {timeLeftStr}
            </span>
          </div>

          <div className="text-xs font-bold">
            <span className="text-[#AFAFAF] block mb-1">事由:</span>
            <span className="text-[#E0E0E0] bg-[#1A1A1A] px-2.5 py-1.5 rounded-lg block font-mono text-[11px]">
              {ban.reason}
            </span>
          </div>
        </div>

        {/* Info Message */}
        <p className="text-xs font-bold text-[#888888] mb-6">
          利用停止期間が終了すると自動的にアクセスが復旧します。
        </p>

        {/* Admin Emergency Unlock Option */}
        {!showAdminUnlock ? (
          <button
            onClick={() => setShowAdminUnlock(true)}
            className="text-xs font-bold text-[#666666] hover:text-[#AFAFAF] transition-colors underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
          >
            <Lock className="w-3 h-3" />
            <span>管理者緊急解除</span>
          </button>
        ) : (
          <div className="mt-4 p-4 bg-[#1A1A1A] border border-[#444444] rounded-2xl text-left">
            <p className="text-xs font-bold text-[#AFAFAF] mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#1CB0F6]" />
              <span>管理者コードを入力してBANを即時解除:</span>
            </p>
            <form onSubmit={handleAdminUnlock} className="flex gap-2">
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="管理者コード"
                className="flex-1 px-3 py-2 bg-[#2B2B2B] border border-[#444444] rounded-xl text-xs font-bold text-white focus:outline-hidden focus:border-[#1CB0F6]"
              />
              <button
                type="submit"
                disabled={!adminCode.trim()}
                className="px-4 py-2 bg-[#1CB0F6] hover:bg-[#1899D6] disabled:bg-[#444444] text-white text-xs font-black rounded-xl cursor-pointer"
              >
                解除
              </button>
            </form>
            {unlockError && (
              <p className="text-[11px] font-bold text-[#FF4B4B] mt-2">
                {unlockError}
              </p>
            )}
            {unlockSuccess && (
              <p className="text-[11px] font-bold text-[#58CC02] mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>BANを解除しました！再起動します...</span>
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

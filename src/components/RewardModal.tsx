import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  Star, 
  Heart, 
  Gift, 
  Copy, 
  Check, 
  Sparkles, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { UserStats } from '../types';
import { audio } from '../utils/audio';
import { realtimePresence } from '../utils/multiplayer';

interface RewardModalProps {
  stats: UserStats;
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onClose: () => void;
}

interface RewardStatus {
  likes: number;
  currentCode: string;
  nextCode: string;
  nextThreshold: number;
  remainingLikes: number;
  bonusNum: number;
}

export function RewardModal({
  stats,
  onUpdateStats,
  onClose,
}: RewardModalProps) {
  // Reward code and like stats from server
  const [rewardStatus, setRewardStatus] = useState<RewardStatus>({
    likes: 180,
    currentCode: 'bonus1',
    nextCode: 'bonus2',
    nextThreshold: 1000,
    remainingLikes: 820,
    bonusNum: 1,
  });

  const [inputCode, setInputCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [claimErrorMessage, setClaimErrorMessage] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const nextHeartId = useRef(1);

  // Sync reward status from server
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/rewards/status');
      if (res.ok) {
        const data = await res.json();
        setRewardStatus({
          likes: data.likes,
          currentCode: data.currentCode,
          nextCode: data.nextCode,
          nextThreshold: data.nextThreshold,
          remainingLikes: data.remainingLikes,
          bonusNum: data.bonusNum,
        });
      }
    } catch {
      // Fallback in case server is unavailable
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Listen to real-time events from WebSocket / SSE
    const unsubscribe = realtimePresence.subscribe((event) => {
      if (event.type === 'REWARDS_LIKES_UPDATED') {
        setRewardStatus({
          likes: event.likes,
          currentCode: event.currentCode,
          nextCode: event.nextCode,
          nextThreshold: event.nextThreshold,
          remainingLikes: event.remainingLikes,
          bonusNum: event.bonusNum,
        });
      }
    });

    // Periodic online sync polling as live fallback
    const pollTimer = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
    };
  }, [fetchStatus]);

  // Handle Like Button click (Can be pressed indefinitely!)
  const handleLike = async () => {
    audio.playTap();

    // Spawn floating heart effect
    const heartId = nextHeartId.current++;
    const randomX = Math.floor(Math.random() * 60) - 30;
    setFloatingHearts((prev) => [...prev, { id: heartId, x: randomX }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 900);

    // Optimistically update local count
    setRewardStatus((prev) => {
      const newLikes = prev.likes + 1;
      const THRESHOLD = 1000;
      let currentCode = 'bonus1';
      let nextCode = 'bonus2';
      let nextThreshold = THRESHOLD;
      let remaining = Math.max(0, THRESHOLD - newLikes);
      let bonusNum = 1;

      if (newLikes >= THRESHOLD) {
        bonusNum = 1 + Math.floor(newLikes / THRESHOLD);
        currentCode = `bonus${bonusNum}`;
        nextCode = `bonus${bonusNum + 1}`;
        nextThreshold = bonusNum * THRESHOLD;
        remaining = Math.max(0, nextThreshold - newLikes);
      }

      return {
        likes: newLikes,
        currentCode,
        nextCode,
        nextThreshold,
        remainingLikes: remaining,
        bonusNum,
      };
    });

    try {
      const res = await fetch('/api/rewards/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRewardStatus({
          likes: data.likes,
          currentCode: data.currentCode,
          nextCode: data.nextCode,
          nextThreshold: data.nextThreshold,
          remainingLikes: data.remainingLikes,
          bonusNum: data.bonusNum,
        });
      }
    } catch {
      // Ignore network error
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    audio.playTap();
    navigator.clipboard.writeText(code);
    setInputCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Claim Code
  const handleClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setClaimErrorMessage(null);
    setClaimSuccessMessage(null);

    const trimmed = inputCode.trim();
    if (!trimmed) {
      setClaimErrorMessage('コードを入力してください');
      return;
    }

    const claimedList = stats.claimedBonusCodes || [];
    const lower = trimmed.toLowerCase();

    // Check if code was already claimed by user
    if (claimedList.includes(lower)) {
      setClaimErrorMessage(`コード「${trimmed}」はすでに受け取り済みです。`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setClaimErrorMessage(data.error || '無効なコードです。');
        setIsSubmitting(false);
        return;
      }

      // Success
      audio.playCorrect();
      const claimedCodeKey = data.code || lower;
      onUpdateStats({
        energy: stats.energy + (data.rewardEnergy || 100),
        claimedBonusCodes: [...claimedList, claimedCodeKey],
      });

      setClaimSuccessMessage(data.message || `🎉 100⚡️ を獲得しました！`);
      setInputCode('');
    } catch {
      // Local fallback check
      if (lower === rewardStatus.currentCode.toLowerCase()) {
        audio.playCorrect();
        onUpdateStats({
          energy: stats.energy + 100,
          claimedBonusCodes: [...claimedList, lower],
        });
        setClaimSuccessMessage(`🎉 100⚡️ を獲得しました！`);
        setInputCode('');
      } else {
        setClaimErrorMessage('通信に失敗したか、無効なコードです。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate progress percentage to next code (1000 likes per tier)
  const THRESHOLD_STEP = 1000;
  const currentTierStart = (rewardStatus.bonusNum - 1) * THRESHOLD_STEP;
  const currentTierTarget = rewardStatus.nextThreshold;
  const tierTotal = currentTierTarget - currentTierStart;
  const tierProgress = Math.min(tierTotal, Math.max(0, rewardStatus.likes - currentTierStart));
  const progressPercent = Math.min(100, Math.round((tierProgress / tierTotal) * 100));

  const isCurrentClaimed = (stats.claimedBonusCodes || []).includes(rewardStatus.currentCode.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl border-2 border-[#E5E5E5] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7] to-[#FFF7ED] border-b-2 border-[#FDE68A] p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B] text-white flex items-center justify-center shadow-sm">
              <Star className="w-6 h-6 fill-white text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#78350F] flex items-center gap-1.5">
                報酬 & スペシャルリワード
              </h2>
              <p className="text-xs font-bold text-[#B45309]">
                みんなの「いいね」でコードが更新されるオンラインリワード！
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white text-[#78350F] flex items-center justify-center border border-[#FDE68A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Section 1: Online Likes & Progress */}
          <div className="bg-[#FFFDF7] border-2 border-[#FEF08A] rounded-2xl p-4 sm:p-5 relative shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💖</span>
                <span className="text-sm font-black text-[#713F12]">みんなの「いいね」総数</span>
              </div>
              <span className="text-[11px] font-bold bg-[#ECFDF5] text-[#047857] px-2.5 py-0.5 rounded-full border border-[#A7F3D0] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                オンライン同期中
              </span>
            </div>

            {/* Like Counter & Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-2">
              <div>
                <div className="text-3xl sm:text-4xl font-black text-[#EA580C] font-mono-code flex items-baseline gap-1.5">
                  {rewardStatus.likes.toLocaleString()}
                  <span className="text-sm font-bold text-[#A16207]">いいね</span>
                </div>
                <p className="text-xs text-[#854D0E] mt-0.5">
                  誰でも何回でも押せます！みんなで協力して増やそう！
                </p>
              </div>

              {/* Big Interactive Like Button with Floating Hearts */}
              <div className="relative inline-block self-start sm:self-center">
                <button
                  id="reward-like-button"
                  onClick={handleLike}
                  className="relative group px-5 py-3 rounded-2xl bg-gradient-to-b from-[#FF4B4B] to-[#E02424] hover:from-[#FF5E5E] hover:to-[#EB3B3B] active:scale-95 text-white font-black text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
                >
                  <Heart className="w-5 h-5 fill-white animate-bounce" />
                  <span>いいね！を押す</span>
                </button>

                {/* Floating hearts animation */}
                {floatingHearts.map((h) => (
                  <span
                    key={h.id}
                    className="absolute pointer-events-none text-xl animate-float-up"
                    style={{
                      left: `calc(50% + ${h.x}px)`,
                      bottom: '30px',
                    }}
                  >
                    ❤️
                  </span>
                ))}
              </div>
            </div>

            {/* Progress to next threshold */}
            <div className="mt-4 pt-4 border-t border-[#FEF08A]">
              <div className="flex items-center justify-between text-xs font-bold text-[#713F12] mb-1.5">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#D97706]" />
                  次のコード（{rewardStatus.nextCode}）まで
                </span>
                <span className="text-[#EA580C] font-black">
                  あと <span className="font-mono text-sm underline">{rewardStatus.remainingLikes}</span> いいね！
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3.5 bg-[#FEF9C3] rounded-full overflow-hidden border border-[#FDE047] p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-[#A16207] mt-1 font-mono">
                <span>{currentTierStart} いいね</span>
                <span>{rewardStatus.nextThreshold} いいねで更新</span>
              </div>
            </div>
          </div>

          {/* Section 2: Current Unlocked Code Card */}
          <div className="bg-gradient-to-br from-[#FEFCE8] to-[#FFFBEB] border-2 border-[#FDE68A] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#92400E]">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                <span>現在解放中のプレゼントコード</span>
              </div>
              <span className="text-[11px] font-black bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full border border-[#FDE68A]">
                報酬: 100⚡️
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-[#FDE047] rounded-xl p-3.5 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center font-mono font-black text-xl border border-[#FDE68A]">
                  🎁
                </div>
                <div>
                  <div className="text-2xl font-black text-[#78350F] tracking-wider font-mono">
                    {rewardStatus.currentCode}
                  </div>
                  <p className="text-[11px] font-bold text-[#B45309]">
                    {isCurrentClaimed ? '✅ あなたは受取済みです' : '⚡️ 入力で100⚡️プレゼント！'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleCopyCode(rewardStatus.currentCode)}
                className="px-3.5 py-2 rounded-xl bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span className="text-[#16A34A]">コピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>コードをコピー</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-[#A16207] mt-2.5">
              ※ いいねが1,000で「bonus2」に更新され、以降は1,000いいね変わるごとに次のコード（bonus3, bonus4...）へ更新されます。
            </p>
          </div>

          {/* Section 3: Code Redemption Form */}
          <div className="bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-black text-[#1E293B] mb-2 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-[#3B82F6]" />
              <span>コードを入力して報酬を受け取る</span>
            </h3>

            <form onSubmit={handleClaim} className="flex gap-2 mt-3">
              <input
                id="reward-code-input"
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="コードを入力 (例: bonus1)"
                className="flex-1 bg-white border-2 border-[#CBD5E1] focus:border-[#3B82F6] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#1E293B] outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputCode.trim()}
                className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center ${
                  isSubmitting || !inputCode.trim()
                    ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                    : 'bg-[#3B82F6] hover:bg-[#2563EB] active:scale-95 text-white shadow-xs cursor-pointer'
                }`}
              >
                {isSubmitting ? '確認中...' : '受け取る'}
              </button>
            </form>

            {/* Error Message */}
            {claimErrorMessage && (
              <div className="mt-3 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs font-bold text-[#DC2626] flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{claimErrorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {claimSuccessMessage && (
              <div className="mt-3 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs font-bold text-[#16A34A] flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 shrink-0" />
                <span>{claimSuccessMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end">
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#334155] font-black text-sm transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

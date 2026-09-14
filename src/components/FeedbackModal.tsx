import { useState } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Bug, 
  Lightbulb, 
  Sparkles 
} from 'lucide-react';
import { UserStats, FeedbackType, FeedbackReport } from '../types';
import { audio } from '../utils/audio';
import { saveFeedbackReport, getTodayDateString } from '../utils/firebase';

interface FeedbackModalProps {
  currentUser: UserStats;
  onSpendEnergy: (amount: number) => void;
  onRecordFeedbackSubmit: () => void;
  onClose: () => void;
}

export function FeedbackModal({
  currentUser,
  onSpendEnergy,
  onRecordFeedbackSubmit,
  onClose,
}: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);

  // Daily quota calculations
  const todayKey = getTodayDateString();
  const isDateCurrent = currentUser.feedbackDate === todayKey;
  const usedToday = isDateCurrent ? (currentUser.feedbackCountToday || 0) : 0;
  const extraQuota = isDateCurrent ? (currentUser.extraFeedbackQuota || 0) : 0;
  
  // Base 2 free per day + extra purchased
  const totalLimitToday = 2 + extraQuota;
  const remainingToday = Math.max(0, totalLimitToday - usedToday);

  // Quick suggestion chips
  const bugTemplates = [
    '問題文の誤字・誤答があります',
    '音声が再生されませんでした',
    'ボタンを押しても反応しませんでした',
    '画面の表示が崩れました',
  ];

  const featureTemplates = [
    '英検準2級・3級の問題が欲しい！',
    '間違えた単語の復習帳が欲しい！',
    'もっと文房具グッズを増やしてほしい！',
    'フレンド対戦機能が欲しい！',
  ];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Consume 25 ⚡️ to increase submission quota by +1
  const handleBoostQuotaWithEnergy = () => {
    audio.playTap();
    if (currentUser.energy < 25) {
      showNotification('error', `⚡️が足りません（必要: 25⚡️ / 現在: ${currentUser.energy}⚡️）。学習して⚡️を貯めましょう！`);
      return;
    }

    onSpendEnergy(25);
    audio.playEnergyGet();
    showNotification('success', '⚡️ 25⚡️を使って、本日の送信枠を+1回追加しました！');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    audio.playTap();

    const trimmed = content.trim();
    if (!trimmed) {
      showNotification('error', '内容を入力してください。');
      return;
    }
    if (trimmed.length > 100) {
      showNotification('error', '内容は100文字以内で入力してください。');
      return;
    }
    if (remainingToday <= 0) {
      showNotification('error', '本日の送信枠を使い切りました。25⚡️を使って枠を追加できます。');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const report: FeedbackReport = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: currentUser.userId || 'guest_user',
        userName: currentUser.userName || 'うおリンゴ受講生',
        type: selectedType,
        typeName: selectedType === 'bug' ? 'バグ報告' : '追加してほしい要素',
        content: trimmed,
        createdAt: Date.now(),
        formattedDate,
      };

      await saveFeedbackReport(report);
      onRecordFeedbackSubmit();

      audio.playCorrect();
      setIsSubmittedSuccess(true);
      setContent('');
    } catch (err) {
      console.error('Failed to submit report:', err);
      showNotification('error', '送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="feedback-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border-4 border-[#3C3C3C] my-auto flex flex-col relative max-h-[94vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF9E6] border-2 border-[#FFD966] text-[#A57800] flex items-center justify-center text-xl shadow-xs shrink-0">
              📃
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#3C3C3C] flex items-center gap-1.5">
                <span>アンケート / バグ報告</span>
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                不具合の報告や、追加してほしい要素をお送りください
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="p-2 rounded-xl text-[#777777] hover:text-[#3C3C3C] hover:bg-[#F7F7F7] transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`mb-3 p-3 rounded-2xl text-xs font-black flex items-center gap-2 animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-[#EEFDF0] border-2 border-[#58CC02] text-[#58CC02]'
              : 'bg-[#FFF0F0] border-2 border-[#FF4B4B] text-[#FF4B4B]'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Success Screen after submission */}
        {isSubmittedSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#EEFDF0] border-4 border-[#58CC02] text-[#58CC02] mx-auto flex items-center justify-center text-3xl shadow-md animate-bounce">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-black text-[#3C3C3C]">
                送信が完了しました！
              </h3>
              <p className="text-xs font-bold text-[#777777] mt-1 max-w-sm mx-auto">
                貴重なご意見・バグ報告ありがとうございます。<br />
                管理者が確認し、今後の改善に役立てさせていただきます！
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setIsSubmittedSuccess(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#F7F7F7] hover:bg-[#EAEAEA] border-2 border-[#E5E5E5] text-xs font-black text-[#4B4B4B] cursor-pointer"
              >
                続けてもう1件書く
              </button>
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-[#58CC02] hover:bg-[#46A302] border-b-4 border-[#3D8C02] text-xs font-black text-white cursor-pointer active:translate-y-0.5"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Category Selector (バグ報告 / 追加してほしい要素) */}
            <div>
              <label className="block text-xs font-black text-[#4B4B4B] mb-2 uppercase tracking-wide">
                1. 報告カテゴリーを選択
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setSelectedType('bug');
                  }}
                  className={`p-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    selectedType === 'bug'
                      ? 'bg-[#FFF0F0] border-[#FF4B4B] text-[#FF4B4B] shadow-xs ring-2 ring-[#FF4B4B]/20'
                      : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <Bug className="w-4 h-4" />
                  <span>🐛 バグ報告</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setSelectedType('feature');
                  }}
                  className={`p-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    selectedType === 'feature'
                      ? 'bg-[#EBF7FD] border-[#1CB0F6] text-[#1CB0F6] shadow-xs ring-2 ring-[#1CB0F6]/20'
                      : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>💡 追加してほしい要素</span>
                </button>
              </div>
            </div>

            {/* Quota & 25⚡️ Boost Info Banner */}
            <div className="p-3 bg-[#FFFDF0] border-2 border-[#FFE885] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#735A00]">
                  <span>📅 本日の残り送信回数:</span>
                  <span className="text-sm font-black px-2 py-0.5 rounded-lg bg-white border border-[#FFD966] text-[#FF9600] font-mono">
                    {remainingToday} / {totalLimitToday}回
                  </span>
                  {extraQuota > 0 && (
                    <span className="text-[10px] font-bold text-[#58CC02] bg-white px-1.5 py-0.5 rounded-md border border-[#58CC02]">
                      +{extraQuota}回追加済
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-bold text-[#A57800]">
                  1日2回まで無料
                </div>
              </div>

              {/* 25⚡️ Boost Action */}
              <div className="pt-2 border-t border-[#FFECA0] flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] font-bold text-[#735A00] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#FF9600]" />
                  <span>25⚡️を使って送信枠を+1回追加できます</span>
                  <span className="text-[10px] font-mono text-[#888888]">
                    (所持: ⚡️{currentUser.energy})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBoostQuotaWithEnergy}
                  className="px-3 py-1.5 rounded-xl bg-[#FF9600] hover:bg-[#E08500] border-b-2 border-[#C77400] text-white text-xs font-black cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <span>⚡️ 25⚡️で枠+1回追加</span>
                </button>
              </div>
            </div>

            {/* Quick Suggestions */}
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#777777] mb-1.5">
                <Sparkles className="w-3 h-3 text-[#FF9600]" />
                <span>よくあるテンプレート（タップで入力）:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedType === 'bug' ? bugTemplates : featureTemplates).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setContent(t.slice(0, 100));
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#F7F7F7] hover:bg-[#EEEEEE] border border-[#E5E5E5] text-[#555555] cursor-pointer transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Area (100 chars limit) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-[#4B4B4B] uppercase tracking-wide">
                  2. 内容を入力 (100文字以内)
                </label>
                <span className={`text-xs font-mono font-black ${
                  content.length >= 100
                    ? 'text-[#FF4B4B]'
                    : content.length >= 80
                    ? 'text-[#FF9600]'
                    : 'text-[#888888]'
                }`}>
                  {content.length} / 100文字
                </span>
              </div>

              <textarea
                value={content}
                maxLength={100}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  selectedType === 'bug'
                    ? '例: レッスン2の問題で音声ボタンを押しても音が鳴りませんでした。（100文字以内）'
                    : '例: 英検3級の問題や、単語帳モードを追加してほしいです！（100文字以内）'
                }
                rows={4}
                className="w-full p-3 bg-[#F9F9F9] border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-2xl text-xs sm:text-sm font-bold text-[#3C3C3C] outline-hidden resize-none placeholder:text-[#AFAFAF]"
              />
              <p className="text-[10px] font-bold text-[#888888] mt-1">
                ※ 投稿者名として「{currentUser.userName || 'うおリンゴ受講生'}」が記録されます。
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  onClose();
                }}
                className="flex-1 py-3 rounded-2xl bg-[#F7F7F7] hover:bg-[#EAEAEA] border-2 border-[#E5E5E5] text-xs font-black text-[#777777] cursor-pointer"
              >
                キャンセル
              </button>

              <button
                id="submit-feedback-btn"
                type="submit"
                disabled={isSubmitting || !content.trim() || content.length > 100 || remainingToday <= 0}
                className={`flex-2 py-3 rounded-2xl font-black text-xs sm:text-sm text-white flex items-center justify-center gap-1.5 transition-all ${
                  isSubmitting || !content.trim() || content.length > 100 || remainingToday <= 0
                    ? 'bg-[#CCCCCC] border-b-4 border-[#AAAAAA] cursor-not-allowed'
                    : 'bg-[#58CC02] hover:bg-[#46A302] border-b-4 border-[#3D8C02] active:translate-y-1 active:border-b-0 cursor-pointer shadow-md'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? '送信中...' : '送信する (100文字以内)'}</span>
              </button>
            </div>

            {remainingToday <= 0 && (
              <p className="text-center text-xs font-black text-[#FF4B4B]">
                ⚠️ 本日の無料送信枠（2回）を使い切りました。上の「25⚡️で枠追加」をご利用ください。
              </p>
            )}

          </form>
        )}

      </div>
    </div>
  );
}

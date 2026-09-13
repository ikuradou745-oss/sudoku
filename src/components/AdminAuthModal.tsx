import { useState } from 'react';
import { ShieldAlert, KeyRound, Eye, EyeOff, X, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { verifyAdminCode } from '../utils/adminAuth';
import { audio } from '../utils/audio';

interface AdminAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminAuthModal({ onClose, onSuccess }: AdminAuthModalProps) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setErrorMessage(null);
    audio.playTap();

    try {
      const result = await verifyAdminCode(code);
      if (result.success) {
        setIsSuccess(true);
        audio.playCorrect();
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        audio.playWrong();
        setErrorMessage(result.error || '認証に失敗しました。');
      }
    } catch {
      setErrorMessage('認証処理中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="admin-auth-modal"
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border-4 border-[#E5E5E5] relative"
      >
        {/* Close Button */}
        <button
          onClick={() => {
            audio.playTap();
            onClose();
          }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-[#777777] hover:text-[#3C3C3C] hover:bg-[#EBEBEB] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0F0] border-2 border-[#FFCACA] flex items-center justify-center text-[#FF4B4B] shrink-0 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#3C3C3C] tracking-tight">
              管理者 本人認証
            </h2>
            <p className="text-xs font-bold text-[#AFAFAF]">
              厳重なセキュリティゲート
            </p>
          </div>
        </div>

        {/* Security Info Badge */}
        <div className="mb-4 p-3 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#777777] shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-[#777777] leading-relaxed">
            管理者パネルにアクセスするための本人認証です。認証コードはSHA-256暗号化ハッシュにより保護されています。
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-[#4B4B4B] mb-1.5 uppercase tracking-wider">
              認証コード
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AFAFAF]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="admin-auth-code-input"
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="管理者コードを入力"
                autoComplete="off"
                autoFocus
                className="w-full pl-10 pr-11 py-3 bg-[#F7F7F7] border-2 border-[#E5E5E5] focus:border-[#1CB0F6] focus:bg-white rounded-2xl text-sm font-bold text-[#3C3C3C] outline-hidden transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#AFAFAF] hover:text-[#3C3C3C] transition-colors cursor-pointer"
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-[#FFF0F0] border-2 border-[#FFCACA] rounded-2xl flex items-center gap-2 text-[#FF4B4B] text-xs font-bold animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3 bg-[#EEFDF0] border-2 border-[#B6F5BC] rounded-2xl flex items-center gap-2 text-[#58CC02] text-xs font-black">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>認証成功！管理者パネルを起動します...</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="admin-auth-submit-btn"
            type="submit"
            disabled={loading || !code.trim() || isSuccess}
            className="w-full py-3.5 rounded-2xl bg-[#FF4B4B] hover:bg-[#E53E3E] disabled:bg-[#E5E5E5] disabled:cursor-not-allowed border-b-4 border-[#CC3B3B] disabled:border-b-0 text-white font-black text-sm tracking-wide shadow-md active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>認証してアクセス</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

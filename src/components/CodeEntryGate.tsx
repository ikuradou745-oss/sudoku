import { useState, useEffect, useRef } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
import { verifyPasscodeStrict } from '../utils/security';

interface CodeEntryGateProps {
  onUnlockSuccess: () => void;
}

export function CodeEntryGate({ onUnlockSuccess }: CodeEntryGateProps) {
  const [code, setCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutTimer, setLockoutTimer] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0 || isVerifying) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage('コードを入力してください');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const result = await verifyPasscodeStrict(trimmed);

      if (result.success) {
        onUnlockSuccess();
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);

        if (nextFailed >= 5) {
          setLockoutTimer(30);
          setErrorMessage('【厳重ロック】連続試行失敗のため30秒間ロックされました');
        } else {
          setErrorMessage(`コードが違います (残り試行: ${5 - nextFailed}回)`);
        }
      }
    } catch {
      setErrorMessage('認証処理中にエラーが発生しました');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Main Clean Pop Card */}
      <div 
        id="code-entry-card"
        className="duo-card p-6 sm:p-8"
      >
        {/* Top Minimal Badge Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-xs">
            <KeyRound className="w-8 h-8" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#3C3C3C] tracking-tight">
            コードを入力
          </h1>
          <p className="text-sm font-bold text-[#AFAFAF] mt-1">
            キーボードで入力して突破してください
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              ref={inputRef}
              id="code-input"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={lockoutTimer > 0 || isVerifying}
              placeholder="コードを入力"
              autoFocus
              className="duo-input w-full h-14 px-4 text-center text-xl font-mono-code tracking-wider"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div 
              id="error-message-box"
              className="p-3 bg-[#FFF0F0] border-2 border-[#FFD0D0] text-[#FF4B4B] text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Lockout notice */}
          {lockoutTimer > 0 && (
            <div className="text-center text-xs font-black text-[#FF4B4B] font-mono-code">
              解除まで: {lockoutTimer}秒
            </div>
          )}

          {/* Submit Button */}
          <button
            id="submit-code-button"
            type="submit"
            disabled={lockoutTimer > 0 || isVerifying}
            className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center disabled:opacity-50"
          >
            {isVerifying ? 'チェック中...' : '突破する'}
          </button>
        </form>
      </div>
    </div>
  );
}

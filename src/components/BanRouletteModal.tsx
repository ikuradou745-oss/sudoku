import { useState, useEffect, useRef } from 'react';
import { AlertOctagon, RefreshCw, ShieldCheck, Skull, Flame } from 'lucide-react';
import { BanRouletteTriggerEvent, BanRecord } from '../types';
import { markInBanRoulette, clearInBanRouletteFlag, saveBanInfo } from '../utils/adminAuth';
import { recordFirebaseBan } from '../utils/firebase';
import { audio } from '../utils/audio';

interface BanRouletteModalProps {
  event: BanRouletteTriggerEvent;
  currentUserId: string;
  currentUserName: string;
  onSafeResolved: () => void;
  onBanResolved: (ban: BanRecord) => void;
}

export function BanRouletteModal({
  event,
  currentUserId,
  currentUserName,
  onSafeResolved,
  onBanResolved,
}: BanRouletteModalProps) {
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [outcome, setOutcome] = useState<'safe' | 'ban' | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);

  const tickIntervalRef = useRef<any>(null);

  const isTargetSelf = event.targetType === 'all' || event.targetUserId === currentUserId;
  const targetUid = (event.targetType === 'single' && event.targetUserId) ? event.targetUserId : currentUserId;
  const targetName = (event.targetType === 'single' && event.targetUserName) ? event.targetUserName : currentUserName;

  // 1. Immediately mark that the user is inside BAN Roulette.
  // If they reload now or during the spin, it will trigger instant BAN on next load!
  useEffect(() => {
    if (isTargetSelf) {
      markInBanRoulette(event);
    }
    audio.playRouletteAlarm();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isTargetSelf) {
        e.preventDefault();
        e.returnValue = 'ルーレット中に離脱または再読み込みすると即座にBANされます！';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [event, isTargetSelf]);

  // Handle Spinning the Wheel
  const handleSpinWheel = () => {
    if (spinning || hasSpun) return;

    setSpinning(true);
    audio.playTap();

    // 50% probability calculation (50% Safe, 50% BAN)
    const isSafe = Math.random() < 0.5;
    const finalOutcome: 'safe' | 'ban' = isSafe ? 'safe' : 'ban';

    // Total full revolutions (6 to 8 spins)
    const fullSpins = 360 * 7;

    // Slices: 4 quadrants of 90 degrees each
    // Quadrant 0 (0-90°): SAFE
    // Quadrant 1 (90-180°): BAN
    // Quadrant 2 (180-270°): SAFE
    // Quadrant 3 (270-360°): BAN
    // Pointer is at the top (0° / 360°).
    // Target slice angle offset with a little random jitter in the slice center:
    const jitter = (Math.random() - 0.5) * 40; // -20° to +20°
    let targetAngle = 0;

    if (finalOutcome === 'safe') {
      // Pick either quadrant 0 (center 45°) or quadrant 2 (center 225°)
      const q = Math.random() < 0.5 ? 45 : 225;
      targetAngle = (360 - q + jitter) % 360;
    } else {
      // Pick either quadrant 1 (center 135°) or quadrant 3 (center 315°)
      const q = Math.random() < 0.5 ? 135 : 315;
      targetAngle = (360 - q + jitter) % 360;
    }

    const totalTargetRotation = wheelRotation + fullSpins + targetAngle;
    setWheelRotation(totalTargetRotation);

    // Audio ticking effect that gradually slows down
    let tickCount = 0;
    const startTick = Date.now();
    const duration = 4500; // 4.5 seconds

    const runTicking = () => {
      const elapsed = Date.now() - startTick;
      if (elapsed < duration) {
        // Ticks become less frequent as time goes on
        audio.playRouletteTick(1 + (1 - elapsed / duration) * 0.5);
        tickCount++;
        const nextDelay = 50 + Math.pow(elapsed / duration, 2.5) * 350;
        tickIntervalRef.current = setTimeout(runTicking, nextDelay);
      }
    };
    runTicking();

    // Finish spin after 4.5s animation completes
    setTimeout(() => {
      if (tickIntervalRef.current) {
        clearTimeout(tickIntervalRef.current);
      }
      setSpinning(false);
      setHasSpun(true);
      setOutcome(finalOutcome);

      if (finalOutcome === 'safe') {
        if (isTargetSelf) clearInBanRouletteFlag();
        audio.playRouletteFanfare();
      } else {
        // BAN confirmed!
        if (isTargetSelf) clearInBanRouletteFlag();
        audio.playRouletteAlarm();

        const isPermanent = Boolean(event.isPermanent);
        const durationMinutes = event.durationMinutes || 60;
        const expiresAt = isPermanent ? null : Date.now() + durationMinutes * 60 * 1000;

        const banRecord: BanRecord = {
          id: `ban_roulette_${Date.now()}`,
          userId: targetUid,
          userName: targetName,
          isPermanent,
          bannedAt: Date.now(),
          expiresAt,
          durationMinutes,
          durationLabel: event.durationLabel || `${durationMinutes}分`,
          reason: 'BANルーレットによる処罰確定',
          bannedByReload: false,
        };

        recordFirebaseBan(banRecord);

        if (isTargetSelf) {
          saveBanInfo(banRecord);
        }
      }
    }, 4500);
  };

  const handleFinishSafe = () => {
    if (isTargetSelf) clearInBanRouletteFlag();
    onSafeResolved();
  };

  const handleAcknowledgeBan = () => {
    const isPermanent = Boolean(event.isPermanent);
    const durationMinutes = event.durationMinutes || 60;
    const expiresAt = isPermanent ? null : Date.now() + durationMinutes * 60 * 1000;

    const banRecord: BanRecord = {
      id: `ban_roulette_${Date.now()}`,
      userId: targetUid,
      userName: targetName,
      isPermanent,
      bannedAt: Date.now(),
      expiresAt,
      durationMinutes,
      durationLabel: event.durationLabel || `${durationMinutes}分`,
      reason: 'BANルーレットによる処罰確定',
      bannedByReload: false,
    };

    recordFirebaseBan(banRecord);

    if (isTargetSelf) {
      onBanResolved(banRecord);
    } else {
      onSafeResolved();
    }
  };

  return (
    <div 
      id="ban-roulette-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border-4 border-[#FF4B4B] text-center relative animate-in zoom-in-95 duration-200">
        
        {/* Top Emergency Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF0F0] border-2 border-[#FFCACA] text-[#FF4B4B] text-xs font-black mb-4 animate-pulse">
          <AlertOctagon className="w-4 h-4" />
          <span>緊急事態: BANルーレット発動</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-[#3C3C3C] tracking-tight mb-2">
          🎲 BANルーレット
        </h1>

        {/* Notice Requirements from User Request */}
        <div className="text-sm font-bold text-[#4B4B4B] mb-3 leading-relaxed">
          <p className="text-xs font-black text-[#1CB0F6] mb-1">
            {event.targetType === 'all' ? '【対象: オンライン全員】' : `【対象: ${targetName}】`}
          </p>
          <p>
            {isTargetSelf
              ? 'あなたはBAN対象に入ったのでルーレットをやってもらいます。'
              : `「${targetName}」へのBAN処罰ルーレットを執行します。`}
            <br />
            <span className="text-[#58CC02] font-black">50%でセーフ</span>、
            <span className="text-[#FF4B4B] font-black">50%でBAN</span> です。
          </p>
        </div>

        {/* Explicit Large Red Warning text requested by user */}
        <div className="mb-5 p-3.5 bg-[#FFF0F0] border-3 border-[#FF4B4B] rounded-2xl shadow-xs">
          <p className="text-lg sm:text-xl font-black text-[#FF4B4B] leading-tight flex items-center justify-center gap-2">
            <Flame className="w-5 h-5 shrink-0 animate-bounce" />
            <span>そして、ルーレット中に再読み込みをしたらBANされます。</span>
          </p>
          <p className="text-[11px] font-bold text-[#FF6B6B] mt-1">
            （※ページ更新・タブ閉じ・画面離脱は即座に検知されペナルティとなります）
          </p>
        </div>

        {/* Penalty details */}
        <div className="mb-4 inline-block px-3 py-1 bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#777777]">
          <span>BAN対象期間: </span>
          <span className="font-black text-[#3C3C3C]">{event.durationLabel || '指定期間'}</span>
        </div>

        {/* The Animated Wheel Container */}
        <div className="relative w-64 h-64 mx-auto mb-6 flex items-center justify-center">
          {/* Top Indicator Needle */}
          <div className="absolute -top-3 z-30 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#FF9600] drop-shadow-md" />
            <div className="w-3 h-3 rounded-full bg-[#CC7A00] -mt-1 shadow-sm" />
          </div>

          {/* Wheel Frame */}
          <div className="w-60 h-60 rounded-full border-8 border-[#3C3C3C] shadow-2xl overflow-hidden relative bg-[#3C3C3C]">
            {/* Spinning Wheel */}
            <div
              id="roulette-wheel-disc"
              className="w-full h-full rounded-full relative"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? 'transform 4.5s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none',
              }}
            >
              {/* Quadrant 1: Top-Right (0-90 deg) -> SAFE (Green) */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(#58CC02 0deg 90deg, #FF4B4B 90deg 180deg, #58CC02 180deg 270deg, #FF4B4B 270deg 360deg)',
                }}
              />

              {/* Quadrant Labels with Rotation */}
              {/* Slice 0 (SAFE) */}
              <div 
                className="absolute inset-0 flex items-start justify-center pt-5"
                style={{ transform: 'rotate(45deg)' }}
              >
                <span className="text-white font-black text-sm tracking-wider drop-shadow-md">
                  🟢 SAFE
                </span>
              </div>

              {/* Slice 1 (BAN) */}
              <div 
                className="absolute inset-0 flex items-start justify-center pt-5"
                style={{ transform: 'rotate(135deg)' }}
              >
                <span className="text-white font-black text-sm tracking-wider drop-shadow-md">
                  🔴 BAN
                </span>
              </div>

              {/* Slice 2 (SAFE) */}
              <div 
                className="absolute inset-0 flex items-start justify-center pt-5"
                style={{ transform: 'rotate(225deg)' }}
              >
                <span className="text-white font-black text-sm tracking-wider drop-shadow-md">
                  🟢 SAFE
                </span>
              </div>

              {/* Slice 3 (BAN) */}
              <div 
                className="absolute inset-0 flex items-start justify-center pt-5"
                style={{ transform: 'rotate(315deg)' }}
              >
                <span className="text-white font-black text-sm tracking-wider drop-shadow-md">
                  🔴 BAN
                </span>
              </div>

              {/* Dividing Lines */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-1 bg-white/40 shadow-xs" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-full w-1 bg-white/40 shadow-xs" />
              </div>

              {/* Center Hub */}
              <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white border-4 border-[#3C3C3C] flex items-center justify-center shadow-lg z-20">
                <span className="text-xl">🐟🎲</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outcome Results */}
        {outcome === 'safe' && (
          <div className="mb-5 p-4 bg-[#EEFDF0] border-3 border-[#58CC02] rounded-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-center gap-2 text-[#58CC02] text-xl font-black mb-1">
              <ShieldCheck className="w-7 h-7" />
              <span>セーフ！危機を回避しました！</span>
            </div>
            <p className="text-xs font-bold text-[#2E7D32]">
              50%の勝負に勝ちました！BANは免除されます。引き続き英語学習をお楽しみください。
            </p>
            <button
              onClick={handleFinishSafe}
              className="mt-3 w-full py-3 bg-[#58CC02] hover:bg-[#46A302] border-b-4 border-[#3F9402] text-white font-black text-sm rounded-2xl shadow-md cursor-pointer transition-all active:translate-y-0.5 active:border-b-0"
            >
              閉じて学習に戻る ✨
            </button>
          </div>
        )}

        {outcome === 'ban' && (
          <div className="mb-5 p-4 bg-[#FFF0F0] border-3 border-[#FF4B4B] rounded-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-center gap-2 text-[#FF4B4B] text-xl font-black mb-1">
              <Skull className="w-7 h-7" />
              <span>{isTargetSelf ? '💥 あなたのBANが確定しました' : `💥 「${targetName}」のBANが確定しました`}</span>
            </div>
            <p className="text-xs font-bold text-[#C53030] mb-2">
              {isTargetSelf 
                ? 'ルーレットの結果、処罰が執行されます。' 
                : `対象ユーザー（${targetName}）に対するBAN処分がリアルタイムで執行されました。`}<br />
              期間: <span className="font-black underline">{event.durationLabel || '指定期間'}</span>
            </p>
            <button
              onClick={handleAcknowledgeBan}
              className="mt-2 w-full py-3 bg-[#FF4B4B] hover:bg-[#E53E3E] border-b-4 border-[#C53030] text-white font-black text-sm rounded-2xl shadow-md cursor-pointer transition-all active:translate-y-0.5 active:border-b-0"
            >
              {isTargetSelf ? '結果を承諾する' : '処分を確定して閉じる'}
            </button>
          </div>
        )}

        {/* Spin Button */}
        {!hasSpun && (
          <button
            id="spin-roulette-btn"
            onClick={handleSpinWheel}
            disabled={spinning}
            className="w-full py-4 rounded-2xl bg-[#FF9600] hover:bg-[#E08500] disabled:bg-[#AFAFAF] border-b-4 border-[#B86E00] disabled:border-b-0 text-white font-black text-lg tracking-wide shadow-lg cursor-pointer transition-all active:translate-y-1 active:border-b-0 flex items-center justify-center gap-2"
          >
            {spinning ? (
              <>
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span>ルーレット回転中...</span>
              </>
            ) : (
              <>
                <span>🎰</span>
                <span>ルーレットを回す</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

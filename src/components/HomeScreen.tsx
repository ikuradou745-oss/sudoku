import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { UserStats } from '../types';
import { isDailyCompletedToday, getNextResetTimeString } from '../utils/storage';
import { audio } from '../utils/audio';

interface HomeScreenProps {
  stats: UserStats;
  onStartPractice: () => void;
  onStartDaily: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
}

export function HomeScreen({
  stats,
  onStartPractice,
  onStartDaily,
  onToggleSound,
  soundEnabled,
}: HomeScreenProps) {
  const [dailyDone, setDailyDone] = useState<boolean>(false);
  const [resetCountdown, setResetCountdown] = useState<string>('');

  useEffect(() => {
    const isDone = isDailyCompletedToday(stats.lastDailyDate);
    setDailyDone(isDone);
    setResetCountdown(getNextResetTimeString());

    const interval = setInterval(() => {
      setResetCountdown(getNextResetTimeString());
    }, 60000);

    return () => clearInterval(interval);
  }, [stats.lastDailyDate]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Top Header: ⚡️ : (数) on Left */}
      <header className="flex items-center justify-between mb-8 pb-4 border-b-2 border-[#E5E5E5]">
        {/* ⚡️ : Count */}
        <div 
          id="energy-display"
          className="flex items-center gap-2 bg-[#FFF9E6] border-2 border-[#FFD966] px-4 py-2 rounded-2xl shadow-xs"
        >
          <span className="text-2xl animate-pulse">⚡️</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-black text-[#A57800]">⚡️ :</span>
            <span className="text-2xl font-black text-[#FF9600] font-mono-code">
              {stats.energy}
            </span>
          </div>
        </div>

        {/* Right side: Streak & Sound */}
        <div className="flex items-center gap-2">
          {stats.streak > 0 && (
            <div className="flex items-center gap-1 bg-[#F7F7F7] border-2 border-[#E5E5E5] px-3 py-1.5 rounded-2xl text-xs font-black text-[#FF9600]">
              <span>🔥</span>
              <span>{stats.streak}日</span>
            </div>
          )}

          <button
            onClick={() => {
              audio.playTap();
              onToggleSound();
            }}
            className="w-10 h-10 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#777777] hover:text-[#3C3C3C] transition-all"
            title="音声効果ON/OFF"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-[#58CC02]" />
            ) : (
              <VolumeX className="w-5 h-5 text-[#AFAFAF]" />
            )}
          </button>
        </div>
      </header>

      {/* App Branding */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF7FD] border border-[#BDE3F8] text-[#1CB0F6] text-xs font-black mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>英語学習 (英検4〜5級・チャレンジ)</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-[#3C3C3C] tracking-tight">
          うおリンゴ
        </h1>
        <p className="text-sm font-bold text-[#777777] mt-1">
          問題を解いて⚡️コインをあつめよう！
        </p>
      </div>

      {/* Main Action Buttons */}
      <div className="space-y-4">
        {/* 1. 学習を始める */}
        <button
          id="start-practice-btn"
          onClick={() => {
            audio.playTap();
            onStartPractice();
          }}
          className="duo-btn duo-btn-green w-full p-5 rounded-2xl flex items-center justify-between shadow-xs group"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-black text-white">
                学習を始める
              </div>
              <div className="text-xs font-bold text-white/90">
                いつでも挑戦可能・モディファイア設定
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-white/25 text-white px-2.5 py-1 rounded-full">
              +5⚡️〜
            </span>
            <ArrowRight className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 2. デイリーセット */}
        <button
          id="start-daily-btn"
          onClick={() => {
            if (dailyDone) return;
            audio.playTap();
            onStartDaily();
          }}
          disabled={dailyDone}
          className={`w-full p-5 rounded-2xl flex items-center justify-between text-left transition-all ${
            dailyDone
              ? 'duo-btn duo-btn-gray opacity-70 cursor-not-allowed'
              : 'duo-btn duo-btn-blue text-white shadow-xs group'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              dailyDone ? 'bg-[#E5E5E5] text-[#AFAFAF]' : 'bg-white/20 text-white'
            }`}>
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className={`text-xl font-black ${dailyDone ? 'text-[#777777]' : 'text-white'}`}>
                デイリーセット
              </div>
              <div className={`text-xs font-bold ${dailyDone ? 'text-[#AFAFAF]' : 'text-white/90'}`}>
                {dailyDone ? `クリア済み (次回リセット ${resetCountdown})` : '1日1回限定・厳選5問'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dailyDone ? (
              <span className="flex items-center gap-1 text-xs font-black bg-[#E5E5E5] text-[#58A700] px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#58CC02]" />
                済
              </span>
            ) : (
              <>
                <span className="text-xs font-black bg-white/25 text-white px-2.5 py-1 rounded-full">
                  15⚡️
                </span>
                <ArrowRight className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

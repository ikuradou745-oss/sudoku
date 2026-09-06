import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Settings,
  User,
  Swords
} from 'lucide-react';
import { UserStats } from '../types';
import { isDailyCompletedToday, getNextResetTimeString } from '../utils/storage';
import { audio } from '../utils/audio';

interface HomeScreenProps {
  stats: UserStats;
  onStartPractice: () => void;
  onStartDaily: () => void;
  onStartBattle: () => void;
  onToggleSound: () => void;
  onOpenProfile: () => void;
  soundEnabled: boolean;
}

export function HomeScreen({
  stats,
  onStartPractice,
  onStartDaily,
  onStartBattle,
  onToggleSound,
  onOpenProfile,
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
      {/* Top Header: ⚡️ : (数) on Left, Profile & Settings on Right */}
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

        {/* Right side: Streak & Sound & Profile Settings */}
        <div className="flex items-center gap-2">
          {stats.streak > 0 && (
            <div className="flex items-center gap-1 bg-[#F7F7F7] border-2 border-[#E5E5E5] px-3 py-1.5 rounded-2xl text-xs font-black text-[#FF9600]">
              <span>🔥</span>
              <span>{stats.streak}日</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => {
              audio.playTap();
              onToggleSound();
            }}
            className="w-10 h-10 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#777777] hover:text-[#3C3C3C] transition-all cursor-pointer"
            title="音声効果ON/OFF"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-[#58CC02]" />
            ) : (
              <VolumeX className="w-5 h-5 text-[#AFAFAF]" />
            )}
          </button>

          {/* Profile & Icon Settings Button */}
          <button
            id="profile-settings-btn"
            onClick={() => {
              audio.playTap();
              onOpenProfile();
            }}
            className="h-10 px-3 rounded-2xl bg-[#F7F7F7] hover:bg-[#EBF7FD] border-2 border-[#E5E5E5] hover:border-[#1CB0F6] flex items-center gap-2 transition-all cursor-pointer group"
            title="プロフィール設定（名前・アイコン変更）"
          >
            {/* Custom Avatar Thumbnail or Default Icon */}
            <div className="w-6 h-6 rounded-full overflow-hidden border border-[#D0D0D0] bg-white flex items-center justify-center shrink-0">
              {stats.avatarUrl ? (
                <img 
                  src={stats.avatarUrl} 
                  alt="avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-[#58CC02]" />
              )}
            </div>
            <span className="text-xs font-black text-[#3C3C3C] max-w-[80px] truncate hidden sm:inline">
              {stats.userName || '会員'}
            </span>
            <Settings className="w-4 h-4 text-[#AFAFAF] group-hover:text-[#1CB0F6] group-hover:rotate-45 transition-all" />
          </button>
        </div>
      </header>

      {/* App Branding & User Greeting */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF7FD] border border-[#BDE3F8] text-[#1CB0F6] text-xs font-black mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>英語学習 (英検4〜5級・並べ替え)</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-[#3C3C3C] tracking-tight">
          うおリンゴ
        </h1>
        <p className="text-sm font-bold text-[#777777] mt-1">
          {stats.userName ? `ようこそ、${stats.userName}さん！` : '問題を解いて⚡️コインをあつめよう！'}
        </p>
      </div>

      {/* Main Action Buttons */}
      <div className="space-y-3.5">
        {/* 1. 学習を始める */}
        <button
          id="start-practice-btn"
          onClick={() => {
            audio.playTap();
            onStartPractice();
          }}
          className="duo-btn duo-btn-green w-full p-4.5 rounded-2xl flex items-center justify-between shadow-xs group cursor-pointer"
        >
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white">
                学習を始める
              </div>
              <div className="text-xs font-bold text-white/90">
                いつでも挑戦可能・モディファイア設定
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black bg-white/25 text-white px-2.5 py-1 rounded-full">
              +5⚡️〜
            </span>
            <ArrowRight className="w-4 h-4 text-white transform group-hover:translate-x-1 transition-transform" />
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
          className={`w-full p-4.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
            dailyDone
              ? 'duo-btn duo-btn-gray opacity-70 cursor-not-allowed'
              : 'duo-btn duo-btn-blue text-white shadow-xs group'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              dailyDone ? 'bg-[#E5E5E5] text-[#AFAFAF]' : 'bg-white/20 text-white'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-lg font-black ${dailyDone ? 'text-[#777777]' : 'text-white'}`}>
                デイリーセット
              </div>
              <div className={`text-xs font-bold ${dailyDone ? 'text-[#AFAFAF]' : 'text-white/90'}`}>
                {dailyDone ? `クリア済み (次回リセット ${resetCountdown})` : '1日1回限定・厳選5問'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
                <ArrowRight className="w-4 h-4 text-white transform group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </div>
        </button>

        {/* 3. 対戦 (オンライン) */}
        <button
          id="start-battle-btn"
          onClick={() => {
            audio.playTap();
            onStartBattle();
          }}
          className="duo-btn duo-btn-red w-full p-4.5 rounded-2xl flex items-center justify-between shadow-xs group cursor-pointer"
        >
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white flex items-center gap-2">
                <span>対戦</span>
                <span className="text-[10px] font-black bg-white/30 text-white px-1.5 py-0.2 rounded-md">
                  オンライン
                </span>
              </div>
              <div className="text-xs font-bold text-white/90">
                部屋を探す・作る・順位別報酬！
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black bg-white/25 text-white px-2.5 py-1 rounded-full">
              +6〜30⚡️
            </span>
            <ArrowRight className="w-4 h-4 text-white transform group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ModifierModal } from './components/ModifierModal';
import { ProfileModal } from './components/ProfileModal';
import { CommunityModal } from './components/CommunityModal';
import { RankedLobbyModal } from './components/RankedLobbyModal';
import { RankedQuizSession } from './components/RankedQuizSession';
import { QuizSession } from './components/QuizSession';
import { UserStats, Modifier, Question, RankedMatchSession } from './types';
import { QUESTION_BANK } from './data/questions';
import { 
  getStoredUserStats, 
  saveUserStats, 
  getCurrentDailyCycleKey,
  calculateNextDailyStreak
} from './utils/storage';
import { realtimePresence } from './utils/multiplayer';
import { audio } from './utils/audio';

type AppPhase = 'home' | 'quiz' | 'ranked';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('home');
  const [stats, setStats] = useState<UserStats>(getStoredUserStats);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals & Quiz Config
  const [showModifierModal, setShowModifierModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCommunityModal, setShowCommunityModal] = useState<boolean>(false);
  const [showRankedLobbyModal, setShowRankedLobbyModal] = useState<boolean>(false);

  // Solo Quiz State
  const [quizMode, setQuizMode] = useState<'practice' | 'daily'>('practice');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);

  // Ranked Match State
  const [activeRankedSession, setActiveRankedSession] = useState<RankedMatchSession | null>(null);
  const [isPlacementMatch, setIsPlacementMatch] = useState<boolean>(false);

  // Identify user with realtime service
  useEffect(() => {
    if (stats.userId && stats.userName) {
      realtimePresence.identify(
        stats.userId,
        stats.userName,
        stats.avatarUrl,
        stats.rating || 0,
        stats.rankTier || 'bronze'
      );
    }
  }, [stats.userId, stats.userName, stats.avatarUrl, stats.rating, stats.rankTier]);

  // Update storage when stats change
  const updateStats = (updater: (prev: UserStats) => UserStats) => {
    setStats((prev) => {
      const next = updater(prev);
      saveUserStats(next);
      return next;
    });
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      audio.soundEnabled = next;
      return next;
    });
  };

  // 1. Open Practice Mode -> Show Modifier Modal
  const handleOpenPractice = () => {
    setShowModifierModal(true);
  };

  // 4. Start Practice Mode with selected modifiers
  const handleStartPracticeWithModifiers = (selectedMods: Modifier[]) => {
    setShowModifierModal(false);
    setActiveModifiers(selectedMods);
    setQuizMode('practice');

    const hasLonger = selectedMods.some((m) => m.id === 'longerSentences' && m.active);
    const hasDiffUp = selectedMods.some((m) => m.id === 'difficultyUp' && m.active);

    let pool = [...QUESTION_BANK];

    if (hasDiffUp) {
      pool = pool.filter((q) => q.difficulty === '4kyu' || q.difficulty === 'long');
    }
    if (hasLonger) {
      const longQuestions = QUESTION_BANK.filter((q) => q.difficulty === 'long');
      pool = [...longQuestions, ...pool];
    }

    // Shuffle and pick 5 questions
    const selectedQuestions = pool.sort(() => Math.random() - 0.5).slice(0, 5);

    setQuizQuestions(selectedQuestions);
    setPhase('quiz');
  };

  // 5. Start Daily Set (5 questions, fixed 15⚡️)
  const handleStartDaily = () => {
    setQuizMode('daily');
    setActiveModifiers([]);

    // Select 5 varied questions for the daily set
    const e5 = QUESTION_BANK.filter((q) => q.difficulty === '5kyu').sort(() => Math.random() - 0.5).slice(0, 2);
    const e4 = QUESTION_BANK.filter((q) => q.difficulty === '4kyu').sort(() => Math.random() - 0.5).slice(0, 2);
    const long = QUESTION_BANK.filter((q) => q.difficulty === 'long').sort(() => Math.random() - 0.5).slice(0, 1);

    const dailySet = [...e5, ...e4, ...long].sort(() => Math.random() - 0.5);
    setQuizQuestions(dailySet);
    setPhase('quiz');
  };

  // 6. Handle Solo Quiz Finish
  const handleQuizFinish = (result: {
    completed: boolean;
    reward: number;
    perfect: boolean;
    mistakes: number;
    streak?: number;
  }) => {
    if (result.completed) {
      updateStats((prev) => {
        const nextEnergy = prev.energy + result.reward;
        const nextStreak = quizMode === 'daily' 
          ? (result.streak ?? calculateNextDailyStreak(prev.lastDailyDate, prev.streak))
          : prev.streak;
        const nextLastDaily = quizMode === 'daily' ? getCurrentDailyCycleKey() : prev.lastDailyDate;

        return {
          ...prev,
          energy: nextEnergy,
          streak: nextStreak,
          lastDailyDate: nextLastDaily,
          completedSessions: prev.completedSessions + 1,
          perfectSessions: prev.perfectSessions + (result.perfect ? 1 : 0),
        };
      });
    }
    setPhase('home');
  };

  // 7. Start Ranked Match
  const handleStartRankedMatch = (session: RankedMatchSession, isPlacement: boolean) => {
    setShowRankedLobbyModal(false);
    setActiveRankedSession(session);
    setIsPlacementMatch(isPlacement);
    setPhase('ranked');
  };

  // 8. Finish Ranked Match (Rating Update & Sync)
  const handleFinishRankedMatch = (updatedFields: Partial<UserStats>) => {
    updateStats((prev) => ({
      ...prev,
      ...updatedFields,
      completedSessions: prev.completedSessions + 1,
    }));
  };

  const handleExitRanked = () => {
    setActiveRankedSession(null);
    setPhase('home');
  };

  const handleExitQuiz = () => {
    setPhase('home');
  };

  // Profile Save
  const handleSaveProfile = (name: string, avatarDataUrl: string) => {
    updateStats((prev) => ({
      ...prev,
      userName: name,
      avatarUrl: avatarDataUrl,
    }));
    setShowProfileModal(false);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-between selection:bg-[#58CC02] selection:text-white">
      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        {phase === 'home' && (
          <HomeScreen
            stats={stats}
            onStartPractice={handleOpenPractice}
            onStartDaily={handleStartDaily}
            onStartRanked={() => setShowRankedLobbyModal(true)}
            onOpenCommunity={() => setShowCommunityModal(true)}
            onToggleSound={handleToggleSound}
            onOpenProfile={() => setShowProfileModal(true)}
            soundEnabled={soundEnabled}
          />
        )}

        {phase === 'quiz' && (
          <QuizSession
            mode={quizMode}
            questions={quizQuestions}
            modifiers={activeModifiers}
            stats={stats}
            onFinish={handleQuizFinish}
            onExit={handleExitQuiz}
          />
        )}

        {phase === 'ranked' && activeRankedSession && (
          <RankedQuizSession
            stats={stats}
            session={activeRankedSession}
            isPlacement={isPlacementMatch}
            onFinishMatch={handleFinishRankedMatch}
            onExit={handleExitRanked}
          />
        )}

        {/* Solo Modifier Modal */}
        {showModifierModal && (
          <ModifierModal
            onClose={() => setShowModifierModal(false)}
            onStart={handleStartPracticeWithModifiers}
          />
        )}

        {/* Profile & Icon Settings Modal */}
        {showProfileModal && (
          <ProfileModal
            currentName={stats.userName || 'うおリンゴ会員'}
            currentAvatar={stats.avatarUrl || null}
            stats={stats}
            onSave={handleSaveProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}

        {/* 👥 Community & Online Members Modal */}
        {showCommunityModal && (
          <CommunityModal
            currentUser={stats}
            onClose={() => setShowCommunityModal(false)}
          />
        )}

        {/* Ranked Match Lobby & Matchmaking Modal */}
        {showRankedLobbyModal && (
          <RankedLobbyModal
            stats={stats}
            onStartMatch={handleStartRankedMatch}
            onClose={() => setShowRankedLobbyModal(false)}
          />
        )}
      </main>

      {/* Subtle Footer */}
      {phase === 'home' && (
        <footer className="py-4 text-center text-xs font-bold text-[#AFAFAF] border-t border-[#F0F0F0]">
          <span>うおリンゴ (Uolingo) © 英語学習・ランクマッチ</span>
        </footer>
      )}
    </div>
  );
}

export default App;

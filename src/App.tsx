import { useState, useEffect } from 'react';
import { CodeEntryGate } from './components/CodeEntryGate';
import { UnderPreparationScreen } from './components/UnderPreparationScreen';
import { HomeScreen } from './components/HomeScreen';
import { ModifierModal } from './components/ModifierModal';
import { ProfileModal } from './components/ProfileModal';
import { QuizSession } from './components/QuizSession';
import { UserStats, Modifier, Question } from './types';
import { QUESTION_BANK } from './data/questions';
import { 
  getStoredUserStats, 
  saveUserStats, 
  getCurrentDailyCycleKey 
} from './utils/storage';
import { checkExistingSession, clearGateSession } from './utils/security';
import { audio } from './utils/audio';

type AppPhase = 'gate' | 'preparing' | 'home' | 'quiz';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('gate');
  const [stats, setStats] = useState<UserStats>(getStoredUserStats);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals & Quiz Config
  const [showModifierModal, setShowModifierModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [quizMode, setQuizMode] = useState<'practice' | 'daily'>('practice');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);

  useEffect(() => {
    // If gate was previously unlocked in this browser (stored in localStorage)
    if (checkExistingSession()) {
      setPhase('home');
    }
  }, []);

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

  // 1. Gate Unlock -> Go to Preparing Screen
  const handleUnlockGate = () => {
    setPhase('preparing');
  };

  // 2. Preparing Screen -> Complete to Home
  const handleCompleteToHome = () => {
    setPhase('home');
  };

  // 3. Open Practice Mode -> Show Modifier Modal
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

    // Select 5 varied questions for the daily set (2 x 5kyu, 2 x 4kyu, 1 x long)
    const e5 = QUESTION_BANK.filter((q) => q.difficulty === '5kyu').sort(() => Math.random() - 0.5).slice(0, 2);
    const e4 = QUESTION_BANK.filter((q) => q.difficulty === '4kyu').sort(() => Math.random() - 0.5).slice(0, 2);
    const long = QUESTION_BANK.filter((q) => q.difficulty === 'long').sort(() => Math.random() - 0.5).slice(0, 1);

    const dailySet = [...e5, ...e4, ...long].sort(() => Math.random() - 0.5);
    setQuizQuestions(dailySet);
    setPhase('quiz');
  };

  // 6. Handle Quiz Finish
  const handleQuizFinish = (result: {
    completed: boolean;
    reward: number;
    perfect: boolean;
    mistakes: number;
  }) => {
    if (result.completed) {
      updateStats((prev) => {
        const nextEnergy = prev.energy + result.reward;
        const nextStreak = prev.streak + (quizMode === 'daily' ? 1 : 0);
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

  // Developer / test gate reset button in footer if needed
  const handleRelockGate = () => {
    clearGateSession();
    setPhase('gate');
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-between selection:bg-[#58CC02] selection:text-white">
      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        {phase === 'gate' && (
          <CodeEntryGate onUnlockSuccess={handleUnlockGate} />
        )}

        {phase === 'preparing' && (
          <UnderPreparationScreen onCompleteToHome={handleCompleteToHome} />
        )}

        {phase === 'home' && (
          <HomeScreen
            stats={stats}
            onStartPractice={handleOpenPractice}
            onStartDaily={handleStartDaily}
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
            onFinish={handleQuizFinish}
            onExit={handleExitQuiz}
          />
        )}

        {/* Modifier Modal */}
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
            onSave={handleSaveProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}
      </main>

      {/* Subtle Footer */}
      {phase === 'home' && (
        <footer className="py-4 text-center text-xs font-bold text-[#AFAFAF] border-t border-[#F0F0F0]">
          <div className="flex items-center justify-center gap-4">
            <span>うおリンゴ (Uolingo) © 英語学習</span>
            <button
              onClick={handleRelockGate}
              className="text-[#D0D0D0] hover:text-[#777777] underline cursor-pointer"
            >
              ゲートを再施錠
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;

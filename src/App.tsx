import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ModifierModal } from './components/ModifierModal';
import { ProfileModal } from './components/ProfileModal';
import { CommunityModal } from './components/CommunityModal';
import { QuizSession } from './components/QuizSession';
import { GoodsModal } from './components/GoodsModal';
import { UserStats, Modifier, Question, MainGoodsId, SubGoodsId, GoodsItem } from './types';
import { QUESTION_BANK } from './data/questions';
import { 
  getStoredUserStats, 
  saveUserStats, 
  getCurrentDailyCycleKey,
  calculateNextDailyStreak
} from './utils/storage';
import { realtimePresence } from './utils/multiplayer';
import { audio } from './utils/audio';
import { fetchAiQuestion } from './utils/aiQuestionClient';

type AppPhase = 'home' | 'quiz';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('home');
  const [stats, setStats] = useState<UserStats>(getStoredUserStats);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals & Quiz Config
  const [showModifierModal, setShowModifierModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCommunityModal, setShowCommunityModal] = useState<boolean>(false);
  const [showGoodsModal, setShowGoodsModal] = useState<boolean>(false);

  // Solo Quiz State
  const [quizMode, setQuizMode] = useState<'practice' | 'daily'>('practice');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);

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

  // 4. Start Practice Mode with selected modifiers (AI question triggers occasionally)
  const handleStartPracticeWithModifiers = async (selectedMods: Modifier[]) => {
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

    // Shuffle and pick 10 questions for normal lesson
    const selectedQuestions = pool.sort(() => Math.random() - 0.5).slice(0, 10);

    // AI Question: "これはたまーに出るもので、AIが問題を考えてくれます" (~40% chance)
    if (Math.random() < 0.45) {
      try {
        const aiQ = await fetchAiQuestion();
        if (aiQ) {
          const replaceIdx = Math.floor(Math.random() * 6) + 2; // index between 2 and 7
          if (selectedQuestions.length > replaceIdx) {
            selectedQuestions[replaceIdx] = aiQ;
          }
        }
      } catch {
        // Ignore fallback already handles it
      }
    }

    setQuizQuestions(selectedQuestions);
    setPhase('quiz');
  };

  // 5. Start Daily Set (5 questions, fixed 15⚡️, includes matching)
  const handleStartDaily = () => {
    setQuizMode('daily');
    setActiveModifiers([]);

    // Select 5 varied questions for the daily set including matching questions
    const matchingPool = QUESTION_BANK.filter((q) => q.type === 'matching').sort(() => Math.random() - 0.5);
    const e5 = QUESTION_BANK.filter((q) => q.difficulty === '5kyu' && q.type !== 'matching').sort(() => Math.random() - 0.5).slice(0, 2);
    const e4 = QUESTION_BANK.filter((q) => q.difficulty === '4kyu' && q.type !== 'matching').sort(() => Math.random() - 0.5).slice(0, 1);
    const long = QUESTION_BANK.filter((q) => q.difficulty === 'long').sort(() => Math.random() - 0.5).slice(0, 1);
    const match = matchingPool.slice(0, 1);

    const dailySet = [...e5, ...e4, ...long, ...match].sort(() => Math.random() - 0.5);
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

  // Goods Equipment & Purchase
  const handleEquipGoods = (type: 'main' | 'sub', id: MainGoodsId | SubGoodsId) => {
    updateStats((prev) => {
      if (type === 'main') {
        return { ...prev, equippedMainGoods: id as MainGoodsId };
      }
      return { ...prev, equippedSubGoods: id as SubGoodsId };
    });
  };

  const handleBuyGoods = (goods: GoodsItem) => {
    updateStats((prev) => {
      if (prev.energy < goods.price) return prev;
      const nextUnlocked = Array.from(new Set([...(prev.unlockedGoods || ['pencil', 'eraser']), goods.id]));
      const nextEnergy = prev.energy - goods.price;
      
      if (goods.type === 'main') {
        return {
          ...prev,
          energy: nextEnergy,
          unlockedGoods: nextUnlocked,
          equippedMainGoods: goods.id as MainGoodsId,
        };
      }
      return {
        ...prev,
        energy: nextEnergy,
        unlockedGoods: nextUnlocked,
        equippedSubGoods: goods.id as SubGoodsId,
      };
    });
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
            onOpenCommunity={() => setShowCommunityModal(true)}
            onOpenGoods={() => setShowGoodsModal(true)}
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

        {/* 🎒 Goods Equipment & Shop Modal */}
        {showGoodsModal && (
          <GoodsModal
            stats={stats}
            onEquipGoods={handleEquipGoods}
            onBuyGoods={handleBuyGoods}
            onClose={() => setShowGoodsModal(false)}
          />
        )}
      </main>

      {/* Subtle Footer */}
      {phase === 'home' && (
        <footer className="py-4 text-center text-xs font-bold text-[#AFAFAF] border-t border-[#F0F0F0]">
          <span>うおリンゴ (Uolingo) © 英語学習</span>
        </footer>
      )}
    </div>
  );
}

export default App;

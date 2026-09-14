import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ModifierModal } from './components/ModifierModal';
import { ProfileModal } from './components/ProfileModal';
import { CommunityModal } from './components/CommunityModal';
import { QuizSession } from './components/QuizSession';
import { GoodsModal } from './components/GoodsModal';
import { StoryModeScreen } from './components/StoryModeScreen';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { BanRouletteModal } from './components/BanRouletteModal';
import { BannedScreen } from './components/BannedScreen';
import { FeedbackModal } from './components/FeedbackModal';
import { UserStats, Modifier, Question, MainGoodsId, SubGoodsId, GoodsItem, BanRecord, BanRouletteTriggerEvent } from './types';
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
import { 
  reportFirebasePresence, 
  subscribeToFirebaseRoulette, 
  subscribeToFirebaseUserBan,
  getTodayDateString
} from './utils/firebase';
import { getStoryStageQuestions, STORY_MILESTONES } from './utils/storyStages';
import { 
  isAdminAuthenticated, 
  checkAndEnforceReloadViolation, 
  subscribeToAdminRoulette, 
  clearBanInfo
} from './utils/adminAuth';

type AppPhase = 'home' | 'quiz' | 'story';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('home');
  const [stats, setStats] = useState<UserStats>(getStoredUserStats);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals & Quiz Config
  const [showModifierModal, setShowModifierModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCommunityModal, setShowCommunityModal] = useState<boolean>(false);
  const [showGoodsModal, setShowGoodsModal] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  // Admin & BAN states
  const [showAdminAuth, setShowAdminAuth] = useState<boolean>(false);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const [activeRouletteEvent, setActiveRouletteEvent] = useState<BanRouletteTriggerEvent | null>(null);
  const [currentBan, setCurrentBan] = useState<BanRecord | null>(null);

  // Solo Quiz State
  const [quizMode, setQuizMode] = useState<'practice' | 'daily' | 'story'>('practice');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [activeModifiers, setActiveModifiers] = useState<Modifier[]>([]);
  const [activeStoryStage, setActiveStoryStage] = useState<number>(1);

  // 1. Firebase Online Presence & Daily Login Heartbeat (No Google Login Required)
  useEffect(() => {
    // Initial report: user is online now and logged in today
    reportFirebasePresence(stats, true).catch(console.error);

    // Heartbeat every 25 seconds while tab is active
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reportFirebasePresence(stats, true).catch(console.error);
      }
    }, 25000);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      reportFirebasePresence(stats, isVisible).catch(console.error);
    };

    const handleBeforeUnload = () => {
      reportFirebasePresence(stats, false).catch(console.error);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stats.userId, stats.userName, stats.avatarUrl, stats.rating, stats.rankTier]);

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

  // Check reload violation and active ban on startup & subscribe to roulette events
  useEffect(() => {
    const currentUid = stats.userId || 'local_user';
    const { ban } = checkAndEnforceReloadViolation({
      id: currentUid,
      name: stats.userName || 'ユーザー',
    });
    if (ban) {
      setCurrentBan(ban);
    }

    // Subscribe to admin roulette events (cross-tab via BroadcastChannel)
    const unsubLocal = subscribeToAdminRoulette(
      currentUid,
      (event) => {
        setActiveRouletteEvent(event);
      },
      () => {
        setCurrentBan(null);
      }
    );

    // Subscribe to server-side realtime events (SSE / WebSocket)
    const unsubRealtime = realtimePresence.subscribe((event) => {
      if (event.type === 'BAN_ROULETTE_TRIGGERED') {
        const ev = event.event;
        if (ev.targetType === 'all' || ev.targetUserId === stats.userId) {
          setActiveRouletteEvent(ev);
        }
      } else if (event.type === 'BAN_REMOVED') {
        if (!event.userId || event.userId === stats.userId) {
          setCurrentBan(null);
          clearBanInfo();
        }
      }
    });

    // Subscribe to Firebase real-time roulette broadcasts
    const unsubFirebaseRoulette = subscribeToFirebaseRoulette((ev) => {
      if (ev.targetType === 'all' || ev.targetUserId === stats.userId) {
        setActiveRouletteEvent(ev);
      }
    });

    // Subscribe to Firebase active bans for this user
    const unsubFirebaseBan = subscribeToFirebaseUserBan(currentUid, (remoteBan) => {
      if (remoteBan) {
        setCurrentBan(remoteBan);
      } else {
        // If remote ban was removed and current ban was not caused by reload
        setCurrentBan((prev) => {
          if (prev && !prev.bannedByReload) {
            clearBanInfo();
            return null;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubLocal();
      unsubRealtime();
      unsubFirebaseRoulette();
      unsubFirebaseBan();
    };
  }, [stats.userId, stats.userName]);

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated()) {
      setShowAdminPanel(true);
    } else {
      setShowAdminAuth(true);
    }
  };

  const handleAdminAuthSuccess = () => {
    setShowAdminAuth(false);
    setShowAdminPanel(true);
  };

  // Update storage when stats change
  const updateStats = (updater: (prev: UserStats) => UserStats) => {
    setStats((prev) => {
      const next = updater(prev);
      saveUserStats(next);
      reportFirebasePresence(next, true).catch(console.error);
      return next;
    });
  };

  // Feedback 25⚡️ Boost Handler
  const handleSpendEnergyForFeedback = (amount: number) => {
    const todayKey = getTodayDateString();
    updateStats((prev) => {
      const isToday = prev.feedbackDate === todayKey;
      const currentQuota = isToday ? (prev.extraFeedbackQuota || 0) : 0;
      const currentCount = isToday ? (prev.feedbackCountToday || 0) : 0;
      return {
        ...prev,
        energy: Math.max(0, prev.energy - amount),
        feedbackDate: todayKey,
        feedbackCountToday: currentCount,
        extraFeedbackQuota: currentQuota + 1,
      };
    });
  };

  // Feedback Record Submitted Handler
  const handleRecordFeedbackSubmit = () => {
    const todayKey = getTodayDateString();
    updateStats((prev) => {
      const isToday = prev.feedbackDate === todayKey;
      const currentCount = isToday ? (prev.feedbackCountToday || 0) : 0;
      const currentExtra = isToday ? (prev.extraFeedbackQuota || 0) : 0;
      return {
        ...prev,
        feedbackDate: todayKey,
        feedbackCountToday: currentCount + 1,
        extraFeedbackQuota: currentExtra,
      };
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

  // 5. Start Daily Set (5 questions, fixed 15⚡️, includes correct sentence, matching, AI)
  const handleStartDaily = async () => {
    setQuizMode('daily');
    setActiveModifiers([]);

    // Select 5 varied questions for the daily set including matching & correct_sentence questions
    const matchingPool = QUESTION_BANK.filter((q) => q.type === 'matching').sort(() => Math.random() - 0.5);
    const correctSentencePool = QUESTION_BANK.filter((q) => q.type === 'correct_sentence').sort(() => Math.random() - 0.5);
    const e5 = QUESTION_BANK.filter((q) => q.difficulty === '5kyu' && q.type !== 'matching' && q.type !== 'correct_sentence').sort(() => Math.random() - 0.5).slice(0, 1);
    const e4 = QUESTION_BANK.filter((q) => q.difficulty === '4kyu' && q.type !== 'matching' && q.type !== 'correct_sentence').sort(() => Math.random() - 0.5).slice(0, 1);
    const long = QUESTION_BANK.filter((q) => q.difficulty === 'long').sort(() => Math.random() - 0.5).slice(0, 1);
    const match = matchingPool.slice(0, 1);
    const cs = correctSentencePool.slice(0, 1);

    const dailySet = [...e5, ...e4, ...long, ...match, ...cs].sort(() => Math.random() - 0.5);

    // AI Question chance in Daily Set (~40% chance)
    if (Math.random() < 0.4) {
      try {
        const aiQ = await fetchAiQuestion();
        if (aiQ && dailySet.length > 2) {
          dailySet[2] = aiQ;
        }
      } catch {
        // Fallback handles gracefully
      }
    }

    setQuizQuestions(dailySet);
    setPhase('quiz');
  };

  // 6. Handle Solo / Story Quiz Finish
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

        let nextStoryStage = prev.storyCurrentStage || 1;
        let nextUnlockedGoods = prev.unlockedGoods || ['pencil', 'eraser'];
        let nextUnlockedTitles = prev.unlockedTitles || ['beginner', 'today_login'];
        let nextClaimedMilestones = prev.claimedStoryMilestones || [];

        if (quizMode === 'story') {
          if (activeStoryStage >= nextStoryStage) {
            nextStoryStage = Math.min(201, activeStoryStage + 1);
          }

          // Check milestone reward at activeStoryStage (50, 100, 150, 200)
          const milestone = STORY_MILESTONES[activeStoryStage];
          if (milestone && !nextClaimedMilestones.includes(activeStoryStage)) {
            nextClaimedMilestones = [...nextClaimedMilestones, activeStoryStage];
            if (milestone.goodsId && !nextUnlockedGoods.includes(milestone.goodsId as any)) {
              nextUnlockedGoods = [...nextUnlockedGoods, milestone.goodsId as any];
            }
            if (milestone.titleId && !nextUnlockedTitles.includes(milestone.titleId)) {
              nextUnlockedTitles = [...nextUnlockedTitles, milestone.titleId];
            }
          }
        }

        return {
          ...prev,
          energy: nextEnergy,
          streak: nextStreak,
          lastDailyDate: nextLastDaily,
          completedSessions: prev.completedSessions + 1,
          perfectSessions: prev.perfectSessions + (result.perfect ? 1 : 0),
          storyCurrentStage: nextStoryStage,
          unlockedGoods: nextUnlockedGoods,
          unlockedTitles: nextUnlockedTitles,
          claimedStoryMilestones: nextClaimedMilestones,
        };
      });
    }
    setPhase(quizMode === 'story' ? 'story' : 'home');
  };

  const handleExitQuiz = () => {
    setPhase(quizMode === 'story' ? 'story' : 'home');
  };

  // Profile Save
  const handleSaveProfile = (name: string, avatarDataUrl: string, titleId?: string) => {
    updateStats((prev) => ({
      ...prev,
      userName: name,
      avatarUrl: avatarDataUrl,
      equippedTitle: titleId !== undefined ? titleId : prev.equippedTitle,
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

  if (currentBan) {
    return (
      <BannedScreen
        ban={currentBan}
        onUnban={() => setCurrentBan(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-between selection:bg-[#58CC02] selection:text-white">
      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        {phase === 'home' && (
          <HomeScreen
            stats={stats}
            onStartStory={() => setPhase('story')}
            onStartPractice={handleOpenPractice}
            onStartDaily={handleStartDaily}
            onOpenCommunity={() => setShowCommunityModal(true)}
            onOpenGoods={() => setShowGoodsModal(true)}
            onOpenFeedback={() => setShowFeedbackModal(true)}
            onToggleSound={handleToggleSound}
            onOpenProfile={() => setShowProfileModal(true)}
            onOpenAdmin={handleOpenAdmin}
            soundEnabled={soundEnabled}
          />
        )}

        {phase === 'story' && (
          <StoryModeScreen
            stats={stats}
            onBack={() => setPhase('home')}
            onStartStage={(stageNumber) => {
              setActiveStoryStage(stageNumber);
              const questions = getStoryStageQuestions(stageNumber);
              setQuizQuestions(questions);
              setQuizMode('story');
              setActiveModifiers([]);
              setPhase('quiz');
            }}
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

        {/* 🛡️ Admin Authentication Modal (Code Entry) */}
        {showAdminAuth && (
          <AdminAuthModal
            onClose={() => setShowAdminAuth(false)}
            onSuccess={handleAdminAuthSuccess}
          />
        )}

        {/* 🛡️ Admin Panel Modal */}
        {showAdminPanel && (
          <AdminPanelModal
            currentUserId={stats.userId || 'local_user'}
            currentUserName={stats.userName || 'うおリンゴ会員'}
            onClose={() => setShowAdminPanel(false)}
          />
        )}

        {/* 📃 Survey & Bug Report Modal */}
        {showFeedbackModal && (
          <FeedbackModal
            currentUser={stats}
            onSpendEnergy={handleSpendEnergyForFeedback}
            onRecordFeedbackSubmit={handleRecordFeedbackSubmit}
            onClose={() => setShowFeedbackModal(false)}
          />
        )}

        {/* 🎲 Active BAN Roulette Modal (Legacy listener fallback) */}
        {activeRouletteEvent && (
          <BanRouletteModal
            event={activeRouletteEvent}
            currentUserId={stats.userId || 'local_user'}
            currentUserName={stats.userName || 'うおリンゴ会員'}
            onSafeResolved={() => {
              setActiveRouletteEvent(null);
            }}
            onBanResolved={(ban) => {
              setActiveRouletteEvent(null);
              setCurrentBan(ban);
            }}
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

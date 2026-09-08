import { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Sparkles, 
  ArrowRight, 
  Swords, 
  User, 
  Bot
} from 'lucide-react';
import { 
  Question, 
  UserStats, 
  RankedMatchSession, 
  RankedMatchPlayer 
} from '../types';
import { QUESTION_BANK } from '../data/questions';
import { 
  getRankInfo, 
  calculateRatingDelta, 
  evaluatePlacementMatch,
  PlacementResult 
} from '../utils/rank';
import { realtimePresence } from '../utils/multiplayer';
import { audio } from '../utils/audio';

interface RankedQuizSessionProps {
  stats: UserStats;
  session: RankedMatchSession;
  isPlacement: boolean;
  onFinishMatch: (updatedStats: Partial<UserStats>) => void;
  onExit: () => void;
}

// Pseudo-random seeded question selector
function getSeededQuestions(seed: number, count: number = 10): Question[] {
  const bank = [...QUESTION_BANK];
  let s = seed;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = bank.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bank[i], bank[j]] = [bank[j], bank[i]];
  }

  return bank.slice(0, count);
}

export function RankedQuizSession({
  stats,
  session,
  isPlacement,
  onFinishMatch,
  onExit,
}: RankedQuizSessionProps) {
  // Questions for this match
  const [questions] = useState<Question[]>(() => getSeededQuestions(session.seed, 10));
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // User In-Game State
  const [lives, setLives] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [isKO, setIsKO] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const [totalTimeSec, setTotalTimeSec] = useState<number>(0);

  // Match State
  const [matchState, setMatchState] = useState<'countdown' | 'playing' | 'result'>('countdown');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [players, setPlayers] = useState<RankedMatchPlayer[]>(session.players);

  // Question Interaction State
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isAnswerChecking, setIsAnswerChecking] = useState<boolean>(false);

  // Result State
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [rpDelta, setRpDelta] = useState<number>(0);
  const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null);

  const currentQ = questions[currentIndex] || questions[0];
  const opponents = players.filter((p) => p.id !== stats.userId);

  // 1. Countdown on Match Start
  useEffect(() => {
    audio.playCountdown();
    const interval = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setMatchState('playing');
          startTimeRef.current = Date.now();
          realtimePresence.setActiveMatchId(session.matchId);
          return 0;
        }
        audio.playCountdown();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 2. Window Unload / Disconnect Forfeit Penalty
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (matchState === 'playing' && !isFinished) {
        // Send forfeit
        realtimePresence.forfeitMatch(session.matchId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [matchState, isFinished, session.matchId]);

  // 3. Sync Remote Players & Events
  useEffect(() => {
    const unsubscribe = realtimePresence.subscribe((event) => {
      if (event.type === 'RANKED_PROGRESS_UPDATE' && event.matchId === session.matchId) {
        setPlayers(event.match.players);
      } else if (event.type === 'RANKED_MATCH_FINISHED' && event.matchId === session.matchId) {
        if (event.winnerIds?.includes(stats.userId || '')) {
          handleMatchEnd(true);
        } else {
          handleMatchEnd(false);
        }
      } else if (event.type === 'RANKED_FORFEIT_OCCURRED' && event.matchId === session.matchId) {
        if (event.forfeitedPlayerId !== stats.userId) {
          // Opponent forfeited, user wins!
          handleMatchEnd(true);
        }
      }
    });

    return () => unsubscribe();
  }, [session.matchId, stats.userId]);

  // 4. Opponent Progress is purely driven by real network events (No Bots)
  // Opponent progress updates arrive via RANKED_PROGRESS_UPDATE above

  // 5. Initialize Current Question Options
  useEffect(() => {
    if (!currentQ) return;
    if (currentQ.type === 'order' && currentQ.wordOptions) {
      // Shuffle words
      const shuffled = [...currentQ.wordOptions].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWords([]);
    } else {
      setSelectedChoice(null);
    }
    setFeedback(null);
    setIsAnswerChecking(false);
  }, [currentIndex, currentQ]);

  // Word Order Click Handlers
  const handleSelectWord = (word: string, index: number) => {
    if (feedback || isAnswerChecking) return;
    audio.playTap();
    setSelectedWords([...selectedWords, word]);
    const updated = [...availableWords];
    updated.splice(index, 1);
    setAvailableWords(updated);
  };

  const handleDeselectWord = (word: string, index: number) => {
    if (feedback || isAnswerChecking) return;
    audio.playTap();
    setAvailableWords([...availableWords, word]);
    const updated = [...selectedWords];
    updated.splice(index, 1);
    setSelectedWords(updated);
  };

  // Submit Answer
  const handleCheckAnswer = (chosenAnswer?: string) => {
    if (feedback || isAnswerChecking || isKO || isFinished) return;
    setIsAnswerChecking(true);

    let answer = '';
    if (currentQ.type === 'order') {
      answer = selectedWords.join(' ');
    } else {
      answer = chosenAnswer || selectedChoice || '';
    }

    const isCorrect = answer.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();

    if (isCorrect) {
      audio.playCorrect();
      setFeedback('correct');
      const newScore = score + 120;
      const newCorrect = correctCount + 1;
      const newProgress = currentIndex + 1;
      setScore(newScore);
      setCorrectCount(newCorrect);

      // Report live progress to server
      const willFinish = newProgress >= 10;
      realtimePresence.sendMatchProgress(
        session.matchId,
        newProgress,
        newScore,
        mistakes,
        lives,
        false,
        willFinish
      );

      setTimeout(() => {
        if (willFinish) {
          setIsFinished(true);
          handleMatchEnd(true);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }, 700);
    } else {
      audio.playWrong();
      setFeedback('wrong');
      const newMistakes = mistakes + 1;
      const newLives = Math.max(0, lives - 1);
      const newProgress = currentIndex + 1;
      setMistakes(newMistakes);
      setLives(newLives);

      if (newLives <= 0) {
        setIsKO(true);
        setIsFinished(true);
        realtimePresence.sendMatchProgress(
          session.matchId,
          currentIndex,
          score,
          newMistakes,
          0,
          true,
          false
        );
        setTimeout(() => {
          handleMatchEnd(false);
        }, 1000);
      } else {
        const willFinish = newProgress >= 10;
        realtimePresence.sendMatchProgress(
          session.matchId,
          newProgress,
          score,
          newMistakes,
          newLives,
          false,
          willFinish
        );
        setTimeout(() => {
          if (willFinish) {
            setIsFinished(true);
            handleMatchEnd(false);
          } else {
            setCurrentIndex((prev) => prev + 1);
          }
        }, 1000);
      }
    }
  };

  // Match Finish Handler
  const handleMatchEnd = (won: boolean) => {
    setIsFinished(true);
    setIsWinner(won);
    const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    setTotalTimeSec(elapsedSec);

    if (won) {
      audio.playLevelComplete();
    }

    if (isPlacement) {
      // Analyze Placement Match
      const result = evaluatePlacementMatch(correctCount + (won ? 1 : 0), mistakes, lives <= 0, elapsedSec);
      setPlacementResult(result);
      setRpDelta(result.initialRating);

      // Save Placement Stats
      onFinishMatch({
        rating: result.initialRating,
        rankTier: result.initialTier,
        placementDone: true,
        rankedWins: won ? 1 : 0,
        rankedLosses: won ? 0 : 1,
        energy: stats.energy + 20,
      });
    } else {
      // Normal Ranked Match
      const delta = calculateRatingDelta(won, score, mistakes, elapsedSec);
      setRpDelta(delta);
      const newRating = Math.max(0, (stats.rating || 0) + delta);
      const newTier = getRankInfo(newRating).tier;

      onFinishMatch({
        rating: newRating,
        rankTier: newTier,
        rankedWins: (stats.rankedWins || 0) + (won ? 1 : 0),
        rankedLosses: (stats.rankedLosses || 0) + (won ? 0 : 1),
        energy: stats.energy + (won ? 15 : 5),
      });
    }

    setMatchState('result');
  };

  // Render 3-2-1 Countdown Screen
  if (matchState === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#111827] to-[#1F2937] text-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="text-center max-w-md w-full space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-black">
            <Swords className="w-4 h-4 text-[#FF4B4B]" />
            <span>{isPlacement ? '初回ランク判定戦' : `${session.mode} ランクマッチ`}</span>
          </div>

          {/* Player vs Opponent Cards */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Player */}
            <div className="text-center space-y-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-4 border-[#58CC02] bg-white mx-auto shadow-lg flex items-center justify-center">
                {stats.avatarUrl ? (
                  <img src={stats.avatarUrl} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 text-[#58CC02]" />
                )}
              </div>
              <div className="font-black text-sm text-white truncate max-w-[100px]">
                {stats.userName || '会員'}
              </div>
              <div className="text-[11px] font-bold text-[#58CC02]">
                {getRankInfo(stats.rating || 0).name}
              </div>
            </div>

            <div className="text-3xl font-black text-[#FF4B4B] italic animate-pulse">
              VS
            </div>

            {/* Opponent(s) */}
            <div className="text-center space-y-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-4 border-[#FF4B4B] bg-white mx-auto shadow-lg flex items-center justify-center">
                {opponents[0]?.avatarUrl ? (
                  <img src={opponents[0].avatarUrl} alt="Opponent" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Bot className="w-10 h-10 text-[#FF4B4B]" />
                )}
              </div>
              <div className="font-black text-sm text-white truncate max-w-[100px]">
                {opponents[0]?.name || 'ライバル'}
              </div>
              <div className="text-[11px] font-bold text-[#FF4B4B]">
                {getRankInfo(opponents[0]?.rating || 100).name}
              </div>
            </div>
          </div>

          {/* Countdown Number */}
          <div className="py-4">
            <div className="text-7xl sm:text-8xl font-black text-[#FFD966] animate-bounce">
              {countdownNum}
            </div>
            <div className="text-xs font-bold text-white/60 mt-2">
              まもなく試合開始！10問先取で勝利！
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Match Results Screen
  if (matchState === 'result') {
    const finalRank = getRankInfo(isPlacement && placementResult ? placementResult.initialRating : (stats.rating || 0) + rpDelta);

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div 
          id="ranked-result-card"
          className="duo-card w-full max-w-md bg-white p-6 text-center animate-in zoom-in-95 duration-200 space-y-5"
        >
          {/* Header Banner */}
          <div className="space-y-1">
            <div className="text-5xl animate-bounce">
              {isWinner ? '👑' : isKO ? '💥' : '🥈'}
            </div>
            <h2 className={`text-3xl font-black ${isWinner ? 'text-[#58A700]' : 'text-[#FF4B4B]'}`}>
              {isWinner ? 'VICTORY (勝利！)' : isKO ? 'K.O. 敗北' : 'DEFEAT (敗北)'}
            </h2>
            <p className="text-xs font-bold text-[#777777]">
              {isWinner ? '圧倒的なスピードと正解率で勝利を収めました！' : '惜敗！次の試合でリベンジを果たそう！'}
            </p>
          </div>

          {/* Placement Result Reveal */}
          {isPlacement && placementResult ? (
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-2 border-[#FCD34D] space-y-3 text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D97706]" />
                <span className="text-xs font-black text-[#92400E] uppercase tracking-wider">
                  実力診断・初期ランク判定結果
                </span>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-[#FCD34D]">
                <span className="text-4xl">{finalRank.icon}</span>
                <div>
                  <div className="text-2xl font-black text-[#92400E]">
                    {placementResult.tierName}
                  </div>
                  <div className="text-xs font-black text-[#777777]">
                    初期レート: <span className="text-sm font-mono text-[#D97706]">{placementResult.initialRating} RP</span>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-[#B45309] leading-relaxed">
                {placementResult.reason}
              </p>
            </div>
          ) : (
            /* Regular RP Change Display */
            <div className="p-4 rounded-3xl bg-[#F7F7F7] border-2 border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-[#777777]">
                <span>ランクレート変動</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${isWinner ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                  {rpDelta > 0 ? `+${rpDelta} RP` : `${rpDelta} RP`}
                </span>
              </div>

              <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#E5E5E5]">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">{finalRank.icon}</span>
                  <div className="text-left">
                    <div className="text-base font-black text-[#3C3C3C]">
                      {finalRank.name}
                    </div>
                    <div className="text-xs font-mono font-bold text-[#777777]">
                      {Math.max(0, (stats.rating || 0) + rpDelta)} RP
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-[#AFAFAF]">所要時間</div>
                  <div className="text-xs font-black text-[#3C3C3C] font-mono">{totalTimeSec}秒</div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
            <div className="p-2.5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5]">
              <div className="text-[#777777] text-[10px]">正解数</div>
              <div className="text-base text-[#58CC02]">{correctCount}/10</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5]">
              <div className="text-[#777777] text-[10px]">ミス</div>
              <div className="text-base text-[#FF4B4B]">{mistakes}</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5]">
              <div className="text-[#777777] text-[10px]">獲得⚡️</div>
              <div className="text-base text-[#FF9600]">+{isWinner ? 20 : 5}⚡️</div>
            </div>
          </div>

          {/* Exit / Return Home Button */}
          <button
            id="return-from-ranked-btn"
            onClick={() => {
              audio.playTap();
              realtimePresence.setActiveMatchId(null);
              onExit();
            }}
            className="duo-btn duo-btn-green w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <span>ホームへ戻る</span>
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Render In-Game Quiz Screen
  return (
    <div className="w-full max-w-lg mx-auto px-4 py-4 min-h-[90vh] flex flex-col justify-between">
      {/* Top Bar: Progress, Lives & Opponent Status */}
      <div className="space-y-3">
        {/* Match Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-[#EBF7FD] text-[#1CB0F6] px-2.5 py-1 rounded-full border border-[#BDE3F8]">
              Q{currentIndex + 1} / 10
            </span>
            <span className="text-xs font-black text-[#FF9600]">
              Score: {score}
            </span>
          </div>

          {/* User Lives (3 Hearts) */}
          <div className="flex items-center gap-1 bg-[#FFF0F0] border-2 border-[#FFD0D0] px-3 py-1 rounded-2xl">
            {[1, 2, 3].map((heartIndex) => (
              <Heart
                key={heartIndex}
                className={`w-5 h-5 transition-transform ${
                  heartIndex <= lives
                    ? 'fill-[#FF4B4B] text-[#FF4B4B]'
                    : 'fill-[#E5E5E5] text-[#AFAFAF] scale-75'
                }`}
              />
            ))}
          </div>
        </div>

        {/* User Progress Bar */}
        <div className="w-full h-3 bg-[#E5E5E5] rounded-full overflow-hidden p-0.5">
          <div 
            className="h-full bg-gradient-to-r from-[#58CC02] to-[#58A700] rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex) / 10) * 100}%` }}
          />
        </div>

        {/* Opponents Live Bar */}
        <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-2.5 space-y-2">
          <div className="text-[10px] font-black text-[#777777] uppercase flex items-center justify-between">
            <span>相手のリアルタイム進捗</span>
            <span className="text-[#FF4B4B] flex items-center gap-1">
              <Swords className="w-3 h-3" /> LIVE
            </span>
          </div>

          <div className="space-y-1.5">
            {opponents.map((opp) => (
              <div key={opp.id} className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-full overflow-hidden border bg-white flex items-center justify-center shrink-0">
                  {opp.avatarUrl ? (
                    <img src={opp.avatarUrl} alt={opp.name} className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-[#FF4B4B]" />
                  )}
                </div>
                <span className="font-black text-[#3C3C3C] truncate w-20 text-[11px]">
                  {opp.name}
                </span>

                {/* Opponent progress mini bar */}
                <div className="flex-1 h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#FF4B4B] rounded-full transition-all duration-300"
                    style={{ width: `${((opp.progress || 0) / 10) * 100}%` }}
                  />
                </div>

                <span className="font-mono font-black text-[11px] text-[#777777] w-8 text-right">
                  {opp.progress || 0}/10
                </span>

                {/* Opponent Lives mini */}
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((h) => (
                    <Heart 
                      key={h} 
                      className={`w-3 h-3 ${h <= (opp.lives ?? 3) ? 'fill-[#FF4B4B] text-[#FF4B4B]' : 'fill-[#E5E5E5] text-[#AFAFAF]'}`} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Question Area */}
      <div className="my-6 space-y-4">
        {/* Japanese Prompt */}
        <div className="p-4 rounded-3xl bg-white border-2 border-[#E5E5E5] shadow-xs text-left">
          <div className="text-xs font-black text-[#1CB0F6] uppercase mb-1">
            {currentQ.type === 'order' ? '並べ替え問題' : '空欄補充・選択問題'}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-[#3C3C3C] leading-snug">
            {currentQ.japanese}
          </h3>
        </div>

        {/* Question Type: Order (並べ替え) */}
        {currentQ.type === 'order' && (
          <div className="space-y-4">
            {/* Selected Words Drop Area */}
            <div className="min-h-[64px] p-3 rounded-2xl bg-[#F7F7F7] border-2 border-dashed border-[#CBD5E1] flex flex-wrap gap-2 items-center">
              {selectedWords.length > 0 ? (
                selectedWords.map((word, idx) => (
                  <button
                    key={`${word}-${idx}`}
                    onClick={() => handleDeselectWord(word, idx)}
                    className="px-3.5 py-2 rounded-xl bg-white border-2 border-[#1CB0F6] text-[#1CB0F6] font-black text-sm shadow-xs hover:bg-[#EBF7FD] transition-transform active:scale-95 cursor-pointer"
                  >
                    {word}
                  </button>
                ))
              ) : (
                <span className="text-xs font-bold text-[#AFAFAF] mx-auto">
                  下の単語をタップして正しい順番に並べ替えてください
                </span>
              )}
            </div>

            {/* Available Words Pool */}
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {availableWords.map((word, idx) => (
                <button
                  key={`${word}-${idx}`}
                  onClick={() => handleSelectWord(word, idx)}
                  className="px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#E5E5E5] hover:border-[#1CB0F6] text-[#3C3C3C] font-black text-sm shadow-xs active:scale-95 cursor-pointer transition-all"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question Type: Blank or Choice */}
        {(currentQ.type === 'blank' || currentQ.type === 'translate' || currentQ.type === 'dialogue') && (
          <div className="space-y-3">
            {currentQ.promptSentence && (
              <div className="p-3.5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5] text-base font-black text-[#3C3C3C] text-center font-mono">
                {currentQ.promptSentence}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {(currentQ.choices || []).map((choice, idx) => {
                const isSelected = selectedChoice === choice;
                let btnStyle = 'bg-white border-[#E5E5E5] text-[#3C3C3C] hover:border-[#1CB0F6]';

                if (feedback === 'correct' && isSelected) {
                  btnStyle = 'bg-[#DCFCE7] border-[#22C55E] text-[#15803D]';
                } else if (feedback === 'wrong' && isSelected) {
                  btnStyle = 'bg-[#FEE2E2] border-[#EF4444] text-[#B91C1C]';
                } else if (isSelected) {
                  btnStyle = 'bg-[#EBF7FD] border-[#1CB0F6] text-[#1CB0F6]';
                }

                return (
                  <button
                    key={`${choice}-${idx}`}
                    onClick={() => {
                      audio.playTap();
                      setSelectedChoice(choice);
                      handleCheckAnswer(choice);
                    }}
                    disabled={isAnswerChecking}
                    className={`p-3.5 rounded-2xl border-2 font-black text-sm transition-all cursor-pointer shadow-xs ${btnStyle}`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Answer Feedback Banner */}
      {feedback && (
        <div 
          className={`p-3.5 rounded-2xl border-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            feedback === 'correct' 
              ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]' 
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{feedback === 'correct' ? '🎉' : '💔'}</span>
              <span className="font-black text-sm">
                {feedback === 'correct' ? '正解！ +120pt' : '不正解！（ライフ -1）'}
              </span>
            </div>
            {feedback === 'wrong' && (
              <span className="text-xs font-bold text-[#7F1D1D]">
                正解: <span className="font-black font-mono">{currentQ.correctAnswer}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Submit Button for Order type */}
      {currentQ.type === 'order' && (
        <div className="pb-4">
          <button
            id="submit-order-answer-btn"
            onClick={() => handleCheckAnswer()}
            disabled={selectedWords.length === 0 || isAnswerChecking}
            className={`duo-btn w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              selectedWords.length > 0 ? 'duo-btn-green' : 'duo-btn-gray opacity-60 cursor-not-allowed'
            }`}
          >
            <span>解答を送信する</span>
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

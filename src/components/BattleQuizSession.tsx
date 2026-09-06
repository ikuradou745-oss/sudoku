import { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Zap, 
  Medal, 
  Home, 
  Wifi, 
  Heart, 
  Skull 
} from 'lucide-react';
import { BattleRoom, RoomPlayer, Question } from '../types';
import { QUESTION_BANK } from '../data/questions';
import { audio } from '../utils/audio';
import { realtimeMultiplayer } from '../utils/multiplayer';

const TOTAL_BATTLE_QUESTIONS = 10;
const INITIAL_LIVES = 3;

interface BattleQuizSessionProps {
  room: BattleRoom;
  player: RoomPlayer;
  onFinishBattle: (result: { rank: number; reward: number; score: number }) => void;
  onExit: () => void;
}

export function BattleQuizSession({
  room,
  player,
  onFinishBattle,
  onExit,
}: BattleQuizSessionProps) {
  // Questions for this match (strictly 10 questions)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // User In-game State
  const [selectedWordOrder, setSelectedWordOrder] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [myScore, setMyScore] = useState<number>(0);
  const [myMistakes, setMyMistakes] = useState<number>(0);
  const [myLives, setMyLives] = useState<number>(INITIAL_LIVES);
  const [isKO, setIsKO] = useState<boolean>(false);
  const [isMyFinished, setIsMyFinished] = useState<boolean>(false);

  // Synchronized Players List (with live progress, score, lives, finish status)
  const [playersState, setPlayersState] = useState<RoomPlayer[]>(() =>
    room.players.map((p) => ({
      ...p,
      progress: 0,
      score: 0,
      mistakes: 0,
      lives: INITIAL_LIVES,
      isKO: false,
      finished: false,
    }))
  );

  // Match Result Podium State
  const [isMatchOver, setIsMatchOver] = useState<boolean>(false);
  const [finalRankings, setFinalRankings] = useState<
    Array<{ player: RoomPlayer; rank: number; reward: number; score: number; isKO: boolean }>
  >([]);

  const questionStartTimeRef = useRef<number>(Date.now());

  // 1. Pick 10 deterministic questions using room seed & modifiers
  useEffect(() => {
    let pool = [...QUESTION_BANK];

    const hasDiffUp = room.modifiers.some((m) => m.id === 'difficultyUp');
    const hasLonger = room.modifiers.some((m) => m.id === 'longerSentences');

    if (hasDiffUp) {
      pool = pool.filter((q) => q.difficulty === '4kyu' || q.difficulty === 'long');
    }
    if (hasLonger) {
      const longOnly = QUESTION_BANK.filter((q) => q.difficulty === 'long');
      pool = [...longOnly, ...pool];
    }

    // Deterministic shuffle using room.seed so all real players get identical questions in identical order
    const seeded = [...pool].sort((a, b) => {
      const hashA = (a.id.charCodeAt(0) * (room.seed || 12345)) % 100;
      const hashB = (b.id.charCodeAt(0) * (room.seed || 12345)) % 100;
      return hashA - hashB;
    });

    // Exactly 10 questions
    const matchQuestions = seeded.slice(0, TOTAL_BATTLE_QUESTIONS);
    setQuestions(matchQuestions);
    questionStartTimeRef.current = Date.now();
  }, [room.seed, room.modifiers]);

  // 2. Real-time WebSocket synchronization & Bot simulation logic
  useEffect(() => {
    const unsubscribe = realtimeMultiplayer.subscribe((event) => {
      if (event.type === 'LIVE_PROGRESS_UPDATE' && event.roomId === room.id) {
        const { playerId, progress, score, mistakes, lives, isKO: peerKO, finished } = event;
        setPlayersState((prev) =>
          prev.map((p) =>
            p.id === playerId
              ? { 
                  ...p, 
                  progress, 
                  score, 
                  mistakes, 
                  lives: lives !== undefined ? lives : (p.lives ?? INITIAL_LIVES),
                  isKO: peerKO !== undefined ? peerKO : p.isKO,
                  finished 
                }
              : p
          )
        );
      }
    });

    // If there are bot players in the room, simulate their answering progress & mistake rate
    const hasBots = room.players.some((p) => p.isBot);
    let botInterval: any = null;

    if (hasBots) {
      botInterval = setInterval(() => {
        if (isMatchOver) return;

        setPlayersState((prev) => {
          let anyUpdated = false;
          const updated = prev.map((p) => {
            if (!p.isBot || p.finished || p.isKO) return p;

            const roll = Math.random();
            if (roll > 0.45) {
              const currentProg = p.progress || 0;
              const nextProg = currentProg + 1;
              const isBotCorrect = Math.random() > 0.18;
              const currentLives = p.lives ?? INITIAL_LIVES;
              const nextLives = isBotCorrect ? currentLives : Math.max(0, currentLives - 1);
              const botKO = nextLives <= 0;
              const addedScore = isBotCorrect ? Math.floor(100 + Math.random() * 50) : 0;
              const isFinished = botKO || nextProg >= TOTAL_BATTLE_QUESTIONS;

              anyUpdated = true;
              return {
                ...p,
                progress: nextProg,
                score: (p.score || 0) + addedScore,
                mistakes: (p.mistakes || 0) + (isBotCorrect ? 0 : 1),
                lives: nextLives,
                isKO: botKO,
                finished: isFinished,
                finishTime: isFinished ? Date.now() : undefined,
              };
            }
            return p;
          });

          return anyUpdated ? updated : prev;
        });
      }, 2300);
    }

    return () => {
      unsubscribe();
      if (botInterval) clearInterval(botInterval);
    };
  }, [room.id, room.players, isMatchOver]);

  // Check if all players finished or KO'd
  useEffect(() => {
    if (isMatchOver) return;

    const allDone = playersState.every(
      (p) => p.finished || p.isKO || (p.progress || 0) >= TOTAL_BATTLE_QUESTIONS
    );
    if (allDone && isMyFinished) {
      calculateFinalRankings();
    }
  }, [playersState, isMyFinished, isMatchOver]);

  const currentQ = questions[currentIndex];

  // Word selection for 'order' type
  const handleToggleWord = (word: string, index: number) => {
    if (isAnswerChecked || isKO || isMyFinished) return;
    audio.playTap();

    const token = `${word}_${index}`;
    const isAlreadySelected = selectedWordOrder.includes(token);
    if (isAlreadySelected) {
      setSelectedWordOrder((prev) => prev.filter((w) => w !== token));
    } else {
      setSelectedWordOrder((prev) => [...prev, token]);
    }
  };

  const handleSelectChoice = (choice: string) => {
    if (isAnswerChecked || isKO || isMyFinished) return;
    audio.playTap();
    setSelectedChoice(choice);
  };

  // Submit Answer Check
  const handleCheckAnswer = () => {
    if (!currentQ || isAnswerChecked || isKO || isMyFinished) return;

    let userAns = '';
    if (currentQ.type === 'order') {
      userAns = selectedWordOrder.map((w) => w.split('_')[0]).join(' ');
    } else {
      userAns = selectedChoice || '';
    }

    if (!userAns.trim()) return;

    const correct = userAns.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    setIsAnswerChecked(true);

    const elapsedSeconds = (Date.now() - questionStartTimeRef.current) / 1000;
    // Speed bonus: max 150 points for fast answers
    const speedBonus = Math.max(0, Math.floor((10 - elapsedSeconds) * 8));
    const gainedPoints = correct ? 100 + speedBonus : 0;

    const nextScore = myScore + gainedPoints;
    const nextMistakes = myMistakes + (correct ? 0 : 1);
    const nextLives = correct ? myLives : Math.max(0, myLives - 1);
    const nextProgress = currentIndex + 1;
    const userIsKO = nextLives <= 0;
    const isFinished = userIsKO || nextProgress >= questions.length;

    setMyScore(nextScore);
    setMyMistakes(nextMistakes);
    setMyLives(nextLives);

    if (correct) {
      audio.playCorrect();
    } else {
      audio.playWrong();
    }

    if (userIsKO) {
      setIsKO(true);
      setIsMyFinished(true);
    }

    // Real-time broadcast to server & all room competitors
    realtimeMultiplayer.sendProgress(
      room.id,
      player.id,
      nextProgress,
      nextScore,
      nextMistakes,
      isFinished,
      nextLives,
      userIsKO
    );

    // Update local state for me
    setPlayersState((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? {
              ...p,
              progress: nextProgress,
              score: nextScore,
              mistakes: nextMistakes,
              lives: nextLives,
              isKO: userIsKO,
              finished: isFinished,
              finishTime: isFinished ? Date.now() : undefined,
            }
          : p
      )
    );

    if (isFinished) {
      setIsMyFinished(true);
      setTimeout(() => {
        calculateFinalRankings();
      }, userIsKO ? 2000 : 1500);
    }
  };

  const handleNextQuestion = () => {
    if (isKO || isMyFinished) return;

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedWordOrder([]);
      setSelectedChoice(null);
      setIsAnswerChecked(false);
      setIsCorrect(false);
      questionStartTimeRef.current = Date.now();
    }
  };

  // Calculate Rankings & ⚡️ Rewards (taking into account score & KO record)
  const calculateFinalRankings = () => {
    setIsMatchOver(true);
    audio.playEnergyGet();

    // Sort players: Active survivors first by Score DESC, KO players ranked by their recorded score at KO time
    const sorted = [...playersState].sort((a, b) => {
      // Both active or both KO: Compare by score
      if (a.isKO === b.isKO) {
        if ((b.score || 0) !== (a.score || 0)) {
          return (b.score || 0) - (a.score || 0);
        }
        return (b.progress || 0) - (a.progress || 0);
      }
      // Non-KO player beats KO player if scores are close, but score is primary
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }
      return a.isKO ? 1 : -1;
    });

    // Multiplier from modifiers
    const totalBonusMultiplier = 1 + room.modifiers.reduce((acc, m) => acc + (m.bonusPercent / 100), 0);

    const ranked = sorted.map((p, idx) => {
      const rank = idx + 1;
      let baseReward = 6;
      if (rank === 1) baseReward = 40;
      else if (rank === 2) baseReward = 25;
      else if (rank === 3) baseReward = 15;

      const totalReward = Math.round(baseReward * totalBonusMultiplier);

      return {
        player: p,
        rank,
        reward: totalReward,
        score: p.score || 0,
        isKO: !!p.isKO,
      };
    });

    setFinalRankings(ranked);

    // Save reward for current user
    const myRankItem = ranked.find((r) => r.player.id === player.id);
    if (myRankItem) {
      onFinishBattle({
        rank: myRankItem.rank,
        reward: myRankItem.reward,
        score: myRankItem.score,
      });
    }
  };

  // 1. MATCH OVER PODIUM VIEW
  if (isMatchOver) {
    const myResult = finalRankings.find((r) => r.player.id === player.id);

    return (
      <div className="w-full max-w-lg mx-auto px-4 py-6">
        <div 
          id="battle-results-card"
          className="duo-card p-6 sm:p-8 bg-white text-center shadow-xl"
        >
          {/* Top Trophy or Skull */}
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-3xl border-4 flex items-center justify-center shadow-md animate-bounce ${
              isKO 
                ? 'bg-[#FFF0F0] border-[#FFD0D0] text-[#FF4B4B]' 
                : 'bg-[#FFF9E6] border-[#FFD966] text-[#FF9600]'
            }`}>
              {isKO ? <Skull className="w-10 h-10" /> : <Trophy className="w-10 h-10" />}
            </div>
          </div>

          <h2 className="text-3xl font-black text-[#3C3C3C] tracking-tight mb-1">
            {isKO ? 'バトル終了 (ライフ0で脱落)' : 'オンライン対戦結果発表！'}
          </h2>
          <p className="text-sm font-bold text-[#AFAFAF] mb-6">
            全10問のバトル結果と獲得⚡️コイン
          </p>

          {/* My Rank Summary */}
          {myResult && (
            <div className={`p-4 border-2 rounded-2xl mb-6 flex items-center justify-between ${
              isKO ? 'bg-[#FFF5F5] border-[#FF4B4B]' : 'bg-[#F7FFF0] border-[#58CC02]'
            }`}>
              <div className="text-left">
                <div className="text-xs font-black uppercase flex items-center gap-1.5">
                  <span className={isKO ? 'text-[#FF4B4B]' : 'text-[#58A700]'}>
                    あなたの最終順位 {isKO && '(ライフ0地点で記録)'}
                  </span>
                </div>
                <div className="text-2xl font-black text-[#3C3C3C] flex items-center gap-1.5">
                  <span>第{myResult.rank}位</span>
                  {myResult.rank === 1 && <span>🥇</span>}
                  {myResult.rank === 2 && <span>🥈</span>}
                  {myResult.rank === 3 && <span>🥉</span>}
                </div>
                <div className="text-xs font-bold text-[#777777] mt-0.5">
                  最終到達: {currentIndex + 1}/10問 • スコア: {myScore} pt
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-black text-[#A57800]">獲得報酬</div>
                <div className="text-2xl font-black text-[#FF9600] flex items-center gap-1">
                  <span>+{myResult.reward}</span>
                  <Zap className="w-6 h-6 fill-current text-[#FF9600]" />
                </div>
              </div>
            </div>
          )}

          {/* Podium / Scoreboard list */}
          <div className="space-y-2.5 mb-6 text-left">
            {finalRankings.map((r) => {
              const isMe = r.player.id === player.id;
              let medalColor = 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]';
              if (r.rank === 1) medalColor = 'bg-[#FFF9E6] text-[#FF9600] border-[#FFD966] font-black';
              if (r.rank === 2) medalColor = 'bg-[#F0F4F8] text-[#546E7A] border-[#CFD8DC] font-black';
              if (r.rank === 3) medalColor = 'bg-[#FFF3E0] text-[#B07D46] border-[#FFE0B2] font-black';

              return (
                <div
                  key={r.player.id}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between ${
                    isMe 
                      ? isKO ? 'border-[#FF4B4B] bg-[#FFF8F8]' : 'border-[#58CC02] bg-[#F7FFF0]' 
                      : 'border-[#E5E5E5] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center text-sm font-black ${medalColor}`}>
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}位`}
                    </div>

                    <div className="w-8 h-8 rounded-full overflow-hidden border border-[#D0D0D0] bg-white flex items-center justify-center shrink-0">
                      {r.player.avatarUrl ? (
                        <img src={r.player.avatarUrl} alt={r.player.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{r.player.isBot ? '🤖' : '🐟'}</span>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-black text-[#3C3C3C] flex items-center gap-1">
                        <span>{r.player.name}</span>
                        {isMe && <span className="text-[10px] text-[#58CC02] font-black">(あなた)</span>}
                        {r.isKO && (
                          <span className="text-[10px] font-black bg-[#FFD0D0] text-[#FF4B4B] px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Skull className="w-2.5 h-2.5" /> KO
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-[#AFAFAF]">
                        {r.player.progress || 0}/10問 • スコア: {r.score} pt
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-[#FF9600] flex items-center gap-0.5">
                      +{r.reward} ⚡️
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Return Home Button */}
          <button
            onClick={() => {
              audio.playTap();
              onExit();
            }}
            className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Home className="w-5 h-5" />
            <span>ホームへ戻る</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. LIVE BATTLE QUESTION VIEW
  return (
    <div className="w-full max-w-xl mx-auto px-3 py-4">
      {/* Top Header: Live Race Progress Tracker + 3 Hearts */}
      <div className="duo-card p-4 mb-4 bg-white shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF9600]" />
            <span className="text-xs font-black text-[#3C3C3C]">
              第{Math.min(TOTAL_BATTLE_QUESTIONS, currentIndex + 1)}/{TOTAL_BATTLE_QUESTIONS}問
            </span>
            <span className="flex items-center gap-1 text-[10px] font-black bg-[#EBF7FD] text-[#1CB0F6] px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3 animate-pulse" />
              LIVE通信中
            </span>
          </div>

          {/* Lives (3 Hearts) & Score */}
          <div className="flex items-center gap-3">
            {/* Heart Icons */}
            <div className="flex items-center gap-1 bg-[#FFF0F0] px-2 py-0.5 rounded-full border border-[#FFD0D0]">
              {[1, 2, 3].map((heartIndex) => (
                <Heart
                  key={heartIndex}
                  className={`w-4 h-4 transition-all ${
                    myLives >= heartIndex
                      ? 'fill-[#FF4B4B] text-[#FF4B4B] scale-100'
                      : 'text-[#D0D0D0] fill-transparent scale-90'
                  }`}
                />
              ))}
            </div>

            <div className="text-xs font-black text-[#FF9600]">
              {myScore} pt
            </div>
          </div>
        </div>

        {/* Competitor Progress Tracks */}
        <div className="space-y-2">
          {playersState.map((p) => {
            const isMe = p.id === player.id;
            const pLives = p.lives !== undefined ? p.lives : INITIAL_LIVES;
            const isPKo = p.isKO || pLives <= 0;
            const progPercent = Math.min(100, Math.round(((p.progress || 0) / TOTAL_BATTLE_QUESTIONS) * 100));

            return (
              <div key={p.id} className="relative">
                <div className="flex items-center justify-between text-[11px] font-black mb-0.5 text-[#777777]">
                  <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                    <span>{p.name} {isMe && '👑 (あなた)'}</span>
                    {isPKo && (
                      <span className="text-[9px] font-black bg-[#FFD0D0] text-[#FF4B4B] px-1 py-0.1 rounded flex items-center gap-0.5">
                        <Skull className="w-2.5 h-2.5" /> KO
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Tiny hearts indicator for rivals */}
                    <span className="text-[10px] text-[#FF4B4B]">
                      {'❤️'.repeat(Math.max(0, pLives))}
                    </span>
                    <span>{p.progress || 0}/{TOTAL_BATTLE_QUESTIONS}問 ({p.score || 0}pt)</span>
                  </div>
                </div>

                <div className="h-3 bg-[#E5E5E5] rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isPKo
                        ? 'bg-[#FF4B4B]'
                        : isMe
                        ? 'bg-[#58CC02]'
                        : 'bg-[#1CB0F6]'
                    }`}
                    style={{ width: `${Math.max(5, progPercent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KO Elimination Overlay when lives = 0 */}
      {isKO ? (
        <div className="duo-card p-6 bg-white shadow-md text-center border-2 border-[#FF4B4B] animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-[#FFF0F0] text-[#FF4B4B] border-2 border-[#FFD0D0] flex items-center justify-center mx-auto mb-3">
            <Skull className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-xl font-black text-[#FF4B4B] mb-1">
            ライフが0になりました（KO脱落）
          </h3>
          <p className="text-xs font-bold text-[#777777] mb-4">
            第{currentIndex + 1}問地点（スコア: {myScore} pt）があなたの最終記録となります。<br />
            対戦相手の終了を待っています...
          </p>

          <button
            onClick={calculateFinalRankings}
            className="duo-btn duo-btn-blue w-full h-12 rounded-2xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
          >
            <Medal className="w-4 h-4" />
            <span>最終結果を確認する</span>
          </button>
        </div>
      ) : (
        /* Main Question Card */
        currentQ && (
          <div className="duo-card p-5 sm:p-6 bg-white shadow-md">
            {/* Question Prompt */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1 text-xs font-black text-[#1CB0F6] bg-[#EBF7FD] px-2.5 py-0.5 rounded-full border border-[#BAE3F8] mb-2">
                <span>英検{currentQ.difficulty === '5kyu' ? '5級' : '4級'}</span>
                <span>•</span>
                <span>並べ替え・選択</span>
                <span>•</span>
                <span className="text-[#FF4B4B]">ミスであと{myLives}機</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#3C3C3C] leading-snug">
                {currentQ.japanese}
              </h2>
            </div>

            {/* Mode 1: Order (並べ替え 5〜6単語) */}
            {currentQ.type === 'order' && currentQ.wordOptions && (
              <div className="space-y-4">
                {/* Selected Words Drop Box */}
                <div className="min-h-[56px] p-3 rounded-2xl bg-[#F7F7F7] border-2 border-dashed border-[#D0D0D0] flex flex-wrap gap-2 items-center">
                  {selectedWordOrder.length === 0 ? (
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      下の単語をタップして文を組み立ててください
                    </span>
                  ) : (
                    selectedWordOrder.map((token) => {
                      const word = token.split('_')[0];
                      return (
                        <button
                          key={token}
                          onClick={() => {
                            if (!isAnswerChecked) {
                              audio.playTap();
                              setSelectedWordOrder((prev) => prev.filter((w) => w !== token));
                            }
                          }}
                          className="duo-btn duo-btn-blue px-3.5 py-2 rounded-xl text-sm font-black text-white cursor-pointer"
                        >
                          {word}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Available Word Buttons */}
                <div className="flex flex-wrap gap-2">
                  {currentQ.wordOptions.map((w, idx) => {
                    const token = `${w}_${idx}`;
                    const isUsed = selectedWordOrder.includes(token);

                    return (
                      <button
                        key={token}
                        disabled={isUsed || isAnswerChecked}
                        onClick={() => handleToggleWord(w, idx)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all cursor-pointer ${
                          isUsed
                            ? 'border-[#E5E5E5] bg-[#E5E5E5] text-transparent cursor-not-allowed'
                            : 'border-[#E5E5E5] bg-white text-[#3C3C3C] hover:border-[#1CB0F6] hover:bg-[#F0F8FF]'
                        }`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 2: Multiple Choices (Blank, Translate, Dialogue) */}
            {currentQ.type !== 'order' && currentQ.choices && (
              <div className="space-y-2.5">
                {currentQ.promptSentence && (
                  <div className="p-3 bg-[#F7F7F7] rounded-xl text-base font-black text-[#3C3C3C] mb-3">
                    {currentQ.promptSentence}
                  </div>
                )}
                {currentQ.choices.map((choice) => {
                  const isSelected = selectedChoice === choice;
                  return (
                    <button
                      key={choice}
                      disabled={isAnswerChecked}
                      onClick={() => handleSelectChoice(choice)}
                      className={`w-full p-3.5 rounded-2xl border-2 text-left font-black text-sm sm:text-base transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#1CB0F6] bg-[#EBF7FD] text-[#1CB0F6]'
                          : 'border-[#E5E5E5] bg-white text-[#3C3C3C] hover:border-[#D0D0D0]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Feedback & Bottom Action Area */}
            <div className="mt-6 pt-4 border-t-2 border-[#E5E5E5]">
              {isAnswerChecked ? (
                <div className="space-y-3">
                  <div
                    className={`p-3.5 rounded-2xl flex items-center gap-3 ${
                      isCorrect
                        ? 'bg-[#F7FFF0] border-2 border-[#58CC02] text-[#58A700]'
                        : 'bg-[#FFF0F0] border-2 border-[#FFD0D0] text-[#FF4B4B]'
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 shrink-0 text-[#58CC02]" />
                    ) : (
                      <XCircle className="w-6 h-6 shrink-0 text-[#FF4B4B]" />
                    )}
                    <div>
                      <div className="text-sm font-black flex items-center gap-2">
                        <span>{isCorrect ? '正解！スピードボーナス獲得！' : '不正解... ライフ-1'}</span>
                        {!isCorrect && (
                          <span className="text-xs bg-[#FFD0D0] px-1.5 py-0.2 rounded font-black text-[#FF4B4B]">
                            残りライフ: {myLives}
                          </span>
                        )}
                      </div>
                      {!isCorrect && (
                        <div className="text-xs font-bold mt-0.5 text-[#3C3C3C]">
                          正解: {currentQ.correctAnswer}
                        </div>
                      )}
                    </div>
                  </div>

                  {currentIndex + 1 < questions.length ? (
                    <button
                      onClick={handleNextQuestion}
                      className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>次の問題へ ({currentIndex + 2}/{TOTAL_BATTLE_QUESTIONS})</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={calculateFinalRankings}
                      className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Medal className="w-5 h-5" />
                      <span>結果を見る</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  disabled={
                    (currentQ.type === 'order' && selectedWordOrder.length === 0) ||
                    (currentQ.type !== 'order' && !selectedChoice)
                  }
                  onClick={handleCheckAnswer}
                  className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  <span>回答する</span>
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

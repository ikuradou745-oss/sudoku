import { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Volume2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  RotateCcw,
  ArrowRight,
  Tv
} from 'lucide-react';
import { Question, Modifier } from '../types';
import { audio } from '../utils/audio';
import { AdModal } from './AdModal';

interface QuizSessionProps {
  mode: 'practice' | 'daily';
  questions: Question[];
  modifiers?: Modifier[];
  onFinish: (result: {
    completed: boolean;
    reward: number;
    perfect: boolean;
    mistakes: number;
  }) => void;
  onExit: () => void;
}

export function QuizSession({
  mode,
  questions,
  modifiers = [],
  onFinish,
  onExit,
}: QuizSessionProps) {
  const isHardcore = modifiers.some((m) => m.id === 'hardcore' && m.active);
  const isTimeLimit = modifiers.some((m) => m.id === 'timeLimit' && m.active);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [lives, setLives] = useState<number>(isHardcore ? 1 : 5);
  const [mistakes, setMistakes] = useState<number>(0);
  const [hasUsedRevive, setHasUsedRevive] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isCleared, setIsCleared] = useState<boolean>(false);

  // Time limit timer (15s per question)
  const [timeLeft, setTimeLeft] = useState<number>(15);

  // Current question answers & interaction state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const currentQ = questions[currentIndex];

  // Initialize question state
  useEffect(() => {
    if (!currentQ) return;

    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    setIsCorrect(null);
    setTimeLeft(15);

    if (currentQ.type === 'order' && currentQ.wordOptions) {
      const shuffled = [...currentQ.wordOptions].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWords([]);
    } else {
      setAvailableWords([]);
      setSelectedWords([]);
    }
  }, [currentIndex, currentQ]);

  // Handle wrong answer trigger
  const handleMistake = useCallback(() => {
    setMistakes((prev) => prev + 1);
    audio.playWrong();
    setIsCorrect(false);
    setIsAnswerChecked(true);

    const nextLives = lives - 1;
    setLives(nextLives);

    if (nextLives <= 0) {
      setTimeout(() => {
        setIsGameOver(true);
      }, 1000);
    }
  }, [lives]);

  // Countdown timer for timeLimit modifier
  useEffect(() => {
    if (!isTimeLimit || isAnswerChecked || isGameOver || isCleared) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleMistake();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimeLimit, isAnswerChecked, isGameOver, isCleared, handleMistake]);

  // Word selection for 'order' questions
  const handleSelectWord = (word: string, index: number) => {
    if (isAnswerChecked) return;
    audio.playTap();
    setSelectedWords((prev) => [...prev, word]);
    setAvailableWords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeselectWord = (word: string, index: number) => {
    if (isAnswerChecked) return;
    audio.playTap();
    setSelectedWords((prev) => prev.filter((_, i) => i !== index));
    setAvailableWords((prev) => [...prev, word]);
  };

  // Check Answer Button click
  const handleCheckAnswer = () => {
    if (isAnswerChecked || !currentQ) return;

    let userAns = '';
    if (currentQ.type === 'order') {
      userAns = selectedWords.join(' ').trim();
    } else {
      userAns = selectedAnswer || '';
    }

    if (!userAns) return;

    const normalizedUser = userAns.replace(/\s+/g, ' ').trim();
    const normalizedCorrect = currentQ.correctAnswer.replace(/\s+/g, ' ').trim();

    const matched = normalizedUser === normalizedCorrect;

    if (matched) {
      audio.playCorrect();
      setIsCorrect(true);
      setIsAnswerChecked(true);
      if (currentQ.type !== 'order' && (currentQ.audioPrompt || currentQ.english)) {
        audio.speakEnglish(currentQ.audioPrompt || currentQ.english);
      }
    } else {
      handleMistake();
    }
  };

  // Next question or complete session
  const handleNext = () => {
    audio.playTap();
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all questions!
      setIsCleared(true);
      audio.playEnergyGet();
    }
  };

  // Calculate Reward
  const calculateFinalReward = () => {
    const isPerfect = mistakes === 0;
    if (mode === 'daily') {
      const base = 15;
      return isPerfect ? base * 2 : base;
    }

    const base = 5;
    const activeMods = modifiers.filter((m) => m.active);
    const totalBonusPercent = activeMods.reduce((acc, m) => acc + m.bonusPercent, 0);
    const modMultiplier = 1 + totalBonusPercent / 100;
    const withMod = Math.round(base * modMultiplier);
    return isPerfect ? withMod * 2 : withMod;
  };

  // Ad Revive Complete
  const handleAdReviveComplete = () => {
    setShowAdModal(false);
    setIsGameOver(false);
    setHasUsedRevive(true);
    setLives(3);
    setIsAnswerChecked(false);
    setIsCorrect(null);
    setTimeLeft(15);
  };

  // Stage Clear summary screen
  if (isCleared) {
    const isPerfect = mistakes === 0;
    const finalReward = calculateFinalReward();
    const activeMods = modifiers.filter((m) => m.active);
    const totalBonusPercent = activeMods.reduce((acc, m) => acc + m.bonusPercent, 0);

    return (
      <div className="w-full max-w-md mx-auto px-4 py-6">
        <div 
          id="quiz-cleared-card"
          className="duo-card p-6 sm:p-8 text-center bg-white"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-3xl bg-[#58CC02] border-b-4 border-[#58A700] flex items-center justify-center text-white shadow-md animate-bounce">
              <Sparkles className="w-10 h-10" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-[#3C3C3C] tracking-tight mb-1">
            レッスン完了！
          </h1>
          <p className="text-sm font-bold text-[#AFAFAF] mb-6">
            {mode === 'daily' ? 'デイリーセットを全問クリア！' : '素晴らしい成果です！'}
          </p>

          {/* Reward Highlight Badge */}
          <div className="p-5 bg-[#F7FFF0] border-2 border-[#58CC02] rounded-3xl mb-6 shadow-xs">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl">⚡️</span>
              <span className="text-4xl font-black text-[#58CC02]">
                +{finalReward}
              </span>
            </div>
            <p className="text-xs font-black text-[#58A700]">
              エネルギーコインを獲得しました！
            </p>
          </div>

          {/* Breakdown Table */}
          <div className="p-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl mb-6 text-left space-y-2 text-sm font-bold">
            <div className="flex justify-between text-[#777777]">
              <span>基本報酬</span>
              <span className="font-black text-[#3C3C3C]">
                {mode === 'daily' ? '15 ⚡️' : '5 ⚡️'}
              </span>
            </div>

            {mode === 'practice' && activeMods.length > 0 && (
              <div className="flex justify-between text-[#1CB0F6]">
                <span>モディファイアボーナス ({activeMods.length}個)</span>
                <span className="font-black">+{totalBonusPercent}%</span>
              </div>
            )}

            {isPerfect && (
              <div className="flex justify-between text-[#FFC800]">
                <span>🌟 パーフェクトボーナス (ミス0回)</span>
                <span className="font-black">+100%</span>
              </div>
            )}

            <div className="border-t border-[#E5E5E5] pt-2 flex justify-between text-[#3C3C3C]">
              <span>間違えた回数</span>
              <span className="font-black text-[#FF4B4B]">{mistakes} 回</span>
            </div>
          </div>

          {/* Finish & Return Button */}
          <button
            id="finish-lesson-btn"
            onClick={() => {
              audio.playTap();
              onFinish({
                completed: true,
                reward: finalReward,
                perfect: isPerfect,
                mistakes,
              });
            }}
            className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-lg font-black flex items-center justify-center gap-2"
          >
            <span>次へ進む</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Game Over Modal overlay
  if (isGameOver) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        {showAdModal && (
          <AdModal
            onAdComplete={handleAdReviveComplete}
            onCancel={() => setShowAdModal(false)}
          />
        )}
        <div 
          id="game-over-card"
          className="duo-card w-full max-w-md p-6 sm:p-8 bg-white text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF0F0] border-2 border-[#FFD0D0] flex items-center justify-center text-[#FF4B4B]">
            <Heart className="w-8 h-8 fill-[#FF4B4B]" />
          </div>

          <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">
            ライフがなくなりました
          </h2>
          <p className="text-xs font-bold text-[#AFAFAF] mb-6">
            間違えてライフが0になりました。もう一度挑戦しますか？
          </p>

          <div className="space-y-3">
            {/* Ad Revive Button (1 time only) */}
            {!hasUsedRevive ? (
              <button
                onClick={() => {
                  audio.playTap();
                  setShowAdModal(true);
                }}
                className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2"
              >
                <Tv className="w-5 h-5" />
                <span>広告を見てライフ3で復活 (1回のみ)</span>
              </button>
            ) : (
              <div className="p-3 bg-[#F7F7F7] rounded-xl text-xs font-bold text-[#AFAFAF]">
                ※ 復活機能は1セッションにつき1回まで使用済みです
              </div>
            )}

            {/* Exit to Home button */}
            <button
              onClick={() => {
                audio.playTap();
                onExit();
              }}
              className="duo-btn duo-btn-gray w-full h-12 rounded-2xl text-sm font-black flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-[#AFAFAF]" />
              <span>ホームに戻る</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4">
      {/* Top Session Bar: Progress + Timer + Lives */}
      <div className="flex items-center gap-3 mb-5">
        {/* Close Button */}
        <button
          onClick={() => {
            audio.playTap();
            onExit();
          }}
          className="text-[#AFAFAF] hover:text-[#4B4B4B] font-black text-xl px-1 cursor-pointer"
        >
          ✕
        </button>

        {/* Progress Bar */}
        <div className="flex-1 bg-[#E5E5E5] h-4 rounded-full overflow-hidden p-0.5 relative">
          <div
            className="h-full bg-[#58CC02] rounded-full transition-all duration-300 relative"
            style={{
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
            }}
          >
            <div className="absolute top-0.5 left-2 right-2 h-1 bg-white/30 rounded-full"></div>
          </div>
        </div>

        {/* Time Limit indicator */}
        {isTimeLimit && (
          <div
            className={`flex items-center gap-1 font-mono-code font-black text-sm px-2.5 py-1 rounded-xl border ${
              timeLeft <= 5
                ? 'bg-[#FFF0F0] text-[#FF4B4B] border-[#FFD0D0] animate-pulse'
                : 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{timeLeft}s</span>
          </div>
        )}

        {/* Lives Counter */}
        <div className="flex items-center gap-1 text-[#FF4B4B] font-black">
          <Heart className="w-6 h-6 fill-[#FF4B4B]" />
          <span className="text-lg">{lives}</span>
        </div>
      </div>

      {/* Main Question Card */}
      <div 
        id="question-card"
        className="duo-card p-6 sm:p-8 bg-white mb-6"
      >
        {/* Question Type & (Optional) Audio Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#E5E5E5] text-[#4B4B4B]">
              {currentQ.type === 'order' && '自分で文を組み立てる (語順並べ替え)'}
              {currentQ.type === 'blank' && '空欄補充 (穴埋め)'}
              {currentQ.type === 'translate' && '英単語・意味選択'}
              {currentQ.type === 'dialogue' && '会話の応答'}
            </span>
          </div>

          {/* Do NOT show audio listening button for 'order' questions as requested */}
          {currentQ.type !== 'order' && (
            <button
              onClick={() => {
                audio.playTap();
                audio.speakEnglish(currentQ.audioPrompt || currentQ.english);
              }}
              className="p-2 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#1CB0F6] hover:bg-[#EBF7FD] flex items-center gap-1 text-xs font-bold"
            >
              <Volume2 className="w-4 h-4" />
              <span>音声を聴く</span>
            </button>
          )}
        </div>

        {/* Japanese Prompt */}
        <h2 className="text-xl sm:text-2xl font-black text-[#3C3C3C] mb-4 whitespace-pre-line leading-snug">
          {currentQ.japanese}
        </h2>

        {/* Prompt Sentence if exists */}
        {currentQ.promptSentence && currentQ.type !== 'dialogue' && (
          <div className="p-4 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl text-lg font-black text-[#3C3C3C] mb-6 font-mono-code text-center">
            {currentQ.promptSentence}
          </div>
        )}

        {/* --- QUESTION TYPE: ORDER (自分で文を組み立てる) --- */}
        {currentQ.type === 'order' && (
          <div className="space-y-6">
            {/* Target Assembly Area */}
            <div className="min-h-[64px] p-3 bg-[#F7F7F7] border-2 border-[#E5E5E5] border-dashed rounded-2xl flex flex-wrap gap-2 items-center">
              {selectedWords.length === 0 ? (
                <span className="text-xs font-bold text-[#AFAFAF] mx-auto">
                  下の単語をタップして正しい文を組み立ててください
                </span>
              ) : (
                selectedWords.map((word, idx) => (
                  <button
                    key={`sel-${idx}`}
                    onClick={() => handleDeselectWord(word, idx)}
                    disabled={isAnswerChecked}
                    className="duo-btn duo-btn-gray px-3.5 py-2 rounded-xl font-black text-base text-[#3C3C3C]"
                  >
                    {word}
                  </button>
                ))
              )}
            </div>

            {/* Available Word Bank (5~6 words) */}
            <div className="flex flex-wrap justify-center gap-2.5 pt-2">
              {availableWords.map((word, idx) => (
                <button
                  key={`avail-${idx}`}
                  onClick={() => handleSelectWord(word, idx)}
                  disabled={isAnswerChecked}
                  className="duo-btn duo-btn-gray px-4 py-2.5 rounded-xl font-black text-base text-[#3C3C3C]"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- QUESTION TYPE: MULTIPLE CHOICE (blank, translate, dialogue) --- */}
        {currentQ.type !== 'order' && currentQ.choices && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.choices.map((choice, idx) => {
              const isSelected = selectedAnswer === choice;
              let choiceStyle = 'duo-btn-gray text-[#3C3C3C]';

              if (isAnswerChecked) {
                if (choice === currentQ.correctAnswer) {
                  choiceStyle = 'bg-[#F7FFF0] border-2 border-[#58CC02] border-b-4 text-[#58CC02]';
                } else if (isSelected && !isCorrect) {
                  choiceStyle = 'bg-[#FFF0F0] border-2 border-[#FF4B4B] border-b-4 text-[#FF4B4B]';
                }
              } else if (isSelected) {
                choiceStyle = 'bg-[#EBF7FD] border-2 border-[#1CB0F6] border-b-4 text-[#1CB0F6]';
              }

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (isAnswerChecked) return;
                    audio.playTap();
                    setSelectedAnswer(choice);
                  }}
                  disabled={isAnswerChecked}
                  className={`duo-btn ${choiceStyle} p-4 rounded-2xl text-left font-black text-base flex items-center justify-between transition-all`}
                >
                  <span>{choice}</span>
                  <span className="w-6 h-6 rounded-lg bg-white/60 border border-[#E5E5E5] flex items-center justify-center text-xs font-black text-[#AFAFAF]">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Action / Feedback Drawer */}
      <div 
        id="feedback-drawer"
        className={`duo-card p-4 sm:p-5 transition-all ${
          !isAnswerChecked
            ? 'bg-white'
            : isCorrect
            ? 'bg-[#F7FFF0] border-[#58CC02]'
            : 'bg-[#FFF0F0] border-[#FF4B4B]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Feedback message */}
          {isAnswerChecked && (
            <div className="flex items-start gap-3 w-full sm:w-auto">
              {isCorrect ? (
                <CheckCircle2 className="w-7 h-7 text-[#58CC02] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-7 h-7 text-[#FF4B4B] shrink-0 mt-0.5" />
              )}
              <div>
                <div
                  className={`text-lg font-black ${
                    isCorrect ? 'text-[#58CC02]' : 'text-[#FF4B4B]'
                  }`}
                >
                  {isCorrect ? '正解！素晴らしい！' : 'おしい！'}
                </div>
                {!isCorrect && (
                  <div className="text-xs font-bold text-[#4B4B4B] mt-0.5">
                    正解: <span className="font-black text-[#3C3C3C]">{currentQ.correctAnswer}</span>
                  </div>
                )}
                {currentQ.explanation && (
                  <div className="text-xs font-bold text-[#777777] mt-1">
                    解説: {currentQ.explanation}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button: Check OR Next */}
          <div className="w-full sm:w-auto sm:min-w-[160px] sm:ml-auto">
            {!isAnswerChecked ? (
              <button
                id="check-answer-button"
                onClick={handleCheckAnswer}
                disabled={
                  currentQ.type === 'order'
                    ? selectedWords.length === 0
                    : !selectedAnswer
                }
                className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center disabled:opacity-40"
              >
                チェック
              </button>
            ) : (
              <button
                id="next-question-button"
                onClick={handleNext}
                className={`duo-btn w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 ${
                  isCorrect ? 'duo-btn-green' : 'duo-btn-red'
                }`}
              >
                <span>次へ</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

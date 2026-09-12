import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  Check, 
  Eraser, 
  PenTool, 
  Loader2, 
  Keyboard, 
  HelpCircle,
  Volume2
} from 'lucide-react';
import { Question } from '../types';
import { judgeHandwritingWithAi, HandwritingJudgeResult } from '../utils/aiQuestionClient';
import { audio } from '../utils/audio';

interface HandwritingQuizProps {
  question: Question;
  isAnswerChecked: boolean;
  isCorrect: boolean | null;
  onCheckAnswer: (isCorrect: boolean, details?: { recognizedText: string; feedback: string }) => void;
  disabled?: boolean;
}

export function HandwritingQuiz({
  question,
  isAnswerChecked,
  isCorrect,
  onCheckAnswer,
  disabled = false,
}: HandwritingQuizProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [isJudging, setIsJudging] = useState<boolean>(false);
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<'canvas' | 'text'>('canvas');
  const [textInput, setTextInput] = useState<string>('');

  // Setup high-res canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Initial clear & background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  // Reset when question changes
  useEffect(() => {
    setHasDrawn(false);
    setIsJudging(false);
    setJudgeResult(null);
    setTextInput('');
    setShowHint(false);
    setTool('pen');

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    }
  }, [question.id]);

  // Drawing helpers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled || isAnswerChecked || isJudging) return;
    if ('touches' in e) {
      e.preventDefault(); // prevent touch scroll
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 24;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      ctx.strokeStyle = '#1E293B'; // Deep dark pencil/ink color
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || isAnswerChecked || isJudging) return;
    if ('touches' in e) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  };

  const handleClear = () => {
    if (disabled || isAnswerChecked || isJudging) return;
    audio.playTap();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    setJudgeResult(null);
  };

  // Check Answer Handler
  const handleSubmitAnswer = async () => {
    if (disabled || isAnswerChecked || isJudging) return;

    if (inputMode === 'canvas') {
      if (!hasDrawn) {
        audio.playWrong();
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      setIsJudging(true);
      audio.playTap();

      try {
        const imageBase64 = canvas.toDataURL('image/png');
        const result = await judgeHandwritingWithAi({
          imageBase64,
          japanese: question.japanese,
          expectedAnswer: question.correctAnswer || question.english,
          acceptableAnswers: question.acceptableAnswers || [question.english],
        });

        setJudgeResult(result);
        setIsJudging(false);

        if (result.isCorrect) {
          audio.playCorrect();
        } else {
          audio.playWrong();
        }

        onCheckAnswer(result.isCorrect, {
          recognizedText: result.recognizedText,
          feedback: result.feedback,
        });
      } catch {
        setIsJudging(false);
        // Fallback pass
        onCheckAnswer(true);
      }
    } else {
      // Text fallback mode
      const trimmed = textInput.trim().toLowerCase();
      if (!trimmed) {
        audio.playWrong();
        return;
      }

      const expected = (question.correctAnswer || question.english).toLowerCase().trim();
      const acceptable = (question.acceptableAnswers || []).map((a) => a.toLowerCase().trim());
      const correct = trimmed === expected || acceptable.includes(trimmed);

      const res: HandwritingJudgeResult = {
        recognizedText: trimmed,
        isCorrect: correct,
        confidence: 1.0,
        feedback: correct
          ? '大正解！スペルも完璧です！🎉'
          : `惜しい！正解は「${question.correctAnswer || question.english}」でした！`,
      };

      setJudgeResult(res);
      if (correct) {
        audio.playCorrect();
      } else {
        audio.playWrong();
      }
      onCheckAnswer(correct, {
        recognizedText: res.recognizedText,
        feedback: res.feedback,
      });
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Tool Header: Guide Hint + Canvas Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Hint Toggle */}
          <button
            type="button"
            onClick={() => {
              audio.playTap();
              setShowHint(!showHint);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706] text-xs font-black flex items-center gap-1.5 hover:bg-[#FEF3C7] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{showHint ? 'ヒントを隠す' : 'ヒントを見る'}</span>
          </button>

          {/* Guide hint text */}
          {question.handwritingGuide && showHint && (
            <span className="px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-xs font-mono font-black text-[#475569] border border-[#CBD5E1] animate-in fade-in duration-150">
              {question.handwritingGuide}
            </span>
          )}
        </div>

        {/* Input Mode Toggle (Canvas vs Keyboard) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              audio.playTap();
              setInputMode(inputMode === 'canvas' ? 'text' : 'canvas');
            }}
            className="px-2.5 py-1 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] text-[#777777] text-xs font-bold flex items-center gap-1 hover:bg-[#EBEBEB] transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{inputMode === 'canvas' ? 'キーボードで書く' : '手書きに戻す'}</span>
          </button>
        </div>
      </div>

      {inputMode === 'canvas' ? (
        <div className="relative">
          {/* 4-Line English Notebook Background Container */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-[#CBD5E1] shadow-inner bg-white select-none">
            {/* Ruled Lines (English Notebook 4-lines) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-center px-4 opacity-50 z-0">
              <div className="w-full border-t border-[#94A3B8]/40 mb-5" />
              <div className="w-full border-t border-dashed border-[#38BDF8]/60 mb-5" />
              <div className="w-full border-t-2 border-[#F43F5E]/60 mb-5" />
              <div className="w-full border-t border-[#94A3B8]/40" />
            </div>

            {/* Notebook Line Labels */}
            <div className="absolute left-2 top-2 pointer-events-none text-[10px] font-bold text-[#94A3B8] z-0 select-none">
              4本線ノート ✏️ アルファベットを手書きで書こう
            </div>

            {/* Drawing Canvas */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 sm:h-52 block relative z-10 touch-none cursor-crosshair bg-transparent"
              style={{ touchAction: 'none' }}
            />

            {/* Placeholder guide text if untouched */}
            {!hasDrawn && !isAnswerChecked && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-center p-4 z-10">
                <span className="text-sm sm:text-base font-black text-[#94A3B8]/50 bg-white/70 px-4 py-1.5 rounded-full border border-[#CBD5E1]/40 shadow-2xs">
                  ここをなぞって英語を手書きで書いてね！✍️
                </span>
              </div>
            )}
          </div>

          {/* Canvas Action Bar: Pen, Eraser, Clear */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setTool('pen');
                }}
                disabled={isAnswerChecked || disabled}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'pen'
                    ? 'bg-[#1CB0F6] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>ペン</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setTool('eraser');
                }}
                disabled={isAnswerChecked || disabled}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'eraser'
                    ? 'bg-[#EF4444] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                <Eraser className="w-4 h-4" />
                <span>消しゴム</span>
              </button>
            </div>

            {/* Clear All Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasDrawn || isAnswerChecked || disabled}
              className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs font-black flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>書き直す</span>
            </button>
          </div>
        </div>
      ) : (
        /* Keyboard Text Input Fallback */
        <div className="p-4 bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] space-y-2">
          <label className="block text-xs font-black text-[#475569]">
            キーボードで英単語を入力：
          </label>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isAnswerChecked || disabled}
            placeholder="例: happy"
            autoFocus
            className="w-full px-4 py-3 bg-white border-2 border-[#CBD5E1] focus:border-[#1CB0F6] rounded-xl text-lg font-black text-[#1E293B] outline-hidden transition-colors"
          />
        </div>
      )}

      {/* AI Judging / Processing Indicator */}
      {isJudging && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAF5FF] to-[#F3E8FF] border-2 border-[#D8B4FE] flex items-center justify-center gap-3 text-[#9333EA] shadow-xs animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-black">
            AI（Gemini）が手書き文字を自動採点中... 🧠✨
          </span>
        </div>
      )}

      {/* Answer Evaluated Feedback Box */}
      {isAnswerChecked && judgeResult && (
        <div
          className={`p-4 rounded-2xl border-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            isCorrect
              ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-black flex items-center gap-1">
              {isCorrect ? '🎉 正解！' : '✍️ 判定結果'}
            </span>
            {judgeResult.recognizedText && (
              <span className="px-2 py-0.5 rounded-md bg-white/80 border border-current text-xs font-mono font-bold">
                AIが読み取った文字: 「{judgeResult.recognizedText}」
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line">
            {judgeResult.feedback || question.explanation}
          </p>

          <div className="mt-2 pt-2 border-t border-current/20 flex items-center justify-between text-xs font-black">
            <span>模範解答: {question.correctAnswer || question.english}</span>
            <button
              type="button"
              onClick={() => {
                audio.playTap();
                audio.speakEnglish(question.correctAnswer || question.english);
              }}
              className="flex items-center gap-1 text-current underline hover:opacity-80 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>発音を聴く</span>
            </button>
          </div>
        </div>
      )}

      {/* Submit Button (Before Answer is checked) */}
      {!isAnswerChecked && (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmitAnswer}
            disabled={disabled || isJudging || (inputMode === 'canvas' ? !hasDrawn : !textInput.trim())}
            className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            <span>答え合わせ (AIが自動判定)</span>
          </button>
        </div>
      )}
    </div>
  );
}

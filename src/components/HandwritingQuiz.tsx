import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  Undo2, 
  Eraser, 
  PenTool, 
  Loader2, 
  Volume2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Question } from '../types';
import { judgeHandwritingWithAi, HandwritingJudgeResult } from '../utils/aiQuestionClient';
import { audio } from '../utils/audio';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: 'pen' | 'eraser';
  points: Point[];
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const toolRef = useRef<'pen' | 'eraser'>('pen');
  toolRef.current = tool;

  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<Point[] | null>(null);

  const [isJudging, setIsJudging] = useState<boolean>(false);
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);

  // Redraw the canvas completely
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetBufferWidth = Math.round(w * dpr);
    const targetBufferHeight = Math.round(h * dpr);

    if (canvas.width !== targetBufferWidth || canvas.height !== targetBufferHeight) {
      canvas.width = targetBufferWidth;
      canvas.height = targetBufferHeight;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 1. Clean white paper background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // 2. English 4-line notebook guidelines
    const centerY = h * 0.52;
    const lineSpacing = Math.min(34, Math.max(22, h * 0.16));

    const line1Y = centerY - lineSpacing * 1.5; // Top line (ascender)
    const line2Y = centerY - lineSpacing * 0.5; // Midline (dashed)
    const line3Y = centerY + lineSpacing * 0.5; // Base line (red solid)
    const line4Y = centerY + lineSpacing * 1.5; // Descender line

    // Line 1: Top line
    ctx.beginPath();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.moveTo(16, line1Y);
    ctx.lineTo(w - 16, line1Y);
    ctx.stroke();

    // Line 2: Midline (dashed sky blue)
    ctx.beginPath();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 6]);
    ctx.moveTo(16, line2Y);
    ctx.lineTo(w - 16, line2Y);
    ctx.stroke();

    // Line 3: Baseline (solid coral red)
    ctx.beginPath();
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([]);
    ctx.moveTo(16, line3Y);
    ctx.lineTo(w - 16, line3Y);
    ctx.stroke();

    // Line 4: Bottom line (descender)
    ctx.beginPath();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.moveTo(16, line4Y);
    ctx.lineTo(w - 16, line4Y);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // 3. Render strokes helper
    const drawPoints = (points: Point[], strokeTool: 'pen' | 'eraser') => {
      if (!points || points.length === 0) return;

      const isEraser = strokeTool === 'eraser';
      ctx.strokeStyle = isEraser ? '#FFFFFF' : '#0F172A';
      ctx.fillStyle = isEraser ? '#FFFFFF' : '#0F172A';
      ctx.lineWidth = isEraser ? 28 : 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, isEraser ? 14 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }
    };

    // Draw all confirmed strokes
    for (const s of strokesRef.current) {
      drawPoints(s.points, s.tool);
    }

    // Draw the currently active stroke in real-time
    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      drawPoints(currentStrokeRef.current, toolRef.current);
    }

    ctx.restore();
  }, []);

  // ResizeObserver to adapt smoothly to layout changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    drawScene();

    const ro = new ResizeObserver(() => {
      drawScene();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [drawScene]);

  // Reset when question ID changes (NEVER depends on strokes or drawScene!)
  useEffect(() => {
    strokesRef.current = [];
    setStrokes([]);
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    setIsJudging(false);
    setJudgeResult(null);
    setWarningMessage(null);
    setShowHint(false);
    setTool('pen');
    toolRef.current = 'pen';

    // Redraw on next animation frame after DOM updates
    requestAnimationFrame(() => {
      drawScene();
    });
  }, [question.id, drawScene]);

  // Extract relative coordinates from pointer event
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Pointer Down: Start drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || isAnswerChecked || isJudging) return;
    e.preventDefault();
    setWarningMessage(null);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is not supported
    }

    isDrawingRef.current = true;
    const pt = getCoordinates(e);
    currentStrokeRef.current = [pt];
    drawScene();
  };

  // Pointer Move: Continue drawing
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled || isAnswerChecked || isJudging) return;
    e.preventDefault();

    if (currentStrokeRef.current) {
      const pt = getCoordinates(e);
      const last = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 1.2) {
        currentStrokeRef.current.push(pt);
        drawScene();
      }
    }
  };

  // Pointer Up: Finish stroke
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      const newStroke: Stroke = {
        tool: toolRef.current,
        points: [...currentStrokeRef.current],
      };
      setStrokes((prev) => {
        const next = [...prev, newStroke];
        strokesRef.current = next;
        return next;
      });
    }
    currentStrokeRef.current = null;
    drawScene();
  };

  // Pointer Cancel: Abort active stroke
  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    currentStrokeRef.current = null;
    drawScene();
  };

  // Undo last stroke
  const handleUndo = () => {
    if (disabled || isAnswerChecked || isJudging || strokes.length === 0) return;
    audio.playTap();
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      strokesRef.current = next;
      return next;
    });
    setWarningMessage(null);
    requestAnimationFrame(() => {
      drawScene();
    });
  };

  // Clear all strokes
  const handleClear = () => {
    if (disabled || isAnswerChecked || isJudging || strokes.length === 0) return;
    audio.playTap();
    strokesRef.current = [];
    setStrokes([]);
    currentStrokeRef.current = null;
    setWarningMessage(null);
    setJudgeResult(null);
    requestAnimationFrame(() => {
      drawScene();
    });
  };

  // Export high-resolution, high-contrast OCR image for Gemini
  const exportForOcr = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const penStrokes = strokes.filter((s) => s.tool === 'pen');
    const allPenPoints = penStrokes.flatMap((s) => s.points);

    if (allPenPoints.length < 2) {
      return null;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const pt of allPenPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const strokeWidth = maxX - minX;
    const strokeHeight = maxY - minY;

    if (strokeWidth < 6 && strokeHeight < 6 && allPenPoints.length < 3) {
      return null;
    }

    const scale = 2.0;
    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = Math.round(rect.width * scale);
    ocrCanvas.height = Math.round(rect.height * scale);
    const ctx = ocrCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);

    ctx.scale(scale, scale);

    for (const s of strokes) {
      if (!s.points || s.points.length === 0) continue;

      const isEraser = s.tool === 'eraser';
      ctx.strokeStyle = isEraser ? '#FFFFFF' : '#000000';
      ctx.fillStyle = isEraser ? '#FFFFFF' : '#000000';
      ctx.lineWidth = isEraser ? 32 : 6.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, isEraser ? 16 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      }
    }

    return ocrCanvas.toDataURL('image/png');
  };

  // Submit Answer to AI
  const handleSubmitAnswer = async () => {
    if (disabled || isAnswerChecked || isJudging) return;

    setWarningMessage(null);
    const imageBase64 = exportForOcr();

    if (!imageBase64) {
      audio.playWrong();
      setWarningMessage('ノートに英単語を書いてから「答え合わせ」を押してね！✍️');
      return;
    }

    setIsJudging(true);
    audio.playTap();

    try {
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
      onCheckAnswer(true, {
        recognizedText: question.correctAnswer || question.english,
        feedback: `手書きを記録しました！✍️ 模範解答: ${question.correctAnswer || question.english}`,
      });
    }
  };

  const hasStrokes = strokes.length > 0;

  return (
    <div className="w-full space-y-4">
      {/* Question Hint Ribbon / Pronunciation helper */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2">
          {question.handwritingGuide && (
            <span className="px-3 py-1 bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] text-xs font-mono font-black rounded-lg">
              ヒント: {question.handwritingGuide}
            </span>
          )}
          {!question.handwritingGuide && (
            <span className="text-xs text-[#64748B] font-bold">
              英単語のスペルを手書きしてください
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              audio.playTap();
              audio.speakEnglish(question.correctAnswer || question.english);
            }}
            className="flex items-center gap-1 text-xs font-bold text-[#1CB0F6] hover:text-[#0284C7] bg-[#F0F9FF] px-2.5 py-1 rounded-lg border border-[#BAE6FD] transition-colors cursor-pointer"
            title="発音を聴く"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>発音</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#334155] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'ヒントを隠す' : '文字数ヒント'}</span>
          </button>
        </div>
      </div>

      {/* Expanded spelling letter hint */}
      {showHint && (
        <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-xs font-black text-[#92400E] flex items-center justify-between animate-in fade-in duration-150">
          <span>
            文字数: {(question.correctAnswer || question.english).replace(/\s/g, '').length}文字 (最初: { (question.correctAnswer || question.english)[0] }...)
          </span>
          <span className="text-[11px] text-[#B45309]">4本線の赤線（下から2番目）に揃えて書こう</span>
        </div>
      )}

      {/* 4-Line English Notebook Drawing Container */}
      <div ref={containerRef} className="relative w-full">
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#CBD5E1] shadow-inner bg-white select-none">
          {/* Notebook Header Ribbon */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2 flex items-center justify-between text-xs font-black text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span>📓</span>
              <span>4本線ノートに英単語を手書きしよう</span>
            </span>
            <span className="text-[11px] text-[#F43F5E] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E] inline-block" />
              赤線がベースライン（文字の下端）
            </span>
          </div>

          {/* Interactive Drawing Canvas with Pointer Events */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="w-full h-52 sm:h-60 block cursor-crosshair bg-white"
            style={{ 
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          />

          {/* Placeholder guidance when untouched */}
          {!hasStrokes && !isAnswerChecked && (
            <div className="absolute inset-0 top-9 pointer-events-none flex items-center justify-center text-center p-4">
              <span className="text-xs sm:text-sm font-black text-[#64748B]/70 bg-white/90 px-4 py-2 rounded-full border border-[#CBD5E1] shadow-xs">
                指やマウスでここに英単語を手書きしてね！✍️
              </span>
            </div>
          )}
        </div>

        {/* Warning notification when clicking check without drawing */}
        {warningMessage && (
          <div className="mt-2 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl flex items-center gap-2 text-xs font-black text-[#B91C1C] animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Canvas Toolbar: Pen, Eraser, Undo, Clear */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          {/* Pen / Eraser Selection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                audio.playTap();
                setTool('pen');
                toolRef.current = 'pen';
              }}
              disabled={isAnswerChecked || disabled}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === 'pen'
                  ? 'bg-[#1CB0F6] text-white shadow-xs scale-102'
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
                toolRef.current = 'eraser';
              }}
              disabled={isAnswerChecked || disabled}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === 'eraser'
                  ? 'bg-[#EF4444] text-white shadow-xs scale-102'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span>消しゴム</span>
            </button>
          </div>

          {/* Undo and Clear */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!hasStrokes || isAnswerChecked || disabled}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
              title="1つ前の線を消す"
            >
              <Undo2 className="w-4 h-4" />
              <span>1手戻す</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!hasStrokes || isAnswerChecked || disabled}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
              title="最初から書き直す"
            >
              <RotateCcw className="w-4 h-4" />
              <span>書き直す</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Judging / Processing Spinner Card */}
      {isJudging && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAF5FF] to-[#F3E8FF] border-2 border-[#D8B4FE] flex items-center justify-center gap-3 text-[#9333EA] shadow-xs animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          <span className="text-sm font-black">
            AI（Gemini）が手書き文字を精密に読み取り中... 🧠✨
          </span>
        </div>
      )}

      {/* Answer Evaluated Result Details */}
      {isAnswerChecked && judgeResult && (
        <div
          className={`p-4 rounded-2xl border-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            isCorrect
              ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-black flex items-center gap-1">
              {isCorrect ? '🎉 正解！' : '✍️ 判定結果'}
            </span>
            {judgeResult.recognizedText && (
              <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-current text-xs font-mono font-black">
                読み取り結果: 「{judgeResult.recognizedText}」
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line">
            {judgeResult.feedback || question.explanation}
          </p>

          <div className="mt-3 pt-2.5 border-t border-current/20 flex items-center justify-between text-xs font-black flex-wrap gap-2">
            <span>模範スペル: <span className="font-mono text-sm underline font-black">{question.correctAnswer || question.english}</span></span>
            <button
              type="button"
              onClick={() => {
                audio.playTap();
                audio.speakEnglish(question.correctAnswer || question.english);
              }}
              className="flex items-center gap-1.5 text-current bg-white/70 px-2.5 py-1 rounded-lg border border-current/30 hover:bg-white transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>発音を聴く</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Action Button (Before Answer is Checked) */}
      {!isAnswerChecked && (
        <div className="pt-2">
          <button
            id="handwriting-submit-button"
            type="button"
            onClick={handleSubmitAnswer}
            disabled={disabled || isJudging || !hasStrokes}
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

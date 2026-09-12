import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  Undo2, 
  Eraser, 
  PenTool, 
  Loader2, 
  Volume2,
  AlertCircle
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[] | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [isJudging, setIsJudging] = useState<boolean>(false);
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Redraw the canvas with the 4-line notebook guide and all strokes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    // Set buffer size to match physical display pixels
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Clean white paper background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // 2. English 4-line notebook guidelines
    // Position lines proportionately across the vertical space
    const centerY = h * 0.52;
    const lineSpacing = Math.min(32, Math.max(22, h * 0.16));

    const line1Y = centerY - lineSpacing * 1.5; // Top line (ascender)
    const line2Y = centerY - lineSpacing * 0.5; // Midline (dashed)
    const line3Y = centerY + lineSpacing * 0.5; // Base line (red solid)
    const line4Y = centerY + lineSpacing * 1.5; // Descender line

    // Line 1: Top line
    ctx.beginPath();
    ctx.strokeStyle = '#CBD5E1';
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
    ctx.lineWidth = 2.0;
    ctx.setLineDash([]);
    ctx.moveTo(16, line3Y);
    ctx.lineTo(w - 16, line3Y);
    ctx.stroke();

    // Line 4: Bottom line (descender)
    ctx.beginPath();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.moveTo(16, line4Y);
    ctx.lineTo(w - 16, line4Y);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // 3. Render all completed strokes
    const drawStrokePoints = (points: Point[], strokeTool: 'pen' | 'eraser') => {
      if (points.length === 0) return;

      ctx.beginPath();
      if (strokeTool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 26;
      } else {
        ctx.strokeStyle = '#0F172A'; // Deep black/slate ink
        ctx.lineWidth = 5.5;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 1) {
        ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
      } else {
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
      ctx.stroke();
    };

    for (const s of strokes) {
      drawStrokePoints(s.points, s.tool);
    }

    // 4. Render active stroke in real-time
    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      drawStrokePoints(currentStrokeRef.current, tool);
    }

    ctx.restore();
  }, [strokes, tool]);

  // Initial and resize render
  useEffect(() => {
    renderCanvas();
    const handleResize = () => {
      renderCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Reset when question changes
  useEffect(() => {
    setStrokes([]);
    currentStrokeRef.current = null;
    setIsJudging(false);
    setJudgeResult(null);
    setWarningMessage(null);
    setTool('pen');
    renderCanvas();
  }, [question.id, renderCanvas]);

  // Coordinates helper
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
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
      e.preventDefault();
    }
    setWarningMessage(null);

    const pt = getCoordinates(e);
    currentStrokeRef.current = [pt];
    setIsDrawing(true);
    renderCanvas();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || isAnswerChecked || isJudging) return;
    if ('touches' in e) {
      e.preventDefault();
    }

    if (currentStrokeRef.current) {
      const pt = getCoordinates(e);
      // Avoid duplicate consecutive points
      const last = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 1.5) {
        currentStrokeRef.current.push(pt);
        renderCanvas();
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      const newStroke: Stroke = {
        tool,
        points: [...currentStrokeRef.current],
      };
      setStrokes((prev) => [...prev, newStroke]);
    }
    currentStrokeRef.current = null;
  };

  // Undo last stroke
  const handleUndo = () => {
    if (disabled || isAnswerChecked || isJudging || strokes.length === 0) return;
    audio.playTap();
    setStrokes((prev) => prev.slice(0, -1));
    setWarningMessage(null);
  };

  // Clear all strokes
  const handleClear = () => {
    if (disabled || isAnswerChecked || isJudging || strokes.length === 0) return;
    audio.playTap();
    setStrokes([]);
    currentStrokeRef.current = null;
    setWarningMessage(null);
    setJudgeResult(null);
  };

  // Export high-resolution, high-contrast, non-distorted OCR image for Gemini
  const exportForOcr = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Collect all pen points to evaluate coverage
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

    // Accidental speck with almost no dimension and very few points
    if (strokeWidth < 6 && strokeHeight < 6 && allPenPoints.length < 3) {
      return null;
    }

    // High-resolution canvas with exact 1:1 aspect ratio preserving natural handwriting geometry
    const scale = 2.0; // 2x crispness
    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = Math.round(rect.width * scale);
    ocrCanvas.height = Math.round(rect.height * scale);
    const ctx = ocrCanvas.getContext('2d');
    if (!ctx) return null;

    // Pure solid white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);

    ctx.scale(scale, scale);

    // Draw all strokes in exact chronological order with high contrast
    for (const s of strokes) {
      if (s.points.length === 0) continue;

      const isEraser = s.tool === 'eraser';
      ctx.strokeStyle = isEraser ? '#FFFFFF' : '#000000';
      ctx.fillStyle = isEraser ? '#FFFFFF' : '#000000';
      ctx.lineWidth = isEraser ? 32 : 6.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.points.length === 1) {
        // Single point / dot (e.g., dot on 'i' or 'j')
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
      onCheckAnswer(false, {
        recognizedText: '',
        feedback: '通信がタイムアウトしました。もう一度お試しください。',
      });
    }
  };

  const hasStrokes = strokes.length > 0;

  return (
    <div className="w-full space-y-4">
      {/* 4-Line English Notebook Drawing Container */}
      <div className="relative">
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#CBD5E1] shadow-inner bg-white select-none">
          {/* Notebook Header Ribbon */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2 flex items-center justify-between text-xs font-black text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span>📓</span>
              <span>4本線ノートに英単語をていねいに書こう</span>
            </span>
            <span className="text-[11px] text-[#94A3B8] font-bold hidden sm:inline">
              赤線がベースライン（文字の下端）です
            </span>
          </div>

          {/* Interactive Drawing Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-48 sm:h-56 block touch-none cursor-crosshair bg-white"
            style={{ touchAction: 'none' }}
          />

          {/* Placeholder guidance when untouched */}
          {!hasStrokes && !isAnswerChecked && (
            <div className="absolute inset-0 top-8 pointer-events-none flex items-center justify-center text-center p-4">
              <span className="text-xs sm:text-sm font-black text-[#64748B]/70 bg-white/85 px-4 py-2 rounded-full border border-[#CBD5E1] shadow-xs">
                指やペンでここに英単語を手書きしてね！✍️
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
              }}
              disabled={isAnswerChecked || disabled}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
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
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                tool === 'eraser'
                  ? 'bg-[#EF4444] text-white shadow-xs'
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
              className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
              title="1つ前の線を消す"
            >
              <Undo2 className="w-4 h-4" />
              <span>1手戻す</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!hasStrokes || isAnswerChecked || disabled}
              className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
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
                AIが読み取った文字: 「{judgeResult.recognizedText}」
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line">
            {judgeResult.feedback || question.explanation}
          </p>

          <div className="mt-3 pt-2.5 border-t border-current/20 flex items-center justify-between text-xs font-black flex-wrap gap-2">
            <span>模範スペル: <span className="font-mono text-sm underline">{question.correctAnswer || question.english}</span></span>
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

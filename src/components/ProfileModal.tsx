import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Check, 
  Paintbrush, 
  Minus, 
  PaintBucket, 
  Eraser, 
  RotateCcw, 
  Trash2, 
  User, 
  Grid,
  Sparkles
} from 'lucide-react';
import { audio } from '../utils/audio';

type GridSize = 16 | 32 | 64 | 'smooth';
type DrawingTool = 'pen' | 'line' | 'fill' | 'eraser';

interface ProfileModalProps {
  currentName: string;
  currentAvatar: string | null;
  onSave: (name: string, avatarDataUrl: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#58CC02', '#58A700',
  '#1CB0F6', '#1899D6', '#FF9600', '#FF4B4B',
  '#CE82FF', '#FFC800', '#2B70C9', '#84D8FF',
  '#FFD0D0', '#795548', '#8D6E63', '#4B4B4B',
  '#AFAFAF', '#E5E5E5'
];

export function ProfileModal({
  currentName,
  currentAvatar,
  onSave,
  onClose,
}: ProfileModalProps) {
  const [name, setName] = useState<string>(currentName || 'うおリンゴ会員');
  const [gridSize, setGridSize] = useState<GridSize>(32);
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#58CC02');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);

  // History stack for Undo
  const [history, setHistory] = useState<ImageData[]>([]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (currentAvatar) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveHistory();
      };
      img.src = currentAvatar;
    } else {
      // Default blank white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw a friendly default smiling fish icon
      drawDefaultIcon(ctx, canvas.width, canvas.height);
      saveHistory();
    }
  }, []);

  // Draw default Uolingo fish pattern
  const drawDefaultIcon = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#58CC02';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(w / 2 - 14, h / 2 - 6, 8, 0, Math.PI * 2);
    ctx.arc(w / 2 + 14, h / 2 - 6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3C3C3C';
    ctx.beginPath();
    ctx.arc(w / 2 - 12, h / 2 - 6, 4, 0, Math.PI * 2);
    ctx.arc(w / 2 + 16, h / 2 - 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 6, 12, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  };

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), imgData]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    audio.playTap();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const nextHistory = [...history];
    nextHistory.pop(); // Remove current
    const previous = nextHistory[nextHistory.length - 1];
    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(nextHistory);
    }
  };

  const handleClear = () => {
    audio.playTap();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  // Switch template presets
  const applyPreset = (type: 'fish' | 'star' | 'heart' | 'apple') => {
    audio.playTap();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    if (type === 'fish') {
      drawDefaultIcon(ctx, w, h);
    } else if (type === 'star') {
      ctx.fillStyle = '#FFC800';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡️', w / 2, h / 2);
    } else if (type === 'heart') {
      ctx.fillStyle = '#FF4B4B';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', w / 2, h / 2);
    } else if (type === 'apple') {
      ctx.fillStyle = '#FF4B4B';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + 5, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#58CC02';
      ctx.beginPath();
      ctx.ellipse(w / 2 + 8, h / 2 - 32, 14, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    saveHistory();
  };

  // Convert client coordinate to Canvas Pixel Coordinate
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (gridSize !== 'smooth') {
      const step = canvas.width / gridSize;
      x = Math.floor(x / step) * step;
      y = Math.floor(y / step) * step;
    }

    return { x: Math.max(0, Math.min(canvas.width, x)), y: Math.max(0, Math.min(canvas.height, y)) };
  };

  // Flood Fill Algorithm (Bucket)
  const floodFill = (startX: number, startY: number, fillHexColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const targetX = Math.floor(startX);
    const targetY = Math.floor(startY);
    const targetIdx = (targetY * canvas.width + targetX) * 4;

    const startR = data[targetIdx];
    const startG = data[targetIdx + 1];
    const startB = data[targetIdx + 2];
    const startA = data[targetIdx + 3];

    // Convert hex to rgb
    const r = parseInt(fillHexColor.slice(1, 3), 16);
    const g = parseInt(fillHexColor.slice(3, 5), 16);
    const b = parseInt(fillHexColor.slice(5, 7), 16);
    const a = 255;

    if (startR === r && startG === g && startB === b && startA === a) return;

    const matchTarget = (idx: number) => {
      return (
        Math.abs(data[idx] - startR) < 15 &&
        Math.abs(data[idx + 1] - startG) < 15 &&
        Math.abs(data[idx + 2] - startB) < 15 &&
        Math.abs(data[idx + 3] - startA) < 15
      );
    };

    const pixelStack: [number, number][] = [[targetX, targetY]];
    const width = canvas.width;
    const height = canvas.height;

    while (pixelStack.length > 0) {
      const [curX, curY] = pixelStack.pop()!;
      let y1 = curY;
      let idx = (y1 * width + curX) * 4;

      while (y1 >= 0 && matchTarget(idx)) {
        y1--;
        idx -= width * 4;
      }
      y1++;
      idx += width * 4;

      let spanLeft = false;
      let spanRight = false;

      while (y1 < height && matchTarget(idx)) {
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;

        if (curX > 0) {
          const leftIdx = idx - 4;
          if (matchTarget(leftIdx)) {
            if (!spanLeft) {
              pixelStack.push([curX - 1, y1]);
              spanLeft = true;
            }
          } else if (spanLeft) {
            spanLeft = false;
          }
        }

        if (curX < width - 1) {
          const rightIdx = idx + 4;
          if (matchTarget(rightIdx)) {
            if (!spanRight) {
              pixelStack.push([curX + 1, y1]);
              spanRight = true;
            }
          } else if (spanRight) {
            spanRight = false;
          }
        }

        y1++;
        idx += width * 4;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveHistory();
  };

  // Drawing Handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    isDrawingRef.current = true;
    const pos = getCanvasCoords(e);
    startPosRef.current = pos;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (selectedTool === 'fill') {
      floodFill(pos.x, pos.y, currentColor);
      isDrawingRef.current = false;
      return;
    }

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      drawPoint(pos.x, pos.y);
    }
  };

  const drawPoint = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = selectedTool === 'eraser' ? '#FFFFFF' : currentColor;

    if (gridSize !== 'smooth') {
      const step = canvas.width / gridSize;
      ctx.fillRect(x, y, step, step);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasCoords(e);

    if (selectedTool === 'line') {
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = gridSize === 'smooth' ? brushSize * 2 : canvas.width / (gridSize as number);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPosRef.current!.x, startPosRef.current!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (selectedTool === 'pen' || selectedTool === 'eraser') {
      if (gridSize === 'smooth') {
        ctx.strokeStyle = selectedTool === 'eraser' ? '#FFFFFF' : currentColor;
        ctx.lineWidth = brushSize * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(startPosRef.current!.x, startPosRef.current!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        startPosRef.current = pos;
      } else {
        drawPoint(pos.x, pos.y);
      }
    }
  };

  const handleEndDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    startPosRef.current = null;
    snapshotRef.current = null;
    saveHistory();
  };

  const handleSave = () => {
    audio.playTap();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const trimmedName = name.trim().slice(0, 12) || '学習者';
    onSave(trimmedName, dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="profile-settings-modal"
        className="duo-card w-full max-w-lg p-5 sm:p-6 bg-white my-auto max-h-[95vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#EBF7FD] text-[#1CB0F6] border-2 border-[#BAE3F8] flex items-center justify-center font-black">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C]">
                プロフィール設定
              </h2>
              <p className="text-xs font-bold text-[#AFAFAF]">
                名前と手描きアイコンをカスタマイズ
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. User Name Change Section (Max 12 chars) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-black text-[#3C3C3C]">
              ユーザー名（最大12文字）
            </label>
            <span className={`text-xs font-black ${name.length > 12 ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
              {name.length} / 12文字
            </span>
          </div>
          <input
            id="profile-name-input"
            type="text"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="お名前を入力"
            className="w-full h-12 px-4 rounded-xl border-2 border-[#E5E5E5] focus:border-[#58CC02] focus:bg-[#F7FFF0] text-base font-black text-[#3C3C3C] outline-none transition-all"
          />
        </div>

        {/* 2. Custom Icon Canvas Editor Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-black text-[#3C3C3C] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#FFC800]" />
              <span>アイコンパレット作成</span>
            </label>
            <span className="text-xs font-bold text-[#AFAFAF]">
              キャンバスに自由にお絵描き！
            </span>
          </div>

          {/* Grid Resolution Selector (16x16, 32x32, 64x64, Smooth) */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-xl mb-3">
            {[
              { id: 16 as GridSize, label: '16×16' },
              { id: 32 as GridSize, label: '32×32' },
              { id: 64 as GridSize, label: '64×64' },
              { id: 'smooth' as GridSize, label: 'bit無し' },
            ].map((res) => (
              <button
                key={String(res.id)}
                type="button"
                onClick={() => {
                  audio.playTap();
                  setGridSize(res.id);
                }}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  gridSize === res.id
                    ? 'bg-white text-[#58CC02] border-2 border-[#58CC02] shadow-xs'
                    : 'text-[#777777] hover:text-[#3C3C3C]'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>

          {/* Canvas Work Area & Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl">
            {/* The Main Drawing Canvas Container */}
            <div className="relative border-4 border-[#E5E5E5] rounded-2xl overflow-hidden bg-white shadow-inner shrink-0">
              <canvas
                ref={canvasRef}
                width={192}
                height={192}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDrawMove}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleEndDraw}
                className="w-[192px] h-[192px] touch-none cursor-crosshair block"
                style={{
                  imageRendering: gridSize === 'smooth' ? 'auto' : 'pixelated',
                }}
              />
              {/* Optional Grid Overlay */}
              {gridSize !== 'smooth' && showGridLines && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
                    backgroundSize: `${192 / (gridSize as number)}px ${192 / (gridSize as number)}px`,
                  }}
                />
              )}
            </div>

            {/* Tools & Actions Column */}
            <div className="flex-1 w-full space-y-3">
              {/* Tool Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  title="ペン"
                  onClick={() => {
                    audio.playTap();
                    setSelectedTool('pen');
                  }}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 font-black text-[11px] cursor-pointer ${
                    selectedTool === 'pen'
                      ? 'border-[#58CC02] bg-[#F7FFF0] text-[#58CC02]'
                      : 'border-[#E5E5E5] bg-white text-[#777777]'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>ペン</span>
                </button>

                <button
                  type="button"
                  title="直線"
                  onClick={() => {
                    audio.playTap();
                    setSelectedTool('line');
                  }}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 font-black text-[11px] cursor-pointer ${
                    selectedTool === 'line'
                      ? 'border-[#58CC02] bg-[#F7FFF0] text-[#58CC02]'
                      : 'border-[#E5E5E5] bg-white text-[#777777]'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span>線</span>
                </button>

                <button
                  type="button"
                  title="塗りつぶし"
                  onClick={() => {
                    audio.playTap();
                    setSelectedTool('fill');
                  }}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 font-black text-[11px] cursor-pointer ${
                    selectedTool === 'fill'
                      ? 'border-[#58CC02] bg-[#F7FFF0] text-[#58CC02]'
                      : 'border-[#E5E5E5] bg-white text-[#777777]'
                  }`}
                >
                  <PaintBucket className="w-4 h-4" />
                  <span>塗潰し</span>
                </button>

                <button
                  type="button"
                  title="消しゴム"
                  onClick={() => {
                    audio.playTap();
                    setSelectedTool('eraser');
                  }}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 font-black text-[11px] cursor-pointer ${
                    selectedTool === 'eraser'
                      ? 'border-[#58CC02] bg-[#F7FFF0] text-[#58CC02]'
                      : 'border-[#E5E5E5] bg-white text-[#777777]'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>消ゴム</span>
                </button>
              </div>

              {/* Undo, Clear, Grid toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="flex-1 py-1.5 px-2 rounded-xl border-2 border-[#E5E5E5] bg-white text-[#777777] hover:text-[#3C3C3C] text-xs font-black flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>戻す</span>
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-1.5 px-2 rounded-xl border-2 border-[#FFD0D0] bg-[#FFF0F0] text-[#FF4B4B] text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>クリア</span>
                </button>

                {gridSize !== 'smooth' && (
                  <button
                    type="button"
                    onClick={() => setShowGridLines(!showGridLines)}
                    className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black flex items-center justify-center cursor-pointer ${
                      showGridLines
                        ? 'border-[#1CB0F6] bg-[#EBF7FD] text-[#1CB0F6]'
                        : 'border-[#E5E5E5] bg-white text-[#AFAFAF]'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Template quick loader */}
              <div className="pt-1">
                <div className="text-[11px] font-black text-[#AFAFAF] mb-1">
                  クイック雛形:
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('fish')}
                    className="flex-1 py-1 rounded-lg bg-white border border-[#E5E5E5] text-xs hover:bg-[#F0F0F0] cursor-pointer"
                  >
                    🐟 魚
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('star')}
                    className="flex-1 py-1 rounded-lg bg-white border border-[#E5E5E5] text-xs hover:bg-[#F0F0F0] cursor-pointer"
                  >
                    ⚡️ 雷
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('heart')}
                    className="flex-1 py-1 rounded-lg bg-white border border-[#E5E5E5] text-xs hover:bg-[#F0F0F0] cursor-pointer"
                  >
                    ❤️ 心
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('apple')}
                    className="flex-1 py-1 rounded-lg bg-white border border-[#E5E5E5] text-xs hover:bg-[#F0F0F0] cursor-pointer"
                  >
                    🍎 林檎
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Color Palette & Custom Color Picker */}
          <div className="mt-3 p-3 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#3C3C3C]">
                カラーパレット (自由作成可能)
              </span>
              {/* Custom Color Input */}
              <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-[#E5E5E5] hover:border-[#58CC02]">
                <span className="text-[11px] font-black text-[#777777]">カラーピッカー:</span>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs font-mono font-black text-[#3C3C3C]">
                  {currentColor.toUpperCase()}
                </span>
              </label>
            </div>

            {/* Presets Grid */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setCurrentColor(c);
                  }}
                  className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer ${
                    currentColor.toLowerCase() === c.toLowerCase()
                      ? 'scale-115 border-[#3C3C3C] shadow-md ring-2 ring-black/10'
                      : 'border-black/10 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Save & Apply Button */}
        <div className="pt-2">
          <button
            id="save-profile-btn"
            type="button"
            onClick={handleSave}
            className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Check className="w-5 h-5" />
            <span>プロフィールを保存する</span>
          </button>
        </div>
      </div>
    </div>
  );
}

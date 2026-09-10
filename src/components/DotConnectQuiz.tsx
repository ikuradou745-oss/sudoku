import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MatchingPair } from '../types';
import { audio } from '../utils/audio';
import { Sparkles } from 'lucide-react';

interface DotConnectQuizProps {
  matchingPairs: MatchingPair[];
  isAnswerChecked: boolean;
  isCorrect?: boolean | null;
  onCheckAnswer: (allCorrect: boolean) => void;
  disabled?: boolean;
}

const PAIR_COLORS = [
  { stroke: '#1CB0F6', fill: '#EBF7FD', border: '#1CB0F6', text: '#1CB0F6' }, // Blue
  { stroke: '#58CC02', fill: '#EEFDEB', border: '#58CC02', text: '#58A700' }, // Green
  { stroke: '#FF9600', fill: '#FFF9E6', border: '#FF9600', text: '#D97706' }, // Orange
  { stroke: '#A855F7', fill: '#FAF5FF', border: '#A855F7', text: '#9333EA' }, // Purple
  { stroke: '#EC4899', fill: '#FDF2F8', border: '#EC4899', text: '#DB2777' }, // Pink
];

export function DotConnectQuiz({
  matchingPairs,
  isAnswerChecked,
  onCheckAnswer,
  disabled = false,
}: DotConnectQuizProps) {
  // Top items (left)
  const [topItems, setTopItems] = useState<MatchingPair[]>([]);
  // Bottom items (right) shuffled
  const [bottomItems, setBottomItems] = useState<MatchingPair[]>([]);

  // Selected top / bottom item for forming connection
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);
  const [selectedBottomId, setSelectedBottomId] = useState<string | null>(null);

  // Map of topPairId -> bottomPairId
  const [connections, setConnections] = useState<Record<string, string>>({});

  // Container & Dot coordinate measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const topDotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bottomDotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [lines, setLines] = useState<
    { topId: string; bottomId: string; x1: number; y1: number; x2: number; y2: number; colorIndex: number; isPairCorrect?: boolean }[]
  >([]);

  // Initialize pairs and shuffle bottom
  useEffect(() => {
    if (!matchingPairs || matchingPairs.length === 0) return;

    setTopItems(matchingPairs);
    // Shuffle bottom items
    const shuffled = [...matchingPairs].sort(() => Math.random() - 0.5);
    setBottomItems(shuffled);
    setConnections({});
    setSelectedTopId(null);
    setSelectedBottomId(null);
  }, [matchingPairs]);

  // Recalculate line coordinates when connections or layout changes
  const updateLinePositions = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const newLines: typeof lines = [];
    const entries = Object.entries(connections);

    entries.forEach(([topId, bottomId], idx) => {
      const topEl = topDotRefs.current[topId];
      const bottomEl = bottomDotRefs.current[bottomId];

      if (topEl && bottomEl) {
        const topRect = topEl.getBoundingClientRect();
        const bottomRect = bottomEl.getBoundingClientRect();

        const x1 = topRect.left + topRect.width / 2 - containerRect.left;
        const y1 = topRect.top + topRect.height / 2 - containerRect.top;
        const x2 = bottomRect.left + bottomRect.width / 2 - containerRect.left;
        const y2 = bottomRect.top + bottomRect.height / 2 - containerRect.top;

        // Check if this specific pair is correct
        const isPairCorrect = topId === bottomId;

        newLines.push({
          topId,
          bottomId,
          x1,
          y1,
          x2,
          y2,
          colorIndex: idx % PAIR_COLORS.length,
          isPairCorrect,
        });
      }
    });

    setLines(newLines);
  };

  useLayoutEffect(() => {
    updateLinePositions();
  }, [connections, topItems, bottomItems, isAnswerChecked]);

  // ResizeObserver to keep lines aligned
  useEffect(() => {
    const handleResize = () => {
      updateLinePositions();
    };

    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [connections]);

  // Interaction handlers
  const handleTopClick = (id: string) => {
    if (isAnswerChecked || disabled) return;
    audio.playTap();

    if (selectedBottomId) {
      makeConnection(id, selectedBottomId);
      setSelectedTopId(null);
      setSelectedBottomId(null);
    } else {
      setSelectedTopId((prev) => (prev === id ? null : id));
    }
  };

  const handleBottomClick = (id: string) => {
    if (isAnswerChecked || disabled) return;
    audio.playTap();

    if (selectedTopId) {
      makeConnection(selectedTopId, id);
      setSelectedTopId(null);
      setSelectedBottomId(null);
    } else {
      setSelectedBottomId((prev) => (prev === id ? null : id));
    }
  };

  const makeConnection = (topId: string, bottomId: string) => {
    setConnections((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === bottomId || k === topId) {
          delete next[k];
        }
      });
      next[topId] = bottomId;
      return next;
    });
  };

  const handleRemoveConnection = (topId: string) => {
    if (isAnswerChecked || disabled) return;
    audio.playTap();
    setConnections((prev) => {
      const next = { ...prev };
      delete next[topId];
      return next;
    });
  };

  // Check Answer
  const handleVerify = () => {
    if (isAnswerChecked || disabled) return;

    const isAllMatched = topItems.every((item) => connections[item.id] === item.id);
    onCheckAnswer(isAllMatched);
  };

  const totalPairs = topItems.length;
  const connectedCount = Object.keys(connections).length;
  const allConnected = totalPairs > 0 && connectedCount === totalPairs;

  return (
    <div className="space-y-4 my-2 select-none">
      <div className="flex items-center justify-between text-xs font-bold text-[#777777] px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔗</span>
          <span>
            対応する言葉と絵をタップして「線」で繋ごう！
          </span>
        </div>
        <div className="font-mono font-black text-[#1CB0F6] bg-[#EBF7FD] px-2.5 py-1 rounded-full border border-[#BDE3F8]">
          繋いだペア: {connectedCount} / {totalPairs}
        </div>
      </div>

      {/* Interactive Dot Connect Stage */}
      <div 
        ref={containerRef}
        id="dot-connect-container"
        className="relative p-4 sm:p-6 bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-3xl overflow-hidden min-h-[280px]"
      >
        {/* SVG Canvas for Bezier Connecting Lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
            </filter>
          </defs>

          {lines.map((l) => {
            const pairColor = PAIR_COLORS[l.colorIndex];
            const strokeColor = isAnswerChecked
              ? l.isPairCorrect
                ? '#58CC02'
                : '#FF4B4B'
              : pairColor.stroke;

            const pathData = `M ${l.x1} ${l.y1} C ${l.x1} ${l.y1 + 45}, ${l.x2} ${l.y2 - 45}, ${l.x2} ${l.y2}`;

            return (
              <g key={`line-${l.topId}-${l.bottomId}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isAnswerChecked && !l.isPairCorrect ? 5 : 4}
                  strokeLinecap="round"
                  filter="url(#line-glow)"
                  className="transition-all duration-200"
                />
                {isAnswerChecked && (
                  <circle
                    cx={(l.x1 + l.x2) / 2}
                    cy={(l.y1 + l.y2) / 2}
                    r={9}
                    fill={l.isPairCorrect ? '#58CC02' : '#FF4B4B'}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* 1. TOP ROW: Left Items */}
        <div className="relative z-20 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-16 sm:mb-20">
          {topItems.map((item) => {
            const isSelected = selectedTopId === item.id;
            const connectedBottomId = connections[item.id];
            const isConnected = !!connectedBottomId;
            const lineIndex = Object.keys(connections).indexOf(item.id);
            const pairColor = lineIndex >= 0 ? PAIR_COLORS[lineIndex % PAIR_COLORS.length] : null;

            return (
              <div key={`top-${item.id}`} className="flex flex-col items-center">
                <button
                  id={`top-card-${item.id}`}
                  onClick={() => handleTopClick(item.id)}
                  disabled={isAnswerChecked || disabled}
                  className={`w-full p-3 rounded-2xl border-2 font-black text-sm text-center transition-all cursor-pointer relative shadow-xs ${
                    isSelected
                      ? 'bg-white border-[#1CB0F6] ring-4 ring-[#1CB0F6]/30 -translate-y-1'
                      : isConnected && pairColor
                      ? 'bg-white border-2'
                      : 'bg-white border-[#E5E5E5] hover:border-[#CCCCCC]'
                  }`}
                  style={{
                    borderColor: isConnected && pairColor ? pairColor.stroke : undefined,
                  }}
                >
                  <div className="text-base sm:text-lg font-black text-[#2B2B2B]">
                    {item.left}
                  </div>
                  {item.leftAudio && (
                    <div className="text-[10px] text-[#AFAFAF] mt-0.5">
                      タップで選択
                    </div>
                  )}
                </button>

                {/* Bottom connector dot */}
                <div
                  ref={(el) => {
                    topDotRefs.current[item.id] = el;
                  }}
                  onClick={() => handleRemoveConnection(item.id)}
                  className={`w-4 h-4 rounded-full border-2 mt-1.5 transition-all flex items-center justify-center cursor-pointer ${
                    isConnected && pairColor
                      ? 'scale-110 shadow-xs'
                      : isSelected
                      ? 'bg-[#1CB0F6] border-white scale-125 ring-2 ring-[#1CB0F6]'
                      : 'bg-white border-[#BBBBBB]'
                  }`}
                  style={{
                    backgroundColor: isConnected && pairColor ? pairColor.stroke : undefined,
                    borderColor: isConnected && pairColor ? '#FFFFFF' : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* 2. BOTTOM ROW: Right Items */}
        <div className="relative z-20 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {bottomItems.map((item) => {
            const isSelected = selectedBottomId === item.id;
            const connectedTopId = Object.keys(connections).find((k) => connections[k] === item.id);
            const isConnected = !!connectedTopId;
            const lineIndex = connectedTopId ? Object.keys(connections).indexOf(connectedTopId) : -1;
            const pairColor = lineIndex >= 0 ? PAIR_COLORS[lineIndex % PAIR_COLORS.length] : null;

            return (
              <div key={`bottom-${item.id}`} className="flex flex-col items-center">
                {/* Top connector dot */}
                <div
                  ref={(el) => {
                    bottomDotRefs.current[item.id] = el;
                  }}
                  onClick={() => connectedTopId && handleRemoveConnection(connectedTopId)}
                  className={`w-4 h-4 rounded-full border-2 mb-1.5 transition-all flex items-center justify-center cursor-pointer ${
                    isConnected && pairColor
                      ? 'scale-110 shadow-xs'
                      : isSelected
                      ? 'bg-[#1CB0F6] border-white scale-125 ring-2 ring-[#1CB0F6]'
                      : 'bg-white border-[#BBBBBB]'
                  }`}
                  style={{
                    backgroundColor: isConnected && pairColor ? pairColor.stroke : undefined,
                    borderColor: isConnected && pairColor ? '#FFFFFF' : undefined,
                  }}
                />

                <button
                  id={`bottom-card-${item.id}`}
                  onClick={() => handleBottomClick(item.id)}
                  disabled={isAnswerChecked || disabled}
                  className={`w-full p-3 rounded-2xl border-2 font-black text-sm text-center transition-all cursor-pointer relative shadow-xs ${
                    isSelected
                      ? 'bg-white border-[#1CB0F6] ring-4 ring-[#1CB0F6]/30 translate-y-1'
                      : isConnected && pairColor
                      ? 'bg-white border-2'
                      : 'bg-white border-[#E5E5E5] hover:border-[#CCCCCC]'
                  }`}
                  style={{
                    borderColor: isConnected && pairColor ? pairColor.stroke : undefined,
                  }}
                >
                  <div className="text-base sm:text-lg font-black text-[#2B2B2B]">
                    {item.right}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Check Answer Button */}
      {!isAnswerChecked && (
        <div className="pt-2 flex justify-center">
          <button
            id="check-matching-answer-btn"
            onClick={handleVerify}
            disabled={!allConnected || disabled}
            className={`px-8 py-3.5 rounded-2xl font-black text-base flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              allConnected
                ? 'duo-btn duo-btn-green text-white'
                : 'duo-btn duo-btn-gray opacity-60 cursor-not-allowed text-[#AFAFAF]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>答え合わせ ({connectedCount}/{totalPairs} 接続完了)</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Lock, 
  Check, 
  Heart, 
  HelpCircle, 
  Award, 
  ChevronUp, 
  MapPin, 
  X,
  Play
} from 'lucide-react';
import { UserStats } from '../types';
import { 
  getStoryStageMeta, 
  StoryStageMeta, 
  STORY_MILESTONES 
} from '../utils/storyStages';
import { audio } from '../utils/audio';

interface StoryModeScreenProps {
  stats: UserStats;
  onBack: () => void;
  onStartStage: (stageNumber: number) => void;
}

export function StoryModeScreen({
  stats,
  onBack,
  onStartStage,
}: StoryModeScreenProps) {
  const currentStage = Math.max(1, Math.min(200, stats.storyCurrentStage || 1));

  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [showMilestoneRoadmap, setShowMilestoneRoadmap] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentStageRef = useRef<HTMLDivElement | null>(null);

  // Generate all 200 stages list (1 to 200)
  const stages = useMemo(() => {
    return Array.from({ length: 200 }, (_, i) => i + 1);
  }, []);

  // Auto-scroll to current stage on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStageRef.current) {
        currentStageRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [currentStage]);

  const scrollToCurrent = () => {
    audio.playTap();
    if (currentStageRef.current) {
      currentStageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const scrollToTop = () => {
    audio.playTap();
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStageClick = (stageNum: number) => {
    if (stageNum > currentStage) {
      audio.playWrong();
      return;
    }
    audio.playTap();
    setSelectedStage(stageNum);
  };

  const handleConfirmStart = () => {
    if (!selectedStage) return;
    audio.playTap();
    onStartStage(selectedStage);
  };

  const selectedMeta: StoryStageMeta | null = selectedStage
    ? getStoryStageMeta(selectedStage)
    : null;

  return (
    <div className="w-full max-w-xl mx-auto h-[100vh] flex flex-col bg-[#F7F7F7] border-x border-[#E5E5E5] relative shadow-lg">
      {/* Top Header */}
      <header className="px-4 py-3 bg-white border-b-2 border-[#E5E5E5] flex items-center justify-between z-20 shrink-0">
        <button
          onClick={() => {
            audio.playTap();
            onBack();
          }}
          className="flex items-center gap-1.5 text-xs font-black text-[#777777] hover:text-[#3C3C3C] bg-[#F7F7F7] border border-[#E5E5E5] px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ホームへ</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-[10px] font-black text-[#AFAFAF] uppercase tracking-wider">
              ストーリー進行度
            </div>
            <div className="text-sm font-black text-[#3C3C3C]">
              ステージ <span className="text-[#58CC02] font-mono">{currentStage}</span> / 200
            </div>
          </div>
        </div>

        {/* Milestone Roadmap & Energy */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              audio.playTap();
              setShowMilestoneRoadmap(true);
            }}
            className="flex items-center gap-1 bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] text-xs font-black px-2.5 py-1.5 rounded-xl hover:bg-[#FEF3C7] cursor-pointer"
            title="マイルストーン報酬を確認"
          >
            <Award className="w-4 h-4 text-[#F59E0B]" />
            <span>報酬一覧</span>
          </button>

          <div className="flex items-center gap-1 bg-[#FFF9E6] border border-[#FFD966] px-2.5 py-1.5 rounded-xl text-xs font-black text-[#FF9600]">
            <span>⚡️</span>
            <span className="font-mono">{stats.energy}</span>
          </div>
        </div>
      </header>

      {/* Chapter Overview Sub-Bar */}
      <div className="px-4 py-2 bg-gradient-to-r from-[#F0FDF4] to-[#EBF7FD] border-b border-[#E5E5E5] flex items-center justify-between text-xs z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">🗺️</span>
          <span className="font-black text-[#3C3C3C]">
            {getStoryStageMeta(currentStage).chapterName}
          </span>
        </div>
        <span className="text-[11px] font-bold text-[#166534] bg-white px-2 py-0.5 rounded-md border border-[#BBF7D0]">
          {getStoryStageMeta(currentStage).gradeLevel}
        </span>
      </div>

      {/* Vertically Scrollable Path of 200 Stages (1 to 200) */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-8 relative space-y-6 select-none"
      >
        <div className="text-center mb-6">
          <div className="inline-block bg-white border border-[#E5E5E5] rounded-2xl px-4 py-2 shadow-xs">
            <h2 className="text-base font-black text-[#3C3C3C] flex items-center justify-center gap-1.5">
              <span>🌟 全200ステージ・完全踏破ロード</span>
            </h2>
            <p className="text-[11px] font-bold text-[#777777] mt-0.5">
              ライフは1のみ！3問クリアで5⚡️獲得＆豪華マイルストーン！
            </p>
          </div>
        </div>

        {/* Stages Node Stream */}
        <div className="flex flex-col items-center gap-6 relative max-w-sm mx-auto">
          {stages.map((stageNum) => {
            const isCleared = stageNum < currentStage;
            const isCurrent = stageNum === currentStage;
            const milestone = STORY_MILESTONES[stageNum];

            // Winding zigzag horizontal offset for Duolingo-like feel
            const offsetCycle = stageNum % 6;
            let offsetClass = 'translate-x-0';
            if (offsetCycle === 1) offsetClass = 'translate-x-12';
            else if (offsetCycle === 2) offsetClass = 'translate-x-20';
            else if (offsetCycle === 3) offsetClass = 'translate-x-12';
            else if (offsetCycle === 4) offsetClass = '-translate-x-12';
            else if (offsetCycle === 5) offsetClass = '-translate-x-20';

            // Milestone stages always centered
            if (milestone) offsetClass = 'translate-x-0';

            return (
              <div
                key={stageNum}
                ref={isCurrent ? currentStageRef : undefined}
                className={`flex flex-col items-center relative transition-transform ${offsetClass}`}
              >
                {/* Chapter Boundary Divider Banner */}
                {stageNum === 51 && (
                  <div className="w-full my-4 py-2 px-3 bg-[#EBF7FD] border-2 border-[#BAE6FD] rounded-2xl text-center shadow-xs">
                    <div className="text-xs font-black text-[#0284C7]">第2章: 英検5級 発展〜英検4級 初級編</div>
                    <div className="text-[10px] text-[#0369A1] font-bold">過去形や疑問詞の日常会話へステップアップ！</div>
                  </div>
                )}
                {stageNum === 101 && (
                  <div className="w-full my-4 py-2 px-3 bg-[#FAF5FF] border-2 border-[#E9D5FF] rounded-2xl text-center shadow-xs">
                    <div className="text-xs font-black text-[#9333EA]">第3章: 英検4級 応用編</div>
                    <div className="text-[10px] text-[#7E22CE] font-bold">比較級・未来表現・助動詞をマスターしよう！</div>
                  </div>
                )}
                {stageNum === 151 && (
                  <div className="w-full my-4 py-2 px-3 bg-[#FFFBEB] border-2 border-[#FDE68A] rounded-2xl text-center shadow-xs">
                    <div className="text-xs font-black text-[#D97706]">第4章: 英検4級〜3級 マスター編</div>
                    <div className="text-[10px] text-[#B45309] font-bold">受動態・不定詞・現在完了などの重要長文に挑め！</div>
                  </div>
                )}

                {/* Milestone Landmark Card */}
                {milestone && (
                  <div className="mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-2 border-[#F59E0B] shadow-md flex items-center gap-2 max-w-xs text-center">
                    <span className="text-2xl">{milestone.icon}</span>
                    <div className="text-left">
                      <div className="text-[10px] font-black text-[#92400E] uppercase">
                        ステージ{stageNum} 到達記念報酬
                      </div>
                      <div className="text-xs font-black text-[#B45309]">
                        {milestone.rewardLabel}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage Button Node */}
                <button
                  type="button"
                  onClick={() => handleStageClick(stageNum)}
                  className={`relative flex items-center justify-center rounded-3xl transition-all cursor-pointer ${
                    isCurrent
                      ? 'w-20 h-20 bg-[#58CC02] border-b-6 border-[#58A700] text-white shadow-xl scale-110 ring-4 ring-[#58CC02]/40 animate-pulse'
                      : isCleared
                      ? 'w-16 h-16 bg-[#58CC02] border-b-4 border-[#46A302] text-white shadow-md hover:scale-105'
                      : 'w-16 h-16 bg-[#E5E5E5] border-b-4 border-[#CCCCCC] text-[#AFAFAF] opacity-75 hover:opacity-90'
                  }`}
                >
                  {isCleared ? (
                    <div className="flex flex-col items-center">
                      <Check className="w-6 h-6 stroke-[3]" />
                      <span className="text-[10px] font-black font-mono">
                        {stageNum}
                      </span>
                    </div>
                  ) : isCurrent ? (
                    <div className="flex flex-col items-center">
                      <Play className="w-6 h-6 fill-white stroke-none" />
                      <span className="text-xs font-black font-mono">
                        {stageNum}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Lock className="w-5 h-5 text-[#999999]" />
                      <span className="text-[10px] font-black font-mono text-[#777777]">
                        {stageNum}
                      </span>
                    </div>
                  )}

                  {/* "ここから！" floating badge on current */}
                  {isCurrent && (
                    <div className="absolute -top-7 px-2 py-0.5 bg-[#FF9600] border border-[#D97706] text-white rounded-full text-[10px] font-black shadow-md whitespace-nowrap animate-bounce">
                      現在のステージ
                    </div>
                  )}
                </button>

                {/* Sub-label */}
                <span className={`text-[10px] font-black mt-1 ${isCurrent ? 'text-[#58CC02]' : isCleared ? 'text-[#3C3C3C]' : 'text-[#AFAFAF]'}`}>
                  {milestone ? milestone.rewardLabel.slice(0, 14) : `ステージ ${stageNum}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Helper Buttons (Jump to Current / Top) */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={scrollToTop}
          className="w-10 h-10 rounded-2xl bg-white/95 border-2 border-[#E5E5E5] shadow-md flex items-center justify-center text-[#777777] hover:text-[#3C3C3C] cursor-pointer"
          title="一番上に戻る"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={scrollToCurrent}
          className="px-3.5 py-2 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white font-black text-xs shadow-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="現在地へジャンプ"
        >
          <MapPin className="w-4 h-4" />
          <span>Stage {currentStage} へ</span>
        </button>
      </div>

      {/* Stage Detail Confirmation Modal */}
      {selectedStage && selectedMeta && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl border-2 border-[#E5E5E5] p-5 shadow-2xl relative">
            <button
              onClick={() => {
                audio.playTap();
                setSelectedStage(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#3C3C3C] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] text-xs font-black mb-2">
                <span>{selectedMeta.chapterName}</span>
              </div>
              <h3 className="text-xl font-black text-[#3C3C3C]">
                {selectedMeta.title}
              </h3>
              <p className="text-xs font-bold text-[#777777] mt-1">
                {selectedMeta.description}
              </p>
            </div>

            {/* Stage Rules (Strictly 1 life & 3 questions & 5⚡️) */}
            <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-2xl p-3.5 space-y-2.5 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] flex items-center gap-1">
                  <Heart className="w-4 h-4 text-[#FF4B4B] fill-[#FF4B4B]" />
                  <span>挑戦ライフ:</span>
                </span>
                <span className="font-black text-[#FF4B4B] bg-[#FFF0F0] px-2 py-0.5 rounded-md border border-[#FFD0D0]">
                  1ライフ (ノーミス勝負)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-[#1CB0F6]" />
                  <span>問題数:</span>
                </span>
                <span className="font-black text-[#1CB0F6] bg-[#EBF7FD] px-2 py-0.5 rounded-md border border-[#BAE6FD]">
                  厳選 3問
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] flex items-center gap-1">
                  <span>⚡️</span>
                  <span>クリア獲得:</span>
                </span>
                <span className="font-black text-[#FF9600] bg-[#FFF9E6] px-2 py-0.5 rounded-md border border-[#FFD966]">
                  +5⚡️ (帽子装備で1.5倍)
                </span>
              </div>

              {selectedMeta.milestone && (
                <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
                  <span className="font-black text-[#B45309] flex items-center gap-1">
                    <span>{selectedMeta.milestone.icon}</span>
                    <span>到達ボーナス:</span>
                  </span>
                  <span className="font-black text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#FCD34D]">
                    {selectedMeta.milestone.rewardLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Start Button */}
            <button
              onClick={handleConfirmStart}
              className="duo-btn duo-btn-green w-full h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Play className="w-5 h-5 fill-white stroke-none" />
              <span>ステージ {selectedStage} を開始！</span>
            </button>
          </div>
        </div>
      )}

      {/* Milestone Roadmap Modal */}
      {showMilestoneRoadmap && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#E5E5E5] p-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => {
                audio.playTap();
                setShowMilestoneRoadmap(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#3C3C3C] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] border-2 border-[#FCD34D] flex items-center justify-center text-2xl mx-auto mb-2">
                🏆
              </div>
              <h3 className="text-lg font-black text-[#3C3C3C]">
                ストーリー到達マイルストーン報酬
              </h3>
              <p className="text-xs font-bold text-[#777777]">
                目標ステージに到達して豪華報酬を解禁！
              </p>
            </div>

            <div className="space-y-3">
              {/* Stage 50 */}
              <div className="p-3.5 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#3C3C3C]">ステージ 50 到達</span>
                      {currentStage > 50 && (
                        <span className="text-[10px] font-black text-[#58A700] bg-[#EEFDEB] px-1.5 py-0.2 rounded">
                          達成済
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-[#FF9600]">
                      3,000⚡️ ゲット！
                    </div>
                    <div className="text-[11px] font-bold text-[#777777]">
                      称号「英検チャレンジャー」解禁
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 100 */}
              <div className="p-3.5 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💎</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#3C3C3C]">ステージ 100 到達</span>
                      {currentStage > 100 && (
                        <span className="text-[10px] font-black text-[#58A700] bg-[#EEFDEB] px-1.5 py-0.2 rounded">
                          達成済
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-[#9333EA]">
                      7,500⚡️ ゲット！
                    </div>
                    <div className="text-[11px] font-bold text-[#777777]">
                      称号「単語マスター」解禁
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 150 */}
              <div className="p-3.5 rounded-2xl border-2 border-[#FCD34D] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👑</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#92400E]">ステージ 150 到達</span>
                      {currentStage > 150 && (
                        <span className="text-[10px] font-black text-[#58A700] bg-white px-1.5 py-0.2 rounded border border-[#BBF7D0]">
                          達成済
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-[#D97706]">
                      限定称号「ゴールド」ゲット！
                    </div>
                    <div className="text-[11px] font-bold text-[#B45309]">
                      プロフィールで設定すると名前が金色に輝く！
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 200 */}
              <div className="p-3.5 rounded-2xl border-2 border-[#FECACA] bg-gradient-to-r from-[#FFF1F2] to-[#FFE4E6] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚙️✏️</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#991B1B]">ステージ 200 完全制覇</span>
                      {currentStage > 200 && (
                        <span className="text-[10px] font-black text-[#58A700] bg-white px-1.5 py-0.2 rounded border border-[#BBF7D0]">
                          達成済
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-[#DC2626]">
                      サブグッズ「鉛筆削り」ゲット！
                    </div>
                    <div className="text-[11px] font-bold text-[#B91C1C]">
                      えんぴつの技が本来100%のところ「50%」で発動可能に！
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

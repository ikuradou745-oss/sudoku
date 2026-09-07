import { useState, useEffect } from 'react';
import { 
  X, 
  Trophy, 
  Swords, 
  Users, 
  Sparkles, 
  ShieldAlert, 
  RotateCw, 
  ArrowRight,
  Bot,
  Check,
  Copy,
  LogOut,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { UserStats, RankedMatchSession } from '../types';
import { RANK_TIERS, getRankInfo } from '../utils/rank';
import { realtimePresence, PartyInfo } from '../utils/multiplayer';
import { audio } from '../utils/audio';

interface RankedLobbyModalProps {
  stats: UserStats;
  onStartMatch: (session: RankedMatchSession, isPlacement: boolean) => void;
  onClose: () => void;
}

export function RankedLobbyModal({ stats, onStartMatch, onClose }: RankedLobbyModalProps) {
  const [selectedMode, setSelectedMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [queueTimer, setQueueTimer] = useState<number>(0);
  const [showRules, setShowRules] = useState<boolean>(false);

  // Party State for 2vs2
  const [currentParty, setCurrentParty] = useState<PartyInfo | null>(null);
  const [joinPartyCode, setJoinPartyCode] = useState<string>('');
  const [partyError, setPartyError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const currentRank = getRankInfo(stats.rating || 0);

  // Subscribe to matchmaking events
  useEffect(() => {
    const unsubscribe = realtimePresence.subscribe((event) => {
      if (event.type === 'RANKED_MATCH_FOUND') {
        // Match found!
        if (event.session.players.some((p) => p.id === stats.userId)) {
          audio.playMatchFound();
          setIsSearching(false);
          onStartMatch(event.session, false);
        }
      } else if (event.type === 'PARTY_UPDATED') {
        if (event.party && event.party.players.some((p) => p.id === stats.userId)) {
          setCurrentParty(event.party);
        } else {
          setCurrentParty(null);
        }
      }
    });

    return () => {
      unsubscribe();
      if (isSearching) {
        realtimePresence.cancelQueue();
      }
    };
  }, [stats.userId, isSearching]);

  // Queue timer ticker
  useEffect(() => {
    let interval: any = null;
    if (isSearching) {
      interval = setInterval(() => {
        setQueueTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setQueueTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // Launch match with simulated opponent or AI challenger
  const launchMatchWithOpponent = () => {
    const opponentRating = Math.max(0, (stats.rating || 100) + (Math.floor(Math.random() * 40) - 20));
    const opponentRank = getRankInfo(opponentRating);
    const botNames = ['サクラ', 'ケンタ', 'ハヤト', 'ユウキ', 'エマ', 'タクミ', 'アスカ'];
    const randomName = botNames[Math.floor(Math.random() * botNames.length)];

    if (selectedMode === '1vs1') {
      const dummySession: RankedMatchSession = {
        matchId: `sim_match_${Date.now()}`,
        mode: '1vs1',
        status: 'countdown',
        seed: Math.floor(Math.random() * 100000),
        createdAt: Date.now(),
        players: [
          {
            id: stats.userId || 'me',
            name: stats.userName || '会員',
            avatarUrl: stats.avatarUrl,
            rating: stats.rating || 0,
            rankTier: stats.rankTier || 'bronze',
            progress: 0,
            score: 0,
            mistakes: 0,
            lives: 3,
            isKO: false,
            finished: false,
          },
          {
            id: `bot_${Date.now()}`,
            name: randomName,
            avatarUrl: null,
            rating: opponentRating,
            rankTier: opponentRank.tier,
            progress: 0,
            score: 0,
            mistakes: 0,
            lives: 3,
            isKO: false,
            finished: false,
            isBot: true,
          },
        ],
      };
      audio.playMatchFound();
      setIsSearching(false);
      onStartMatch(dummySession, false);
    } else {
      // 2vs2 fallback
      const teamRed = [
        {
          id: stats.userId || 'me',
          name: stats.userName || '会員',
          avatarUrl: stats.avatarUrl,
          rating: stats.rating || 0,
          rankTier: stats.rankTier || 'bronze',
          team: 'red' as const,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        },
        {
          id: `bot_ally_${Date.now()}`,
          name: 'タクミ (味方)',
          avatarUrl: null,
          rating: opponentRating,
          rankTier: opponentRank.tier,
          team: 'red' as const,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          isBot: true,
        },
      ];
      const teamBlue = [
        {
          id: `bot_enemy1_${Date.now()}`,
          name: 'ハヤト',
          avatarUrl: null,
          rating: opponentRating + 10,
          rankTier: opponentRank.tier,
          team: 'blue' as const,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          isBot: true,
        },
        {
          id: `bot_enemy2_${Date.now()}`,
          name: 'ユウキ',
          avatarUrl: null,
          rating: opponentRating - 10,
          rankTier: opponentRank.tier,
          team: 'blue' as const,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          isBot: true,
        },
      ];

      const session2v2: RankedMatchSession = {
        matchId: `sim_2v2_${Date.now()}`,
        mode: '2vs2',
        status: 'countdown',
        seed: Math.floor(Math.random() * 100000),
        createdAt: Date.now(),
        players: [...teamRed, ...teamBlue],
        teams: { teamRed, teamBlue },
      };
      audio.playMatchFound();
      setIsSearching(false);
      onStartMatch(session2v2, false);
    }
  };

  // Fallback simulator if waiting > 3 seconds
  useEffect(() => {
    if (isSearching && queueTimer >= 3) {
      launchMatchWithOpponent();
    }
  }, [isSearching, queueTimer]);

  const handleStartQueue = async () => {
    audio.playTap();
    setIsSearching(true);
    await realtimePresence.queueRanked(selectedMode, currentParty?.partyId);
  };

  const handleCancelQueue = async () => {
    audio.playTap();
    setIsSearching(false);
    await realtimePresence.cancelQueue();
  };

  const handleStartPlacement = () => {
    audio.playTap();
    // Launch placement match against the Diagnostic AI Bot
    const placementSession: RankedMatchSession = {
      matchId: `placement_${Date.now()}`,
      mode: 'placement',
      status: 'countdown',
      seed: Math.floor(Math.random() * 100000),
      createdAt: Date.now(),
      players: [
        {
          id: stats.userId || 'me',
          name: stats.userName || '会員',
          avatarUrl: stats.avatarUrl,
          rating: 0,
          rankTier: 'bronze',
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        },
        {
          id: 'rank_eval_bot',
          name: 'ランク判定AI',
          avatarUrl: null,
          rating: 200,
          rankTier: 'gold',
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          isBot: true,
        },
      ],
    };
    onStartMatch(placementSession, true);
  };

  // Party Actions
  const handleCreateParty = async () => {
    audio.playTap();
    const party = await realtimePresence.createParty();
    if (party) {
      setCurrentParty(party);
      setPartyError('');
    }
  };

  const handleJoinParty = async () => {
    if (!joinPartyCode.trim()) return;
    audio.playTap();
    setPartyError('');
    const party = await realtimePresence.joinParty(joinPartyCode.trim());
    if (!party) {
      setPartyError('パーティーが見つからないか、満員です');
    }
  };

  const handleLeaveParty = async () => {
    if (!currentParty) return;
    audio.playTap();
    await realtimePresence.leaveParty(currentParty.partyId);
    setCurrentParty(null);
  };

  const handleCopyPartyCode = () => {
    if (currentParty) {
      navigator.clipboard.writeText(currentParty.partyId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="ranked-lobby-modal"
        className="duo-card w-full max-w-lg bg-white p-5 sm:p-6 text-left animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E5E5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF9E6] text-[#FF9600] border-2 border-[#FFD966] flex items-center justify-center text-xl shadow-xs">
              🏆
            </div>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C] flex items-center gap-2">
                <span>ランクマッチ</span>
                <span className="text-[10px] font-black bg-[#FF4B4B] text-white px-2 py-0.5 rounded-full animate-pulse">
                  ONLINE
                </span>
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                レートと階級を賭けたオンライン真剣勝負！
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audio.playTap();
              if (isSearching) handleCancelQueue();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Searching / Matchmaking Screen */}
        {isSearching ? (
          <div className="py-10 text-center space-y-6">
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              {/* Radar Circles */}
              <div className="absolute inset-0 rounded-full bg-[#1CB0F6]/10 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-[#1CB0F6]/20 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#1CB0F6] to-[#00CD9C] text-white flex items-center justify-center shadow-lg">
                <Swords className="w-10 h-10 animate-bounce" />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-[#3C3C3C] mb-1">
                相手が来るまで待機...
              </h3>
              <p className="text-xs font-bold text-[#777777]">
                {selectedMode === '1vs1' ? '1vs1 シングル対戦を探しています' : '2vs2 チーム対戦を探しています (4人マッチング)'}
              </p>
            </div>

            {/* Waiting timer & queue info */}
            <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-xs font-black text-[#3C3C3C]">
              <div className="flex items-center gap-1.5 text-[#1CB0F6]">
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>経過時間: {queueTimer}秒</span>
              </div>
              <div className="w-px h-4 bg-[#E5E5E5]" />
              <div className="text-[#FF9600]">
                モード: {selectedMode}
              </div>
            </div>

            {/* Action Buttons in Queue */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs mx-auto">
              <button
                id="instant-start-match-btn"
                onClick={launchMatchWithOpponent}
                className="duo-btn duo-btn-green w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Swords className="w-4 h-4 text-white" />
                <span>今すぐ対戦開始！</span>
              </button>

              <button
                id="cancel-matchmaking-btn"
                onClick={handleCancelQueue}
                className="duo-btn duo-btn-gray w-full py-3 rounded-2xl text-xs font-black cursor-pointer shadow-xs"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {/* User Rank Card */}
            <div className={`p-4 rounded-3xl border-2 bg-gradient-to-br ${currentRank.bgGradient} ${currentRank.borderColor} relative overflow-hidden shadow-xs`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-[#777777] mb-1 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-[#FF9600]" />
                    <span>あなたの現在のランク</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{currentRank.icon}</span>
                    <div>
                      <div className={`text-2xl font-black ${currentRank.textColor}`}>
                        {currentRank.name}
                      </div>
                      <div className="text-xs font-black text-[#777777]">
                        レート: <span className="font-mono text-sm text-[#3C3C3C]">{stats.rating || 0} RP</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-[#777777]">
                    戦績
                  </div>
                  <div className="text-xs font-black text-[#3C3C3C]">
                    {stats.rankedWins || 0}勝 {stats.rankedLosses || 0}敗
                  </div>
                  {stats.placementDone ? (
                    <span className="inline-block mt-1 text-[10px] font-black bg-[#DCFCE7] text-[#166534] px-2 py-0.5 rounded-full border border-[#86EFAC]">
                      ランク判定完了
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[10px] font-black bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full border border-[#FDE68A]">
                      未判定
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-black text-[#777777] mb-1">
                  <span>{currentRank.name} ({currentRank.minRating} RP)</span>
                  <span>
                    {currentRank.tier === 'heaven' ? 'MAX' : `次: ${currentRank.maxRating} RP`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-[#FF9600] to-[#58CC02] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(5, (((stats.rating || 0) - currentRank.minRating) / (currentRank.maxRating - currentRank.minRating || 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Placement Match Notice (if user hasn't done placement yet) */}
            {!stats.placementDone && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] border-2 border-[#FDE68A] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#D97706] border border-[#FCD34D] flex items-center justify-center shrink-0 text-xl shadow-xs">
                    <Bot className="w-6 h-6 text-[#D97706]" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#92400E] flex items-center gap-1.5">
                      <span>初回限定：ランク判定戦（実力診断）</span>
                      <span className="text-[10px] font-black bg-[#D97706] text-white px-1.5 py-0.2 rounded-md">
                        おすすめ
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#B45309] mt-0.5 leading-relaxed">
                      初回の試合は判定AIとの実力診断！あなたの回答スピード・正確性を分析し、最適な初期ランク（ブロンズ・シルバー・ゴールドなど）を自動認定します。
                    </p>
                  </div>
                </div>

                <button
                  id="start-placement-btn"
                  onClick={handleStartPlacement}
                  className="duo-btn duo-btn-orange w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>ランク判定戦を始める (AI診断)</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            )}

            {/* Mode Select Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-black text-[#777777] uppercase tracking-wider">
                対戦モードを選択
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1 vs 1 */}
                <button
                  onClick={() => {
                    audio.playTap();
                    setSelectedMode('1vs1');
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    selectedMode === '1vs1'
                      ? 'bg-[#EBF7FD] border-[#1CB0F6] shadow-xs'
                      : 'bg-white border-[#E5E5E5] hover:border-[#BDE3F8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[#1CB0F6]/15 text-[#1CB0F6] flex items-center justify-center font-black text-sm">
                      1v1
                    </div>
                    {selectedMode === '1vs1' && (
                      <span className="w-5 h-5 rounded-full bg-[#1CB0F6] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-[#3C3C3C]">
                    1 vs 1
                  </div>
                  <div className="text-[11px] font-bold text-[#777777]">
                    タイマン真剣勝負！
                  </div>
                </button>

                {/* 2 vs 2 */}
                <button
                  onClick={() => {
                    audio.playTap();
                    setSelectedMode('2vs2');
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    selectedMode === '2vs2'
                      ? 'bg-[#F0FDF4] border-[#58CC02] shadow-xs'
                      : 'bg-white border-[#E5E5E5] hover:border-[#86EFAC]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[#58CC02]/15 text-[#58CC02] flex items-center justify-center font-black text-sm">
                      2v2
                    </div>
                    {selectedMode === '2vs2' && (
                      <span className="w-5 h-5 rounded-full bg-[#58CC02] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-[#3C3C3C]">
                    2 vs 2
                  </div>
                  <div className="text-[11px] font-bold text-[#777777]">
                    チーム対抗戦 (4人必要)
                  </div>
                </button>
              </div>
            </div>

            {/* 2vs2 Party Feature */}
            {selectedMode === '2vs2' && (
              <div className="p-4 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] space-y-3">
                <div className="text-xs font-black text-[#3C3C3C] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#58CC02]" />
                    <span>2vs2 パーティー機能</span>
                  </div>
                  <span className="text-[10px] text-[#777777]">
                    ※パーティーなしでもソロ4人でマッチ可能
                  </span>
                </div>

                {currentParty ? (
                  <div className="p-3 rounded-xl bg-white border border-[#58CC02] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#777777]">
                        パーティーコード: <span className="font-mono font-black text-base text-[#58A700]">{currentParty.partyId}</span>
                      </div>
                      <div className="text-xs font-black text-[#3C3C3C] mt-0.5">
                        メンバー: {currentParty.players.map((p) => p.name).join(', ')} ({currentParty.players.length}/2人)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyPartyCode}
                        className="px-2.5 py-1.5 rounded-lg bg-[#EBF7FD] text-[#1CB0F6] text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'コピー済' : 'コード共有'}</span>
                      </button>
                      <button
                        onClick={handleLeaveParty}
                        className="p-1.5 rounded-lg bg-[#FFF0F0] text-[#FF4B4B] hover:bg-[#FFE0E0] cursor-pointer"
                        title="パーティーを抜ける"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="コード入力 (例: ABCD)"
                        value={joinPartyCode}
                        onChange={(e) => setJoinPartyCode(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-[#E5E5E5] text-xs font-black uppercase text-[#3C3C3C]"
                      />
                      <button
                        onClick={handleJoinParty}
                        disabled={!joinPartyCode.trim()}
                        className="px-3 py-2 rounded-xl bg-[#58CC02] text-white text-xs font-black cursor-pointer disabled:opacity-50"
                      >
                        参加
                      </button>
                      <button
                        onClick={handleCreateParty}
                        className="px-3 py-2 rounded-xl bg-white border-2 border-[#58CC02] text-[#58CC02] text-xs font-black hover:bg-[#F0FDF4] cursor-pointer"
                      >
                        結成する
                      </button>
                    </div>
                    {partyError && (
                      <div className="text-[11px] font-black text-[#FF4B4B]">
                        {partyError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rank Rules & Tier Ranges Toggle Button */}
            <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] overflow-hidden">
              <button
                type="button"
                id="toggle-rank-rules-btn"
                onClick={() => {
                  audio.playTap();
                  setShowRules(!showRules);
                }}
                className="w-full p-3 flex items-center justify-between text-xs font-black text-[#4B4B4B] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#FF9600]" />
                  <span>ルール・階級一覧を確認する</span>
                </div>
                <div className="flex items-center gap-1 text-[#777777]">
                  <span className="text-[11px] font-bold">{showRules ? '閉じる' : '表示'}</span>
                  {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showRules && (
                <div className="p-3.5 border-t border-[#E5E5E5] bg-white space-y-3 animate-in fade-in duration-150">
                  <div className="space-y-1 text-xs text-[#777777]">
                    <div className="font-black text-[#3C3C3C] flex items-center gap-1.5 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-[#1CB0F6]" />
                      <span>対戦ルール概要</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] font-bold">
                      <li>問題数: 10問 / ライフ: 3 (❤️3)</li>
                      <li>間違えるとライフが1つ減り、次の問題へ進みます。</li>
                      <li>ライフが0になるとKO敗北！先に10問到達したプレイヤー（チーム）の勝利！</li>
                      <li>勝利時: レート <span className="text-[#58A700] font-black">+15〜25 RP</span> / 敗北時: レート <span className="text-[#FF4B4B] font-black">-5〜15 RP</span></li>
                    </ul>
                  </div>

                  {/* Tier Ranges reference list */}
                  <div>
                    <div className="text-[10px] font-black text-[#777777] mb-1.5">階級（ランク帯）一覧</div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px] font-black">
                      {Object.values(RANK_TIERS).map((t) => (
                        <div key={t.tier} className={`p-1.5 rounded-xl border ${t.badgeBg}`}>
                          <div>{t.icon}</div>
                          <div className="font-bold text-[10px] truncate">{t.name}</div>
                          <div className="font-mono text-[9px] text-[#777777]">
                            {t.tier === 'heaven' ? '600+' : `${t.minRating}~${t.maxRating}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Start Matchmaking Button */}
            <button
              id="start-ranked-matchmaking-btn"
              onClick={handleStartQueue}
              className="duo-btn duo-btn-red w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Swords className="w-5 h-5 text-white" />
              <span>{selectedMode} ランクマッチに挑む</span>
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

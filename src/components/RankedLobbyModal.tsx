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
  Check,
  Copy,
  LogOut,
  ChevronDown,
  ChevronUp,
  Info,
  Bot
} from 'lucide-react';
import { UserStats, RankedMatchSession, RankedMatchPlayer, LobbyUser } from '../types';
import { RANK_TIERS, getRankInfo } from '../utils/rank';
import { realtimePresence, PartyInfo, lobbySocket } from '../utils/multiplayer';
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
  const [botAllowed, setBotAllowed] = useState<boolean>(true);
  const [autoBotMatch, setAutoBotMatch] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);

  // Matchmaking & Room Code State
  const [matchType, setMatchType] = useState<'public' | 'room'>('public');
  const [roomCode, setRoomCode] = useState<string>('');
  const [queueCounts, setQueueCounts] = useState<{ queue1v1Count: number; queue2v2Count: number }>({ queue1v1Count: 0, queue2v2Count: 0 });
  const [onlineCount, setOnlineCount] = useState<number>(() => realtimePresence.getOnlineUsers().length);

  // Socket.io Lobby Users ("誰が今ロビーにいるか")
  const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>(() => lobbySocket.getUsers());

  // Party State for 2vs2
  const [currentParty, setCurrentParty] = useState<PartyInfo | null>(null);
  const [joinPartyCode, setJoinPartyCode] = useState<string>('');
  const [partyError, setPartyError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const currentRank = getRankInfo(stats.rating || 0);

  // Socket.io Lobby lifecycle
  useEffect(() => {
    const activeUserId = stats.userId || 'user_player';
    // 1. Join lobby with real user info
    lobbySocket.joinLobby({
      userId: activeUserId,
      name: stats.userName || '会員',
      avatarUrl: stats.avatarUrl || null,
    });

    // 2. Subscribe to real-time lobby user changes via Socket.io
    const unsubscribeLobby = lobbySocket.subscribe((users) => {
      setLobbyUsers(users);
    });

    return () => {
      unsubscribeLobby();
      lobbySocket.leaveLobby();
    };
  }, [stats.userId, stats.userName, stats.avatarUrl]);

  // Subscribe to matchmaking events
  useEffect(() => {
    const unsubscribe = realtimePresence.subscribe((event) => {
      if (event.type === 'RANKED_MATCH_FOUND') {
        // Real Match found!
        if (event.session.players.some((p) => p.id === stats.userId)) {
          audio.playMatchFound();
          setIsSearching(false);
          lobbySocket.updateStatus('in_match');
          onStartMatch(event.session, false);
        }
      } else if (event.type === 'QUEUE_STATUS') {
        setQueueCounts({
          queue1v1Count: event.queue1v1Count,
          queue2v2Count: event.queue2v2Count,
        });
      } else if (event.type === 'PRESENCE_SNAPSHOT') {
        setOnlineCount(event.onlineUsers.length);
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

  // Queue timer ticker with auto-bot trigger
  useEffect(() => {
    let interval: any = null;
    if (isSearching) {
      interval = setInterval(() => {
        setQueueTimer((prev) => {
          const next = prev + 1;
          if (botAllowed && autoBotMatch && next >= 5) {
            // Trigger bot match if no online player matched after 5s and bot allowed
            setTimeout(() => {
              handleLaunchBotMatch();
            }, 50);
          }
          return next;
        });
      }, 1000);
    } else {
      setQueueTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearching, autoBotMatch, botAllowed]);

  const handleLaunchBotMatch = () => {
    audio.playTap();
    setIsSearching(false);
    realtimePresence.cancelQueue();

    const botNames = ['サクラ', 'ケンタ', 'ハヤト', 'ユウキ', 'エマ', 'タクミ', 'アスカ', 'リン'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)] + ' (Bot)';
    const ratingVariance = (Math.floor(Math.random() * 5) - 2) * 10;
    const botRating = Math.max(0, (stats.rating || 100) + ratingVariance);
    const botTier = getRankInfo(botRating).tier;

    let players: RankedMatchPlayer[] = [];
    if (selectedMode === '1vs1') {
      players = [
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
          isBot: false,
        },
        {
          id: `bot_player_${Date.now()}`,
          name: botName,
          avatarUrl: null,
          rating: botRating,
          rankTier: botTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          isBot: true,
        },
      ];
    } else {
      players = [
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
          team: 'red',
          isBot: false,
        },
        {
          id: `bot_tm_${Date.now()}`,
          name: 'アオイ (味方Bot)',
          avatarUrl: null,
          rating: botRating,
          rankTier: botTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          team: 'red',
          isBot: true,
        },
        {
          id: `bot_en1_${Date.now()}`,
          name: 'リョウ (敵Bot)',
          avatarUrl: null,
          rating: botRating,
          rankTier: botTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          team: 'blue',
          isBot: true,
        },
        {
          id: `bot_en2_${Date.now()}`,
          name: 'ナナミ (敵Bot)',
          avatarUrl: null,
          rating: botRating,
          rankTier: botTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
          team: 'blue',
          isBot: true,
        },
      ];
    }

    const botSession: RankedMatchSession = {
      matchId: `bot_match_${Date.now()}`,
      mode: selectedMode,
      status: 'countdown',
      seed: Math.floor(Math.random() * 100000),
      createdAt: Date.now(),
      players,
    };

    onStartMatch(botSession, false);
  };

  const handleStartQueue = async () => {
    audio.playTap();
    setIsSearching(true);
    const activeCode = matchType === 'room' && roomCode.trim() ? roomCode.trim().toUpperCase() : undefined;
    lobbySocket.updateStatus('in_queue', selectedMode, activeCode || null);
    await realtimePresence.queueRanked(selectedMode, currentParty?.partyId, activeCode);
  };

  const handleCancelQueue = async () => {
    audio.playTap();
    setIsSearching(false);
    lobbySocket.updateStatus('idle');
    await realtimePresence.cancelQueue();
  };

  const handleOpenDuplicateTab = () => {
    audio.playTap();
    try {
      window.open(window.location.href, '_blank');
    } catch {
      // Ignore
    }
  };

  const handleStartPlacement = () => {
    audio.playTap();
    // Launch real solo diagnostic placement test (No bots)
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534] text-[11px] font-black mb-2">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span>完全オンライン待機中 (ボットなし)</span>
              </div>
              <h3 className="text-2xl font-black text-[#3C3C3C] mb-1">
                対戦相手を探しています...
              </h3>
              <p className="text-xs font-bold text-[#777777]">
                {matchType === 'room' && roomCode.trim()
                  ? `合言葉「${roomCode.trim().toUpperCase()}」の対戦相手を待機中`
                  : selectedMode === '1vs1'
                  ? '1vs1 公募マッチング待機中'
                  : '2vs2 チーム対戦待機中 (4人マッチング)'}
              </p>
            </div>

            {/* Waiting timer & queue info */}
            <div className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-2.5 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-xs font-black text-[#3C3C3C]">
              <div className="flex items-center gap-1.5 text-[#1CB0F6]">
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>待機時間: {queueTimer}秒</span>
              </div>
              <div className="w-px h-4 bg-[#E5E5E5]" />
              <div className="text-[#58A700]">
                待機列: {selectedMode === '1vs1' ? queueCounts.queue1v1Count : queueCounts.queue2v2Count}人
              </div>
              <div className="w-px h-4 bg-[#E5E5E5]" />
              <div className="text-[#FF9600]">
                オンライン: {onlineCount}人
              </div>
            </div>

            {/* Auto Bot Match Toggle & Instant Bot Play (Only if botAllowed is true) */}
            {botAllowed ? (
              <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border-2 border-[#FDE68A] text-left max-w-sm mx-auto space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoBotMatch}
                    onChange={(e) => setAutoBotMatch(e.target.checked)}
                    className="w-4 h-4 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#92400E]">
                    相手が見つからない場合、Botと対戦する（約5秒）
                  </span>
                </label>
                <div className="text-[11px] font-bold text-[#B45309]">
                  {autoBotMatch
                    ? `残り ${Math.max(0, 5 - queueTimer)}秒 でBotマッチングを開始します`
                    : 'オンラインプレイヤーのみを待機します'}
                </div>
                <button
                  type="button"
                  onClick={handleLaunchBotMatch}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Bot className="w-4 h-4" />
                  <span>今すぐBotと対戦を開始する</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#EFF6FF] border-2 border-[#BFDBFE] text-left max-w-sm mx-auto space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#1E40AF]">
                  <Users className="w-4 h-4 text-[#2563EB]" />
                  <span>ボットなし (完全対人戦) で待機中</span>
                </div>
                <p className="text-[11px] font-bold text-[#3B82F6]">
                  Botは一切乱入しません。本物のプレイヤーがマッチするまで待機します。（別タブを開いてマッチングをテストできます）
                </p>
              </div>
            )}

            {/* Socket.io Live Lobby Users Status during Queue */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#E5E5E5] text-left max-w-sm mx-auto space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-[#3C3C3C]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
                  <span>ロビー接続中 ({lobbyUsers.length}人)</span>
                </div>
                <span className="text-[10px] text-[#777777] font-bold">Socket.io リアルタイム</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {lobbyUsers.map((user) => {
                  const isMe = user.userId === stats.userId;
                  return (
                    <div
                      key={user.socketId || user.userId}
                      className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between ${
                        isMe ? 'bg-[#EBF7FD] text-[#0284C7] font-black' : 'bg-[#F7F7F7] text-[#4B4B4B] font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                        <span className="truncate">{user.name}</span>
                        {isMe && <span className="text-[9px] bg-[#0284C7] text-white px-1 rounded-sm">あなた</span>}
                      </div>
                      <span className="text-[10px] font-black shrink-0">
                        {user.status === 'in_queue' ? (
                          <span className="text-[#EA580C]">検索中</span>
                        ) : user.status === 'in_match' ? (
                          <span className="text-[#8B5CF6]">対戦中</span>
                        ) : (
                          <span className="text-[#16A34A]">待機中</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Dual-Tab Test Button & Cancel Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleOpenDuplicateTab}
                className="duo-btn duo-btn-blue w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>別タブを開いて対戦テスト</span>
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
                    <Sparkles className="w-6 h-6 text-[#D97706]" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#92400E] flex items-center gap-1.5">
                      <span>初回限定：実力診断ソロテスト (全10問)</span>
                      <span className="text-[10px] font-black bg-[#D97706] text-white px-1.5 py-0.2 rounded-md">
                        ソロ判定
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#B45309] mt-0.5 leading-relaxed">
                      10問のソロテストであなたの回答スピード・正確性を測定し、初期ランク（ブロンズ・シルバー・ゴールド等）を判定します！
                    </p>
                  </div>
                </div>

                <button
                  id="start-placement-btn"
                  onClick={handleStartPlacement}
                  className="duo-btn duo-btn-orange w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>実力診断テストを受ける (ソロ)</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            )}

            {/* Socket.io Realtime Lobby Members ("誰が今ロビーにいるか") */}
            <div className="p-4 rounded-3xl bg-[#F0FDF4] border-2 border-[#86EFAC] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]"></span>
                  </span>
                  <span className="text-xs font-black text-[#15803D]">
                    現在ロビーにいるプレイヤー (Socket.io リアルタイム)
                  </span>
                  <span className="text-[10px] font-black bg-[#22C55E] text-white px-2 py-0.5 rounded-full">
                    {lobbyUsers.length}人接続
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => lobbySocket.fetchLobbyUsers()}
                  className="text-[10px] font-bold text-[#16A34A] hover:underline cursor-pointer flex items-center gap-1"
                  title="最新状態に更新"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>更新</span>
                </button>
              </div>

              {/* Lobby Users List (Strictly Real Online Users - No Bots, No Ranks in Names) */}
              <div className="space-y-2">
                {lobbyUsers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lobbyUsers.map((user) => {
                      const isMe = user.userId === stats.userId;
                      return (
                        <div
                          key={user.socketId || user.userId}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                            isMe
                              ? 'bg-white border-[#86EFAC] shadow-xs'
                              : 'bg-white/90 border-[#BBF7D0] hover:border-[#86EFAC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#58CC02] to-[#22C55E] text-white flex items-center justify-center font-black text-sm">
                                {user.avatarUrl ? (
                                  <img
                                    src={user.avatarUrl}
                                    alt=""
                                    className="w-full h-full rounded-xl object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  user.name.slice(0, 1)
                                )}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-white ring-1 ring-[#22C55E]" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-[#3C3C3C] truncate max-w-[110px] sm:max-w-[130px]">
                                  {user.name}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] font-black bg-[#58CC02] text-white px-1.5 py-0.2 rounded-md shrink-0">
                                    あなた
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-bold mt-0.5">
                                {user.status === 'in_match' ? (
                                  <span className="text-[#8B5CF6] font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                                    対戦中
                                  </span>
                                ) : user.status === 'in_queue' ? (
                                  <span className="text-[#EA580C] font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C] animate-ping" />
                                    対戦相手を探し中 ({user.mode || '1vs1'})
                                  </span>
                                ) : (
                                  <span className="text-[#16A34A] font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                                    ロビー待機中
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Match Action if another player is in queue */}
                          {!isMe && user.status === 'in_queue' && (
                            <button
                              type="button"
                              onClick={() => {
                                audio.playTap();
                                if (user.mode) setSelectedMode(user.mode);
                                if (user.roomCode) {
                                  setMatchType('room');
                                  setRoomCode(user.roomCode);
                                }
                                handleStartQueue();
                              }}
                              className="px-2.5 py-1 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white text-[11px] font-black shrink-0 transition-colors shadow-xs cursor-pointer ml-2"
                            >
                              対戦する
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-white/70 rounded-2xl text-center text-xs font-bold text-[#777777]">
                    ロビー接続を確認中...
                  </div>
                )}

                {/* Info when user is alone in the lobby */}
                {lobbyUsers.filter((u) => u.userId !== stats.userId).length === 0 && (
                  <div className="p-3 rounded-2xl bg-white/80 border border-[#86EFAC] text-center space-y-1.5">
                    <p className="text-[11px] font-black text-[#166534]">
                      現在ロビーにはあなたのみ接続中です（ボット等の演出は一切含みません）。
                    </p>
                    <p className="text-[10px] font-bold text-[#15803D]">
                      別のブラウザタブを開くか、他のプレイヤーが対戦ロビーを開くと、Socket.io で即座にここに表示されます。
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenDuplicateTab}
                      className="text-xs font-black text-[#15803D] bg-[#DCFCE7] hover:bg-[#BBF7D0] px-3 py-1.5 rounded-xl border border-[#86EFAC] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <span>別タブを開いてロビー同期テスト</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

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

            {/* Matchmaking Type (Public vs Room Code) */}
            <div className="space-y-2">
              <div className="text-xs font-black text-[#777777] uppercase tracking-wider">
                マッチング方式
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setMatchType('public');
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    matchType === 'public'
                      ? 'bg-[#EBF7FD] border-[#1CB0F6]'
                      : 'bg-white border-[#E5E5E5]'
                  }`}
                >
                  <div className="text-xs font-black text-[#3C3C3C]">🌐 公募マッチング</div>
                  <div className="text-[10px] font-bold text-[#777777]">だれでもマッチ</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setMatchType('room');
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    matchType === 'room'
                      ? 'bg-[#FEF3C7] border-[#F59E0B]'
                      : 'bg-white border-[#E5E5E5]'
                  }`}
                >
                  <div className="text-xs font-black text-[#3C3C3C]">🔑 合言葉ルーム</div>
                  <div className="text-[10px] font-bold text-[#777777]">友達・別タブ対戦</div>
                </button>
              </div>

              {matchType === 'room' && (
                <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border-2 border-[#FDE68A] space-y-2 animate-in fade-in duration-150">
                  <div className="text-xs font-black text-[#92400E] flex items-center justify-between">
                    <span>対戦の合言葉 (ルームコード)</span>
                    <button
                      type="button"
                      onClick={handleOpenDuplicateTab}
                      className="text-[10px] font-black text-[#1CB0F6] bg-white px-2 py-1 rounded-lg border border-[#BDE3F8] hover:bg-[#EBF7FD] flex items-center gap-1 cursor-pointer"
                    >
                      <span>別タブを開いて対戦テスト</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="合言葉を入力 (例: 777 や TEST)"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-[#FCD34D] text-sm font-black uppercase text-[#3C3C3C] tracking-wider"
                  />
                  <p className="text-[10px] font-bold text-[#B45309]">
                    ※同じ合言葉を入力したプレイヤー同士、または別タブと確実に即マッチングします！
                  </p>
                </div>
              )}
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

            {/* Bot Match Mode Selector: あり vs なし */}
            <div className="space-y-1.5">
              <div className="text-xs font-black text-[#3C3C3C] flex items-center justify-between">
                <span>対戦相手の設定 (Botあり / なし)</span>
                <span className="text-[10px] text-[#777777] font-bold">
                  {botAllowed ? '🤖 Bot参戦OK (マッチ待ち時間なし)' : '👥 完全対人戦 (Bot不使用)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setBotAllowed(true);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    botAllowed
                      ? 'bg-white text-[#1CB0F6] border-2 border-[#1CB0F6] shadow-xs'
                      : 'text-[#777777] hover:text-[#3C3C3C] border-2 border-transparent'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>ボットあり (推奨)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setBotAllowed(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !botAllowed
                      ? 'bg-white text-[#FF4B4B] border-2 border-[#FF4B4B] shadow-xs'
                      : 'text-[#777777] hover:text-[#3C3C3C] border-2 border-transparent'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>ボットなし (完全対人)</span>
                </button>
              </div>
            </div>

            {/* If Bot allowed, show auto-match detail */}
            {botAllowed && (
              <div className="p-3 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-between text-left">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoBotMatch}
                    onChange={(e) => setAutoBotMatch(e.target.checked)}
                    className="w-4 h-4 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-black text-[#92400E]">
                      マッチ待機時、5秒後にBotと自動対戦を開始
                    </div>
                    <div className="text-[10px] font-bold text-[#B45309]">
                      チェックを外すと「今すぐBotと対戦」ボタンを押すまで待機します
                    </div>
                  </div>
                </label>
                <Bot className="w-5 h-5 text-[#D97706] shrink-0" />
              </div>
            )}

            {/* Buttons: Online Queue & Instant Bot Match */}
            <div className="space-y-2 pt-1">
              <button
                id="start-ranked-matchmaking-btn"
                onClick={handleStartQueue}
                className="duo-btn duo-btn-red w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Swords className="w-5 h-5 text-white" />
                <span>
                  {selectedMode} {botAllowed ? 'ランクマッチに挑む (Botあり)' : '完全対人マッチに挑む (Botなし)'}
                </span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>

              {botAllowed && (
                <button
                  type="button"
                  onClick={handleLaunchBotMatch}
                  className="duo-btn duo-btn-gray w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Bot className="w-4 h-4 text-[#777777]" />
                  <span>Botと即座に対戦を開始する（練習/レート反映）</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

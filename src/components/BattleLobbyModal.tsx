import { useState, useEffect } from 'react';
import { 
  X, 
  Swords, 
  Trophy, 
  Search, 
  PlusCircle, 
  Users, 
  Crown, 
  UserMinus, 
  Play, 
  Bot, 
  ArrowLeft,
  Sparkles,
  Lock,
  Wifi
} from 'lucide-react';
import { BattleRoom, RoomPlayer, Modifier } from '../types';
import { realtimeMultiplayer } from '../utils/multiplayer';
import { audio } from '../utils/audio';

type LobbyView = 'mode_select' | 'find_room' | 'create_room' | 'waiting_room';

interface BattleLobbyModalProps {
  currentUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  onStartBattle: (room: BattleRoom, player: RoomPlayer) => void;
  onOpenRanked: () => void;
  onClose: () => void;
}

const AVAILABLE_MODIFIERS: Modifier[] = [
  {
    id: 'difficultyUp',
    name: '難易度アップ',
    description: '4級レベルの応用問題が出現！',
    icon: '📈',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'longerSentences',
    name: '文を伸ばす',
    description: '5〜6単語の長文並べ替え中心！',
    icon: '📜',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'speedRush',
    name: 'スピードラッシュ',
    description: '回答速度に応じてさらにボーナス！',
    icon: '⚡️',
    bonusPercent: 30,
    active: false,
  },
  {
    id: 'oneShot',
    name: '一撃KO (ミス即脱落)',
    description: '1問でもミスすると失格の超高難易度！',
    icon: '💀',
    bonusPercent: 30,
    active: false,
  }
];

export function BattleLobbyModal({
  currentUser,
  onStartBattle,
  onOpenRanked,
  onClose,
}: BattleLobbyModalProps) {
  const [view, setView] = useState<LobbyView>('mode_select');
  const [rooms, setRooms] = useState<BattleRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<BattleRoom | null>(null);

  // Room Creation Form State
  const [newRoomName, setNewRoomName] = useState<string>('初心者歓迎！リアルタイム英語バトル');
  const [newMaxPlayers, setNewMaxPlayers] = useState<number>(4);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>(AVAILABLE_MODIFIERS);

  // 3-Second Countdown State
  const [countdown, setCountdown] = useState<number | null>(null);

  const isLeader = activeRoom?.leaderId === currentUser.id;

  // Real-time WebSocket event subscription
  useEffect(() => {
    realtimeMultiplayer.identify(currentUser.id, currentUser.name);
    realtimeMultiplayer.fetchRooms();

    const unsubscribe = realtimeMultiplayer.subscribe((event) => {
      switch (event.type) {
        case 'ROOMS_LIST': {
          setRooms(event.rooms);
          break;
        }

        case 'ROOM_CREATED': {
          setActiveRoom(event.room);
          setView('waiting_room');
          break;
        }

        case 'ROOM_UPDATED': {
          if (activeRoom && activeRoom.id === event.room.id) {
            setActiveRoom(event.room);
          }
          break;
        }

        case 'KICKED_FROM_ROOM': {
          if (activeRoom && activeRoom.id === event.roomId) {
            audio.playWrong();
            setActiveRoom(null);
            setView('find_room');
            alert('リーダーによって部屋からキックされました。');
          }
          break;
        }

        case 'COUNTDOWN_STARTED': {
          if (activeRoom && activeRoom.id === event.room.id) {
            setActiveRoom(event.room);
            triggerCountdown(event.room);
          }
          break;
        }

        case 'ERROR': {
          alert(event.message);
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [activeRoom, currentUser.id, currentUser.name]);

  // Handle joining an existing online room
  const handleJoinRoom = (room: BattleRoom) => {
    audio.playTap();
    if (room.players.length >= room.maxPlayers) {
      alert('この部屋は満員です');
      return;
    }

    const myPlayer: RoomPlayer = {
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      isLeader: false,
      isReady: true,
      progress: 0,
      score: 0,
      mistakes: 0,
    };

    setActiveRoom(room);
    setView('waiting_room');
    realtimeMultiplayer.joinRoom(room.id, myPlayer);
  };

  // Handle creating a new online room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    audio.playTap();

    const leaderPlayer: RoomPlayer = {
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      isLeader: true,
      isReady: true,
      progress: 0,
      score: 0,
      mistakes: 0,
    };

    realtimeMultiplayer.createRoom(
      newRoomName,
      newMaxPlayers,
      selectedModifiers,
      leaderPlayer
    );
  };

  // Leader: Add Bot Opponent for solo testing
  const handleAddBot = () => {
    if (!activeRoom || !isLeader) return;
    if (activeRoom.players.length >= activeRoom.maxPlayers) {
      alert('これ以上プレイヤーを追加できません（満員）');
      return;
    }
    audio.playTap();

    const botPlayer: RoomPlayer = {
      id: `bot_${Date.now()}_${activeRoom.players.length}`,
      name: `AIプレイヤー🤖`,
      avatarUrl: null,
      isLeader: false,
      isReady: true,
      isBot: true,
      progress: 0,
      score: 0,
      mistakes: 0,
    };

    realtimeMultiplayer.joinRoom(activeRoom.id, botPlayer);
  };

  // Leader: Kick Player
  const handleKickPlayer = (playerId: string) => {
    if (!activeRoom || !isLeader) return;
    audio.playTap();
    realtimeMultiplayer.kickPlayer(activeRoom.id, playerId);
  };

  // Member/Leader: Leave Room
  const handleLeaveRoom = () => {
    audio.playTap();
    if (activeRoom) {
      realtimeMultiplayer.leaveRoom(activeRoom.id, currentUser.id);
    }
    setActiveRoom(null);
    setView('mode_select');
  };

  // Trigger 3-Second Synchronized Countdown
  const triggerCountdown = (targetRoom: BattleRoom) => {
    setCountdown(3);
    audio.playTap();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          audio.playEnergyGet();
          setTimeout(() => {
            const myPlayer = targetRoom.players.find((p) => p.id === currentUser.id) || {
              id: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              isLeader: targetRoom.leaderId === currentUser.id,
              isReady: true,
            };
            onStartBattle(targetRoom, myPlayer);
          }, 300);
          return 0;
        }
        audio.playTap();
        return prev - 1;
      });
    }, 1000);
  };

  // Leader: Start Match (準備OK / 対戦スタート)
  const handleLeaderStart = () => {
    if (!activeRoom || !isLeader) return;
    if (activeRoom.players.length < 2) {
      const addBot = confirm('対戦相手がまだいません。「botを追加」して対戦を開始しますか？（他のブラウザや端末から同じ部屋に入ると人間同士で対戦できます）');
      if (addBot) {
        handleAddBot();
        setTimeout(() => {
          realtimeMultiplayer.startCountdown(activeRoom.id);
        }, 500);
      }
      return;
    }

    realtimeMultiplayer.startCountdown(activeRoom.id);
  };

  const toggleModifier = (id: string) => {
    audio.playTap();
    setSelectedModifiers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* 3-Second Countdown Screen Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-60 bg-black/85 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
          <div className="text-sm font-black text-[#58CC02] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Wifi className="w-4 h-4 animate-pulse" />
            <span>ONLINE MATCH STARTING</span>
          </div>
          <div className="text-8xl sm:text-9xl font-black text-white font-mono-code scale-110">
            {countdown === 0 ? 'START!' : countdown}
          </div>
          <div className="text-lg font-bold text-white/90 mt-6">
            リアルタイムオンライン対戦が始まります！🔥
          </div>
        </div>
      )}

      <div 
        id="battle-lobby-modal"
        className="duo-card w-full max-w-lg p-5 sm:p-6 bg-white my-auto max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5] mb-5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0F0] text-[#FF4B4B] border-2 border-[#FFD0D0] flex items-center justify-center font-black">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-[#3C3C3C]">
                  オンライン対戦
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-black bg-[#EBF7FD] text-[#1CB0F6] px-2 py-0.5 rounded-full border border-[#BAE3F8]">
                  <span className="w-2 h-2 rounded-full bg-[#1CB0F6] animate-ping" />
                  リアルタイム通信
                </span>
              </div>
              <p className="text-xs font-bold text-[#AFAFAF]">
                全国のプレイヤーとリアルタイムで英語力勝負！
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

        {/* 1. Mode Select View (部屋 vs ランクマッチ) */}
        {view === 'mode_select' && (
          <div className="space-y-4">
            {/* Custom Room Button */}
            <button
              id="select-room-mode-btn"
              onClick={() => {
                audio.playTap();
                setView('find_room');
              }}
              className="duo-btn duo-btn-blue w-full p-5 rounded-2xl flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    部屋（カスタムルーム）
                  </div>
                  <div className="text-xs font-bold text-white/90">
                    部屋を探す・部屋を作る・ルール設定
                  </div>
                </div>
              </div>
              <div className="bg-white/25 px-3 py-1.5 rounded-xl text-xs font-black text-white">
                オンライン対戦
              </div>
            </button>

            {/* Ranked Match (Under Preparation) */}
            <button
              id="select-ranked-mode-btn"
              onClick={() => {
                audio.playTap();
                onOpenRanked();
              }}
              className="duo-card w-full p-5 rounded-2xl flex items-center justify-between text-left opacity-80 hover:opacity-100 hover:border-[#FF9600] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FFF9E6] text-[#FF9600] border-2 border-[#FFD966] flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-black text-[#3C3C3C] flex items-center gap-2">
                    <span>ランクマッチ</span>
                    <span className="text-[11px] font-black bg-[#FFD0D0] text-[#FF4B4B] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> 準備中
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#AFAFAF]">
                    実力に応じたレート戦（順位報酬UP）
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* 2. Find Room View (部屋を探す & 部屋を作るタブ) */}
        {view === 'find_room' && (
          <div>
            {/* Sub Nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  audio.playTap();
                  setView('mode_select');
                }}
                className="flex items-center gap-1 text-xs font-black text-[#777777] hover:text-[#3C3C3C] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>戻る</span>
              </button>

              <button
                id="open-create-room-btn"
                onClick={() => {
                  audio.playTap();
                  setView('create_room');
                }}
                className="duo-btn duo-btn-green px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>部屋を作る</span>
              </button>
            </div>

            <div className="text-sm font-black text-[#3C3C3C] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#1CB0F6]" />
                <span>オンライン稼働中の部屋一覧</span>
              </span>
              <span className="text-xs text-[#AFAFAF]">{rooms.length}件の部屋</span>
            </div>

            {/* Room List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-sm font-bold text-[#AFAFAF] duo-card p-6">
                  現在稼働中の部屋がありません。<br />
                  「部屋を作る」から新しい部屋を作成してください！
                </div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="duo-card p-4 rounded-2xl hover:border-[#1CB0F6] transition-all bg-[#FAFAFA]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-base font-black text-[#3C3C3C]">
                          {room.name}
                        </div>
                        <div className="text-xs font-bold text-[#AFAFAF] flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[#58A700]">
                            <Crown className="w-3.5 h-3.5" />
                            {room.players.find((p) => p.isLeader)?.name || 'リーダー'}
                          </span>
                          <span>•</span>
                          <span>定員 {room.players.length}/{room.maxPlayers}人</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinRoom(room)}
                        disabled={room.players.length >= room.maxPlayers}
                        className="duo-btn duo-btn-blue px-4 py-2 rounded-xl text-xs font-black shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        {room.players.length >= room.maxPlayers ? '満員' : '参加する'}
                      </button>
                    </div>

                    {/* Modifiers tags in room */}
                    {room.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#E5E5E5]">
                        {room.modifiers.map((m) => (
                          <span
                            key={m.id}
                            className="text-[11px] font-black bg-[#EBF7FD] text-[#1CB0F6] border border-[#BAE3F8] px-2 py-0.5 rounded-md"
                          >
                            {m.icon} {m.name} (+{m.bonusPercent}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. Create Room View (部屋を作るフォーム) */}
        {view === 'create_room' && (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setView('find_room');
                }}
                className="flex items-center gap-1 text-xs font-black text-[#777777] hover:text-[#3C3C3C] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>部屋一覧へ戻る</span>
              </button>
              <span className="text-xs font-black text-[#58CC02]">新規オンラインルーム作成</span>
            </div>

            {/* Room Name */}
            <div>
              <label className="text-xs font-black text-[#3C3C3C] block mb-1">
                部屋の名前
              </label>
              <input
                type="text"
                value={newRoomName}
                maxLength={20}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="例: 初心者歓迎！、ガチ対戦"
                className="w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E5E5] focus:border-[#58CC02] text-sm font-black text-[#3C3C3C] outline-none"
                required
              />
            </div>

            {/* Max Players */}
            <div>
              <label className="text-xs font-black text-[#3C3C3C] block mb-1">
                参加可能人数（定員）
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 4, 6, 8].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setNewMaxPlayers(num);
                    }}
                    className={`py-2 rounded-xl text-xs font-black border-2 cursor-pointer transition-all ${
                      newMaxPlayers === num
                        ? 'border-[#1CB0F6] bg-[#EBF7FD] text-[#1CB0F6]'
                        : 'border-[#E5E5E5] bg-white text-[#777777]'
                    }`}
                  >
                    {num}人
                  </button>
                ))}
              </div>
            </div>

            {/* Modifiers / Rules */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-[#3C3C3C]">
                  ルール設定（モディファイア）
                </label>
                <span className="text-[11px] font-bold text-[#AFAFAF]">1個につき順位報酬+30%</span>
              </div>
              <div className="space-y-1.5">
                {selectedModifiers.map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => toggleModifier(mod.id)}
                    className={`p-2.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      mod.active
                        ? 'border-[#58CC02] bg-[#F7FFF0]'
                        : 'border-[#E5E5E5] bg-white hover:bg-[#F9F9F9]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mod.icon}</span>
                      <div>
                        <div className="text-xs font-black text-[#3C3C3C]">
                          {mod.name}
                        </div>
                        <div className="text-[10px] font-bold text-[#AFAFAF]">
                          {mod.description}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      mod.active ? 'bg-[#58CC02] text-white' : 'bg-[#F0F0F0] text-[#AFAFAF]'
                    }`}>
                      +30%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Room Submit */}
            <button
              type="submit"
              className="duo-btn duo-btn-green w-full h-12 rounded-2xl text-base font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Sparkles className="w-5 h-5" />
              <span>オンライン部屋を作成してロビーへ</span>
            </button>
          </form>
        )}

        {/* 4. Waiting Lobby (ロビー待機部屋) */}
        {view === 'waiting_room' && activeRoom && (
          <div className="space-y-4">
            {/* Room Info Card */}
            <div className="p-3.5 bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-[#1CB0F6] uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    <span>ONLINE LOBBY</span>
                  </div>
                  <h3 className="text-lg font-black text-[#3C3C3C]">
                    {activeRoom.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black bg-[#EBF7FD] text-[#1CB0F6] px-2.5 py-1 rounded-full border border-[#BAE3F8]">
                    {activeRoom.players.length}/{activeRoom.maxPlayers}人
                  </span>
                </div>
              </div>

              {/* Modifiers preview */}
              {activeRoom.modifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#E5E5E5]">
                  {activeRoom.modifiers.map((m) => (
                    <span
                      key={m.id}
                      className="text-[11px] font-black bg-white text-[#58CC02] border border-[#58CC02]/30 px-2 py-0.5 rounded-md"
                    >
                      {m.icon} {m.name} (+{m.bonusPercent}%)
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Players List in Lobby */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[#3C3C3C]">
                  オンライン参加メンバー ({activeRoom.players.length}人)
                </span>
                {isLeader && activeRoom.players.length < activeRoom.maxPlayers && (
                  <button
                    type="button"
                    onClick={handleAddBot}
                    className="text-xs font-black text-[#1CB0F6] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>botを追加</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {activeRoom.players.map((p) => {
                  const isMe = p.id === currentUser.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border-2 flex items-center justify-between ${
                        isMe ? 'bg-[#F7FFF0] border-[#58CC02]' : 'bg-white border-[#E5E5E5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#D0D0D0] bg-white flex items-center justify-center shrink-0">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base">{p.isBot ? '🤖' : '🐟'}</span>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-black text-[#3C3C3C] flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isMe && (
                              <span className="text-[10px] font-black bg-[#58CC02] text-white px-1.5 py-0.2 rounded">
                                自分
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-[#AFAFAF] flex items-center gap-1.5">
                            {p.isLeader ? (
                              <span className="text-[#FF9600] font-black flex items-center gap-0.5">
                                <Crown className="w-3 h-3" /> リーダー
                              </span>
                            ) : (
                              <span>メンバー</span>
                            )}
                            <span>•</span>
                            <span className="text-[#58CC02] font-black">接続中・準備完了</span>
                          </div>
                        </div>
                      </div>

                      {/* Leader Action: Kick button */}
                      {isLeader && !p.isLeader && (
                        <button
                          type="button"
                          onClick={() => handleKickPlayer(p.id)}
                          className="px-2.5 py-1 rounded-xl bg-[#FFF0F0] border border-[#FFD0D0] text-[#FF4B4B] hover:bg-[#FFE0E0] text-xs font-black flex items-center gap-1 cursor-pointer"
                          title="このプレイヤーをキックする"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>キック</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="duo-btn duo-btn-gray h-13 px-4 rounded-2xl text-sm font-black text-[#FF4B4B] shrink-0"
              >
                退出
              </button>

              {isLeader ? (
                <button
                  id="leader-start-battle-btn"
                  type="button"
                  onClick={handleLeaderStart}
                  className="duo-btn duo-btn-green flex-1 h-13 rounded-2xl text-base font-black flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>準備OK / 対戦スタート</span>
                </button>
              ) : (
                <div className="flex-1 h-13 rounded-2xl bg-[#EBF7FD] border-2 border-[#BAE3F8] text-[#1CB0F6] text-sm font-black flex items-center justify-center gap-2 animate-pulse">
                  <span>リーダーの開始を待機中...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

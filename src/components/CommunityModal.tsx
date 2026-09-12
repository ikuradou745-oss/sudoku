import { useState, useEffect } from 'react';
import { 
  X, 
  Circle, 
  Clock, 
  User, 
  Search
} from 'lucide-react';
import { OnlineUserPresence, UserStats } from '../types';
import { realtimePresence } from '../utils/multiplayer';
import { audio } from '../utils/audio';
import { auth, subscribeToOnlineUsers } from '../utils/firebase';

interface CommunityModalProps {
  currentUser: UserStats;
  onClose: () => void;
}

export function CommunityModal({ currentUser, onClose }: CommunityModalProps) {
  const [tab, setTab] = useState<'online' | 'today'>('online');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [todayUsers, setTodayUsers] = useState<OnlineUserPresence[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    // Initial fetch & subscribe from realtimePresence
    setOnlineUsers(realtimePresence.getOnlineUsers());
    setTodayUsers(realtimePresence.getTodayUsers());

    const unsubscribeRealtime = realtimePresence.subscribe((event) => {
      if (event.type === 'PRESENCE_SNAPSHOT') {
        setOnlineUsers(event.onlineUsers);
        setTodayUsers(event.todayUsers);
      }
    });

    let unsubscribeFirestore: (() => void) | null = null;
    if (auth.currentUser) {
      try {
        unsubscribeFirestore = subscribeToOnlineUsers((docs) => {
          const firestorePresences: OnlineUserPresence[] = docs.map((d: Record<string, unknown>) => ({
            id: String(d.userId || ''),
            name: String(d.userName || 'ユーザー'),
            avatarUrl: (d.avatarUrl as string) || null,
            rating: typeof d.rating === 'number' ? d.rating : 0,
            rankTier: (d.rankTier as any) || 'bronze',
            lastActive: typeof d.lastActive === 'number' ? d.lastActive : Date.now(),
            isOnline: !!d.isOnline,
            lastLoginDate: String(d.lastDailyDate || '今日'),
            activity: '学習受講中 ✏️',
          }));

          setOnlineUsers((prev) => {
            const map = new Map<string, OnlineUserPresence>();
            prev.forEach((u) => map.set(u.id, u));
            firestorePresences.forEach((u) => map.set(u.id, u));
            return Array.from(map.values());
          });
        });
      } catch {
        // Fallback to socket presence
      }
    }

    return () => {
      unsubscribeRealtime();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // Format timestamp to Japanese relative or time string
  const formatTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 30) return 'たった今 (オンライン)';
    if (diffMin < 60) return `${diffMin}分前`;
    if (diffHour < 24) {
      const d = new Date(timestamp);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isRealUser = (u: OnlineUserPresence) =>
    !!u.id &&
    !u.id.startsWith('member_') &&
    !u.id.toLowerCase().includes('bot') &&
    !u.name.toLowerCase().includes('bot');

  // Filter list by search query (Strictly real users only)
  const filteredOnline = onlineUsers.filter(
    (u) => isRealUser(u) && (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const otherOnlineUsers = filteredOnline.filter((u) => u.id !== currentUser.userId);

  const filteredToday = todayUsers.filter(
    (u) => isRealUser(u) && (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="community-members-modal"
        className="duo-card w-full max-w-lg bg-white p-5 sm:p-6 text-left animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E5E5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF7FD] text-[#1CB0F6] border-2 border-[#BDE3F8] flex items-center justify-center text-xl shadow-xs">
              👥
            </div>
            <div>
              <h2 className="text-xl font-black text-[#3C3C3C] flex items-center gap-2">
                <span>メンバー・ログイン状況</span>
              </h2>
              <p className="text-xs font-bold text-[#777777]">
                今日ログインした人と現在オンラインのプレイヤー
              </p>
            </div>
          </div>
          <button
            id="close-community-modal-btn"
            onClick={() => {
              audio.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Card */}
        <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-[#F0FDF4] to-[#EBF7FD] border-2 border-[#BBF7D0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-[#58CC02] bg-white flex items-center justify-center shadow-xs shrink-0">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt="My Avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-6 h-6 text-[#58CC02]" />
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#58CC02] border-2 border-white ring-1 ring-[#58CC02]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-[#3C3C3C]">
                  {currentUser.userName || '会員'}
                </span>
                <span className="text-[10px] font-black bg-[#58CC02] text-white px-1.5 py-0.2 rounded-md">
                  あなた
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] font-black text-[#58A700] flex items-center gap-1">
              <Circle className="w-2 h-2 fill-[#58CC02] text-[#58CC02] animate-ping" />
              <span>接続中</span>
            </div>
          </div>
        </div>

        {/* Tab Switching */}
        <div className="mt-4 flex items-center gap-2 bg-[#F7F7F7] p-1 rounded-2xl border-2 border-[#E5E5E5] shrink-0">
          <button
            onClick={() => {
              audio.playTap();
              setTab('online');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'online'
                ? 'bg-white text-[#1CB0F6] shadow-xs border-2 border-[#BDE3F8]'
                : 'text-[#777777] hover:text-[#3C3C3C]'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#58CC02] ring-2 ring-[#58CC02]/30 animate-pulse" />
            <span>現在ログイン中</span>
            <span className="px-2 py-0.2 rounded-full bg-[#EBF7FD] text-[#1CB0F6] text-[11px]">
              {onlineUsers.length}
            </span>
          </button>

          <button
            onClick={() => {
              audio.playTap();
              setTab('today');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'today'
                ? 'bg-white text-[#FF9600] shadow-xs border-2 border-[#FFD966]'
                : 'text-[#777777] hover:text-[#3C3C3C]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#FF9600]" />
            <span>今日ログインした人</span>
            <span className="px-2 py-0.2 rounded-full bg-[#FFF9E6] text-[#FF9600] text-[11px]">
              {todayUsers.length}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="mt-3 relative shrink-0">
          <Search className="w-4 h-4 text-[#AFAFAF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ユーザー名で絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-xs font-bold text-[#3C3C3C] focus:outline-hidden focus:border-[#1CB0F6]"
          />
        </div>

        {/* Member List Content */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {tab === 'online' ? (
            otherOnlineUsers.length > 0 ? (
              otherOnlineUsers.map((user) => {
                return (
                  <div
                    key={user.id}
                    className="p-3 rounded-2xl border-2 flex items-center justify-between transition-all bg-white border-[#E5E5E5] hover:border-[#BDE3F8]"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#D0D0D0] bg-white flex items-center justify-center shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-5 h-5 text-[#58CC02]" />
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#58CC02] border-2 border-white ring-1 ring-[#58CC02]" />
                      </div>

                      {/* Name */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#3C3C3C] max-w-[160px] sm:max-w-[240px] truncate">
                            {user.name}
                          </span>
                        </div>
                        {user.activity && (
                          <div className="mt-0.5">
                            <span className="text-[10px] font-black text-[#0284C7] bg-[#E0F2FE] px-2 py-0.2 rounded-full border border-[#BAE6FD]">
                              {user.activity}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#166534] text-[11px] font-black">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                        <span>オンライン</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-2 px-4">
                <div className="w-10 h-10 rounded-full bg-[#F0FDF4] border-2 border-[#BBF7D0] flex items-center justify-center text-lg">
                  🟢
                </div>
                <div className="text-sm font-black text-[#3C3C3C]">現在オンラインの他のプレイヤーはいません</div>
                <div className="text-xs font-bold text-[#777777] max-w-xs">
                  現在あなたのみ接続中です（ボット等の演出は一切含みません）。他の実プレイヤーが接続するとリアルタイムに表示されます。
                </div>
              </div>
            )
          ) : (
            filteredToday.length > 0 ? (
              filteredToday.map((user) => {
                const isMe = user.id === currentUser.userId;
                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-white border-[#E5E5E5] hover:border-[#FFD966]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#D0D0D0] bg-white flex items-center justify-center shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-5 h-5 text-[#58CC02]" />
                        )}
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#58CC02] border-2 border-white ring-1 ring-[#58CC02]" />
                        )}
                      </div>

                      {/* Name */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#3C3C3C] max-w-[160px] sm:max-w-[240px] truncate">
                            {user.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-black bg-[#FF9600] text-white px-1.5 py-0.2 rounded-md">
                              あなた
                            </span>
                          )}
                        </div>
                        {user.activity && (
                          <div className="mt-0.5">
                            <span className="text-[10px] font-black text-[#0284C7] bg-[#E0F2FE] px-2 py-0.2 rounded-full border border-[#BAE6FD]">
                              {user.activity}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-[#777777] flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-[#AFAFAF]" />
                        <span>{formatTime(user.lastActive)}</span>
                      </div>
                      <div className="text-[10px] font-bold text-[#AFAFAF]">
                        {user.isOnline ? (
                          <span className="text-[#22C55E] font-black">● 接続中</span>
                        ) : (
                          '今日ログイン'
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-[#AFAFAF] font-bold text-sm">
                本日ログインしたメンバーはいません
              </div>
            )
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-[#E5E5E5] text-center text-[11px] font-bold text-[#AFAFAF] shrink-0">
          ※ 毎日朝9:00に「今日ログインした人」が更新リセットされます
        </div>
      </div>
    </div>
  );
}

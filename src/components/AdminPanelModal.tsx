import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  X, 
  Users, 
  User, 
  Clock, 
  Flame, 
  LogOut, 
  CheckCircle2, 
  Trash2, 
  Radio,
  Search,
  Dice5,
  PenLine,
  Check
} from 'lucide-react';
import { OnlineUserPresence, BanRouletteTriggerEvent, BanRecord, BanDurationUnit } from '../types';
import { logoutAdmin, getStoredBanInfo, clearBanInfo } from '../utils/adminAuth';
import { subscribeToFirebasePresence, removeFirebaseBan } from '../utils/firebase';
import { realtimePresence } from '../utils/multiplayer';
import { RANK_TIERS } from '../utils/rank';
import { audio } from '../utils/audio';

interface AdminPanelModalProps {
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onTriggerRoulette: (event: BanRouletteTriggerEvent) => void;
}

export function AdminPanelModal({
  currentUserId,
  currentUserName,
  onClose,
  onTriggerRoulette,
}: AdminPanelModalProps) {
  const [liveOnlineUsers, setLiveOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [todayUsers, setTodayUsers] = useState<OnlineUserPresence[]>([]);
  
  // Target Mode: 'all' | 'single' | 'custom'
  const [targetMode, setTargetMode] = useState<'all' | 'single' | 'custom'>('single');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Custom manual input
  const [customUserName, setCustomUserName] = useState<string>('');
  const [customUserId, setCustomUserId] = useState<string>('');

  // User Filter & Search
  const [userCategory, setUserCategory] = useState<'all' | 'online' | 'today' | 'ranked'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Duration Configuration
  const [isPermanent, setIsPermanent] = useState<boolean>(false);
  const [durationValue, setDurationValue] = useState<number>(30);
  const [durationUnit, setDurationUnit] = useState<BanDurationUnit>('minutes');

  const [activeBan, setActiveBan] = useState<BanRecord | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    // 1. Initial snapshot from multiplayer presence
    setLiveOnlineUsers(realtimePresence.getOnlineUsers());
    setTodayUsers(realtimePresence.getTodayUsers());

    // 2. Subscribe to live online users from Firebase
    const unsubFirebase = subscribeToFirebasePresence((online, today) => {
      setLiveOnlineUsers(online);
      setTodayUsers(today);
    });

    // 3. Load stored active ban if any
    setActiveBan(getStoredBanInfo());

    return () => unsubFirebase();
  }, []);

  // Check if a presence user is a genuine real user (exclude any bots or simulated accounts)
  const isRealUser = (u: OnlineUserPresence) =>
    !!u &&
    !!u.id &&
    !u.id.startsWith('member_') &&
    !u.id.toLowerCase().includes('bot') &&
    !u.name.toLowerCase().includes('bot') &&
    !u.name.includes('さくら') &&
    !u.id.includes('sakura');

  // Merge live online real users, today's real users, and current user
  const allUsersMap = useMemo(() => {
    const map = new Map<string, OnlineUserPresence>();

    // 1. Add today's real users
    todayUsers.forEach((u) => {
      if (isRealUser(u)) map.set(u.id, u);
    });

    // 2. Add live online real users (mark as online)
    liveOnlineUsers.forEach((u) => {
      if (isRealUser(u)) {
        map.set(u.id, { ...u, isOnline: true });
      }
    });

    // 3. Add current user
    if (currentUserId) {
      map.set(currentUserId, {
        id: currentUserId,
        name: `${currentUserName || '会員'} (自分/管理者)`,
        avatarUrl: null,
        rating: 150,
        rankTier: 'silver',
        lastActive: Date.now(),
        isOnline: true,
        lastLoginDate: '2026-09-13',
        activity: '管理者パネル操作中 🛡️',
      });
    }

    return map;
  }, [liveOnlineUsers, todayUsers, currentUserId, currentUserName]);

  const allUsersList = useMemo(() => {
    return Array.from(allUsersMap.values());
  }, [allUsersMap]);

  // Set initial selected user if none selected
  useEffect(() => {
    if (!selectedUserId && allUsersList.length > 0) {
      setSelectedUserId(allUsersList[0].id);
    }
  }, [allUsersList, selectedUserId]);

  // Filtered users for display
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allUsersList.filter((u) => {
      // Category filter
      if (userCategory === 'online' && !u.isOnline) return false;
      if (userCategory === 'today' && !u.isOnline && !u.lastLoginDate?.includes('2026')) return false;
      if (userCategory === 'ranked') {
        const isHigh = u.rankTier === 'gold' || u.rankTier === 'platinum' || u.rankTier === 'diamond' || u.rankTier === 'heaven';
        if (!isHigh) return false;
      }

      // Search query filter
      if (query) {
        const matchName = (u.name || '').toLowerCase().includes(query);
        const matchId = (u.id || '').toLowerCase().includes(query);
        const matchActivity = (u.activity || '').toLowerCase().includes(query);
        if (!matchName && !matchId && !matchActivity) return false;
      }

      return true;
    });
  }, [allUsersList, userCategory, searchQuery]);

  // Find currently selected user
  const selectedUser = useMemo(() => {
    return allUsersMap.get(selectedUserId);
  }, [allUsersMap, selectedUserId]);

  // Compute calculated duration in minutes
  const calculateDurationMinutes = (): number => {
    if (isPermanent) return -1;
    const val = Math.max(1, durationValue);
    if (durationUnit === 'minutes') return val;
    if (durationUnit === 'hours') return val * 60;
    if (durationUnit === 'days') return val * 60 * 24;
    return val;
  };

  const getDurationLabel = (): string => {
    if (isPermanent) return '永久BAN';
    const unitText = durationUnit === 'minutes' ? '分' : durationUnit === 'hours' ? '時間' : '日';
    return `${durationValue}${unitText}`;
  };

  // Set preset
  const applyPreset = (preset: '10m' | '1h' | '1d' | '7d' | '30d' | 'perm') => {
    audio.playTap();
    if (preset === 'perm') {
      setIsPermanent(true);
    } else if (preset === '10m') {
      setIsPermanent(false);
      setDurationValue(10);
      setDurationUnit('minutes');
    } else if (preset === '1h') {
      setIsPermanent(false);
      setDurationValue(1);
      setDurationUnit('hours');
    } else if (preset === '1d') {
      setIsPermanent(false);
      setDurationValue(1);
      setDurationUnit('days');
    } else if (preset === '7d') {
      setIsPermanent(false);
      setDurationValue(7);
      setDurationUnit('days');
    } else if (preset === '30d') {
      setIsPermanent(false);
      setDurationValue(30);
      setDurationUnit('days');
    }
  };

  // Pick random user from current candidates
  const handlePickRandomUser = () => {
    audio.playTap();
    if (filteredUsers.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredUsers.length);
    const chosen = filteredUsers[randomIndex];
    setSelectedUserId(chosen.id);
    setNotification(`🎲 ランダム選出: 「${chosen.name}」さんを選択しました！`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Trigger BAN Roulette
  const handleLaunchRoulette = () => {
    audio.playTap();

    let targetUserName = '全員';
    let targetId: string | undefined = undefined;

    if (targetMode === 'single') {
      if (!selectedUser) {
        alert('対象ユーザーを選択してください。');
        return;
      }
      targetUserName = selectedUser.name;
      targetId = selectedUser.id;
    } else if (targetMode === 'custom') {
      if (!customUserName.trim()) {
        alert('自由入力のユーザー名を入力してください。');
        return;
      }
      targetUserName = customUserName.trim();
      targetId = customUserId.trim() || `custom_${Date.now()}`;
    }

    const durationMinutes = calculateDurationMinutes();
    const durationLabel = getDurationLabel();

    const event: BanRouletteTriggerEvent = {
      rouletteId: `roulette_${Date.now()}`,
      targetType: targetMode === 'all' ? 'all' : 'single',
      targetUserId: targetId,
      targetUserName,
      durationMinutes,
      isPermanent,
      durationLabel,
      reason: '管理者パネルによるBANルーレット対象',
      createdAt: Date.now(),
    };

    onTriggerRoulette(event);
    onClose();
  };

  // Launch self test
  const handleSelfTest = () => {
    audio.playTap();
    const durationMinutes = calculateDurationMinutes();
    const durationLabel = getDurationLabel();

    const event: BanRouletteTriggerEvent = {
      rouletteId: `roulette_self_${Date.now()}`,
      targetType: 'single',
      targetUserId: currentUserId,
      targetUserName: currentUserName,
      durationMinutes,
      isPermanent,
      durationLabel,
      reason: '管理者セルフテスト用BANルーレット',
      createdAt: Date.now(),
    };

    onTriggerRoulette(event);
    onClose();
  };

  // Clear active ban
  const handleClearBan = () => {
    audio.playTap();
    clearBanInfo();
    setActiveBan(null);
    removeFirebaseBan(currentUserId);
    if (selectedUserId) {
      removeFirebaseBan(selectedUserId);
    }
    setNotification('✅ BANを解除しました。');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = () => {
    audio.playTap();
    logoutAdmin();
    onClose();
  };

  return (
    <div 
      id="admin-panel-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border-4 border-[#3C3C3C] my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FF4B4B] text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#3C3C3C]">
                  管理者パネル (Admin)
                </h2>
                <span className="text-[10px] font-black bg-[#FF4B4B] text-white px-2 py-0.5 rounded-md">
                  BANルーレット管理
                </span>
              </div>
              <p className="text-xs font-bold text-[#777777]">
                受講生一覧・オンライン全員・自由指定からBANルーレットを発動
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-[#777777] hover:text-[#FF4B4B] hover:bg-[#FFF0F0] transition-colors cursor-pointer"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                audio.playTap();
                onClose();
              }}
              className="p-2 rounded-xl text-[#777777] hover:text-[#3C3C3C] hover:bg-[#F7F7F7] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="mb-3 p-2.5 bg-[#EEFDF0] border-2 border-[#58CC02] rounded-2xl text-xs font-black text-[#58CC02] flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Scrollable Content Container */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          
          {/* Section: Target Selector */}
          <div className="bg-[#F7F7F7] p-3.5 sm:p-4 rounded-2xl border-2 border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-[#4B4B4B] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#1CB0F6]" />
                <span>1. ルーレット対象を選択</span>
              </label>
              <span className="text-[11px] font-bold text-[#777777] bg-white px-2 py-0.5 rounded-lg border border-[#E5E5E5]">
                候補: {allUsersList.length}名
              </span>
            </div>

            {/* Target Mode Switcher (All / Single / Custom) */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setTargetMode('single');
                }}
                className={`py-2 px-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  targetMode === 'single'
                    ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                    : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F0F0F0]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>受講生から選択</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setTargetMode('all');
                }}
                className={`py-2 px-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  targetMode === 'all'
                    ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                    : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F0F0F0]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>オンライン全員</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setTargetMode('custom');
                }}
                className={`py-2 px-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                  targetMode === 'custom'
                    ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                    : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F0F0F0]'
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>自由入力</span>
              </button>
            </div>

            {/* Mode 1: Single User Selection with Rich Filters and Candidates */}
            {targetMode === 'single' && (
              <div className="space-y-2.5">
                
                {/* Active Target Banner */}
                {selectedUser && (
                  <div className="p-2.5 bg-[#FFF5EB] border-2 border-[#FFD966] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white border border-[#FFD966] flex items-center justify-center text-sm shadow-xs font-black text-[#A57800]">
                        {selectedUser.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-[#3C3C3C]">
                            {selectedUser.name}
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md border ${RANK_TIERS[selectedUser.rankTier]?.badgeBg || 'bg-gray-100 text-gray-700'}`}>
                            {RANK_TIERS[selectedUser.rankTier]?.icon} {RANK_TIERS[selectedUser.rankTier]?.name}
                          </span>
                          {selectedUser.isOnline && (
                            <span className="text-[10px] font-black text-[#58CC02] bg-white px-1.5 py-0.2 rounded-md border border-[#58CC02]">
                              🟢 オンライン
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-[#777777]">
                          ID: {selectedUser.id}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePickRandomUser}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#FFF9E6] border border-[#FFD966] text-[#A57800] rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1 shadow-xs active:scale-95 shrink-0"
                      title="候補の中からランダムに選出"
                    >
                      <Dice5 className="w-3.5 h-3.5" />
                      <span>🎲 ランダム選出</span>
                    </button>
                  </div>
                )}

                {/* Filter Categories Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    { key: 'all', label: `👥 全員 (${allUsersList.length})` },
                    { key: 'online', label: `🟢 オンライン (${allUsersList.filter(u => u.isOnline).length})` },
                    { key: 'today', label: `📅 本日学習 (${allUsersList.filter(u => u.isOnline || u.lastLoginDate?.includes('2026')).length})` },
                    { key: 'ranked', label: `🏆 高ランク (${allUsersList.filter(u => u.rankTier === 'gold' || u.rankTier === 'platinum' || u.rankTier === 'diamond' || u.rankTier === 'heaven').length})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        audio.playTap();
                        setUserCategory(tab.key as any);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                        userCategory === tab.key
                          ? 'bg-[#3C3C3C] text-white shadow-xs'
                          : 'bg-white text-[#777777] border border-[#E5E5E5] hover:bg-[#F0F0F0]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#AFAFAF] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ユーザー名、ID、ステータスで絞り込み検索..."
                    className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden placeholder:text-[#AFAFAF]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-xs font-bold text-[#AFAFAF] hover:text-[#3C3C3C] p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Selectable Users Card Grid */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 border-2 border-[#E5E5E5] bg-white rounded-xl p-2">
                  {filteredUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs font-bold text-[#AFAFAF]">
                      該当する受講生が見つかりませんでした。
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUserId === u.id;
                      const tierInfo = RANK_TIERS[u.rankTier] || RANK_TIERS.bronze;

                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            audio.playTap();
                            setSelectedUserId(u.id);
                          }}
                          className={`p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#EBF7FD] border-[#1CB0F6] shadow-xs ring-1 ring-[#1CB0F6]'
                              : 'bg-white border-[#F0F0F0] hover:border-[#E5E5E5] hover:bg-[#FAFAFA]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative w-8 h-8 rounded-full bg-[#F0F0F0] border border-[#E0E0E0] flex items-center justify-center text-xs font-black text-[#555] shrink-0">
                              {u.name.slice(0, 1)}
                              {u.isOnline && (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#58CC02] border-2 border-white" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-[#3C3C3C] truncate">
                                  {u.name}
                                </span>
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shrink-0 ${tierInfo.badgeBg}`}>
                                  {tierInfo.icon} {tierInfo.name}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-[#888888] truncate">
                                {u.activity || (u.isOnline ? '学習中 ✏️' : '本日受講完了 ✨')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[10px] font-mono font-bold text-[#AFAFAF] hidden sm:inline">
                              {u.rating} RP
                            </span>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                              isSelected ? 'bg-[#1CB0F6] border-[#1CB0F6] text-white' : 'border-[#CCCCCC] bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-2 bg-[#F0F7FF] rounded-xl border border-[#D0E6FC] flex items-center justify-between text-[11px] text-[#1B72E8]">
                  <span>💡 実際にアクセス中の受講生のみ表示されます</span>
                  <button
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setTargetMode('custom');
                    }}
                    className="font-bold underline hover:text-[#174EA6] cursor-pointer"
                  >
                    名前を直接手動入力 ➔
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: Online All */}
            {targetMode === 'all' && (
              <div className="p-3 bg-white border-2 border-[#1CB0F6] rounded-xl text-center space-y-1">
                <span className="text-xs font-black text-[#1CB0F6] block">
                  📢 オンライン中の受講生全員が対象になります
                </span>
                <p className="text-[11px] font-bold text-[#777777]">
                  現在アクティブな受講生全員の画面で一斉にBANルーレット演出が開始されます。
                </p>
              </div>
            )}

            {/* Mode 3: Custom Input */}
            {targetMode === 'custom' && (
              <div className="p-3 bg-white border-2 border-[#E5E5E5] rounded-xl space-y-2">
                <div>
                  <label className="block text-[11px] font-black text-[#4B4B4B] mb-1">
                    対象ユーザー名:
                  </label>
                  <input
                    type="text"
                    value={customUserName}
                    onChange={(e) => setCustomUserName(e.target.value)}
                    placeholder="例: 山田太郎、悪質ユーザー..."
                    className="w-full px-3 py-2 bg-[#F9F9F9] border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[#4B4B4B] mb-1">
                    対象ユーザーID (省略可):
                  </label>
                  <input
                    type="text"
                    value={customUserId}
                    onChange={(e) => setCustomUserId(e.target.value)}
                    placeholder="例: user_123456 (空欄の場合は自動発行)"
                    className="w-full px-3 py-2 bg-[#F9F9F9] border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-mono font-bold text-[#3C3C3C] outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Duration Selector */}
          <div className="bg-[#F7F7F7] p-3.5 sm:p-4 rounded-2xl border-2 border-[#E5E5E5]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-[#4B4B4B] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#FF9600]" />
                <span>2. BAN期間の指定 (日・時・分・永久)</span>
              </label>
              <span className="text-xs font-black text-[#FF4B4B] bg-white px-2 py-0.5 rounded-lg border border-[#E5E5E5]">
                {getDurationLabel()}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(['10m', '1h', '1d', '7d', '30d', 'perm'] as const).map((preset) => {
                const label = preset === '10m' ? '10分' :
                  preset === '1h' ? '1時間' :
                  preset === '1d' ? '1日' :
                  preset === '7d' ? '1週間' :
                  preset === '30d' ? '1ヶ月' : '永久BAN ♾️';
                
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-2.5 py-1 bg-white hover:bg-[#FFF5EB] border border-[#E5E5E5] hover:border-[#FF9600] rounded-lg text-xs font-bold text-[#4B4B4B] cursor-pointer transition-all active:scale-95"
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Custom inputs */}
            {!isPermanent ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={durationValue}
                  onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 py-2 px-3 bg-white border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as BanDurationUnit)}
                  className="flex-1 py-2 px-3 bg-white border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden cursor-pointer"
                >
                  <option value="minutes">分 (Minutes)</option>
                  <option value="hours">時間 (Hours)</option>
                  <option value="days">日 (Days)</option>
                </select>
              </div>
            ) : (
              <div className="p-2.5 bg-[#FFF0F0] border border-[#FFCACA] rounded-xl text-xs font-black text-[#FF4B4B] text-center">
                ※ 永久BANが選択されています（無期限）
              </div>
            )}
          </div>

          {/* Launch Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="admin-launch-roulette-btn"
              type="button"
              onClick={handleLaunchRoulette}
              className="w-full py-3.5 rounded-2xl bg-[#FF4B4B] hover:bg-[#E53E3E] border-b-4 border-[#C53030] text-white font-black text-sm tracking-wide shadow-lg cursor-pointer transition-all active:translate-y-1 active:border-b-0 flex items-center justify-center gap-2"
            >
              <Flame className="w-5 h-5" />
              <span>🎲 BANルーレットを発動する</span>
            </button>

            <button
              id="admin-self-test-btn"
              type="button"
              onClick={handleSelfTest}
              className="w-full py-2.5 rounded-xl bg-[#FFF9E6] hover:bg-[#FFF0CC] border border-[#FFD966] text-[#A57800] font-black text-xs cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-1.5"
            >
              <span>🧪 自分の画面でBANルーレットをテスト発動</span>
            </button>
          </div>

          {/* Active Bans Section */}
          {activeBan && (
            <div className="p-3 bg-[#FFF0F0] border-2 border-[#FF4B4B] rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-[#FF4B4B] block">
                  現在の端末BAN状態:
                </span>
                <span className="text-[11px] font-bold text-[#4B4B4B]">
                  {activeBan.durationLabel} ({activeBan.reason})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearBan}
                className="px-3 py-1.5 bg-white border border-[#FF4B4B] text-[#FF4B4B] hover:bg-[#FF4B4B] hover:text-white rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>BAN解除</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  X, 
  Users, 
  LogOut, 
  CheckCircle2, 
  Trash2, 
  Search, 
  Check, 
  RefreshCw, 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Calendar,
  UserCheck
} from 'lucide-react';
import { OnlineUserPresence, BanRecord, FeedbackReport, FeedbackType } from '../types';
import { logoutAdmin, getStoredBanInfo, clearBanInfo } from '../utils/adminAuth';
import { 
  subscribeToFirebasePresence, 
  removeFirebaseBan, 
  fetchFeedbackReports, 
  deleteFeedbackReport 
} from '../utils/firebase';
import { realtimePresence } from '../utils/multiplayer';
import { RANK_TIERS } from '../utils/rank';
import { audio } from '../utils/audio';

interface AdminPanelModalProps {
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
}

export function AdminPanelModal({
  currentUserId,
  currentUserName,
  onClose,
}: AdminPanelModalProps) {
  // Navigation tabs: 'feedback' | 'users'
  const [activeTab, setActiveTab] = useState<'feedback' | 'users'>('feedback');

  // Feedback State
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(false);
  const [reportFilter, setReportFilter] = useState<'all' | FeedbackType>('all');
  const [feedbackSearch, setFeedbackSearch] = useState<string>('');

  // Users & Bans State
  const [liveOnlineUsers, setLiveOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [todayUsers, setTodayUsers] = useState<OnlineUserPresence[]>([]);
  const [userCategory, setUserCategory] = useState<'all' | 'online' | 'today' | 'ranked'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [activeBan, setActiveBan] = useState<BanRecord | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [notification, setNotification] = useState<string | null>(null);

  const loadReports = async () => {
    setIsLoadingReports(true);
    try {
      const data = await fetchFeedbackReports();
      setReports(data);
    } catch (err) {
      console.warn('Failed to load feedback reports:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    // 1. Initial snapshot of presence
    setLiveOnlineUsers(realtimePresence.getOnlineUsers());
    setTodayUsers(realtimePresence.getTodayUsers());

    // 2. Subscribe to Firebase live presence
    const unsubFirebase = subscribeToFirebasePresence((online, today) => {
      setLiveOnlineUsers(online);
      setTodayUsers(today);
    });

    // 3. Load active bans and feedback reports
    setActiveBan(getStoredBanInfo());
    loadReports();

    return () => unsubFirebase();
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Check if presence user is genuine (exclude bots)
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

    todayUsers.forEach((u) => {
      if (isRealUser(u)) map.set(u.id, u);
    });

    liveOnlineUsers.forEach((u) => {
      if (isRealUser(u)) {
        map.set(u.id, { ...u, isOnline: true });
      }
    });

    if (currentUserId && !map.has(currentUserId)) {
      map.set(currentUserId, {
        id: currentUserId,
        name: currentUserName || 'あなた (管理者)',
        avatarUrl: null,
        rating: 100,
        rankTier: 'bronze',
        lastActive: Date.now(),
        isOnline: true,
        lastLoginDate: new Date().toISOString().split('T')[0],
        activity: '管理者パネル操作中 🛡️',
      });
    }

    return map;
  }, [liveOnlineUsers, todayUsers, currentUserId, currentUserName]);

  const allUsersList = useMemo(() => {
    return Array.from(allUsersMap.values()).sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return b.lastActive - a.lastActive;
    });
  }, [allUsersMap]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsersList.filter((u) => {
      if (userCategory === 'online' && !u.isOnline) return false;
      if (userCategory === 'ranked' && (u.rankTier === 'bronze' || u.rankTier === 'silver')) return false;

      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.activity && u.activity.toLowerCase().includes(q))
      );
    });
  }, [allUsersList, userCategory, userSearchQuery]);

  // Filtered Feedback Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportFilter !== 'all' && r.type !== reportFilter) return false;
      if (!feedbackSearch.trim()) return true;
      const q = feedbackSearch.toLowerCase();
      return (
        r.userName.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.formattedDate.toLowerCase().includes(q)
      );
    });
  }, [reports, reportFilter, feedbackSearch]);

  const bugCount = reports.filter((r) => r.type === 'bug').length;
  const featureCount = reports.filter((r) => r.type === 'feature').length;

  // Delete a report
  const handleDeleteReport = async (id: string) => {
    audio.playTap();
    await deleteFeedbackReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    showToast('🗑️ アンケート/報告を削除・解決済みにしました。');
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
    showToast('✅ BANを解除しました。');
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
      <div className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border-4 border-[#3C3C3C] my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5] mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#3C3C3C] text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldAlert className="w-6 h-6 text-[#FFD966]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#3C3C3C]">
                  管理者パネル (Admin)
                </h2>
                <span className="text-[10px] font-black bg-[#1CB0F6] text-white px-2 py-0.5 rounded-md">
                  管理画面
                </span>
              </div>
              <p className="text-xs font-bold text-[#777777]">
                受講生のアンケート・バグ報告の確認 &amp; 受講生管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-[#777777] hover:text-[#FF4B4B] hover:bg-[#FFF0F0] transition-colors cursor-pointer"
              title="管理者ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                audio.playTap();
                onClose();
              }}
              className="p-2 rounded-xl text-[#777777] hover:text-[#3C3C3C] hover:bg-[#F7F7F7] transition-colors cursor-pointer"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Feedback Reports vs User Management */}
        <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              audio.playTap();
              setActiveTab('feedback');
            }}
            className={`py-2.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'feedback'
                ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                : 'bg-[#F7F7F7] border-[#E5E5E5] text-[#777777] hover:bg-[#EAEAEA]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>📃 アンケート / バグ報告 ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audio.playTap();
              setActiveTab('users');
            }}
            className={`py-2.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'users'
                ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                : 'bg-[#F7F7F7] border-[#E5E5E5] text-[#777777] hover:bg-[#EAEAEA]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>👥 受講生 &amp; BAN解除 ({allUsersList.length})</span>
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="mb-3 p-2.5 bg-[#EEFDF0] border-2 border-[#58CC02] rounded-2xl text-xs font-black text-[#58CC02] flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: Feedback and Bug Reports View                     */}
        {/* ======================================================== */}
        {activeTab === 'feedback' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 flex flex-col">
            
            {/* Control Bar: Filters, Search, and Refresh */}
            <div className="bg-[#F7F7F7] p-3 rounded-2xl border-2 border-[#E5E5E5] space-y-2 shrink-0">
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Filter Tabs */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setReportFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      reportFilter === 'all'
                        ? 'bg-[#3C3C3C] text-white'
                        : 'bg-white text-[#777777] border border-[#E5E5E5] hover:bg-[#F0F0F0]'
                    }`}
                  >
                    すべて ({reports.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setReportFilter('bug');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1 ${
                      reportFilter === 'bug'
                        ? 'bg-[#FF4B4B] text-white'
                        : 'bg-white text-[#FF4B4B] border border-[#FFCACA] hover:bg-[#FFF5F5]'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>バグ報告 ({bugCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      setReportFilter('feature');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1 ${
                      reportFilter === 'feature'
                        ? 'bg-[#1CB0F6] text-white'
                        : 'bg-white text-[#1CB0F6] border border-[#BDE3F8] hover:bg-[#F0F9FF]'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>追加要望 ({featureCount})</span>
                  </button>
                </div>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    loadReports();
                  }}
                  disabled={isLoadingReports}
                  className="px-2.5 py-1.5 bg-white hover:bg-[#F0F0F0] border border-[#E5E5E5] rounded-xl text-xs font-black text-[#4B4B4B] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                  title="最新の報告一覧を再読み込み"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin text-[#1CB0F6]' : ''}`} />
                  <span>更新</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#AFAFAF] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  placeholder="ユーザー名や内容でキーワード検索..."
                  className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden placeholder:text-[#AFAFAF]"
                />
                {feedbackSearch && (
                  <button
                    type="button"
                    onClick={() => setFeedbackSearch('')}
                    className="absolute right-2.5 top-2 text-xs font-bold text-[#AFAFAF] hover:text-[#3C3C3C] p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>

            </div>

            {/* Reports List: 名前：内容（日付あり） */}
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {isLoadingReports ? (
                <div className="py-12 text-center text-xs font-bold text-[#777777] flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#1CB0F6]" />
                  <span>報告一覧を読み込み中...</span>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-12 text-center bg-[#F9F9F9] rounded-2xl border-2 border-dashed border-[#E5E5E5] p-6">
                  <div className="text-3xl mb-2">📃</div>
                  <p className="text-xs font-black text-[#777777]">
                    該当するアンケートやバグ報告はありません。
                  </p>
                  <p className="text-[11px] text-[#AFAFAF] mt-1">
                    受講生が右上の「📃」ボタンから送信すると、ここにリアルタイムで表示されます。
                  </p>
                </div>
              ) : (
                filteredReports.map((report) => {
                  const isBug = report.type === 'bug';

                  return (
                    <div
                      key={report.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all shadow-2xs ${
                        isBug
                          ? 'bg-[#FFFDFD] border-[#FFCACA] hover:border-[#FF4B4B]'
                          : 'bg-[#FDFEFF] border-[#CCE9F9] hover:border-[#1CB0F6]'
                      }`}
                    >
                      {/* Top Header: Badge, Name, Date, Delete Button */}
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type Badge */}
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            isBug 
                              ? 'bg-[#FF4B4B] text-white' 
                              : 'bg-[#1CB0F6] text-white'
                          }`}>
                            {isBug ? <Bug className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                            <span>{report.typeName || (isBug ? 'バグ報告' : '追加してほしい要素')}</span>
                          </span>

                          {/* 名前：〇〇 */}
                          <div className="flex items-center gap-1 text-xs font-black text-[#3C3C3C]">
                            <span className="text-[#777777]">名前:</span>
                            <span className="bg-white px-2 py-0.5 rounded-md border border-[#E5E5E5] text-[#3C3C3C]">
                              {report.userName}
                            </span>
                          </div>

                          {/* 日付 */}
                          <div className="flex items-center gap-1 text-[11px] font-bold text-[#888888]">
                            <Calendar className="w-3 h-3" />
                            <span>{report.formattedDate}</span>
                          </div>
                        </div>

                        {/* Delete/Resolve Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1.5 rounded-lg text-[#AFAFAF] hover:text-[#FF4B4B] hover:bg-[#FFF0F0] transition-colors cursor-pointer shrink-0"
                          title="この報告を解決済みとして削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content: 内容 */}
                      <div className="pt-2.5">
                        <div className="text-[11px] font-black text-[#777777] mb-1">
                          内容 (100文字以内):
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E5E5E5] text-xs sm:text-sm font-bold text-[#3C3C3C] leading-relaxed whitespace-pre-wrap select-text">
                          {report.content}
                        </div>
                        
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-[#AFAFAF]">
                          <span>ID: {report.id}</span>
                          <span>文字数: {report.content.length}/100</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: Learners List & Ban Release Management           */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            
            {/* Active Ban Banner (if current client is banned) */}
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

            {/* Users Overview & Filter */}
            <div className="bg-[#F7F7F7] p-3.5 sm:p-4 rounded-2xl border-2 border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#4B4B4B] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#1CB0F6]" />
                  <span>受講生一覧 (全 {allUsersList.length}名)</span>
                </label>
                <span className="text-[11px] font-bold text-[#58CC02] bg-white px-2 py-0.5 rounded-lg border border-[#58CC02]">
                  オンライン: {allUsersList.filter((u) => u.isOnline).length}名
                </span>
              </div>

              {/* Filter Categories */}
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
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="受講生名、ID、状態で絞り込み検索..."
                  className="w-full pl-9 pr-8 py-2 bg-white border-2 border-[#E5E5E5] focus:border-[#1CB0F6] rounded-xl text-xs font-bold text-[#3C3C3C] outline-hidden placeholder:text-[#AFAFAF]"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-2.5 top-2 text-xs font-bold text-[#AFAFAF] hover:text-[#3C3C3C] p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Users Cards List */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 border-2 border-[#E5E5E5] bg-white rounded-xl p-2">
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

              {selectedUserId && (
                <div className="p-3 bg-[#FFF9E6] border border-[#FFD966] rounded-xl flex items-center justify-between">
                  <div className="text-xs font-bold text-[#A57800]">
                    選択中のユーザーID: <span className="font-mono">{selectedUserId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audio.playTap();
                      removeFirebaseBan(selectedUserId);
                      showToast(`ID: ${selectedUserId} のBAN解除を試行しました。`);
                    }}
                    className="px-3 py-1 bg-white border border-[#FFD966] text-[#A57800] hover:bg-[#A57800] hover:text-white rounded-lg text-xs font-black cursor-pointer transition-all"
                  >
                    個別BAN解除
                  </button>
                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

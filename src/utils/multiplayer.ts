import { io as socketIOClient, Socket } from 'socket.io-client';
import { 
  OnlineUserPresence, 
  RankedMatchSession, 
  RankTier,
  LobbyUser
} from '../types';

export interface PartyInfo {
  partyId: string;
  leaderId: string;
  players: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    rating: number;
    rankTier: RankTier;
  }[];
  createdAt: number;
}

export type RealtimeEvent =
  | { type: 'PRESENCE_SNAPSHOT'; onlineUsers: OnlineUserPresence[]; todayUsers: OnlineUserPresence[] }
  | { type: 'LOBBY_USERS_UPDATED'; lobbyUsers: LobbyUser[] }
  | { type: 'QUEUE_STATUS'; queue1v1Count: number; queue2v2Count: number }
  | { type: 'RANKED_MATCH_FOUND'; matchId: string; session: RankedMatchSession }
  | {
      type: 'RANKED_PROGRESS_UPDATE';
      matchId: string;
      match: RankedMatchSession;
      playerId: string;
      progress: number;
      score: number;
      mistakes: number;
      lives?: number;
      isKO?: boolean;
      finished: boolean;
    }
  | {
      type: 'RANKED_MATCH_FINISHED';
      matchId: string;
      match: RankedMatchSession;
      winnerSide?: string;
      winnerIds?: string[];
    }
  | {
      type: 'RANKED_FORFEIT_OCCURRED';
      matchId: string;
      forfeitedPlayerId: string;
      match: RankedMatchSession;
      winnerIds?: string[];
    }
  | { type: 'PARTY_UPDATED'; party: PartyInfo | null }
  | { 
      type: 'REWARDS_LIKES_UPDATED'; 
      likes: number; 
      currentCode: string; 
      nextCode: string; 
      nextThreshold: number; 
      remainingLikes: number; 
      bonusNum: number; 
    }
  | { type: 'CONNECTION_STATUS'; connected: boolean; broker: string }
  | { type: 'ERROR'; message: string };

type EventListener = (event: RealtimeEvent) => void;

class RealtimePresenceAndRankedService {
  private listeners: Set<EventListener> = new Set();
  private isConnected: boolean = false;
  private isServerAvailable: boolean = false;

  private currentUserId: string = '';
  private currentUserName: string = '';
  private currentAvatarUrl: string | null = null;
  private currentRating: number = 0;
  private currentRankTier: RankTier = 'bronze';

  private onlineUsers: OnlineUserPresence[] = [];
  private todayUsers: OnlineUserPresence[] = [];
  private activeMatchId: string | null = null;

  private eventSource: EventSource | null = null;
  private wsServer: WebSocket | null = null;
  private heartbeatTimer: any = null;
  private pollTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private localQueuedState: { mode: '1vs1' | '2vs2'; roomCode: string | null } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.loadCachedRealPresence();
      this.checkServerAvailability();
    }
  }

  private loadCachedRealPresence() {
    try {
      const raw = localStorage.getItem('uolingo_real_today_users_cache_v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          // Filter out any users with 'bot' in id or name
          const valid = list.filter(
            (u: OnlineUserPresence) => u.id && !u.id.toLowerCase().includes('bot') && !u.name.toLowerCase().includes('bot')
          );
          this.todayUsers = valid;
          // Note: onlineUsers must strictly come from live server/tab presence, NEVER stale local cache
          this.onlineUsers = [];
        }
      }
    } catch {
      // Ignore
    }
  }

  private saveCachedRealPresence() {
    try {
      const valid = this.todayUsers.filter(
        (u) => u.id && !u.id.toLowerCase().includes('bot') && !u.name.toLowerCase().includes('bot')
      );
      localStorage.setItem('uolingo_real_today_users_cache_v1', JSON.stringify(valid));
    } catch {
      // Ignore
    }
  }

  private async checkServerAvailability() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/presence/members', { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        this.isServerAvailable = true;
        this.initServerSentEvents();
        this.initNativeWebSocket();
        this.startHeartbeatLoop();
        this.startPollingLoop();
        this.notifyStatus(true, 'Online Server');
      } else {
        this.isServerAvailable = false;
        this.notifyStatus(true, 'Peer & Tab Network');
      }
    } catch {
      this.isServerAvailable = false;
      this.notifyStatus(true, 'Peer & Tab Network');
    }
  }

  // ==========================================
  // 1. Server-Sent Events (SSE) Stream
  // ==========================================
  private initServerSentEvents() {
    if (!this.isServerAvailable || typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      const sse = new EventSource('/api/events');

      sse.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true, 'Cloud Server SSE');
      };

      sse.onmessage = (e) => {
        if (!e.data || e.data === ': ping') return;
        try {
          const data = JSON.parse(e.data);
          this.handleIncomingServerEvent(data);
        } catch {
          // Ignore
        }
      };

      sse.onerror = () => {
        sse.close();
        this.eventSource = null;
      };

      this.eventSource = sse;
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // 2. Native WebSocket Connection
  // ==========================================
  private initNativeWebSocket() {
    if (!this.isServerAvailable || typeof window === 'undefined' || !window.location || !window.location.host) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.wsServer = ws;
        this.isConnected = true;
        this.notifyStatus(true, 'Server WebSocket');
        if (this.currentUserId) {
          ws.send(JSON.stringify({ type: 'IDENTIFY', playerId: this.currentUserId, name: this.currentUserName }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingServerEvent(data);
        } catch {
          // Ignore
        }
      };

      ws.onclose = () => {
        this.wsServer = null;
      };

      ws.onerror = () => {
        // Ignored
      };
    } catch {
      // Ignored
    }
  }

  // ==========================================
  // 3. Tab-to-Tab BroadcastChannel
  // ==========================================
  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('uolingo_ranked_sync_v1');
        this.broadcastChannel.onmessage = (e) => {
          if (!e.data) return;
          const data = e.data;

          // Tab Presence Sync
          if (data.type === 'TAB_HEARTBEAT') {
            if (data.user && data.user.id !== this.currentUserId) {
              this.handleRemoteUserHeartbeat(data.user);
            }
            return;
          }

          // Tab Queue Matching
          if (data.type === 'TAB_QUEUE_REQUEST') {
            this.handleIncomingTabQueue(data);
            return;
          }

          if (data.type === 'TAB_QUEUE_CANCEL') {
            // Cancelled
            return;
          }

          this.handleIncomingServerEvent(data, false);
        };
      }
    } catch {
      // Ignored
    }
  }

  private handleRemoteUserHeartbeat(remote: OnlineUserPresence) {
    if (!remote.id || remote.id.includes('bot')) return;
    const now = Date.now();
    const existingOnline = this.onlineUsers.findIndex((u) => u.id === remote.id);
    if (existingOnline >= 0) {
      this.onlineUsers[existingOnline] = { ...remote, lastActive: now, isOnline: true };
    } else {
      this.onlineUsers.push({ ...remote, lastActive: now, isOnline: true });
    }

    const existingToday = this.todayUsers.findIndex((u) => u.id === remote.id);
    if (existingToday >= 0) {
      this.todayUsers[existingToday] = { ...remote, lastActive: now, isOnline: true };
    } else {
      this.todayUsers.push({ ...remote, lastActive: now, isOnline: true });
    }

    this.saveCachedRealPresence();
    this.emitEvent({
      type: 'PRESENCE_SNAPSHOT',
      onlineUsers: this.onlineUsers,
      todayUsers: this.todayUsers,
    });
  }

  private handleIncomingTabQueue(data: any) {
    if (!this.localQueuedState) return;
    if (data.player.id === this.currentUserId) return;

    // Check if mode and roomCode match
    const modeMatch = this.localQueuedState.mode === data.mode;
    const myCode = (this.localQueuedState.roomCode || '').trim().toUpperCase();
    const otherCode = (data.roomCode || '').trim().toUpperCase();
    const codeMatch = myCode === otherCode;

    if (modeMatch && codeMatch) {
      // Tie-breaker to ensure only one tab generates the session
      if (this.currentUserId > data.player.id) {
        const matchId = `match_${Date.now()}_tab`;
        const session: RankedMatchSession = {
          matchId,
          mode: this.localQueuedState.mode,
          status: 'countdown',
          seed: Math.floor(Math.random() * 100000),
          createdAt: Date.now(),
          players: [
            {
              id: this.currentUserId,
              name: this.currentUserName,
              avatarUrl: this.currentAvatarUrl,
              rating: this.currentRating,
              rankTier: this.currentRankTier,
              progress: 0,
              score: 0,
              mistakes: 0,
              lives: 3,
              isKO: false,
              finished: false,
            },
            {
              id: data.player.id,
              name: data.player.name,
              avatarUrl: data.player.avatarUrl,
              rating: data.player.rating,
              rankTier: data.player.rankTier,
              progress: 0,
              score: 0,
              mistakes: 0,
              lives: 3,
              isKO: false,
              finished: false,
            },
          ],
        };

        this.localQueuedState = null;
        this.handleIncomingServerEvent(
          {
            type: 'RANKED_MATCH_FOUND',
            matchId,
            session,
          },
          true
        );
      }
    }
  }

  // ==========================================
  // 4. Periodic Heartbeat (Every 10s)
  // ==========================================
  private startHeartbeatLoop() {
    if (!this.isServerAvailable) return;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 10000);
  }

  // ==========================================
  // 5. Polling Loop (Every 2.5s for guaranteed match/presence)
  // ==========================================
  private startPollingLoop() {
    if (!this.isServerAvailable) return;
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(() => {
      this.fetchPresence();

      if (this.activeMatchId) {
        this.fetchActiveMatch(this.activeMatchId);
      }
    }, 2500);
  }

  public async sendHeartbeat() {
    if (!this.isServerAvailable || !this.currentUserId || !this.currentUserName) return;

    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.currentUserId,
          name: this.currentUserName,
          avatarUrl: this.currentAvatarUrl,
          rating: this.currentRating,
          rankTier: this.currentRankTier,
        }),
      });
    } catch {
      // Ignore
    }
  }

  public async fetchPresence() {
    if (!this.isServerAvailable) return;
    try {
      const res = await fetch('/api/presence/members');
      if (res.ok) {
        const data = await res.json();
        this.onlineUsers = data.onlineUsers || [];
        this.todayUsers = data.todayUsers || [];
        this.emitEvent({
          type: 'PRESENCE_SNAPSHOT',
          onlineUsers: this.onlineUsers,
          todayUsers: this.todayUsers,
        });
      }
    } catch {
      // Ignore
    }
  }

  private async fetchActiveMatch(matchId: string) {
    try {
      const res = await fetch(`/api/ranked/matches/${matchId}`);
      if (res.ok) {
        const match: RankedMatchSession = await res.json();
        this.handleIncomingServerEvent({
          type: 'RANKED_PROGRESS_UPDATE',
          matchId: match.matchId,
          match,
          playerId: '',
          progress: 0,
          score: 0,
          mistakes: 0,
          finished: match.status === 'finished',
        }, false);
      }
    } catch {
      // Ignore
    }
  }

  private handleIncomingServerEvent(data: any, broadcastToTabs = true) {
    if (!data || !data.type) return;

    if (broadcastToTabs && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(data);
      } catch {
        // Ignore
      }
    }

    switch (data.type) {
      case 'PRESENCE_SNAPSHOT': {
        this.onlineUsers = data.onlineUsers || [];
        this.todayUsers = data.todayUsers || [];
        this.emitEvent(data);
        break;
      }

      case 'LOBBY_SNAPSHOT':
      case 'LOBBY_USERS_UPDATED': {
        this.emitEvent({
          type: 'LOBBY_USERS_UPDATED',
          lobbyUsers: data.lobbyUsers || [],
        });
        break;
      }

      case 'QUEUE_STATUS':
      case 'RANKED_MATCH_FOUND':
      case 'RANKED_PROGRESS_UPDATE':
      case 'RANKED_MATCH_FINISHED':
      case 'RANKED_FORFEIT_OCCURRED':
      case 'PARTY_UPDATED':
      case 'ERROR': {
        this.emitEvent(data);
        break;
      }
    }
  }

  private emitEvent(event: RealtimeEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in realtime event listener:', err);
      }
    });
  }

  private notifyStatus(connected: boolean, broker: string) {
    this.emitEvent({ type: 'CONNECTION_STATUS', connected, broker });
  }

  // ==========================================
  // Public Client API
  // ==========================================
  public subscribe(callback: EventListener): () => void {
    this.listeners.add(callback);
    // Send immediate presence snapshot
    callback({
      type: 'PRESENCE_SNAPSHOT',
      onlineUsers: this.onlineUsers,
      todayUsers: this.todayUsers,
    });
    this.notifyStatus(this.isConnected, 'Online Server');

    return () => {
      this.listeners.delete(callback);
    };
  }

  public identify(
    playerId: string,
    name: string,
    avatarUrl: string | null = null,
    rating: number = 0,
    rankTier: RankTier = 'bronze'
  ) {
    this.currentUserId = playerId;
    this.currentUserName = name;
    this.currentAvatarUrl = avatarUrl;
    this.currentRating = rating;
    this.currentRankTier = rankTier;

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const me: OnlineUserPresence = {
      id: playerId,
      name,
      avatarUrl,
      rating,
      rankTier,
      lastActive: now,
      isOnline: true,
      lastLoginDate: todayStr,
    };

    const onlineIdx = this.onlineUsers.findIndex((u) => u.id === playerId);
    if (onlineIdx >= 0) {
      this.onlineUsers[onlineIdx] = me;
    } else {
      this.onlineUsers.unshift(me);
    }

    const todayIdx = this.todayUsers.findIndex((u) => u.id === playerId);
    if (todayIdx >= 0) {
      this.todayUsers[todayIdx] = me;
    } else {
      this.todayUsers.unshift(me);
    }

    this.saveCachedRealPresence();
    this.emitEvent({
      type: 'PRESENCE_SNAPSHOT',
      onlineUsers: this.onlineUsers,
      todayUsers: this.todayUsers,
    });

    // Notify other tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'TAB_HEARTBEAT',
          user: me,
        });
      } catch {
        // Ignore
      }
    }

    this.sendHeartbeat();

    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      try {
        this.wsServer.send(JSON.stringify({ type: 'IDENTIFY', playerId, name }));
      } catch {
        // Ignore
      }
    }
  }

  public getOnlineUsers(): OnlineUserPresence[] {
    return this.onlineUsers;
  }

  public getTodayUsers(): OnlineUserPresence[] {
    return this.todayUsers;
  }

  public setActiveMatchId(matchId: string | null) {
    this.activeMatchId = matchId;
  }

  // Matchmaking
  public async queueRanked(mode: '1vs1' | '2vs2', partyId?: string, roomCode?: string) {
    const playerObj = {
      id: this.currentUserId,
      name: this.currentUserName,
      avatarUrl: this.currentAvatarUrl,
      rating: this.currentRating,
      rankTier: this.currentRankTier,
    };

    this.localQueuedState = {
      mode,
      roomCode: roomCode ? String(roomCode).trim().toUpperCase() : null,
    };

    // Broadcast queue to other browser tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'TAB_QUEUE_REQUEST',
          player: playerObj,
          mode,
          roomCode: this.localQueuedState.roomCode,
          partyId: partyId || null,
        });
      } catch {
        // Ignore
      }
    }

    if (!this.isServerAvailable) {
      return { ok: true, offlineFallback: true };
    }

    try {
      const res = await fetch('/api/ranked/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerObj,
          mode,
          partyId,
          roomCode: this.localQueuedState.roomCode,
        }),
      });
      return await res.json();
    } catch (err) {
      console.error('Error queuing for ranked:', err);
    }
  }

  public async cancelQueue() {
    this.localQueuedState = null;

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'TAB_QUEUE_CANCEL',
          playerId: this.currentUserId,
        });
      } catch {
        // Ignore
      }
    }

    if (!this.isServerAvailable) return;
    try {
      await fetch('/api/ranked/cancel-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.currentUserId }),
      });
    } catch {
      // Ignore
    }
  }

  public async sendMatchProgress(
    matchId: string,
    progress: number,
    score: number,
    mistakes: number,
    lives: number,
    isKO: boolean,
    finished: boolean
  ) {
    // Broadcast progress across tabs immediately
    if (this.broadcastChannel) {
      try {
        const dummyMatch: any = {
          matchId,
          players: [
            {
              id: this.currentUserId,
              name: this.currentUserName,
              avatarUrl: this.currentAvatarUrl,
              rating: this.currentRating,
              rankTier: this.currentRankTier,
              progress,
              score,
              mistakes,
              lives,
              isKO,
              finished,
            },
          ],
        };
        this.broadcastChannel.postMessage({
          type: 'RANKED_PROGRESS_UPDATE',
          matchId,
          match: dummyMatch,
          playerId: this.currentUserId,
          progress,
          score,
          mistakes,
          lives,
          isKO,
          finished,
        });
      } catch {
        // Ignore
      }
    }

    if (!this.isServerAvailable) return;
    try {
      await fetch('/api/ranked/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          playerId: this.currentUserId,
          progress,
          score,
          mistakes,
          lives,
          isKO,
          finished,
        }),
      });
    } catch {
      // Ignore
    }
  }

  public async forfeitMatch(matchId: string) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'RANKED_FORFEIT_OCCURRED',
          matchId,
          forfeitedPlayerId: this.currentUserId,
          match: { matchId, players: [] } as any,
        });
      } catch {
        // Ignore
      }
    }

    if (!this.isServerAvailable) return;
    try {
      await fetch('/api/ranked/forfeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          playerId: this.currentUserId,
        }),
      });
    } catch {
      // Ignore
    }
  }

  // Party Methods
  public async createParty(): Promise<PartyInfo | null> {
    if (!this.isServerAvailable) return null;
    try {
      const res = await fetch('/api/parties/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leader: {
            id: this.currentUserId,
            name: this.currentUserName,
            avatarUrl: this.currentAvatarUrl,
            rating: this.currentRating,
            rankTier: this.currentRankTier,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.party;
      }
    } catch (err) {
      console.error('Error creating party:', err);
    }
    return null;
  }

  public async joinParty(partyId: string): Promise<PartyInfo | null> {
    if (!this.isServerAvailable) return null;
    try {
      const res = await fetch('/api/parties/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId,
          player: {
            id: this.currentUserId,
            name: this.currentUserName,
            avatarUrl: this.currentAvatarUrl,
            rating: this.currentRating,
            rankTier: this.currentRankTier,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.party;
      }
    } catch (err) {
      console.error('Error joining party:', err);
    }
    return null;
  }

  public async leaveParty(partyId: string) {
    if (!this.isServerAvailable) return;
    try {
      await fetch('/api/parties/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId,
          playerId: this.currentUserId,
        }),
      });
    } catch {
      // Ignore
    }
  }
}

export const realtimePresence = new RealtimePresenceAndRankedService();

// ==========================================
// Socket.io Lobby Manager ("誰が今ロビーにいるか")
// ==========================================
export class LobbySocketManager {
  private socket: Socket | null = null;
  private listeners: Set<(users: LobbyUser[]) => void> = new Set();
  private currentUsers: LobbyUser[] = [];
  private isInLobby = false;
  private currentUserData: { userId: string; name: string; avatarUrl?: string | null } | null = null;
  private currentStatusData: { status: 'idle' | 'in_queue' | 'in_match'; mode?: '1vs1' | '2vs2'; roomCode?: string | null } = { status: 'idle' };

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    if (typeof window === 'undefined') return;
    try {
      this.socket = socketIOClient({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        if (this.isInLobby && this.currentUserData) {
          this.socket?.emit('lobby:join', this.currentUserData);
          if (this.currentStatusData.status !== 'idle') {
            this.socket?.emit('lobby:status', this.currentStatusData);
          }
        }
      });

      this.socket.on('lobby:users', (users: LobbyUser[]) => {
        // Exclude test bots or artificial members to guarantee 100% real players
        this.currentUsers = (users || []).filter(
          (u) =>
            u.userId &&
            !u.userId.startsWith('member_') &&
            !u.userId.toLowerCase().includes('bot') &&
            !u.name.toLowerCase().includes('bot')
        );
        this.notifyListeners();
      });

      this.socket.on('disconnect', () => {
        // Will auto reconnect
      });
    } catch (err) {
      console.warn('Socket.io client initialization error:', err);
    }
  }

  public joinLobby(user: { userId: string; name: string; avatarUrl?: string | null }) {
    this.isInLobby = true;
    this.currentUserData = user;
    if (this.socket && this.socket.connected) {
      this.socket.emit('lobby:join', user);
    } else if (this.socket) {
      this.socket.connect();
    }
    // Also fetch initial list via REST just in case
    this.fetchLobbyUsers();
  }

  public updateStatus(status: 'idle' | 'in_queue' | 'in_match', mode?: '1vs1' | '2vs2', roomCode?: string | null) {
    this.currentStatusData = { status, mode, roomCode };
    if (this.socket && this.socket.connected) {
      this.socket.emit('lobby:status', this.currentStatusData);
    }
  }

  public leaveLobby() {
    this.isInLobby = false;
    this.currentStatusData = { status: 'idle' };
    if (this.socket && this.socket.connected) {
      this.socket.emit('lobby:leave');
    }
  }

  public async fetchLobbyUsers(): Promise<LobbyUser[]> {
    try {
      const res = await fetch('/api/lobby/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.lobbyUsers)) {
          this.currentUsers = data.lobbyUsers.filter(
            (u: LobbyUser) =>
              u.userId &&
              !u.userId.startsWith('member_') &&
              !u.userId.toLowerCase().includes('bot') &&
              !u.name.toLowerCase().includes('bot')
          );
          this.notifyListeners();
        }
      }
    } catch {
      // Ignore
    }
    return this.currentUsers;
  }

  public subscribe(callback: (users: LobbyUser[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUsers);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getUsers(): LobbyUser[] {
    return this.currentUsers;
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentUsers);
      } catch (err) {
        console.error('Lobby listener error:', err);
      }
    });
  }
}

export const lobbySocket = new LobbySocketManager();


import { 
  OnlineUserPresence, 
  RankedMatchSession, 
  RankTier 
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

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.seedLocalPresence();
      this.checkServerAvailability();
    }
  }

  private seedLocalPresence() {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultOnline: OnlineUserPresence[] = [
      { id: 'u_bot_1', name: 'サクラ', avatarUrl: null, rating: 280, rankTier: 'bronze', lastActive: Date.now() - 30000, isOnline: true, lastLoginDate: todayStr },
      { id: 'u_bot_2', name: 'ケンタ', avatarUrl: null, rating: 520, rankTier: 'silver', lastActive: Date.now() - 60000, isOnline: true, lastLoginDate: todayStr },
      { id: 'u_bot_3', name: 'エマ', avatarUrl: null, rating: 890, rankTier: 'gold', lastActive: Date.now() - 120000, isOnline: true, lastLoginDate: todayStr },
    ];
    this.onlineUsers = defaultOnline;
    this.todayUsers = [...defaultOnline];
  }

  private async checkServerAvailability() {
    // Only attempt server backend if running on Cloud Run or local dev server
    if (typeof window !== 'undefined') {
      const isBackendHost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.hostname.includes('run.app');
      if (!isBackendHost) {
        this.isServerAvailable = false;
        this.notifyStatus(true, 'Local Offline & Peer Network');
        return;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('/api/presence/members', { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        this.isServerAvailable = true;
        this.initServerSentEvents();
        this.initNativeWebSocket();
        this.startHeartbeatLoop();
        this.startPollingLoop();
      } else {
        this.isServerAvailable = false;
        this.notifyStatus(true, 'Standalone Mode');
      }
    } catch {
      this.isServerAvailable = false;
      this.notifyStatus(true, 'Standalone Mode');
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
          if (e.data) {
            this.handleIncomingServerEvent(e.data, false);
          }
        };
      }
    } catch {
      // Ignored
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
  public async queueRanked(mode: '1vs1' | '2vs2', partyId?: string) {
    if (!this.isServerAvailable) {
      return { ok: true, offlineFallback: true };
    }
    try {
      const res = await fetch('/api/ranked/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: {
            id: this.currentUserId,
            name: this.currentUserName,
            avatarUrl: this.currentAvatarUrl,
            rating: this.currentRating,
            rankTier: this.currentRankTier,
          },
          mode,
          partyId,
        }),
      });
      return await res.json();
    } catch (err) {
      console.error('Error queuing for ranked:', err);
    }
  }

  public async cancelQueue() {
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

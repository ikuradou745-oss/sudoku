import { BattleRoom, RoomPlayer, Modifier } from '../types';

export type MultiplayerEvent =
  | { type: 'ROOMS_LIST'; rooms: BattleRoom[] }
  | { type: 'ROOM_CREATED'; room: BattleRoom }
  | { type: 'ROOM_UPDATED'; room: BattleRoom }
  | { type: 'ROOM_DELETED'; roomId: string }
  | { type: 'KICKED_FROM_ROOM'; roomId: string; targetPlayerId?: string }
  | { type: 'COUNTDOWN_STARTED'; room: BattleRoom }
  | {
      type: 'LIVE_PROGRESS_UPDATE';
      roomId: string;
      playerId: string;
      progress: number;
      score: number;
      mistakes: number;
      lives?: number;
      isKO?: boolean;
      finished: boolean;
      players?: RoomPlayer[];
    }
  | {
      type: 'MATCH_CLEARED_BY_WINNER';
      roomId: string;
      winnerId: string;
      winnerName: string;
      winnerScore: number;
    }
  | { type: 'CONNECTION_STATUS'; connected: boolean; broker: string }
  | { type: 'ERROR'; message: string };

type EventListener = (event: MultiplayerEvent) => void;

class RealtimeMultiplayerService {
  private listeners: Set<EventListener> = new Set();
  private isConnected: boolean = false;

  private currentUserId: string = '';
  private currentUserName: string = '';
  private activeRoomId: string | null = null;

  // Active rooms known to this client
  private knownRooms: Map<string, BattleRoom> = new Map();

  private eventSource: EventSource | null = null;
  private wsServer: WebSocket | null = null;
  private pollTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.initServerSentEvents();
      this.initNativeWebSocket();
      this.startPollingLoop();
    }
  }

  // ==========================================
  // 1. Server-Sent Events (SSE) Stream
  // ==========================================
  private initServerSentEvents() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

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
        // SSE reconnects automatically
      };

      this.eventSource = sse;
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // 2. Native WebSocket Fallback / Duplex
  // ==========================================
  private initNativeWebSocket() {
    if (typeof window === 'undefined' || !window.location || !window.location.host) return;

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
        ws.send(JSON.stringify({ type: 'GET_ROOMS' }));
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
        // Retry WebSocket connection after 4 seconds
        setTimeout(() => this.initNativeWebSocket(), 4000);
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
        this.broadcastChannel = new BroadcastChannel('uolingo_battle_sync_v4');
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
  // 4. Guaranteed HTTP Polling Loop (every 600ms)
  // ==========================================
  private startPollingLoop() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(() => {
      this.fetchRooms();

      // If in an active room, also directly poll the specific room's authoritative status
      if (this.activeRoomId) {
        this.fetchActiveRoomDetails(this.activeRoomId);
      }
    }, 600);
  }

  private async fetchActiveRoomDetails(roomId: string) {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.ok) {
        const room: BattleRoom = await res.json();
        this.mergeRoom(room);
        this.handleIncomingServerEvent({ type: 'ROOM_UPDATED', room }, false);
      }
    } catch {
      // Ignore
    }
  }

  private mergeRoom(room: BattleRoom) {
    if (!room || !room.id) return;
    this.knownRooms.set(room.id, room);
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
      case 'ROOMS_LIST': {
        if (Array.isArray(data.rooms)) {
          this.knownRooms.clear();
          data.rooms.forEach((r: BattleRoom) => this.knownRooms.set(r.id, r));
          this.emitEvent({ type: 'ROOMS_LIST', rooms: data.rooms });
        }
        break;
      }

      case 'ROOM_CREATED': {
        if (data.room) {
          this.mergeRoom(data.room);
          this.emitEvent({ type: 'ROOM_CREATED', room: data.room });
          this.emitRoomsList();
        }
        break;
      }

      case 'ROOM_UPDATED': {
        if (data.room) {
          this.mergeRoom(data.room);
          this.emitEvent({ type: 'ROOM_UPDATED', room: data.room });
          this.emitRoomsList();
        }
        break;
      }

      case 'KICKED_FROM_ROOM': {
        if (data.targetPlayerId && this.currentUserId && data.targetPlayerId !== this.currentUserId) {
          // Another player was kicked
          break;
        }
        this.emitEvent({ type: 'KICKED_FROM_ROOM', roomId: data.roomId, targetPlayerId: data.targetPlayerId });
        break;
      }

      case 'COUNTDOWN_STARTED': {
        if (data.room) {
          this.mergeRoom(data.room);
          this.emitEvent({ type: 'COUNTDOWN_STARTED', room: data.room });
        }
        break;
      }

      case 'LIVE_PROGRESS_UPDATE':
      case 'MATCH_CLEARED_BY_WINNER':
      case 'ERROR': {
        this.emitEvent(data);
        break;
      }
    }
  }

  private emitEvent(event: MultiplayerEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in multiplayer event listener:', err);
      }
    });
  }

  private emitRoomsList() {
    const list = Array.from(this.knownRooms.values()).filter(
      (r) => r.status === 'waiting' || (r.players.length > 0 && r.status !== 'finished')
    );
    this.emitEvent({ type: 'ROOMS_LIST', rooms: list });
  }

  private notifyStatus(connected: boolean, broker: string) {
    this.emitEvent({ type: 'CONNECTION_STATUS', connected, broker });
  }

  // ==========================================
  // Public API Methods
  // ==========================================
  public subscribe(callback: EventListener): () => void {
    this.listeners.add(callback);
    // Send immediate snapshot
    this.emitRoomsList();
    this.notifyStatus(this.isConnected, 'Online Server');

    return () => {
      this.listeners.delete(callback);
    };
  }

  public identify(playerId: string, name: string) {
    this.currentUserId = playerId;
    this.currentUserName = name;
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      try {
        this.wsServer.send(JSON.stringify({ type: 'IDENTIFY', playerId, name }));
      } catch {
        // Ignore
      }
    }
  }

  public async fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const rooms: BattleRoom[] = await res.json();
        this.knownRooms.clear();
        rooms.forEach((r) => this.knownRooms.set(r.id, r));
        this.emitRoomsList();
      }
    } catch {
      // Ignore
    }
  }

  public createRoom(
    name: string,
    maxPlayers: number,
    modifiers: Modifier[],
    leaderPlayer: RoomPlayer
  ): BattleRoom {
    const localId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempRoom: BattleRoom = {
      id: localId,
      name: (name || `${leaderPlayer.name}の部屋`).trim(),
      leaderId: leaderPlayer.id,
      maxPlayers: Math.max(2, Math.min(8, maxPlayers || 4)),
      modifiers: (modifiers || []).filter((m) => m.active),
      players: [{ ...leaderPlayer, isLeader: true, isReady: true, progress: 0, score: 0, mistakes: 0, lives: 3, isKO: false }],
      status: 'waiting',
      createdAt: Date.now(),
      seed: Math.floor(Math.random() * 100000),
    };

    this.activeRoomId = localId;
    this.mergeRoom(tempRoom);
    this.handleIncomingServerEvent({ type: 'ROOM_CREATED', room: tempRoom });

    // Send HTTP POST to server
    fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        maxPlayers,
        modifiers,
        leaderPlayer,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.room) {
          this.activeRoomId = data.room.id;
          this.mergeRoom(data.room);
          this.handleIncomingServerEvent({ type: 'ROOM_CREATED', room: data.room });
        }
      })
      .catch((err) => {
        console.error('Error creating room on server:', err);
      });

    return tempRoom;
  }

  public async joinRoom(roomId: string, player: RoomPlayer) {
    this.activeRoomId = roomId;

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          this.mergeRoom(data.room);
          this.handleIncomingServerEvent({ type: 'ROOM_UPDATED', room: data.room });
        }
      } else {
        const errData = await res.json().catch(() => ({ error: '参加に失敗しました' }));
        this.emitEvent({ type: 'ERROR', message: errData.error || '部屋に参加できませんでした' });
      }
    } catch (err) {
      console.error('Error joining room:', err);
    }
  }

  public async leaveRoom(roomId: string, playerId: string) {
    if (this.activeRoomId === roomId) {
      this.activeRoomId = null;
    }

    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
    } catch {
      // Ignore
    }
  }

  public async kickPlayer(roomId: string, targetPlayerId: string) {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlayerId }),
      });
    } catch {
      // Ignore
    }
  }

  public async startCountdown(roomId: string) {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/countdown`, {
        method: 'POST',
      });
    } catch {
      // Ignore
    }
  }

  public async sendProgress(
    roomId: string,
    playerId: string,
    progress: number,
    score: number,
    mistakes: number,
    finished: boolean,
    lives?: number,
    isKO?: boolean
  ) {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          progress,
          score,
          mistakes,
          finished,
          lives,
          isKO,
        }),
      });
    } catch {
      // Ignore
    }
  }

  public async declareWinnerClear(
    roomId: string,
    winnerId: string,
    winnerName: string,
    winnerScore: number
  ) {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/declare-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId,
          winnerName,
          winnerScore,
        }),
      });
    } catch {
      // Ignore
    }
  }
}

export const realtimeMultiplayer = new RealtimeMultiplayerService();

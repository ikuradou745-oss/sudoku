import { BattleRoom, RoomPlayer, Modifier } from '../types';

export type MultiplayerEvent =
  | { type: 'ROOMS_LIST'; rooms: BattleRoom[] }
  | { type: 'ROOM_CREATED'; room: BattleRoom }
  | { type: 'ROOM_UPDATED'; room: BattleRoom }
  | { type: 'KICKED_FROM_ROOM'; roomId: string }
  | { type: 'COUNTDOWN_STARTED'; room: BattleRoom }
  | {
      type: 'LIVE_PROGRESS_UPDATE';
      roomId: string;
      playerId: string;
      progress: number;
      score: number;
      mistakes: number;
      finished: boolean;
      players?: RoomPlayer[];
    }
  | { type: 'ERROR'; message: string };

type EventListener = (event: MultiplayerEvent) => void;

class RealtimeMultiplayerService {
  private ws: WebSocket | null = null;
  private listeners: Set<EventListener> = new Set();
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;
  private currentUserId: string = '';
  private currentUserName: string = '';
  private fallbackChannel: BroadcastChannel | null = null;
  private fallbackRooms: Map<string, BattleRoom> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.fallbackChannel = new BroadcastChannel('uolingo_multiplayer_channel');
        this.fallbackChannel.onmessage = (event) => {
          this.handleIncomingEvent(event.data);
        };
      } catch {
        // Fallback channel not supported in some older environments
      }
      this.initFallbackDemoRooms();
      this.connect();
    }
  }

  private initFallbackDemoRooms() {
    this.fallbackRooms.set('room_novice_public', {
      id: 'room_novice_public',
      name: '初心者歓迎！公開ルーム',
      leaderId: 'bot_leader',
      maxPlayers: 4,
      modifiers: [],
      seed: 1024,
      status: 'waiting',
      players: [
        {
          id: 'bot_leader',
          name: 'うおリンゴ案内人🤖',
          avatarUrl: null,
          isLeader: true,
          isReady: true,
          isBot: true,
          progress: 0,
          score: 0,
          mistakes: 0,
        },
      ],
      createdAt: Date.now(),
    });
  }

  private handleIncomingEvent(event: MultiplayerEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.debug('Error in listener', e);
      }
    });
  }

  public connect() {
    if (typeof window === 'undefined' || this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    // Do not attempt WS connect if on static GitHub Pages domain to avoid console errors
    if (window.location.hostname.endsWith('github.io')) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        if (this.currentUserId) {
          this.identify(this.currentUserId, this.currentUserName);
        }
        this.fetchRooms();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as MultiplayerEvent;
          this.handleIncomingEvent(parsed);
        } catch (err) {
          console.debug('Failed to parse WS message', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      return;
    }
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  public subscribe(callback: EventListener) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return;
    }

    // Static / Offline fallback handling
    this.handleLocalFallback(data);
  }

  private handleLocalFallback(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'GET_ROOMS') {
      const rooms = Array.from(this.fallbackRooms.values());
      this.handleIncomingEvent({ type: 'ROOMS_LIST', rooms });
      return;
    }

    if (data.type === 'CREATE_ROOM') {
      const newRoom: BattleRoom = {
        id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name || '対戦ルーム',
        leaderId: data.leaderPlayer.id,
        maxPlayers: data.maxPlayers || 4,
        modifiers: data.modifiers || [],
        seed: Math.floor(Math.random() * 10000),
        status: 'waiting',
        players: [data.leaderPlayer],
        createdAt: Date.now(),
      };
      this.fallbackRooms.set(newRoom.id, newRoom);
      this.handleIncomingEvent({ type: 'ROOM_CREATED', room: newRoom });
      this.fallbackChannel?.postMessage({ type: 'ROOM_CREATED', room: newRoom });
      return;
    }

    if (data.type === 'JOIN_ROOM') {
      const room = this.fallbackRooms.get(data.roomId);
      if (room) {
        if (!room.players.some((p) => p.id === data.player.id)) {
          room.players.push(data.player);
        }
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: { ...room } });
        this.fallbackChannel?.postMessage({ type: 'ROOM_UPDATED', room: { ...room } });
      }
      return;
    }

    if (data.type === 'LEAVE_ROOM') {
      const room = this.fallbackRooms.get(data.roomId);
      if (room) {
        room.players = room.players.filter((p) => p.id !== data.playerId);
        if (room.players.length > 0 && room.leaderId === data.playerId) {
          room.leaderId = room.players[0].id;
        }
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: { ...room } });
        this.fallbackChannel?.postMessage({ type: 'ROOM_UPDATED', room: { ...room } });
      }
      return;
    }

    if (data.type === 'KICK_PLAYER') {
      const room = this.fallbackRooms.get(data.roomId);
      if (room) {
        room.players = room.players.filter((p) => p.id !== data.targetPlayerId);
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: { ...room } });
        this.handleIncomingEvent({ type: 'KICKED_FROM_ROOM', roomId: data.roomId });
        this.fallbackChannel?.postMessage({ type: 'ROOM_UPDATED', room: { ...room } });
        this.fallbackChannel?.postMessage({ type: 'KICKED_FROM_ROOM', roomId: data.roomId });
      }
      return;
    }

    if (data.type === 'START_COUNTDOWN') {
      const room = this.fallbackRooms.get(data.roomId);
      if (room) {
        room.status = 'in_game';
        this.handleIncomingEvent({ type: 'COUNTDOWN_STARTED', room: { ...room } });
        this.fallbackChannel?.postMessage({ type: 'COUNTDOWN_STARTED', room: { ...room } });
      }
      return;
    }

    if (data.type === 'PROGRESS_UPDATE') {
      const payload: MultiplayerEvent = {
        type: 'LIVE_PROGRESS_UPDATE',
        roomId: data.roomId,
        playerId: data.playerId,
        progress: data.progress,
        score: data.score,
        mistakes: data.mistakes,
        finished: data.finished,
      };
      this.handleIncomingEvent(payload);
      this.fallbackChannel?.postMessage(payload);
    }
  }

  public identify(playerId: string, name: string) {
    this.currentUserId = playerId;
    this.currentUserName = name;
    this.send({ type: 'IDENTIFY', playerId, name });
  }

  public fetchRooms() {
    this.send({ type: 'GET_ROOMS' });
  }

  public createRoom(
    name: string,
    maxPlayers: number,
    modifiers: Modifier[],
    leaderPlayer: RoomPlayer
  ) {
    this.send({
      type: 'CREATE_ROOM',
      name,
      maxPlayers,
      modifiers,
      leaderPlayer,
    });
  }

  public joinRoom(roomId: string, player: RoomPlayer) {
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      player,
    });
  }

  public leaveRoom(roomId: string, playerId: string) {
    this.send({
      type: 'LEAVE_ROOM',
      roomId,
      playerId,
    });
  }

  public kickPlayer(roomId: string, targetPlayerId: string) {
    this.send({
      type: 'KICK_PLAYER',
      roomId,
      targetPlayerId,
    });
  }

  public startCountdown(roomId: string) {
    this.send({
      type: 'START_COUNTDOWN',
      roomId,
    });
  }

  public sendProgress(
    roomId: string,
    playerId: string,
    progress: number,
    score: number,
    mistakes: number,
    finished: boolean
  ) {
    this.send({
      type: 'PROGRESS_UPDATE',
      roomId,
      playerId,
      progress,
      score,
      mistakes,
      finished,
    });
  }
}

export const realtimeMultiplayer = new RealtimeMultiplayerService();

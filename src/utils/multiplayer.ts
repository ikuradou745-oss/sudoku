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

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public connect() {
    if (typeof window === 'undefined' || this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
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
          this.listeners.forEach((listener) => {
            try {
              listener(parsed);
            } catch (e) {
              console.debug('Error in listener', e);
            }
          });
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
    } else {
      // Reconnect if needed
      this.connect();
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

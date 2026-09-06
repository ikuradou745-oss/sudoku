import mqtt, { MqttClient } from 'mqtt';
import { BattleRoom, RoomPlayer, Modifier } from '../types';

export type MultiplayerEvent =
  | { type: 'ROOMS_LIST'; rooms: BattleRoom[] }
  | { type: 'ROOM_CREATED'; room: BattleRoom }
  | { type: 'ROOM_UPDATED'; room: BattleRoom }
  | { type: 'ROOM_DELETED'; roomId: string }
  | { type: 'KICKED_FROM_ROOM'; roomId: string }
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
  | { type: 'CONNECTION_STATUS'; connected: boolean; broker: string }
  | { type: 'ERROR'; message: string };

type EventListener = (event: MultiplayerEvent) => void;

// Public ultra-reliable WSS MQTT brokers for real-time web apps
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

const TOPIC_PREFIX = 'uolingo_app/v1';
const ANNOUNCE_TOPIC = `${TOPIC_PREFIX}/rooms/announce`;
const DISCOVERY_TOPIC = `${TOPIC_PREFIX}/rooms/discovery`;
const ROOM_EVENT_TOPIC = (roomId: string) => `${TOPIC_PREFIX}/room/${roomId}/events`;
const ROOM_PROGRESS_TOPIC = (roomId: string) => `${TOPIC_PREFIX}/room/${roomId}/progress`;

const STORAGE_ROOMS_KEY = 'uolingo_cached_rooms_v1';

class RealtimeMultiplayerService {
  private client: MqttClient | null = null;
  private listeners: Set<EventListener> = new Set();
  private currentBrokerIndex: number = 0;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;

  private currentUserId: string = '';
  private activeRoomId: string | null = null;

  // Active known rooms (synced across network & heartbeats)
  private knownRooms: Map<string, { room: BattleRoom; lastSeen: number }> = new Map();
  // Rooms created locally by this client that we are responsible for announcing
  private myHostedRooms: Map<string, BattleRoom> = new Map();

  private heartbeatTimer: any = null;
  private cleanupTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.loadCachedRooms();
      this.initDemoRooms();
      this.startCleanupLoop();
      this.connect();
    }
  }

  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('uolingo_local_sync');
        this.broadcastChannel.onmessage = (e) => {
          if (e.data) {
            this.handleIncomingEvent(e.data);
          }
        };
      }
    } catch {
      // Ignored if unsupported
    }
  }

  private loadCachedRooms() {
    try {
      const raw = localStorage.getItem(STORAGE_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BattleRoom[];
        const now = Date.now();
        parsed.forEach((r) => {
          // Keep recently cached rooms
          if (now - r.createdAt < 1000 * 60 * 10) {
            this.knownRooms.set(r.id, { room: r, lastSeen: now });
          }
        });
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveCachedRooms() {
    try {
      const rooms = this.getActiveRoomsList();
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch {
      // Ignore storage errors
    }
  }

  private initDemoRooms() {
    const demoRoomId = 'room_public_guide';
    if (!this.knownRooms.has(demoRoomId)) {
      const guideRoom: BattleRoom = {
        id: demoRoomId,
        name: '初心者歓迎！公開ルーム',
        leaderId: 'bot_guide_leader',
        maxPlayers: 4,
        modifiers: [],
        seed: 7777,
        status: 'waiting',
        players: [
          {
            id: 'bot_guide_leader',
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
      };
      this.knownRooms.set(demoRoomId, { room: guideRoom, lastSeen: Date.now() + 1000 * 60 * 60 * 24 });
    }
  }

  public connect() {
    if (typeof window === 'undefined' || this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    const brokerUrl = MQTT_BROKERS[this.currentBrokerIndex % MQTT_BROKERS.length];

    try {
      const clientId = `uolingo_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 4000,
        keepalive: 30,
      });

      this.client = client;

      client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.notifyStatus(true, brokerUrl);

        // Subscribe to global room announcements & discoveries
        client.subscribe([ANNOUNCE_TOPIC, DISCOVERY_TOPIC], { qos: 0 }, (err) => {
          if (!err) {
            // Ask existing hosts to announce their active rooms
            this.publish(DISCOVERY_TOPIC, { type: 'DISCOVERY_REQUEST', from: clientId });
          }
        });

        // If in an active room, resubscribe to that room
        if (this.activeRoomId) {
          this.subscribeToRoom(this.activeRoomId);
        }

        // Start heartbeat to keep hosted rooms alive
        this.startHeartbeatLoop();
        this.emitRoomsList();
      });

      client.on('message', (topic, payload) => {
        try {
          const parsed = JSON.parse(payload.toString());
          this.handleNetworkMessage(topic, parsed);
        } catch (e) {
          console.debug('Failed to parse incoming MQTT message', e);
        }
      });

      client.on('error', () => {
        this.isConnected = false;
        this.isConnecting = false;
      });

      client.on('close', () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyStatus(false, brokerUrl);
      });
    } catch {
      this.isConnected = false;
      this.isConnecting = false;
      this.tryNextBroker();
    }
  }

  private tryNextBroker() {
    this.currentBrokerIndex++;
    setTimeout(() => {
      this.connect();
    }, 2000);
  }

  private notifyStatus(connected: boolean, broker: string) {
    this.handleIncomingEvent({
      type: 'CONNECTION_STATUS',
      connected,
      broker,
    });
  }

  private publish(topic: string, data: any) {
    if (this.client && this.isConnected) {
      try {
        this.client.publish(topic, JSON.stringify(data), { qos: 0 });
      } catch (e) {
        console.debug('Failed to publish MQTT message', e);
      }
    }
  }

  private subscribeToRoom(roomId: string) {
    if (!this.client || !this.isConnected) return;
    this.client.subscribe([ROOM_EVENT_TOPIC(roomId), ROOM_PROGRESS_TOPIC(roomId)], { qos: 0 });
  }

  private unsubscribeFromRoom(roomId: string) {
    if (!this.client || !this.isConnected) return;
    this.client.unsubscribe([ROOM_EVENT_TOPIC(roomId), ROOM_PROGRESS_TOPIC(roomId)]);
  }

  private handleNetworkMessage(topic: string, data: any) {
    if (!data || !data.type) return;

    // 1. Room announcements from any player across the world
    if (topic === ANNOUNCE_TOPIC) {
      if (data.type === 'ROOM_ANNOUNCE' && data.room) {
        const room = data.room as BattleRoom;
        this.knownRooms.set(room.id, { room, lastSeen: Date.now() });
        this.saveCachedRooms();
        this.emitRoomsList();

        // If this matches our active room, update it
        if (this.activeRoomId === room.id) {
          this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
        }
      } else if (data.type === 'ROOM_CLOSED' && data.roomId) {
        this.knownRooms.delete(data.roomId);
        this.saveCachedRooms();
        this.emitRoomsList();
      }
      return;
    }

    // 2. Someone entered lobby and requested a list of active rooms
    if (topic === DISCOVERY_TOPIC) {
      if (data.type === 'DISCOVERY_REQUEST') {
        // If we are hosting any rooms, announce them immediately
        this.myHostedRooms.forEach((room) => {
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
        });
      }
      return;
    }

    // 3. Room-specific events (joins, kicks, start countdown, updates)
    if (topic.includes('/room/')) {
      if (data.type === 'ROOM_UPDATED' && data.room) {
        const room = data.room as BattleRoom;
        this.knownRooms.set(room.id, { room, lastSeen: Date.now() });
        this.saveCachedRooms();
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
        return;
      }

      if (data.type === 'JOIN_REQUEST' && data.roomId && data.player) {
        // If I am the host of this room, handle joining and broadcast new state
        const hosted = this.myHostedRooms.get(data.roomId);
        if (hosted) {
          if (!hosted.players.some((p) => p.id === data.player.id)) {
            if (hosted.players.length < hosted.maxPlayers) {
              hosted.players.push(data.player);
              this.myHostedRooms.set(hosted.id, { ...hosted });
              this.knownRooms.set(hosted.id, { room: { ...hosted }, lastSeen: Date.now() });
              this.broadcastRoomUpdate(hosted);
            }
          }
        }
        return;
      }

      if (data.type === 'LEAVE_REQUEST' && data.roomId && data.playerId) {
        const hosted = this.myHostedRooms.get(data.roomId);
        if (hosted) {
          hosted.players = hosted.players.filter((p) => p.id !== data.playerId);
          if (hosted.players.length > 0 && hosted.leaderId === data.playerId) {
            hosted.leaderId = hosted.players[0].id;
          }
          this.myHostedRooms.set(hosted.id, { ...hosted });
          this.knownRooms.set(hosted.id, { room: { ...hosted }, lastSeen: Date.now() });
          this.broadcastRoomUpdate(hosted);
        }
        return;
      }

      if (data.type === 'KICK_REQUEST' && data.roomId && data.targetPlayerId) {
        if (data.targetPlayerId === this.currentUserId) {
          this.handleIncomingEvent({ type: 'KICKED_FROM_ROOM', roomId: data.roomId });
        }
        return;
      }

      if (data.type === 'COUNTDOWN_STARTED' && data.room) {
        const room = data.room as BattleRoom;
        this.knownRooms.set(room.id, { room, lastSeen: Date.now() });
        this.handleIncomingEvent({ type: 'COUNTDOWN_STARTED', room });
        return;
      }

      if (data.type === 'LIVE_PROGRESS_UPDATE') {
        this.handleIncomingEvent(data as MultiplayerEvent);
        return;
      }
    }
  }

  private broadcastRoomUpdate(room: BattleRoom) {
    const payload: MultiplayerEvent = { type: 'ROOM_UPDATED', room };
    this.publish(ROOM_EVENT_TOPIC(room.id), payload);
    this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
    this.handleIncomingEvent(payload);
  }

  private startHeartbeatLoop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.myHostedRooms.size > 0) {
        this.myHostedRooms.forEach((room) => {
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
        });
      }
    }, 2500);
  }

  private startCleanupLoop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.knownRooms.forEach((item, id) => {
        // Do not purge the permanent demo guide room
        if (id === 'room_public_guide') return;

        // If no heartbeat for > 15 seconds, consider the room closed
        if (now - item.lastSeen > 15000 && !this.myHostedRooms.has(id)) {
          this.knownRooms.delete(id);
          changed = true;
        }
      });

      if (changed) {
        this.saveCachedRooms();
        this.emitRoomsList();
      }
    }, 4000);
  }

  private getActiveRoomsList(): BattleRoom[] {
    return Array.from(this.knownRooms.values()).map((item) => item.room);
  }

  private emitRoomsList() {
    const rooms = this.getActiveRoomsList();
    this.handleIncomingEvent({ type: 'ROOMS_LIST', rooms });
  }

  private handleIncomingEvent(event: MultiplayerEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.debug('Error in multiplayer event listener', e);
      }
    });

    // Also sync to other tabs on same device
    try {
      this.broadcastChannel?.postMessage(event);
    } catch {
      // Ignore
    }
  }

  public subscribe(callback: EventListener) {
    this.listeners.add(callback);
    // Send current cached rooms immediately to the new subscriber
    callback({ type: 'ROOMS_LIST', rooms: this.getActiveRoomsList() });
    return () => {
      this.listeners.delete(callback);
    };
  }

  public identify(playerId: string, _name: string) {
    this.currentUserId = playerId;
  }

  public fetchRooms() {
    if (this.client && this.isConnected) {
      this.publish(DISCOVERY_TOPIC, { type: 'DISCOVERY_REQUEST' });
    }
    this.emitRoomsList();
  }

  public createRoom(
    name: string,
    maxPlayers: number,
    modifiers: Modifier[],
    leaderPlayer: RoomPlayer
  ): BattleRoom {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const roomId = `room_${code}_${Date.now().toString(36)}`;

    const newRoom: BattleRoom = {
      id: roomId,
      name: name || `英語バトル部屋 #${code}`,
      leaderId: leaderPlayer.id,
      maxPlayers: maxPlayers || 4,
      modifiers: modifiers || [],
      seed: Math.floor(Math.random() * 100000) + 1,
      status: 'waiting',
      players: [leaderPlayer],
      createdAt: Date.now(),
    };

    this.activeRoomId = roomId;
    this.myHostedRooms.set(roomId, newRoom);
    this.knownRooms.set(roomId, { room: newRoom, lastSeen: Date.now() });
    this.saveCachedRooms();

    // Subscribe to this room's MQTT topic
    this.subscribeToRoom(roomId);

    // Broadcast announcement globally
    this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room: newRoom });

    // Notify local UI
    this.handleIncomingEvent({ type: 'ROOM_CREATED', room: newRoom });
    this.emitRoomsList();

    return newRoom;
  }

  public joinRoom(roomId: string, player: RoomPlayer) {
    this.activeRoomId = roomId;
    this.subscribeToRoom(roomId);

    // If I'm the host, update locally
    const hosted = this.myHostedRooms.get(roomId);
    if (hosted) {
      if (!hosted.players.some((p) => p.id === player.id)) {
        hosted.players.push(player);
        this.broadcastRoomUpdate(hosted);
      }
      return;
    }

    // Otherwise send join request to room host
    const known = this.knownRooms.get(roomId);
    if (known) {
      if (!known.room.players.some((p) => p.id === player.id)) {
        known.room.players.push(player);
        this.knownRooms.set(roomId, { room: { ...known.room }, lastSeen: Date.now() });
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: { ...known.room } });
      }
    }

    this.publish(ROOM_EVENT_TOPIC(roomId), {
      type: 'JOIN_REQUEST',
      roomId,
      player,
    });
  }

  public leaveRoom(roomId: string, playerId: string) {
    if (this.myHostedRooms.has(roomId)) {
      const room = this.myHostedRooms.get(roomId)!;
      room.players = room.players.filter((p) => p.id !== playerId);

      if (room.players.length === 0 || room.leaderId === playerId) {
        // Room closed
        this.myHostedRooms.delete(roomId);
        this.knownRooms.delete(roomId);
        this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_CLOSED', roomId });
      } else {
        this.broadcastRoomUpdate(room);
      }
    } else {
      this.publish(ROOM_EVENT_TOPIC(roomId), {
        type: 'LEAVE_REQUEST',
        roomId,
        playerId,
      });
    }

    this.unsubscribeFromRoom(roomId);
    if (this.activeRoomId === roomId) {
      this.activeRoomId = null;
    }
    this.emitRoomsList();
  }

  public kickPlayer(roomId: string, targetPlayerId: string) {
    const hosted = this.myHostedRooms.get(roomId);
    if (hosted) {
      hosted.players = hosted.players.filter((p) => p.id !== targetPlayerId);
      this.broadcastRoomUpdate(hosted);

      this.publish(ROOM_EVENT_TOPIC(roomId), {
        type: 'KICK_REQUEST',
        roomId,
        targetPlayerId,
      });
    }
  }

  public startCountdown(roomId: string) {
    const known = this.knownRooms.get(roomId)?.room || this.myHostedRooms.get(roomId);
    if (known) {
      const updated: BattleRoom = { ...known, status: 'in_game' };
      this.knownRooms.set(roomId, { room: updated, lastSeen: Date.now() });
      if (this.myHostedRooms.has(roomId)) {
        this.myHostedRooms.set(roomId, updated);
      }

      const payload: MultiplayerEvent = { type: 'COUNTDOWN_STARTED', room: updated };
      this.publish(ROOM_EVENT_TOPIC(roomId), payload);
      this.handleIncomingEvent(payload);
    }
  }

  public sendProgress(
    roomId: string,
    playerId: string,
    progress: number,
    score: number,
    mistakes: number,
    finished: boolean,
    lives?: number,
    isKO?: boolean
  ) {
    const payload: MultiplayerEvent = {
      type: 'LIVE_PROGRESS_UPDATE',
      roomId,
      playerId,
      progress,
      score,
      mistakes,
      lives: lives !== undefined ? lives : 3,
      isKO: !!isKO,
      finished,
    };

    this.publish(ROOM_PROGRESS_TOPIC(roomId), payload);
    this.handleIncomingEvent(payload);
  }
}

export const realtimeMultiplayer = new RealtimeMultiplayerService();

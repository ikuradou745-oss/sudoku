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

// Public ultra-reliable WSS MQTT brokers for real-time web apps
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

const TOPIC_PREFIX = 'uolingo_app/v2';
const ANNOUNCE_TOPIC = `${TOPIC_PREFIX}/rooms/announce`;
const DISCOVERY_TOPIC = `${TOPIC_PREFIX}/rooms/discovery`;
const ROOM_EVENT_TOPIC = (roomId: string) => `${TOPIC_PREFIX}/room/${roomId}/events`;
const ROOM_PROGRESS_TOPIC = (roomId: string) => `${TOPIC_PREFIX}/room/${roomId}/progress`;

const STORAGE_ROOMS_KEY = 'uolingo_cached_rooms_v2';

class RealtimeMultiplayerService {
  private client: MqttClient | null = null;
  private wsServer: WebSocket | null = null;
  private listeners: Set<EventListener> = new Set();
  private currentBrokerIndex: number = 0;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;

  private currentUserId: string = '';
  private currentUserName: string = '';
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
      this.tryConnectNativeWs();
      this.connect();
    }
  }

  private tryConnectNativeWs() {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          this.wsServer = ws;
          this.isConnected = true;
          this.notifyStatus(true, 'Native App Server (WebSocket)');
          if (this.currentUserId) {
            ws.send(JSON.stringify({ type: 'IDENTIFY', playerId: this.currentUserId, name: this.currentUserName }));
          }
          ws.send(JSON.stringify({ type: 'GET_ROOMS' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ROOMS_LIST' && Array.isArray(data.rooms)) {
              data.rooms.forEach((r: BattleRoom) => {
                this.knownRooms.set(r.id, { room: r, lastSeen: Date.now() });
                if (this.activeRoomId === r.id) {
                  this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: r });
                }
              });
              this.saveCachedRooms();
              this.emitRoomsList();
            } else if (data.type === 'ROOM_UPDATED' && data.room) {
              this.knownRooms.set(data.room.id, { room: data.room, lastSeen: Date.now() });
              this.saveCachedRooms();
              this.handleIncomingEvent(data);
              this.emitRoomsList();
            } else {
              this.handleIncomingEvent(data);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          // Native WS not available (e.g. running on GitHub Pages static host), MQTT will handle it
        };

        ws.onclose = () => {
          this.wsServer = null;
        };
      }
    } catch {
      // Ignored
    }
  }

  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('uolingo_local_sync_v2');
        this.broadcastChannel.onmessage = (e) => {
          if (e.data) {
            const event = e.data as MultiplayerEvent;
            if (event.type === 'ROOM_UPDATED' && event.room) {
              this.knownRooms.set(event.room.id, { room: event.room, lastSeen: Date.now() });
              this.saveCachedRooms();
            }
            this.handleIncomingEvent(event);
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
          // Keep recently cached rooms (within 10 minutes)
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
        reconnectPeriod: 3000,
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
    }, 1500);
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

        // If this matches our active room, update member list immediately
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
        if (this.myHostedRooms.has(room.id)) {
          this.myHostedRooms.set(room.id, room);
        }
        this.saveCachedRooms();
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
        this.emitRoomsList();
        return;
      }

      if (data.type === 'JOIN_REQUEST' && data.roomId && data.player) {
        const roomEntry = this.knownRooms.get(data.roomId);
        const currentRoom = roomEntry ? roomEntry.room : this.myHostedRooms.get(data.roomId);

        if (currentRoom) {
          const isAlreadyIn = currentRoom.players.some((p) => p.id === data.player.id);
          if (!isAlreadyIn && currentRoom.players.length < currentRoom.maxPlayers) {
            const updatedRoom: BattleRoom = {
              ...currentRoom,
              players: [...currentRoom.players, data.player],
            };
            this.knownRooms.set(updatedRoom.id, { room: updatedRoom, lastSeen: Date.now() });
            if (this.myHostedRooms.has(updatedRoom.id)) {
              this.myHostedRooms.set(updatedRoom.id, updatedRoom);
            }
            this.saveCachedRooms();
            this.broadcastRoomUpdate(updatedRoom);
          }
        }
        return;
      }

      if (data.type === 'LEAVE_REQUEST' && data.roomId && data.playerId) {
        const roomEntry = this.knownRooms.get(data.roomId);
        const currentRoom = roomEntry ? roomEntry.room : this.myHostedRooms.get(data.roomId);

        if (currentRoom) {
          const nextPlayers = currentRoom.players.filter((p) => p.id !== data.playerId);
          if (nextPlayers.length === 0 && currentRoom.id !== 'room_public_guide') {
            this.myHostedRooms.delete(data.roomId);
            this.knownRooms.delete(data.roomId);
            this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_CLOSED', roomId: data.roomId });
          } else {
            let nextLeaderId = currentRoom.leaderId;
            if (currentRoom.leaderId === data.playerId && nextPlayers.length > 0) {
              nextLeaderId = nextPlayers[0].id;
              nextPlayers[0].isLeader = true;
            }
            const updatedRoom: BattleRoom = {
              ...currentRoom,
              leaderId: nextLeaderId,
              players: nextPlayers,
            };
            this.knownRooms.set(updatedRoom.id, { room: updatedRoom, lastSeen: Date.now() });
            if (this.myHostedRooms.has(updatedRoom.id)) {
              this.myHostedRooms.set(updatedRoom.id, updatedRoom);
            }
            this.saveCachedRooms();
            this.broadcastRoomUpdate(updatedRoom);
          }
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

      if (data.type === 'LIVE_PROGRESS_UPDATE' || data.type === 'MATCH_CLEARED_BY_WINNER') {
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
    this.emitRoomsList();
  }

  private startHeartbeatLoop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.myHostedRooms.size > 0) {
        this.myHostedRooms.forEach((room) => {
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
        });
      }
    }, 1200);
  }

  private startCleanupLoop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.knownRooms.forEach((item, id) => {
        if (id === 'room_public_guide') return;
        // Expire inactive rooms after 3 minutes if not hosted by me
        if (!this.myHostedRooms.has(id) && now - item.lastSeen > 1000 * 60 * 3) {
          this.knownRooms.delete(id);
          changed = true;
        }
      });

      if (changed) {
        this.saveCachedRooms();
        this.emitRoomsList();
      }
    }, 5000);
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

  public identify(playerId: string, name: string) {
    this.currentUserId = playerId;
    this.currentUserName = name;
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'IDENTIFY', playerId, name }));
    }
  }

  public fetchRooms() {
    if (this.client && this.isConnected) {
      this.publish(DISCOVERY_TOPIC, { type: 'DISCOVERY_REQUEST' });
    }
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'GET_ROOMS' }));
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
      players: [{ ...leaderPlayer, isLeader: true, isReady: true }],
      status: 'waiting',
      createdAt: Date.now(),
      seed: Math.floor(Math.random() * 100000),
    };

    this.activeRoomId = roomId;
    this.myHostedRooms.set(roomId, newRoom);
    this.knownRooms.set(roomId, { room: newRoom, lastSeen: Date.now() });
    this.saveCachedRooms();

    // Subscribe to this room's MQTT topic
    this.subscribeToRoom(roomId);

    // Broadcast announcement globally
    this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room: newRoom });

    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(
        JSON.stringify({
          type: 'CREATE_ROOM',
          name,
          maxPlayers,
          modifiers,
          leaderPlayer,
        })
      );
    }

    // Notify local UI
    this.handleIncomingEvent({ type: 'ROOM_CREATED', room: newRoom });
    this.emitRoomsList();

    return newRoom;
  }

  public joinRoom(roomId: string, player: RoomPlayer) {
    this.activeRoomId = roomId;
    this.subscribeToRoom(roomId);

    // If native WebSocket server is active, notify it
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'JOIN_ROOM', roomId, player }));
    }

    // Update local known room state immediately
    const knownEntry = this.knownRooms.get(roomId);
    const existingRoom = knownEntry ? knownEntry.room : this.myHostedRooms.get(roomId);

    if (existingRoom) {
      const players = existingRoom.players.filter((p) => p.id !== player.id);
      players.push(player);
      const updatedRoom: BattleRoom = { ...existingRoom, players };

      this.knownRooms.set(roomId, { room: updatedRoom, lastSeen: Date.now() });
      if (this.myHostedRooms.has(roomId)) {
        this.myHostedRooms.set(roomId, updatedRoom);
      }
      this.saveCachedRooms();
      this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updatedRoom });
      this.broadcastRoomUpdate(updatedRoom);
    }

    // Broadcast JOIN_REQUEST to network
    this.publish(ROOM_EVENT_TOPIC(roomId), {
      type: 'JOIN_REQUEST',
      roomId,
      player,
    });
    this.publish(ANNOUNCE_TOPIC, {
      type: 'ROOM_ANNOUNCE',
      room: existingRoom,
    });
  }

  public leaveRoom(roomId: string, playerId: string) {
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId, playerId }));
    }

    if (this.myHostedRooms.has(roomId)) {
      const room = this.myHostedRooms.get(roomId)!;
      room.players = room.players.filter((p) => p.id !== playerId);

      if (room.players.length === 0 || room.leaderId === playerId) {
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
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'KICK_PLAYER', roomId, targetPlayerId }));
    }

    const roomEntry = this.knownRooms.get(roomId);
    const hosted = this.myHostedRooms.get(roomId) || roomEntry?.room;
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
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'START_COUNTDOWN', roomId }));
    }

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
      lives,
      isKO,
      finished,
    };
    this.publish(ROOM_PROGRESS_TOPIC(roomId), payload);
    this.handleIncomingEvent(payload);
  }

  public declareWinnerClear(
    roomId: string,
    winnerId: string,
    winnerName: string,
    winnerScore: number
  ) {
    const payload: MultiplayerEvent = {
      type: 'MATCH_CLEARED_BY_WINNER',
      roomId,
      winnerId,
      winnerName,
      winnerScore,
    };
    this.publish(ROOM_PROGRESS_TOPIC(roomId), payload);
    this.handleIncomingEvent(payload);
  }
}

export const realtimeMultiplayer = new RealtimeMultiplayerService();

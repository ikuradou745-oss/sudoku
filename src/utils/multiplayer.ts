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

// Public WebSocket MQTT brokers (WSS - works seamlessly over HTTPS / GitHub Pages)
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

const TOPIC_PREFIX = 'uolingo_battle_v3';
const ALL_TOPICS = `${TOPIC_PREFIX}/#`;
const ANNOUNCE_TOPIC = `${TOPIC_PREFIX}/announce`;
const DISCOVERY_TOPIC = `${TOPIC_PREFIX}/discovery`;
const ROOM_TOPIC = (roomId: string) => `${TOPIC_PREFIX}/room/${roomId}`;

const STORAGE_ROOMS_KEY = 'uolingo_cached_rooms_v3';

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

  // Active rooms known to this client
  private knownRooms: Map<string, { room: BattleRoom; lastSeen: number }> = new Map();
  // Rooms created locally by this client (this client is the host)
  private myHostedRooms: Map<string, BattleRoom> = new Map();

  private heartbeatTimer: any = null;
  private cleanupTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.loadCachedRooms();
      this.startCleanupLoop();
      this.tryConnectNativeWs();
      this.connect();
    }
  }

  private tryConnectNativeWs() {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.host) {
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
                this.mergeRoom(r);
              });
              this.emitRoomsList();
            } else if (data.type === 'ROOM_UPDATED' && data.room) {
              this.mergeRoom(data.room);
              this.handleIncomingEvent(data);
              this.emitRoomsList();
            } else {
              this.handleIncomingEvent(data);
            }
          } catch {
            // Ignore
          }
        };

        ws.onerror = () => {
          // Fallback to MQTT
        };

        ws.onclose = () => {
          this.wsServer = null;
        };
      }
    } catch {
      // Ignore
    }
  }

  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('uolingo_battle_sync_v3');
        this.broadcastChannel.onmessage = (e) => {
          if (e.data) {
            const event = e.data as MultiplayerEvent;
            if (event.type === 'ROOM_UPDATED' && event.room) {
              this.mergeRoom(event.room);
            }
            this.handleIncomingEvent(event, false);
          }
        };
      }
    } catch {
      // Ignored
    }
  }

  private loadCachedRooms() {
    try {
      const raw = localStorage.getItem(STORAGE_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BattleRoom[];
        const now = Date.now();
        parsed.forEach((r) => {
          // Only keep rooms younger than 5 minutes
          if (now - r.createdAt < 1000 * 60 * 5) {
            this.knownRooms.set(r.id, { room: r, lastSeen: now });
          }
        });
      }
    } catch {
      // Ignore
    }
  }

  private saveCachedRooms() {
    try {
      const rooms = this.getActiveRoomsList();
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch {
      // Ignore
    }
  }

  private mergeRoom(room: BattleRoom) {
    if (!room || !room.id) return;
    this.knownRooms.set(room.id, { room, lastSeen: Date.now() });
    if (this.myHostedRooms.has(room.id)) {
      this.myHostedRooms.set(room.id, room);
    }
    this.saveCachedRooms();
  }

  public connect() {
    if (typeof window === 'undefined' || this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    const brokerUrl = MQTT_BROKERS[this.currentBrokerIndex % MQTT_BROKERS.length];

    try {
      const clientId = `uolingo_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 2500,
        keepalive: 20,
      });

      this.client = client;

      client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.notifyStatus(true, brokerUrl);

        // Subscribe to ALL topics in one wildcard to ensure NO messages are missed
        client.subscribe(ALL_TOPICS, { qos: 0 }, (err) => {
          if (!err) {
            // Ask any active room hosts to broadcast their rooms
            this.publish(DISCOVERY_TOPIC, { type: 'DISCOVERY_REQUEST', from: clientId });
          }
        });

        // Start heartbeat to keep hosted rooms alive
        this.startHeartbeatLoop();
        this.emitRoomsList();
      });

      client.on('message', (topic, payload) => {
        try {
          const parsed = JSON.parse(payload.toString());
          this.handleNetworkMessage(topic, parsed);
        } catch {
          // Ignore
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
      } catch {
        // Ignore
      }
    }
    // Also send to local broadcast channel
    try {
      this.broadcastChannel?.postMessage(data);
    } catch {
      // Ignore
    }
  }

  private handleNetworkMessage(_topic: string, data: any) {
    if (!data || !data.type) return;

    // 1. Room discovery request
    if (data.type === 'DISCOVERY_REQUEST') {
      // If we host rooms, announce them immediately
      this.myHostedRooms.forEach((room) => {
        this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
      });
      return;
    }

    // 2. Global room announcement
    if (data.type === 'ROOM_ANNOUNCE' && data.room) {
      const room = data.room as BattleRoom;
      this.mergeRoom(room);
      this.emitRoomsList();

      if (this.activeRoomId === room.id) {
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
      }
      return;
    }

    // 3. Room closed
    if (data.type === 'ROOM_CLOSED' && data.roomId) {
      this.knownRooms.delete(data.roomId);
      this.myHostedRooms.delete(data.roomId);
      this.saveCachedRooms();
      this.emitRoomsList();

      if (this.activeRoomId === data.roomId) {
        this.handleIncomingEvent({ type: 'KICKED_FROM_ROOM', roomId: data.roomId });
      }
      return;
    }

    // 4. Join Request from another player
    if (data.type === 'JOIN_REQUEST' && data.roomId && data.player) {
      const targetRoomId = data.roomId as string;
      const joiningPlayer = data.player as RoomPlayer;

      // If we are the host of this room, handle the join authoritatively
      if (this.myHostedRooms.has(targetRoomId)) {
        const currentRoom = this.myHostedRooms.get(targetRoomId)!;
        const exists = currentRoom.players.some((p) => p.id === joiningPlayer.id);

        if (!exists && currentRoom.players.length < currentRoom.maxPlayers) {
          const updatedRoom: BattleRoom = {
            ...currentRoom,
            players: [...currentRoom.players, { ...joiningPlayer, isLeader: false, isReady: true }],
          };
          this.myHostedRooms.set(targetRoomId, updatedRoom);
          this.mergeRoom(updatedRoom);

          // Broadcast updated room state to everyone
          this.publish(ROOM_TOPIC(targetRoomId), { type: 'ROOM_UPDATED', room: updatedRoom });
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room: updatedRoom });
          this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updatedRoom });
          this.emitRoomsList();
        }
      } else {
        // If not host, update local cache optimistically
        const entry = this.knownRooms.get(targetRoomId);
        if (entry) {
          const exists = entry.room.players.some((p) => p.id === joiningPlayer.id);
          if (!exists) {
            const updatedRoom: BattleRoom = {
              ...entry.room,
              players: [...entry.room.players, joiningPlayer],
            };
            this.mergeRoom(updatedRoom);
            if (this.activeRoomId === targetRoomId) {
              this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updatedRoom });
            }
            this.emitRoomsList();
          }
        }
      }
      return;
    }

    // 5. Leave Request
    if (data.type === 'LEAVE_REQUEST' && data.roomId && data.playerId) {
      const targetRoomId = data.roomId as string;
      const leavingId = data.playerId as string;

      if (this.myHostedRooms.has(targetRoomId)) {
        const currentRoom = this.myHostedRooms.get(targetRoomId)!;
        const nextPlayers = currentRoom.players.filter((p) => p.id !== leavingId);

        if (nextPlayers.length === 0 || currentRoom.leaderId === leavingId) {
          this.myHostedRooms.delete(targetRoomId);
          this.knownRooms.delete(targetRoomId);
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_CLOSED', roomId: targetRoomId });
          this.emitRoomsList();
        } else {
          const updatedRoom: BattleRoom = { ...currentRoom, players: nextPlayers };
          this.myHostedRooms.set(targetRoomId, updatedRoom);
          this.mergeRoom(updatedRoom);

          this.publish(ROOM_TOPIC(targetRoomId), { type: 'ROOM_UPDATED', room: updatedRoom });
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room: updatedRoom });
          this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updatedRoom });
          this.emitRoomsList();
        }
      } else {
        const entry = this.knownRooms.get(targetRoomId);
        if (entry) {
          const nextPlayers = entry.room.players.filter((p) => p.id !== leavingId);
          const updatedRoom = { ...entry.room, players: nextPlayers };
          this.mergeRoom(updatedRoom);
          if (this.activeRoomId === targetRoomId) {
            this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updatedRoom });
          }
          this.emitRoomsList();
        }
      }
      return;
    }

    // 6. Direct Room Updated Broadcast
    if (data.type === 'ROOM_UPDATED' && data.room) {
      const room = data.room as BattleRoom;
      this.mergeRoom(room);
      if (this.activeRoomId === room.id) {
        this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
      }
      this.emitRoomsList();
      return;
    }

    // 7. Kick Request
    if (data.type === 'KICK_REQUEST' && data.roomId && data.targetPlayerId) {
      if (data.targetPlayerId === this.currentUserId) {
        this.activeRoomId = null;
        this.handleIncomingEvent({ type: 'KICKED_FROM_ROOM', roomId: data.roomId });
      }
      return;
    }

    // 8. Countdown Started
    if (data.type === 'COUNTDOWN_STARTED' && data.room) {
      const room = data.room as BattleRoom;
      this.mergeRoom(room);
      if (this.activeRoomId === room.id) {
        this.handleIncomingEvent({ type: 'COUNTDOWN_STARTED', room });
      }
      return;
    }

    // 9. Live In-Game Progress & Match Winner Clear
    if (data.type === 'LIVE_PROGRESS_UPDATE' || data.type === 'MATCH_CLEARED_BY_WINNER') {
      this.handleIncomingEvent(data as MultiplayerEvent);
      return;
    }
  }

  private startHeartbeatLoop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.myHostedRooms.size > 0) {
        this.myHostedRooms.forEach((room) => {
          this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
        });
      }
    }, 1000);
  }

  private startCleanupLoop() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.knownRooms.forEach((item, id) => {
        // Expire inactive rooms after 90 seconds if not hosted by me
        if (!this.myHostedRooms.has(id) && now - item.lastSeen > 1000 * 90) {
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

  public getActiveRoomsList(): BattleRoom[] {
    return Array.from(this.knownRooms.values()).map((item) => item.room);
  }

  private emitRoomsList() {
    const rooms = this.getActiveRoomsList();
    this.handleIncomingEvent({ type: 'ROOMS_LIST', rooms });
  }

  private handleIncomingEvent(event: MultiplayerEvent, broadcastLocal = true) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.debug('Listener error', e);
      }
    });

    if (broadcastLocal) {
      try {
        this.broadcastChannel?.postMessage(event);
      } catch {
        // Ignore
      }
    }
  }

  public subscribe(callback: EventListener) {
    this.listeners.add(callback);
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
    this.publish(DISCOVERY_TOPIC, { type: 'DISCOVERY_REQUEST' });
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
    this.mergeRoom(newRoom);

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

    this.handleIncomingEvent({ type: 'ROOM_CREATED', room: newRoom });
    this.emitRoomsList();

    return newRoom;
  }

  public joinRoom(roomId: string, player: RoomPlayer) {
    this.activeRoomId = roomId;

    // Broadcast JOIN_REQUEST to room and announce channel
    this.publish(ROOM_TOPIC(roomId), {
      type: 'JOIN_REQUEST',
      roomId,
      player: { ...player, isLeader: false, isReady: true },
    });
    this.publish(ANNOUNCE_TOPIC, {
      type: 'JOIN_REQUEST',
      roomId,
      player: { ...player, isLeader: false, isReady: true },
    });

    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'JOIN_ROOM', roomId, player }));
    }

    // Optimistically update local room
    const entry = this.knownRooms.get(roomId);
    if (entry) {
      const players = entry.room.players.filter((p) => p.id !== player.id);
      players.push({ ...player, isLeader: false, isReady: true });
      const updated = { ...entry.room, players };
      this.mergeRoom(updated);
      this.handleIncomingEvent({ type: 'ROOM_UPDATED', room: updated });
      this.emitRoomsList();
    }
  }

  public leaveRoom(roomId: string, playerId: string) {
    this.publish(ROOM_TOPIC(roomId), {
      type: 'LEAVE_REQUEST',
      roomId,
      playerId,
    });
    this.publish(ANNOUNCE_TOPIC, {
      type: 'LEAVE_REQUEST',
      roomId,
      playerId,
    });

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
        this.mergeRoom(room);
        this.publish(ROOM_TOPIC(roomId), { type: 'ROOM_UPDATED', room });
        this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
      }
    }

    if (this.activeRoomId === roomId) {
      this.activeRoomId = null;
    }
    this.emitRoomsList();
  }

  public kickPlayer(roomId: string, targetPlayerId: string) {
    this.publish(ROOM_TOPIC(roomId), {
      type: 'KICK_REQUEST',
      roomId,
      targetPlayerId,
    });

    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'KICK_PLAYER', roomId, targetPlayerId }));
    }

    if (this.myHostedRooms.has(roomId)) {
      const room = this.myHostedRooms.get(roomId)!;
      room.players = room.players.filter((p) => p.id !== targetPlayerId);
      this.myHostedRooms.set(roomId, room);
      this.mergeRoom(room);
      this.publish(ROOM_TOPIC(roomId), { type: 'ROOM_UPDATED', room });
      this.publish(ANNOUNCE_TOPIC, { type: 'ROOM_ANNOUNCE', room });
      this.handleIncomingEvent({ type: 'ROOM_UPDATED', room });
      this.emitRoomsList();
    }
  }

  public startCountdown(roomId: string) {
    if (this.wsServer && this.wsServer.readyState === WebSocket.OPEN) {
      this.wsServer.send(JSON.stringify({ type: 'START_COUNTDOWN', roomId }));
    }

    const room = this.myHostedRooms.get(roomId) || this.knownRooms.get(roomId)?.room;
    if (room) {
      const updated: BattleRoom = { ...room, status: 'in_game' };
      this.mergeRoom(updated);

      const payload: MultiplayerEvent = { type: 'COUNTDOWN_STARTED', room: updated };
      this.publish(ROOM_TOPIC(roomId), payload);
      this.publish(ANNOUNCE_TOPIC, payload);
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
    this.publish(`${TOPIC_PREFIX}/progress/${roomId}`, payload);
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
    this.publish(`${TOPIC_PREFIX}/progress/${roomId}`, payload);
    this.handleIncomingEvent(payload);
  }
}

export const realtimeMultiplayer = new RealtimeMultiplayerService();

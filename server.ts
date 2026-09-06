import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface RoomPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isLeader: boolean;
  isReady: boolean;
  isBot?: boolean;
  progress?: number;
  score?: number;
  mistakes?: number;
  finished?: boolean;
  finishTime?: number;
}

interface Modifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  bonusPercent: number;
  active: boolean;
}

interface BattleRoom {
  id: string;
  name: string;
  leaderId: string;
  maxPlayers: number;
  players: RoomPlayer[];
  modifiers: Modifier[];
  status: 'waiting' | 'countdown' | 'in_game' | 'finished';
  createdAt: number;
  seed: number;
}

// In-Memory Server Room Storage
const rooms = new Map<string, BattleRoom>();
// Client Connection Context
const clientMeta = new Map<WebSocket, { playerId: string; roomId: string | null; name: string }>();

// Initial Public Room
const defaultRoom: BattleRoom = {
  id: 'room_novice_public',
  name: '⚡️ 初心者歓迎！オンライン対戦部屋',
  leaderId: 'system_host',
  maxPlayers: 6,
  players: [],
  modifiers: [
    {
      id: 'speedRush',
      name: 'スピードラッシュ',
      description: '回答速度に応じてさらにボーナス！',
      icon: '⚡️',
      bonusPercent: 30,
      active: true,
    }
  ],
  status: 'waiting',
  createdAt: Date.now(),
  seed: 12345,
};
rooms.set(defaultRoom.id, defaultRoom);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', onlinePlayers: clientMeta.size, activeRooms: rooms.size });
  });

  app.get('/api/rooms', (req, res) => {
    const list = Array.from(rooms.values()).filter(
      (r) => r.status === 'waiting' || r.players.length > 0
    );
    res.json(list);
  });

  // Real-time WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastToAll(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function broadcastToRoom(roomId: string, data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const meta = clientMeta.get(client);
      if (client.readyState === WebSocket.OPEN && meta?.roomId === roomId) {
        client.send(message);
      }
    });
  }

  function sendToPlayer(playerId: string, data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const meta = clientMeta.get(client);
      if (client.readyState === WebSocket.OPEN && meta?.playerId === playerId) {
        client.send(message);
      }
    });
  }

  function getRoomsList(): BattleRoom[] {
    return Array.from(rooms.values()).filter(
      (r) => r.status === 'waiting' || (r.players.length > 0 && r.status !== 'finished')
    );
  }

  wss.on('connection', (ws) => {
    clientMeta.set(ws, { playerId: '', roomId: null, name: '' });

    // Send initial rooms list on connect
    ws.send(JSON.stringify({ type: 'ROOMS_LIST', rooms: getRoomsList() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clientMeta.get(ws);

        switch (msg.type) {
          case 'IDENTIFY': {
            if (meta) {
              meta.playerId = msg.playerId || `user_${Date.now()}`;
              meta.name = msg.name || '会員';
            }
            break;
          }

          case 'GET_ROOMS': {
            ws.send(JSON.stringify({ type: 'ROOMS_LIST', rooms: getRoomsList() }));
            break;
          }

          case 'CREATE_ROOM': {
            const { name, maxPlayers, modifiers, leaderPlayer } = msg;
            const newRoom: BattleRoom = {
              id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: (name || `${leaderPlayer.name}の部屋`).trim(),
              leaderId: leaderPlayer.id,
              maxPlayers: Math.max(2, Math.min(8, maxPlayers || 4)),
              players: [{ ...leaderPlayer, isLeader: true, isReady: true }],
              modifiers: (modifiers || []).filter((m: Modifier) => m.active),
              status: 'waiting',
              createdAt: Date.now(),
              seed: Math.floor(Math.random() * 100000),
            };

            rooms.set(newRoom.id, newRoom);
            if (meta) {
              meta.roomId = newRoom.id;
              meta.playerId = leaderPlayer.id;
              meta.name = leaderPlayer.name;
            }

            ws.send(JSON.stringify({ type: 'ROOM_CREATED', room: newRoom }));
            broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            break;
          }

          case 'JOIN_ROOM': {
            const { roomId, player } = msg;
            const targetRoom = rooms.get(roomId);

            if (!targetRoom) {
              ws.send(JSON.stringify({ type: 'ERROR', message: '部屋が見つかりませんでした' }));
              return;
            }

            if (targetRoom.players.length >= targetRoom.maxPlayers && !targetRoom.players.some((p) => p.id === player.id)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'この部屋は満員です' }));
              return;
            }

            if (targetRoom.status === 'in_game' || targetRoom.status === 'countdown') {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'この対戦はすでに開始されています' }));
              return;
            }

            // Remove player if already existing, then add
            const existingIdx = targetRoom.players.findIndex((p) => p.id === player.id);
            const joinedPlayer: RoomPlayer = {
              ...player,
              isLeader: targetRoom.players.length === 0,
              isReady: true,
              progress: 0,
              score: 0,
              mistakes: 0,
            };

            if (existingIdx >= 0) {
              targetRoom.players[existingIdx] = joinedPlayer;
            } else {
              targetRoom.players.push(joinedPlayer);
            }

            if (meta) {
              meta.roomId = targetRoom.id;
              meta.playerId = player.id;
              meta.name = player.name;
            }

            // Notify everyone in the room and update public lobby
            broadcastToRoom(targetRoom.id, { type: 'ROOM_UPDATED', room: targetRoom });
            broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            break;
          }

          case 'LEAVE_ROOM': {
            const { roomId, playerId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.players = targetRoom.players.filter((p) => p.id !== playerId);

              // If leader left, promote next player or delete if empty
              if (targetRoom.leaderId === playerId && targetRoom.players.length > 0) {
                targetRoom.players[0].isLeader = true;
                targetRoom.leaderId = targetRoom.players[0].id;
              } else if (targetRoom.players.length === 0 && targetRoom.id !== 'room_novice_public') {
                rooms.delete(targetRoom.id);
              }

              if (meta) meta.roomId = null;

              broadcastToRoom(roomId, { type: 'ROOM_UPDATED', room: targetRoom });
              broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'KICK_PLAYER': {
            const { roomId, targetPlayerId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.players = targetRoom.players.filter((p) => p.id !== targetPlayerId);

              // Send kick event to the specific kicked player
              sendToPlayer(targetPlayerId, { type: 'KICKED_FROM_ROOM', roomId });

              // Notify rest of the room
              broadcastToRoom(roomId, { type: 'ROOM_UPDATED', room: targetRoom });
              broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'START_COUNTDOWN': {
            const { roomId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.status = 'countdown';
              targetRoom.seed = Math.floor(Math.random() * 100000);
              broadcastToRoom(roomId, { type: 'COUNTDOWN_STARTED', room: targetRoom });
              broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'PROGRESS_UPDATE': {
            const { roomId, playerId, progress, score, mistakes, finished } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.status = 'in_game';
              const player = targetRoom.players.find((p) => p.id === playerId);
              if (player) {
                player.progress = progress;
                player.score = score;
                player.mistakes = mistakes;
                player.finished = finished;
                if (finished && !player.finishTime) {
                  player.finishTime = Date.now();
                }
              }

              // Relay live progress update to all opponents in the room
              broadcastToRoom(roomId, {
                type: 'LIVE_PROGRESS_UPDATE',
                roomId,
                playerId,
                progress,
                score,
                mistakes,
                finished,
                players: targetRoom.players,
              });
            }
            break;
          }
        }
      } catch (e) {
        console.debug('WS message parse error:', e);
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (meta && meta.roomId) {
        const targetRoom = rooms.get(meta.roomId);
        if (targetRoom) {
          targetRoom.players = targetRoom.players.filter((p) => p.id !== meta.playerId);
          if (targetRoom.leaderId === meta.playerId && targetRoom.players.length > 0) {
            targetRoom.players[0].isLeader = true;
            targetRoom.leaderId = targetRoom.players[0].id;
          } else if (targetRoom.players.length === 0 && targetRoom.id !== 'room_novice_public') {
            rooms.delete(targetRoom.id);
          }
          broadcastToRoom(meta.roomId, { type: 'ROOM_UPDATED', room: targetRoom });
          broadcastToAll({ type: 'ROOMS_LIST', rooms: getRoomsList() });
        }
      }
      clientMeta.delete(ws);
    });
  });

  // Favicon handler
  app.get('/favicon.ico', (req, res) => {
    const iconPath = path.join(process.cwd(), 'public', 'favicon.svg');
    if (fs.existsSync(iconPath)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.sendFile(iconPath);
    } else {
      res.status(204).end();
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use(async (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) return next();
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = await fs.promises.readFile(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server & WebSockets running on http://localhost:${PORT}`);
  });
}

startServer();

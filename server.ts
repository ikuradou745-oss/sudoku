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
  lives?: number;
  isKO?: boolean;
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

// In-Memory Server Room Storage (Authoritative)
const rooms = new Map<string, BattleRoom>();

// Client Connection Context for WebSockets
const clientMeta = new Map<WebSocket, { playerId: string; roomId: string | null; name: string }>();

// SSE (Server-Sent Events) clients for real-time HTTP streaming
const sseClients = new Set<express.Response>();

function getRoomsList(): BattleRoom[] {
  return Array.from(rooms.values()).filter(
    (r) => r.status === 'waiting' || (r.players.length > 0 && r.status !== 'finished')
  );
}

// Clean up stale empty rooms periodically (every 1 minute)
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    // If room is empty and older than 10 seconds, delete
    if (room.players.length === 0 && now - room.createdAt > 10000) {
      rooms.delete(roomId);
    }
    // If room is finished and older than 5 minutes, delete
    if (room.status === 'finished' && now - room.createdAt > 1000 * 60 * 5) {
      rooms.delete(roomId);
    }
  });
}, 30000);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Real-time WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Unified broadcast function (WebSockets + SSE)
  function broadcastEvent(data: any) {
    const raw = JSON.stringify(data);

    // 1. WebSocket Broadcast
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch {
          // Ignore
        }
      }
    });

    // 2. Server-Sent Events (SSE) Broadcast
    const sseMessage = `data: ${raw}\n\n`;
    sseClients.forEach((res) => {
      try {
        res.write(sseMessage);
      } catch {
        sseClients.delete(res);
      }
    });
  }

  function sendToPlayer(playerId: string, data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const meta = clientMeta.get(client);
      if (client.readyState === WebSocket.OPEN && meta?.playerId === playerId) {
        try {
          client.send(message);
        } catch {
          // Ignore
        }
      }
    });
  }

  // ==========================================
  // 1. SSE (Server-Sent Events) Endpoint
  // ==========================================
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ type: 'ROOMS_LIST', rooms: getRoomsList() })}\n\n`);

    const pingTimer = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingTimer);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingTimer);
      sseClients.delete(res);
    });
  });

  // ==========================================
  // 2. REST API Endpoints for Guaranteed Sync
  // ==========================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      onlineWs: clientMeta.size,
      onlineSse: sseClients.size,
      activeRooms: rooms.size,
    });
  });

  // Get all active rooms
  app.get('/api/rooms', (req, res) => {
    res.json(getRoomsList());
  });

  // Get single room details
  app.get('/api/rooms/:id', (req, res) => {
    const room = rooms.get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  });

  // Create Room
  app.post('/api/rooms/create', (req, res) => {
    const { name, maxPlayers, modifiers, leaderPlayer } = req.body;
    if (!leaderPlayer || !leaderPlayer.id) {
      return res.status(400).json({ error: 'leaderPlayer is required' });
    }

    const newRoom: BattleRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: (name || `${leaderPlayer.name}の部屋`).trim(),
      leaderId: leaderPlayer.id,
      maxPlayers: Math.max(2, Math.min(8, maxPlayers || 4)),
      players: [{ ...leaderPlayer, isLeader: true, isReady: true, progress: 0, score: 0, mistakes: 0, lives: 3, isKO: false }],
      modifiers: (modifiers || []).filter((m: Modifier) => m.active),
      status: 'waiting',
      createdAt: Date.now(),
      seed: Math.floor(Math.random() * 100000),
    };

    rooms.set(newRoom.id, newRoom);

    broadcastEvent({ type: 'ROOM_CREATED', room: newRoom });
    broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });

    res.json({ success: true, room: newRoom });
  });

  // Join Room
  app.post('/api/rooms/:id/join', (req, res) => {
    const roomId = req.params.id;
    const { player } = req.body;
    if (!player || !player.id) {
      return res.status(400).json({ error: 'player object is required' });
    }

    const targetRoom = rooms.get(roomId);
    if (!targetRoom) {
      return res.status(404).json({ error: '部屋が見つかりませんでした' });
    }

    if (targetRoom.status === 'in_game' || targetRoom.status === 'countdown') {
      return res.status(400).json({ error: 'この対戦はすでに開始されています' });
    }

    const existingIdx = targetRoom.players.findIndex((p) => p.id === player.id);
    if (existingIdx === -1 && targetRoom.players.length >= targetRoom.maxPlayers) {
      return res.status(400).json({ error: 'この部屋は満員です' });
    }

    const joinedPlayer: RoomPlayer = {
      ...player,
      isLeader: targetRoom.players.length === 0,
      isReady: true,
      progress: 0,
      score: 0,
      mistakes: 0,
      lives: 3,
      isKO: false,
    };

    if (existingIdx >= 0) {
      targetRoom.players[existingIdx] = joinedPlayer;
    } else {
      targetRoom.players.push(joinedPlayer);
    }

    broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
    broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });

    res.json({ success: true, room: targetRoom });
  });

  // Leave Room
  app.post('/api/rooms/:id/leave', (req, res) => {
    const roomId = req.params.id;
    const { playerId } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    const targetRoom = rooms.get(roomId);
    if (targetRoom) {
      targetRoom.players = targetRoom.players.filter((p) => p.id !== playerId);

      if (targetRoom.leaderId === playerId && targetRoom.players.length > 0) {
        targetRoom.players[0].isLeader = true;
        targetRoom.leaderId = targetRoom.players[0].id;
      } else if (targetRoom.players.length === 0) {
        rooms.delete(targetRoom.id);
      }

      broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
      broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });

      res.json({ success: true, room: targetRoom });
    } else {
      res.json({ success: true, room: null });
    }
  });

  // Kick Player
  app.post('/api/rooms/:id/kick', (req, res) => {
    const roomId = req.params.id;
    const { targetPlayerId } = req.body;
    const targetRoom = rooms.get(roomId);

    if (targetRoom && targetPlayerId) {
      targetRoom.players = targetRoom.players.filter((p) => p.id !== targetPlayerId);

      sendToPlayer(targetPlayerId, { type: 'KICKED_FROM_ROOM', roomId });
      broadcastEvent({ type: 'KICKED_FROM_ROOM', roomId, targetPlayerId });
      broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
      broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });

      res.json({ success: true, room: targetRoom });
    } else {
      res.status(404).json({ error: 'Room or player not found' });
    }
  });

  // Start Countdown
  app.post('/api/rooms/:id/countdown', (req, res) => {
    const roomId = req.params.id;
    const targetRoom = rooms.get(roomId);

    if (targetRoom) {
      targetRoom.status = 'countdown';
      targetRoom.seed = Math.floor(Math.random() * 100000);

      broadcastEvent({ type: 'COUNTDOWN_STARTED', room: targetRoom });
      broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
      broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });

      res.json({ success: true, room: targetRoom });
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  });

  // Report Live Progress
  app.post('/api/rooms/:id/progress', (req, res) => {
    const roomId = req.params.id;
    const { playerId, progress, score, mistakes, finished, lives, isKO } = req.body;
    const targetRoom = rooms.get(roomId);

    if (targetRoom) {
      targetRoom.status = 'in_game';
      const player = targetRoom.players.find((p) => p.id === playerId);
      if (player) {
        player.progress = progress;
        player.score = score;
        player.mistakes = mistakes;
        player.finished = finished;
        if (typeof lives === 'number') player.lives = lives;
        if (typeof isKO === 'boolean') player.isKO = isKO;
        if (finished && !player.finishTime) {
          player.finishTime = Date.now();
        }
      }

      broadcastEvent({
        type: 'LIVE_PROGRESS_UPDATE',
        roomId,
        playerId,
        progress,
        score,
        mistakes,
        lives,
        isKO,
        finished,
        players: targetRoom.players,
      });

      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  });

  // Declare Winner Clear
  app.post('/api/rooms/:id/declare-winner', (req, res) => {
    const roomId = req.params.id;
    const { winnerId, winnerName, winnerScore } = req.body;
    broadcastEvent({
      type: 'MATCH_CLEARED_BY_WINNER',
      roomId,
      winnerId,
      winnerName,
      winnerScore,
    });
    res.json({ success: true });
  });

  // ==========================================
  // 3. WebSocket Connection Handling
  // ==========================================
  wss.on('connection', (ws) => {
    clientMeta.set(ws, { playerId: '', roomId: null, name: '' });

    // Send initial snapshot on connect
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
              players: [{ ...leaderPlayer, isLeader: true, isReady: true, progress: 0, score: 0, mistakes: 0, lives: 3, isKO: false }],
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

            broadcastEvent({ type: 'ROOM_CREATED', room: newRoom });
            broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
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

            const existingIdx = targetRoom.players.findIndex((p) => p.id === player.id);
            const joinedPlayer: RoomPlayer = {
              ...player,
              isLeader: targetRoom.players.length === 0,
              isReady: true,
              progress: 0,
              score: 0,
              mistakes: 0,
              lives: 3,
              isKO: false,
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

            broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
            broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            break;
          }

          case 'LEAVE_ROOM': {
            const { roomId, playerId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.players = targetRoom.players.filter((p) => p.id !== playerId);

              if (targetRoom.leaderId === playerId && targetRoom.players.length > 0) {
                targetRoom.players[0].isLeader = true;
                targetRoom.leaderId = targetRoom.players[0].id;
              } else if (targetRoom.players.length === 0) {
                rooms.delete(targetRoom.id);
              }

              if (meta) meta.roomId = null;

              broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
              broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'KICK_PLAYER': {
            const { roomId, targetPlayerId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.players = targetRoom.players.filter((p) => p.id !== targetPlayerId);

              sendToPlayer(targetPlayerId, { type: 'KICKED_FROM_ROOM', roomId });
              broadcastEvent({ type: 'KICKED_FROM_ROOM', roomId, targetPlayerId });
              broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
              broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'START_COUNTDOWN': {
            const { roomId } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.status = 'countdown';
              targetRoom.seed = Math.floor(Math.random() * 100000);
              broadcastEvent({ type: 'COUNTDOWN_STARTED', room: targetRoom });
              broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
              broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
            }
            break;
          }

          case 'PROGRESS_UPDATE': {
            const { roomId, playerId, progress, score, mistakes, finished, lives, isKO } = msg;
            const targetRoom = rooms.get(roomId);
            if (targetRoom) {
              targetRoom.status = 'in_game';
              const player = targetRoom.players.find((p) => p.id === playerId);
              if (player) {
                player.progress = progress;
                player.score = score;
                player.mistakes = mistakes;
                player.finished = finished;
                if (typeof lives === 'number') player.lives = lives;
                if (typeof isKO === 'boolean') player.isKO = isKO;
                if (finished && !player.finishTime) {
                  player.finishTime = Date.now();
                }
              }

              broadcastEvent({
                type: 'LIVE_PROGRESS_UPDATE',
                roomId,
                playerId,
                progress,
                score,
                mistakes,
                lives,
                isKO,
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
      if (meta && meta.roomId && meta.playerId) {
        const targetRoom = rooms.get(meta.roomId);
        if (targetRoom) {
          targetRoom.players = targetRoom.players.filter((p) => p.id !== meta.playerId);
          if (targetRoom.leaderId === meta.playerId && targetRoom.players.length > 0) {
            targetRoom.players[0].isLeader = true;
            targetRoom.leaderId = targetRoom.players[0].id;
          } else if (targetRoom.players.length === 0) {
            rooms.delete(targetRoom.id);
          }
          broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom });
          broadcastEvent({ type: 'ROOMS_LIST', rooms: getRoomsList() });
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
    console.log(`Server running on http://0.0.0.0:${PORT} with SSE, WebSockets & REST API`);
  });
}

startServer();

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'heaven';

interface PresenceUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rating: number;
  rankTier: RankTier;
  lastActive: number;
  lastLoginDate: string; // YYYY-MM-DD
  activity?: string;
}

interface RankedQueuePlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rating: number;
  rankTier: RankTier;
  joinedAt: number;
  partyId?: string | null;
  roomCode?: string | null;
}

interface RankedMatchPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rating: number;
  rankTier: RankTier;
  team?: 'red' | 'blue';
  progress: number;
  score: number;
  mistakes: number;
  lives: number;
  isKO: boolean;
  finished: boolean;
  finishTime?: number;
  isBot?: boolean;
}

interface RankedMatchSession {
  matchId: string;
  mode: '1vs1' | '2vs2' | 'placement';
  players: RankedMatchPlayer[];
  teams?: {
    teamRed: RankedMatchPlayer[];
    teamBlue: RankedMatchPlayer[];
  };
  status: 'countdown' | 'in_game' | 'finished';
  winnerSide?: 'player1' | 'player2' | 'teamRed' | 'teamBlue' | 'draw';
  winnerIds?: string[];
  createdAt: number;
  seed: number;
}

interface PartyInfo {
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

// 9:00 AM JST cycle key helper
function getCurrentDailyCycleKey(now: Date = new Date()): string {
  const cycleDate = new Date(now.getTime());
  if (cycleDate.getHours() < 9) {
    cycleDate.setDate(cycleDate.getDate() - 1);
  }
  const year = cycleDate.getFullYear();
  const month = String(cycleDate.getMonth() + 1).padStart(2, '0');
  const day = String(cycleDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Global In-Memory Stores
const presenceMap = new Map<string, PresenceUser>();
const rankedQueue1v1: RankedQueuePlayer[] = [];
const rankedQueue2v2: RankedQueuePlayer[] = [];
const activeParties = new Map<string, PartyInfo>();
const activeRankedMatches = new Map<string, RankedMatchSession>();

const PRESENCE_CACHE_FILE = path.join(process.cwd(), 'presence_cache.json');

function loadPresenceCache() {
  try {
    if (fs.existsSync(PRESENCE_CACHE_FILE)) {
      const raw = fs.readFileSync(PRESENCE_CACHE_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const todayKey = getCurrentDailyCycleKey();
        list.forEach((u: PresenceUser) => {
          if (
            u.id &&
            u.name &&
            !u.id.startsWith('member_') &&
            !u.id.toLowerCase().includes('bot') &&
            !u.name.toLowerCase().includes('bot')
          ) {
            // Keep real users from today
            if (u.lastLoginDate === todayKey || Date.now() - u.lastActive < 86400000) {
              presenceMap.set(u.id, u);
            }
          }
        });
      }
    }
  } catch {
    // Ignore
  }
}

function savePresenceCache() {
  try {
    const list = Array.from(presenceMap.values()).filter(
      (u) =>
        u.id &&
        !u.id.startsWith('member_') &&
        !u.id.toLowerCase().includes('bot') &&
        !u.name.toLowerCase().includes('bot')
    );
    fs.writeFileSync(PRESENCE_CACHE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // Ignore
  }
}

loadPresenceCache();

// Client Connection Context for WebSockets
const clientMeta = new Map<WebSocket, { playerId: string; name: string }>();

// SSE (Server-Sent Events) clients for real-time HTTP streaming
const sseClients = new Set<express.Response>();

function getPresenceSnapshot() {
  const now = Date.now();
  const currentDailyKey = getCurrentDailyCycleKey();
  const allUsers = Array.from(presenceMap.values()).filter(
    (u) =>
      u.id &&
      !u.id.startsWith('member_') &&
      !u.id.toLowerCase().includes('bot') &&
      !u.name.toLowerCase().includes('bot')
  );

  const onlineUsers = allUsers
    .filter((u) => now - u.lastActive < 18000)
    .map((u) => ({
      ...u,
      isOnline: true,
    }))
    .sort((a, b) => b.lastActive - a.lastActive);

  const todayUsers = allUsers
    .filter((u) => u.lastLoginDate === currentDailyKey)
    .map((u) => ({
      ...u,
      isOnline: now - u.lastActive < 18000,
    }))
    .sort((a, b) => b.lastActive - a.lastActive);

  return { onlineUsers, todayUsers };
}

// Cleanup stale items periodically
setInterval(() => {
  const now = Date.now();
  // Clear old matches finished > 10 min ago
  activeRankedMatches.forEach((match, id) => {
    if (match.status === 'finished' && now - match.createdAt > 600000) {
      activeRankedMatches.delete(id);
    }
  });

  // Clear stale parties empty or > 2 hours
  activeParties.forEach((party, id) => {
    if (party.players.length === 0 || now - party.createdAt > 7200000) {
      activeParties.delete(id);
    }
  });
}, 30000);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Enable CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

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
  // Matchmaking Check Engine
  // ==========================================
  function create1v1Session(p1: RankedQueuePlayer, p2: RankedQueuePlayer) {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: RankedMatchSession = {
      matchId,
      mode: '1vs1',
      status: 'countdown',
      seed: Math.floor(Math.random() * 100000),
      createdAt: Date.now(),
      players: [
        {
          id: p1.id,
          name: p1.name,
          avatarUrl: p1.avatarUrl,
          rating: p1.rating,
          rankTier: p1.rankTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        },
        {
          id: p2.id,
          name: p2.name,
          avatarUrl: p2.avatarUrl,
          rating: p2.rating,
          rankTier: p2.rankTier,
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        },
      ],
    };

    activeRankedMatches.set(matchId, session);

    // Broadcast match found to everyone and targets
    broadcastEvent({
      type: 'RANKED_MATCH_FOUND',
      matchId,
      session,
    });
  }

  function tryMatchmaking1v1() {
    // 1. Match players with identical roomCode first
    const roomMap = new Map<string, RankedQueuePlayer[]>();
    for (const p of rankedQueue1v1) {
      if (p.roomCode && p.roomCode.trim()) {
        const code = p.roomCode.trim().toUpperCase();
        const list = roomMap.get(code) || [];
        list.push(p);
        roomMap.set(code, list);
      }
    }

    for (const [, list] of roomMap.entries()) {
      while (list.length >= 2) {
        const p1 = list.shift()!;
        const p2 = list.shift()!;
        const idx1 = rankedQueue1v1.indexOf(p1);
        if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);
        const idx2 = rankedQueue1v1.indexOf(p2);
        if (idx2 >= 0) rankedQueue1v1.splice(idx2, 1);
        create1v1Session(p1, p2);
      }
    }

    // 2. Match public queue players (without roomCode)
    const publicList = rankedQueue1v1.filter((p) => !p.roomCode || !p.roomCode.trim());
    while (publicList.length >= 2) {
      const p1 = publicList.shift()!;
      const p2 = publicList.shift()!;
      const idx1 = rankedQueue1v1.indexOf(p1);
      if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);
      const idx2 = rankedQueue1v1.indexOf(p2);
      if (idx2 >= 0) rankedQueue1v1.splice(idx2, 1);
      create1v1Session(p1, p2);
    }
  }

  function tryMatchmaking2v2() {
    // If we have at least 4 players in 2v2 queue
    if (rankedQueue2v2.length >= 4) {
      // Pick 4 players
      const matchedPlayers: RankedQueuePlayer[] = [];
      while (matchedPlayers.length < 4 && rankedQueue2v2.length > 0) {
        matchedPlayers.push(rankedQueue2v2.shift()!);
      }

      if (matchedPlayers.length === 4) {
        // Form teams:
        // If 2 players have matching partyId, keep them together
        const partyGroups = new Map<string, RankedQueuePlayer[]>();
        const soloPlayers: RankedQueuePlayer[] = [];

        matchedPlayers.forEach((p) => {
          if (p.partyId) {
            const list = partyGroups.get(p.partyId) || [];
            list.push(p);
            partyGroups.set(p.partyId, list);
          } else {
            soloPlayers.push(p);
          }
        });

        let teamRedQueue: RankedQueuePlayer[] = [];
        let teamBlueQueue: RankedQueuePlayer[] = [];

        // Distribute parties
        partyGroups.forEach((group) => {
          if (teamRedQueue.length + group.length <= 2) {
            teamRedQueue.push(...group);
          } else if (teamBlueQueue.length + group.length <= 2) {
            teamBlueQueue.push(...group);
          } else {
            soloPlayers.push(...group);
          }
        });

        // Distribute solo players randomly
        // Shuffle solo players
        for (let i = soloPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [soloPlayers[i], soloPlayers[j]] = [soloPlayers[j], soloPlayers[i]];
        }

        while (soloPlayers.length > 0) {
          const p = soloPlayers.pop()!;
          if (teamRedQueue.length < 2) {
            teamRedQueue.push(p);
          } else {
            teamBlueQueue.push(p);
          }
        }

        const teamRedPlayers: RankedMatchPlayer[] = teamRedQueue.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          rating: p.rating,
          rankTier: p.rankTier,
          team: 'red',
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        }));

        const teamBluePlayers: RankedMatchPlayer[] = teamBlueQueue.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          rating: p.rating,
          rankTier: p.rankTier,
          team: 'blue',
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false,
        }));

        const matchId = `match2v2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const session: RankedMatchSession = {
          matchId,
          mode: '2vs2',
          status: 'countdown',
          seed: Math.floor(Math.random() * 100000),
          createdAt: Date.now(),
          players: [...teamRedPlayers, ...teamBluePlayers],
          teams: {
            teamRed: teamRedPlayers,
            teamBlue: teamBluePlayers,
          },
        };

        activeRankedMatches.set(matchId, session);

        broadcastEvent({
          type: 'RANKED_MATCH_FOUND',
          matchId,
          session,
        });
      }
    }
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
    res.write(`data: ${JSON.stringify({ type: 'PRESENCE_SNAPSHOT', ...getPresenceSnapshot() })}\n\n`);

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
  // 2. Presence & Community Endpoints
  // ==========================================
  app.post('/api/presence/heartbeat', (req, res) => {
    const { id, name, avatarUrl, rating, rankTier } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    // Strictly forbid bots from registering presence
    if (String(id).toLowerCase().includes('bot') || String(name).toLowerCase().includes('bot')) {
      return res.status(400).json({ error: 'Bots cannot be registered as presence users' });
    }

    const currentDailyKey = getCurrentDailyCycleKey();
    const existing = presenceMap.get(id);

    const updatedUser: PresenceUser = {
      id,
      name: name.trim(),
      avatarUrl: avatarUrl || existing?.avatarUrl || null,
      rating: typeof rating === 'number' ? rating : existing?.rating || 0,
      rankTier: rankTier || existing?.rankTier || 'bronze',
      lastActive: Date.now(),
      lastLoginDate: currentDailyKey,
    };

    presenceMap.set(id, updatedUser);
    savePresenceCache();

    broadcastEvent({
      type: 'PRESENCE_SNAPSHOT',
      ...getPresenceSnapshot(),
    });

    res.json({ success: true, user: updatedUser });
  });

  app.get('/api/presence/members', (req, res) => {
    res.json(getPresenceSnapshot());
  });

  // ==========================================
  // Gemini AI Question Generation Endpoint
  // ==========================================
  app.post('/api/ai/generate-question', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `あなたは英検4級〜5級向けの英語学習アプリ「うおリンゴ」の専属AI問題作成者です。
小学生や中学生がワクワクするような、楽しくて身になるオリジナル英語クイズを1問だけ作成してください。

形式は以下の5種類の中からランダムに1つ選んで作成してください：
1. 'handwriting' (手書き英単語問題: 例「『嬉しい』を英語で書くと？」「『学校』を英語で書くと？」など身近な単語。handwritingGuideに'h _ _ _ _'のようなヒント、acceptableAnswersに別解配列)
2. 'matching' (点繋ぎ問題: 感情、日常動作、天気、動物、文房具などの英単語と、対応する絵文字や日本語を4組)
3. 'blank' (空欄穴埋め選択問題: choicesに選択肢4つ、正解はランダムな位置)
4. 'order' (語順並べ替え問題: wordOptionsに5〜6単語)
5. 'translate' (単語またはフレーズの意味選択: choicesに選択肢4つ)

必ず以下のJSON形式のみを返してください。Markdownコードブロックなどは付けず、純粋なJSONオブジェクトのみを出力してください：
{
  "id": "ai_gen_${Date.now()}",
  "type": "handwriting" | "matching" | "blank" | "order" | "translate",
  "difficulty": "5kyu",
  "japanese": "問題文（例: 「嬉しい」を英語で書くと？、または「〇〇を線で繋ごう！」など）",
  "english": "模範解答の英文または単語 (例: happy)",
  "promptSentence": "空欄補充の場合の英文（例: I ____ my homework every day. 空欄は____）",
  "choices": ["choice1", "choice2", "choice3", "choice4"],
  "correctAnswer": "正解の文字列（handwritingならhappy、matchingなら'all'）",
  "wordOptions": ["word1", "word2", "word3", "word4", "word5"],
  "matchingPairs": [
    { "id": "p1", "left": "happy", "right": "☺️ うれしい" },
    { "id": "p2", "left": "sad", "right": "😢 かなしい" },
    { "id": "p3", "left": "good", "right": "👍 よい" },
    { "id": "p4", "left": "angry", "right": "😡 おこった" }
  ],
  "handwritingGuide": "h _ _ _ _ (5文字)",
  "acceptableAnswers": ["happy"],
  "explanation": "子供にもわかりやすい丁寧で明るい解説",
  "isAiGenerated": true
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text ? response.text.trim() : '';
      if (!text) {
        return res.status(500).json({ error: 'Empty response from Gemini' });
      }

      const question = JSON.parse(text);
      question.isAiGenerated = true;
      if (!question.id) question.id = `ai_gen_${Date.now()}`;
      return res.json({ question });
    } catch (err: any) {
      console.error('[AI Question Generation Error]:', err?.message || err);
      return res.status(500).json({ error: 'Failed to generate question with AI' });
    }
  });

  // ==========================================
  // Gemini AI Handwriting Evaluation Endpoint (High-Precision OCR)
  // ==========================================
  app.post('/api/ai/judge-handwriting', async (req, res) => {
    try {
      const { imageBase64, japanese, expectedAnswer, acceptableAnswers = [] } = req.body;

      if (!imageBase64 || !expectedAnswer) {
        return res.status(400).json({ error: 'imageBase64 and expectedAnswer are required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          recognizedText: '',
          isCorrect: false,
          confidence: 0,
          feedback: 'Gemini APIキーが設定されていません。',
          error: true,
        });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const acceptableList = Array.from(new Set([
        String(expectedAnswer).trim().toLowerCase(),
        ...acceptableAnswers.map((a: string) => String(a).trim().toLowerCase()),
      ])).filter(Boolean);

      const expectedClean = String(expectedAnswer).replace(/[^a-zA-Z]/g, '').toLowerCase();

      const prompt = `あなたは英語学習アプリ「うおリンゴ」の厳格な手書き文字認識(OCR)および採点AIです。
日本の小・中学生が描いた手書き画像が送信されました。

【問題日本語】：${japanese || '英語で書いてみよう'}
【模範正解】：${expectedAnswer}（${expectedClean.length}文字）
【許容正解】：${acceptableList.join(', ')}

以下の厳格な基準に従って、不正や適当な落書きを完全に排除して判定してください：

1. 【適当な落書き・波線・殴り書きの厳格な排除（最重要）】:
   - ユーザーが「適当な落書き」「単なる波線」「ぐるぐる描いただけの線」「意味のないジグザグ」「横一本の線」を描いた場合、絶対に好意的に推測して正解の単語とみなしてはいけません！
   - 各アルファベット固有の形状（例: 'h'の縦棒とアーチ、'a'の丸と右棒、'p'の下に突き出た縦棒と丸など）が明確に確認できない場合は、rawTranscriptionおよびrecognizedTextを「(判読不能)」または「(落書き)」とし、必ず isCorrect: false にしてください。
   - 模範解答「${expectedAnswer}」は ${expectedClean.length}文字です。独立して読めるアルファベットが ${expectedClean.length}文字分揃っていない場合（途中で諦めた線や1〜2文字しかない場合）は絶対に不合格（isCorrect: false）にしてください。

2. 【正誤判定の基準】:
   - 画像から読み取れたアルファベットのみを小文字で「recognizedText」に記録してください（例: "happy", "hapy", "(判読不能)"）。
   - recognizedTextが模範正解「${expectedClean}」または許容正解のスペルと、一文字ずつ完全に一致している場合のみ「isCorrect: true」とします。
   - スペルミス、文字の不足・過剰、判読不能な文字が1文字でもある場合は、すべて「isCorrect: false」にしてください。
   - 「なんとなく雰囲気が似ているから」「子供が適当に描いたかもしれないから」といった忖度による甘い合格判定は厳禁です。

3. 【具体的な日本語フィードバック】:
   - 正解時: 「『${expectedAnswer}』ときれいに正しく書けました！スペルも完璧です！🎉」
   - 落書き・判読不能時: 「文字の形がはっきりと読み取れませんでした。適当な線ではなく、アルファベットを1文字ずつ丁寧にはっきり書いてみよう！✍️」
   - スペル違い時: 「『〇〇』と書かれています。正解は『${expectedAnswer}』です。スペルをよく確かめてもう一度書いてみよう！」

指定されたJSONスキーマに従って厳密に出力してください。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rawTranscription: {
                type: Type.STRING,
                description: 'Exact physical letters seen on the image from left to right, or (判読不能)/(落書き) if not legible.',
              },
              recognizedText: {
                type: Type.STRING,
                description: 'Clean English word in lowercase without spaces, or (判読不能).',
              },
              isCorrect: {
                type: Type.BOOLEAN,
                description: 'True ONLY if all letters of the word are clearly formed and exactly match the target spelling.',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Recognition confidence score between 0.0 and 1.0.',
              },
              feedback: {
                type: Type.STRING,
                description: 'Polite, clear, and encouraging feedback in Japanese.',
              },
            },
            required: ['rawTranscription', 'recognizedText', 'isCorrect', 'feedback'],
          },
          temperature: 0.0,
        },
      });

      const text = response.text ? response.text.trim() : '';
      if (!text) {
        return res.status(500).json({
          recognizedText: '',
          isCorrect: false,
          confidence: 0,
          feedback: 'AIからの判定結果が取得できませんでした。もう一度お試しください。',
        });
      }

      const result = JSON.parse(text);
      const rawRecognized = String(result.recognizedText || '').trim();
      const rawTrans = String(result.rawTranscription || '').trim();
      const cleanRecognized = rawRecognized.replace(/[^a-zA-Z]/g, '').toLowerCase();

      const normalizedTargets = [
        expectedClean,
        ...acceptableList.map((a) => a.replace(/[^a-zA-Z]/g, '').toLowerCase()),
      ].filter(Boolean);

      // Strict Validation:
      // 1. Must NOT contain words indicating scribbles or illegible handwriting
      const isScribble = rawRecognized.includes('判読不能') || 
                        rawRecognized.includes('落書き') || 
                        rawTrans.includes('判読不能') || 
                        rawTrans.includes('落書き') ||
                        cleanRecognized.length === 0;

      // 2. Recognized word must exactly match acceptable target words
      const isExactWordMatch = cleanRecognized.length > 0 && normalizedTargets.includes(cleanRecognized);

      // 3. Length must match expected word length exactly
      const isLengthMatch = cleanRecognized.length === expectedClean.length;

      // 4. Gemini must have explicitly marked isCorrect as true
      const isAiConfirmed = Boolean(result.isCorrect);

      // Final truth: ALL criteria must be satisfied!
      const isActuallyCorrect = !isScribble && isExactWordMatch && isLengthMatch && isAiConfirmed;

      const finalRecognized = isScribble ? '(判読不能)' : (cleanRecognized || rawRecognized);

      let finalFeedback = result.feedback;
      if (!isActuallyCorrect) {
        if (isScribble) {
          finalFeedback = '文字がはっきりと読み取れませんでした。適当な線ではなく、アルファベットの形を1文字ずつていねいに書いてね！✍️';
        } else if (cleanRecognized && !isExactWordMatch) {
          finalFeedback = `「${cleanRecognized}」と読み取れました。正解は「${expectedAnswer}」です。スペルをよく確かめてもう一度書いてみよう！`;
        } else {
          finalFeedback = `正解は「${expectedAnswer}」です。4本線のノートに合わせて丁寧にもう一度書いてみよう！`;
        }
      }

      return res.json({
        rawTranscription: rawTrans,
        recognizedText: finalRecognized,
        isCorrect: isActuallyCorrect,
        confidence: typeof result.confidence === 'number' ? result.confidence : (isActuallyCorrect ? 0.95 : 0.2),
        feedback: finalFeedback || (isActuallyCorrect ? `「${expectedAnswer}」ときれいに書けました！正解です！🎉` : `正解は「${expectedAnswer}」です。もう一度書いてみよう！`),
      });
    } catch (err: any) {
      console.error('[AI Handwriting Judgment Error]:', err?.message || err);
      return res.status(500).json({
        recognizedText: '',
        isCorrect: false,
        confidence: 0,
        feedback: 'AI採点サーバーとの通信中にエラーが発生しました。もう一度「答え合わせ」を押してください。',
        error: true,
      });
    }
  });

  // ==========================================
  // 3. Ranked Matchmaking REST Endpoints
  // ==========================================
  app.post('/api/ranked/queue', (req, res) => {
    const { player, mode, partyId, roomCode } = req.body;
    if (!player || !player.id || !mode) {
      return res.status(400).json({ error: 'player and mode are required' });
    }

    // Clean from other queues first
    const cleanQueue = (q: RankedQueuePlayer[]) => {
      const idx = q.findIndex((p) => p.id === player.id);
      if (idx >= 0) q.splice(idx, 1);
    };
    cleanQueue(rankedQueue1v1);
    cleanQueue(rankedQueue2v2);

    const queuePlayer: RankedQueuePlayer = {
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      rating: player.rating || 0,
      rankTier: player.rankTier || 'bronze',
      joinedAt: Date.now(),
      partyId: partyId || null,
      roomCode: roomCode ? String(roomCode).trim().toUpperCase() : null,
    };

    if (mode === '1vs1') {
      rankedQueue1v1.push(queuePlayer);
      tryMatchmaking1v1();
    } else if (mode === '2vs2') {
      rankedQueue2v2.push(queuePlayer);
      tryMatchmaking2v2();
    }

    broadcastEvent({
      type: 'QUEUE_STATUS',
      queue1v1Count: rankedQueue1v1.length,
      queue2v2Count: rankedQueue2v2.length,
    });

    res.json({
      success: true,
      queue1v1Count: rankedQueue1v1.length,
      queue2v2Count: rankedQueue2v2.length,
    });
  });

  app.post('/api/ranked/cancel-queue', (req, res) => {
    const { playerId } = req.body;
    if (playerId) {
      const idx1 = rankedQueue1v1.findIndex((p) => p.id === playerId);
      if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);

      const idx2 = rankedQueue2v2.findIndex((p) => p.id === playerId);
      if (idx2 >= 0) rankedQueue2v2.splice(idx2, 1);

      broadcastEvent({
        type: 'QUEUE_STATUS',
        queue1v1Count: rankedQueue1v1.length,
        queue2v2Count: rankedQueue2v2.length,
      });
    }
    res.json({ success: true });
  });

  app.get('/api/ranked/matches/:id', (req, res) => {
    const match = activeRankedMatches.get(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  });

  // Progress update in Ranked Match
  app.post('/api/ranked/progress', (req, res) => {
    const { matchId, playerId, progress, score, mistakes, lives, isKO, finished } = req.body;
    const match = activeRankedMatches.get(matchId);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    match.status = 'in_game';
    const player = match.players.find((p) => p.id === playerId);
    if (player) {
      player.progress = progress;
      player.score = score;
      player.mistakes = mistakes;
      if (typeof lives === 'number') player.lives = lives;
      if (typeof isKO === 'boolean') player.isKO = isKO;
      player.finished = finished;
      if (finished && !player.finishTime) {
        player.finishTime = Date.now();
      }
    }

    // Check Match Completion Conditions
    let matchFinished = false;
    let winnerSide: RankedMatchSession['winnerSide'] = undefined;
    let winnerIds: string[] = [];

    if (match.mode === '1vs1') {
      const p1 = match.players[0];
      const p2 = match.players[1];

      if (p1 && p2) {
        if (p1.finished && !p2.finished) {
          matchFinished = true;
          winnerSide = 'player1';
          winnerIds = [p1.id];
        } else if (p2.finished && !p1.finished) {
          matchFinished = true;
          winnerSide = 'player2';
          winnerIds = [p2.id];
        } else if (p1.isKO && !p2.isKO) {
          matchFinished = true;
          winnerSide = 'player2';
          winnerIds = [p2.id];
        } else if (p2.isKO && !p1.isKO) {
          matchFinished = true;
          winnerSide = 'player1';
          winnerIds = [p1.id];
        } else if (p1.isKO && p2.isKO) {
          matchFinished = true;
          winnerSide = p1.score >= p2.score ? 'player1' : 'player2';
          winnerIds = p1.score >= p2.score ? [p1.id] : [p2.id];
        }
      }
    } else if (match.mode === '2vs2') {
      const teamRed = match.players.filter((p) => p.team === 'red');
      const teamBlue = match.players.filter((p) => p.team === 'blue');

      const redFinishedCount = teamRed.filter((p) => p.finished).length;
      const blueFinishedCount = teamBlue.filter((p) => p.finished).length;

      const redAllKO = teamRed.every((p) => p.isKO);
      const blueAllKO = teamBlue.every((p) => p.isKO);

      if (redFinishedCount >= 1 && blueFinishedCount === 0) {
        matchFinished = true;
        winnerSide = 'teamRed';
        winnerIds = teamRed.map((p) => p.id);
      } else if (blueFinishedCount >= 1 && redFinishedCount === 0) {
        matchFinished = true;
        winnerSide = 'teamBlue';
        winnerIds = teamBlue.map((p) => p.id);
      } else if (redAllKO && !blueAllKO) {
        matchFinished = true;
        winnerSide = 'teamBlue';
        winnerIds = teamBlue.map((p) => p.id);
      } else if (blueAllKO && !redAllKO) {
        matchFinished = true;
        winnerSide = 'teamRed';
        winnerIds = teamRed.map((p) => p.id);
      }
    }

    if (matchFinished && match.status !== 'finished') {
      match.status = 'finished';
      match.winnerSide = winnerSide;
      match.winnerIds = winnerIds;
    }

    broadcastEvent({
      type: 'RANKED_PROGRESS_UPDATE',
      matchId,
      match,
      playerId,
      progress,
      score,
      mistakes,
      lives,
      isKO,
      finished,
    });

    if (matchFinished) {
      broadcastEvent({
        type: 'RANKED_MATCH_FINISHED',
        matchId,
        match,
        winnerSide,
        winnerIds,
      });
    }

    res.json({ success: true, match });
  });

  // Forfeit / Disconnect Penalty
  app.post('/api/ranked/forfeit', (req, res) => {
    const { matchId, playerId } = req.body;
    const match = activeRankedMatches.get(matchId);

    if (match && match.status !== 'finished') {
      match.status = 'finished';
      const forfeitingPlayer = match.players.find((p) => p.id === playerId);
      if (forfeitingPlayer) {
        forfeitingPlayer.isKO = true;
        forfeitingPlayer.lives = 0;
      }

      const winners = match.players.filter((p) => p.id !== playerId);
      match.winnerIds = winners.map((w) => w.id);
      match.winnerSide = match.mode === '1vs1' ? 'player2' : 'teamBlue';

      broadcastEvent({
        type: 'RANKED_FORFEIT_OCCURRED',
        matchId,
        forfeitedPlayerId: playerId,
        match,
        winnerIds: match.winnerIds,
      });
    }

    res.json({ success: true });
  });

  // ==========================================
  // 4. Party Endpoints (for 2vs2 duo play)
  // ==========================================
  app.post('/api/parties/create', (req, res) => {
    const { leader } = req.body;
    if (!leader || !leader.id) {
      return res.status(400).json({ error: 'Leader is required' });
    }

    const partyId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newParty: PartyInfo = {
      partyId,
      leaderId: leader.id,
      players: [leader],
      createdAt: Date.now(),
    };

    activeParties.set(partyId, newParty);
    broadcastEvent({ type: 'PARTY_UPDATED', party: newParty });

    res.json({ success: true, party: newParty });
  });

  app.post('/api/parties/join', (req, res) => {
    const { partyId, player } = req.body;
    const party = activeParties.get((partyId || '').toUpperCase());

    if (!party) {
      return res.status(404).json({ error: 'パーティーコードが見つかりません' });
    }

    if (party.players.length >= 2 && !party.players.some((p) => p.id === player.id)) {
      return res.status(400).json({ error: 'このパーティーはすでに満員です (最大2人)' });
    }

    if (!party.players.some((p) => p.id === player.id)) {
      party.players.push(player);
    }

    broadcastEvent({ type: 'PARTY_UPDATED', party });
    res.json({ success: true, party });
  });

  app.post('/api/parties/leave', (req, res) => {
    const { partyId, playerId } = req.body;
    const party = activeParties.get((partyId || '').toUpperCase());

    if (party) {
      party.players = party.players.filter((p) => p.id !== playerId);
      if (party.players.length === 0) {
        activeParties.delete(party.partyId);
      } else if (party.leaderId === playerId) {
        party.leaderId = party.players[0].id;
      }
      broadcastEvent({ type: 'PARTY_UPDATED', party: party.players.length > 0 ? party : null });
    }

    res.json({ success: true });
  });

  // ==========================================
  // 5. WebSocket Connection Handling
  // ==========================================
  wss.on('connection', (ws) => {
    clientMeta.set(ws, { playerId: '', name: '' });

    // Send initial snapshot on connect
    ws.send(JSON.stringify({ type: 'PRESENCE_SNAPSHOT', ...getPresenceSnapshot() }));

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

          case 'GET_PRESENCE': {
            ws.send(JSON.stringify({ type: 'PRESENCE_SNAPSHOT', ...getPresenceSnapshot() }));
            break;
          }
        }
      } catch (e) {
        console.debug('WS message parse error:', e);
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (meta && meta.playerId) {
        // Clean from queue
        const q1Idx = rankedQueue1v1.findIndex((p) => p.id === meta.playerId);
        if (q1Idx >= 0) rankedQueue1v1.splice(q1Idx, 1);
        const q2Idx = rankedQueue2v2.findIndex((p) => p.id === meta.playerId);
        if (q2Idx >= 0) rankedQueue2v2.splice(q2Idx, 1);

        // Check if player has other sockets open
        let hasOtherSocket = false;
        clientMeta.forEach((otherMeta, otherWs) => {
          if (otherWs !== ws && otherMeta.playerId === meta.playerId && otherWs.readyState === WebSocket.OPEN) {
            hasOtherSocket = true;
          }
        });

        if (!hasOtherSocket) {
          const user = presenceMap.get(meta.playerId);
          if (user) {
            user.lastActive = 0; // Mark offline immediately
          }
          broadcastEvent({
            type: 'PRESENCE_SNAPSHOT',
            ...getPresenceSnapshot(),
          });
          broadcastEvent({
            type: 'QUEUE_STATUS',
            queue1v1Count: rankedQueue1v1.length,
            queue2v2Count: rankedQueue2v2.length,
          });
        }
      }
      clientMeta.delete(ws);
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      onlineWs: clientMeta.size,
      onlineSse: sseClients.size,
      presenceTotal: presenceMap.size,
      queue1v1: rankedQueue1v1.length,
      queue2v2: rankedQueue2v2.length,
      activeMatches: activeRankedMatches.size,
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
        res.status(200).set({ 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} with Presence Engine`);
  });
}

startServer();

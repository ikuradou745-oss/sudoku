"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_ws = require("ws");
var import_vite = require("vite");
var import_genai = require("@google/genai");
function getCurrentDailyCycleKey(now = /* @__PURE__ */ new Date()) {
  const cycleDate = new Date(now.getTime());
  if (cycleDate.getHours() < 9) {
    cycleDate.setDate(cycleDate.getDate() - 1);
  }
  const year = cycleDate.getFullYear();
  const month = String(cycleDate.getMonth() + 1).padStart(2, "0");
  const day = String(cycleDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
var presenceMap = /* @__PURE__ */ new Map();
var rankedQueue1v1 = [];
var rankedQueue2v2 = [];
var activeParties = /* @__PURE__ */ new Map();
var activeRankedMatches = /* @__PURE__ */ new Map();
var PRESENCE_CACHE_FILE = import_path.default.join(process.cwd(), "presence_cache.json");
function loadPresenceCache() {
  try {
    if (import_fs.default.existsSync(PRESENCE_CACHE_FILE)) {
      const raw = import_fs.default.readFileSync(PRESENCE_CACHE_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const todayKey = getCurrentDailyCycleKey();
        list.forEach((u) => {
          if (u.id && u.name && !u.id.startsWith("member_") && !u.id.toLowerCase().includes("bot") && !u.name.toLowerCase().includes("bot")) {
            if (u.lastLoginDate === todayKey || Date.now() - u.lastActive < 864e5) {
              presenceMap.set(u.id, u);
            }
          }
        });
      }
    }
  } catch {
  }
}
function savePresenceCache() {
  try {
    const list = Array.from(presenceMap.values()).filter(
      (u) => u.id && !u.id.startsWith("member_") && !u.id.toLowerCase().includes("bot") && !u.name.toLowerCase().includes("bot")
    );
    import_fs.default.writeFileSync(PRESENCE_CACHE_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
  }
}
loadPresenceCache();
var clientMeta = /* @__PURE__ */ new Map();
var sseClients = /* @__PURE__ */ new Set();
function getPresenceSnapshot() {
  const now = Date.now();
  const currentDailyKey = getCurrentDailyCycleKey();
  const allUsers = Array.from(presenceMap.values()).filter(
    (u) => u.id && !u.id.startsWith("member_") && !u.id.toLowerCase().includes("bot") && !u.name.toLowerCase().includes("bot")
  );
  const onlineUsers = allUsers.filter((u) => now - u.lastActive < 18e3).map((u) => ({
    ...u,
    isOnline: true
  })).sort((a, b) => b.lastActive - a.lastActive);
  const todayUsers = allUsers.filter((u) => u.lastLoginDate === currentDailyKey).map((u) => ({
    ...u,
    isOnline: now - u.lastActive < 18e3
  })).sort((a, b) => b.lastActive - a.lastActive);
  return { onlineUsers, todayUsers };
}
setInterval(() => {
  const now = Date.now();
  activeRankedMatches.forEach((match, id) => {
    if (match.status === "finished" && now - match.createdAt > 6e5) {
      activeRankedMatches.delete(id);
    }
  });
  activeParties.forEach((party, id) => {
    if (party.players.length === 0 || now - party.createdAt > 72e5) {
      activeParties.delete(id);
    }
  });
}, 3e4);
async function startServer() {
  const app = (0, import_express.default)();
  const server = import_http.default.createServer(app);
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  const wss = new import_ws.WebSocketServer({ server, path: "/ws" });
  function broadcastEvent(data) {
    const raw = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === import_ws.WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch {
        }
      }
    });
    const sseMessage = `data: ${raw}

`;
    sseClients.forEach((res) => {
      try {
        res.write(sseMessage);
      } catch {
        sseClients.delete(res);
      }
    });
  }
  function sendToPlayer(playerId, data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const meta = clientMeta.get(client);
      if (client.readyState === import_ws.WebSocket.OPEN && meta?.playerId === playerId) {
        try {
          client.send(message);
        } catch {
        }
      }
    });
  }
  function create1v1Session(p1, p2) {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session = {
      matchId,
      mode: "1vs1",
      status: "countdown",
      seed: Math.floor(Math.random() * 1e5),
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
          finished: false
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
          finished: false
        }
      ]
    };
    activeRankedMatches.set(matchId, session);
    broadcastEvent({
      type: "RANKED_MATCH_FOUND",
      matchId,
      session
    });
  }
  function tryMatchmaking1v1() {
    const roomMap = /* @__PURE__ */ new Map();
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
        const p1 = list.shift();
        const p2 = list.shift();
        const idx1 = rankedQueue1v1.indexOf(p1);
        if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);
        const idx2 = rankedQueue1v1.indexOf(p2);
        if (idx2 >= 0) rankedQueue1v1.splice(idx2, 1);
        create1v1Session(p1, p2);
      }
    }
    const publicList = rankedQueue1v1.filter((p) => !p.roomCode || !p.roomCode.trim());
    while (publicList.length >= 2) {
      const p1 = publicList.shift();
      const p2 = publicList.shift();
      const idx1 = rankedQueue1v1.indexOf(p1);
      if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);
      const idx2 = rankedQueue1v1.indexOf(p2);
      if (idx2 >= 0) rankedQueue1v1.splice(idx2, 1);
      create1v1Session(p1, p2);
    }
  }
  function tryMatchmaking2v2() {
    if (rankedQueue2v2.length >= 4) {
      const matchedPlayers = [];
      while (matchedPlayers.length < 4 && rankedQueue2v2.length > 0) {
        matchedPlayers.push(rankedQueue2v2.shift());
      }
      if (matchedPlayers.length === 4) {
        const partyGroups = /* @__PURE__ */ new Map();
        const soloPlayers = [];
        matchedPlayers.forEach((p) => {
          if (p.partyId) {
            const list = partyGroups.get(p.partyId) || [];
            list.push(p);
            partyGroups.set(p.partyId, list);
          } else {
            soloPlayers.push(p);
          }
        });
        let teamRedQueue = [];
        let teamBlueQueue = [];
        partyGroups.forEach((group) => {
          if (teamRedQueue.length + group.length <= 2) {
            teamRedQueue.push(...group);
          } else if (teamBlueQueue.length + group.length <= 2) {
            teamBlueQueue.push(...group);
          } else {
            soloPlayers.push(...group);
          }
        });
        for (let i = soloPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [soloPlayers[i], soloPlayers[j]] = [soloPlayers[j], soloPlayers[i]];
        }
        while (soloPlayers.length > 0) {
          const p = soloPlayers.pop();
          if (teamRedQueue.length < 2) {
            teamRedQueue.push(p);
          } else {
            teamBlueQueue.push(p);
          }
        }
        const teamRedPlayers = teamRedQueue.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          rating: p.rating,
          rankTier: p.rankTier,
          team: "red",
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false
        }));
        const teamBluePlayers = teamBlueQueue.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          rating: p.rating,
          rankTier: p.rankTier,
          team: "blue",
          progress: 0,
          score: 0,
          mistakes: 0,
          lives: 3,
          isKO: false,
          finished: false
        }));
        const matchId = `match2v2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const session = {
          matchId,
          mode: "2vs2",
          status: "countdown",
          seed: Math.floor(Math.random() * 1e5),
          createdAt: Date.now(),
          players: [...teamRedPlayers, ...teamBluePlayers],
          teams: {
            teamRed: teamRedPlayers,
            teamBlue: teamBluePlayers
          }
        };
        activeRankedMatches.set(matchId, session);
        broadcastEvent({
          type: "RANKED_MATCH_FOUND",
          matchId,
          session
        });
      }
    }
  }
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: "PRESENCE_SNAPSHOT", ...getPresenceSnapshot() })}

`);
    const pingTimer = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(pingTimer);
        sseClients.delete(res);
      }
    }, 15e3);
    req.on("close", () => {
      clearInterval(pingTimer);
      sseClients.delete(res);
    });
  });
  app.post("/api/presence/heartbeat", (req, res) => {
    const { id, name, avatarUrl, rating, rankTier } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "id and name are required" });
    }
    if (String(id).toLowerCase().includes("bot") || String(name).toLowerCase().includes("bot")) {
      return res.status(400).json({ error: "Bots cannot be registered as presence users" });
    }
    const currentDailyKey = getCurrentDailyCycleKey();
    const existing = presenceMap.get(id);
    const updatedUser = {
      id,
      name: name.trim(),
      avatarUrl: avatarUrl || existing?.avatarUrl || null,
      rating: typeof rating === "number" ? rating : existing?.rating || 0,
      rankTier: rankTier || existing?.rankTier || "bronze",
      lastActive: Date.now(),
      lastLoginDate: currentDailyKey
    };
    presenceMap.set(id, updatedUser);
    savePresenceCache();
    broadcastEvent({
      type: "PRESENCE_SNAPSHOT",
      ...getPresenceSnapshot()
    });
    res.json({ success: true, user: updatedUser });
  });
  app.get("/api/presence/members", (req, res) => {
    res.json(getPresenceSnapshot());
  });
  const ADMIN_SALT_PREFIX = "uow_admin_salt_";
  const ADMIN_SALT_SUFFIX = "_2026";
  const ADMIN_EXPECTED_HASH = "191527bb4da18539d86c9f6956b71fa0d44ec350a560ca49dc0f14889779f6f8";
  const activeBansMap = /* @__PURE__ */ new Map();
  app.post("/api/admin/verify", (req, res) => {
    const { code } = req.body;
    const clean = String(code || "").trim().toLowerCase();
    const salted = `${ADMIN_SALT_PREFIX}${clean}${ADMIN_SALT_SUFFIX}`;
    const hash = import_crypto.default.createHash("sha256").update(salted).digest("hex");
    if (hash === ADMIN_EXPECTED_HASH) {
      const token = `adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, error: "\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002" });
  });
  app.post("/api/admin/roulette/trigger", (req, res) => {
    const { event } = req.body;
    if (!event) return res.status(400).json({ error: "event required" });
    broadcastEvent({
      type: "BAN_ROULETTE_TRIGGERED",
      event
    });
    res.json({ success: true });
  });
  app.get("/api/admin/bans", (req, res) => {
    res.json({ bans: Array.from(activeBansMap.values()) });
  });
  app.post("/api/admin/bans/report", (req, res) => {
    const { ban } = req.body;
    if (ban && ban.userId) {
      activeBansMap.set(ban.userId, ban);
    }
    res.json({ success: true });
  });
  app.post("/api/admin/bans/unban", (req, res) => {
    const { userId } = req.body;
    if (userId) {
      activeBansMap.delete(userId);
      broadcastEvent({
        type: "BAN_REMOVED",
        userId
      });
    }
    res.json({ success: true });
  });
  app.post("/api/ai/generate-question", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const prompt = `\u3042\u306A\u305F\u306F\u82F1\u691C4\u7D1A\u301C5\u7D1A\u5411\u3051\u306E\u82F1\u8A9E\u5B66\u7FD2\u30A2\u30D7\u30EA\u300C\u3046\u304A\u30EA\u30F3\u30B4\u300D\u306E\u5C02\u5C5EAI\u554F\u984C\u4F5C\u6210\u8005\u3067\u3059\u3002
\u5C0F\u5B66\u751F\u3084\u4E2D\u5B66\u751F\u304C\u30EF\u30AF\u30EF\u30AF\u3059\u308B\u3088\u3046\u306A\u3001\u697D\u3057\u304F\u3066\u8EAB\u306B\u306A\u308B\u30AA\u30EA\u30B8\u30CA\u30EB\u82F1\u8A9E\u30AF\u30A4\u30BA\u30921\u554F\u3060\u3051\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u5F62\u5F0F\u306F\u4EE5\u4E0B\u306E5\u7A2E\u985E\u306E\u4E2D\u304B\u3089\u30E9\u30F3\u30C0\u30E0\u306B1\u3064\u9078\u3093\u3067\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\uFF1A
1. 'correct_sentence' (\u300C\u6587\u304C\u5408\u3063\u3066\u308B\u306E\u306F\u3069\u308C\uFF1F\u300D\u554F\u984C: 4\u3064\u306E\u9078\u629E\u80A2\u306E\u4E2D\u306B1\u3064\u3060\u3051\u6587\u6CD5\u30FB\u30B9\u30DA\u30EB\u304C\u6B63\u3057\u3044\u6587\u304C\u3042\u308A\u3001\u6B8B\u308A\u306E3\u3064\u306F\u5FAE\u5999\u306A\u30B9\u30DA\u30EB\u30DF\u30B9\u30843\u5358\u73FE\u30DF\u30B9\u3001be\u52D5\u8A5E\u30DF\u30B9\u306A\u3069\u5DE7\u5999\u306A\u8AA4\u308A\u306B\u306A\u3063\u3066\u3044\u308B\u554F\u984C\u3002japanese\u306B\u306F\u300C\u6587\u304C\u5408\u3063\u3066\u308B\u306E\u306F\u3069\u308C\uFF1F\\n\uFF08\u610F\u5473: \u301C\uFF09\u300D\u3001choices\u306B4\u3064\u306E\u6587\u3001correctAnswer\u306B\u6B63\u3057\u3044\u6587)
2. 'matching' (\u70B9\u7E4B\u304E\u554F\u984C: \u611F\u60C5\u3001\u65E5\u5E38\u52D5\u4F5C\u3001\u5929\u6C17\u3001\u52D5\u7269\u3001\u6587\u623F\u5177\u306A\u3069\u306E\u82F1\u5358\u8A9E\u3068\u3001\u5BFE\u5FDC\u3059\u308B\u7D75\u6587\u5B57\u3084\u65E5\u672C\u8A9E\u30924\u7D44)
3. 'blank' (\u7A7A\u6B04\u7A74\u57CB\u3081\u9078\u629E\u554F\u984C: choices\u306B\u9078\u629E\u80A24\u3064\u3001\u6B63\u89E3\u306F\u30E9\u30F3\u30C0\u30E0\u306A\u4F4D\u7F6E)
4. 'order' (\u8A9E\u9806\u4E26\u3079\u66FF\u3048\u554F\u984C: wordOptions\u306B5\u301C6\u5358\u8A9E)
5. 'translate' (\u5358\u8A9E\u307E\u305F\u306F\u30D5\u30EC\u30FC\u30BA\u306E\u610F\u5473\u9078\u629E: choices\u306B\u9078\u629E\u80A24\u3064)

\u5FC5\u305A\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u306E\u307F\u3092\u8FD4\u3057\u3066\u304F\u3060\u3055\u3044\u3002Markdown\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u306A\u3069\u306F\u4ED8\u3051\u305A\u3001\u7D14\u7C8B\u306AJSON\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF1A
{
  "id": "ai_gen_${Date.now()}",
  "type": "correct_sentence" | "matching" | "blank" | "order" | "translate",
  "difficulty": "5kyu",
  "japanese": "\u554F\u984C\u6587\uFF08\u4F8B: \u300C\u6587\u304C\u5408\u3063\u3066\u308B\u306E\u306F\u3069\u308C\uFF1F\\n\uFF08\u610F\u5473: \u79C1\u306F\u72AC\u3092\u98FC\u3063\u3066\u3044\u307E\u3059\u3002\uFF09\u300D\u3001\u307E\u305F\u306F\u300C\u3007\u3007\u3092\u7DDA\u3067\u7E4B\u3054\u3046\uFF01\u300D\u306A\u3069\uFF09",
  "english": "\u6A21\u7BC4\u89E3\u7B54\u306E\u82F1\u6587\u307E\u305F\u306F\u5358\u8A9E (\u4F8B: I have a dog.)",
  "promptSentence": "\u7A7A\u6B04\u88DC\u5145\u306E\u5834\u5408\u306E\u82F1\u6587\uFF08\u4F8B: I ____ my homework every day. \u7A7A\u6B04\u306F____\uFF09",
  "choices": ["I have a dog.", "I have a dogs.", "I habe a dog.", "I have a dok."],
  "correctAnswer": "\u6B63\u89E3\u306E\u6587\u5B57\u5217\uFF08\u4F8B: I have a dog.\u3001matching\u306A\u3089'all'\uFF09",
  "wordOptions": ["word1", "word2", "word3", "word4", "word5"],
  "matchingPairs": [
    { "id": "p1", "left": "happy", "right": "\u263A\uFE0F \u3046\u308C\u3057\u3044" },
    { "id": "p2", "left": "sad", "right": "\u{1F622} \u304B\u306A\u3057\u3044" },
    { "id": "p3", "left": "good", "right": "\u{1F44D} \u3088\u3044" },
    { "id": "p4", "left": "angry", "right": "\u{1F621} \u304A\u3053\u3063\u305F" }
  ],
  "explanation": "\u5B50\u4F9B\u306B\u3082\u308F\u304B\u308A\u3084\u3059\u3044\u4E01\u5BE7\u3067\u660E\u308B\u3044\u89E3\u8AAC",
  "isAiGenerated": true
}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text ? response.text.trim() : "";
      if (!text) {
        return res.status(500).json({ error: "Empty response from Gemini" });
      }
      const question = JSON.parse(text);
      question.isAiGenerated = true;
      if (!question.id) question.id = `ai_gen_${Date.now()}`;
      return res.json({ question });
    } catch (err) {
      console.error("[AI Question Generation Error]:", err?.message || err);
      return res.status(500).json({ error: "Failed to generate question with AI" });
    }
  });
  app.post("/api/ai/judge-handwriting", async (req, res) => {
    try {
      const { imageBase64, japanese, expectedAnswer, acceptableAnswers = [] } = req.body;
      if (!imageBase64 || !expectedAnswer) {
        return res.status(400).json({ error: "imageBase64 and expectedAnswer are required" });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          recognizedText: "",
          isCorrect: false,
          confidence: 0,
          feedback: "Gemini API\u30AD\u30FC\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
          error: true
        });
      }
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const acceptableList = Array.from(/* @__PURE__ */ new Set([
        String(expectedAnswer).trim().toLowerCase(),
        ...acceptableAnswers.map((a) => String(a).trim().toLowerCase())
      ])).filter(Boolean);
      const expectedClean = String(expectedAnswer).replace(/[^a-zA-Z]/g, "").toLowerCase();
      const prompt = `\u3042\u306A\u305F\u306F\u82F1\u8A9E\u5B66\u7FD2\u30A2\u30D7\u30EA\u300C\u3046\u304A\u30EA\u30F3\u30B4\u300D\u306E\u53B3\u683C\u306A\u624B\u66F8\u304D\u6587\u5B57\u8A8D\u8B58(OCR)\u304A\u3088\u3073\u63A1\u70B9AI\u3067\u3059\u3002
\u65E5\u672C\u306E\u5C0F\u30FB\u4E2D\u5B66\u751F\u304C\u63CF\u3044\u305F\u624B\u66F8\u304D\u753B\u50CF\u304C\u9001\u4FE1\u3055\u308C\u307E\u3057\u305F\u3002

\u3010\u554F\u984C\u65E5\u672C\u8A9E\u3011\uFF1A${japanese || "\u82F1\u8A9E\u3067\u66F8\u3044\u3066\u307F\u3088\u3046"}
\u3010\u6A21\u7BC4\u6B63\u89E3\u3011\uFF1A${expectedAnswer}\uFF08${expectedClean.length}\u6587\u5B57\uFF09
\u3010\u8A31\u5BB9\u6B63\u89E3\u3011\uFF1A${acceptableList.join(", ")}

\u4EE5\u4E0B\u306E\u53B3\u683C\u306A\u57FA\u6E96\u306B\u5F93\u3063\u3066\u3001\u4E0D\u6B63\u3084\u9069\u5F53\u306A\u843D\u66F8\u304D\u3092\u5B8C\u5168\u306B\u6392\u9664\u3057\u3066\u5224\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\uFF1A

1. \u3010\u9069\u5F53\u306A\u843D\u66F8\u304D\u30FB\u6CE2\u7DDA\u30FB\u6BB4\u308A\u66F8\u304D\u306E\u53B3\u683C\u306A\u6392\u9664\uFF08\u6700\u91CD\u8981\uFF09\u3011:
   - \u30E6\u30FC\u30B6\u30FC\u304C\u300C\u9069\u5F53\u306A\u843D\u66F8\u304D\u300D\u300C\u5358\u306A\u308B\u6CE2\u7DDA\u300D\u300C\u3050\u308B\u3050\u308B\u63CF\u3044\u305F\u3060\u3051\u306E\u7DDA\u300D\u300C\u610F\u5473\u306E\u306A\u3044\u30B8\u30B0\u30B6\u30B0\u300D\u300C\u6A2A\u4E00\u672C\u306E\u7DDA\u300D\u3092\u63CF\u3044\u305F\u5834\u5408\u3001\u7D76\u5BFE\u306B\u597D\u610F\u7684\u306B\u63A8\u6E2C\u3057\u3066\u6B63\u89E3\u306E\u5358\u8A9E\u3068\u307F\u306A\u3057\u3066\u306F\u3044\u3051\u307E\u305B\u3093\uFF01
   - \u5404\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u56FA\u6709\u306E\u5F62\u72B6\uFF08\u4F8B: 'h'\u306E\u7E26\u68D2\u3068\u30A2\u30FC\u30C1\u3001'a'\u306E\u4E38\u3068\u53F3\u68D2\u3001'p'\u306E\u4E0B\u306B\u7A81\u304D\u51FA\u305F\u7E26\u68D2\u3068\u4E38\u306A\u3069\uFF09\u304C\u660E\u78BA\u306B\u78BA\u8A8D\u3067\u304D\u306A\u3044\u5834\u5408\u306F\u3001rawTranscription\u304A\u3088\u3073recognizedText\u3092\u300C(\u5224\u8AAD\u4E0D\u80FD)\u300D\u307E\u305F\u306F\u300C(\u843D\u66F8\u304D)\u300D\u3068\u3057\u3001\u5FC5\u305A isCorrect: false \u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002
   - \u6A21\u7BC4\u89E3\u7B54\u300C${expectedAnswer}\u300D\u306F ${expectedClean.length}\u6587\u5B57\u3067\u3059\u3002\u72EC\u7ACB\u3057\u3066\u8AAD\u3081\u308B\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u304C ${expectedClean.length}\u6587\u5B57\u5206\u63C3\u3063\u3066\u3044\u306A\u3044\u5834\u5408\uFF08\u9014\u4E2D\u3067\u8AE6\u3081\u305F\u7DDA\u30841\u301C2\u6587\u5B57\u3057\u304B\u306A\u3044\u5834\u5408\uFF09\u306F\u7D76\u5BFE\u306B\u4E0D\u5408\u683C\uFF08isCorrect: false\uFF09\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002

2. \u3010\u6B63\u8AA4\u5224\u5B9A\u306E\u57FA\u6E96\u3011:
   - \u753B\u50CF\u304B\u3089\u8AAD\u307F\u53D6\u308C\u305F\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u306E\u307F\u3092\u5C0F\u6587\u5B57\u3067\u300CrecognizedText\u300D\u306B\u8A18\u9332\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B: "happy", "hapy", "(\u5224\u8AAD\u4E0D\u80FD)"\uFF09\u3002
   - recognizedText\u304C\u6A21\u7BC4\u6B63\u89E3\u300C${expectedClean}\u300D\u307E\u305F\u306F\u8A31\u5BB9\u6B63\u89E3\u306E\u30B9\u30DA\u30EB\u3068\u3001\u4E00\u6587\u5B57\u305A\u3064\u5B8C\u5168\u306B\u4E00\u81F4\u3057\u3066\u3044\u308B\u5834\u5408\u306E\u307F\u300CisCorrect: true\u300D\u3068\u3057\u307E\u3059\u3002
   - \u30B9\u30DA\u30EB\u30DF\u30B9\u3001\u6587\u5B57\u306E\u4E0D\u8DB3\u30FB\u904E\u5270\u3001\u5224\u8AAD\u4E0D\u80FD\u306A\u6587\u5B57\u304C1\u6587\u5B57\u3067\u3082\u3042\u308B\u5834\u5408\u306F\u3001\u3059\u3079\u3066\u300CisCorrect: false\u300D\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002
   - \u300C\u306A\u3093\u3068\u306A\u304F\u96F0\u56F2\u6C17\u304C\u4F3C\u3066\u3044\u308B\u304B\u3089\u300D\u300C\u5B50\u4F9B\u304C\u9069\u5F53\u306B\u63CF\u3044\u305F\u304B\u3082\u3057\u308C\u306A\u3044\u304B\u3089\u300D\u3068\u3044\u3063\u305F\u5FD6\u5EA6\u306B\u3088\u308B\u7518\u3044\u5408\u683C\u5224\u5B9A\u306F\u53B3\u7981\u3067\u3059\u3002

3. \u3010\u5177\u4F53\u7684\u306A\u65E5\u672C\u8A9E\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u3011:
   - \u6B63\u89E3\u6642: \u300C\u300E${expectedAnswer}\u300F\u3068\u304D\u308C\u3044\u306B\u6B63\u3057\u304F\u66F8\u3051\u307E\u3057\u305F\uFF01\u30B9\u30DA\u30EB\u3082\u5B8C\u74A7\u3067\u3059\uFF01\u{1F389}\u300D
   - \u843D\u66F8\u304D\u30FB\u5224\u8AAD\u4E0D\u80FD\u6642: \u300C\u6587\u5B57\u306E\u5F62\u304C\u306F\u3063\u304D\u308A\u3068\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u9069\u5F53\u306A\u7DDA\u3067\u306F\u306A\u304F\u3001\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u30921\u6587\u5B57\u305A\u3064\u4E01\u5BE7\u306B\u306F\u3063\u304D\u308A\u66F8\u3044\u3066\u307F\u3088\u3046\uFF01\u270D\uFE0F\u300D
   - \u30B9\u30DA\u30EB\u9055\u3044\u6642: \u300C\u300E\u3007\u3007\u300F\u3068\u66F8\u304B\u308C\u3066\u3044\u307E\u3059\u3002\u6B63\u89E3\u306F\u300E${expectedAnswer}\u300F\u3067\u3059\u3002\u30B9\u30DA\u30EB\u3092\u3088\u304F\u78BA\u304B\u3081\u3066\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3088\u3046\uFF01\u300D

\u6307\u5B9A\u3055\u308C\u305FJSON\u30B9\u30AD\u30FC\u30DE\u306B\u5F93\u3063\u3066\u53B3\u5BC6\u306B\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              rawTranscription: {
                type: import_genai.Type.STRING,
                description: "Exact physical letters seen on the image from left to right, or (\u5224\u8AAD\u4E0D\u80FD)/(\u843D\u66F8\u304D) if not legible."
              },
              recognizedText: {
                type: import_genai.Type.STRING,
                description: "Clean English word in lowercase without spaces, or (\u5224\u8AAD\u4E0D\u80FD)."
              },
              isCorrect: {
                type: import_genai.Type.BOOLEAN,
                description: "True ONLY if all letters of the word are clearly formed and exactly match the target spelling."
              },
              confidence: {
                type: import_genai.Type.NUMBER,
                description: "Recognition confidence score between 0.0 and 1.0."
              },
              feedback: {
                type: import_genai.Type.STRING,
                description: "Polite, clear, and encouraging feedback in Japanese."
              }
            },
            required: ["rawTranscription", "recognizedText", "isCorrect", "feedback"]
          },
          temperature: 0
        }
      });
      const text = response.text ? response.text.trim() : "";
      if (!text) {
        return res.status(500).json({
          recognizedText: "",
          isCorrect: false,
          confidence: 0,
          feedback: "AI\u304B\u3089\u306E\u5224\u5B9A\u7D50\u679C\u304C\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002"
        });
      }
      const result = JSON.parse(text);
      const rawRecognized = String(result.recognizedText || "").trim();
      const rawTrans = String(result.rawTranscription || "").trim();
      const cleanRecognized = rawRecognized.replace(/[^a-zA-Z]/g, "").toLowerCase();
      const normalizedTargets = [
        expectedClean,
        ...acceptableList.map((a) => a.replace(/[^a-zA-Z]/g, "").toLowerCase())
      ].filter(Boolean);
      const isScribble = rawRecognized.includes("\u5224\u8AAD\u4E0D\u80FD") || rawRecognized.includes("\u843D\u66F8\u304D") || rawTrans.includes("\u5224\u8AAD\u4E0D\u80FD") || rawTrans.includes("\u843D\u66F8\u304D") || cleanRecognized.length === 0;
      const isExactWordMatch = cleanRecognized.length > 0 && normalizedTargets.includes(cleanRecognized);
      const isLengthMatch = cleanRecognized.length === expectedClean.length;
      const isAiConfirmed = Boolean(result.isCorrect);
      const isActuallyCorrect = !isScribble && isExactWordMatch && isLengthMatch && isAiConfirmed;
      const finalRecognized = isScribble ? "(\u5224\u8AAD\u4E0D\u80FD)" : cleanRecognized || rawRecognized;
      let finalFeedback = result.feedback;
      if (!isActuallyCorrect) {
        if (isScribble) {
          finalFeedback = "\u6587\u5B57\u304C\u306F\u3063\u304D\u308A\u3068\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u9069\u5F53\u306A\u7DDA\u3067\u306F\u306A\u304F\u3001\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u306E\u5F62\u30921\u6587\u5B57\u305A\u3064\u3066\u3044\u306D\u3044\u306B\u66F8\u3044\u3066\u306D\uFF01\u270D\uFE0F";
        } else if (cleanRecognized && !isExactWordMatch) {
          finalFeedback = `\u300C${cleanRecognized}\u300D\u3068\u8AAD\u307F\u53D6\u308C\u307E\u3057\u305F\u3002\u6B63\u89E3\u306F\u300C${expectedAnswer}\u300D\u3067\u3059\u3002\u30B9\u30DA\u30EB\u3092\u3088\u304F\u78BA\u304B\u3081\u3066\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3088\u3046\uFF01`;
        } else {
          finalFeedback = `\u6B63\u89E3\u306F\u300C${expectedAnswer}\u300D\u3067\u3059\u30024\u672C\u7DDA\u306E\u30CE\u30FC\u30C8\u306B\u5408\u308F\u305B\u3066\u4E01\u5BE7\u306B\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3088\u3046\uFF01`;
        }
      }
      return res.json({
        rawTranscription: rawTrans,
        recognizedText: finalRecognized,
        isCorrect: isActuallyCorrect,
        confidence: typeof result.confidence === "number" ? result.confidence : isActuallyCorrect ? 0.95 : 0.2,
        feedback: finalFeedback || (isActuallyCorrect ? `\u300C${expectedAnswer}\u300D\u3068\u304D\u308C\u3044\u306B\u66F8\u3051\u307E\u3057\u305F\uFF01\u6B63\u89E3\u3067\u3059\uFF01\u{1F389}` : `\u6B63\u89E3\u306F\u300C${expectedAnswer}\u300D\u3067\u3059\u3002\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3088\u3046\uFF01`)
      });
    } catch (err) {
      console.error("[AI Handwriting Judgment Error]:", err?.message || err);
      return res.status(500).json({
        recognizedText: "",
        isCorrect: false,
        confidence: 0,
        feedback: "AI\u63A1\u70B9\u30B5\u30FC\u30D0\u30FC\u3068\u306E\u901A\u4FE1\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u300C\u7B54\u3048\u5408\u308F\u305B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        error: true
      });
    }
  });
  app.post("/api/ranked/queue", (req, res) => {
    const { player, mode, partyId, roomCode } = req.body;
    if (!player || !player.id || !mode) {
      return res.status(400).json({ error: "player and mode are required" });
    }
    const cleanQueue = (q) => {
      const idx = q.findIndex((p) => p.id === player.id);
      if (idx >= 0) q.splice(idx, 1);
    };
    cleanQueue(rankedQueue1v1);
    cleanQueue(rankedQueue2v2);
    const queuePlayer = {
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      rating: player.rating || 0,
      rankTier: player.rankTier || "bronze",
      joinedAt: Date.now(),
      partyId: partyId || null,
      roomCode: roomCode ? String(roomCode).trim().toUpperCase() : null
    };
    if (mode === "1vs1") {
      rankedQueue1v1.push(queuePlayer);
      tryMatchmaking1v1();
    } else if (mode === "2vs2") {
      rankedQueue2v2.push(queuePlayer);
      tryMatchmaking2v2();
    }
    broadcastEvent({
      type: "QUEUE_STATUS",
      queue1v1Count: rankedQueue1v1.length,
      queue2v2Count: rankedQueue2v2.length
    });
    res.json({
      success: true,
      queue1v1Count: rankedQueue1v1.length,
      queue2v2Count: rankedQueue2v2.length
    });
  });
  app.post("/api/ranked/cancel-queue", (req, res) => {
    const { playerId } = req.body;
    if (playerId) {
      const idx1 = rankedQueue1v1.findIndex((p) => p.id === playerId);
      if (idx1 >= 0) rankedQueue1v1.splice(idx1, 1);
      const idx2 = rankedQueue2v2.findIndex((p) => p.id === playerId);
      if (idx2 >= 0) rankedQueue2v2.splice(idx2, 1);
      broadcastEvent({
        type: "QUEUE_STATUS",
        queue1v1Count: rankedQueue1v1.length,
        queue2v2Count: rankedQueue2v2.length
      });
    }
    res.json({ success: true });
  });
  app.get("/api/ranked/matches/:id", (req, res) => {
    const match = activeRankedMatches.get(req.params.id);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    res.json(match);
  });
  app.post("/api/ranked/progress", (req, res) => {
    const { matchId, playerId, progress, score, mistakes, lives, isKO, finished } = req.body;
    const match = activeRankedMatches.get(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    match.status = "in_game";
    const player = match.players.find((p) => p.id === playerId);
    if (player) {
      player.progress = progress;
      player.score = score;
      player.mistakes = mistakes;
      if (typeof lives === "number") player.lives = lives;
      if (typeof isKO === "boolean") player.isKO = isKO;
      player.finished = finished;
      if (finished && !player.finishTime) {
        player.finishTime = Date.now();
      }
    }
    let matchFinished = false;
    let winnerSide = void 0;
    let winnerIds = [];
    if (match.mode === "1vs1") {
      const p1 = match.players[0];
      const p2 = match.players[1];
      if (p1 && p2) {
        if (p1.finished && !p2.finished) {
          matchFinished = true;
          winnerSide = "player1";
          winnerIds = [p1.id];
        } else if (p2.finished && !p1.finished) {
          matchFinished = true;
          winnerSide = "player2";
          winnerIds = [p2.id];
        } else if (p1.isKO && !p2.isKO) {
          matchFinished = true;
          winnerSide = "player2";
          winnerIds = [p2.id];
        } else if (p2.isKO && !p1.isKO) {
          matchFinished = true;
          winnerSide = "player1";
          winnerIds = [p1.id];
        } else if (p1.isKO && p2.isKO) {
          matchFinished = true;
          winnerSide = p1.score >= p2.score ? "player1" : "player2";
          winnerIds = p1.score >= p2.score ? [p1.id] : [p2.id];
        }
      }
    } else if (match.mode === "2vs2") {
      const teamRed = match.players.filter((p) => p.team === "red");
      const teamBlue = match.players.filter((p) => p.team === "blue");
      const redFinishedCount = teamRed.filter((p) => p.finished).length;
      const blueFinishedCount = teamBlue.filter((p) => p.finished).length;
      const redAllKO = teamRed.every((p) => p.isKO);
      const blueAllKO = teamBlue.every((p) => p.isKO);
      if (redFinishedCount >= 1 && blueFinishedCount === 0) {
        matchFinished = true;
        winnerSide = "teamRed";
        winnerIds = teamRed.map((p) => p.id);
      } else if (blueFinishedCount >= 1 && redFinishedCount === 0) {
        matchFinished = true;
        winnerSide = "teamBlue";
        winnerIds = teamBlue.map((p) => p.id);
      } else if (redAllKO && !blueAllKO) {
        matchFinished = true;
        winnerSide = "teamBlue";
        winnerIds = teamBlue.map((p) => p.id);
      } else if (blueAllKO && !redAllKO) {
        matchFinished = true;
        winnerSide = "teamRed";
        winnerIds = teamRed.map((p) => p.id);
      }
    }
    if (matchFinished && match.status !== "finished") {
      match.status = "finished";
      match.winnerSide = winnerSide;
      match.winnerIds = winnerIds;
    }
    broadcastEvent({
      type: "RANKED_PROGRESS_UPDATE",
      matchId,
      match,
      playerId,
      progress,
      score,
      mistakes,
      lives,
      isKO,
      finished
    });
    if (matchFinished) {
      broadcastEvent({
        type: "RANKED_MATCH_FINISHED",
        matchId,
        match,
        winnerSide,
        winnerIds
      });
    }
    res.json({ success: true, match });
  });
  app.post("/api/ranked/forfeit", (req, res) => {
    const { matchId, playerId } = req.body;
    const match = activeRankedMatches.get(matchId);
    if (match && match.status !== "finished") {
      match.status = "finished";
      const forfeitingPlayer = match.players.find((p) => p.id === playerId);
      if (forfeitingPlayer) {
        forfeitingPlayer.isKO = true;
        forfeitingPlayer.lives = 0;
      }
      const winners = match.players.filter((p) => p.id !== playerId);
      match.winnerIds = winners.map((w) => w.id);
      match.winnerSide = match.mode === "1vs1" ? "player2" : "teamBlue";
      broadcastEvent({
        type: "RANKED_FORFEIT_OCCURRED",
        matchId,
        forfeitedPlayerId: playerId,
        match,
        winnerIds: match.winnerIds
      });
    }
    res.json({ success: true });
  });
  app.post("/api/parties/create", (req, res) => {
    const { leader } = req.body;
    if (!leader || !leader.id) {
      return res.status(400).json({ error: "Leader is required" });
    }
    const partyId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newParty = {
      partyId,
      leaderId: leader.id,
      players: [leader],
      createdAt: Date.now()
    };
    activeParties.set(partyId, newParty);
    broadcastEvent({ type: "PARTY_UPDATED", party: newParty });
    res.json({ success: true, party: newParty });
  });
  app.post("/api/parties/join", (req, res) => {
    const { partyId, player } = req.body;
    const party = activeParties.get((partyId || "").toUpperCase());
    if (!party) {
      return res.status(404).json({ error: "\u30D1\u30FC\u30C6\u30A3\u30FC\u30B3\u30FC\u30C9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" });
    }
    if (party.players.length >= 2 && !party.players.some((p) => p.id === player.id)) {
      return res.status(400).json({ error: "\u3053\u306E\u30D1\u30FC\u30C6\u30A3\u30FC\u306F\u3059\u3067\u306B\u6E80\u54E1\u3067\u3059 (\u6700\u59272\u4EBA)" });
    }
    if (!party.players.some((p) => p.id === player.id)) {
      party.players.push(player);
    }
    broadcastEvent({ type: "PARTY_UPDATED", party });
    res.json({ success: true, party });
  });
  app.post("/api/parties/leave", (req, res) => {
    const { partyId, playerId } = req.body;
    const party = activeParties.get((partyId || "").toUpperCase());
    if (party) {
      party.players = party.players.filter((p) => p.id !== playerId);
      if (party.players.length === 0) {
        activeParties.delete(party.partyId);
      } else if (party.leaderId === playerId) {
        party.leaderId = party.players[0].id;
      }
      broadcastEvent({ type: "PARTY_UPDATED", party: party.players.length > 0 ? party : null });
    }
    res.json({ success: true });
  });
  wss.on("connection", (ws) => {
    clientMeta.set(ws, { playerId: "", name: "" });
    ws.send(JSON.stringify({ type: "PRESENCE_SNAPSHOT", ...getPresenceSnapshot() }));
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clientMeta.get(ws);
        switch (msg.type) {
          case "IDENTIFY": {
            if (meta) {
              meta.playerId = msg.playerId || `user_${Date.now()}`;
              meta.name = msg.name || "\u4F1A\u54E1";
            }
            break;
          }
          case "GET_PRESENCE": {
            ws.send(JSON.stringify({ type: "PRESENCE_SNAPSHOT", ...getPresenceSnapshot() }));
            break;
          }
        }
      } catch (e) {
        console.debug("WS message parse error:", e);
      }
    });
    ws.on("close", () => {
      const meta = clientMeta.get(ws);
      if (meta && meta.playerId) {
        const q1Idx = rankedQueue1v1.findIndex((p) => p.id === meta.playerId);
        if (q1Idx >= 0) rankedQueue1v1.splice(q1Idx, 1);
        const q2Idx = rankedQueue2v2.findIndex((p) => p.id === meta.playerId);
        if (q2Idx >= 0) rankedQueue2v2.splice(q2Idx, 1);
        let hasOtherSocket = false;
        clientMeta.forEach((otherMeta, otherWs) => {
          if (otherWs !== ws && otherMeta.playerId === meta.playerId && otherWs.readyState === import_ws.WebSocket.OPEN) {
            hasOtherSocket = true;
          }
        });
        if (!hasOtherSocket) {
          const user = presenceMap.get(meta.playerId);
          if (user) {
            user.lastActive = 0;
          }
          broadcastEvent({
            type: "PRESENCE_SNAPSHOT",
            ...getPresenceSnapshot()
          });
          broadcastEvent({
            type: "QUEUE_STATUS",
            queue1v1Count: rankedQueue1v1.length,
            queue2v2Count: rankedQueue2v2.length
          });
        }
      }
      clientMeta.delete(ws);
    });
  });
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      onlineWs: clientMeta.size,
      onlineSse: sseClients.size,
      presenceTotal: presenceMap.size,
      queue1v1: rankedQueue1v1.length,
      queue2v2: rankedQueue2v2.length,
      activeMatches: activeRankedMatches.size
    });
  });
  app.get("/favicon.ico", (req, res) => {
    const iconPath = import_path.default.join(process.cwd(), "public", "favicon.svg");
    if (import_fs.default.existsSync(iconPath)) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.sendFile(iconPath);
    } else {
      res.status(204).end();
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/ws")) return next();
      try {
        const url = req.originalUrl;
        const indexPath = import_path.default.resolve(process.cwd(), "index.html");
        let template = await import_fs.default.promises.readFile(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({
          "Content-Type": "text/html",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      setHeaders: (res, path2) => {
        if (path2.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/ws")) return next();
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} with Presence Engine`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map

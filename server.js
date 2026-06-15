/**
 * Soirée Quiz — Stéphane & Marie
 * Serveur Node.js + Express + Socket.IO
 *
 * Deux interfaces :
 *   - /host : écran présentateur (TV / vidéoprojecteur)
 *   - /     : interface joueur (mobile)
 */

const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const QUESTIONS = require("./questions");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Augmente la tolérance réseau pour les mobiles (50+ joueurs)
  pingTimeout: 25000,
  pingInterval: 20000,
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint utilisé par l'écran présentateur pour récupérer l'URL publique + QR code.
app.get("/api/connect-info", async (req, res) => {
  const url = resolvePublicUrl(req);
  try {
    const qr = await QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#1a0b2e", light: "#ffffff" },
    });
    res.json({ url, qr, pin: room.pin });
  } catch (err) {
    res.status(500).json({ error: "QR generation failed", url, pin: room.pin });
  }
});

/* ------------------------------------------------------------------ */
/* Détection de l'URL publique                                         */
/* ------------------------------------------------------------------ */

function localIPv4() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function resolvePublicUrl(req) {
  // 1) Forçage explicite via variable d'environnement
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, "");
  }
  // 2) Derrière un proxy / tunnel (cloudflared, ngrok, Render, Railway…)
  const xfHost = req && req.headers["x-forwarded-host"];
  const xfProto = req && req.headers["x-forwarded-proto"];
  if (xfHost) {
    const proto = (xfProto || "https").split(",")[0].trim();
    return `${proto}://${String(xfHost).split(",")[0].trim()}`;
  }
  // 3) En local : IP de la machine sur le réseau wifi
  return `http://${localIPv4()}:${PORT}`;
}

/* ------------------------------------------------------------------ */
/* État du jeu                                                         */
/* ------------------------------------------------------------------ */

const STATES = {
  LOBBY: "lobby",
  QUESTION: "question",
  REVEAL: "reveal",
  PODIUM: "podium",
};

function makePin() {
  // 6 caractères sans ambiguïté (pas de 0/O/1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const room = {
  pin: makePin(),
  state: STATES.LOBBY,
  players: new Map(), // playerId -> { id, name, score, connected, lastAnswer }
  currentIndex: -1,
  questionStartedAt: 0,
  answers: new Map(), // playerId -> { choice, time, correct, points }
  timer: null,
  timeLeft: 0,
};

const POINTS_BASE = 500;
const POINTS_BONUS = 500;

function publicPlayerList() {
  return Array.from(room.players.values())
    .filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function leaderboard() {
  return Array.from(room.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function currentQuestion() {
  return QUESTIONS[room.currentIndex];
}

// Vue de la question SANS la bonne réponse (envoyée à tous pendant le jeu)
function questionPublic() {
  const q = currentQuestion();
  if (!q) return null;
  return {
    index: room.currentIndex,
    total: QUESTIONS.length,
    text: q.text,
    options: q.options,
    time: q.time || 20,
  };
}

function broadcastPlayers() {
  const list = publicPlayerList();
  io.to("host").emit("players", { players: list, count: list.length });
}

function answerCount() {
  return room.answers.size;
}

/* ------------------------------------------------------------------ */
/* Logique des manches                                                 */
/* ------------------------------------------------------------------ */

function startQuestion() {
  if (room.currentIndex + 1 >= QUESTIONS.length) {
    // Dernière question déjà jouée → podium
    showPodium();
    return;
  }
  room.currentIndex += 1;
  room.state = STATES.QUESTION;
  room.answers = new Map();
  room.questionStartedAt = Date.now();
  const q = questionPublic();
  room.timeLeft = q.time;

  // Réinitialise lastAnswer côté joueurs
  for (const p of room.players.values()) p.lastAnswer = null;

  io.to("host").emit("question", { ...q, answerCount: 0 });
  io.to("players").emit("question", {
    index: q.index,
    total: q.total,
    text: q.text,
    options: q.options,
    time: q.time,
  });

  clearInterval(room.timer);
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.emit("tick", { timeLeft: Math.max(0, room.timeLeft) });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      revealAnswer();
    }
  }, 1000);
}

function computePoints(elapsedMs, totalSec) {
  // 500 pts base + jusqu'à 500 pts bonus selon la rapidité (linéaire)
  const totalMs = totalSec * 1000;
  const frac = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));
  return POINTS_BASE + Math.round(POINTS_BONUS * frac);
}

function revealAnswer() {
  if (room.state !== STATES.QUESTION) return;
  clearInterval(room.timer);
  room.state = STATES.REVEAL;
  const q = currentQuestion();

  // Répartition des votes
  const distribution = [0, 0, 0, 0];
  for (const a of room.answers.values()) {
    if (a.choice >= 0 && a.choice < 4) distribution[a.choice] += 1;
  }

  io.to("host").emit("reveal", {
    index: room.currentIndex,
    correct: q.correct,
    distribution,
    answerCount: answerCount(),
    leaderboard: leaderboard(),
  });

  // Résultat individuel pour chaque joueur
  for (const p of room.players.values()) {
    const a = room.answers.get(p.id);
    const rankList = leaderboard();
    const rank = rankList.findIndex((r) => r.id === p.id) + 1;
    io.to(p.socketId || "").emit("result", {
      correctIndex: q.correct,
      yourChoice: a ? a.choice : null,
      correct: a ? a.correct : false,
      points: a ? a.points : 0,
      score: p.score,
      rank,
      totalPlayers: rankList.length,
    });
  }
}

function showLeaderboard() {
  io.to("host").emit("leaderboard", { leaderboard: leaderboard() });
}

function showPodium() {
  clearInterval(room.timer);
  room.state = STATES.PODIUM;
  const board = leaderboard();
  io.to("host").emit("podium", { podium: board.slice(0, 3), leaderboard: board });
  // Chaque joueur reçoit son classement final
  for (const p of room.players.values()) {
    const rank = board.findIndex((r) => r.id === p.id) + 1;
    io.to(p.socketId || "").emit("finished", {
      rank,
      totalPlayers: board.length,
      score: p.score,
    });
  }
}

function resetGame() {
  clearInterval(room.timer);
  room.state = STATES.LOBBY;
  room.currentIndex = -1;
  room.answers = new Map();
  room.timeLeft = 0;
  for (const p of room.players.values()) {
    p.score = 0;
    p.lastAnswer = null;
  }
  io.emit("reset", { pin: room.pin });
  broadcastPlayers();
}

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */

io.on("connection", (socket) => {
  /* ----- Présentateur ----- */
  socket.on("host:join", () => {
    socket.join("host");
    socket.emit("host:state", {
      pin: room.pin,
      state: room.state,
      players: publicPlayerList(),
      count: publicPlayerList().length,
      question: room.state === STATES.QUESTION ? { ...questionPublic(), answerCount: answerCount() } : null,
      timeLeft: room.timeLeft,
    });
    broadcastPlayers();
  });

  socket.on("host:start", () => {
    if (room.state === STATES.LOBBY || room.state === STATES.PODIUM) {
      if (room.state === STATES.PODIUM) resetGame();
      startQuestion();
    }
  });

  socket.on("host:next", () => {
    if (room.state === STATES.REVEAL || room.state === STATES.LOBBY) {
      startQuestion();
    }
  });

  socket.on("host:reveal", () => {
    if (room.state === STATES.QUESTION) revealAnswer();
  });

  socket.on("host:leaderboard", () => {
    showLeaderboard();
  });

  socket.on("host:restart", () => {
    resetGame();
  });

  /* ----- Joueur ----- */
  socket.on("player:join", (data, ack) => {
    const name = (data && data.name ? String(data.name) : "").trim().slice(0, 20);
    const wantedPin = (data && data.pin ? String(data.pin) : "").trim().toUpperCase();
    const reconnectId = data && data.playerId ? String(data.playerId) : null;

    if (!name) {
      if (ack) ack({ ok: false, error: "Prénom manquant." });
      return;
    }
    if (wantedPin && wantedPin !== room.pin) {
      if (ack) ack({ ok: false, error: "Code de salle incorrect." });
      return;
    }

    let player;
    // Reconnexion par playerId
    if (reconnectId && room.players.has(reconnectId)) {
      player = room.players.get(reconnectId);
      player.connected = true;
      player.socketId = socket.id;
      if (name) player.name = name;
    } else {
      const id = reconnectId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      player = {
        id,
        name,
        score: 0,
        connected: true,
        socketId: socket.id,
        lastAnswer: null,
      };
      room.players.set(id, player);
    }

    socket.data.playerId = player.id;
    socket.join("players");

    if (ack) {
      ack({
        ok: true,
        playerId: player.id,
        pin: room.pin,
        name: player.name,
        score: player.score,
        state: room.state,
      });
    }

    // Resynchronise un joueur qui rejoint en cours de partie
    if (room.state === STATES.QUESTION) {
      const q = questionPublic();
      socket.emit("question", {
        index: q.index,
        total: q.total,
        text: q.text,
        options: q.options,
        time: q.time,
      });
      socket.emit("tick", { timeLeft: Math.max(0, room.timeLeft) });
      // S'il avait déjà répondu, lui rappeler
      const prev = room.answers.get(player.id);
      if (prev) socket.emit("answer:locked", { choice: prev.choice });
    } else if (room.state === STATES.REVEAL) {
      const q = currentQuestion();
      const a = room.answers.get(player.id);
      const board = leaderboard();
      const rank = board.findIndex((r) => r.id === player.id) + 1;
      socket.emit("result", {
        correctIndex: q.correct,
        yourChoice: a ? a.choice : null,
        correct: a ? a.correct : false,
        points: a ? a.points : 0,
        score: player.score,
        rank,
        totalPlayers: board.length,
      });
    } else if (room.state === STATES.PODIUM) {
      const board = leaderboard();
      const rank = board.findIndex((r) => r.id === player.id) + 1;
      socket.emit("finished", { rank, totalPlayers: board.length, score: player.score });
    }

    broadcastPlayers();
  });

  socket.on("player:answer", (data, ack) => {
    if (room.state !== STATES.QUESTION) {
      if (ack) ack({ ok: false, error: "Pas de question en cours." });
      return;
    }
    const playerId = socket.data.playerId;
    const player = playerId && room.players.get(playerId);
    if (!player) {
      if (ack) ack({ ok: false, error: "Joueur inconnu." });
      return;
    }
    if (room.answers.has(player.id)) {
      if (ack) ack({ ok: false, error: "Déjà répondu." });
      return;
    }
    const choice = Number(data && data.choice);
    if (!(choice >= 0 && choice <= 3)) {
      if (ack) ack({ ok: false, error: "Choix invalide." });
      return;
    }

    const q = currentQuestion();
    const elapsed = Date.now() - room.questionStartedAt;
    const isCorrect = choice === q.correct;
    const points = isCorrect ? computePoints(elapsed, q.time || 20) : 0;
    player.score += points;
    player.lastAnswer = choice;

    room.answers.set(player.id, { choice, time: elapsed, correct: isCorrect, points });

    if (ack) ack({ ok: true, choice });
    socket.emit("answer:locked", { choice });

    // Informe le présentateur du nombre de réponses
    io.to("host").emit("answerCount", { answerCount: answerCount(), total: publicPlayerList().length });

    // Tout le monde a répondu → on révèle
    const activePlayers = publicPlayerList().length;
    if (activePlayers > 0 && answerCount() >= activePlayers) {
      revealAnswer();
    }
  });

  socket.on("disconnect", () => {
    const playerId = socket.data.playerId;
    if (playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      p.connected = false;
      broadcastPlayers();
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const url = resolvePublicUrl(null);
  console.log("\n  🎉  Soirée Quiz — Stéphane & Marie");
  console.log("  ───────────────────────────────────────");
  console.log(`  Présentateur : ${url}/host`);
  console.log(`  Joueurs      : ${url}`);
  console.log(`  Code salle   : ${room.pin}`);
  console.log("  ───────────────────────────────────────\n");
});

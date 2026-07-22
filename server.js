/**
 * Soirée Quiz — plateforme multi-quiz
 * Serveur Node.js + Express + Socket.IO
 *
 * Pages :
 *   - /                      : page d'accueil (présentation + choix du quiz)
 *   - /quiz/:quizId          : interface joueur (mobile)
 *   - /quiz/:quizId/host     : écran présentateur (TV / vidéoprojecteur)
 *
 * Chaque quiz a sa propre salle (code PIN, joueurs, partie) indépendante.
 */

const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Augmente la tolérance réseau pour les mobiles (50+ joueurs)
  pingTimeout: 25000,
  pingInterval: 20000,
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ */
/* Définition des quiz                                                 */
/* ------------------------------------------------------------------ */

const QUIZ_DEFS = {
  parents: {
    id: "parents",
    names: ["Stéphane", "Marie", "Émilie"],
    subtitle: "Double anniversaire — Stéphane, Marie & Émilie",
    questions: require("./questions"),
  },
  clement: {
    id: "clement",
    names: ["Clément", "Charlotte"],
    subtitle: "Le quiz du mariage de Clément & Charlotte",
    questions: require("./questions-clement"),
  },
};

function quizPublicList() {
  return Object.values(QUIZ_DEFS).map((d) => ({
    id: d.id,
    names: d.names,
    subtitle: d.subtitle,
    questionCount: d.questions.length,
  }));
}

/* ------------------------------------------------------------------ */
/* Fichiers statiques + routes                                         */
/* ------------------------------------------------------------------ */

// index:false pour que "/" ne serve pas automatiquement public/index.html
app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.get("/quiz/:quizId/host", (req, res) => {
  if (!QUIZ_DEFS[req.params.quizId]) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/quiz/:quizId", (req, res) => {
  if (!QUIZ_DEFS[req.params.quizId]) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Compatibilité : anciens liens "/host" → présentateur du quiz des parents
app.get("/host", (req, res) => res.redirect("/quiz/parents/host"));

// Liste des quiz (pour la page d'accueil)
app.get("/api/quizzes", (req, res) => {
  res.json(quizPublicList());
});

// URL publique + QR + PIN pour un quiz donné (utilisé par l'écran présentateur)
app.get("/api/connect-info", async (req, res) => {
  const quizId = String(req.query.quiz || "");
  const def = QUIZ_DEFS[quizId];
  if (!def) return res.status(404).json({ error: "Quiz inconnu." });
  const room = rooms[quizId];
  const url = resolvePublicUrl(req);
  // Le QR encode l'URL du quiz AVEC le code PIN → connexion directe.
  const joinUrl = `${url}/quiz/${quizId}?pin=${room.pin}`;
  try {
    const qr = await QRCode.toDataURL(joinUrl, {
      width: 480,
      margin: 1,
      color: { dark: "#1a0b2e", light: "#ffffff" },
    });
    res.json({
      url, joinUrl, qr, pin: room.pin, quizId,
      names: def.names,
      subtitle: def.subtitle, questionCount: def.questions.length,
    });
  } catch (err) {
    res.status(500).json({ error: "QR generation failed", url, joinUrl, pin: room.pin });
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
  if (req && req.headers) {
    // 2) Derrière un proxy / tunnel / hébergeur (Render, Railway, cloudflared, ngrok…)
    //    On lit en priorité X-Forwarded-Host, sinon l'en-tête Host classique
    //    (Render n'envoie pas toujours X-Forwarded-Host mais transmet le bon Host).
    const xfHost = req.headers["x-forwarded-host"];
    const host = String(xfHost || req.headers["host"] || "").split(",")[0].trim();
    if (host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host)) {
      const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const proto = xfProto || (req.socket && req.socket.encrypted ? "https" : "http");
      return `${proto}://${host}`;
    }
  }
  // 3) En local : IP de la machine sur le réseau wifi
  return `http://${localIPv4()}:${PORT}`;
}

/* ------------------------------------------------------------------ */
/* État du jeu (une salle par quiz)                                    */
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

function makeRoom(quizId) {
  return {
    quizId,
    pin: makePin(),
    state: STATES.LOBBY,
    players: new Map(), // playerId -> { id, name, score, connected, socketId, lastAnswer }
    currentIndex: -1,
    order: [], // ordre (mélangé) des questions pour la partie en cours
    questionStartedAt: 0,
    answers: new Map(), // playerId -> { choice, time, correct, points }
    timer: null,
    timeLeft: 0,
  };
}

// Mélange de Fisher-Yates (renvoie une nouvelle liste)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rooms = {};
for (const id of Object.keys(QUIZ_DEFS)) rooms[id] = makeRoom(id);

const POINTS_BASE = 500;
const POINTS_BONUS = 500;

const hostRoom = (room) => "host:" + room.quizId;
const playersRoom = (room) => "players:" + room.quizId;
const questionsOf = (room) => QUIZ_DEFS[room.quizId].questions;

function publicPlayerList(room) {
  return Array.from(room.players.values())
    .filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function leaderboard(room) {
  return Array.from(room.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function currentQuestion(room) {
  const questions = questionsOf(room);
  // room.order contient l'ordre mélangé ; on retombe sur l'ordre naturel au besoin
  const qi = room.order && room.order.length ? room.order[room.currentIndex] : room.currentIndex;
  return questions[qi];
}

// Vue de la question SANS la bonne réponse (envoyée à tous pendant le jeu)
function questionPublic(room) {
  const q = currentQuestion(room);
  if (!q) return null;
  return {
    index: room.currentIndex,
    total: questionsOf(room).length,
    text: q.text,
    options: q.options,
    time: q.time || 30,
  };
}

function broadcastPlayers(room) {
  const list = publicPlayerList(room);
  io.to(hostRoom(room)).emit("players", { players: list, count: list.length });
}

function answerCount(room) {
  return room.answers.size;
}

/* ------------------------------------------------------------------ */
/* Logique des manches                                                 */
/* ------------------------------------------------------------------ */

function startQuestion(room) {
  const questions = questionsOf(room);
  // Nouvelle partie → on (re)mélange l'ordre des questions
  if (room.currentIndex === -1) {
    room.order = shuffle(questions.map((_, i) => i));
  }
  if (room.currentIndex + 1 >= questions.length) {
    showPodium(room);
    return;
  }
  room.currentIndex += 1;
  room.state = STATES.QUESTION;
  room.answers = new Map();
  room.questionStartedAt = Date.now();
  const q = questionPublic(room);
  room.timeLeft = q.time;

  for (const p of room.players.values()) p.lastAnswer = null;

  io.to(hostRoom(room)).emit("question", { ...q, answerCount: 0 });
  io.to(playersRoom(room)).emit("question", {
    index: q.index, total: q.total, text: q.text, options: q.options, time: q.time,
  });

  clearInterval(room.timer);
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.to(hostRoom(room)).to(playersRoom(room)).emit("tick", { timeLeft: Math.max(0, room.timeLeft) });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      revealAnswer(room);
    }
  }, 1000);
}

function computePoints(elapsedMs, totalSec) {
  // 500 pts base + jusqu'à 500 pts bonus selon la rapidité (linéaire)
  const totalMs = totalSec * 1000;
  const frac = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));
  return POINTS_BASE + Math.round(POINTS_BONUS * frac);
}

function revealAnswer(room) {
  if (room.state !== STATES.QUESTION) return;
  clearInterval(room.timer);
  room.state = STATES.REVEAL;
  const q = currentQuestion(room);

  const distribution = [0, 0, 0, 0];
  for (const a of room.answers.values()) {
    if (a.choice >= 0 && a.choice < 4) distribution[a.choice] += 1;
  }

  io.to(hostRoom(room)).emit("reveal", {
    index: room.currentIndex,
    correct: q.correct,
    distribution,
    answerCount: answerCount(room),
    leaderboard: leaderboard(room),
  });

  const board = leaderboard(room);
  for (const p of room.players.values()) {
    const a = room.answers.get(p.id);
    const rank = board.findIndex((r) => r.id === p.id) + 1;
    io.to(p.socketId || "").emit("result", {
      correctIndex: q.correct,
      yourChoice: a ? a.choice : null,
      correct: a ? a.correct : false,
      points: a ? a.points : 0,
      score: p.score,
      rank,
      totalPlayers: board.length,
    });
  }
}

function showLeaderboard(room) {
  io.to(hostRoom(room)).emit("leaderboard", { leaderboard: leaderboard(room) });
}

function showPodium(room) {
  clearInterval(room.timer);
  room.state = STATES.PODIUM;
  const board = leaderboard(room);
  io.to(hostRoom(room)).emit("podium", { podium: board.slice(0, 3), leaderboard: board });
  for (const p of room.players.values()) {
    const rank = board.findIndex((r) => r.id === p.id) + 1;
    io.to(p.socketId || "").emit("finished", { rank, totalPlayers: board.length, score: p.score });
  }
}

function resetGame(room) {
  clearInterval(room.timer);
  room.state = STATES.LOBBY;
  room.currentIndex = -1;
  room.answers = new Map();
  room.timeLeft = 0;
  for (const p of room.players.values()) {
    p.score = 0;
    p.lastAnswer = null;
  }
  io.to(hostRoom(room)).to(playersRoom(room)).emit("reset", { pin: room.pin });
  broadcastPlayers(room);
}

// Exclut tous les joueurs et génère un nouveau code de salle (nouveau QR).
function newRoom(room) {
  clearInterval(room.timer);
  room.pin = makePin();
  room.state = STATES.LOBBY;
  room.currentIndex = -1;
  room.answers = new Map();
  room.timeLeft = 0;
  io.to(playersRoom(room)).emit("kicked", { reason: "La salle a été réinitialisée par l'animateur." });
  io.in(playersRoom(room)).socketsLeave(playersRoom(room));
  room.players.clear();
  io.to(hostRoom(room)).emit("newRoom", { pin: room.pin });
  broadcastPlayers(room);
}

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */

function roomOf(socket) {
  return rooms[socket.data.quizId];
}

io.on("connection", (socket) => {
  /* ----- Présentateur ----- */
  socket.on("host:join", (data) => {
    const quizId = data && data.quizId;
    if (!QUIZ_DEFS[quizId]) return;
    socket.data.quizId = quizId;
    socket.data.role = "host";
    const room = rooms[quizId];
    socket.join(hostRoom(room));
    socket.emit("host:state", {
      pin: room.pin,
      state: room.state,
      players: publicPlayerList(room),
      count: publicPlayerList(room).length,
      question: room.state === STATES.QUESTION ? { ...questionPublic(room), answerCount: answerCount(room) } : null,
      timeLeft: room.timeLeft,
    });
    broadcastPlayers(room);
  });

  socket.on("host:start", () => {
    const room = roomOf(socket);
    if (!room) return;
    if (room.state === STATES.LOBBY || room.state === STATES.PODIUM) {
      if (room.state === STATES.PODIUM) resetGame(room);
      startQuestion(room);
    }
  });

  socket.on("host:next", () => {
    const room = roomOf(socket);
    if (!room) return;
    if (room.state === STATES.REVEAL || room.state === STATES.LOBBY) {
      startQuestion(room);
    }
  });

  socket.on("host:reveal", () => {
    const room = roomOf(socket);
    if (room && room.state === STATES.QUESTION) revealAnswer(room);
  });

  socket.on("host:leaderboard", () => {
    const room = roomOf(socket);
    if (room) showLeaderboard(room);
  });

  socket.on("host:restart", () => {
    const room = roomOf(socket);
    if (room) resetGame(room);
  });

  socket.on("host:newRoom", () => {
    const room = roomOf(socket);
    if (room) newRoom(room);
  });

  /* ----- Joueur ----- */
  socket.on("player:join", (data, ack) => {
    const quizId = data && data.quizId;
    if (!QUIZ_DEFS[quizId]) {
      if (ack) ack({ ok: false, error: "Quiz inconnu." });
      return;
    }
    const room = rooms[quizId];
    const def = QUIZ_DEFS[quizId];
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
    if (reconnectId && room.players.has(reconnectId)) {
      player = room.players.get(reconnectId);
      player.connected = true;
      player.socketId = socket.id;
      if (name) player.name = name;
    } else {
      const id = reconnectId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      player = { id, name, score: 0, connected: true, socketId: socket.id, lastAnswer: null };
      room.players.set(id, player);
    }

    socket.data.quizId = quizId;
    socket.data.role = "player";
    socket.data.playerId = player.id;
    socket.join(playersRoom(room));

    if (ack) {
      ack({
        ok: true,
        playerId: player.id,
        pin: room.pin,
        name: player.name,
        score: player.score,
        state: room.state,
        names: def.names,
      });
    }

    // Resynchronise un joueur qui rejoint en cours de partie
    if (room.state === STATES.QUESTION) {
      const q = questionPublic(room);
      socket.emit("question", {
        index: q.index, total: q.total, text: q.text, options: q.options, time: q.time,
      });
      socket.emit("tick", { timeLeft: Math.max(0, room.timeLeft) });
      const prev = room.answers.get(player.id);
      if (prev) socket.emit("answer:locked", { choice: prev.choice });
    } else if (room.state === STATES.REVEAL) {
      const q = currentQuestion(room);
      const a = room.answers.get(player.id);
      const board = leaderboard(room);
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
      const board = leaderboard(room);
      const rank = board.findIndex((r) => r.id === player.id) + 1;
      socket.emit("finished", { rank, totalPlayers: board.length, score: player.score });
    }

    broadcastPlayers(room);
  });

  socket.on("player:answer", (data, ack) => {
    const room = roomOf(socket);
    if (!room || room.state !== STATES.QUESTION) {
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

    const q = currentQuestion(room);
    const elapsed = Date.now() - room.questionStartedAt;
    const isCorrect = choice === q.correct;
    const points = isCorrect ? computePoints(elapsed, q.time || 30) : 0;
    player.score += points;
    player.lastAnswer = choice;

    room.answers.set(player.id, { choice, time: elapsed, correct: isCorrect, points });

    if (ack) ack({ ok: true, choice });
    socket.emit("answer:locked", { choice });

    io.to(hostRoom(room)).emit("answerCount", { answerCount: answerCount(room), total: publicPlayerList(room).length });

    const activePlayers = publicPlayerList(room).length;
    if (activePlayers > 0 && answerCount(room) >= activePlayers) {
      revealAnswer(room);
    }
  });

  socket.on("disconnect", () => {
    const room = roomOf(socket);
    const playerId = socket.data.playerId;
    if (room && playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      p.connected = false;
      broadcastPlayers(room);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const url = resolvePublicUrl(null);
  console.log("\n  🎉  Soirée Quiz — plateforme multi-quiz");
  console.log("  ───────────────────────────────────────");
  console.log(`  Accueil : ${url}/`);
  for (const d of Object.values(QUIZ_DEFS)) {
    console.log(`  • ${d.names.join(" & ")} → ${url}/quiz/${d.id}/host  (code ${rooms[d.id].pin})`);
  }
  console.log("  ───────────────────────────────────────\n");
});

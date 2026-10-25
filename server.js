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
const { buildResults, writePdf } = require("./results");
const { resolveTrack, prewarm } = require("./music");

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
  blind: {
    id: "blind",
    names: ["Blind Test"],
    subtitle: "🎵 Variété française et internationale",
    questions: require("./questions-blind"),
    isBlind: true,
  },
  blind80: {
    id: "blind80",
    names: ["Blind Test 80"],
    subtitle: "🕺 Les tubes des années 80",
    questions: require("./questions-blind80"),
    isBlind: true,
  },
  blindfilm: {
    id: "blindfilm",
    names: ["Blind Test Ciné"],
    subtitle: "🎬 Devine le film à sa musique",
    questions: require("./questions-blindfilm"),
    isBlind: true,
  },
  blinddisney: {
    id: "blinddisney",
    names: ["Blind Test Disney"],
    subtitle: "🧸 Chansons de dessins animés",
    questions: require("./questions-blinddisney"),
    isBlind: true,
  },
  culture: {
    id: "culture",
    names: ["Culture générale"],
    subtitle: "🧠 20 questions pour toutes les générations",
    questions: require("./questions-culture"),
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
    questionCount: effectiveQuestions(d.id).length,
    isBlind: !!d.isBlind,
  }));
}

/* ------------------------------------------------------------------ */
/* Fichiers statiques + routes                                         */
/* ------------------------------------------------------------------ */

// index:false pour que "/" ne serve pas automatiquement public/index.html
app.use(express.json({ limit: "2mb" }));
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

// Récapitulatif de la dernière partie : JSON et PDF téléchargeable
function resultsOf(quizId) {
  const def = QUIZ_DEFS[quizId];
  if (!def) return null;
  const room = rooms[quizId];
  // récap figé en fin de partie, sinon calcul à la volée si une partie est en cours
  return room.lastResults || (room.history && room.history.length ? buildResults(room, def, teamBoard(room)) : null);
}

app.get("/api/results", (req, res) => {
  const r = resultsOf(String(req.query.quiz || ""));
  if (!r) return res.status(404).json({ error: "Aucun résultat disponible." });
  res.json(r);
});

// Regénère un PDF à partir d'un récap sauvegardé côté navigateur (historique)
app.post("/api/results.pdf", (req, res) => {
  const r = req.body;
  if (!r || !r.ranking || !r.questions) return res.status(400).send("Récapitulatif invalide.");
  r.date = new Date(r.date || Date.now());
  const jour = r.date.toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="resultats-quiz-${r.quizId || "quiz"}-${jour}.pdf"`);
  writePdf(r, res);
});

app.get("/api/results.pdf", (req, res) => {
  const quizId = String(req.query.quiz || "");
  const r = resultsOf(quizId);
  if (!r) return res.status(404).send("Aucun résultat disponible pour le moment.");
  const jour = r.date.toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="resultats-quiz-${quizId}-${jour}.pdf"`);
  writePdf(r, res);
});

// Vérification de la playlist du blind test : quels extraits sont trouvés ?
app.get("/api/blind-check", async (req, res) => {
  const seul = String(req.query.quiz || "");
  const defs = Object.values(QUIZ_DEFS).filter((d) => d.isBlind && (!seul || d.id === seul));
  if (!defs.length) return res.status(404).json({ error: "Aucun blind test correspondant." });
  const out = {};
  for (const def of defs) {
    const rows = await prewarm(effectiveQuestions(def.id));
    out[def.id] = {
      nom: def.names.join(" "),
      total: rows.length,
      ok: rows.filter((r) => r.url).length,
      manquants: rows.filter((r) => !r.url).map((r) => r.music.artist + " — " + r.music.title),
      detail: rows.map((r) => ({
        cherche: r.music.artist + " — " + r.music.title,
        trouve: r.url ? r.artistName + " — " + r.trackName : null,
        erreur: r.error || null,
      })),
    };
  }
  const tot = Object.values(out).reduce((a, q) => a + q.total, 0);
  const ok = Object.values(out).reduce((a, q) => a + q.ok, 0);
  res.json({ resume: ok + "/" + tot + " extraits trouvés", quiz: out });
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
      subtitle: def.subtitle, questionCount: effectiveQuestions(quizId).length,
      isBlind: !!def.isBlind,
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
    graceTimer: null, // petit délai avant révélation (réponses de dernière seconde)
    history: [], // détail de chaque question jouée (pour le récap / PDF)
    startedAt: null, // début de la partie
    lastResults: null, // récap de la dernière partie terminée
    teamMode: false, // mode équipes activé ?
    teams: [], // [{ id, name, color }]
    activeQuestions: null, // liste figée pendant la partie en cours
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
// Questions modifiées via l'éditeur (gardées en mémoire ; le navigateur du
// présentateur les renvoie à chaque connexion, car le disque de Render est effacé
// à chaque redémarrage).
const overrides = {}; // quizId -> questions[]
const effectiveQuestions = (quizId) => overrides[quizId] || QUIZ_DEFS[quizId].questions;
// Pendant une partie on utilise la liste figée au lancement (room.activeQuestions)
const questionsOf = (room) => room.activeQuestions || effectiveQuestions(room.quizId);

function publicPlayerList(room) {
  return Array.from(room.players.values())
    .filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name, score: p.score, teamId: p.teamId || null }));
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
    time: q.time || 40,
  };
}

function broadcastPlayers(room) {
  const list = publicPlayerList(room);
  io.to(hostRoom(room)).emit("players", { players: list, count: list.length });
}

/* ----- Mode équipes ----- */
const TEAM_PRESETS = [
  { name: "Équipe Rouge", color: "#e8443b" },
  { name: "Équipe Bleue", color: "#1368ce" },
  { name: "Équipe Jaune", color: "#d89e00" },
  { name: "Équipe Verte", color: "#26890c" },
  { name: "Équipe Violette", color: "#8e44ad" },
  { name: "Équipe Orange", color: "#e67e22" },
];
const teamOf = (room, id) => room.teams.find((t) => t.id === id) || null;

// Équipes avec leur nombre de joueurs (pour l'affichage et le choix)
function publicTeams(room) {
  return room.teams.map((t) => ({
    ...t,
    count: Array.from(room.players.values()).filter((p) => p.teamId === t.id).length,
  }));
}
function broadcastTeams(room) {
  const payload = { enabled: room.teamMode, teams: publicTeams(room) };
  io.to(hostRoom(room)).to(playersRoom(room)).emit("teams", payload);
}
// Range un joueur sans équipe dans la moins nombreuse (équilibre automatique)
function autoAssign(room, player) {
  if (!room.teamMode || !room.teams.length || teamOf(room, player.teamId)) return;
  const sizes = publicTeams(room).sort((a, b) => a.count - b.count);
  player.teamId = sizes[0].id;
}
// Classement des équipes : MOYENNE par joueur (sinon la plus grande table gagne d'office)
function teamBoard(room) {
  if (!room.teamMode) return [];
  return room.teams
    .map((t) => {
      const members = Array.from(room.players.values()).filter((p) => p.teamId === t.id);
      const total = members.reduce((a, p) => a + p.score, 0);
      return { id: t.id, name: t.name, color: t.color, members: members.length,
               total, avg: members.length ? Math.round(total / members.length) : 0 };
    })
    .filter((t) => t.members > 0)
    .sort((a, b) => b.avg - a.avg || b.total - a.total);
}
// Infos d'équipe d'un joueur (pour son téléphone)
function playerTeamInfo(room, player) {
  if (!room.teamMode) return null;
  const board = teamBoard(room);
  const i = board.findIndex((t) => t.id === player.teamId);
  if (i < 0) return null;
  return { name: board[i].name, color: board[i].color, rank: i + 1, total: board.length, avg: board[i].avg };
}

function answerCount(room) {
  return room.answers.size;
}

/* ------------------------------------------------------------------ */
/* Logique des manches                                                 */
/* ------------------------------------------------------------------ */

function startQuestion(room) {
  if (room.currentIndex === -1) room.activeQuestions = effectiveQuestions(room.quizId);
  const questions = questionsOf(room);
  // Nouvelle partie → on (re)mélange l'ordre des questions
  if (room.currentIndex === -1) {
    room.order = shuffle(questions.map((_, i) => i));
    room.history = [];
    room.startedAt = Date.now();
    if (room.teamMode) {
      for (const p of room.players.values()) autoAssign(room, p);
      broadcastTeams(room);
    }
    // Blind test : on récupère les extraits à l'avance pour éviter tout délai
    if (QUIZ_DEFS[room.quizId].isBlind) {
      prewarm(questions).catch(() => {});
    }
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

  // Blind test : l'extrait n'est envoyé qu'au présentateur (les téléphones restent muets)
  const qDef = currentQuestion(room);
  if (qDef && qDef.music) {
    const askedIndex = room.currentIndex;
    resolveTrack(qDef.music)
      .then((t) => {
        if (room.currentIndex !== askedIndex || room.state !== STATES.QUESTION) return;
        io.to(hostRoom(room)).emit("music", {
          index: askedIndex,
          url: t.url || null,
          error: t.error || null,
          label: t.url ? t.artistName + " — " + t.trackName : null,
        });
      })
      .catch(() => {});
  }

  clearInterval(room.timer);
  clearTimeout(room.graceTimer);
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.to(hostRoom(room)).to(playersRoom(room)).emit("tick", { timeLeft: Math.max(0, room.timeLeft) });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      // Délai de grâce : les réponses parties juste avant la fin ont le temps
      // d'arriver (réseau mobile lent) avant qu'on révèle.
      clearTimeout(room.graceTimer);
      room.graceTimer = setTimeout(() => revealAnswer(room), 1500);
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
  clearTimeout(room.graceTimer);
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
    teams: teamBoard(room),
  });

  // Archive la question pour le récapitulatif de fin de partie
  room.history.push({
    text: q.text,
    options: q.options.slice(),
    correct: q.correct,
    distribution: distribution.slice(0, q.options.length),
    answers: Array.from(room.answers.entries()).map(([pid, a]) => ({
      playerId: pid,
      name: (room.players.get(pid) || {}).name || "?",
      choice: a.choice,
      correct: a.correct,
      timeMs: a.time,
      points: a.points,
    })),
    playersPresent: publicPlayerList(room).length,
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
      team: playerTeamInfo(room, p),
    });
  }
}

function showLeaderboard(room) {
  io.to(hostRoom(room)).emit("leaderboard", { leaderboard: leaderboard(room) });
}

function showPodium(room) {
  clearInterval(room.timer);
  clearTimeout(room.graceTimer);
  room.state = STATES.PODIUM;
  // Fige le récapitulatif de la partie (classement + stats) pour l'export PDF
  if (room.history && room.history.length) {
    room.lastResults = buildResults(room, QUIZ_DEFS[room.quizId], teamBoard(room));
  }
  const board = leaderboard(room);
  io.to(hostRoom(room)).emit("podium", { podium: board.slice(0, 3), leaderboard: board, teams: teamBoard(room) });
  for (const p of room.players.values()) {
    const rank = board.findIndex((r) => r.id === p.id) + 1;
    io.to(p.socketId || "").emit("finished", { rank, totalPlayers: board.length, score: p.score, team: playerTeamInfo(room, p) });
  }
}

function resetGame(room) {
  clearInterval(room.timer);
  clearTimeout(room.graceTimer);
  room.activeQuestions = null;
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
  clearTimeout(room.graceTimer);
  room.activeQuestions = null;
  room.pin = makePin();
  room.state = STATES.LOBBY;
  room.currentIndex = -1;
  room.answers = new Map();
  room.timeLeft = 0;
  io.to(playersRoom(room)).emit("kicked", { reason: "La salle a été réinitialisée par l'animateur." });
  io.in(playersRoom(room)).socketsLeave(playersRoom(room));
  room.players.clear();
  io.to(hostRoom(room)).emit("newRoom", { pin: room.pin });
  broadcastTeams(room);
  broadcastPlayers(room);
}

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */

function roomOf(socket) {
  return rooms[socket.data.quizId];
}

/* ----- Sécurité présentateur ----- */
// Le vrai code se règle dans Render (variable d'environnement HOST_CODE) : le dépôt
// étant public, le code par défaut ci-dessous n'est qu'un garde-fou.
const HOST_CODE = String(process.env.HOST_CODE || "mirabelle").trim().toLowerCase();
const crypto = require("crypto");
function safeEqual(x, y) {
  const a = Buffer.from(String(x || "")), b = Buffer.from(String(y || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}
function codeOk(code) {
  return safeEqual(String(code || "").trim().toLowerCase(), HOST_CODE);
}
// Jeton remis au présentateur après un bon code : il lui permet de se reconnecter
// (veille, coupure réseau) SANS repasser par le code ni subir le blocage anti-force
// brute — indispensable car tous les invités partagent souvent la même IP (box).
const HOST_TOKEN = crypto.randomBytes(24).toString("hex");
// Anti force brute : 8 essais ratés en 10 min depuis la même adresse → blocage 10 min
const failures = new Map(); // ip -> [timestamps]
function clientIp(socket) {
  const xf = socket.handshake.headers["x-forwarded-for"];
  return String(xf || socket.handshake.address || "").split(",")[0].trim();
}
function isLocked(ip) {
  const now = Date.now();
  const list = (failures.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  failures.set(ip, list);
  return list.length >= 8;
}
function noteFailure(ip) {
  const list = failures.get(ip) || [];
  list.push(Date.now());
  failures.set(ip, list);
}
// Salle du présentateur, UNIQUEMENT si la socket s'est authentifiée comme tel
function hostRoomOf(socket) {
  if (socket.data.role !== "host") return null;
  return rooms[socket.data.quizId] || null;
}
// Texte libre de l'éditeur : sans caractères de contrôle, espaces normalisés, longueur bornée
function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
// Vérifie et nettoie les questions venant de l'éditeur. Renvoie { questions } ou { error }.
function sanitizeQuestions(list, def) {
  if (!Array.isArray(list)) return { error: "Format de questions invalide." };
  if (!list.length) return { error: "Il faut au moins une question." };
  if (list.length > 100) return { error: "100 questions maximum." };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i] || {}, n = i + 1;
    const text = cleanText(q.text, 300);
    if (!text) return { error: `Question ${n} : l'énoncé est vide.` };
    const raw = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
    const wanted = parseInt(q.correct, 10);
    // On retire les réponses vides en gardant la bonne réponse alignée
    const options = []; let correct = -1;
    raw.forEach((o, j) => {
      const t = cleanText(o, 120);
      if (!t) return;
      if (j === wanted) correct = options.length;
      options.push(t);
    });
    if (options.length < 2) return { error: `Question ${n} : il faut au moins 2 réponses.` };
    if (correct < 0) return { error: `Question ${n} : la bonne réponse cochée est vide.` };
    const time = Math.min(120, Math.max(5, parseInt(q.time, 10) || (def.isBlind ? 30 : 40)));
    const item = { text, options, correct, time };
    const m = q.music || {};
    const artist = cleanText(m.artist, 120), title = cleanText(m.title, 120);
    if (def.isBlind && (!artist || !title)) return { error: `Question ${n} : indique l'artiste et le titre de la musique.` };
    if (artist && title) {
      item.music = { artist, title };
      const audio = cleanText(m.audio, 300);
      if (audio) {
        if (!/^\/audio\/[\w.\-]+$/.test(audio) && !/^https:\/\//.test(audio)) {
          return { error: `Question ${n} : lien audio invalide (fichier /audio/… ou adresse https://…).` };
        }
        item.music.audio = audio;
      }
    }
    out.push(item);
  }
  return { questions: out };
}

// Nettoie un prénom : pas de balises ni de caractères de contrôle
function cleanName(raw) {
  return String(raw || "").replace(/[<>\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

io.on("connection", (socket) => {
  /* ----- Présentateur ----- */
  socket.on("host:join", (data) => {
    const quizId = data && data.quizId;
    if (!QUIZ_DEFS[quizId]) return;
    const viaToken = safeEqual(data && data.token, HOST_TOKEN);
    if (!viaToken) {
      const code = String((data && data.code) || "").trim();
      if (!code) { socket.emit("host:denied", { reason: null }); return; } // simple demande de code
      const ip = clientIp(socket);
      if (isLocked(ip)) {
        socket.emit("host:denied", { reason: "Trop d'essais. Réessaie dans quelques minutes." });
        return;
      }
      if (!codeOk(code)) {
        noteFailure(ip);
        socket.emit("host:denied", { reason: "Code présentateur incorrect." });
        return;
      }
    }
    socket.emit("host:token", { token: HOST_TOKEN });
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
      teamMode: room.teamMode,
      teams: publicTeams(room),
      questionCount: effectiveQuestions(quizId).length,
      customQuestions: !!overrides[quizId],
    });
    broadcastPlayers(room);
  });

  socket.on("host:start", () => {
    const room = hostRoomOf(socket);
    if (!room) return;
    if (room.state === STATES.LOBBY || room.state === STATES.PODIUM) {
      if (room.state === STATES.PODIUM) resetGame(room);
      startQuestion(room);
    }
  });

  socket.on("host:next", () => {
    const room = hostRoomOf(socket);
    if (!room) return;
    if (room.state === STATES.REVEAL || room.state === STATES.LOBBY) {
      startQuestion(room);
    }
  });

  socket.on("host:reveal", () => {
    const room = hostRoomOf(socket);
    if (room && room.state === STATES.QUESTION) revealAnswer(room);
  });

  socket.on("host:leaderboard", () => {
    const room = hostRoomOf(socket);
    if (room) showLeaderboard(room);
  });

  socket.on("host:restart", () => {
    const room = hostRoomOf(socket);
    if (room) resetGame(room);
  });

  socket.on("host:newRoom", () => {
    const room = hostRoomOf(socket);
    if (room) newRoom(room);
  });

  /* ----- Éditeur de questions (présentateur uniquement) ----- */
  socket.on("host:getQuestions", (data, ack) => {
    const room = hostRoomOf(socket);
    if (!room || typeof ack !== "function") return;
    ack({ ok: true, questions: effectiveQuestions(room.quizId), custom: !!overrides[room.quizId],
          isBlind: !!QUIZ_DEFS[room.quizId].isBlind });
  });
  socket.on("host:setQuestions", (data, ack) => {
    const room = hostRoomOf(socket);
    if (!room) return;
    const r = sanitizeQuestions(data && data.questions, QUIZ_DEFS[room.quizId]);
    if (r.error) { if (ack) ack({ ok: false, error: r.error }); return; }
    overrides[room.quizId] = r.questions;
    // En pleine partie, la liste en cours reste figée : les modifs valent pour la suivante
    const enJeu = room.state === STATES.QUESTION || room.state === STATES.REVEAL;
    if (ack) ack({ ok: true, count: r.questions.length, nextGame: enJeu, questions: r.questions });
    io.to(hostRoom(room)).emit("questionsChanged", { count: r.questions.length, custom: true });
  });
  socket.on("host:resetQuestions", (data, ack) => {
    const room = hostRoomOf(socket);
    if (!room) return;
    delete overrides[room.quizId];
    const qs = QUIZ_DEFS[room.quizId].questions;
    if (ack) ack({ ok: true, questions: qs });
    io.to(hostRoom(room)).emit("questionsChanged", { count: qs.length, custom: false });
  });

  // Configure le mode équipes : { enabled, count (2-6), names: [..] }
  socket.on("host:setTeams", (data, ack) => {
    const room = hostRoomOf(socket);
    if (!room) return;
    if (room.state !== STATES.LOBBY && room.state !== STATES.PODIUM) {
      if (ack) ack({ ok: false, error: "Modifiable seulement entre deux parties." });
      return;
    }
    const enabled = !!(data && data.enabled);
    const count = Math.min(6, Math.max(2, parseInt(data && data.count, 10) || 2));
    const names = Array.isArray(data && data.names) ? data.names : [];
    const before = room.teams;
    room.teamMode = enabled;
    room.teams = enabled
      ? TEAM_PRESETS.slice(0, count).map((preset, i) => ({
          id: "t" + (i + 1),
          name: cleanName(names[i]) || (before[i] && before[i].name) || preset.name,
          color: preset.color,
        }))
      : [];
    // Les joueurs d'une équipe supprimée (ou si on désactive) repassent « sans équipe »
    for (const pl of room.players.values()) {
      if (!enabled || !teamOf(room, pl.teamId)) pl.teamId = null;
    }
    broadcastTeams(room);
    broadcastPlayers(room);
    if (ack) ack({ ok: true });
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
    const name = cleanName(data && data.name);
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
    let reconnected = false;
    if (reconnectId && room.players.has(reconnectId)) {
      // 1) Reprise par identifiant mémorisé (même navigateur)
      player = room.players.get(reconnectId);
      player.connected = true;
      player.socketId = socket.id;
      if (name) player.name = name;
      reconnected = true;
    } else {
      // 2) Reprise par prénom : un joueur DÉCONNECTÉ du même prénom récupère son
      //    score (cas d'un téléphone qui a perdu sa mémoire ou d'un autre appareil).
      let previous = null;
      const lower = name.toLowerCase();
      for (const p of room.players.values()) {
        if (!p.connected && p.name.trim().toLowerCase() === lower) { previous = p; break; }
      }
      if (previous) {
        player = previous;
        player.connected = true;
        player.socketId = socket.id;
        player.name = name;
        reconnected = true;
      } else {
        // 3) Nouveau joueur
        const id = reconnectId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        player = { id, name, score: 0, connected: true, socketId: socket.id, lastAnswer: null, teamId: null };
        room.players.set(id, player);
      }
    }

    socket.data.quizId = quizId;
    socket.data.role = "player";
    socket.data.playerId = player.id;
    socket.join(playersRoom(room));

    // Équipe : choix libre au lobby ; en cours de partie, placement automatique
    if (room.teamMode) {
      const wanted = data && data.teamId;
      if (room.state === STATES.LOBBY && teamOf(room, wanted)) player.teamId = wanted;
      if (room.state !== STATES.LOBBY) autoAssign(room, player);
    }

    if (ack) {
      ack({
        ok: true,
        playerId: player.id,
        pin: room.pin,
        name: player.name,
        score: player.score,
        state: room.state,
        names: def.names,
        reconnected: reconnected && player.score > 0,
        teamMode: room.teamMode,
        teams: publicTeams(room),
        teamId: player.teamId || null,
      });
    }
    if (room.teamMode) broadcastTeams(room);

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
        team: playerTeamInfo(room, player),
      });
    } else if (room.state === STATES.PODIUM) {
      const board = leaderboard(room);
      const rank = board.findIndex((r) => r.id === player.id) + 1;
      socket.emit("finished", { rank, totalPlayers: board.length, score: player.score, team: playerTeamInfo(room, player) });
    }

    broadcastPlayers(room);
  });

  socket.on("player:setTeam", (data, ack) => {
    const room = roomOf(socket);
    const player = room && room.players.get(socket.data.playerId);
    if (!room || !player || !room.teamMode) { if (ack) ack({ ok: false }); return; }
    if (room.state !== STATES.LOBBY) {
      if (ack) ack({ ok: false, error: "On ne change plus d'équipe une fois la partie lancée." });
      return;
    }
    if (!teamOf(room, data && data.teamId)) { if (ack) ack({ ok: false, error: "Équipe inconnue." }); return; }
    player.teamId = data.teamId;
    broadcastTeams(room);
    broadcastPlayers(room);
    if (ack) ack({ ok: true, teamId: player.teamId });
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
    const points = isCorrect ? computePoints(elapsed, q.time || 40) : 0;
    player.score += points;
    player.lastAnswer = choice;

    room.answers.set(player.id, { choice, time: elapsed, correct: isCorrect, points });

    if (ack) ack({ ok: true, choice });
    socket.emit("answer:locked", { choice });

    io.to(hostRoom(room)).emit("answerCount", { answerCount: answerCount(room), total: publicPlayerList(room).length });

    // Pas de révélation automatique : la question tourne toujours jusqu'au bout
    // du compte à rebours, même si tout le monde a déjà répondu. Cela garantit
    // que les retardataires (téléphone en veille, lecture lente…) ont leur
    // chance. Le présentateur peut toujours révéler plus tôt avec son bouton.
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

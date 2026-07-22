/* Écran présentateur */
(function () {
  const socket = io();

  // Quiz courant, déduit de l'URL : /quiz/<quizId>/host
  const quizId = location.pathname.split("/")[2] || "parents";

  const TILES = [
    { cls: "red", shape: "triangle" },
    { cls: "blue", shape: "diamond" },
    { cls: "yellow", shape: "circle" },
    { cls: "green", shape: "square" },
  ];

  function shapeSvg(shape) {
    switch (shape) {
      case "triangle": return '<svg viewBox="0 0 40 40"><polygon points="20,4 38,36 2,36"/></svg>';
      case "diamond": return '<svg viewBox="0 0 40 40"><polygon points="20,2 38,20 20,38 2,20"/></svg>';
      case "circle": return '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg>';
      case "square": return '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="4"/></svg>';
    }
    return "";
  }

  const $ = (id) => document.getElementById(id);
  const screens = {
    lobby: $("screen-lobby"),
    question: $("screen-question"),
    reveal: $("screen-reveal"),
    podium: $("screen-podium"),
  };
  function show(name) {
    for (const k in screens) screens[k].classList.toggle("hidden", k !== name);
  }

  /* ---------- Connect info / QR ---------- */
  function refreshConnectInfo() {
    return fetch("/api/connect-info?quiz=" + encodeURIComponent(quizId))
      .then((r) => r.json())
      .then((info) => {
        if (info.qr) $("qr").src = info.qr;
        if (info.url) $("conn-url").textContent = info.url.replace(/^https?:\/\//, "");
        if (info.pin) $("pin").textContent = info.pin;
        if (info.names && info.names.length) {
          $("hero-names").innerHTML = info.names.join(' <span class="heart">♥</span> ');
          document.title = info.names.join(" & ") + " — Présentateur";
        }
      })
      .catch(() => {});
  }
  refreshConnectInfo();

  /* ---------- Player list ---------- */
  function renderPlayers(players, count) {
    $("player-count").textContent = count;
    const el = $("player-list");
    el.innerHTML = "";
    players.forEach((p) => {
      const chip = document.createElement("div");
      chip.className = "pill";
      chip.textContent = p.name;
      el.appendChild(chip);
    });
    const canStart = count > 0;
    $("btn-start").disabled = !canStart;
    $("lobby-hint").textContent = canStart
      ? `${count} joueur${count > 1 ? "s" : ""} prêt${count > 1 ? "s" : ""} !`
      : "En attente d'au moins 1 joueur…";
  }

  /* ---------- Question ---------- */
  function renderQuestionTiles(container, options, opts) {
    opts = opts || {};
    container.innerHTML = "";
    options.forEach((label, i) => {
      const t = TILES[i];
      const div = document.createElement("div");
      div.className = `tile ${t.cls}`;
      div.dataset.index = i;
      let countHtml = "";
      if (opts.distribution) countHtml = `<span class="count">${opts.distribution[i]}</span>`;
      div.innerHTML = `<span class="shape">${shapeSvg(t.shape)}</span><span class="label">${label}</span>${countHtml}`;
      if (opts.correct !== undefined) {
        if (i === opts.correct) div.classList.add("correct");
        else div.classList.add("dim");
      }
      container.appendChild(div);
    });
  }

  function renderQuestion(q) {
    show("question");
    $("q-index").textContent = q.index + 1;
    $("q-total").textContent = q.total;
    $("q-text").textContent = q.text;
    $("timer").textContent = q.time;
    $("answer-count").textContent = q.answerCount || 0;
    renderQuestionTiles($("q-tiles"), q.options, {});
    $("btn-reveal").disabled = false;
    currentOptions = q.options;
    currentText = q.text;
    currentIndex = q.index;
    qTotal = q.total;
  }

  let currentOptions = [];
  let currentText = "";
  let qTotal = 0;
  let currentIndex = 0;

  /* ---------- Leaderboard ---------- */
  function renderLeaderboard(container, board, limit) {
    container.innerHTML = "";
    board.slice(0, limit || board.length).forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "pill";
      row.style.justifyContent = "space-between";
      row.style.width = "100%";
      const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
      row.innerHTML = `<span>${medal} ${p.name}</span><span class="display gold">${p.score}</span>`;
      container.appendChild(row);
    });
  }

  /* ---------- Podium ---------- */
  function renderPodium(top3) {
    const el = $("podium");
    el.innerHTML = "";
    const order = [1, 0, 2]; // 2e, 1er, 3e pour l'effet escalier
    const heights = { 0: "32vh", 1: "24vh", 2: "18vh" };
    const colors = { 0: "var(--gold)", 1: "#cfd8e3", 2: "#e0a36b" };
    order.forEach((rankIdx) => {
      const p = top3[rankIdx];
      if (!p) return;
      const col = document.createElement("div");
      col.className = "col center";
      col.style.gap = "10px";
      col.innerHTML = `
        <div class="display" style="font-size:1.3rem;">${["🥇","🥈","🥉"][rankIdx]}</div>
        <div class="display" style="font-size:1.2rem;">${p.name}</div>
        <div class="display gold" style="font-size:1.4rem;">${p.score}</div>
        <div style="width:min(20vw,160px); height:${heights[rankIdx]}; border-radius:14px 14px 0 0;
          background:linear-gradient(180deg, ${colors[rankIdx]}, rgba(255,255,255,0.08));
          box-shadow:var(--shadow); display:flex; align-items:flex-start; justify-content:center;
          font-family:'Unbounded'; font-size:2rem; padding-top:10px; color:#1a0b2e;">${rankIdx + 1}</div>
      `;
      el.appendChild(col);
    });
  }

  /* ---------- Socket events ---------- */
  socket.on("connect", () => socket.emit("host:join", { quizId }));

  socket.on("host:state", (s) => {
    $("pin").textContent = s.pin;
    renderPlayers(s.players, s.count);
    if (s.state === "question" && s.question) renderQuestion(s.question);
    else if (s.state === "lobby") show("lobby");
  });

  socket.on("players", (d) => renderPlayers(d.players, d.count));

  socket.on("question", (q) => renderQuestion(q));

  socket.on("tick", (d) => { $("timer").textContent = d.timeLeft; });

  socket.on("answerCount", (d) => { $("answer-count").textContent = d.answerCount; });

  socket.on("reveal", (d) => {
    show("reveal");
    $("r-text").textContent = currentText + "  →  " + currentOptions[d.correct];
    renderQuestionTiles($("r-tiles"), currentOptions, { correct: d.correct, distribution: d.distribution });
    renderLeaderboard($("r-leaderboard"), d.leaderboard, 8);
    const isLast = d.index + 1 >= qTotal;
    $("btn-next").textContent = isLast ? "Voir le podium 🏆" : "Question suivante ▶";
    confetti.burst(60);
  });

  socket.on("podium", (d) => {
    show("podium");
    renderPodium(d.podium);
    renderLeaderboard($("full-leaderboard"), d.leaderboard);
    confetti.shower(4000);
    setTimeout(() => confetti.burst(160), 300);
  });

  socket.on("reset", (d) => {
    $("pin").textContent = d.pin;
    show("lobby");
    confetti.stop();
  });

  /* ---------- Controls ---------- */
  $("btn-start").addEventListener("click", () => socket.emit("host:start"));
  $("btn-reveal").addEventListener("click", () => { $("btn-reveal").disabled = true; socket.emit("host:reveal"); });
  $("btn-next").addEventListener("click", () => socket.emit("host:next"));
  $("btn-restart").addEventListener("click", () => socket.emit("host:restart"));
  $("btn-new-room").addEventListener("click", () => {
    if (confirm("Exclure tous les joueurs et générer un nouveau code de salle ?")) {
      socket.emit("host:newRoom");
    }
  });

  // Salle réinitialisée : nouveau PIN + nouveau QR, retour au lobby vide
  socket.on("newRoom", (d) => {
    $("pin").textContent = d.pin;
    refreshConnectInfo();
    show("lobby");
    confetti.stop();
  });
})();

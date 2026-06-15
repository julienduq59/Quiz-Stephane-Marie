/* Interface joueur (mobile) */
(function () {
  const socket = io();

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
    join: $("screen-join"),
    wait: $("screen-wait"),
    answer: $("screen-answer"),
    result: $("screen-result"),
    finished: $("screen-finished"),
  };
  function show(name) {
    for (const k in screens) screens[k].classList.toggle("hidden", k !== name);
  }

  /* ---------- State / persistence ---------- */
  const store = {
    get id() { return localStorage.getItem("quiz_player_id"); },
    set id(v) { localStorage.setItem("quiz_player_id", v); },
    get name() { return localStorage.getItem("quiz_player_name") || ""; },
    set name(v) { localStorage.setItem("quiz_player_name", v); },
  };
  let answered = false;
  let myScore = 0;
  let joined = false; // passe à true seulement après validation manuelle du prénom

  // Pré-remplir l'URL ?pin=XXXXXX (depuis le QR code)
  const urlPin = new URLSearchParams(location.search).get("pin");
  if (urlPin) $("input-pin").value = urlPin.toUpperCase();
  if (store.name) $("input-name").value = store.name;

  /* ---------- Join ---------- */
  function doJoin() {
    const name = $("input-name").value.trim();
    const pin = $("input-pin").value.trim().toUpperCase();
    if (!name) { $("join-error").textContent = "Entre ton prénom !"; return; }
    $("btn-join").disabled = true;
    $("join-error").textContent = "";
    socket.emit("player:join", { name, pin, playerId: store.id || null }, (res) => {
      $("btn-join").disabled = false;
      if (!res || !res.ok) {
        $("join-error").textContent = (res && res.error) || "Connexion impossible.";
        return;
      }
      joined = true;
      store.id = res.playerId;
      store.name = res.name;
      myScore = res.score || 0;
      $("wait-name").textContent = res.name;
      $("wait-score").textContent = myScore;
      if (res.state === "lobby") show("wait");
      // sinon le serveur enverra l'écran adéquat (question/result/finished)
    });
  }
  $("btn-join").addEventListener("click", doJoin);
  $("input-name").addEventListener("keydown", (e) => { if (e.key === "Enter") doJoin(); });
  $("input-pin").addEventListener("keydown", (e) => { if (e.key === "Enter") doJoin(); });

  // Reconnexion automatique UNIQUEMENT en cours de partie (coupure réseau /
  // mise en veille du téléphone). Au premier chargement, on laisse toujours le
  // joueur saisir/valider son prénom sur l'écran « Rejoindre » (prénom pré-rempli).
  socket.on("connect", () => {
    if (joined && store.id) {
      socket.emit("player:join", { name: store.name, playerId: store.id }, (res) => {
        if (res && res.ok) {
          myScore = res.score || 0;
          $("wait-name").textContent = res.name;
          $("wait-score").textContent = myScore;
          if (res.state === "lobby") show("wait");
        }
      });
    }
  });

  /* ---------- Question ---------- */
  function renderTiles(options) {
    const el = $("p-tiles");
    el.innerHTML = "";
    options.forEach((label, i) => {
      const t = TILES[i];
      const div = document.createElement("button");
      div.className = `tile ${t.cls}`;
      div.dataset.index = i;
      div.innerHTML = `<span class="shape">${shapeSvg(t.shape)}</span><span class="label">${label}</span>`;
      div.addEventListener("click", () => answer(i));
      el.appendChild(div);
    });
  }

  function answer(choice) {
    if (answered) return;
    answered = true;
    // surligne le choix
    document.querySelectorAll("#p-tiles .tile").forEach((t) => {
      const idx = Number(t.dataset.index);
      if (idx === choice) t.classList.add("chosen");
      else t.classList.add("dim");
      t.style.pointerEvents = "none";
    });
    socket.emit("player:answer", { choice }, (res) => {
      if (!res || !res.ok) {
        // si refusé (ex : déjà répondu via autre onglet) on garde l'état envoyé
      }
      $("answer-sent").classList.remove("hidden");
    });
  }

  socket.on("question", (q) => {
    answered = false;
    show("answer");
    $("p-index").textContent = q.index + 1;
    $("p-timer").textContent = q.time;
    $("p-text").textContent = q.text;
    $("answer-sent").classList.add("hidden");
    renderTiles(q.options);
  });

  socket.on("answer:locked", (d) => {
    answered = true;
    document.querySelectorAll("#p-tiles .tile").forEach((t) => {
      const idx = Number(t.dataset.index);
      if (idx === d.choice) t.classList.add("chosen");
      else t.classList.add("dim");
      t.style.pointerEvents = "none";
    });
    $("answer-sent").classList.remove("hidden");
  });

  socket.on("tick", (d) => { $("p-timer").textContent = d.timeLeft; });

  /* ---------- Result ---------- */
  socket.on("result", (d) => {
    show("result");
    myScore = d.score;
    const card = $("result-card");
    if (d.yourChoice === null || d.yourChoice === undefined) {
      $("result-title").textContent = "⏱ Trop tard !";
      card.style.background = "rgba(255,255,255,0.06)";
    } else if (d.correct) {
      $("result-title").textContent = "✅ Bonne réponse !";
      card.style.background = "rgba(38,137,12,0.35)";
      confetti.burst(80);
    } else {
      $("result-title").textContent = "❌ Mauvaise réponse";
      card.style.background = "rgba(232,68,59,0.3)";
    }
    $("result-points").textContent = d.points > 0 ? `+${d.points} points` : "+0 point";
    $("result-score").textContent = d.score;
    $("result-rank").textContent = `${d.rank} / ${d.totalPlayers}`;
  });

  /* ---------- Finished ---------- */
  socket.on("finished", (d) => {
    show("finished");
    const ord = d.rank === 1 ? "1er" : `${d.rank}ᵉ`;
    $("final-rank").textContent = `Tu finis ${ord} sur ${d.totalPlayers} !`;
    $("final-score").textContent = d.score;
    if (d.rank <= 3) confetti.shower(3000);
  });

  /* ---------- Reset ---------- */
  socket.on("reset", () => {
    answered = false;
    myScore = 0;
    $("wait-score").textContent = 0;
    if (store.name) show("wait");
    else show("join");
    confetti.stop();
  });

  /* ---------- Exclusion (nouvelle salle) ---------- */
  socket.on("kicked", (d) => {
    joined = false;
    answered = false;
    myScore = 0;
    localStorage.removeItem("quiz_player_id"); // nouvelle identité au prochain join
    $("input-pin").value = ""; // l'ancien code n'est plus valide
    $("btn-join").disabled = false;
    $("join-error").textContent =
      (d && d.reason ? d.reason + " " : "") + "Saisis le nouveau code pour rejouer.";
    confetti.stop();
    show("join");
  });
})();

/* Écran présentateur */
(function () {
  const socket = io();

  // Quiz courant, déduit de l'URL : /quiz/<quizId>/host
  const quizId = location.pathname.split("/")[2] || "parents";
  let playerCount = 0; // joueurs connectés (pour « Réponses : n / total »)
  let isBlind = false;  // vrai pour le quiz blind test (renseigné par /api/connect-info)
  let teamMode = false, teams = []; // mode équipes (config reçue du serveur)
  let lastPlayers = [];              // dernière liste de joueurs (pour la recolorer)
  const TEAM_PRESETS = [
    { name: "Équipe Rouge", color: "#e8443b" }, { name: "Équipe Bleue", color: "#1368ce" },
    { name: "Équipe Jaune", color: "#d89e00" }, { name: "Équipe Verte", color: "#26890c" },
    { name: "Équipe Violette", color: "#8e44ad" }, { name: "Équipe Orange", color: "#e67e22" },
  ];

  /* ---------- Synthèse vocale (lecture des questions en français) ---------- */
  const TTS = "speechSynthesis" in window;
  let ttsEnabled = localStorage.getItem("quiz_tts") !== "off"; // activé par défaut
  let frVoice = null;

  // Note qualité d'une voix : on privilégie les voix « naturelles » / en ligne
  // (Google, Microsoft Natural…) plutôt que la voix robotique par défaut.
  function scoreVoice(v) {
    const n = (v.name || "").toLowerCase();
    let s = 0;
    if (/fr[-_]?fr/i.test(v.lang)) s += 3;
    else if (v.lang && v.lang.toLowerCase().startsWith("fr")) s += 2;
    if (n.includes("natural") || n.includes("naturel")) s += 8;
    if (n.includes("google")) s += 5;
    // Voix françaises « neurales » de Microsoft (Edge/Windows)
    if (/(denise|henri|éloise|eloise|vivienne|rémy|remy|brigitte|alain|yves|jacqueline|coralie)/.test(n)) s += 4;
    if (v.localService === false) s += 2; // voix en ligne = souvent meilleures
    if (n.includes("espeak") || n.includes("compact")) s -= 6;
    return s;
  }
  function pickVoice() {
    if (!TTS) return;
    const voices = speechSynthesis.getVoices() || [];
    const fr = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("fr"));
    const list = (fr.length ? fr : voices).slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
    frVoice = list[0] || null;
    // Préférence sauvegardée par l'utilisateur ?
    const saved = localStorage.getItem("quiz_voice");
    if (saved) {
      const m = voices.find((v) => v.name === saved);
      if (m) frVoice = m;
    }
    populateVoiceSelect(fr);
  }
  function populateVoiceSelect(frVoices) {
    const sel = document.getElementById("voice-select");
    if (!sel) return;
    if (!frVoices || !frVoices.length) { sel.style.display = "none"; return; }
    // Évite de reconstruire à chaque appel
    if (sel.dataset.count === String(frVoices.length)) {
      sel.value = frVoice ? frVoice.name : "";
      return;
    }
    sel.dataset.count = String(frVoices.length);
    sel.innerHTML = "";
    frVoices
      .slice()
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))
      .forEach((v) => {
        const o = document.createElement("option");
        o.value = v.name;
        o.textContent = v.name.replace(/microsoft |google /i, "").slice(0, 28);
        sel.appendChild(o);
      });
    sel.value = frVoice ? frVoice.name : "";
    sel.style.display = ttsEnabled ? "block" : "none";
  }
  if (TTS) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function stopSpeaking() {
    if (TTS) speechSynthesis.cancel();
  }
  function speak(text) {
    if (!TTS || !ttsEnabled || !text) return;
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    if (frVoice) u.voice = frVoice;
    u.rate = 1.0;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  }
  function speakQuestion(q) {
    if (!q) return;
    const labels = ["Rouge", "Bleu", "Jaune", "Vert"];
    const opts = q.options
      .map((o, i) => `${labels[i] || "Réponse " + (i + 1)} : ${o}.`)
      .join(" ");
    speak(`${q.text} … ${opts}`);
  }
  function updateTtsButton() {
    const b = document.getElementById("btn-tts");
    if (!b) return;
    b.textContent = ttsEnabled ? "🔊 Voix" : "🔇 Voix";
    b.style.opacity = ttsEnabled ? "1" : "0.55";
    if (!TTS) { b.style.display = "none"; }
    const sel = document.getElementById("voice-select");
    if (sel) sel.style.display = ttsEnabled && sel.options.length ? "block" : "none";
  }
  updateTtsButton();

  // Choix manuel de la voix
  (function wireVoiceSelect() {
    const sel = document.getElementById("voice-select");
    if (!sel) return;
    sel.addEventListener("change", () => {
      const voices = TTS ? speechSynthesis.getVoices() : [];
      const v = voices.find((x) => x.name === sel.value);
      if (v) {
        frVoice = v;
        localStorage.setItem("quiz_voice", v.name);
        speak("Voici ma voix pour le quiz."); // aperçu
      }
    });
  })();

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

  // Échappe le texte avant de l'insérer en HTML (prénoms, réponses…) : empêche
  // toute injection de script par un joueur malveillant.
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    const app = document.getElementById("app");
    if (app) app.dataset.screen = name;
    Sfx.lobby(name === "lobby"); // musique d'attente uniquement au lobby
  }

  // Met à jour le code affiché partout (lobby + badge permanent en haut à gauche)
  function setPin(pin) {
    if (!pin) return;
    const a = $("pin"); if (a) a.textContent = pin;
    const b = $("pin-badge-code"); if (b) b.textContent = pin;
  }

  /* ---------- Connect info / QR ---------- */
  function refreshConnectInfo() {
    return fetch("/api/connect-info?quiz=" + encodeURIComponent(quizId))
      .then((r) => r.json())
      .then((info) => {
        if (info.qr) {
          $("qr").src = info.qr;
          const badgeQr = $("pin-badge-qr");
          if (badgeQr) badgeQr.src = info.qr;
        }
        if (info.url) $("conn-url").textContent = info.url.replace(/^https?:\/\//, "");
        if (info.pin) setPin(info.pin);
        if (typeof info.isBlind === "boolean") isBlind = info.isBlind;
        if (info.names && info.names.length) {
          $("hero-names").innerHTML = info.names.map(esc).join(' <span class="heart">♥</span> ');
          document.title = info.names.join(" & ") + " — Présentateur";
        }
      })
      .catch(() => {});
  }
  refreshConnectInfo();

  /* ---------- Player list ---------- */
  function renderPlayers(players, count) {
    playerCount = count;
    lastPlayers = players;
    $("player-count").textContent = count;
    const el = $("player-list");
    el.innerHTML = "";
    players.forEach((p) => {
      const chip = document.createElement("div");
      chip.className = "pill";
      chip.textContent = p.name;
      const team = teamMode && teams.find((x) => x.id === p.teamId);
      if (team) {
        chip.style.borderColor = team.color;
        chip.style.boxShadow = "inset 4px 0 0 " + team.color;
      }
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
      div.innerHTML = `<span class="shape">${shapeSvg(t.shape)}</span><span class="label">${esc(label)}</span>${countHtml}`;
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
    $("answer-count").textContent = (q.answerCount || 0) + " / " + playerCount;
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


  /* ---------- Blind test : lecture automatique de l'extrait ---------- */
  const audio = $("player");

  function musicStop() {
    if (!audio) return;
    try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (e) {}
    $("btn-music").classList.add("hidden");
  }
  function musicUi(txt, showBtn) {
    $("music-state").textContent = txt;
    $("btn-music").classList.toggle("hidden", !showBtn);
  }
  function musicPlay(url, label) {
    if (!audio || !url) return;
    audio.src = url;
    audio.currentTime = 0;
    audio.volume = 1;
    const p = audio.play();
    if (p && p.catch) {
      p.then(() => musicUi("🎵 Écoute bien…", false))
       .catch(() => {
         // Le navigateur a bloqué la lecture automatique : bouton de secours
         musicUi("🔇 Lecture bloquée par le navigateur", true);
       });
    }
    audio._label = label || "";
  }
  $("btn-music").addEventListener("click", () => {
    if (audio && audio.src) audio.play().then(() => musicUi("🎵 Écoute bien…", false)).catch(() => {});
  });

  socket.on("music", (d) => {
    if (d.index !== currentIndex) return; // extrait d'une question précédente
    if (d.url) musicPlay(d.url, d.label);
    else musicUi("⚠️ Extrait indisponible — annonce la chanson toi-même", false);
  });

  /* ---------- Leaderboard ---------- */
  function renderLeaderboard(container, board, limit) {
    container.innerHTML = "";
    board.slice(0, limit || board.length).forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "pill";
      row.style.justifyContent = "space-between";
      row.style.width = "100%";
      const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
      row.innerHTML = `<span>${medal} ${esc(p.name)}</span><span class="display gold">${Number(p.score) || 0}</span>`;
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
        <div class="display" style="font-size:1.2rem;">${esc(p.name)}</div>
        <div class="display gold" style="font-size:1.4rem;">${Number(p.score) || 0}</div>
        <div style="width:min(20vw,160px); height:${heights[rankIdx]}; border-radius:14px 14px 0 0;
          background:linear-gradient(180deg, ${colors[rankIdx]}, rgba(255,255,255,0.08));
          box-shadow:var(--shadow); display:flex; align-items:flex-start; justify-content:center;
          font-family:'Unbounded'; font-size:2rem; padding-top:10px; color:#1a0b2e;">${rankIdx + 1}</div>
      `;
      el.appendChild(col);
    });
  }

  /* ---------- Socket events ---------- */
  /* ---------- Effets sonores ---------- */
  let sfxOn = true;
  try { sfxOn = localStorage.getItem("quiz_sfx") !== "off"; } catch (e) {}
  Sfx.setEnabled(sfxOn);
  function updateSfxButton() {
    const b = $("btn-sfx");
    b.textContent = sfxOn ? "🔔 Sons" : "🔕 Sons";
    b.style.opacity = sfxOn ? "1" : "0.55";
  }
  updateSfxButton();
  $("btn-sfx").addEventListener("click", () => {
    sfxOn = !sfxOn;
    try { localStorage.setItem("quiz_sfx", sfxOn ? "on" : "off"); } catch (e) {}
    Sfx.setEnabled(sfxOn);
    updateSfxButton();
  });
  // Les navigateurs n'autorisent le son qu'après un geste : premier clic/touche = déblocage
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, () => Sfx.unlock(), { passive: true }));

  /* ---------- Code présentateur ---------- */
  const CODE_KEY = "quiz_host_code";
  let hostCode = "";
  try { hostCode = localStorage.getItem(CODE_KEY) || ""; } catch (e) {}
  const TOKEN_KEY = "quiz_host_token";
  let hostToken = "";
  try { hostToken = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) {}
  let isHost = false;
  function joinAsHost() { socket.emit("host:join", { quizId, code: hostCode, token: hostToken }); }
  socket.on("host:token", (d) => {
    hostToken = (d && d.token) || "";
    try { localStorage.setItem(TOKEN_KEY, hostToken); } catch (e) {}
  });
  function submitCode() {
    const v = $("code-input").value.trim();
    if (!v) { $("code-error").textContent = "Entre le code."; return; }
    hostCode = v;
    $("code-error").textContent = "";
    joinAsHost();
  }
  $("code-ok").addEventListener("click", submitCode);
  $("code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitCode(); });
  socket.on("host:denied", (d) => {
    isHost = false;
    hostToken = "";
    // On n'oublie le code que s'il est faux (pas en cas de blocage temporaire)
    try { localStorage.removeItem(TOKEN_KEY); if (d && /incorrect/.test(d.reason || "")) localStorage.removeItem(CODE_KEY); } catch (e) {}
    $("code-modal").classList.remove("hidden");
    $("code-error").textContent = (d && d.reason) || "";
    $("code-input").value = "";
    setTimeout(() => $("code-input").focus(), 50);
  });
  socket.on("connect", joinAsHost);

  socket.on("host:state", (s) => {
    isHost = true;
    try { localStorage.setItem(CODE_KEY, hostCode); } catch (e) {}
    $("code-modal").classList.add("hidden");
    applyTeams(s.teamMode, s.teams);
    if (s.questionCount != null) setQuestionsLabel(s.questionCount, s.customQuestions);
    editor.pushLocal(); // renvoie les questions modifiées sur cet appareil (serveur redémarré…)
    setPin(s.pin);
    renderPlayers(s.players, s.count);
    if (s.state === "question" && s.question) renderQuestion(s.question);
    else if (s.state === "lobby") show("lobby");
  });

  socket.on("players", (d) => renderPlayers(d.players, d.count));

  socket.on("question", (q) => {
    renderQuestion(q);
    musicStop();
    $("music-bar").classList.toggle("hidden", !isBlind);
    if (isBlind) musicUi("🎵 Chargement de l'extrait…", false);
    // En blind test la voix se tairait par-dessus la musique
    if (!isBlind) speakQuestion(q);
  });

  socket.on("tick", (d) => {
    $("timer").textContent = d.timeLeft;
    const onQuestion = document.getElementById("app").dataset.screen === "question";
    if (onQuestion && !isBlind && d.timeLeft >= 1 && d.timeLeft <= 5) Sfx.tick(d.timeLeft);
  });

  socket.on("answerCount", (d) => {
    $("answer-count").textContent = d.answerCount + " / " + (d.total != null ? d.total : playerCount);
  });

  socket.on("reveal", (d) => {
    stopSpeaking();
    Sfx.reveal();
    musicStop();
    show("reveal");
    $("r-text").textContent = currentText + "  →  " + currentOptions[d.correct];
    renderQuestionTiles($("r-tiles"), currentOptions, { correct: d.correct, distribution: d.distribution });
    renderLeaderboard($("r-leaderboard"), d.leaderboard, 8);
    renderTeamBoard("r-teams-card", "r-teams", d.teams);
    const isLast = d.index + 1 >= qTotal;
    const label = isLast ? "Voir le podium 🏆" : "Question suivante ▶";
    $("btn-next").textContent = label;
    $("btn-next-top").textContent = label;
    confetti.burst(60);
  });

  socket.on("podium", (d) => {
    stopSpeaking();
    Sfx.fanfare();
    musicStop();
    show("podium");
    const rb = $("btn-results");
    if (rb) rb.href = "/api/results.pdf?quiz=" + encodeURIComponent(quizId);
    histRecord(); // sauvegarde automatique de la partie terminée
    renderPodium(d.podium);
    renderLeaderboard($("full-leaderboard"), d.leaderboard);
    renderTeamBoard("p-teams-card", "p-teams", d.teams);
    confetti.shower(4000);
    setTimeout(() => confetti.burst(160), 300);
  });

  socket.on("reset", (d) => {
    stopSpeaking();
    musicStop();
    setPin(d.pin);
    show("lobby");
    confetti.stop();
  });


  /* ---------- Historique des parties (sauvegarde locale) ---------- */
  const HIST_KEY = "quiz_history";
  function histLoad() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; }
  }
  function histSave(list) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }
  // Enregistre le récap de la partie qui vient de se terminer
  function histRecord() {
    fetch("/api/results?quiz=" + encodeURIComponent(quizId))
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res || !res.ranking) return;
        const list = histLoad();
        const stamp = new Date(res.date || Date.now()).getTime();
        // évite les doublons si le podium est réaffiché
        if (list.some((g) => g.stamp === stamp && g.quizId === res.quizId)) return;
        list.unshift({ stamp, quizId: res.quizId, names: res.names, nbPlayers: res.nbPlayers,
                       nbQuestions: res.nbQuestions, top: res.ranking.slice(0, 3), full: res });
        histSave(list);
      })
      .catch(() => {});
  }
  function histRender() {
    const el = $("history-list");
    const list = histLoad();
    el.innerHTML = "";
    if (!list.length) {
      el.innerHTML = '<div class="muted center" style="padding:20px;">Aucune partie enregistrée pour le moment.</div>';
      return;
    }
    list.forEach((g, i) => {
      const d = new Date(g.stamp);
      const row = document.createElement("div");
      row.className = "pill";
      row.style.cssText = "width:100%; justify-content:space-between; gap:12px; flex-wrap:wrap;";
      const quand = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
        " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const gagnant = g.top && g.top[0] ? esc(g.top[0].name) + " (" + (Number(g.top[0].score) || 0) + " pts)" : "—";
      row.innerHTML =
        '<div style="text-align:left;"><div class="display" style="font-size:0.95rem;">' + quand + '</div>' +
        '<div class="muted" style="font-size:0.82rem;">' + (g.names || []).map(esc).join(" & ") + " · " +
        (Number(g.nbPlayers) || 0) + " joueurs · " + (Number(g.nbQuestions) || 0) + " questions · 🥇 " + gagnant + '</div></div>';
      const btns = document.createElement("div");
      btns.style.cssText = "display:flex; gap:8px;";
      const dl = document.createElement("button");
      dl.className = "btn"; dl.style.cssText = "padding:8px 14px; font-size:0.82rem;";
      dl.textContent = "📄 PDF";
      dl.addEventListener("click", () => histDownload(g));
      const del = document.createElement("button");
      del.className = "btn secondary"; del.style.cssText = "padding:8px 12px; font-size:0.82rem;";
      del.textContent = "🗑";
      del.title = "Supprimer cette partie";
      del.addEventListener("click", () => {
        if (!confirm("Supprimer définitivement cette partie de l'historique ?")) return;
        const l = histLoad(); l.splice(i, 1); histSave(l); histRender();
      });
      btns.appendChild(dl); btns.appendChild(del);
      row.appendChild(btns);
      el.appendChild(row);
    });
  }
  // Refabrique le PDF à partir du récap stocké localement
  function histDownload(g) {
    fetch("/api/results.pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(g.full),
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resultats-quiz-" + (g.quizId || "quiz") + "-" +
          new Date(g.stamp).toISOString().slice(0, 10) + ".pdf";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      })
      .catch(() => alert("Impossible de générer le PDF."));
  }
  $("btn-history").addEventListener("click", () => { histRender(); $("history-modal").classList.remove("hidden"); });
  $("btn-history-close").addEventListener("click", () => $("history-modal").classList.add("hidden"));
  $("history-modal").addEventListener("click", (e) => {
    if (e.target === $("history-modal")) $("history-modal").classList.add("hidden");
  });


  /* ---------- Mode équipes ---------- */
  function applyTeams(enabled, list) {
    teamMode = !!enabled;
    teams = list || [];
    $("btn-teams").textContent = teamMode ? "👥 Équipes : " + teams.length : "👥 Équipes : non";
    const sum = $("teams-summary");
    sum.innerHTML = "";
    sum.classList.toggle("hidden", !teamMode);
    teams.forEach((tm) => {
      const chip = document.createElement("span");
      chip.className = "pill";
      chip.style.cssText = "font-size:0.85rem; border-color:" + tm.color + "; box-shadow: inset 4px 0 0 " + tm.color + ";";
      chip.textContent = tm.name + " · " + (tm.count || 0);
      sum.appendChild(chip);
    });
    renderPlayers(lastPlayers, lastPlayers.length);
  }
  socket.on("teams", (d) => applyTeams(d.enabled, d.teams));

  // Classement des équipes (révélation et podium)
  function renderTeamBoard(card, container, board) {
    const list = board || [];
    $(card).classList.toggle("hidden", !list.length);
    const el = $(container);
    el.innerHTML = "";
    list.forEach((tm, i) => {
      const row = document.createElement("div");
      row.className = "pill";
      row.style.cssText = "width:100%; justify-content:space-between; box-shadow: inset 6px 0 0 " + tm.color + ";" +
        (i === 0 ? " border-color:" + tm.color + ";" : "");
      const medal = ["🥇", "🥈", "🥉"][i] || (i + 1) + ".";
      row.innerHTML =
        "<span>" + medal + " <b>" + esc(tm.name) + "</b> <span class=\"muted\" style=\"font-size:0.85rem;\">(" +
        (Number(tm.members) || 0) + " joueur" + (tm.members > 1 ? "s" : "") + ")</span></span>" +
        "<span class=\"display gold\">" + (Number(tm.avg) || 0) + " <span class=\"muted\" style=\"font-size:0.8rem;\">moy.</span></span>";
      el.appendChild(row);
    });
  }

  // Fenêtre de configuration
  let draftCount = 2;
  function teamsModalRender() {
    const on = $("teams-enabled").checked;
    $("teams-config").style.opacity = on ? "1" : "0.4";
    $("teams-config").style.pointerEvents = on ? "" : "none";
    const cnt = $("teams-count");
    cnt.innerHTML = "";
    for (let n = 2; n <= 6; n++) {
      const b = document.createElement("button");
      b.className = "btn " + (n === draftCount ? "" : "secondary");
      b.style.cssText = "padding:8px 16px; font-size:0.95rem;";
      b.textContent = n;
      b.addEventListener("click", () => { draftCount = n; teamsModalRender(); });
      cnt.appendChild(b);
    }
    // Conserve les noms déjà saisis quand on change le nombre d'équipes
    const typed = Array.from(document.querySelectorAll("#teams-names input")).map((i) => i.value);
    const names = $("teams-names");
    names.innerHTML = "";
    for (let i = 0; i < draftCount; i++) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:10px; align-items:center;";
      const dot = document.createElement("span");
      dot.style.cssText = "width:18px; height:18px; border-radius:50%; flex:0 0 auto; background:" + TEAM_PRESETS[i].color + ";";
      const input = document.createElement("input");
      input.maxLength = 20;
      input.placeholder = TEAM_PRESETS[i].name;
      input.value = typed[i] != null ? typed[i] : (teams[i] && teams[i].name !== TEAM_PRESETS[i].name ? teams[i].name : "");
      input.style.cssText = "flex:1; padding:10px 12px; border-radius:10px; border:none; font-size:1rem; font-family:Inter;";
      row.appendChild(dot); row.appendChild(input);
      names.appendChild(row);
    }
  }
  $("btn-teams").addEventListener("click", () => {
    $("teams-enabled").checked = teamMode;
    draftCount = teamMode && teams.length ? teams.length : 2;
    $("teams-names").innerHTML = "";
    $("teams-error").textContent = "";
    teamsModalRender();
    $("teams-modal").classList.remove("hidden");
  });
  $("teams-enabled").addEventListener("change", teamsModalRender);
  $("btn-teams-close").addEventListener("click", () => $("teams-modal").classList.add("hidden"));
  $("teams-modal").addEventListener("click", (e) => { if (e.target === $("teams-modal")) $("teams-modal").classList.add("hidden"); });
  $("btn-teams-save").addEventListener("click", () => {
    const names = Array.from(document.querySelectorAll("#teams-names input")).map((i) => i.value.trim());
    socket.emit("host:setTeams", { enabled: $("teams-enabled").checked, count: draftCount, names }, (r) => {
      if (r && r.ok) $("teams-modal").classList.add("hidden");
      else $("teams-error").textContent = (r && r.error) || "Impossible d'enregistrer.";
    });
  });

  /* ---------- Éditeur de questions ---------- */
  function setQuestionsLabel(count, custom) {
    $("btn-editor").textContent = "✏️ Questions (" + count + ")" + (custom ? " ✱" : "");
    $("btn-editor").title = custom ? "Questions personnalisées (enregistrées sur cet appareil)" : "Questions d'origine";
  }
  const editor = QuizEditor({ socket, quizId, onChange: setQuestionsLabel });
  $("btn-editor").addEventListener("click", () => editor.open());
  socket.on("questionsChanged", (d) => setQuestionsLabel(d.count, d.custom));

  /* ---------- Controls ---------- */
  $("btn-start").addEventListener("click", () => socket.emit("host:start"));
  $("btn-reveal").addEventListener("click", () => { $("btn-reveal").disabled = true; socket.emit("host:reveal"); });
  $("btn-next").addEventListener("click", () => socket.emit("host:next"));
  $("btn-next-top").addEventListener("click", () => socket.emit("host:next"));
  $("btn-restart").addEventListener("click", () => socket.emit("host:restart"));
  $("btn-new-room").addEventListener("click", () => {
    if (confirm("Exclure tous les joueurs et générer un nouveau code de salle ?")) {
      socket.emit("host:newRoom");
    }
  });
  $("btn-tts").addEventListener("click", () => {
    ttsEnabled = !ttsEnabled;
    localStorage.setItem("quiz_tts", ttsEnabled ? "on" : "off");
    updateTtsButton();
    if (!ttsEnabled) stopSpeaking();
    else speak("Lecture vocale activée."); // teste la voix + débloque l'autorisation navigateur
  });

  // Salle réinitialisée : nouveau PIN + nouveau QR, retour au lobby vide
  socket.on("newRoom", (d) => {
    stopSpeaking();
    musicStop();
    setPin(d.pin);
    refreshConnectInfo();
    show("lobby");
    confetti.stop();
  });
})();

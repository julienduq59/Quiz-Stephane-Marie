/**
 * Éditeur de questions (écran présentateur).
 *
 * Les questions modifiées sont enregistrées sur CET appareil (localStorage) et
 * envoyées au serveur, qui les vérifie. Le serveur ne les garde qu'en mémoire
 * (le disque de Render est effacé à chaque redémarrage) : la page présentateur les
 * lui renvoie donc automatiquement à chaque connexion (pushLocal).
 *
 *   const ed = QuizEditor({ socket, quizId, onChange(count, custom) });
 *   ed.open();      ouvre l'éditeur
 *   ed.pushLocal(); renvoie au serveur la version enregistrée sur cet appareil
 */
window.QuizEditor = function ({ socket, quizId, onChange }) {
  const KEY = "quiz_questions_" + quizId;
  const $ = (id) => document.getElementById(id);
  const TILE_COLORS = ["#e8443b", "#1368ce", "#d89e00", "#26890c"];
  let draft = [], isBlind = false, dirty = false, errorShown = false;

  const clone = (x) => JSON.parse(JSON.stringify(x));
  function readLocal() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) ? v : null; }
    catch (e) { return null; }
  }
  function status(msg, isError) {
    const el = $("ed-status");
    el.textContent = msg || "";
    el.style.color = isError ? "#ff8fa8" : "";
    el.style.fontWeight = isError ? "700" : "";
    errorShown = !!isError;
  }
  // Toute modification efface un message d'erreur devenu obsolète
  function touched() {
    dirty = true;
    if (errorShown) status("");
  }

  // Met une question au format de l'éditeur (4 réponses, durée, musique)
  function normalize(q) {
    const opts = Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => String(o || "")) : [];
    while (opts.length < 4) opts.push("");
    const out = {
      text: String(q.text || ""),
      options: opts,
      correct: Math.min(3, Math.max(0, parseInt(q.correct, 10) || 0)),
      time: parseInt(q.time, 10) || (isBlind ? 30 : 40),
    };
    if (isBlind || q.music) out.music = { artist: (q.music && q.music.artist) || "", title: (q.music && q.music.title) || "",
                                         ...(q.music && q.music.audio ? { audio: q.music.audio } : {}) };
    return out;
  }
  const blank = () => normalize({ text: "", options: [], correct: 0 });

  /* ---------- Rendu ---------- */
  function field(label, el) {
    const w = document.createElement("label");
    w.className = "col";
    w.style.gap = "4px";
    const l = document.createElement("span");
    l.className = "muted";
    l.style.fontSize = "0.8rem";
    l.textContent = label;
    w.appendChild(l); w.appendChild(el);
    return w;
  }
  function input(value, placeholder, cls) {
    const i = document.createElement("input");
    i.value = value; i.placeholder = placeholder || "";
    if (cls) i.className = cls;
    i.style.cssText = "padding:9px 11px; border-radius:9px; border:2px solid transparent; font-size:0.95rem; font-family:Inter; width:100%; box-sizing:border-box;";
    i.addEventListener("input", () => { touched(); i.style.borderColor = "transparent"; });
    return i;
  }
  function smallBtn(txt, title, onClick, disabled) {
    const b = document.createElement("button");
    b.className = "btn secondary";
    b.style.cssText = "padding:6px 11px; font-size:0.85rem;";
    b.textContent = txt; b.title = title; b.disabled = !!disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function render() {
    const list = $("ed-list");
    list.innerHTML = "";
    $("ed-count").textContent = "(" + draft.length + ")";
    draft.forEach((q, i) => {
      const card = document.createElement("div");
      card.className = "card col ed-card";
      card.style.gap = "12px";

      // En-tête : numéro + déplacer / supprimer
      const head = document.createElement("div");
      head.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px;";
      const num = document.createElement("div");
      num.className = "display";
      num.textContent = "Question " + (i + 1);
      const tools = document.createElement("div");
      tools.style.cssText = "display:flex; gap:6px;";
      tools.appendChild(smallBtn("▲", "Monter", () => move(i, -1), i === 0));
      tools.appendChild(smallBtn("▼", "Descendre", () => move(i, 1), i === draft.length - 1));
      tools.appendChild(smallBtn("🗑", "Supprimer", () => remove(i)));
      head.appendChild(num); head.appendChild(tools);
      card.appendChild(head);

      const ta = document.createElement("textarea");
      ta.className = "ed-text";
      ta.value = q.text; ta.rows = 2; ta.maxLength = 300;
      ta.placeholder = "Énoncé de la question";
      ta.style.cssText = "padding:10px 12px; border-radius:10px; border:2px solid transparent; font-size:1rem; font-family:Inter; resize:vertical; width:100%; box-sizing:border-box;";
      ta.addEventListener("input", () => { touched(); ta.style.borderColor = "transparent"; });
      card.appendChild(field("Énoncé", ta));

      // Réponses : le bouton rond désigne la bonne
      const answers = document.createElement("div");
      answers.className = "col"; answers.style.gap = "8px";
      const group = "ed-correct-" + i + "-" + Math.random().toString(36).slice(2, 7);
      q.options.forEach((opt, j) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; gap:10px; align-items:center;";
        const radio = document.createElement("input");
        radio.type = "radio"; radio.name = group; radio.className = "ed-correct"; radio.value = j;
        radio.checked = q.correct === j;
        radio.title = "Bonne réponse";
        radio.style.cssText = "width:20px; height:20px; accent-color:#3aa03a; flex:0 0 auto; cursor:pointer;";
        radio.addEventListener("change", touched);
        const dot = document.createElement("span");
        dot.style.cssText = "width:14px; height:14px; border-radius:4px; flex:0 0 auto; background:" + TILE_COLORS[j] + ";";
        const inp = input(opt, j < 2 ? "Réponse " + (j + 1) : "Réponse " + (j + 1) + " (facultative)", "ed-opt");
        inp.maxLength = 120;
        row.appendChild(radio); row.appendChild(dot); row.appendChild(inp);
        answers.appendChild(row);
      });
      card.appendChild(field("Réponses — coche la bonne", answers));

      // Durée (+ musique pour un blind test)
      const extra = document.createElement("div");
      extra.style.cssText = "display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;";
      const time = input(String(q.time), "40", "ed-time");
      time.type = "number"; time.min = 5; time.max = 120; time.style.width = "90px";
      extra.appendChild(field("Durée (s)", time));
      if (isBlind) {
        const a = input(q.music ? q.music.artist : "", "Artiste", "ed-artist");
        const t = input(q.music ? q.music.title : "", "Titre", "ed-title");
        const wa = field("🎵 Artiste", a); wa.style.flex = "1"; wa.style.minWidth = "160px";
        const wt = field("🎵 Titre", t); wt.style.flex = "1"; wt.style.minWidth = "160px";
        extra.appendChild(wa); extra.appendChild(wt);
        if (q.music && q.music.audio) card.dataset.audio = q.music.audio; // fichier forcé conservé
      }
      card.appendChild(extra);
      list.appendChild(card);
    });
  }

  /* ---------- Lecture du formulaire ---------- */
  function collect() {
    return Array.from(document.querySelectorAll("#ed-list .ed-card")).map((card) => {
      const options = Array.from(card.querySelectorAll(".ed-opt")).map((i) => i.value);
      const checked = card.querySelector(".ed-correct:checked");
      const q = {
        text: card.querySelector(".ed-text").value,
        options,
        correct: checked ? parseInt(checked.value, 10) : 0,
        time: parseInt(card.querySelector(".ed-time").value, 10) || (isBlind ? 30 : 40),
      };
      if (isBlind) {
        q.music = { artist: card.querySelector(".ed-artist").value, title: card.querySelector(".ed-title").value };
        if (card.dataset.audio) q.music.audio = card.dataset.audio;
      }
      return q;
    });
  }

  // Vérification avant envoi : on signale la 1re erreur et on l'encadre en rouge
  function validate(list) {
    const cards = document.querySelectorAll("#ed-list .ed-card");
    // sel : sélecteur CSS, ou numéro de réponse (0-3) pour encadrer ce champ-là
    const flag = (i, sel) => {
      const card = cards[i];
      if (!card) return;
      const el = typeof sel === "number" ? card.querySelectorAll(".ed-opt")[sel] : card.querySelector(sel);
      if (el) { el.style.borderColor = "#ff5d8f"; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
    };
    if (!list.length) return "Il faut au moins une question.";
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q.text.trim()) { flag(i, ".ed-text"); return `Question ${i + 1} : l'énoncé est vide.`; }
      if (q.options.filter((o) => o.trim()).length < 2) {
        flag(i, q.options.findIndex((o) => !o.trim()));
        return `Question ${i + 1} : il faut au moins 2 réponses.`;
      }
      if (!q.options[q.correct] || !q.options[q.correct].trim()) {
        flag(i, q.correct);
        return `Question ${i + 1} : la bonne réponse cochée est vide.`;
      }
      if (isBlind && (!q.music.artist.trim() || !q.music.title.trim())) {
        flag(i, q.music.artist.trim() ? ".ed-title" : ".ed-artist");
        return `Question ${i + 1} : indique l'artiste et le titre de la musique.`;
      }
    }
    return null;
  }

  /* ---------- Actions ---------- */
  function move(i, d) {
    draft = collect();
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    [draft[i], draft[j]] = [draft[j], draft[i]];
    touched(); render();
  }
  function remove(i) {
    draft = collect();
    if (!confirm("Supprimer la question " + (i + 1) + " ?\n« " + (draft[i].text || "sans énoncé") + " »")) return;
    draft.splice(i, 1);
    touched(); render();
  }
  function add() {
    draft = collect();
    draft.push(blank());
    touched(); render();
    const cards = document.querySelectorAll("#ed-list .ed-card");
    const last = cards[cards.length - 1];
    if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); last.querySelector(".ed-text").focus(); }
  }
  function save() {
    const list = collect();
    const err = validate(list);
    if (err) { status("⚠️ " + err, true); return; }
    $("ed-save").disabled = true;
    socket.emit("host:setQuestions", { questions: list }, (r) => {
      $("ed-save").disabled = false;
      if (!r || !r.ok) { status("⚠️ " + ((r && r.error) || "Enregistrement impossible."), true); return; }
      try { localStorage.setItem(KEY, JSON.stringify(r.questions)); } catch (e) {}
      draft = r.questions.map(normalize);
      dirty = false;
      render();
      status(r.nextGame
        ? "✅ Enregistré — une partie est en cours : les questions s'appliqueront à la suivante."
        : "✅ Enregistré sur cet appareil. Utilisé dès la prochaine partie.");
      if (onChange) onChange(r.count, true);
    });
  }
  function exportJson() {
    const data = JSON.stringify(collect(), null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "questions-" + quizId + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status("⬇ Fichier exporté. Tu peux l'importer sur un autre ordinateur.");
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { status("⚠️ Fichier illisible (JSON attendu).", true); return; }
      if (!Array.isArray(data) || !data.length) { status("⚠️ Le fichier ne contient pas de liste de questions.", true); return; }
      draft = data.slice(0, 100).map(normalize);
      dirty = true; render();
      status("⬆ " + draft.length + " question(s) importée(s). Vérifie puis clique « Enregistrer ».");
    };
    reader.readAsText(file);
  }
  function reset() {
    if (!confirm("Revenir aux questions d'origine ?\nTes modifications seront effacées de cet appareil.")) return;
    socket.emit("host:resetQuestions", {}, (r) => {
      if (!r || !r.ok) { status("⚠️ Impossible de revenir aux questions d'origine.", true); return; }
      try { localStorage.removeItem(KEY); } catch (e) {}
      draft = r.questions.map(normalize);
      dirty = false; render();
      status("↺ Questions d'origine rétablies.");
      if (onChange) onChange(r.questions.length, false);
    });
  }
  function close() {
    if (dirty && !confirm("Fermer sans enregistrer tes modifications ?")) return;
    dirty = false;
    $("editor-modal").classList.add("hidden");
  }

  function open() {
    socket.emit("host:getQuestions", {}, (r) => {
      if (!r || !r.ok) { alert("Accès refusé : reconnecte-toi en tant que présentateur."); return; }
      isBlind = !!r.isBlind;
      draft = r.questions.map(normalize);
      dirty = false;
      render();
      status(r.custom
        ? "Questions personnalisées (enregistrées sur cet appareil)."
        : "Questions d'origine. Tes modifications seront enregistrées sur cet appareil.");
      $("editor-modal").classList.remove("hidden");
      $("editor-modal").scrollTop = 0;
    });
  }

  // Renvoie au serveur la version enregistrée ici (après un redémarrage du serveur)
  function pushLocal() {
    const saved = readLocal();
    if (!saved) return;
    socket.emit("host:setQuestions", { questions: saved }, (r) => {
      if (r && r.ok && onChange) onChange(r.count, true);
    });
  }

  $("ed-add").addEventListener("click", add);
  $("ed-save").addEventListener("click", save);
  $("ed-close").addEventListener("click", close);
  $("ed-export").addEventListener("click", exportJson);
  $("ed-import").addEventListener("click", () => $("ed-file").click());
  $("ed-file").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; });
  $("ed-reset").addEventListener("click", reset);

  return { open, pushLocal };
};

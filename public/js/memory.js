/**
 * Mémoire des quiz : les dernières parties, gardées sur cet ordinateur, et leur
 * analyse (trophées, course au podium, réussite par question, panthéon).
 *
 *   const memory = QuizMemory({ quizId });
 *   memory.record()          → enregistre la partie qui vient de se terminer (promesse)
 *   memory.open(stamp)       → ouvre la fenêtre sur une partie (la plus récente sinon)
 *   memory.awards(el, list)  → affiche des trophées (sert aussi sur le podium)
 *
 * On garde les 3 dernières parties, plus celles épinglées ⭐ qui ne sont jamais
 * effacées. Le tri ne se fait qu'à l'enregistrement d'une nouvelle partie.
 * Nécessite analysis.js (window.QuizAnalysis) et css/memory.css.
 */
window.QuizMemory = function (opts) {
  "use strict";
  const quizId = opts.quizId;
  const A = window.QuizAnalysis;
  const { nf, sec, pct, ord } = A.fmt;
  const KEY = "quiz_history"; // même clé que l'ancien historique : rien n'est perdu
  const KEEP = 3;             // parties non épinglées gardées
  const MAX_PINNED = 10;      // garde-fou pour la place disponible dans le navigateur
  const SVG_NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const modal = $("memory-modal");
  let current = null;         // partie affichée (stamp) ou "pantheon"
  let redraws = [];           // graphiques à redessiner quand la largeur change

  /* ---------- Stockage ---------- */
  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return (Array.isArray(list) ? list : []).filter((g) => g && g.full && g.stamp)
        .sort((a, b) => b.stamp - a.stamp);
    } catch (e) { return []; }
  }
  function persist(list) {
    // Place insuffisante : on sacrifie la plus ancienne partie non épinglée
    const l = list.slice();
    for (;;) {
      try { localStorage.setItem(KEY, JSON.stringify(l)); return l; } catch (e) {
        const i = l.map((g) => !g.pinned).lastIndexOf(true);
        if (i <= 0) return l;
        l.splice(i, 1);
      }
    }
  }
  // Toutes les épinglées + les 3 parties non épinglées les plus récentes
  function trim(list) {
    const loose = list.filter((g) => !g.pinned).slice(0, KEEP);
    return list.filter((g) => g.pinned || loose.indexOf(g) >= 0);
  }
  const same = (a, b) => a.stamp === b.stamp && a.quizId === b.quizId;

  // Enregistre la partie terminée (appelé au podium). Renvoie l'entrée, ou null.
  function record() {
    return fetch("/api/results?quiz=" + encodeURIComponent(quizId))
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // partie à blanc (aucune réponse) : rien à analyser, on ne la garde pas
        if (!res || !res.ranking || !(res.stats && res.stats.totalAnswers > 0)) return null;
        const g = { stamp: new Date(res.date || Date.now()).getTime(), quizId: res.quizId, names: res.names,
                    nbPlayers: res.nbPlayers, nbQuestions: res.nbQuestions, top: res.ranking.slice(0, 3),
                    full: res, pinned: false };
        const list = load();
        const known = list.find((x) => same(x, g));
        if (known) return known; // podium réaffiché : déjà en mémoire
        persist(trim([g].concat(list)));
        return g;
      })
      .catch(() => null);
  }

  /* ---------- Petits outils ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function add(parent) {
    for (let i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function svg(tag, attrs, text) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  const quizName = (g) => (g.names || []).join(" ♥ ") || "Quiz";
  const short = (s, n) => (s = String(s || ""), s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const plural = (n, word) => n + " " + word + (n > 1 ? "s" : "");
  function when(stamp, long) {
    const d = new Date(stamp);
    return d.toLocaleDateString("fr-FR", long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
                                              : { weekday: "short", day: "numeric", month: "short" }) +
      " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const ctx = document.createElement("canvas").getContext("2d");
  function textW(s, size, weight) {
    ctx.font = (weight || 400) + " " + size + "px Inter, sans-serif";
    return ctx.measureText(s).width;
  }

  /* ---------- Blocs d'affichage ---------- */
  function card(title, sub) {
    return add(el("section", "viz-card"), el("h3", null, title), sub ? el("div", "viz-sub", sub) : null);
  }
  function kpis(items) {
    const row = el("div", "kpi-row");
    items.forEach(([v, l]) => row.appendChild(add(el("div", "kpi"), el("div", "v", v), el("div", "l", l))));
    return row;
  }
  // Trophées : [{ emoji, title, name, detail }]
  function awards(box, list) {
    box.textContent = "";
    box.classList.add("award-grid");
    list.forEach((x) => box.appendChild(add(el("div", "award"), el("div", "e", x.emoji),
      add(el("div"), el("div", "ti", x.title), el("div", "n", x.name), el("div", "d", x.detail)))));
    return box;
  }
  // Faits sur les questions : [{ emoji, title, q, detail }]
  function facts(list) {
    const grid = el("div", "award-grid");
    list.forEach((f) => grid.appendChild(add(el("div", "award"), el("div", "e", f.emoji),
      add(el("div"), el("div", "ti", f.title), el("div", "n", "Question " + f.q.n), el("div", "d", f.detail),
        el("div", "q", short(f.q.text, 90))))));
    return grid;
  }
  function withDot(color, text) {
    const s = el("span");
    const d = el("span", "team-dot");
    d.style.background = color || "#888";
    return add(s, d, document.createTextNode(text));
  }
  // cols : [{ t: "Titre", num: true }] ; rows : cellules (texte ou nœud) ; strong : colonne mise en avant
  function table(cols, rows, strong) {
    const t = el("table", "viz-table");
    const head = el("tr");
    cols.forEach((c) => { const th = el("th", c.num ? "num" : null, c.t); th.scope = "col"; head.appendChild(th); });
    add(t, add(el("thead"), head));
    const body = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      r.forEach((v, i) => {
        const td = el("td", ((cols[i].num ? "num " : "") + (i === strong ? "strong" : "")).trim() || null);
        if (v instanceof Node) td.appendChild(v); else td.textContent = v == null || v === "" ? "—" : String(v);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return add(el("div", "viz-table-wrap"), add(t, body));
  }
  function legend(names) {
    const lg = el("div", "viz-legend");
    names.forEach((n, i) => {
      const key = el("span", "viz-key");
      key.style.background = "var(--series-" + (i + 1) + ")";
      lg.appendChild(add(el("span"), key, document.createTextNode(n)));
    });
    return lg;
  }
  // Graphique + son tableau jumeau (bouton pour basculer de l'un à l'autre)
  function chartWithTable(c, box, tbl) {
    const btn = el("button", "viz-toggle", "📋 Voir en tableau");
    btn.type = "button";
    btn.setAttribute("aria-pressed", "false");
    tbl.classList.add("hidden");
    btn.addEventListener("click", () => {
      const asTable = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(asTable));
      btn.textContent = asTable ? "📈 Voir le graphique" : "📋 Voir en tableau";
      box.classList.toggle("hidden", asTable);
      tbl.classList.toggle("hidden", !asTable);
      if (!asTable) redrawAll();
    });
    add(c, box, tbl, btn);
  }
  function chart(box, draw) {
    redraws.push(() => { if (box.isConnected && box.clientWidth > 0) draw(box); });
  }
  function redrawAll() { redraws.forEach((f) => f()); }

  /* ---------- Fenêtre ---------- */
  function open(stamp) {
    current = stamp != null ? stamp : null;
    modal.classList.remove("hidden");
    render();
    $("mem-close").focus();
  }
  function close() {
    modal.classList.add("hidden");
    redraws = [];
  }
  function render() {
    const list = load();
    redraws = [];
    if (!(current === "pantheon" && list.length >= 2) && !list.some((g) => g.stamp === current)) {
      current = list[0] ? list[0].stamp : null;
    }
    hint(list);
    tabs(list);
    const view = $("mem-view");
    view.textContent = "";
    modal.scrollTop = 0;
    if (!list.length) {
      view.appendChild(el("div", "mem-empty",
        "Aucune partie en mémoire pour l'instant. Chaque partie terminée s'enregistre ici toute seule, avec son analyse."));
      return;
    }
    if (current === "pantheon") pantheonView(view, list);
    else gameView(view, list.find((g) => g.stamp === current));
    redrawAll();
  }
  function hint(list) {
    const extra = list.filter((g) => !g.pinned).length - KEEP;
    $("mem-hint").textContent = extra > 0
      ? "⚠️ " + plural(extra, "partie") + " de plus que les 3 dernières : à la prochaine partie, les plus anciennes " +
        "non épinglées seront effacées. Épingle ⭐ celles à garder."
      : "Les 3 dernières parties sont gardées sur cet ordinateur. Épingle ⭐ une partie pour la garder pour toujours.";
  }
  function tabs(list) {
    const box = $("mem-tabs");
    box.textContent = "";
    const items = list.map((g) => ({
      id: g.stamp,
      t1: (g.pinned ? "⭐ " : "") + quizName(g),
      t2: when(g.stamp),
      t3: plural(g.nbPlayers || 0, "joueur") + (g.top && g.top[0] ? " · 🥇 " + g.top[0].name : ""),
    }));
    if (list.length >= 2) items.push({ id: "pantheon", t1: "🏛️ Panthéon", t2: "Records et habitués", t3: plural(list.length, "partie") });
    items.forEach((it, i) => {
      const b = add(el("button", "mem-tab"), el("span", "t1", it.t1), el("span", "t2", it.t2), el("span", "t3", it.t3));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(it.id === current));
      b.tabIndex = it.id === current ? 0 : -1;
      b.addEventListener("click", () => select(it.id));
      b.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select(items[(i + d + items.length) % items.length].id);
      });
      box.appendChild(b);
    });
  }
  function select(id) {
    current = id;
    render();
    const t = document.querySelector('#mem-tabs [aria-selected="true"]');
    if (t) t.focus();
  }

  /* ---------- Une partie ---------- */
  function gameView(view, g) {
    const r = g.full, a = A.analyze(r);
    const teams = Array.isArray(r.teams) ? r.teams : [];

    // Titre, date et actions
    const acts = el("div", "mem-actions");
    const pdf = el("button", "btn", "📄 PDF");
    pdf.addEventListener("click", () => download(g));
    const pin = el("button", "btn secondary", g.pinned ? "⭐ Épinglée" : "☆ Épingler");
    pin.setAttribute("aria-pressed", String(!!g.pinned));
    pin.title = g.pinned ? "Retirer l'étoile (la partie pourra alors être effacée)" : "Garder cette partie pour toujours";
    pin.addEventListener("click", () => togglePin(g));
    const del = el("button", "btn secondary", "🗑");
    del.title = "Effacer cette partie";
    del.setAttribute("aria-label", "Effacer cette partie");
    del.addEventListener("click", () => remove(g));
    view.appendChild(add(el("div", "mem-title"),
      add(el("div", "mem-name"), el("h2", "display", quizName(g)),
        el("div", "mem-hint", when(g.stamp, true) + (a.kpis.durationMin ? " · " + a.kpis.durationMin + " min de jeu" : ""))),
      add(acts, pdf, pin, del)));

    const k = a.kpis;
    view.appendChild(kpis([
      [nf(k.players), "joueurs"], [nf(k.questions), "questions"], [k.globalRate + " %", "de bonnes réponses"],
      [nf(k.avgScore), "points en moyenne"], [nf(k.bestScore), "meilleur score"], [nf(k.answers), "réponses données"],
    ]));

    if (a.awards.length) {
      const c = card("🏅 Trophées", "Décernés automatiquement d'après les réponses de chacun");
      c.appendChild(awards(el("div"), a.awards));
      if (!a.hasTimeline) c.appendChild(el("div", "mem-hint",
        "Partie enregistrée avant la nouvelle mémoire : analyse partielle (pas de course, de séries ni de temps de réponse)."));
      view.appendChild(c);
    }

    if (a.race) {
      const S = a.race.series;
      const c = card("🏁 La course au podium", S.length < a.race.players
        ? "Place au classement des " + S.length + " premiers à l'arrivée, après chaque question"
        : "Place de chacun au classement, après chaque question");
      c.appendChild(legend(S.map((s) => s.name)));
      const box = el("div", "viz-box");
      chartWithTable(c, box, table([{ t: "Après" }].concat(S.map((s) => ({ t: s.name, num: true }))),
        a.race.labels.map((l, i) => ["Question " + (i + 1)].concat(S.map((s) => ord(s.ranks[i]) + " · " + nf(s.scores[i]) + " pts")))));
      if (a.story.length) {
        const st = add(el("div", "mem-story"), el("div", "ti", "🎬 Le film de la partie"));
        a.story.forEach((s) => st.appendChild(add(el("div", "line"), el("span", "e", s.emoji), el("span", null, s.text))));
        c.appendChild(st);
      }
      view.appendChild(c);
      chart(box, (b) => rankChart(b, a.race));
    }

    if (a.perQuestion.length) {
      const c = card("❓ Les questions", "Pourcentage de bonnes réponses, question par question");
      if (a.questionFacts.length) c.appendChild(facts(a.questionFacts));
      const box = el("div", "viz-box");
      chartWithTable(c, box, table(
        [{ t: "Q", num: true }, { t: "Question" }, { t: "Bonne réponse" }, { t: "Réussite", num: true },
         { t: "Temps moyen", num: true }, { t: "Le piège" }],
        a.perQuestion.map((q) => [q.n, q.text, q.correctLabel,
          q.answered ? q.rate + " % (" + q.good + "/" + q.answered + ")" : "aucune réponse",
          q.avgTime != null ? sec(q.avgTime) + " s" : null,
          q.trap ? "« " + q.trap.label + " » · " + q.trap.pct + " %" : null])));
      view.appendChild(c);
      chart(box, (b) => columnChart(b, a.perQuestion));
    }

    if (teams.length) {
      const c = card("👥 Les équipes", "Classées à la moyenne de points par joueur");
      c.appendChild(table([{ t: "#", num: true }, { t: "Équipe" }, { t: "Joueurs", num: true }, { t: "Moyenne", num: true }, { t: "Total", num: true }],
        teams.map((t, i) => [i + 1, withDot(t.color, t.name), t.members, nf(t.avg), nf(t.total)]), 3));
      view.appendChild(c);
    }

    const c = card("📋 Tous les joueurs", "Classement final et statistiques de chacun");
    if (a.players.length) {
      const cols = [{ t: "#", num: true }, { t: "Joueur" }];
      if (teams.length) cols.push({ t: "Équipe" });
      cols.push({ t: "Score", num: true }, { t: "Bonnes réponses", num: true }, { t: "Précision", num: true },
                { t: "Temps moyen", num: true }, { t: "Meilleure série", num: true });
      c.appendChild(table(cols, a.players.map((p) => {
        const row = [p.finalRank, p.name];
        if (teams.length) row.push(p.team ? withDot(p.team.color, p.team.name) : null);
        return row.concat([nf(p.score), p.good + "/" + p.answered, p.answered ? pct(p.accuracy) + " %" : null,
          p.avgTime != null ? sec(p.avgTime) + " s" : null, p.bestStreak]);
      }), teams.length ? 3 : 2));
    } else {
      c.appendChild(table([{ t: "#", num: true }, { t: "Joueur" }, { t: "Score", num: true }],
        (r.ranking || []).map((p, i) => [i + 1, p.name, nf(p.score)]), 2));
    }
    view.appendChild(c);
  }

  /* ---------- Panthéon : toutes les parties gardées ---------- */
  function pantheonView(view, list) {
    const P = A.pantheon(list.map((g) => g.full));
    view.appendChild(add(el("div", "mem-title"), add(el("div", "mem-name"), el("h2", "display", "🏛️ Panthéon"),
      el("div", "mem-hint", "Records et habitués des " + P.games + " parties en mémoire"))));
    view.appendChild(kpis([[nf(P.games), "parties"], [nf(P.players), "joueurs différents"],
      [nf(P.questions), "questions posées"], [nf(P.answers), "réponses données"]]));

    const R = P.records, rec = [];
    const day = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    if (R.score) rec.push({ emoji: "🏆", title: "Record de points", name: R.score.name,
      detail: nf(R.score.score) + " points · " + R.score.quiz + ", " + day(R.score.date) });
    if (R.accuracy) rec.push({ emoji: "🎯", title: "Meilleure précision", name: R.accuracy.name,
      detail: pct(R.accuracy.accuracy) + " % (" + R.accuracy.good + "/" + R.accuracy.answered + ") · " + R.accuracy.quiz });
    if (R.king) rec.push({ emoji: "👑", title: "Le plus de victoires", name: R.king.name,
      detail: R.king.wins + " victoires sur " + plural(R.king.games, "partie") });
    const loyal = P.regulars.slice().sort((x, y) => y.games - x.games || y.wins - x.wins)[0];
    if (loyal) rec.push({ emoji: "🎟️", title: "Toujours là", name: loyal.name,
      detail: loyal.games === P.games ? "a joué les " + P.games + " parties" : loyal.games + " parties jouées" });
    if (rec.length) view.appendChild(add(card("🥇 Les records"), awards(el("div"), rec)));

    view.appendChild(add(card("🗂️ Les parties en mémoire"), table(
      [{ t: "Partie" }, { t: "Date" }, { t: "Joueurs", num: true }, { t: "Réussite", num: true }, { t: "Vainqueur" }],
      list.map((g) => [(g.pinned ? "⭐ " : "") + quizName(g), when(g.stamp), g.nbPlayers,
        ((g.full.stats && g.full.stats.globalRate) || 0) + " %",
        g.top && g.top[0] ? g.top[0].name + " (" + nf(g.top[0].score) + " pts)" : null]))));

    const c = card("🔁 Les habitués", "Joueurs présents sur au moins 2 parties (reconnus à leur prénom)");
    if (P.regulars.length) {
      c.appendChild(table([{ t: "Joueur" }, { t: "Parties", num: true }, { t: "Victoires", num: true }, { t: "Podiums", num: true },
        { t: "Record", num: true }, { t: "Précision", num: true }],
        P.regulars.map((e) => [e.name, e.games, e.wins, e.podiums, nf(e.best), pct(e.accuracy) + " %"]), 0));
    } else {
      c.appendChild(el("div", "mem-hint", "Personne n'a encore joué 2 parties : ça viendra !"));
    }
    view.appendChild(c);
  }

  /* ---------- Actions ---------- */
  function togglePin(g) {
    const list = load();
    const e = list.find((x) => same(x, g));
    if (!e) return;
    if (!e.pinned && list.filter((x) => x.pinned).length >= MAX_PINNED) {
      alert(MAX_PINNED + " parties épinglées au maximum : retire l'étoile d'une autre partie d'abord.");
      return;
    }
    e.pinned = !e.pinned;
    persist(list);
    render();
  }
  function remove(g) {
    if (!confirm("Effacer définitivement cette partie de la mémoire ?")) return;
    persist(load().filter((x) => !same(x, g)));
    current = null;
    render();
  }
  // Refabrique le PDF à partir du récap gardé en mémoire
  function download(g) {
    fetch("/api/results.pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g.full) })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resultats-quiz-" + (g.quizId || "quiz") + "-" + new Date(g.stamp).toISOString().slice(0, 10) + ".pdf";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      })
      .catch(() => alert("Impossible de générer le PDF."));
  }

  /* ---------- Graphiques ---------- */
  // Graduations « rondes » de 0 jusqu'à au moins max (4 intervalles environ)
  function niceTicks(max) {
    max = Math.max(max, 100);
    const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const out = [];
    for (let v = 0; v < max + step - 1e-9; v += step) out.push(Math.round(v));
    return out;
  }
  // Étiquettes de l'axe horizontal : on en saute si la place manque, la dernière reste visible
  function xLabels(root, labels, X, y, gap) {
    const widest = Math.max.apply(null, labels.map((l) => textW(l, 11))) + 10;
    const step = Math.max(1, Math.ceil(widest / gap));
    const last = labels.length - 1, shown = [];
    for (let i = 0; i <= last; i += step) shown.push(i);
    if (shown[shown.length - 1] !== last) {
      if (shown.length > 1) shown.pop(); // trop près de la dernière : on lui laisse la place
      shown.push(last);
    }
    shown.forEach((i) => root.appendChild(svg("text", { class: "viz-tick", x: X(i), y, "text-anchor": "middle" }, labels[i])));
  }
  // Point marqué d'un anneau couleur du fond (il reste lisible quand les courbes se croisent)
  const dot = (x, y, k) => svg("circle", { cx: x, cy: y, r: 4, "stroke-width": 2,
    style: "fill: var(--series-" + (k + 1) + "); stroke: var(--surface-1)" });
  // Info-bulle placée à droite du repère, ou à gauche si elle déborde
  function placeTip(tip, box, x, gap, top) {
    tip.style.display = "block";
    const w = tip.offsetWidth;
    let left = x + gap;
    if (left + w > box.clientWidth) left = x - gap - w;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top = top + "px";
  }
  // Navigation au clavier commune aux deux graphiques
  function keyNav(root, n, get, show, hide) {
    root.addEventListener("keydown", (e) => {
      const i = get();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const d = e.key === "ArrowRight" ? 1 : -1;
        show(i == null ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, i + d)));
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        show(e.key === "Home" ? 0 : n - 1);
      } else if (e.key === "Escape" && i != null) {
        e.stopPropagation(); // ferme l'info-bulle, pas la fenêtre
        hide();
      }
    });
    root.addEventListener("blur", hide);
  }

  // Course au podium : place au classement après chaque question (la 1re place en haut)
  function rankChart(box, race) {
    const n = race.labels.length, S = race.series;
    const R = Math.max(2, S.length, Math.max.apply(null, S.map((s) => Math.max.apply(null, s.ranks))));
    const W = Math.max(320, Math.floor(box.clientWidth));
    const H = Math.round(Math.min(360, Math.max(240, W * 0.4)));
    // graduations : toutes les places jusqu'à 10, sinon 1re puis toutes les 5 ou 10 places
    const step = R <= 10 ? 1 : R <= 20 ? 2 : R <= 50 ? 5 : 10;
    const ticks = [];
    if (step <= 2) for (let r = 1; r <= R; r += step) ticks.push(r);
    else { ticks.push(1); for (let r = step; r <= R; r += step) ticks.push(r); }
    const tickW = Math.max.apply(null, ticks.map((t) => textW(ord(t), 11)));
    const nameW = Math.max.apply(null, S.map((s) => textW(s.name, 12, 600)));
    const m = { l: Math.ceil(tickW) + 12, r: Math.min(140, Math.ceil(nameW) + 18), t: 12, b: 30 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (i) => m.l + (i * pw) / (n - 1);
    const Y = (r) => m.t + ((r - 1) / (R - 1)) * ph;
    const last = (s) => s.ranks[n - 1];

    box.textContent = "";
    const root = svg("svg", { class: "viz-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, tabindex: 0, role: "img",
      "aria-label": "Course au podium, place au classement après chaque question. À l'arrivée : " +
        S.map((s) => s.name + " " + ord(last(s))).join(", ") + ". Flèches gauche et droite pour parcourir les questions." });
    ticks.forEach((t) => {
      root.appendChild(svg("line", { class: "viz-grid", x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t) }));
      root.appendChild(svg("text", { class: "viz-tick", x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, ord(t)));
    });
    xLabels(root, race.labels, X, m.t + ph + 20, pw / (n - 1));
    const cross = svg("line", { class: "viz-cross", y1: m.t, y2: m.t + ph, visibility: "hidden" });
    root.appendChild(cross);

    // le vainqueur est tracé en dernier : sa courbe passe devant les autres
    S.map((s, k) => ({ s, k })).reverse().forEach(({ s, k }) => root.appendChild(svg("path", {
      d: s.ranks.map((r, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(r).toFixed(1)).join(""),
      fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
      style: "stroke: var(--series-" + (k + 1) + ")" })));
    // Arrivée : point + prénom (un prénom qui en chevaucherait un autre est omis, la légende reste là)
    const placed = [];
    S.map((s, k) => ({ s, k })).reverse().forEach(({ s, k }) => root.appendChild(dot(X(n - 1), Y(last(s)), k)));
    S.forEach((s) => {
      const y = Y(last(s));
      if (textW(s.name, 12, 600) > m.r - 14 || placed.some((py) => Math.abs(py - y) < 15)) return;
      placed.push(y);
      root.appendChild(svg("text", { class: "viz-label", x: X(n - 1) + 10, y: y + 4 }, s.name));
    });

    // Survol : ligne verticale + place et points de chacun à cette question
    const marks = S.map((s, k) => { const c = dot(0, 0, k); c.setAttribute("visibility", "hidden"); return c; });
    marks.slice().reverse().forEach((c) => root.appendChild(c));
    const hit = svg("rect", { x: m.l - 12, y: 0, width: pw + 24, height: m.t + ph + 4, fill: "transparent" });
    root.appendChild(hit);
    const tip = el("div", "viz-tip");
    let idx = null;
    function show(i) {
      idx = i;
      const x = X(i);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      S.forEach((s, k) => {
        marks[k].setAttribute("cx", x); marks[k].setAttribute("cy", Y(s.ranks[i])); marks[k].setAttribute("visibility", "visible");
      });
      tip.textContent = "";
      tip.appendChild(el("div", "viz-tip-head", "Après la question " + (i + 1)));
      S.map((s, k) => ({ s, k })).sort((p, q) => p.s.ranks[i] - q.s.ranks[i] || p.k - q.k).forEach(({ s, k }) => {
        const key = el("span", "viz-key");
        key.style.background = "var(--series-" + (k + 1) + ")";
        tip.appendChild(add(el("div", "viz-tip-row"), key, el("strong", null, ord(s.ranks[i])), el("span", null, s.name),
          el("span", "viz-tip-more", nf(s.scores[i]) + " pts")));
      });
      placeTip(tip, box, x * (box.clientWidth / W), 14, m.t);
    }
    function hide() {
      idx = null;
      cross.setAttribute("visibility", "hidden");
      marks.forEach((c) => c.setAttribute("visibility", "hidden"));
      tip.style.display = "none";
    }
    const pick = (e) => {
      const rect = root.getBoundingClientRect();
      const px = ((e.clientX - rect.left) * W) / rect.width;
      show(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) * (n - 1)) / pw))));
    };
    hit.addEventListener("pointermove", pick);
    hit.addEventListener("pointerdown", pick);
    hit.addEventListener("pointerleave", hide);
    keyNav(root, n, () => idx, show, hide);
    add(box, root, tip);
  }

  // Colonne aux coins du haut arrondis (4 px), base carrée posée sur l'axe
  function colPath(x, base, w, h, r) {
    if (!(h > 0)) return "";
    r = Math.min(r, h, w / 2);
    const t = base - h;
    return "M" + x + " " + base + "V" + (t + r) + "A" + r + " " + r + " 0 0 1 " + (x + r) + " " + t +
      "H" + (x + w - r) + "A" + r + " " + r + " 0 0 1 " + (x + w) + " " + (t + r) + "V" + base + "Z";
  }

  // Réussite par question : une colonne par question (0 – 100 %)
  function columnChart(box, qs) {
    const n = qs.length;
    const W = Math.max(320, Math.floor(box.clientWidth));
    const H = Math.round(Math.min(300, Math.max(210, W * 0.32)));
    const m = { l: Math.ceil(textW("100 %", 11)) + 12, r: 8, t: 22, b: 30 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
    const band = pw / n;
    const bw = Math.max(3, Math.min(24, band * 0.6, band - 2));
    const cx = (i) => m.l + band * (i + 0.5);
    const Y = (v) => base - (v / 100) * ph;
    const hard = qs.filter((q) => q.answered).sort((p, q) => p.rate - q.rate)[0];

    box.textContent = "";
    const root = svg("svg", { class: "viz-svg", width: W, height: H, viewBox: "0 0 " + W + " " + H, tabindex: 0, role: "img",
      "aria-label": "Réussite par question, de 0 à 100 %" + (hard ? ". La plus difficile : question " + hard.n + " (" + hard.rate + " %)" : "") +
        ". Flèches gauche et droite pour parcourir les questions." });
    [0, 25, 50, 75, 100].forEach((t) => {
      root.appendChild(svg("line", { class: t === 0 ? "viz-axis" : "viz-grid", x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t) }));
      root.appendChild(svg("text", { class: "viz-tick", x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, t + " %"));
    });
    xLabels(root, qs.map((q) => "Q" + q.n), cx, base + 20, band);
    const fill = (on) => "fill: var(" + (on ? "--series-1-hover" : "--series-1") + ")";
    const bars = qs.map((q, i) => {
      const b = svg("path", { d: colPath(cx(i) - bw / 2, base, bw, q.answered ? (q.rate / 100) * ph : 0, 4), style: fill(false) });
      root.appendChild(b);
      return b;
    });
    // Étiquettes de valeur : seulement la question la mieux réussie et la plus ratée
    const answered = qs.map((q, i) => ({ q, i })).filter((d) => d.q.answered);
    if (answered.length) {
      const hi = answered.reduce((p, d) => (d.q.rate > p.q.rate ? d : p));
      const lo = answered.reduce((p, d) => (d.q.rate < p.q.rate ? d : p));
      const placed = [];
      (lo.i === hi.i ? [hi] : [hi, lo]).forEach((d) => {
        const txt = d.q.rate + " %", w = textW(txt, 12, 600);
        const x = Math.max(m.l + w / 2, Math.min(W - m.r - w / 2, cx(d.i))), y = Y(d.q.rate) - 6;
        if (placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < 14)) return;
        placed.push({ x, y, w });
        root.appendChild(svg("text", { class: "viz-label", x, y, "text-anchor": "middle" }, txt));
      });
    }

    // Survol : une zone par question, plus large que la colonne
    const tip = el("div", "viz-tip");
    let idx = null;
    function show(i) {
      if (idx != null) bars[idx].setAttribute("style", fill(false));
      idx = i;
      bars[i].setAttribute("style", fill(true));
      const q = qs[i];
      tip.textContent = "";
      add(tip, el("div", "viz-tip-head", "Question " + q.n), el("div", "viz-tip-text", short(q.text, 90)));
      const row = (strong, rest) => tip.appendChild(add(el("div", "viz-tip-row"), strong != null ? el("strong", null, strong) : null, el("span", null, rest)));
      if (q.answered) row(q.rate + " %", "de bonnes réponses (" + q.good + "/" + q.answered + ")");
      else row(null, "Aucune réponse");
      if (q.correctLabel) row(null, "Réponse : " + q.correctLabel);
      if (q.avgTime != null) row(sec(q.avgTime) + " s", "de réflexion en moyenne");
      if (q.trap && q.trap.pct >= 10) row(q.trap.pct + " %", "ont choisi « " + q.trap.label + " »");
      placeTip(tip, box, cx(i) * (box.clientWidth / W), bw / 2 + 10, m.t);
    }
    function hide() {
      if (idx != null) bars[idx].setAttribute("style", fill(false));
      idx = null;
      tip.style.display = "none";
    }
    qs.forEach((q, i) => {
      const zone = svg("rect", { x: m.l + band * i, y: m.t, width: band, height: ph + m.b, fill: "transparent" });
      zone.addEventListener("pointerenter", () => show(i));
      zone.addEventListener("pointerdown", () => show(i));
      root.appendChild(zone);
    });
    root.addEventListener("pointerleave", hide);
    keyNav(root, n, () => idx, show, hide);
    add(box, root, tip);
  }

  /* ---------- Branchements ---------- */
  $("mem-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (modal.classList.contains("hidden")) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawAll, 150);
  });

  return { record, open, awards };
};

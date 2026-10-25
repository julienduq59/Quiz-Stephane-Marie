/**
 * Analyse d'une partie de quiz : trophées, questions, course des scores, panthéon.
 *
 * Partagé entre le navigateur (mémoire des quiz) et le serveur (PDF) :
 *   - navigateur : window.QuizAnalysis
 *   - Node       : require("./public/js/analysis.js")
 *
 * Fonctionne sur le récapitulatif d'une partie (results.js). Les parties
 * enregistrées avant l'ajout de la chronologie (r.timeline absent) donnent une
 * analyse partielle : pas de course, de séries ni de remontada.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QuizAnalysis = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Formats français ---------- */
  const nf = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
  const sec = (ms) => (Math.round(ms / 100) / 10).toLocaleString("fr-FR");
  const pct = (x) => Math.round(x * 100);
  const ord = (n) => (n === 1 ? "1re" : n + "e");
  const ordM = (n) => (n === 1 ? "1er" : n + "e");
  const key = (name) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

  // Chronologie nettoyée : le récap peut revenir du navigateur (PDF), on ne lui fait pas confiance
  function cleanTimeline(t) {
    if (!t || !Array.isArray(t.questions) || !Array.isArray(t.players)) return null;
    const P = t.players.length;
    return {
      players: t.players.map(String),
      teams: Array.isArray(t.teams) ? t.teams : [],
      questions: t.questions.map((qa) => (Array.isArray(qa) ? qa : [])
        .filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < P)
        .map((x) => [x[0], x[1], x[2] ? 1 : 0, Math.max(0, Number(x[3]) || 0), Number(x[4]) || 0])),
    };
  }

  /* ---------- Analyse d'une partie ---------- */
  function analyze(r) {
    r = r && typeof r === "object" ? r : {};
    const questions = (Array.isArray(r.questions) ? r.questions : []).filter((q) => q && typeof q === "object");
    const nbQ = questions.length;
    const tl = cleanTimeline(r.timeline);
    const stats = r.stats || {};
    const teams = Array.isArray(r.teams) ? r.teams.filter((t) => t && typeof t === "object") : [];
    const teamsById = {};
    teams.forEach((t) => { if (t.id) teamsById[t.id] = t; });

    const out = {
      hasTimeline: !!(tl && tl.questions.length),
      kpis: {
        players: r.nbPlayers || (r.ranking || []).length,
        questions: nbQ,
        globalRate: stats.globalRate || 0,
        avgScore: stats.avgScore || 0,
        bestScore: stats.bestScore || 0,
        answers: stats.totalAnswers || 0,
        durationMin: r.durationMin || null,
      },
      players: [],
      perQuestion: [],
      race: null,
      story: [],
      awards: [],
      questionFacts: [],
    };

    /* --- Par joueur --- */
    if (out.hasTimeline) {
      const P = tl.players.length;
      const ps = tl.players.map((name, i) => {
        const team = teamsById[(tl.teams || [])[i]];
        return { name, team: team ? { name: team.name, color: team.color } : null,
                 answered: 0, good: 0, time: 0, timeGood: 0, fastWrong: 0,
                 streak: 0, bestStreak: 0, score: 0, cumul: [], ranks: [] };
      });
      tl.questions.forEach((answers) => {
        const answeredThis = new Set();
        answers.forEach(([i, , ok, ms, pts]) => {
          const p = ps[i];
          if (answeredThis.has(i)) return;
          answeredThis.add(i);
          p.answered += 1; p.time += ms; p.score += pts;
          if (ok) { p.good += 1; p.timeGood += ms; p.streak += 1; p.bestStreak = Math.max(p.bestStreak, p.streak); }
          else { p.streak = 0; if (ms < 3000) p.fastWrong += 1; }
        });
        // pas de réponse = la série s'arrête
        ps.forEach((p, i) => { if (!answeredThis.has(i)) p.streak = 0; p.cumul.push(p.score); });
        // classement après cette question (égalité = même rang)
        ps.forEach((p) => { p.ranks.push(1 + ps.filter((o) => o.score > p.score).length); });
      });
      ps.forEach((p) => {
        p.accuracy = p.answered ? p.good / p.answered : 0;
        p.avgTime = p.answered ? p.time / p.answered : null;
        p.avgTimeGood = p.good ? p.timeGood / p.good : null;
        p.finalRank = p.ranks.length ? p.ranks[p.ranks.length - 1] : P;
      });
      out.players = ps.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    } else {
      // Ancienne partie : on se contente des totaux par joueur
      out.players = (Array.isArray(r.playerStats) ? r.playerStats : []).filter((s) => s && typeof s === "object").map((s) => ({
        name: s.name, team: null, answered: s.answered || 0, good: s.good || 0,
        accuracy: s.answered ? s.good / s.answered : 0,
        avgTime: null, avgTimeGood: s.good ? s.timeGood / s.good : null,
        bestStreak: null, fastWrong: null, score: s.score || 0, cumul: [], ranks: [],
      })).sort((a, b) => b.score - a.score);
      out.players.forEach((p, i) => (p.finalRank = i + 1));
    }

    /* --- Par question --- */
    out.perQuestion = questions.map((q, i) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const correct = Number.isInteger(q.correct) ? q.correct : opts.indexOf(q.correctLabel);
      const dist = Array.isArray(q.distribution) ? q.distribution : [];
      let trap = null;
      dist.forEach((c, j) => {
        if (j === correct || !(c > 0)) return;
        if (!trap || c > trap.count) trap = { label: opts[j], count: c };
      });
      if (trap && q.answered) trap.pct = pct(trap.count / q.answered);
      let avgTime = null;
      if (out.hasTimeline && tl.questions[i] && tl.questions[i].length) {
        avgTime = tl.questions[i].reduce((a, x) => a + x[3], 0) / tl.questions[i].length;
      }
      return { n: q.n || i + 1, text: q.text, correctLabel: q.correctLabel, rate: q.rate || 0,
               good: q.good || 0, answered: q.answered || 0, trap, avgTime,
               fastest: q.fastest || null };
    });

    /* --- La course : place au classement des 4 premiers, après chaque question --- */
    if (out.hasTimeline && nbQ > 1 && out.players.length >= 2) {
      out.race = {
        labels: tl.questions.map((q, i) => "Q" + (i + 1)),
        players: out.players.length,
        series: out.players.slice(0, 4).map((p) => ({ name: p.name, ranks: p.ranks.slice(), scores: p.cumul.slice() })),
      };
    }

    /* --- Le film de la partie : prises de tête, moment clé, duel final --- */
    if (out.hasTimeline && nbQ > 1 && out.players.length >= 2) {
      const P = out.players, winner = P[0];
      const tell = (emoji, text) => out.story.push({ emoji, text });
      // meneur après chaque question ; à égalité, le meneur en place garde la tête
      const reigns = [];
      let leader = null;
      tl.questions.forEach((_, q) => {
        const top = Math.max.apply(null, P.map((p) => p.cumul[q]));
        if (!(top > 0)) return;
        const tied = P.filter((p) => p.cumul[q] === top);
        if (tied.indexOf(leader) < 0) { leader = tied[0]; reigns.push({ p: leader, q: q + 1 }); }
      });
      if (reigns.length === 1 && reigns[0].p === winner) {
        tell("🏁", winner.name + " a pris la tête " + (reigns[0].q === 1 ? "dès la première question" : "à la question " + reigns[0].q) +
          " et ne l'a plus jamais lâchée.");
      } else if (reigns.length > 1) {
        const n = reigns.length - 1;
        let steps = reigns.map((x) => x.p.name + " (Q" + x.q + ")");
        if (steps.length > 6) steps = ["…"].concat(steps.slice(-5));
        tell("🎢", "La tête a changé " + (n === 1 ? "une fois" : n + " fois") + " : " +
          steps.slice(0, -1).join(", ") + " puis " + steps[steps.length - 1] + ".");
        const last = reigns[reigns.length - 1];
        if (last.p === winner) tell("🔑", "Moment clé : à la question " + last.q + ", " + winner.name + " passe en tête pour ne plus la lâcher.");
      }

      // plus gros bond au classement sur une seule question
      if (P.length >= 4) {
        let leap = null;
        P.forEach((p) => {
          for (let q = 1; q < p.ranks.length; q++) {
            const gain = p.ranks[q - 1] - p.ranks[q];
            if (gain >= 3 && (!leap || gain > leap.gain)) leap = { p, q: q + 1, gain };
          }
        });
        if (leap) tell("📈", "Plus belle remontée en une question : " + leap.p.name + " gagne " + leap.gain + " places à la question " + leap.q + ".");
      }

      // écart final entre le 1er et le 2e, et entre le 2e et le 3e
      const pairs = [0, 1].filter((i) => P[i + 1] && P[i + 1].score > 0)
        .map((i) => ({ i, a: P[i], b: P[i + 1], gap: P[i].score - P[i + 1].score }));
      const close = pairs.filter((d) => d.gap <= Math.max(150, winner.score * 0.05)).sort((x, y) => x.gap - y.gap)[0];
      if (close) {
        const place = close.i === 0 ? "la victoire" : "la " + ord(close.i + 1) + " place";
        if (close.gap === 0) tell("🤝", "Égalité parfaite pour " + place + " : " + close.a.name + " et " + close.b.name +
          " finissent avec " + nf(close.a.score) + " points chacun.");
        else tell("🤝", "Duel serré pour " + place + " : " + close.a.name + " devance " + close.b.name +
          " de seulement " + nf(close.gap) + " point" + (close.gap > 1 ? "s" : "") + ".");
      }
      if (pairs[0] && pairs[0].gap >= winner.score * 0.2 && !(close && close.i === 0)) {
        tell("💪", "Victoire nette : " + winner.name + " termine avec " + nf(pairs[0].gap) + " points d'avance sur " + pairs[0].b.name + ".");
      }
    }

    /* --- Trophées --- */
    const pl = out.players.filter((p) => p.answered > 0);
    const add = (emoji, title, name, detail) => out.awards.push({ emoji, title, name, detail });
    const minHalf = Math.max(2, Math.ceil(nbQ / 2));

    if (out.players[0] && out.players[0].score > 0) {
      add("🏆", "Numéro 1", out.players[0].name, nf(out.players[0].score) + " points");
    }
    const snipers = pl.filter((p) => p.answered >= minHalf && p.good > 0)
      .sort((a, b) => b.accuracy - a.accuracy || b.good - a.good || (a.avgTimeGood || 1e9) - (b.avgTimeGood || 1e9));
    if (snipers[0]) add("🎯", "Sniper", snipers[0].name,
      pct(snipers[0].accuracy) + " % de bonnes réponses (" + snipers[0].good + "/" + snipers[0].answered + ")");

    const fast = pl.filter((p) => p.good >= Math.max(1, Math.ceil(nbQ / 3)) && p.avgTimeGood != null)
      .sort((a, b) => a.avgTimeGood - b.avgTimeGood);
    if (fast[0]) add("⚡", "Gâchette", fast[0].name, sec(fast[0].avgTimeGood) + " s en moyenne sur ses bonnes réponses");

    if (out.hasTimeline) {
      const streak = pl.slice().sort((a, b) => b.bestStreak - a.bestStreak || b.score - a.score)[0];
      if (streak && streak.bestStreak >= 3) add("🔥", "Série en or", streak.name, streak.bestStreak + " bonnes réponses d'affilée");

      // Remontada : pire place en cours de partie (à partir de Q2) → place finale
      if (nbQ >= 4 && out.players.length >= 3) {
        let best = null;
        out.players.forEach((p) => {
          const mid = p.ranks.slice(1, -1);
          if (!mid.length) return;
          const worst = Math.max.apply(null, mid);
          const gain = worst - p.finalRank;
          if (gain >= 2 && (!best || gain > best.gain)) best = { p, worst, gain };
        });
        if (best) add("🚀", "Remontada", best.p.name, "de la " + ord(best.worst) + " à la " + ord(best.p.finalRank) + " place");
      }

      if (pl.length >= 3) {
        const slow = pl.filter((p) => p.answered >= minHalf && p.avgTime != null).sort((a, b) => b.avgTime - a.avgTime)[0];
        if (slow) add("🤔", "Mûre réflexion", slow.name, "prend " + sec(slow.avgTime) + " s en moyenne pour répondre");
      }
      const brule = pl.slice().sort((a, b) => b.fastWrong - a.fastWrong)[0];
      if (brule && brule.fastWrong >= 2) add("💥", "Tête brûlée", brule.name, brule.fastWrong + " mauvaises réponses en moins de 3 s");
    }
    if (teams.length) {
      const t = teams[0];
      add("👥", "Équipe championne", t.name, "moyenne " + nf(t.avg) + " pts · " + t.members + " joueur" + (t.members > 1 ? "s" : ""));
    }

    /* --- Faits sur les questions --- */
    const pq = out.perQuestion.filter((q) => q.answered > 0);
    if (pq.length) {
      const easy = pq.slice().sort((a, b) => b.rate - a.rate)[0];
      const hard = pq.slice().sort((a, b) => a.rate - b.rate)[0];
      out.questionFacts.push({ emoji: "🧠", title: "La plus facile", q: easy, detail: easy.rate + " % de bonnes réponses" });
      if (hard.n !== easy.n) out.questionFacts.push({ emoji: "😈", title: "La plus piégeuse", q: hard, detail: hard.rate + " % de bonnes réponses" });
      const trap = pq.filter((q) => q.trap && q.trap.pct >= 25).sort((a, b) => b.trap.pct - a.trap.pct)[0];
      if (trap) out.questionFacts.push({ emoji: "🪤", title: "Le piège", q: trap,
        detail: trap.trap.pct + " % ont répondu « " + trap.trap.label + " » au lieu de « " + trap.correctLabel + " »" });
      const timed = pq.filter((q) => q.avgTime != null);
      if (timed.length >= 2) {
        const quick = timed.slice().sort((a, b) => a.avgTime - b.avgTime)[0];
        const slow = timed.slice().sort((a, b) => b.avgTime - a.avgTime)[0];
        out.questionFacts.push({ emoji: "⚡", title: "Question éclair", q: quick, detail: "réponse en " + sec(quick.avgTime) + " s en moyenne" });
        if (slow.n !== quick.n) out.questionFacts.push({ emoji: "🧩", title: "Casse-tête", q: slow, detail: sec(slow.avgTime) + " s de réflexion en moyenne" });
      }
    }
    return out;
  }

  /* ---------- Panthéon : plusieurs parties ---------- */
  function pantheon(games) {
    const list = (games || []).filter((g) => g && g.ranking);
    const people = new Map(); // clé prénom → stats cumulées
    let answers = 0, questions = 0;
    let recordScore = null, recordAcc = null;

    list.forEach((g) => {
      const a = analyze(g);
      answers += a.kpis.answers; questions += a.kpis.questions;
      const quiz = (g.names || []).join(" ♥ ");
      a.players.forEach((p) => {
        const k = key(p.name);
        if (!k) return;
        const e = people.get(k) || { name: p.name, games: 0, wins: 0, podiums: 0, best: 0, good: 0, answered: 0 };
        e.name = e.name || p.name;
        e.games += 1;
        if (p.finalRank === 1 && p.score > 0) e.wins += 1;
        if (p.finalRank <= 3 && p.score > 0) e.podiums += 1;
        e.best = Math.max(e.best, p.score);
        e.good += p.good; e.answered += p.answered;
        people.set(k, e);
        if (!recordScore || p.score > recordScore.score) recordScore = { name: p.name, score: p.score, quiz, date: g.date };
        const minQ = Math.max(2, Math.ceil(a.kpis.questions / 2));
        if (p.answered >= minQ && (!recordAcc || p.accuracy > recordAcc.accuracy)) {
          recordAcc = { name: p.name, accuracy: p.accuracy, good: p.good, answered: p.answered, quiz, date: g.date };
        }
      });
    });

    const ppl = Array.from(people.values()).map((e) => ({ ...e, accuracy: e.answered ? e.good / e.answered : 0 }));
    const regulars = ppl.filter((e) => e.games >= 2)
      .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.accuracy - a.accuracy);
    const king = ppl.filter((e) => e.wins >= 2).sort((a, b) => b.wins - a.wins)[0] || null;
    return {
      games: list.length, players: ppl.length, answers, questions,
      records: { score: recordScore, accuracy: recordAcc, king },
      regulars,
    };
  }

  return { analyze, pantheon, fmt: { nf, sec, pct, ord, ordM } };
});

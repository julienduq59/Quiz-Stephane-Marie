/**
 * Récapitulatif de fin de partie : classement, statistiques et export PDF.
 */
const PDFDocument = require("pdfkit");

/* ------------------------------------------------------------------ */
/* Calcul du récapitulatif                                             */
/* ------------------------------------------------------------------ */

function buildResults(room, def) {
  const players = Array.from(room.players.values());
  const ranking = players
    .map((p) => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
  const history = room.history || [];
  const nbQ = history.length;

  const questions = history.map((h, i) => {
    const answered = h.answers.length;
    const good = h.answers.filter((a) => a.correct).length;
    const fastest = h.answers.filter((a) => a.correct).sort((a, b) => a.timeMs - b.timeMs)[0] || null;
    return {
      n: i + 1,
      text: h.text,
      options: h.options,
      correctLabel: h.options[h.correct],
      distribution: h.distribution,
      answered,
      good,
      rate: answered ? Math.round((good * 100) / answered) : 0,
      fastest: fastest ? { name: fastest.name, sec: (fastest.timeMs / 1000).toFixed(1) } : null,
    };
  });

  // Statistiques par joueur
  const per = {};
  players.forEach((p) => { per[p.id] = { name: p.name, score: p.score, good: 0, answered: 0, timeGood: 0 }; });
  history.forEach((h) => h.answers.forEach((a) => {
    const s = per[a.playerId];
    if (!s) return;
    s.answered += 1;
    if (a.correct) { s.good += 1; s.timeGood += a.timeMs; }
  }));
  const playerStats = Object.values(per);

  const allAnswers = history.flatMap((h) => h.answers);
  const totalGood = allAnswers.filter((a) => a.correct).length;
  const answeredQs = questions.filter((q) => q.answered > 0);

  const speedster = playerStats
    .filter((s) => s.good >= Math.max(1, Math.ceil(nbQ / 3)))
    .map((s) => ({ name: s.name, avg: s.timeGood / s.good, good: s.good }))
    .sort((a, b) => a.avg - b.avg)[0] || null;

  const fastestAnswer = allAnswers.filter((a) => a.correct).sort((a, b) => a.timeMs - b.timeMs)[0] || null;

  return {
    quizId: room.quizId,
    names: def.names,
    subtitle: def.subtitle,
    date: new Date(room.startedAt || Date.now()),
    durationMin: room.startedAt ? Math.max(1, Math.round((Date.now() - room.startedAt) / 60000)) : null,
    nbPlayers: players.length,
    nbQuestions: nbQ,
    ranking,
    questions,
    playerStats: playerStats.sort((a, b) => b.score - a.score),
    stats: {
      avgScore: ranking.length ? Math.round(ranking.reduce((s, r) => s + r.score, 0) / ranking.length) : 0,
      bestScore: ranking.length ? ranking[0].score : 0,
      globalRate: allAnswers.length ? Math.round((totalGood * 100) / allAnswers.length) : 0,
      totalAnswers: allAnswers.length,
      hardest: answeredQs.slice().sort((a, b) => a.rate - b.rate)[0] || null,
      easiest: answeredQs.slice().sort((a, b) => b.rate - a.rate)[0] || null,
      fastestAnswer: fastestAnswer
        ? { name: fastestAnswer.name, sec: (fastestAnswer.timeMs / 1000).toFixed(1) }
        : null,
      speedster: speedster ? { name: speedster.name, sec: (speedster.avg / 1000).toFixed(1) } : null,
      perfect: nbQ > 0 ? playerStats.filter((s) => s.good === nbQ).map((s) => s.name) : [],
    },
  };
}



/* ------------------------------------------------------------------ */
/* Génération du PDF                                                   */
/* ------------------------------------------------------------------ */

const PRUNE = "#2d1155", OR = "#b8860b", ROSE = "#c2185b", GRIS = "#555555";

function fmtDate(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function writePdf(r, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Résultats — " + r.names.join(" & ") } });
  doc.pipe(stream);
  const W = doc.page.width - 96; // largeur utile

  // ---- En-tête ----
  doc.rect(0, 0, doc.page.width, 118).fill(PRUNE);
  doc.fillColor("#ffd166").font("Helvetica-Bold").fontSize(11)
     .text("SOIRÉE QUIZ", 48, 34, { characterSpacing: 3 });
  doc.fillColor("#ffffff").fontSize(24).text(r.names.join("  ·  "), 48, 52, { width: W });
  doc.fillColor("#d8c7f0").font("Helvetica").fontSize(10).text(fmtDate(r.date), 48, 88);
  doc.fillColor("#000000");
  doc.y = 146;

  // ---- Chiffres clés ----
  const kpis = [
    [String(r.nbPlayers), "joueurs"],
    [String(r.nbQuestions), "questions"],
    [r.stats.globalRate + " %", "de bonnes réponses"],
    [String(r.stats.avgScore), "score moyen"],
  ];
  const bw = W / kpis.length;
  const top = doc.y;
  kpis.forEach((k, i) => {
    const x = 48 + i * bw;
    doc.roundedRect(x + 3, top, bw - 6, 56, 8).fillAndStroke("#f4f0fb", "#e0d6f2");
    doc.fillColor(PRUNE).font("Helvetica-Bold").fontSize(17).text(k[0], x + 3, top + 10, { width: bw - 6, align: "center" });
    doc.fillColor(GRIS).font("Helvetica").fontSize(8.5).text(k[1], x + 3, top + 34, { width: bw - 6, align: "center" });
  });
  doc.y = top + 76;
  doc.fillColor("#000000");

  // ---- Podium ----
  section(doc, "Podium");
  const medals = ["1er", "2e", "3e"];
  const medalColors = [OR, "#8c8c8c", "#a5682a"];
  r.ranking.slice(0, 3).forEach((p, i) => {
    const y = doc.y;
    doc.roundedRect(48, y, W, 30, 6).fillAndStroke(i === 0 ? "#fdf6e0" : "#f7f7f9", "#e6e6ee");
    doc.fillColor(medalColors[i]).font("Helvetica-Bold").fontSize(13).text(medals[i], 60, y + 9, { width: 40 });
    doc.fillColor("#000000").fontSize(13).text(p.name, 104, y + 9, { width: W - 190 });
    doc.fillColor(medalColors[i]).text(p.score + " pts", 48, y + 9, { width: W - 14, align: "right" });
    doc.y = y + 36;
  });
  doc.moveDown(0.4);

  // ---- Faits marquants ----
  const st = r.stats;
  const faits = [];
  if (st.fastestAnswer) faits.push(["Réponse la plus rapide", st.fastestAnswer.name + " en " + st.fastestAnswer.sec + " s"]);
  if (st.speedster) faits.push(["Gâchette la plus rapide", st.speedster.name + " (" + st.speedster.sec + " s en moyenne)"]);
  if (st.easiest) faits.push(["Question la plus facile", "n°" + st.easiest.n + " — " + st.easiest.rate + " % de bonnes réponses"]);
  if (st.hardest) faits.push(["Question la plus piégeuse", "n°" + st.hardest.n + " — " + st.hardest.rate + " % de bonnes réponses"]);
  if (st.perfect.length) faits.push(["Sans-faute", st.perfect.join(", ")]);
  if (r.durationMin) faits.push(["Durée de la partie", "environ " + r.durationMin + " min"]);
  if (faits.length) {
    section(doc, "Faits marquants");
    faits.forEach(([k, v]) => {
      needSpace(doc, 20);
      doc.fillColor(ROSE).font("Helvetica-Bold").fontSize(9.5).text(k, 56, doc.y, { width: 165, continued: false });
      doc.moveUp();
      doc.fillColor("#000000").font("Helvetica").fontSize(9.5).text(v, 230, doc.y, { width: W - 190 });
      doc.moveDown(0.35);
    });
    doc.moveDown(0.4);
  }

  // ---- Classement complet ----
  section(doc, "Classement complet");
  r.ranking.forEach((p, i) => {
    needSpace(doc, 18);
    const y = doc.y;
    if (i % 2 === 0) doc.rect(48, y - 2, W, 17).fill("#faf8fd");
    doc.fillColor(GRIS).font("Helvetica").fontSize(9.5).text(String(i + 1) + ".", 56, y, { width: 24 });
    doc.fillColor("#000000").text(p.name, 82, y, { width: W - 160 });
    doc.fillColor(PRUNE).font("Helvetica-Bold").text(p.score + " pts", 48, y, { width: W - 14, align: "right" });
    doc.y = y + 15;
  });
  doc.moveDown(0.6);

  // ---- Détail par question ----
  section(doc, "Détail des questions");
  r.questions.forEach((q) => {
    needSpace(doc, 62);
    const y = doc.y;
    doc.fillColor(PRUNE).font("Helvetica-Bold").fontSize(10).text("Q" + q.n + ". " + q.text, 56, y, { width: W - 16 });
    doc.fillColor("#1b7a1b").font("Helvetica").fontSize(9)
       .text("Bonne réponse : " + q.correctLabel, 56, doc.y + 2, { width: W - 16 });
    const det = q.good + "/" + q.answered + " bonnes réponses (" + q.rate + " %)" +
      (q.fastest ? "  •  plus rapide : " + q.fastest.name + " (" + q.fastest.sec + " s)" : "");
    doc.fillColor(GRIS).fontSize(8.5).text(det, 56, doc.y + 1, { width: W - 16 });
    // barre de réussite
    const by = doc.y + 4;
    doc.rect(56, by, W - 16, 5).fill("#eceaf3");
    if (q.answered) doc.rect(56, by, Math.max(2, ((W - 16) * q.rate) / 100), 5).fill(q.rate >= 50 ? "#3aa03a" : "#d4693a");
    doc.y = by + 14;
    doc.fillColor("#000000");
  });

  // ---- Pied de page ----
  doc.fontSize(8).fillColor(GRIS)
     .text("Généré automatiquement par Soirée Quiz", 48, doc.page.height - 58, { width: W, align: "center" });

  doc.end();
}

function section(doc, titre) {
  needSpace(doc, 95); // évite un titre orphelin en bas de page
  doc.moveDown(0.2);
  doc.fillColor(PRUNE).font("Helvetica-Bold").fontSize(13).text(titre, 48, doc.y);
  const y = doc.y + 2;
  doc.rect(48, y, 46, 2.5).fill(OR);
  doc.y = y + 12;
  doc.fillColor("#000000").font("Helvetica");
}

function needSpace(doc, h) {
  if (doc.y + h > doc.page.height - 70) doc.addPage();
}

module.exports = { buildResults, writePdf };

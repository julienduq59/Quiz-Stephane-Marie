/**
 * Questions du quiz « Soirée Quiz — Stéphane & Marie ».
 *
 * Pour éditer : ajoutez / modifiez les objets ci-dessous.
 *   - text    : l'énoncé de la question
 *   - options : exactement 4 réponses (l'ordre détermine les couleurs/formes des tuiles)
 *   - correct : l'index (0 à 3) de la bonne réponse
 *   - time    : (optionnel) durée du compte à rebours en secondes (20 par défaut)
 *
 * Les 4 tuiles côté joueur/présentateur sont toujours affichées dans cet ordre :
 *   index 0 → Rouge / Triangle
 *   index 1 → Bleu  / Losange
 *   index 2 → Jaune / Rond
 *   index 3 → Vert  / Carré
 */

const QUESTIONS = [
  {
    text: "Où Stéphane et Marie se sont-ils rencontrés pour la première fois ?",
    options: ["Discothèque", "Lycée", "Bowling", "Soirée"],
    correct: 2, // Bowling
    time: 20,
  },
  {
    text: "Quelle connaissance Stéphane et Marie avaient-ils en commun ?",
    options: ["Sébastien", "Isabelle", "Christophe", "Annie"],
    correct: 3, // Annie
    time: 20,
  },
  {
    text: "Quel sport Stéphane et Marie pratiquent-ils ensemble ?",
    options: ["Cross fit", "Footing", "Natation", "Musculation"],
    correct: 0, // Cross fit
    time: 20,
  },
];

module.exports = QUESTIONS;

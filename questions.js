/**
 * Questions du quiz « Soirée Quiz — Stéphane & Marie ».
 *
 * Pour éditer : ajoutez / modifiez les objets ci-dessous.
 *   - text    : l'énoncé de la question
 *   - options : exactement 4 réponses (l'ordre détermine les couleurs/formes des tuiles)
 *   - correct : l'index (0 à 3) de la bonne réponse
 *   - time    : (optionnel) durée du compte à rebours en secondes (30 par défaut)
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
    time: 30,
  },
  {
    text: "Quelle connaissance Stéphane et Marie avaient-ils en commun ?",
    options: ["Sébastien", "Isabelle", "Christophe", "Annie"],
    correct: 3, // Annie
    time: 30,
  },
  {
    text: "Quel sport Stéphane et Marie pratiquent-ils ensemble ?",
    options: ["Cross fit", "Footing", "Natation", "Musculation"],
    correct: 0, // Cross fit
    time: 30,
  },
  {
    text: "Où Stéphane et Marie ont-ils passé leur voyage de noces ?",
    options: ["République Dominicaine", "Grèce", "Île Maurice", "Seychelles"],
    correct: 2, // Île Maurice
    time: 30,
  },
  {
    text: "À quel âge Stéphane et Marie se sont-ils rencontrés ?",
    options: ["18 ans", "20 ans", "22 ans", "25 ans"],
    correct: 1, // 20 ans
    time: 30,
  },
  {
    text: "Dans quelle ville Stéphane et Marie ont-ils emménagé ensemble pour la première fois ?",
    options: ["Leers", "Lys-lez-Lannoy", "Villeneuve d'Ascq", "Roubaix"],
    correct: 2, // Villeneuve d'Ascq
    time: 30,
  },
  {
    text: "Quel surnom Léa a-t-elle donné à sa belle-mère ?",
    options: ["Mamie lapin", "Mamie gâteaux", "Mamie toutoule", "Mamie Couscous"],
    correct: 3, // Mamie Couscous
    time: 30,
  },
  {
    text: "Quelle est leur région de vacances préférée ?",
    options: ["Côte d'Azur", "Bretagne", "Savoie", "Pays Basque"],
    correct: 3, // Pays Basque
    time: 30,
  },
  {
    text: "Que s'est-il passé lors de la naissance de Julien ?",
    options: [
      "Stéphane s'est évanoui",
      "Stéphane s'est endormi",
      "Stéphane est arrivé en retard",
      "Stéphane a fondu en larmes",
    ],
    correct: 0, // Stéphane s'est évanoui
    time: 30,
  },
  {
    text: "Quel est le gâteau préféré d'Émilie ?",
    options: ["L'opéra", "Le merveilleux", "La tarte meringuée au citron", "La tarte aux fraises"],
    correct: 1, // Le merveilleux
    time: 30,
  },
  {
    text: "Qui était le premier flirt d'Émilie ?",
    options: ["Sevan", "Timéo", "Raphaël", "Ethan"],
    correct: 2, // Raphaël
    time: 30,
  },
  {
    text: "Qui sont le parrain et la marraine d'Émilie ?",
    options: [
      "Olivier et Isabelle",
      "Laurent et Cécile",
      "Annie et Sébastien",
      "Laurent et Annie",
    ],
    correct: 3, // Laurent et Annie
    time: 30,
  },
  {
    text: "Quelle est la plus grosse bêtise qu'Émilie a faite ?",
    options: [
      "Elle a coupé les cheveux de son frère",
      "Elle a brisé la vitre du poêle à bois avec une voiture miniature",
      "Elle a dessiné sur la portière de la voiture avec un caillou",
      "Elle s'est sauvée de l'école maternelle",
    ],
    correct: 2, // Elle a dessiné sur la portière de la voiture avec un caillou
    time: 30,
  },
];

module.exports = QUESTIONS;

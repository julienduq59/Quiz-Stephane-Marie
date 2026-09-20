/**
 * Quiz Culture générale — 20 questions, tous publics.
 * Difficulté volontairement accessible pour que petits et grands puissent jouer.
 */

const QUESTIONS = [
  {
    text: "Quelle est la capitale de l'Australie ?",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correct: 2, // Canberra
    time: 40,
  },
  {
    text: "Quel est le plus long fleuve de France ?",
    options: ["La Seine", "La Loire", "Le Rhône", "La Garonne"],
    correct: 1, // La Loire
    time: 40,
  },
  {
    text: "Qui a peint La Joconde ?",
    options: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Botticelli"],
    correct: 2, // Léonard de Vinci
    time: 40,
  },
  {
    text: "Quelle planète est la plus proche du Soleil ?",
    options: ["Vénus", "Mercure", "Mars", "La Terre"],
    correct: 1, // Mercure
    time: 40,
  },
  {
    text: "En quelle année a eu lieu la prise de la Bastille ?",
    options: ["1789", "1799", "1715", "1804"],
    correct: 0, // 1789
    time: 40,
  },
  {
    text: "Quel est le plus grand océan du monde ?",
    options: ["L'océan Atlantique", "L'océan Indien", "L'océan Arctique", "L'océan Pacifique"],
    correct: 3, // Pacifique
    time: 40,
  },
  {
    text: "Quel est le plus grand animal du monde ?",
    options: ["L'éléphant d'Afrique", "La baleine bleue", "Le cachalot", "La girafe"],
    correct: 1, // La baleine bleue
    time: 40,
  },
  {
    text: "Quelle est la monnaie du Japon ?",
    options: ["Le won", "Le yuan", "Le yen", "Le bath"],
    correct: 2, // Le yen
    time: 40,
  },
  {
    text: "Qui a écrit Les Misérables ?",
    options: ["Émile Zola", "Victor Hugo", "Gustave Flaubert", "Honoré de Balzac"],
    correct: 1, // Victor Hugo
    time: 40,
  },
  {
    text: "Quelle est la plus haute montagne du monde ?",
    options: ["Le K2", "Le mont Blanc", "L'Everest", "Le Kilimandjaro"],
    correct: 2, // L'Everest
    time: 40,
  },
  {
    text: "Quel est le symbole chimique de l'or ?",
    options: ["Ag", "Au", "Or", "Fe"],
    correct: 1, // Au
    time: 40,
  },
  {
    text: "Dans quel pays se trouve le Machu Picchu ?",
    options: ["Le Mexique", "La Bolivie", "Le Chili", "Le Pérou"],
    correct: 3, // Le Pérou
    time: 40,
  },
  {
    text: "Quel pays a remporté la Coupe du monde de football en 2018 ?",
    options: ["La France", "La Croatie", "Le Brésil", "L'Allemagne"],
    correct: 0, // La France
    time: 40,
  },
  {
    text: "Combien de joueurs composent une équipe de football sur le terrain ?",
    options: ["10", "11", "12", "9"],
    correct: 1, // 11
    time: 40,
  },
  {
    text: "Quel est le plus petit pays du monde ?",
    options: ["Monaco", "Saint-Marin", "Le Vatican", "Le Liechtenstein"],
    correct: 2, // Le Vatican
    time: 40,
  },
  {
    text: "Quel organe pompe le sang dans le corps humain ?",
    options: ["Les poumons", "Le foie", "Le cœur", "Les reins"],
    correct: 2, // Le cœur
    time: 40,
  },
  {
    text: "Dans quelle ville se trouve la Sagrada Família ?",
    options: ["Madrid", "Barcelone", "Valence", "Séville"],
    correct: 1, // Barcelone
    time: 40,
  },
  {
    text: "Quel fromage garnit traditionnellement une pizza margherita ?",
    options: ["Le gorgonzola", "Le parmesan", "La ricotta", "La mozzarella"],
    correct: 3, // La mozzarella
    time: 40,
  },
  {
    text: "Combien de dents possède un adulte en général ?",
    options: ["28", "30", "32", "36"],
    correct: 2, // 32
    time: 40,
  },
  {
    text: "Quelle mer borde la Côte d'Azur ?",
    options: ["La mer Méditerranée", "La mer Noire", "La mer Adriatique", "La mer Baltique"],
    correct: 0, // La Méditerranée
    time: 40,
  },
];

module.exports = QUESTIONS;

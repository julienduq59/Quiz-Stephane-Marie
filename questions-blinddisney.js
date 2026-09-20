/**
 * Blind test — Disney & dessins animés (versions françaises).
 * Les joueurs devinent le dessin animé à partir de la chanson.
 *
 * ⚠️ Les titres français Disney sont parfois référencés différemment selon les
 *    catalogues : vérifie impérativement cette playlist via /api/blind-check
 *    avant la soirée, et remplace au besoin par un fichier local
 *    (music.audio = "/audio/ma-chanson.mp3").
 */

const QUESTIONS = [
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Le Roi Lion", "Tarzan", "Le Livre de la Jungle", "Bambi"],
    correct: 0, // Le Roi Lion
    time: 30,
    music: { artist: "Le Roi Lion", title: "L'histoire de la vie" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Raiponce", "La Reine des Neiges", "Vaiana", "Rebelle"],
    correct: 1, // La Reine des Neiges
    time: 30,
    music: { artist: "Anaïs Delva", title: "Libérée, délivrée" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Mulan", "Hercule", "Aladdin", "Pocahontas"],
    correct: 2, // Aladdin
    time: 30,
    music: { artist: "Aladdin", title: "Ce rêve bleu" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["La Petite Sirène", "Le Monde de Nemo", "Vaiana", "La Belle et la Bête"],
    correct: 0, // La Petite Sirène
    time: 30,
    music: { artist: "La Petite Sirène", title: "Sous l'océan" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Robin des Bois", "Le Livre de la Jungle", "Les Aristochats", "Dumbo"],
    correct: 1, // Le Livre de la Jungle
    time: 30,
    music: { artist: "Le Livre de la Jungle", title: "Il en faut peu pour être heureux" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Mulan", "Pocahontas", "Atlantide", "Frère des ours"],
    correct: 1, // Pocahontas
    time: 30,
    music: { artist: "Pocahontas", title: "L'air du vent" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Cendrillon", "La Belle au bois dormant", "Blanche-Neige et les Sept Nains", "Alice au pays des merveilles"],
    correct: 2, // Blanche-Neige
    time: 30,
    music: { artist: "Blanche-Neige et les Sept Nains", title: "Un jour mon prince viendra" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Toy Story", "Monstres et Cie", "Cars", "1001 Pattes"],
    correct: 0, // Toy Story
    time: 30,
    music: { artist: "Toy Story", title: "Je suis ton ami" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Raiponce", "La Princesse et la Grenouille", "La Belle et la Bête", "Hercule"],
    correct: 2, // La Belle et la Bête
    time: 30,
    music: { artist: "La Belle et la Bête", title: "C'est la fête" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Vaiana", "Raiponce", "La Reine des Neiges", "Encanto"],
    correct: 0, // Vaiana
    time: 30,
    music: { artist: "Vaiana", title: "Le bleu lumière" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Hercule", "Mulan", "Tarzan", "Kuzco"],
    correct: 1, // Mulan
    time: 30,
    music: { artist: "Mulan", title: "Comme un homme" },
  },
  {
    text: "De quel dessin animé vient cette chanson ?",
    options: ["Le Roi Lion", "Le Livre de la Jungle", "Les Aristochats", "Robin des Bois"],
    correct: 0, // Le Roi Lion
    time: 30,
    music: { artist: "Le Roi Lion", title: "Hakuna Matata" },
  },
];

module.exports = QUESTIONS;

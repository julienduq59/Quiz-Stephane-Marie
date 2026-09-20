/**
 * Blind test — Musiques de films.
 * Ici les joueurs devinent LE FILM à partir de sa musique.
 * Vérifie la playlist avant la soirée via /api/blind-check
 */

const QUESTIONS = [
  {
    text: "De quel film vient cette musique ?",
    options: ["Star Wars", "Star Trek", "Superman", "Indiana Jones"],
    correct: 0, // Star Wars
    time: 30,
    music: { artist: "John Williams", title: "Star Wars (Main Title)" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Ghost", "Titanic", "Pearl Harbor", "Le Patient anglais"],
    correct: 1, // Titanic
    time: 30,
    music: { artist: "Céline Dion", title: "My Heart Will Go On" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Karaté Kid", "Raging Bull", "Rocky", "Rambo"],
    correct: 2, // Rocky
    time: 30,
    music: { artist: "Bill Conti", title: "Gonna Fly Now" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Gladiator", "Le Seigneur des Anneaux", "Master and Commander", "Pirates des Caraïbes"],
    correct: 3, // Pirates des Caraïbes
    time: 30,
    music: { artist: "Hans Zimmer", title: "He's a Pirate" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Jurassic Park", "E.T.", "King Kong", "Avatar"],
    correct: 0, // Jurassic Park
    time: 30,
    music: { artist: "John Williams", title: "Theme from Jurassic Park" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["James Bond", "La Panthère rose", "Les Aristochats", "Ocean's Eleven"],
    correct: 1, // La Panthère rose
    time: 30,
    music: { artist: "Henry Mancini", title: "The Pink Panther Theme" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Django Unchained", "Pour une poignée de dollars", "Le Bon, la Brute et le Truand", "Il était une fois dans l'Ouest"],
    correct: 2, // Le Bon, la Brute et le Truand
    time: 30,
    music: { artist: "Ennio Morricone", title: "The Good, the Bad and the Ugly" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Les Goonies", "Gremlins", "Retour vers le futur", "SOS Fantômes"],
    correct: 2, // Retour vers le futur
    time: 30,
    music: { artist: "Alan Silvestri", title: "Back to the Future" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["SOS Fantômes", "Men in Black", "Beetlejuice", "Les Dents de la mer"],
    correct: 0, // SOS Fantômes (Ghostbusters)
    time: 30,
    music: { artist: "Ray Parker Jr.", title: "Ghostbusters" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Rocky", "Blade Runner", "Le Grand Bleu", "Les Chariots de feu"],
    correct: 3, // Les Chariots de feu
    time: 30,
    music: { artist: "Vangelis", title: "Chariots of Fire" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Tarzan", "Le Roi Lion", "Le Livre de la Jungle", "Bambi"],
    correct: 1, // Le Roi Lion
    time: 30,
    music: { artist: "Elton John", title: "Can You Feel the Love Tonight" },
  },
  {
    text: "De quel film vient cette musique ?",
    options: ["Harry Potter", "Narnia", "Willow", "Le Seigneur des Anneaux"],
    correct: 3, // Le Seigneur des Anneaux
    time: 30,
    music: { artist: "Howard Shore", title: "Concerning Hobbits" },
  },
];

module.exports = QUESTIONS;

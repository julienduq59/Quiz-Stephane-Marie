/**
 * Blind test — playlist et questions.
 *
 * Chaque entrée fonctionne comme une question classique (text / options / correct),
 * plus un bloc « music » qui sert à retrouver automatiquement un extrait de 30 s :
 *
 *   music: { artist: "Indochine", title: "L'Aventurier" }
 *
 * Le serveur interroge le catalogue iTunes (gratuit, sans compte) et récupère
 * l'URL de l'extrait. Tu peux aussi forcer un fichier ou une URL précise :
 *
 *   music: { artist: "...", title: "...", audio: "/audio/ma-chanson.mp3" }
 *
 * ⚠️ L'ordre des propositions est FIXE (comme pour les autres quiz) : la bonne
 *    réponse est donnée par « correct » (0 = 1re proposition).
 *    Pense à vérifier la playlist avant la soirée via /api/blind-check
 */

const QUESTIONS = [
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["L'Aventurier", "Canary Bay", "Trois nuits par semaine", "J'ai demandé à la lune"],
    correct: 0,
    time: 30,
    music: { artist: "Indochine", title: "L'Aventurier" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Téléphone", "Trust", "Noir Désir", "Les Rita Mitsouko"],
    correct: 0,
    time: 30,
    music: { artist: "Téléphone", title: "Ça (c'est vraiment toi)" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["One More Time", "Get Lucky", "Around the World", "Instant Crush"],
    correct: 1,
    time: 30,
    music: { artist: "Daft Punk", title: "Get Lucky" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Prince", "Michael Jackson", "Lionel Richie", "Stevie Wonder"],
    correct: 1,
    time: 30,
    music: { artist: "Michael Jackson", title: "Billie Jean" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Je te donne", "Envole-moi", "Quand la musique est bonne", "Comme toi"],
    correct: 1,
    time: 30,
    music: { artist: "Jean-Jacques Goldman", title: "Envole-moi" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Queen", "The Rolling Stones", "David Bowie", "Pink Floyd"],
    correct: 0,
    time: 30,
    music: { artist: "Queen", title: "Bohemian Rhapsody" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Papaoutai", "Formidable", "Alors on danse", "Tous les mêmes"],
    correct: 2,
    time: 30,
    music: { artist: "Stromae", title: "Alors on danse" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Bee Gees", "ABBA", "Boney M.", "Village People"],
    correct: 1,
    time: 30,
    music: { artist: "ABBA", title: "Dancing Queen" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Désenchantée", "Libertine", "Sans contrefaçon", "California"],
    correct: 0,
    time: 30,
    music: { artist: "Mylène Farmer", title: "Désenchantée" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Lara Fabian", "Patricia Kaas", "Céline Dion", "Hélène Ségara"],
    correct: 2,
    time: 30,
    music: { artist: "Céline Dion", title: "Pour que tu m'aimes encore" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Balance ton quoi", "Bruxelles je t'aime", "Tout oublier", "La Loi de Murphy"],
    correct: 0,
    time: 30,
    music: { artist: "Angèle", title: "Balance ton quoi" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Blondie", "Eurythmics", "Depeche Mode", "The Police"],
    correct: 1,
    time: 30,
    music: { artist: "Eurythmics", title: "Sweet Dreams (Are Made of This)" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Place des grands hommes", "Casser la voix", "Alors regarde", "Qui a le droit"],
    correct: 1,
    time: 30,
    music: { artist: "Patrick Bruel", title: "Casser la voix" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Bon Jovi", "Europe", "Scorpions", "Guns N' Roses"],
    correct: 0,
    time: 30,
    music: { artist: "Bon Jovi", title: "Livin' On a Prayer" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Copines", "Djadja", "Pookie", "Doudou"],
    correct: 1,
    time: 30,
    music: { artist: "Aya Nakamura", title: "Djadja" },
  },
];

module.exports = QUESTIONS;

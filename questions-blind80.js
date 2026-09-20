/**
 * Blind test — Années 80 (variété française et internationale).
 * Même format que questions-blind.js : le bloc « music » sert à retrouver l'extrait.
 * Vérifie la playlist avant la soirée via /api/blind-check
 */

const QUESTIONS = [
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Africa", "Take On Me", "Tainted Love", "Sweet Child o' Mine"],
    correct: 1, // Take On Me
    time: 30,
    music: { artist: "a-ha", title: "Take On Me" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Prince", "Lionel Richie", "Michael Jackson", "Rick James"],
    correct: 2, // Michael Jackson
    time: 30,
    music: { artist: "Michael Jackson", title: "Thriller" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Résiste", "Ella, elle l'a", "Il jouait du piano debout", "Évidemment"],
    correct: 1, // Ella, elle l'a
    time: 30,
    music: { artist: "France Gall", title: "Ella, elle l'a" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Madonna", "Cyndi Lauper", "Kim Wilde", "Blondie"],
    correct: 0, // Madonna
    time: 30,
    music: { artist: "Madonna", title: "Like a Virgin" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Le chanteur", "Tous les cris les SOS", "L'Aziza", "Mon fils ma bataille"],
    correct: 2, // L'Aziza
    time: 30,
    music: { artist: "Daniel Balavoine", title: "L'Aziza" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Dire Straits", "U2", "The Police", "Tears for Fears"],
    correct: 2, // The Police
    time: 30,
    music: { artist: "The Police", title: "Every Breath You Take" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Je marche seul", "Là-bas", "Puisque tu pars", "Il suffira d'un signe"],
    correct: 0, // Je marche seul
    time: 30,
    music: { artist: "Jean-Jacques Goldman", title: "Je marche seul" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Tina Turner", "Whitney Houston", "Cyndi Lauper", "Donna Summer"],
    correct: 2, // Cyndi Lauper
    time: 30,
    music: { artist: "Cyndi Lauper", title: "Girls Just Want to Have Fun" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Cendrillon", "Un autre monde", "New York avec toi", "Le Jour s'est levé"],
    correct: 2, // New York avec toi
    time: 30,
    music: { artist: "Téléphone", title: "New York avec toi" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Duran Duran", "Wham!", "Culture Club", "Spandau Ballet"],
    correct: 1, // Wham!
    time: 30,
    music: { artist: "Wham!", title: "Wake Me Up Before You Go-Go" },
  },
  {
    text: "Quel est le titre de cette chanson ?",
    options: ["Tombé pour la France", "Duel au soleil", "Week-end à Rome", "Saudade"],
    correct: 2, // Week-end à Rome
    time: 30,
    music: { artist: "Étienne Daho", title: "Week-end à Rome" },
  },
  {
    text: "Qui chante ce morceau ?",
    options: ["Toto", "Status Quo", "ZZ Top", "Dire Straits"],
    correct: 3, // Dire Straits
    time: 30,
    music: { artist: "Dire Straits", title: "Money for Nothing" },
  },
];

module.exports = QUESTIONS;

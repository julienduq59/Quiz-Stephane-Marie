# 🎉 Soirée Quiz — plateforme multi-quiz

Une **plateforme de quiz multijoueur en temps réel**, façon Kahoot. Le présentateur
affiche les questions sur la TV / le vidéoprojecteur, les invités jouent depuis leur
téléphone en scannant un QR code.

La plateforme héberge **plusieurs quiz indépendants** (chacun avec sa propre salle,
son code PIN et son QR) :
- **Stéphane ♥ Marie ♥ Émilie** — la soirée double anniversaire (19 questions)
- **Blind Test** 🎵 — variété française et internationale (15 titres)
- **Blind Test 80** 🕺 — les tubes des années 80 (12 titres)
- **Blind Test Ciné** 🎬 — deviner le film à sa musique (12 titres)
- **Blind Test Disney** 🧸 — chansons de dessins animés (12 titres)
- **Culture générale** 🧠 — 20 questions tous publics
- **Clément ♥ Charlotte** — le quiz du mariage *(questions d'exemple à remplacer)*

### Pages
- 🏠 **Accueil** (`/`) : présentation + choix du quiz.
- 🖥️ **Présentateur** (`/quiz/<id>/host`) : QR code, code PIN, liste des joueurs,
  questions, compte à rebours, classement et podium final avec confettis.
- 📱 **Joueurs** (`/quiz/<id>`) : on saisit son prénom, on touche une des 4 tuiles
  colorées, on voit la bonne réponse, son score et son classement.

*(les identifiants `<id>` sont `parents` et `clement`)*

- ⚡ Temps réel via **Socket.IO**, pensé pour **50+ joueurs simultanés** par quiz.
- 🇫🇷 Interface entièrement en français.

## 🟣 Déploiement en 1 clic (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/julienduq59/Quiz-St-phane-Marie)

Le dépôt contient un blueprint `render.yaml` : clique le bouton, connecte ton
compte Render, valide → tu obtiens une URL publique stable
`https://quiz-julien.onrender.com` (accueil sur `/`, puis choix du quiz).

---

## 🚀 Lancer en local

Prérequis : **Node.js 18+**.

```bash
npm install
npm start
```

Le serveur démarre sur le port `3000` (configurable via `PORT`). La console
affiche les adresses à utiliser, par exemple :

```
  Accueil : http://192.168.1.42:3000/
  • Stéphane & Marie → http://192.168.1.42:3000/quiz/parents/host  (code ABC123)
  • Clément & Charlotte → http://192.168.1.42:3000/quiz/clement/host  (code XYZ789)
```

Ouvre **`/`** (accueil) pour choisir un quiz, ou va directement sur
**`/quiz/<id>/host`** pour l'écran de présentation. Les joueurs, eux, scannent
simplement le QR code affiché.

---

## 📶 Tester sur le même Wi-Fi (réseau local)

1. Vérifie que l'ordinateur (serveur) et les téléphones sont sur **le même Wi-Fi**.
2. Lance `npm start`.
3. Ouvre `http://<IP-DE-TON-PC>:3000/` (accueil) et choisis un quiz → écran
   présentateur (l'IP est affichée dans la console au démarrage, ex. `192.168.1.42`).
4. Les invités scannent le **QR code** affiché → ils arrivent directement sur la
   page joueur avec le code salle prérempli. (Sinon : `http://<IP>:3000` + saisir
   le code PIN.)

> 💡 Pour trouver ton IP locale manuellement :
> - **macOS / Linux** : `ipconfig getifaddr en0` ou `hostname -I`
> - **Windows** : `ipconfig` → « Adresse IPv4 »

Le QR code encode automatiquement l'URL de connexion. Le serveur détecte
host/port tout seul ; tu peux forcer l'URL avec la variable d'environnement
`PUBLIC_URL` (voir ci-dessous).

---

## 🌍 Obtenir un QR code **public** pour la soirée

Si les invités ne sont **pas tous sur le même Wi-Fi** (ou pour éviter les soucis
de réseau), expose l'appli sur Internet. Deux options :

### Option A — Ponctuel : tunnel temporaire (sans compte)

Lance d'abord l'appli (`npm start`), puis dans un **second terminal** :

**Avec Cloudflare Tunnel (`cloudflared`) — recommandé, gratuit, sans compte :**

```bash
# Installation (macOS)   : brew install cloudflared
# Installation (Linux)   : voir https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

Cloudflared affiche une URL publique du type `https://xxx-yyy-zzz.trycloudflare.com`.
Relance alors le serveur en lui passant cette URL pour que le **QR code pointe au
bon endroit** :

```bash
PUBLIC_URL="https://xxx-yyy-zzz.trycloudflare.com" npm start
```

**Avec ngrok (sans compte pour un usage rapide) :**

```bash
# Installation : https://ngrok.com/download
ngrok http 3000
```

ngrok affiche une URL `https://xxxx.ngrok-free.app`. De même :

```bash
PUBLIC_URL="https://xxxx.ngrok-free.app" npm start
```

> ℹ️ L'ordre conseillé : ouvrir le tunnel d'abord pour connaître l'URL, puis
> relancer `npm start` avec `PUBLIC_URL` afin que le QR encode la bonne adresse
> publique. Garde le terminal du tunnel ouvert pendant toute la soirée.

### Option B — Durable : déployer gratuitement (Render ou Railway)

Idéal si tu veux une URL stable préparée à l'avance.

**Render (https://render.com) :**

1. Pousse ce projet sur un dépôt GitHub.
2. Sur Render : **New + → Web Service**, connecte le dépôt.
3. Réglages :
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
4. Render fournit une URL `https://ton-quiz.onrender.com`. Le serveur détecte
   automatiquement l'URL publique (en-têtes du proxy), donc le QR code sera bon.
   Au besoin, ajoute une variable d'environnement `PUBLIC_URL` avec cette URL.
5. Ouvre `https://ton-quiz.onrender.com/` (accueil), puis choisis un quiz.

**Railway (https://railway.app) :**

1. Pousse le projet sur GitHub.
2. Sur Railway : **New Project → Deploy from GitHub repo**.
3. Railway détecte Node automatiquement (`npm install` / `npm start`).
4. Dans **Settings → Networking**, clique **Generate Domain** pour obtenir une
   URL publique `https://ton-quiz.up.railway.app`.
5. (Optionnel) Ajoute la variable `PUBLIC_URL` = cette URL.
6. Accueil : `https://ton-quiz.up.railway.app/` (puis choix du quiz).

> ⚠️ Sur l'offre gratuite de Render, le service peut se « mettre en veille »
> après inactivité : ouvre la page quelques minutes avant la soirée pour le
> réveiller.

---

## ✏️ Modifier les questions

Chaque quiz a son propre fichier de questions, facile à éditer :
- **`questions.js`** → quiz **Stéphane & Marie** (`parents`)
- **`questions-clement.js`** → quiz **Clément & Charlotte** (`clement`) *(exemples à remplacer)*

Chaque question a un énoncé, 4 options et l'index de la bonne réponse :

```js
{
  text: "Ma question ?",
  options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  correct: 2,   // 0 = A, 1 = B, 2 = C, 3 = D
  time: 40,     // durée en secondes (optionnel, 40 par défaut)
}
```

L'ordre des options détermine la couleur/forme de la tuile :
`0 → 🔺 rouge`, `1 → 🔷 bleu`, `2 → 🟡 rond jaune`, `3 → 🟩 carré vert`.

> 🔀 **L'ordre des questions est mélangé aléatoirement à chaque partie.** En
> revanche, **l'ordre des réponses reste fixe** (celui du fichier) : pratique pour
> les réponses récurrentes (ex. « Stéphane » toujours à gauche, « Marie » à droite).
> Tu peux mettre 2, 3 ou 4 options par question (une question à 2 options s'affiche
> avec 2 tuiles, comme un vrai/faux).

### 🎵 Blind test
La playlist est dans **`questions-blind.js`**. Chaque entrée est une question normale,
plus un bloc `music` qui sert à retrouver l'extrait :

```js
music: { artist: "Indochine", title: "L'Aventurier" }
```

Le serveur interroge le catalogue **iTunes** (gratuit, sans compte) et récupère un
extrait de 30 s, joué **automatiquement sur l'écran présentateur uniquement** (les
téléphones restent muets). La lecture vocale des questions est désactivée sur ce quiz.

Pour forcer un morceau précis, dépose un fichier dans `public/audio/` et ajoute :
```js
music: { artist: "…", title: "…", audio: "/audio/ma-chanson.mp3" }
```

Il existe quatre blind tests : `questions-blind.js` (variété), `questions-blind80.js`,
`questions-blindfilm.js` et `questions-blinddisney.js`.

> ✅ **À faire avant la soirée** : ouvre **`/api/blind-check`** pour vérifier que chaque
> chanson trouve bien son extrait — la page teste **tous** les blind tests et liste les
> morceaux introuvables (`/api/blind-check?quiz=blind80` pour n'en tester qu'un). Si un
> extrait manque, le présentateur affiche un avertissement et la question reste jouable.

### Ajouter un nouveau quiz
Crée un fichier `questions-monquiz.js`, puis déclare-le dans `server.js` (objet
`QUIZ_DEFS`) avec un `id`, les deux prénoms et le fichier de questions. Il apparaîtra
automatiquement sur la page d'accueil.

---

## 🏆 Règles de score

- **Bonne réponse** : `500 points` + jusqu'à `500 points` de bonus selon la
  rapidité (plus tu réponds vite, plus le bonus est élevé).
- **Mauvaise réponse** (ou pas de réponse) : `0 point`.

---

## 🎛️ Contrôles présentateur

- **Démarrer le quiz** depuis le lobby.
- **Révéler la réponse** (petit bouton en bas à droite) pour passer plus tôt.
  Sinon la question tourne **toujours jusqu'au bout du compte à rebours (40 s)**,
  même si tout le monde a déjà répondu : personne n'est coupé.
- **Question suivante** après chaque révélation (bouton en haut **et** en bas de
  l'écran de résultats — le bouton du haut reste visible même avec un long classement).
- **🔊 Voix** (bouton en haut à droite) : lecture vocale automatique de chaque
  question et de ses réponses en français, à l'affichage de la question (synthèse
  vocale du navigateur). Activée par défaut, coupable d'un clic. La voix sort sur
  l'écran présentateur — pense à monter le son du vidéoprojecteur / des enceintes.
- **Exclure tout le monde & nouveau code** depuis le lobby (vide la salle et génère
  un nouveau code PIN + QR — pratique après les tests).
- **Recommencer une partie** depuis le podium (remet tous les scores à zéro).

### 📄 Récapitulatif & export PDF
À la fin de la partie, l'écran podium propose **« 📄 Télécharger les résultats (PDF) »** :
classement complet, chiffres clés, faits marquants (réponse la plus rapide, question la
plus piégeuse, sans-faute…) et le détail de chaque question avec son taux de réussite.

**Sauvegarde automatique** : chaque partie terminée est enregistrée sur l'ordinateur du
présentateur (stockage du navigateur). Le bouton **« 📚 Historique des parties »** du
lobby liste les parties passées (date, joueurs, vainqueur) et permet de **retélécharger
le PDF** de n'importe laquelle, ou de la supprimer.

> ℹ️ L'historique est propre à ce navigateur et à cet ordinateur. Le serveur, lui, ne
> garde rien de façon durable (offre gratuite Render) : pense donc à utiliser toujours
> le même poste pour présenter, ou à télécharger le PDF après la partie.

Disponible aussi en API : `/api/results?quiz=<id>` (JSON) et `/api/results.pdf?quiz=<id>`.

### 🔁 Reconnexion (reprise de score)
Un joueur qui ferme le site par erreur peut **rejoindre en cours de partie** :
- **Même téléphone** : il rouvre le lien, re-clique « Entrer » → son score est repris
  automatiquement (identité mémorisée).
- **Autre appareil / mémoire effacée** : il remet le **lien + le code** et **le même
  prénom** → il récupère le score de sa session précédente. Un message
  « Rebienvenue, ton score est conservé » le confirme.

---

## 🔌 Variables d'environnement

| Variable     | Rôle                                                       | Défaut |
|--------------|------------------------------------------------------------|--------|
| `PORT`       | Port d'écoute du serveur                                    | `3000` |
| `PUBLIC_URL` | Force l'URL publique encodée dans le QR code               | (auto) |

---

## 🛠️ Stack technique

- **Node.js + Express** — serveur HTTP & fichiers statiques
- **Socket.IO** — communication temps réel présentateur ⇄ joueurs
- **qrcode** — génération du QR code de connexion
- **HTML / CSS / JS pur** côté client (aucune étape de build)
- Polices **Unbounded** (titres) & **Inter** (texte) via Google Fonts

Bonne soirée ! 🥂

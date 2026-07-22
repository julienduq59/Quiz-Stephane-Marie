# 🎉 Soirée Quiz — plateforme multi-quiz

Une **plateforme de quiz multijoueur en temps réel**, façon Kahoot. Le présentateur
affiche les questions sur la TV / le vidéoprojecteur, les invités jouent depuis leur
téléphone en scannant un QR code.

La plateforme héberge **plusieurs quiz indépendants** (chacun avec sa propre salle,
son code PIN et son QR) :
- **Stéphane ♥ Marie ♥ Émilie** — la soirée double anniversaire
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
`https://soiree-quiz-stephane-marie.onrender.com` (accueil sur `/`, puis choix du quiz).

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
  time: 30,     // durée en secondes (optionnel, 30 par défaut)
}
```

L'ordre des options détermine la couleur/forme de la tuile :
`0 → 🔺 rouge`, `1 → 🔷 bleu`, `2 → 🟡 rond jaune`, `3 → 🟩 carré vert`.

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
- **Révéler la réponse** (petit bouton en bas à droite) à tout moment — sinon
  révélation automatique à la fin du compte à rebours ou quand tout le monde a répondu.
- **Question suivante** après chaque révélation.
- **Exclure tout le monde & nouveau code** depuis le lobby (vide la salle et génère
  un nouveau code PIN + QR — pratique après les tests).
- **Recommencer une partie** depuis le podium (remet tous les scores à zéro).

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

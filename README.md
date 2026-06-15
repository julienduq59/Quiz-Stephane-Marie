# 🎉 Soirée Quiz — Stéphane ♥ Marie

Un quiz **multijoueur en temps réel**, façon Kahoot, conçu pour animer la soirée
de Stéphane et Marie. Le présentateur affiche les questions sur la TV / le
vidéoprojecteur, les invités jouent depuis leur téléphone en scannant un QR code.

- 🖥️ **Présentateur** (`/host`) : QR code, code PIN, liste des joueurs, questions,
  compte à rebours, classement et podium final avec confettis.
- 📱 **Joueurs** (`/`) : on saisit son prénom, on touche une des 4 tuiles colorées,
  on voit son score et son classement.
- ⚡ Temps réel via **Socket.IO**, pensé pour **50+ joueurs simultanés**.
- 🇫🇷 Interface entièrement en français.

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
  Présentateur : http://192.168.1.42:3000/host
  Joueurs      : http://192.168.1.42:3000
  Code salle   : ABC123
```

Ouvre **`/host`** sur l'écran de présentation, et **`/`** sur les téléphones.

---

## 📶 Tester sur le même Wi-Fi (réseau local)

1. Vérifie que l'ordinateur (serveur) et les téléphones sont sur **le même Wi-Fi**.
2. Lance `npm start`.
3. Sur l'écran présentateur, ouvre `http://<IP-DE-TON-PC>:3000/host`
   (l'IP est affichée dans la console au démarrage, ex. `192.168.1.42`).
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
5. Ouvre `https://ton-quiz.onrender.com/host` pour le présentateur.

**Railway (https://railway.app) :**

1. Pousse le projet sur GitHub.
2. Sur Railway : **New Project → Deploy from GitHub repo**.
3. Railway détecte Node automatiquement (`npm install` / `npm start`).
4. Dans **Settings → Networking**, clique **Generate Domain** pour obtenir une
   URL publique `https://ton-quiz.up.railway.app`.
5. (Optionnel) Ajoute la variable `PUBLIC_URL` = cette URL.
6. Présentateur : `https://ton-quiz.up.railway.app/host`.

> ⚠️ Sur l'offre gratuite de Render, le service peut se « mettre en veille »
> après inactivité : ouvre la page quelques minutes avant la soirée pour le
> réveiller.

---

## ✏️ Modifier les questions

Toutes les questions sont dans **`questions.js`** — facile à éditer. Chaque
question a un énoncé, 4 options et l'index de la bonne réponse :

```js
{
  text: "Ma question ?",
  options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  correct: 2,   // 0 = A, 1 = B, 2 = C, 3 = D
  time: 20,     // durée en secondes (optionnel)
}
```

L'ordre des options détermine la couleur/forme de la tuile :
`0 → 🔺 rouge`, `1 → 🔷 bleu`, `2 → 🟡 rond jaune`, `3 → 🟩 carré vert`.

---

## 🏆 Règles de score

- **Bonne réponse** : `500 points` + jusqu'à `500 points` de bonus selon la
  rapidité (plus tu réponds vite, plus le bonus est élevé).
- **Mauvaise réponse** (ou pas de réponse) : `0 point`.

---

## 🎛️ Contrôles présentateur

- **Démarrer le quiz** depuis le lobby.
- **Révéler la réponse** à tout moment (sinon révélation automatique à la fin du
  compte à rebours ou quand tout le monde a répondu).
- **Question suivante** après chaque révélation.
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

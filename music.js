/**
 * Recherche d'extraits musicaux (30 s) pour le blind test.
 *
 * Utilise le catalogue iTunes Search (gratuit, sans compte ni clé).
 * Les résultats sont mis en cache en mémoire : une chanson n'est cherchée qu'une fois.
 *
 * Une chanson peut aussi forcer son extrait : music.audio = "/audio/x.mp3" ou une URL.
 */

const API = "https://itunes.apple.com/search";
const cache = new Map(); // clé "artiste|titre" -> { url, trackName, artistName } ou { error }

const key = (m) => `${(m.artist || "").toLowerCase()}|${(m.title || "").toLowerCase()}`;

// Normalise pour comparer : minuscules, sans accents ni ponctuation
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Un résultat colle-t-il vraiment à ce qu'on cherche ? (évite reprises et live)
function score(item, m) {
  const t = norm(item.trackName), a = norm(item.artistName);
  const wt = norm(m.title), wa = norm(m.artist);
  let s = 0;
  if (t === wt) s += 5; else if (t.startsWith(wt) || wt.startsWith(t)) s += 3; else if (t.includes(wt)) s += 1;
  if (a === wa) s += 5; else if (a.includes(wa) || wa.includes(a)) s += 3;
  if (/(karaoke|tribute|cover|made famous|live|remix|instrumental)/.test(t + " " + a)) s -= 8;
  return s;
}

/**
 * Renvoie { url, trackName, artistName } ou { error }.
 * fetchImpl est injectable pour les tests.
 */
async function resolveTrack(m, fetchImpl) {
  if (!m) return { error: "Pas de musique définie" };
  if (m.audio) return { url: m.audio, trackName: m.title, artistName: m.artist, forced: true };

  const k = key(m);
  if (cache.has(k)) return cache.get(k);

  const doFetch = fetchImpl || globalThis.fetch;
  const url = `${API}?term=${encodeURIComponent(m.artist + " " + m.title)}&entity=song&limit=12&country=FR`;
  let out;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await doFetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const items = (data.results || []).filter((r) => r.previewUrl);
    if (!items.length) {
      out = { error: "Aucun extrait trouvé" };
    } else {
      const best = items.map((i) => ({ i, s: score(i, m) })).sort((a, b) => b.s - a.s)[0];
      out = best.s <= 0
        ? { error: "Aucune correspondance fiable" }
        : { url: best.i.previewUrl, trackName: best.i.trackName, artistName: best.i.artistName };
    }
  } catch (e) {
    out = { error: e.name === "AbortError" ? "Délai dépassé" : String(e.message || e) };
  }
  // On ne met en cache que les succès : une erreur réseau doit pouvoir être retentée
  if (out.url) cache.set(k, out);
  return out;
}

// Pré-charge toute une playlist (en arrière-plan, sans bloquer)
async function prewarm(questions, fetchImpl) {
  const out = [];
  for (const q of questions) {
    if (!q.music) continue;
    out.push({ music: q.music, ...(await resolveTrack(q.music, fetchImpl)) });
  }
  return out;
}

module.exports = { resolveTrack, prewarm, _norm: norm, _score: score, _cache: cache };

/**
 * Effets sonores de la soirée, entièrement synthétisés (Web Audio) :
 * aucun fichier, aucun droit d'auteur, rien à télécharger.
 *
 *   Sfx.unlock()       à appeler sur un geste utilisateur (clic/toucher)
 *   Sfx.tick(n)        tic-tac des dernières secondes (n = secondes restantes)
 *   Sfx.reveal()       jingle de révélation
 *   Sfx.correct()      ding de bonne réponse      Sfx.wrong()  buzz d'erreur
 *   Sfx.fanfare()      fanfare du podium
 *   Sfx.lobby(true)    musique d'attente (douce, en boucle) ; Sfx.lobby(false) l'arrête
 *   Sfx.setEnabled(b)  coupe / rétablit tous les sons
 */
window.Sfx = (function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, enabled = true;

  function ac() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.7 : 0;
      master.connect(ctx.destination);
    }
    return ctx;
  }
  const ready = () => { const c = ac(); return c && c.state === "running"; };

  // Une note : fréquence, début, durée, options (forme d'onde, volume, filtre…)
  function tone(freq, t0, dur, o) {
    o = o || {};
    const c = ac(); if (!c) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lowpass) {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = o.lowpass;
      osc.connect(lp); node = lp;
    }
    node.connect(g); g.connect(o.dest || master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // Notes utiles (Hz)
  const N = { A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F3: 174.61, F4: 349.23,
              G3: 196, G4: 392, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, E6: 1318.5, A6: 1760 };

  function tick(n) {
    if (!enabled || !ready()) return;
    const t = ctx.currentTime;
    const last = n <= 1;
    tone(last ? 1500 : (n % 2 ? 1200 : 900), t, last ? 0.12 : 0.05,
         { type: "square", vol: last ? 0.16 : 0.11, lowpass: 3200, attack: 0.003 });
  }

  function reveal() {
    if (!enabled || !ready()) return;
    const t = ctx.currentTime;
    tone(N.G4, t, 0.14, { type: "square", vol: 0.16, lowpass: 2200 });
    [N.C5, N.E5, N.G5].forEach((f) =>
      tone(f, t + 0.15, 0.85, { type: "sawtooth", vol: 0.1, lowpass: 2400, attack: 0.02 }));
  }

  function correct() {
    if (!enabled || !ready()) return;
    const t = ctx.currentTime;
    tone(N.E6, t, 0.28, { vol: 0.3 });
    tone(N.A6, t + 0.11, 0.55, { vol: 0.3 });
    tone(N.A6 * 2, t + 0.11, 0.35, { vol: 0.06 }); // harmonique « cloche »
  }

  function wrong() {
    if (!enabled || !ready()) return;
    const t = ctx.currentTime;
    tone(196, t, 0.38, { type: "sawtooth", vol: 0.22, slideTo: 104, lowpass: 900 });
  }

  // Petite fanfare originale (arpège ascendant + accord final)
  function fanfare() {
    if (!enabled || !ready()) return;
    const t = ctx.currentTime;
    const brass = { type: "sawtooth", vol: 0.13, lowpass: 2600, attack: 0.02 };
    [[0, N.G4, 0.16], [0.18, N.C5, 0.16], [0.36, N.E5, 0.16], [0.54, N.G5, 0.42],
     [1.0, N.E5, 0.16], [1.18, N.G5, 1.2]].forEach(([d, f, du]) => tone(f, t + d, du, brass));
    [N.C4, N.E4, N.G4].forEach((f) => tone(f, t + 1.18, 1.25, { type: "triangle", vol: 0.12, attack: 0.05 }));
  }

  /* ----- Musique d'attente (lobby) : arpèges doux en boucle ----- */
  const CHORDS = [[N.C4, N.E4, N.G4, N.C5], [N.A3, N.C4, N.E4, N.A4],
                  [N.F3, N.A3, N.C4, N.F4], [N.G3, N.B3, N.D4, N.G4]];
  const PATTERN = [0, 1, 2, 3, 2, 1, 0, 1];
  let wantLobby = false, lobbyTimer = null, lobbyGain = null, lobbyNext = 0, lobbyStep = 0;

  function scheduleLobby() {
    const c = ac();
    while (lobbyNext < c.currentTime + 0.5) {
      const chord = CHORDS[Math.floor(lobbyStep / 8) % CHORDS.length];
      tone(chord[PATTERN[lobbyStep % 8]], lobbyNext, 0.45,
           { type: "triangle", vol: 0.07, dest: lobbyGain, attack: 0.02 });
      if (lobbyStep % 8 === 0) {
        tone(chord[0] / 2, lobbyNext, 1.9, { vol: 0.08, dest: lobbyGain, attack: 0.06 });
      }
      lobbyNext += 0.25; lobbyStep += 1;
    }
  }
  function startLobby() {
    if (lobbyTimer || !enabled || !ready()) return;
    lobbyGain = ctx.createGain();
    lobbyGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    lobbyGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
    lobbyGain.connect(master);
    lobbyNext = ctx.currentTime + 0.1; lobbyStep = 0;
    lobbyTimer = setInterval(scheduleLobby, 150);
    scheduleLobby();
  }
  function stopLobby() {
    if (!lobbyTimer) return;
    clearInterval(lobbyTimer); lobbyTimer = null;
    const g = lobbyGain, now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 900);
  }
  function lobby(on) {
    wantLobby = !!on;
    if (wantLobby) startLobby(); else stopLobby();
  }

  // Les navigateurs exigent un geste (clic/toucher) avant de produire du son
  function unlock() {
    const c = ac(); if (!c) return;
    if (c.state === "suspended") {
      c.resume().then(() => { if (wantLobby) startLobby(); }).catch(() => {});
    } else if (wantLobby) startLobby();
  }

  function setEnabled(b) {
    enabled = !!b;
    if (master) master.gain.setValueAtTime(enabled ? 0.7 : 0, ctx.currentTime);
    if (!enabled) stopLobby(); else if (wantLobby) startLobby();
  }

  return {
    unlock, tick, reveal, correct, wrong, fanfare, lobby, setEnabled,
    isEnabled: () => enabled,
    isLobbyPlaying: () => !!lobbyTimer,
    isUnlocked: ready,
    _debug: () => ({ ctx, master }), // diagnostic (tests)
  };
})();

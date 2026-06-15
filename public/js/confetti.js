/* Confettis légers (sans dépendance) — thème soirée or & rose */
(function () {
  const COLORS = ["#ffd166", "#ff5d8f", "#6c5ce7", "#ffba9b", "#26890c", "#1368ce"];
  let canvas, ctx, parts = [], raf = null;

  function ensureCanvas() {
    canvas = document.getElementById("confetti");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti";
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function spawn(n) {
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        r: 5 + Math.random() * 8,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
        shape: Math.random() < 0.5 ? "rect" : "circ",
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.shape === "rect") ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (p.y > canvas.height + 30) parts.splice(i, 1);
    }
    if (parts.length > 0) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  window.confetti = {
    burst(n = 140) {
      ensureCanvas();
      spawn(n);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    shower(durationMs = 2500) {
      ensureCanvas();
      const end = Date.now() + durationMs;
      const iv = setInterval(() => {
        spawn(28);
        if (!raf) raf = requestAnimationFrame(tick);
        if (Date.now() > end) clearInterval(iv);
      }, 200);
    },
    stop() { parts = []; },
  };
})();

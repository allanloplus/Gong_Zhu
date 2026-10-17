/* 拱豬夜市 — 背景：台北夜空、山稜線、101、燈籠 */
(function () {
  'use strict';
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let rnd;

  function seeded(seed) {
    let a = seed;
    return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  }

  function ridge(w, h, base, amp, step, color, seed) {
    const r = seeded(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    let y = base;
    for (let x = 0; x <= w + step; x += step) {
      y += (r() - 0.5) * amp;
      y = Math.max(base - amp * 2.2, Math.min(base + amp, y));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  function windows(x, y, w, h, density) {
    for (let wy = y + 6; wy < y + h - 4; wy += 9) {
      for (let wx = x + 4; wx < x + w - 4; wx += 7) {
        if (rnd() < density) {
          ctx.fillStyle = rnd() < 0.8 ? 'rgba(255, 214, 140, 0.75)' : 'rgba(150, 220, 255, 0.7)';
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }

  function taipei101(cx, ground, H) {
    const unit = H / 16;
    ctx.save();
    ctx.fillStyle = '#16123a';
    ctx.strokeStyle = 'rgba(120, 230, 210, 0.55)';
    ctx.lineWidth = 1.2;
    // 基座
    ctx.fillRect(cx - unit * 1.9, ground - unit * 2.2, unit * 3.8, unit * 2.2);
    // 主幹
    let y = ground - unit * 2.2;
    ctx.fillRect(cx - unit * 1.05, y - unit * 1.6, unit * 2.1, unit * 1.6);
    y -= unit * 1.6;
    // 8 節「竹節」：下窄上寬
    for (let i = 0; i < 8; i++) {
      const segH = unit * 1.15;
      ctx.beginPath();
      ctx.moveTo(cx - unit * 0.95, y);
      ctx.lineTo(cx - unit * 1.25, y - segH);
      ctx.lineTo(cx + unit * 1.25, y - segH);
      ctx.lineTo(cx + unit * 0.95, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(120, 255, 220, 0.18)';
      ctx.fillRect(cx - unit * 1.1, y - segH * 0.5, unit * 2.2, 1.5);
      ctx.fillStyle = '#16123a';
      y -= segH;
    }
    // 頂部
    ctx.fillRect(cx - unit * 0.6, y - unit * 0.9, unit * 1.2, unit * 0.9);
    y -= unit * 0.9;
    ctx.fillRect(cx - unit * 0.3, y - unit * 0.7, unit * 0.6, unit * 0.7);
    y -= unit * 0.7;
    ctx.fillRect(cx - 1.5, y - unit * 1.6, 3, unit * 1.6);
    // 頂燈
    const top = y - unit * 1.6;
    const g = ctx.createRadialGradient(cx, top, 0, cx, top, 18);
    g.addColorStop(0, 'rgba(255, 90, 60, 0.95)');
    g.addColorStop(1, 'rgba(255, 90, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 18, top - 18, 36, 36);
    ctx.restore();
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rnd = seeded(20260101);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0920');
    sky.addColorStop(0.45, '#22195a');
    sky.addColorStop(0.72, '#5a2470');
    sky.addColorStop(1, '#a8406c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 140; i++) {
      const x = rnd() * w, y = rnd() * h * 0.55, r = rnd() * 1.3 + 0.2;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // 月亮
    const mx = w * 0.86, my = h * 0.2;
    const moon = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
    moon.addColorStop(0, 'rgba(255, 240, 200, 0.35)');
    moon.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = moon; ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22195a'; ctx.beginPath(); ctx.arc(mx + 11, my - 7, 23, 0, Math.PI * 2); ctx.fill();

    // 山（陽明山稜線）
    ridge(w, h, h * 0.62, 26, 40, '#2a1f5e', 7);
    ridge(w, h, h * 0.7, 20, 30, '#21184d', 11);

    // 城市天際線
    const ground = h * 0.86;
    for (let x = -10; x < w; ) {
      const bw = 26 + rnd() * 50, bh = h * (0.06 + rnd() * 0.16);
      ctx.fillStyle = rnd() < 0.5 ? '#1a1442' : '#140f36';
      ctx.fillRect(x, ground - bh, bw, bh);
      windows(x, ground - bh, bw, bh, 0.22);
      x += bw + 2;
    }
    taipei101(w * 0.68, ground, Math.min(h * 0.62, w * 0.9));
    // 地面霓虹光暈
    const glow = ctx.createLinearGradient(0, ground - 40, 0, h);
    glow.addColorStop(0, 'rgba(255, 110, 70, 0)');
    glow.addColorStop(1, 'rgba(255, 110, 70, 0.35)');
    ctx.fillStyle = glow; ctx.fillRect(0, ground - 40, w, h - ground + 40);
    ctx.fillStyle = '#0d0a24'; ctx.fillRect(0, ground, w, h - ground);
  }

  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  draw();

  // 燈籠串
  const chars = ['拱', '豬', '夜', '市', '福', '台', '灣', '尚', '勇'];
  const box = document.getElementById('lanterns');
  chars.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'lantern';
    el.textContent = c;
    el.style.setProperty('--drop', `${10 + Math.abs(4 - i) * -2 + 18}px`);
    el.style.setProperty('--dur', `${3.2 + (i % 3) * 0.7}s`);
    el.style.animationDelay = `${-i * 0.5}s`;
    box.appendChild(el);
  });
})();

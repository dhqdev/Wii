// Arte do Fruit Ninja: frutas desenhadas por código e pré-renderizadas em sprites.
// Cada fruta tem dois sprites: a casca inteira (whole) e o corte com a polpa (inside).

(function () {
  const S = 2; // resolução dos sprites (2x para ficar nítido)

  // gerador pseudo-aleatório com semente, para a textura sair igual sempre
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function sprite(r, draw) {
    const size = Math.ceil(r * 2.8 * S);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.scale(S, S);
    draw(c, r);
    return cv;
  }

  function radial(c, r, stops, ox = -0.35, oy = -0.4) {
    const g = c.createRadialGradient(r * ox, r * oy, r * 0.05, 0, 0, r * 1.05);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  // brilho especular + sombreamento de borda (dá volume)
  function shade(c, path, r) {
    c.save();
    path();
    c.clip();
    const edge = c.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.4, 0, 0, r * 1.15);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = edge;
    c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    const hi = c.createRadialGradient(-r * 0.42, -r * 0.48, 0, -r * 0.42, -r * 0.48, r * 0.5);
    hi.addColorStop(0, 'rgba(255,255,255,.75)');
    hi.addColorStop(0.35, 'rgba(255,255,255,.25)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hi;
    c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    // luz rebatida embaixo
    const rim = c.createRadialGradient(r * 0.3, r * 0.75, 0, r * 0.3, r * 0.75, r * 0.6);
    rim.addColorStop(0, 'rgba(255,255,255,.14)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rim;
    c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    c.restore();
  }

  function dots(c, path, r, n, rand, colors, size) {
    c.save();
    path();
    c.clip();
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 1.1;
      c.fillStyle = colors[Math.floor(rand() * colors.length)];
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, size * (0.5 + rand()), 0, 7);
      c.fill();
    }
    c.restore();
  }

  function leaf(c, x, y, len, ang, col = '#3f9b2f') {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
    g.addColorStop(0, '#7fd35a');
    g.addColorStop(1, col);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
    c.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
    c.fill();
    c.strokeStyle = 'rgba(20,70,10,.55)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.9, 0); c.stroke();
    for (let i = 1; i < 4; i++) {
      c.beginPath(); c.moveTo(len * i * 0.22, 0); c.lineTo(len * (i * 0.22 + 0.12), -len * 0.12); c.stroke();
      c.beginPath(); c.moveTo(len * i * 0.22, 0); c.lineTo(len * (i * 0.22 + 0.12), len * 0.12); c.stroke();
    }
    c.restore();
  }

  // gomos de cítricos (laranja / limão)
  function citrusInside(c, r, sx, sy, cfg) {
    const ell = (k) => { c.beginPath(); c.ellipse(0, 0, r * sx * k, r * sy * k, 0, 0, 7); };
    ell(1); c.fillStyle = cfg.skin; c.fill();
    ell(0.93); c.fillStyle = cfg.pith; c.fill();
    const n = cfg.segments;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.05, a1 = ((i + 1) / n) * Math.PI * 2 - 0.05;
      c.save();
      c.beginPath();
      c.moveTo(Math.cos((a0 + a1) / 2) * r * 0.1 * sx, Math.sin((a0 + a1) / 2) * r * 0.1 * sy);
      for (let a = a0; a <= a1; a += 0.05) c.lineTo(Math.cos(a) * r * 0.82 * sx, Math.sin(a) * r * 0.82 * sy);
      c.closePath();
      const g = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.85);
      g.addColorStop(0, cfg.fleshLight);
      g.addColorStop(1, cfg.flesh);
      c.fillStyle = g;
      c.fill();
      c.clip();
      // vesículas de suco
      c.strokeStyle = 'rgba(255,255,255,.35)';
      c.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) {
        const a = a0 + (a1 - a0) * (k + 0.5) / 7;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.25 * sx, Math.sin(a) * r * 0.25 * sy);
        c.lineTo(Math.cos(a) * r * 0.75 * sx, Math.sin(a) * r * 0.75 * sy);
        c.stroke();
      }
      c.restore();
    }
    c.fillStyle = cfg.pith;
    c.beginPath(); c.arc(0, 0, r * 0.1, 0, 7); c.fill();
    // brilho molhado
    c.fillStyle = 'rgba(255,255,255,.22)';
    c.beginPath(); c.ellipse(-r * 0.25, -r * 0.3, r * 0.3, r * 0.14, -0.6, 0, 7); c.fill();
  }

  const ART = {};

  // ---------- melancia ----------
  ART.melancia = {
    r: 54, juice: '#ff2d4a', juice2: '#ff7a8a',
    whole: sprite(54, (c, r) => {
      const rand = rng(11);
      const path = () => { c.beginPath(); c.ellipse(0, 0, r * 1.12, r * 0.94, 0, 0, 7); };
      path();
      c.fillStyle = radial(c, r, [[0, '#8fdc6a'], [0.5, '#3f9a33'], [1, '#1f5c1b']]);
      c.fill();
      c.save(); path(); c.clip();
      // listras irregulares
      for (let i = -4; i <= 4; i++) {
        c.beginPath();
        for (let t = -1.05; t <= 1.05; t += 0.05) {
          const y = t * r * 0.94;
          const w = Math.sqrt(Math.max(0, 1 - t * t));
          const x = i * r * 0.27 * w + Math.sin(t * 5 + i * 2) * r * 0.03 * w;
          t === -1.05 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.strokeStyle = 'rgba(18,64,16,.85)';
        c.lineWidth = r * 0.13 * (0.7 + rand() * 0.6);
        c.lineJoin = 'round';
        c.stroke();
        c.strokeStyle = 'rgba(18,64,16,.2)';
        c.lineWidth = r * 0.2;
        c.stroke();
      }
      c.restore();
      dots(c, path, r, 120, rand, ['rgba(180,240,140,.18)', 'rgba(10,40,10,.15)'], 1.2);
      shade(c, path, r);
    }),
    inside: sprite(54, (c, r) => {
      const rand = rng(12);
      const ell = (k) => { c.beginPath(); c.ellipse(0, 0, r * 1.12 * k, r * 0.94 * k, 0, 0, 7); };
      ell(1); c.fillStyle = '#1f6a1c'; c.fill();
      ell(0.95); c.fillStyle = '#9fd86f'; c.fill();
      ell(0.9); c.fillStyle = '#f2f7d4'; c.fill();
      ell(0.84);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#ff6b76'); g.addColorStop(0.7, '#f2304a'); g.addColorStop(1, '#e8223e');
      c.fillStyle = g; c.fill();
      // fibras da polpa
      c.save(); ell(0.84); c.clip();
      for (let i = 0; i < 70; i++) {
        c.fillStyle = `rgba(255,${180 + rand() * 60},${180 + rand() * 60},${0.15 + rand() * 0.2})`;
        const a = rand() * 6.28, d = rand() * r * 0.8;
        c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 1 + rand() * 2.5, 0.8, a, 0, 7); c.fill();
      }
      c.restore();
      // sementes em gota
      for (const [rr, n, off] of [[0.58, 12, 0], [0.34, 7, 0.4]]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + off;
          const x = Math.cos(a) * r * rr * 1.1, y = Math.sin(a) * r * rr * 0.92;
          c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
          c.fillStyle = '#1b0f0a';
          c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3.6, 1, 0, 4); c.quadraticCurveTo(-3.6, 1, 0, -5); c.fill();
          c.fillStyle = 'rgba(255,255,255,.4)';
          c.beginPath(); c.ellipse(-0.8, -1, 0.8, 1.6, 0, 0, 7); c.fill();
          c.restore();
        }
      }
      c.fillStyle = 'rgba(255,255,255,.2)';
      c.beginPath(); c.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.13, -0.5, 0, 7); c.fill();
    }),
  };

  // ---------- laranja ----------
  ART.laranja = {
    r: 38, juice: '#ff9a1f', juice2: '#ffc56b',
    whole: sprite(38, (c, r) => {
      const rand = rng(21);
      const path = () => { c.beginPath(); c.arc(0, 0, r, 0, 7); };
      path();
      c.fillStyle = radial(c, r, [[0, '#ffd27a'], [0.45, '#ff9a1a'], [1, '#c85a00']]);
      c.fill();
      dots(c, path, r, 420, rand, ['rgba(160,70,0,.22)', 'rgba(255,230,170,.28)', 'rgba(200,90,0,.2)'], 0.9);
      shade(c, path, r);
      // cabinho
      c.fillStyle = '#5a7a22';
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; const rr = i % 2 ? 2.2 : 4.5; c.lineTo(r * 0.12 + Math.cos(a) * rr, -r * 0.82 + Math.sin(a) * rr); }
      c.fill();
      leaf(c, r * 0.15, -r * 0.86, r * 0.75, -0.45);
    }),
    inside: sprite(38, (c, r) => citrusInside(c, r, 1, 1, { skin: '#f08a10', pith: '#fff1d6', flesh: '#ff9418', fleshLight: '#ffcc66', segments: 10 })),
  };

  // ---------- limão ----------
  ART['limão'] = {
    r: 34, juice: '#f2e12a', juice2: '#fff59a',
    whole: sprite(34, (c, r) => {
      const rand = rng(31);
      const path = () => {
        c.beginPath();
        c.moveTo(-r * 1.32, 0);
        c.bezierCurveTo(-r * 1.15, -r * 0.35, -r * 0.8, -r * 0.88, 0, -r * 0.88);
        c.bezierCurveTo(r * 0.8, -r * 0.88, r * 1.15, -r * 0.35, r * 1.32, 0);
        c.bezierCurveTo(r * 1.15, r * 0.35, r * 0.8, r * 0.88, 0, r * 0.88);
        c.bezierCurveTo(-r * 0.8, r * 0.88, -r * 1.15, r * 0.35, -r * 1.32, 0);
      };
      path();
      c.fillStyle = radial(c, r, [[0, '#fffbb0'], [0.45, '#f7e325'], [1, '#c4a300']]);
      c.fill();
      dots(c, path, r * 1.2, 380, rand, ['rgba(150,120,0,.2)', 'rgba(255,255,220,.35)'], 0.8);
      shade(c, path, r);
    }),
    inside: sprite(34, (c, r) => citrusInside(c, r, 1.18, 0.88, { skin: '#e6cf10', pith: '#fdfbe3', flesh: '#f5ea5a', fleshLight: '#fffbc2', segments: 8 })),
  };

  // ---------- maçã ----------
  function applePath(c, r) {
    c.beginPath();
    c.moveTo(0, -r * 0.62);
    c.bezierCurveTo(r * 0.35, -r * 1.02, r * 1.1, -r * 0.95, r * 1.02, -r * 0.1);
    c.bezierCurveTo(r * 0.98, r * 0.55, r * 0.55, r * 1.0, r * 0.22, r * 0.94);
    c.quadraticCurveTo(0, r * 0.86, -r * 0.22, r * 0.94);
    c.bezierCurveTo(-r * 0.55, r * 1.0, -r * 0.98, r * 0.55, -r * 1.02, -r * 0.1);
    c.bezierCurveTo(-r * 1.1, -r * 0.95, -r * 0.35, -r * 1.02, 0, -r * 0.62);
    c.closePath();
  }
  ART['maçã'] = {
    r: 38, juice: '#fff1b8', juice2: '#ffffff',
    whole: sprite(38, (c, r) => {
      const rand = rng(41);
      const path = () => applePath(c, r);
      path();
      c.fillStyle = radial(c, r, [[0, '#ff7a6b'], [0.45, '#e01b2c'], [1, '#7a0712']]);
      c.fill();
      c.save(); path(); c.clip();
      // rubor amarelado e listrinhas
      const b = c.createRadialGradient(-r * 0.5, r * 0.5, 0, -r * 0.5, r * 0.5, r * 0.8);
      b.addColorStop(0, 'rgba(255,210,90,.55)'); b.addColorStop(1, 'rgba(255,210,90,0)');
      c.fillStyle = b; c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      for (let i = 0; i < 26; i++) {
        const x = (rand() - 0.5) * r * 2;
        c.strokeStyle = `rgba(255,${120 + rand() * 80},90,${0.12 + rand() * 0.12})`;
        c.lineWidth = 1 + rand() * 1.5;
        c.beginPath(); c.moveTo(x, -r); c.quadraticCurveTo(x * 1.25, 0, x * 0.85, r); c.stroke();
      }
      c.restore();
      dots(c, path, r, 60, rand, ['rgba(255,230,160,.4)'], 0.6);
      shade(c, path, r);
      // cabinho e folha
      c.strokeStyle = '#5b3a1e'; c.lineWidth = 3.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r * 0.6); c.quadraticCurveTo(-2, -r * 0.95, 4, -r * 1.2); c.stroke();
      leaf(c, 3, -r * 0.92, r * 0.7, -0.35);
    }),
    inside: sprite(38, (c, r) => {
      applePath(c, r); c.fillStyle = '#c8121f'; c.fill();
      c.save(); c.scale(0.92, 0.92); applePath(c, r);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(1, '#f6e2a6');
      c.fillStyle = g; c.fill(); c.restore();
      // miolo em estrela + sementes
      c.strokeStyle = 'rgba(200,170,90,.7)'; c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const a = (i / 10) * 6.28 - 1.57; const rr = i % 2 ? r * 0.12 : r * 0.32; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.05); }
      c.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.28 - 1.57;
        c.save(); c.translate(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2 + r * 0.05); c.rotate(a + 1.57);
        c.fillStyle = '#4a2a12'; c.beginPath(); c.ellipse(0, 0, 2.4, 4.4, 0, 0, 7); c.fill();
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,.25)';
      c.beginPath(); c.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.12, -0.5, 0, 7); c.fill();
    }),
  };

  // ---------- kiwi ----------
  ART.kiwi = {
    r: 33, juice: '#9fd33a', juice2: '#d9f59a',
    whole: sprite(33, (c, r) => {
      const rand = rng(51);
      const path = () => { c.beginPath(); c.ellipse(0, 0, r * 1.15, r * 0.9, 0.2, 0, 7); };
      path();
      c.fillStyle = radial(c, r, [[0, '#c29a62'], [0.5, '#8a6337'], [1, '#4f3519']]);
      c.fill();
      // pelinhos
      c.save(); path(); c.clip();
      for (let i = 0; i < 700; i++) {
        const a = rand() * 6.28, d = Math.sqrt(rand()) * r * 1.15, x = Math.cos(a) * d, y = Math.sin(a) * d;
        const ang = rand() * 6.28, l = 1.5 + rand() * 2.5;
        c.strokeStyle = rand() < 0.5 ? 'rgba(60,40,15,.35)' : 'rgba(220,190,140,.25)';
        c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); c.stroke();
      }
      c.restore();
      shade(c, path, r);
    }),
    inside: sprite(33, (c, r) => {
      const rand = rng(52);
      const ell = (k) => { c.beginPath(); c.ellipse(0, 0, r * 1.15 * k, r * 0.9 * k, 0.2, 0, 7); };
      ell(1); c.fillStyle = '#6b4a24'; c.fill();
      ell(0.94);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#f6f8d0'); g.addColorStop(0.3, '#c8e65a'); g.addColorStop(0.75, '#7cc22e'); g.addColorStop(1, '#5aa21c');
      c.fillStyle = g; c.fill();
      // raios claros
      c.save(); c.rotate(0.2);
      c.strokeStyle = 'rgba(240,255,200,.35)'; c.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * 6.28;
        c.beginPath(); c.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.25); c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.75); c.stroke();
      }
      // sementes pretas
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * 6.28 + rand() * 0.1, d = 0.36 + rand() * 0.08;
        c.save(); c.translate(Math.cos(a) * r * d * 1.15, Math.sin(a) * r * d * 0.9); c.rotate(a);
        c.fillStyle = '#140d06'; c.beginPath(); c.ellipse(0, 0, 2.6, 1.3, 0, 0, 7); c.fill();
        c.restore();
      }
      c.fillStyle = '#fbfde6';
      c.beginPath(); c.ellipse(0, 0, r * 0.2, r * 0.13, 0, 0, 7); c.fill();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.2)';
      c.beginPath(); c.ellipse(-r * 0.35, -r * 0.3, r * 0.3, r * 0.1, -0.4, 0, 7); c.fill();
    }),
  };

  // ---------- morango ----------
  function berryPath(c, r) {
    c.beginPath();
    c.moveTo(0, r * 1.05);
    c.bezierCurveTo(-r * 0.55, r * 0.75, -r * 1.05, r * 0.05, -r * 0.95, -r * 0.45);
    c.bezierCurveTo(-r * 0.85, -r * 0.85, -r * 0.3, -r * 0.82, 0, -r * 0.7);
    c.bezierCurveTo(r * 0.3, -r * 0.82, r * 0.85, -r * 0.85, r * 0.95, -r * 0.45);
    c.bezierCurveTo(r * 1.05, r * 0.05, r * 0.55, r * 0.75, 0, r * 1.05);
    c.closePath();
  }
  ART.morango = {
    r: 34, juice: '#ff2a48', juice2: '#ff8095',
    whole: sprite(34, (c, r) => {
      const path = () => berryPath(c, r);
      path();
      c.fillStyle = radial(c, r, [[0, '#ff6a72'], [0.5, '#e8102e'], [1, '#8a0418']]);
      c.fill();
      // sementinhas
      c.save(); path(); c.clip();
      for (let row = 0; row < 7; row++) {
        for (let k = -4; k <= 4; k++) {
          const y = -r * 0.5 + row * r * 0.24;
          const x = k * r * 0.24 + (row % 2) * r * 0.12;
          c.fillStyle = 'rgba(120,0,15,.45)';
          c.beginPath(); c.ellipse(x, y, 2.6, 3.4, 0, 0, 7); c.fill();
          c.fillStyle = '#ffe36b';
          c.beginPath(); c.ellipse(x, y - 0.4, 1.1, 2, 0, 0, 7); c.fill();
        }
      }
      c.restore();
      shade(c, path, r);
      // folhas do topo
      for (let i = 0; i < 7; i++) leaf(c, 0, -r * 0.7, r * 0.55, -Math.PI / 2 + (i - 3) * 0.42, '#2f8a22');
      c.fillStyle = '#3a7a1e';
      c.beginPath(); c.arc(0, -r * 0.72, 4, 0, 7); c.fill();
    }),
    inside: sprite(34, (c, r) => {
      berryPath(c, r); c.fillStyle = '#d80f2c'; c.fill();
      c.save(); c.scale(0.88, 0.88); berryPath(c, r);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#fff2f2'); g.addColorStop(0.35, '#ff9aa6'); g.addColorStop(1, '#ff3a55');
      c.fillStyle = g; c.fill(); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.28;
        c.beginPath(); c.moveTo(0, r * 0.05); c.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65 + r * 0.05); c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,.25)';
      c.beginPath(); c.ellipse(-r * 0.3, -r * 0.3, r * 0.28, r * 0.1, -0.5, 0, 7); c.fill();
    }),
  };

  // ---------- bomba ----------
  const BOMB = {
    r: 38,
    whole: sprite(38, (c, r) => {
      // brilho vermelho de perigo
      const glow = c.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.35);
      glow.addColorStop(0, 'rgba(255,40,40,.45)'); glow.addColorStop(1, 'rgba(255,40,40,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, 0, r * 1.35, 0, 7); c.fill();
      const path = () => { c.beginPath(); c.arc(0, 0, r, 0, 7); };
      path();
      c.fillStyle = radial(c, r, [[0, '#6b7078'], [0.4, '#2a2d33'], [1, '#08090b']]);
      c.fill();
      shade(c, path, r);
      // tampa metálica
      const mg = c.createLinearGradient(-9, 0, 9, 0);
      mg.addColorStop(0, '#5d6168'); mg.addColorStop(0.5, '#c9ced6'); mg.addColorStop(1, '#4a4e55');
      c.fillStyle = mg;
      c.fillRect(-9, -r - 8, 18, 12);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-9, -r + 1, 18, 3);
      // pavio
      c.strokeStyle = '#c8a26a'; c.lineWidth = 3.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r - 8); c.bezierCurveTo(8, -r - 18, 16, -r - 14, 14, -r - 28); c.stroke();
      c.strokeStyle = 'rgba(90,60,20,.6)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
      // caveira
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(0, -2, r * 0.3, 0, 7); c.fill();
      c.fillRect(-r * 0.18, r * 0.1, r * 0.36, r * 0.18);
      c.fillStyle = '#16181c';
      c.beginPath(); c.arc(-r * 0.12, -3, r * 0.08, 0, 7); c.arc(r * 0.12, -3, r * 0.08, 0, 7); c.fill();
    }),
    fuse: { x: 14, y: -38 - 28 },
  };

  // ---------- respingo de suco (mancha na madeira) ----------
  function splat(r, color, seed) {
    const rand = rng(seed);
    return sprite(r, (c) => {
      c.fillStyle = color;
      c.globalAlpha = 0.9;
      c.beginPath();
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (0.55 + rand() * 0.3);
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.fill();
      for (let i = 0; i < 10; i++) {
        const a = rand() * 6.28, d = r * (0.7 + rand() * 0.55), s = 2 + rand() * r * 0.12;
        c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, 7); c.fill();
        // gotas escorrendo
        c.beginPath(); c.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        c.lineWidth = s * 0.9; c.strokeStyle = color; c.stroke();
      }
      c.globalAlpha = 0.25;
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(-r * 0.15, -r * 0.2, r * 0.25, r * 0.1, -0.5, 0, 7); c.fill();
    });
  }

  window.FruitArt = { ART, BOMB, splat, S };
})();

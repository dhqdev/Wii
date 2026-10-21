// OpenWii — biblioteca da TELA (computador).
// Conecta no servidor, recebe ponteiro/botões dos controles e desenha o cursor.
//
// Uso:
//   const wii = OpenWii.connect({ cursor: 'hand' | 'crosshair' | 'none', onButton(p, btn, down) {} });
//   wii.players  -> Map(id -> jogador) com { id, x, y, vx, vy, roll, buttons, color }
//   wii.rumble(id, ms)
//
// Sem celular conectado, o mouse vira o "jogador 1" (clique = A, botão direito = B,
// Esc = Home, setas = direcional, Enter = A, teclas 1/2).

(function () {
  const COLORS = ['#2aa7ff', '#ff4d5e', '#3ad16b', '#ffb020'];
  const KEYMAP = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
    Enter: 'A', ' ': 'A', b: 'B', B: 'B', Escape: 'HOME', h: 'HOME',
    '1': 'ONE', '2': 'TWO', '-': 'MINUS', '+': 'PLUS', '=': 'PLUS',
  };

  // ---------- sons sintetizados (sem arquivos) ----------
  let actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => {
    audio();
    const b = document.getElementById('wii-sound-hint');
    if (b) b.remove();
  }, { once: false, passive: true }));

  function tone({ type = 'sine', f = 440, f2, dur = 0.12, vol = 0.2, delay = 0 }) {
    const ctx = audio();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise({ dur = 0.2, vol = 0.3, f = 1200, delay = 0 }) {
    const ctx = audio();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filt).connect(g).connect(ctx.destination);
    src.start(t);
  }
  const SFX = {
    hover: () => tone({ f: 1400, dur: 0.04, vol: 0.05 }),
    click: () => { tone({ f: 880, dur: 0.06, vol: 0.12 }); tone({ f: 1320, dur: 0.08, vol: 0.1, delay: 0.05 }); },
    slice: () => noise({ dur: 0.15, vol: 0.25, f: 4000 }),
    splat: () => { noise({ dur: 0.18, vol: 0.3, f: 900 }); tone({ type: 'triangle', f: 300, f2: 120, dur: 0.15, vol: 0.15 }); },
    shoot: () => { noise({ dur: 0.12, vol: 0.45, f: 2500 }); tone({ type: 'square', f: 220, f2: 60, dur: 0.1, vol: 0.12 }); },
    laser: () => tone({ type: 'sawtooth', f: 1500, f2: 200, dur: 0.18, vol: 0.12 }),
    hit: () => { tone({ type: 'triangle', f: 660, dur: 0.08, vol: 0.2 }); tone({ type: 'triangle', f: 990, dur: 0.1, vol: 0.18, delay: 0.06 }); },
    coin: () => { tone({ type: 'square', f: 988, dur: 0.07, vol: 0.08 }); tone({ type: 'square', f: 1319, dur: 0.18, vol: 0.08, delay: 0.07 }); },
    bad: () => tone({ type: 'sawtooth', f: 200, f2: 90, dur: 0.35, vol: 0.15 }),
    boom: () => { noise({ dur: 0.7, vol: 0.6, f: 600 }); tone({ type: 'sine', f: 120, f2: 30, dur: 0.6, vol: 0.4 }); },
    empty: () => tone({ type: 'square', f: 120, dur: 0.05, vol: 0.1 }),
    reload: () => { tone({ type: 'square', f: 400, dur: 0.04, vol: 0.08 }); tone({ type: 'square', f: 600, dur: 0.05, vol: 0.08, delay: 0.12 }); },
    start: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.15, vol: 0.15, delay: i * 0.09 })),
    over: () => [523, 440, 349, 262].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.25, vol: 0.15, delay: i * 0.15 })),
  };

  // ---------- cursores ----------
  const HAND_SVG = (color, n) => `
    <svg viewBox="0 0 48 56" width="48" height="56">
      <path d="M17 4c2.6 0 4 1.9 4 4.2V24l1-.2V18c0-2.2 1.5-3.8 3.6-3.8S29 15.8 29 18v6.2l1-.1v-4.3c0-2.1 1.5-3.7 3.5-3.7s3.5 1.6 3.5 3.7v5.6l1 .1v-2.8c0-2 1.4-3.5 3.3-3.5S45 20.7 45 22.7V36c0 9.6-6.8 17-16.8 17h-2.4c-6.3 0-10.2-2.6-13.5-7.2L3.6 33.5c-1.3-1.8-1-4.1.7-5.3 1.7-1.3 4.1-.9 5.5.8L13 33V8.2C13 5.9 14.4 4 17 4z"
        fill="#fff" stroke="#1d2733" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="31" cy="40" r="8" fill="${color}" stroke="#1d2733" stroke-width="2"/>
      <text x="31" y="44.5" font-family="system-ui,sans-serif" font-size="12" font-weight="800" text-anchor="middle" fill="#fff">${n}</text>
    </svg>`;
  const CROSS_SVG = (color) => `
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="20" fill="none" stroke="#fff" stroke-width="6"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="${color}" stroke-width="3"/>
      <path d="M32 4v16M32 44v16M4 32h16M44 32h16" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <path d="M32 4v16M32 44v16M4 32h16M44 32h16" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    </svg>`;

  const style = document.createElement('style');
  style.textContent = `
    .wii-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:9999;will-change:transform;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));transition:opacity .2s}
    .wii-cursor.hand svg{transform:translate(-14px,-4px)}
    .wii-cursor.crosshair svg{transform:translate(-32px,-32px)}
    .wii-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:rgba(255,255,255,.95);color:#1d2733;
      padding:10px 18px;border-radius:999px;font:600 15px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:10000;
      display:flex;gap:8px;align-items:center;animation:wiiToast 2.6s ease forwards}
    .wii-toast i{width:12px;height:12px;border-radius:50%;display:inline-block}
    @keyframes wiiToast{0%{opacity:0;transform:translate(-50%,-12px)}10%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}
    #wii-sound-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;background:rgba(0,0,0,.55);color:#fff;font:500 12px system-ui;padding:6px 10px;border-radius:8px;z-index:9998}
    html,body,*{cursor:none!important}
  `;
  document.head.appendChild(style);

  function toast(text, color) {
    const el = document.createElement('div');
    el.className = 'wii-toast';
    el.innerHTML = (color ? `<i style="background:${color}"></i>` : '') + text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // ---------- conexão ----------
  function connect(opts = {}) {
    const cursorType = opts.cursor || 'hand';
    const players = new Map();
    const listeners = { button: [], join: [], leave: [] };
    if (opts.onButton) listeners.button.push(opts.onButton);
    if (opts.onJoin) listeners.join.push(opts.onJoin);
    if (opts.onLeave) listeners.leave.push(opts.onLeave);
    let ws = null;
    let controllerUrl = '';
    let realCount = 0;
    let hovered = new Map();

    function makePlayer(id) {
      const p = {
        id, n: id || 1, color: COLORS[((id || 1) - 1) % 4],
        x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2,
        px: innerWidth / 2, py: innerHeight / 2, vx: 0, vy: 0, roll: 0,
        buttons: {}, el: null, visible: true,
      };
      if (cursorType !== 'none') {
        p.el = document.createElement('div');
        p.el.className = 'wii-cursor ' + cursorType;
        p.el.innerHTML = cursorType === 'crosshair' ? CROSS_SVG(p.color) : HAND_SVG(p.color, p.n);
        document.body.appendChild(p.el);
      }
      players.set(id, p);
      return p;
    }
    function removePlayer(id) {
      const p = players.get(id);
      if (!p) return;
      if (p.el) p.el.remove();
      players.delete(id);
    }

    function emitButton(p, btn, down, fromMouse) {
      p.buttons[btn] = down;
      for (const fn of listeners.button) fn(p, btn, down);
      // Com o mouse, o navegador já dispara o clique nativo.
      if (down && btn === 'A' && opts.autoClick !== false && !fromMouse) clickAt(p);
      if (down && btn === 'HOME' && opts.home !== false) {
        SFX.click();
        setTimeout(() => (location.href = '/'), 120);
      }
    }

    // Clica em elementos DOM (botões, cartões) que estiverem sob o ponteiro.
    function clickable(p) {
      const els = document.elementsFromPoint(p.x, p.y);
      return els.find((e) => e.matches && e.matches('[data-wii], button, a')) || null;
    }
    function clickAt(p) {
      const el = clickable(p);
      if (el) { SFX.click(); el.click(); }
    }

    function open() {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?role=screen');
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'state') {
          controllerUrl = m.controllerUrl;
          for (const id of m.players) if (!players.has(id)) makePlayer(id);
          syncMouse();
        } else if (m.t === 'join') {
          if (!players.has(m.id)) makePlayer(m.id);
          toast(`Jogador ${m.id} conectou`, COLORS[m.id - 1]);
          SFX.coin();
          syncMouse();
          listeners.join.forEach((fn) => fn(players.get(m.id)));
        } else if (m.t === 'leave') {
          const p = players.get(m.id);
          if (p) listeners.leave.forEach((fn) => fn(p));
          removePlayer(m.id);
          toast(`Jogador ${m.id} saiu`, COLORS[m.id - 1]);
          syncMouse();
        } else if (m.t === 'p') {
          const p = players.get(m.id) || makePlayer(m.id);
          p.tx = (m.x + 1) / 2 * innerWidth;
          p.ty = (m.y + 1) / 2 * innerHeight;
          p.roll = m.r || 0;
        } else if (m.t === 'b') {
          const p = players.get(m.id) || makePlayer(m.id);
          emitButton(p, m.b, !!m.d);
        }
      };
      ws.onclose = () => setTimeout(open, 1000);
    }
    open();

    // Mouse/teclado só controlam quando não há celular conectado.
    function syncMouse() {
      realCount = [...players.keys()].filter((id) => id > 0).length;
      if (realCount > 0) removePlayer(0);
      else if (!players.has(0)) makePlayer(0);
    }
    syncMouse();
    window.addEventListener('mousemove', (e) => {
      const p = players.get(0);
      if (p) { p.tx = e.clientX; p.ty = e.clientY; }
    });
    window.addEventListener('mousedown', (e) => {
      const p = players.get(0);
      if (!p) return;
      p.tx = p.x = e.clientX; p.ty = p.y = e.clientY;
      emitButton(p, e.button === 2 ? 'B' : 'A', true, true);
    });
    window.addEventListener('mouseup', (e) => {
      const p = players.get(0);
      if (p) emitButton(p, e.button === 2 ? 'B' : 'A', false, true);
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      const btn = KEYMAP[e.key];
      if (!btn || e.repeat) return;
      const p = players.get(0) || players.values().next().value;
      if (p) { e.preventDefault(); emitButton(p, btn, true); }
    });
    window.addEventListener('keyup', (e) => {
      const btn = KEYMAP[e.key];
      const p = players.get(0) || players.values().next().value;
      if (btn && p) emitButton(p, btn, false);
    });

    // Suaviza o ponteiro e atualiza cursores/hover a cada quadro.
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const p of players.values()) {
        const k = p.id === 0 ? 1 : 1 - Math.pow(0.0008, dt); // suavização exponencial
        p.px = p.x; p.py = p.y;
        p.x += (p.tx - p.x) * k;
        p.y += (p.ty - p.y) * k;
        p.vx = (p.x - p.px) / Math.max(dt, 0.001);
        p.vy = (p.y - p.py) / Math.max(dt, 0.001);
        if (p.el) p.el.style.transform = `translate(${p.x}px,${p.y}px)`;
        if (opts.autoClick !== false) {
          const el = clickable(p);
          const prev = hovered.get(p.id);
          if (el !== prev) {
            if (prev) prev.classList.remove('wii-hover');
            if (el) { el.classList.add('wii-hover'); SFX.hover(); }
            hovered.set(p.id, el);
          }
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    if (!document.getElementById('wii-sound-hint')) {
      const hint = document.createElement('div');
      hint.id = 'wii-sound-hint';
      hint.textContent = '🔈 clique na tela para ativar o som';
      document.body.appendChild(hint);
      if (audio() && actx.state === 'running') hint.remove();
    }

    return {
      players,
      sfx: SFX,
      toast,
      colors: COLORS,
      get controllerUrl() { return controllerUrl; },
      on(type, fn) { listeners[type].push(fn); },
      rumble(id, ms = 60) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'rumble', id, ms }));
      },
      setCursorVisible(v) {
        for (const p of players.values()) if (p.el) p.el.style.opacity = v ? 1 : 0;
      },
    };
  }

  window.OpenWii = { connect, sfx: SFX, toast, COLORS };
})();

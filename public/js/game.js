// OpenWii — base comum dos jogos: canvas em tela cheia, HUD, menus e loop.
//
//   const G = OpenWiiGame.create({ cursor: 'crosshair', playCursor: true, onButton(p, btn, down) {} });
//   G.ctx / G.W / G.H / G.wii
//   G.menu({ title, text, primary: 'Jogar', onPrimary })
//   G.loop((dt, t) => { ... })

(function () {
  const css = `
    *{box-sizing:border-box}
    html,body{margin:0;height:100%;overflow:hidden;background:#000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    canvas#game{position:fixed;inset:0;width:100vw;height:100vh;display:block}
    .hud{position:fixed;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:flex-start;padding:18px 26px;pointer-events:none;z-index:5;color:#fff;
      font-weight:800;font-size:28px;text-shadow:0 2px 6px rgba(0,0,0,.45)}
    .hud .sub{font-size:14px;font-weight:600;opacity:.85}
    .menu{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;background:rgba(10,16,24,.45);backdrop-filter:blur(4px)}
    .menu .box{background:#fff;border-radius:28px;padding:34px 44px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.35);max-width:min(560px,90vw);color:#24303c}
    .menu h1{margin:0 0 8px;font-size:40px;letter-spacing:-.02em}
    .menu p{margin:0 0 6px;color:#5b6673;line-height:1.5;font-size:17px}
    .menu .how{margin:16px 0 22px;display:grid;grid-template-columns:auto 1fr;gap:8px 14px;text-align:left;font-size:15px;color:#55606b}
    .menu .how b{background:#eef1f4;border-radius:8px;padding:2px 10px;text-align:center;color:#2b3642}
    .menu .btns{display:flex;gap:12px;justify-content:center;margin-top:18px}
    .menu button{font:800 18px system-ui;padding:14px 30px;border-radius:999px;border:none;background:#eef1f4;color:#2b3642;transition:transform .12s, box-shadow .12s}
    .menu button.primary{background:#2aa7ff;color:#fff;box-shadow:0 8px 20px rgba(42,167,255,.4)}
    .menu button.wii-hover,.menu button:hover{transform:scale(1.08);box-shadow:0 0 0 4px rgba(42,167,255,.35)}
    .menu .big{font-size:64px;font-weight:900;margin:6px 0;color:#2aa7ff}
    .hidden{display:none!important}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function create(opts = {}) {
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = '<div id="hudL"></div><div id="hudC" style="text-align:center"></div><div id="hudR" style="text-align:right"></div>';
    document.body.appendChild(hud);

    const menuEl = document.createElement('div');
    menuEl.className = 'menu hidden';
    document.body.appendChild(menuEl);

    const G = {
      canvas, ctx, W: 0, H: 0, dpr: 1, playing: false, menuOpen: false,
      hudL: hud.querySelector('#hudL'), hudC: hud.querySelector('#hudC'), hudR: hud.querySelector('#hudR'),
    };

    function resize() {
      G.dpr = Math.min(2, window.devicePixelRatio || 1);
      G.W = innerWidth; G.H = innerHeight;
      canvas.width = Math.round(G.W * G.dpr);
      canvas.height = Math.round(G.H * G.dpr);
      ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
      opts.onResize && opts.onResize(G.W, G.H);
    }
    window.addEventListener('resize', resize);
    resize();

    let onPrimary = null;
    G.wii = OpenWii.connect({
      cursor: opts.cursor || 'hand',
      onButton(p, btn, down) {
        if (G.menuOpen) {
          // A em qualquer lugar (fora de um botão) ou "+" inicia.
          const overBtn = document.elementsFromPoint(p.x, p.y).some((e) => e.tagName === 'BUTTON');
          if (down && ((btn === 'A' && !overBtn) || btn === 'PLUS' || btn === 'TWO') && onPrimary) {
            G.wii.sfx.click();
            onPrimary();
          }
          return;
        }
        if (down && btn === 'PLUS' && opts.pausable !== false && G.playing) { G.pause(); return; }
        opts.onButton && opts.onButton(p, btn, down);
      },
      onJoin: opts.onJoin,
      onLeave: opts.onLeave,
    });

    G.menu = function ({ title, text = '', html = '', how = null, primary = 'Jogar', onPrimary: fn }) {
      G.menuOpen = true;
      G.playing = false;
      onPrimary = () => { G.closeMenu(); fn && fn(); };
      const howHtml = how ? `<div class="how">${how.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}</div>` : '';
      menuEl.innerHTML = `<div class="box"><h1>${title}</h1>${text ? `<p>${text}</p>` : ''}${html}${howHtml}
        <div class="btns"><button data-wii class="primary" id="mPrimary">${primary}</button><button data-wii id="mHome">Menu Wii</button></div></div>`;
      menuEl.querySelector('#mPrimary').onclick = () => onPrimary();
      menuEl.querySelector('#mHome').onclick = () => (location.href = '/');
      menuEl.classList.remove('hidden');
      G.wii.setCursorVisible(true);
    };
    G.closeMenu = function () {
      G.menuOpen = false;
      menuEl.classList.add('hidden');
      G.playing = true;
      if (opts.playCursor === false) G.wii.setCursorVisible(false);
    };
    G.pause = function () {
      const resume = () => {};
      G.menu({ title: 'Pausado', text: 'Pressione A para continuar.', primary: 'Continuar', onPrimary: resume });
    };

    G.rumbleAll = (ms) => G.wii.rumble(0, ms);

    G.loop = function (fn) {
      let last = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        fn(dt, now / 1000);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };

    // Lista dos jogadores ativos (inclui o mouse quando não há celular).
    G.players = () => [...G.wii.players.values()];
    return G;
  }

  // utilidades
  const U = {
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // distância de um ponto (px,py) ao segmento (ax,ay)-(bx,by)
    segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    },
    best(key) { try { return Number(localStorage.getItem('openwii.best.' + key)) || 0; } catch { return 0; } },
    saveBest(key, v) { try { if (v > U.best(key)) { localStorage.setItem('openwii.best.' + key, v); return true; } } catch {} return false; },
  };

  window.OpenWiiGame = { create, U };
})();

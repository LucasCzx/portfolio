'use strict';
// sistema.js: o coração do Lucas OS (janelas, menu, terminal, calculadora e jogos).
(() => {
  const I18N = typeof module !== 'undefined' && module.exports ? require('./idiomas.js') : window.I18N;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));

  /* ---------- Idioma: dicionário em idiomas.js; só textContent, nunca HTML ---------- */
  const LOC = { pt: 'pt-BR', en: 'en-US' };
  let lang = 'pt';
  const fmt = (s, a) => s.replace(/\{(\d+)\}/g, (m, i) => (a[i] != null ? a[i] : m));
  const tr = (lg, k, a = []) => { const v = (I18N[lg] || {})[k] ?? I18N.pt[k] ?? k; return Array.isArray(v) ? v.map((x) => fmt(x, a)) : fmt(String(v), a); };
  const t = (k, ...a) => tr(lang, k, a);

  /* ---------- Links: só HTTPS e só os perfis do Lucas ---------- */
  const URLS = { github: 'https://github.com/LucasCzx/', linkedin: 'https://www.linkedin.com/in/lucasczx/' };
  const safeUrl = (u) => {
    try {
      const x = new URL(u);
      return x.protocol === 'https:' && !x.username && !x.password && !x.port &&
        ((x.hostname === 'github.com' && x.pathname.startsWith('/LucasCzx')) ||
         (x.hostname === 'www.linkedin.com' && x.pathname.startsWith('/in/lucasczx')));
    } catch { return false; }
  };

  /* ---------- Terminal: conteúdo 100% estático (textos em idiomas.js) ---------- */
  const CMDS = ['help', 'about', 'whoami', 'projects', 'skills', 'journey', 'github', 'linkedin', 'contact', 'date', 'open projects', 'open about', 'clear', 'exit'];
  const ACT = Object.assign(Object.create(null), {
    'open projects': ['open', 'projects'], 'open about': ['open', 'about'],
    github: ['link', URLS.github], linkedin: ['link', URLS.linkedin], clear: ['clear'], exit: ['exit']
  });
  function run(raw, lg = lang) {
    const c = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (c.length > 40 || !CMDS.includes(c)) return { cmd: c, lines: [tr(lg, 'c.unk')], act: null };
    const lines = c === 'date' ? [new Date().toLocaleString(LOC[lg])] : tr(lg, 'c.' + c, [URLS.github, URLS.linkedin]);
    return { cmd: c, lines, act: ACT[c] || null };
  }

  /* ---------- Calculadora e Jogo da Velha: lógica simples, sem efeitos colaterais ---------- */
  const CALC_OPS = Object.assign(Object.create(null), { add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => (b === 0 ? NaN : a / b) });
  const CALC_KEYS = Object.assign(Object.create(null), { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', Enter: 'eq', '=': 'eq', Backspace: 'back', Delete: 'ac', '%': 'pct', ',': '.', '.': '.' });
  const calcFmt = (n) => (isFinite(n) ? String(+n.toPrecision(12)) : null);
  const calcInit = () => ({ cur: '0', prev: null, op: null, fresh: false, err: false });
  function calcStep(st, k) {
    let s = Object.assign({}, st);
    if (k === 'ac') return calcInit();
    if (s.err) s = calcInit();
    const fail = () => Object.assign(calcInit(), { err: true });
    if (/^[0-9]$/.test(k)) {
      if (s.fresh || s.cur === '0') s.cur = k; else if (s.cur.replace(/[-.]/g, '').length < 12) s.cur += k;
      s.fresh = false;
    } else if (k === '.') {
      if (s.fresh) { s.cur = '0.'; s.fresh = false; } else if (!s.cur.includes('.')) s.cur += '.';
    } else if (k === 'back') {
      if (!s.fresh) s.cur = s.cur.length > 1 && !(s.cur.length === 2 && s.cur[0] === '-') ? s.cur.slice(0, -1) : '0';
    } else if (k === 'sign') {
      if (s.cur !== '0') s.cur = s.cur[0] === '-' ? s.cur.slice(1) : '-' + s.cur;
    } else if (k === 'pct') {
      const v = calcFmt(parseFloat(s.cur) / 100); if (v === null) return fail(); s.cur = v; s.fresh = true;
    } else if (CALC_OPS[k]) {
      if (s.op && !s.fresh) { const v = calcFmt(CALC_OPS[s.op](+s.prev, +s.cur)); if (v === null) return fail(); s.prev = v; s.cur = v; } else if (!s.op) s.prev = s.cur;
      s.op = k; s.fresh = true;
    } else if (k === 'eq') {
      if (s.op && s.prev !== null) { const v = calcFmt(CALC_OPS[s.op](+s.prev, +s.cur)); if (v === null) return fail(); s.cur = v; }
      s.prev = null; s.op = null; s.fresh = true;
    }
    return s;
  }
  const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttCheck(b) {
    for (const [x, y, z] of TTT_LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return { w: b[x], line: [x, y, z] };
    return { w: b.every(Boolean) ? 'd' : null, line: null };
  }
  function tttAi(b, rnd = Math.random) {
    const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const find = (p) => free.find((i) => { const c = b.slice(); c[i] = p; return tttCheck(c).w === p; });
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let m = find('o'); if (m === undefined) m = find('x');
    if (m === undefined && free.includes(4)) m = 4;
    if (m === undefined) { const cs = free.filter((i) => [0, 2, 6, 8].includes(i)); if (cs.length) m = pick(cs); }
    return m === undefined ? pick(free) : m;
  }

  if (typeof document === 'undefined') { module.exports = { run, safeUrl, CMDS, calcInit, calcStep, tttCheck, tttAi }; return; }

  /* ---------- Estado e utilitários ---------- */
  const root = document.documentElement, body = document.body;
  const TB = 48, NS = 'http://www.w3.org/2000/svg', MINW = 300, MINH = 180;
  const APPS = ['about', 'projects', 'skills', 'journey', 'terminal', 'contact', 'settings', 'privacy', 'calc', 'games'];
  const ico = (n) => {
    const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
    s.setAttribute('class', 'ti'); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', '#i-' + n); s.append(u); return s;
  };
  let sound = false, ac, zTop = 10, placed = 0, saidTimer, bootActive = false;
  const wins = Object.create(null);
  const animOn = () => !body.classList.contains('noanim');
  const say = (k) => { const s = $('#say'); s.textContent = t(k); clearTimeout(saidTimer); saidTimer = setTimeout(() => { s.textContent = ''; }, 4500); };
  const beep = (f = 660) => {
    if (!sound) return;
    try { ac = ac || new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); g.gain.value = .03; o.frequency.value = f; o.start(); o.stop(ac.currentTime + .06); } catch { /* sem áudio */ }
  };
  const fx = (w, cls, fn) => { // animação de saída; sem animação executa na hora
    if (!animOn()) { fn(); return; }
    w.classList.add(cls); setTimeout(() => { w.classList.remove(cls); fn(); }, cls === 'closing' ? 140 : 180);
  };
  function rich(n, s) { // **negrito** e `código` viram nós DOM
    const f = document.createDocumentFragment();
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((p) => {
      if (!p) return;
      if (p.startsWith('**')) f.append(el('strong', '', p.slice(2, -2)));
      else if (p[0] === '`') f.append(el('code', '', p.slice(1, -1)));
      else f.append(p);
    });
    n.replaceChildren(f);
  }

  /* ---------- Notificações: avisos temporários + central ---------- */
  const notes = [], nc = $('#nc'), bell = $('#bell');
  const resolve = (a) => a.map((x) => (x && typeof x === 'object' ? t(x.k) : x));
  function renderNC() {
    $('#nlist').replaceChildren(...notes.map((n) => {
      const li = el('li');
      li.append(el('strong', '', t(n.k)), el('span', '', t(n.k + '.b', ...resolve(n.a))), el('time', '', n.d.toLocaleTimeString(LOC[lang], { hour: '2-digit', minute: '2-digit' })));
      return li;
    }));
    $('#nempty').hidden = notes.length > 0;
    const u = notes.filter((n) => !n.read).length, b = $('#nbadge'); b.hidden = !u; b.textContent = u;
  }
  function notify(k, a = [], quiet) {
    const n = { k, a, d: new Date(), read: !nc.hidden };
    notes.unshift(n); notes.length = Math.min(notes.length, 30); renderNC();
    if (!quiet) {
      const d = el('div', 'toast'), box = $('#toasts');
      d.append(el('strong', '', t(k)), el('span', '', t(k + '.b', ...resolve(a))));
      d.addEventListener('click', () => d.remove()); box.append(d);
      while (box.childElementCount > 3) box.firstChild.remove();
      setTimeout(() => d.remove(), 5200); beep(880);
    }
  }
  function setNC(on) {
    nc.hidden = !on; bell.setAttribute('aria-expanded', String(on));
    if (on) { setMenu(false); notes.forEach((n) => { n.read = true; }); renderNC(); }
  }
  bell.addEventListener('click', () => setNC(nc.hidden));
  $('#nclear').addEventListener('click', () => { notes.length = 0; renderNC(); });

  /* ---------- Missões e segredos ---------- */
  const M = ['projects', 'help', 'theme', 'privacy'];
  const done = new Set(), secrets = new Set();
  function drawM() {
    $('#mlist').replaceChildren(...M.map((k) => el('li', done.has(k) ? 'done' : '', t('mis.' + k))));
    $('#mcount').textContent = done.size + '/' + M.length; $('#mp').value = done.size;
    $('#scount').textContent = secrets.size + '/2';
  }
  const mark = (k) => {
    if (done.has(k)) return; done.add(k); drawM();
    done.size === M.length ? notify('n.all') : notify('n.mis', [{ k: 'mis.' + k }]);
  };
  $('#mbtn').addEventListener('click', (e) => {
    const p = $('#missions'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
  });
  const counter = (node, n, key, msg) => {
    let c = 0;
    node.addEventListener('click', () => { if (++c === n && !secrets.has(key)) { secrets.add(key); drawM(); say(msg); notify('n.secret', [secrets.size]); } });
  };
  counter($('#pet'), 5, 'pet', 'say.s1');

  /* ---------- Menu iniciar ---------- */
  const menu = $('#menu'), launch = $('#launch'), ms = $('#msearch');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visItems = () => $$('.mi', menu).filter((b) => !b.parentElement.hidden);
  function setMenu(on, back) {
    if (on === !menu.hidden) return;
    menu.hidden = !on; launch.setAttribute('aria-expanded', String(on));
    if (on) { setNC(false); hideCtx(); ms.value = ''; ms.dispatchEvent(new Event('input')); ms.focus(); } else if (back) launch.focus();
  }
  launch.addEventListener('click', () => setMenu(menu.hidden));
  ms.addEventListener('input', () => {
    const q = norm(ms.value.trim()); let n = 0;
    $$('.mi', menu).forEach((b) => { const s = !q || norm(b.textContent).includes(q); b.parentElement.hidden = !s; n += s; });
    $('#mnone').hidden = n > 0;
  });
  menu.addEventListener('keydown', (e) => {
    const it = [ms, ...visItems()], i = it.indexOf(document.activeElement);
    if (e.key === 'Escape') setMenu(false, true);
    else if (e.key === 'Enter' && document.activeElement === ms) { const f = visItems()[0]; if (f) f.click(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
  });
  $('#mlang').addEventListener('click', () => toggleLang());
  $('#mplain').addEventListener('click', () => { setMenu(false); setPlain(true, true); });
  $('#mrestart').addEventListener('click', () => restart());

  /* ---------- Janelas ---------- */
  const geo = (w, l, tp, wd, h) => { Object.assign(w.style, { left: l + 'px', top: tp + 'px', width: wd + 'px', height: h + 'px', maxHeight: 'none' }); };
  function moveTo(w, x, y) {
    w.style.left = clamp(x, -w.offsetWidth + 80, innerWidth - 80) + 'px';
    w.style.top = clamp(y, 0, Math.max(0, innerHeight - TB - w.offsetHeight)) + 'px';
  }
  const activeApp = () => APPS.find((a) => wins[a].w.classList.contains('on'));
  const isOpen = (a) => wins[a].w.classList.contains('open');
  function focusWin(app) {
    for (const k in wins) { wins[k].w.classList.remove('on'); wins[k].b && wins[k].b.setAttribute('aria-pressed', 'false'); }
    const o = wins[app]; if (!o) return;
    o.w.classList.add('on'); o.w.style.zIndex = ++zTop; o.b && o.b.setAttribute('aria-pressed', 'true');
    o.w.focus({ preventScroll: true });
  }
  function focusTop() { // devolve o foco à janela visível mais alta
    const v = APPS.filter((a) => isOpen(a) && !wins[a].w.classList.contains('min')).sort((a, b) => wins[b].w.style.zIndex - wins[a].w.style.zIndex)[0];
    if (v) focusWin(v); return !!v;
  }
  function makeTb(app) {
    const o = wins[app], b = el('button', 'tb'); b.type = 'button'; b.dataset.app = app; b.setAttribute('aria-pressed', 'false');
    b.append(ico(app), el('span', '', t('app.' + app))); b.title = t('app.' + app); b.setAttribute('aria-label', t('app.' + app));
    b.addEventListener('click', () => {
      if (o.w.classList.contains('min') || !o.w.classList.contains('on')) openWin(app); else minWin(app);
    });
    return b;
  }
  function openWin(app) {
    const o = wins[app]; if (!o) return; const w = o.w;
    setMenu(false); hideCtx(); setNC(false);
    if (root.classList.contains('plain')) { w.scrollIntoView({ block: 'start' }); return; }
    if (w.classList.contains('closing')) return;
    if (!w.classList.contains('open')) {
      w.classList.add('open');
      moveTo(w, 100 + (placed % 6) * 28, 28 + (placed % 6) * 28); placed++;
      o.b = makeTb(app); o.b.lastChild.textContent = t('app.' + app); $('#tbs').append(o.b); beep();
    }
    w.classList.remove('min'); focusWin(app);
    if (app === 'projects') mark('projects');
    if (app === 'privacy') { mark('privacy'); privacyCheck(); }
    if (app === 'terminal') $('#cmd').focus();
  }
  function minWin(app) {
    const o = wins[app], w = o.w; if (!isOpen(app) || w.classList.contains('min') || w.classList.contains('minimizing')) return;
    fx(w, 'minimizing', () => { w.classList.add('min'); w.classList.remove('on'); o.b.setAttribute('aria-pressed', 'false'); focusTop(); });
  }
  function closeWin(app) {
    const o = wins[app], w = o.w; if (!isOpen(app) || w.classList.contains('closing')) return;
    fx(w, 'closing', () => {
      w.classList.remove('open', 'min', 'on', 'max'); if (o.b) { o.b.remove(); o.b = null; }
      if (!focusTop()) { const ic = $('.ic[data-open="' + app + '"]'); if (ic) ic.focus(); }
    });
  }
  const unsnap = (w) => { if (w.dataset.snap && w._r) { const r = w._r; geo(w, r.l, r.t, r.w, r.h); } delete w.dataset.snap; w._r = null; };
  function snap(w, side) {
    if (!w._r) { const r = w.getBoundingClientRect(); w._r = { l: r.left, t: r.top, w: r.width, h: r.height }; }
    const hw = Math.floor(innerWidth / 2); geo(w, side === 'l' ? 0 : hw, 0, hw, innerHeight - TB); w.dataset.snap = side;
  }
  const toggleMax = (w) => { w.classList.toggle('max'); };
  function nextWin() {
    const tbs = $$('.tb'); if (!tbs.length) return;
    const i = tbs.findIndex((b) => b.dataset.app === activeApp()); openWin(tbs[(i + 1) % tbs.length].dataset.app);
  }
  let hid = [];
  function showDesktop() {
    const vis = APPS.filter((a) => isOpen(a) && !wins[a].w.classList.contains('min'));
    if (vis.length) { hid = vis; vis.forEach(minWin); } else { hid.forEach((a) => isOpen(a) && openWin(a)); hid = []; }
  }

  function resizeFrom(w, e, d) {
    e.preventDefault(); e.stopPropagation();
    const r = w.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    try { e.target.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy; let L = r.left, T = r.top, W = r.width, H = r.height;
      if (d.includes('e')) W = clamp(r.width + dx, MINW, innerWidth - L);
      if (d.includes('s')) H = clamp(r.height + dy, MINH, innerHeight - TB - T);
      if (d.includes('w')) { W = clamp(r.width - dx, MINW, r.right); L = r.right - W; }
      if (d.includes('n')) { H = clamp(r.height - dy, MINH, r.bottom); T = r.bottom - H; }
      geo(w, L, T, W, H); delete w.dataset.snap; w._r = null;
    };
    const up = () => { e.target.removeEventListener('pointermove', mv); e.target.removeEventListener('pointerup', up); e.target.removeEventListener('pointercancel', up); w.classList.remove('dragging'); };
    w.classList.add('dragging'); e.target.addEventListener('pointermove', mv); e.target.addEventListener('pointerup', up); e.target.addEventListener('pointercancel', up);
  }
  function dragFrom(w, bar, e) {
    if (e.button || e.target.closest('button') || innerWidth <= 720) return;
    const r = w.getBoundingClientRect(); let dx = e.clientX - r.left, dy = e.clientY - r.top, moved = false;
    const wasMax = w.classList.contains('max'), frac = dx / r.width, sx = e.clientX, sy = e.clientY;
    try { bar.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    const mv = (ev) => {
      if (!moved) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
        moved = true; w.classList.add('dragging');
        if (wasMax) { w.classList.remove('max'); dx = frac * w.offsetWidth; dy = 16; } else if (w.dataset.snap) { unsnap(w); dx = Math.min(dx, w.offsetWidth / 2); }
      }
      moveTo(w, ev.clientX - dx, ev.clientY - dy);
    };
    const up = (ev) => {
      bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); w.classList.remove('dragging');
      if (!moved || ev.type === 'pointercancel') return;
      if (ev.clientY <= 2) toggleMax(w); else if (ev.clientX <= 2) snap(w, 'l'); else if (ev.clientX >= innerWidth - 3) snap(w, 'r');
    };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }

  function winLabels(app) {
    const o = wins[app], title = $('h2', $('.bar', o.w)).textContent;
    [['min', 'w.min'], ['max', 'w.max'], ['close', 'w.close']].forEach(([a, k]) => { $('[data-act="' + a + '"]', o.w).setAttribute('aria-label', t(k) + ' — ' + title); });
    $('.bar', o.w).title = t('w.drag');
    if (o.b) { o.b.lastChild.textContent = t('app.' + app); o.b.title = t('app.' + app); o.b.setAttribute('aria-label', t('app.' + app)); }
  }
  $$('.win').forEach((w) => {
    const app = w.id.slice(2), bar = $('.bar', w);
    wins[app] = { w, b: null };
    const btns = el('span', 'btns');
    [['min', 'min'], ['max', 'max'], ['close', 'x']].forEach(([a, g]) => { const b = el('button'); b.append(ico(g)); b.type = 'button'; b.dataset.act = a; btns.append(b); });
    bar.append(btns);
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((d) => { const h = el('i', 'rz'); h.dataset.d = d; h.addEventListener('pointerdown', (e) => resizeFrom(w, e, d)); w.append(h); });
    btns.addEventListener('click', (e) => {
      const a = e.target.closest('button'); if (!a) return;
      if (a.dataset.act === 'close') closeWin(app); else if (a.dataset.act === 'min') minWin(app); else toggleMax(w);
    });
    w.addEventListener('pointerdown', () => { if (isOpen(app)) focusWin(app); });
    w.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !/^(INPUT|SELECT)$/.test(e.target.tagName)) closeWin(app); });
    bar.tabIndex = 0;
    bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) toggleMax(w); });
    bar.addEventListener('pointerdown', (e) => dragFrom(w, bar, e));
    bar.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
      if (!d || w.classList.contains('max')) return;
      e.preventDefault(); const r = w.getBoundingClientRect();
      if (e.shiftKey) geo(w, r.left, r.top, clamp(r.width + d[0], MINW, innerWidth - r.left), clamp(r.height + d[1], MINH, innerHeight - TB - r.top));
      else moveTo(w, r.left + d[0], r.top + d[1]);
    });
  });
  window.addEventListener('resize', () => {
    hideCtx(); $$('.win.open:not(.max)').forEach((w) => moveTo(w, parseFloat(w.style.left) || 0, parseFloat(w.style.top) || 0));
  });

  /* ---------- Ações por atributo (delegadas) ---------- */
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('[data-open],[data-run],[data-copy],a[href]'); if (!c) return;
    if (c.dataset.open) { openWin(c.dataset.open); return; }
    if (c.dataset.run) { openWin('terminal'); exec(c.dataset.run); return; }
    if (c.hasAttribute('data-copy')) {
      const a = c.parentElement.querySelector('a[href]'), u = a && a.href;
      if (!u || !safeUrl(u)) { notify('n.blocked'); return; }
      Promise.resolve().then(() => navigator.clipboard.writeText(u)).then(() => notify('n.copied', [u]), () => notify('n.copyfail'));
      return;
    }
    if (c.tagName === 'A' && !c.getAttribute('href').startsWith('#') && !safeUrl(c.href)) { e.preventDefault(); notify('n.blocked'); }
  });

  /* ---------- Explorador (Projects) ---------- */
  const showProj = (id) => {
    $$('.explorer article').forEach((a) => a.classList.toggle('sel', a.id === id));
    $$('.files button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.show === id)));
  };
  $$('.files button').forEach((b) => b.addEventListener('click', () => showProj(b.dataset.show)));
  $('.files').addEventListener('keydown', (e) => {
    const bs = $$('.files button'), i = bs.indexOf(document.activeElement), d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!d || i < 0) return; e.preventDefault(); const n = bs[clamp(i + d, 0, bs.length - 1)]; n.focus(); showProj(n.dataset.show);
  });
  showProj('p1');

  /* ---------- Terminal (UI) ---------- */
  const out = $('#out'), input = $('#cmd'), hist = []; let hi = 0;
  const print = (x, c) => { out.append(el('div', c || '', x)); while (out.childElementCount > 200) out.firstChild.remove(); out.scrollTop = out.scrollHeight; };
  function exec(raw) {
    const r = run(raw); print('> ' + String(raw).slice(0, 40), 'in');
    if (r.cmd === 'help') mark('help');
    r.lines.forEach((l) => print(l));
    if (!r.act) return;
    const [k, v] = r.act;
    if (k === 'clear') out.replaceChildren(); else if (k === 'exit') closeWin('terminal'); else if (k === 'open') openWin(v);
    else if (k === 'link' && safeUrl(v)) window.open(v, '_blank', 'noopener,noreferrer');
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; if (v.trim()) { hist.push(v.slice(0, 40)); hist.splice(0, hist.length - 50); } hi = hist.length; exec(v); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); hi = clamp(hi + (e.key === 'ArrowUp' ? -1 : 1), 0, hist.length); input.value = hist[hi] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault(); const p = input.value.trim().toLowerCase(), m = p ? CMDS.filter((c) => c.startsWith(p)) : [];
      if (m.length === 1) input.value = m[0]; else if (m.length) print(m.join('  '));
    }
  });

  /* ---------- Verificação ao vivo (Privacidade) ---------- */
  function privacyCheck() {
    let st = 0, ck = 0, ext = 0, tot = 0;
    try { st = localStorage.length + sessionStorage.length; } catch { st = 0; }
    try { ck = document.cookie ? document.cookie.split(';').length : 0; } catch { ck = 0; }
    try {
      const rs = performance.getEntriesByType('resource').filter((r) => !r.name.startsWith('data:')); tot = rs.length;
      ext = rs.filter((r) => { try { return new URL(r.name).origin !== location.origin; } catch { return false; } }).length;
    } catch { /* sem Performance API */ }
    const mk = (n) => (n ? '✗' : '✓');
    $('#pchk').textContent = t('p.chk', st, ck, ext, tot, mk(st), mk(ck), mk(ext));
  }

  /* ---------- Configurações ---------- */
  const WPS = ['mont', 'dunas', 'relevo', 'none'], FS = [1, 1.12, 1.25];
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pressed = (sel, attr, v) => $$(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(v))));
  const setLight = (on) => { root.classList.toggle('light', on); $('#s-light').checked = on; };
  const setAcc = (a) => { if (a === 'cy') root.dataset.accent = 'cy'; else delete root.dataset.accent; pressed('[data-acc]', 'acc', a === 'cy' ? 'cy' : 'lime'); };
  const setWp = (w) => {
    if (!WPS.includes(w)) return;
    root.classList.toggle('nowall', w === 'none'); if (w !== 'none') $('#wu').setAttribute('href', '#wp-' + w);
    pressed('[data-wp]', 'wp', w); root.dataset.wall = w;
  };
  const setFs = (n) => { root.style.setProperty('--fs', FS[n] || 1); pressed('[data-fs]', 'fs', n); };
  const setAnim = (on) => { body.classList.toggle('noanim', !on); $('#s-anim').checked = on; };
  const setGlass = (on) => { root.classList.toggle('noglass', !on); $('#s-glass').checked = on; };
  const setPet = (on) => { $('#pet').hidden = !on; $('#say').hidden = !on; $('#s-pet').checked = on; };
  const setSound = (on) => { sound = on; $('#s-sound').checked = on; };
  function setPlain(on, notice) {
    root.classList.toggle('plain', on); $('#s-plain').checked = on; $('#plainbtn').setAttribute('aria-pressed', String(on));
    if (on) { hideCtx(); setNC(false); setMenu(false); } if (on && notice) notify('n.plain');
  }
  const nextWall = () => { setWp(WPS[(WPS.indexOf(root.dataset.wall) + 1) % WPS.length]); notify('n.wall', [t('wp.' + root.dataset.wall)]); mark('theme'); };
  const toggleTheme = () => { const on = !root.classList.contains('light'); setLight(on); notify('n.theme', [t(on ? 'th.light' : 'th.dark')]); mark('theme'); };
  const detect = () => (/^pt/i.test(navigator.language || 'pt') ? 'pt' : 'en');
  function setLang(l, notice) {
    if (l !== 'pt' && l !== 'en') return; lang = l; applyLang();
    if (notice) notify('n.lang', [l === 'pt' ? 'Português (BR)' : 'English']);
  }
  const toggleLang = () => setLang(lang === 'pt' ? 'en' : 'pt', true);
  $('#s-light').addEventListener('change', (e) => { setLight(e.target.checked); notify('n.theme', [t(e.target.checked ? 'th.light' : 'th.dark')]); mark('theme'); });
  $('#s-anim').addEventListener('change', (e) => setAnim(e.target.checked));
  $('#s-glass').addEventListener('change', (e) => setGlass(e.target.checked));
  $('#s-pet').addEventListener('change', (e) => setPet(e.target.checked));
  $('#s-sound').addEventListener('change', (e) => { setSound(e.target.checked); beep(); });
  $('#s-plain').addEventListener('change', (e) => setPlain(e.target.checked, true));
  $('#s-lang').addEventListener('change', (e) => setLang(e.target.value, true));
  $('#plainbtn').addEventListener('click', () => setPlain(!root.classList.contains('plain'), true));
  $('#lang').addEventListener('click', toggleLang);
  $('#desk').addEventListener('click', showDesktop);
  $('#s-reset').addEventListener('click', () => {
    setLight(false); setAcc('lime'); setWp('mont'); setFs(0); setAnim(!reduce()); setGlass(true); setPet(true); setSound(false); setPlain(false);
    setLang(detect()); notify('n.reset');
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('[data-acc],[data-wp],[data-fs],[data-lang]'); if (!c) return;
    if (c.dataset.acc) { setAcc(c.dataset.acc); notify('n.acc', [t(c.dataset.acc === 'cy' ? 's.cyan' : 's.lime')]); mark('theme'); }
    else if (c.dataset.wp) { setWp(c.dataset.wp); notify('n.wall', [t('wp.' + c.dataset.wp)]); mark('theme'); }
    else if (c.dataset.fs) setFs(+c.dataset.fs);
    else if (c.dataset.lang) setLang(c.dataset.lang);
  });

  /* ---------- Idioma: aplicar a toda a interface ---------- */
  function applyLang() {
    root.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t('title'); $('meta[name=description]').setAttribute('content', t('desc'));
    $$('[data-i]').forEach((n) => rich(n, t(n.dataset.i)));
    $$('[data-ia]').forEach((n) => { const [a, k] = n.dataset.ia.split(':'); n.setAttribute(a, t(k)); });
    ms.setAttribute('aria-label', t('m.search')); $('#lang').setAttribute('aria-label', t('tb.lang')); $('#lang').title = t('tb.lang');
    $('#lcode').textContent = lang.toUpperCase(); $('#mlcode').textContent = lang === 'pt' ? 'PT-BR' : 'EN'; $('#s-lang').value = lang;
    pressed('.blang button', 'lang', lang);
    for (const k in wins) winLabels(k);
    gamesLabels(); drawM(); renderNC(); privacyCheck(); tick(); if (bootStep) bootStatus();
  }

  /* ---------- Menus de contexto ---------- */
  const ctx = $('#ctx');
  const hideCtx = () => { ctx.hidden = true; };
  function showCtx(x, y, items) {
    ctx.replaceChildren(...items.map(([label, fn, ic]) => {
      const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.append(ico(ic), el('span', '', label));
      b.addEventListener('click', () => { hideCtx(); fn(); }); return b;
    }));
    ctx.hidden = false; const r = ctx.getBoundingClientRect();
    ctx.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px'; ctx.style.top = clamp(y, 4, innerHeight - TB - r.height - 4) + 'px';
    $('button', ctx).focus();
  }
  function ctxItems(target) {
    const tb = target.closest('.tb'), bar = target.closest('.bar'), ic = target.closest('.ic');
    const app = tb ? tb.dataset.app : bar ? bar.parentElement.id.slice(2) : null;
    if (app && wins[app]) {
      const w = wins[app].w, mn = w.classList.contains('min');
      return [[t(mn ? 'ctx.restore' : 'ctx.min'), () => (mn ? openWin(app) : minWin(app)), 'min'], [t('ctx.max'), () => { openWin(app); toggleMax(w); }, 'max'], [t('ctx.close'), () => closeWin(app), 'x']];
    }
    if (ic) return [[t('ctx.open'), () => openWin(ic.dataset.open), ic.dataset.open]];
    return [[t('ctx.term'), () => openWin('terminal'), 'terminal'], [t('ctx.settings'), () => openWin('settings'), 'settings'], [t('ctx.wall'), nextWall, 'desktop'],
      [t('ctx.theme'), toggleTheme, 'settings'], [t('ctx.lang'), toggleLang, 'globe'], [t('ctx.desk'), showDesktop, 'desktop'], [t('ctx.plain'), () => setPlain(true, true), 'page']];
  }
  const ctxTarget = (tg) => !(tg.closest('input,textarea,select,#menu,#nc,#ctx,#missions') || (tg.closest('.win') && !tg.closest('.bar')) || !tg.closest('#desktop,#taskbar'));
  document.addEventListener('contextmenu', (e) => {
    if (bootActive || root.classList.contains('plain') || !e.target.closest || !ctxTarget(e.target)) return;
    e.preventDefault(); showCtx(e.clientX, e.clientY, ctxItems(e.target));
  });
  let lp; // toque longo = botão direito
  document.addEventListener('pointerdown', (e) => {
    if (!menu.contains(e.target) && !launch.contains(e.target)) setMenu(false);
    if (!ctx.contains(e.target)) hideCtx();
    if (!nc.contains(e.target) && !bell.contains(e.target) && !$('#clock').contains(e.target)) setNC(false);
    clearTimeout(lp);
    if (e.pointerType === 'touch' && !bootActive && !root.classList.contains('plain') && e.target.closest && ctxTarget(e.target)) {
      const { clientX: x, clientY: y, target: tg } = e; lp = setTimeout(() => showCtx(x, y, ctxItems(tg)), 550);
    }
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((n) => document.addEventListener(n, (e) => { if (n !== 'pointermove' || e.pointerType === 'touch') clearTimeout(lp); }, { passive: true }));
  ctx.addEventListener('keydown', (e) => {
    const it = $$('button', ctx), i = it.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
  });

  /* ---------- Atalhos de teclado ---------- */
  document.addEventListener('keydown', (e) => {
    if (bootActive) return;
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      const a = document.activeElement, r = a.getBoundingClientRect();
      if (a.closest && ctxTarget(a) && !root.classList.contains('plain')) { e.preventDefault(); showCtx(r.left + 8, r.bottom, ctxItems(a)); }
      return;
    }
    if (e.key === 'Escape') {
      if (!ctx.hidden) hideCtx(); else if (!nc.hidden) setNC(false); else if (!menu.hidden) setMenu(false, true);
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const n = /^Digit([0-9])$/.exec(e.code), a = activeApp(); let ok = true;
    if (n) openWin(APPS[(+n[1] || 10) - 1]); else if (e.code === 'KeyA') setMenu(menu.hidden); else if (e.code === 'KeyN') nextWin();
    else if (e.code === 'KeyW') a && closeWin(a); else if (e.code === 'KeyM') a && minWin(a); else if (e.code === 'KeyX') a && toggleMax(wins[a].w);
    else if (e.code === 'KeyD') showDesktop(); else if (e.code === 'KeyL') toggleLang(); else ok = false;
    if (ok) e.preventDefault();
  });

  /* ---------- Relógio e profundidade ---------- */
  function tick() {
    if (document.hidden) return;
    const n = new Date();
    $('#ct').textContent = n.toLocaleTimeString(LOC[lang], { hour: '2-digit', minute: '2-digit' });
    $('#cd').textContent = n.toLocaleDateString(LOC[lang], { weekday: 'short', day: '2-digit', month: 'short' });
  }
  tick(); setInterval(tick, 15000); document.addEventListener('visibilitychange', tick);
  $('#clock').addEventListener('click', () => setNC(nc.hidden));
  counter($('#clock'), 3, 'clock', 'say.s2');
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || raf || !animOn() || root.classList.contains('plain')) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const s = $('#wall').style;
      s.setProperty('--px', ((e.clientX / innerWidth - .5) * -14).toFixed(1) + 'px'); s.setProperty('--py', ((e.clientY / innerHeight - .5) * -10).toFixed(1) + 'px');
    });
  }, { passive: true });

  /* ---------- Boot ---------- */
  const bootEl = $('#boot'), bbar = $('.bbar', bootEl); let bootStep = 0, bootTimer;
  const bootStatus = () => { $('#bst').textContent = t('b.' + Math.max(1, bootStep)); };
  function boot(then) {
    const fast = !animOn(), N = 5, gap = fast ? 90 : 420; bootStep = 0; bootActive = true;
    root.classList.add('booting'); bootEl.classList.remove('out'); bootEl.hidden = false;
    $('#desktop').inert = true; $('#taskbar').inert = true; bbar.firstElementChild.style.width = '0%';
    const end = () => {
      if (!bootActive) return; bootActive = false; clearTimeout(bootTimer);
      document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true);
      root.classList.remove('booting'); $('#desktop').inert = false; $('#taskbar').inert = false;
      if (animOn()) { bootEl.classList.add('out'); setTimeout(() => { bootEl.hidden = true; }, 450); } else bootEl.hidden = true;
      then();
    };
    const step = () => {
      bootStep++; const p = bootStep / N * 100; bbar.firstElementChild.style.width = p + '%'; bbar.setAttribute('aria-valuenow', Math.round(p)); bootStatus();
      bootTimer = setTimeout(bootStep < N ? step : end, bootStep < N ? gap : (fast ? 60 : 450));
    };
    function skip(e) {
      if (e.target.closest && e.target.closest('.blang')) return;
      if (e.type === 'keydown' && ['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      end();
    }
    document.addEventListener('pointerdown', skip, true); document.addEventListener('keydown', skip, true);
    bootTimer = setTimeout(step, fast ? 40 : 250); bootEl.focus();
  }
  const afterBoot = () => {
    openWin('about'); say('say.hi'); notify('n.welcome'); notify('n.tip', [], true);
  };
  function restart() {
    setMenu(false); hideCtx(); setNC(false); hid = [];
    APPS.forEach((a) => { const w = wins[a].w; w.classList.remove('open', 'min', 'on', 'max', 'closing', 'minimizing'); if (wins[a].b) { wins[a].b.remove(); wins[a].b = null; } });
    out.replaceChildren(); print(t('te.hello')); boot(afterBoot);
  }

  /* ---------- Calculadora ---------- */
  let cs = calcInit();
  const CSYM = { add: '+', sub: '−', mul: '×', div: '÷' };
  const dec = (x) => (lang === 'pt' ? x.replace('.', ',') : x);
  function calcDraw() {
    $('#cdisp').textContent = cs.err ? t('calc.err') : dec(cs.cur);
    $('#cexp').textContent = cs.op && cs.prev !== null ? dec(cs.prev) + ' ' + CSYM[cs.op] : '';
  }
  const calcKey = (k) => { cs = calcStep(cs, k); calcDraw(); };
  $('#ckeys').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) calcKey(b.dataset.k); });
  $('#w-calc').addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const k = /^[0-9]$/.test(e.key) ? e.key : CALC_KEYS[e.key];
    if (k) { e.preventDefault(); calcKey(k); }
  });

  /* ---------- Jogos ---------- */
  let tb = Array(9).fill(''), tdone = null, tline = [], tpend = false, tTimer = 0;
  const tcells = [...Array(9)].map((_, i) => { const b = el('button'); b.type = 'button'; b.addEventListener('click', () => tttPlay(i)); return b; });
  $('#tttb').append(...tcells);
  function tttDraw() {
    tb.forEach((v, i) => {
      const b = tcells[i]; b.textContent = v.toUpperCase(); b.className = v + (tline.includes(i) ? ' w' : ''); b.disabled = !!v || !!tdone || tpend;
      b.setAttribute('aria-label', t('g.cell', Math.floor(i / 3) + 1, (i % 3) + 1, v ? v.toUpperCase() : t('g.empty')));
    });
    $('#ttts').textContent = t(tdone ? { x: 'g.win', o: 'g.lose', d: 'g.draw' }[tdone] : 'g.turn');
  }
  const tttEnd = () => { const r = tttCheck(tb); tdone = r.w; tline = r.line || []; };
  function tttPlay(i) {
    if (tb[i] || tdone || tpend) return;
    tb[i] = 'x'; tttEnd();
    if (!tdone) { tpend = true; tTimer = setTimeout(() => { tpend = false; tb[tttAi(tb)] = 'o'; tttEnd(); tttDraw(); }, 350); }
    tttDraw();
  }
  function tttNew() { clearTimeout(tTimer); tb = Array(9).fill(''); tdone = null; tline = []; tpend = false; tttDraw(); }
  $('#tttr').addEventListener('click', tttNew);

  const MSYM = ['●', '▲', '■', '◆', '★', '✚'];
  let mopen = [], mmoves = 0, mpairs = 0, mlock = false, mTimer = 0;
  function memDraw() {
    $$('#memb button').forEach((b, i) => b.setAttribute('aria-label', t('g.card', i + 1, b.classList.contains('up') || b.classList.contains('ok') ? b.dataset.s : t('g.down'))));
    $('#mems').textContent = mpairs === 6 ? t('g.mwin', mmoves) : t('g.mstat', mmoves, mpairs);
  }
  function memFlip(b) {
    if (mlock || b.classList.contains('up') || b.classList.contains('ok')) return;
    b.classList.add('up'); b.textContent = b.dataset.s; mopen.push(b);
    if (mopen.length === 2) {
      mmoves++; const [x, y] = mopen;
      if (x.dataset.s === y.dataset.s) { [x, y].forEach((c) => { c.classList.remove('up'); c.classList.add('ok'); c.disabled = true; }); mpairs++; mopen = []; }
      else { mlock = true; mTimer = setTimeout(() => { [x, y].forEach((c) => { c.classList.remove('up'); c.textContent = ''; }); mopen = []; mlock = false; memDraw(); }, 800); }
    }
    memDraw();
  }
  function memNew() {
    clearTimeout(mTimer); mlock = false; mopen = []; mmoves = 0; mpairs = 0;
    const a = [...MSYM, ...MSYM];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    $('#memb').replaceChildren(...a.map((s) => { const b = el('button'); b.type = 'button'; b.dataset.s = s; b.addEventListener('click', () => memFlip(b)); return b; }));
    memDraw();
  }
  $('#memr').addEventListener('click', memNew);
  $$('[data-g]').forEach((b) => b.addEventListener('click', () => {
    pressed('[data-g]', 'g', b.dataset.g); $('#g-ttt').hidden = b.dataset.g !== 'ttt'; $('#g-mem').hidden = b.dataset.g !== 'mem';
  }));
  const gamesLabels = () => { calcDraw(); tttDraw(); memDraw(); };

  /* ---------- Início ---------- */
  lang = detect(); memNew();
  $('#plainbtn').hidden = false;
  setPlain(false); setWp('mont'); setAcc('lime'); setFs(0);
  if (reduce()) setAnim(false);
  applyLang(); print(t('te.hello'));
  boot(afterBoot);
})();

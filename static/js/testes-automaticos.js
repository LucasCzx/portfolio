// Uso: npm i jsdom && node testes/testes-automaticos.js   (lógica, segurança, i18n e DOM; geometria e CSP ficam em testes/teste-no-navegador.py)
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM } = require('jsdom');
const pub = path.join(__dirname, '..', 'public');
const rd = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const html = rd('index.html'), js = rd('js/sistema.js'), i18nSrc = rd('js/idiomas.js'), early = rd('js/preparacao-inicial.js'), css = rd('css/estilo.css');
const I18N = require(path.join(pub, 'js/idiomas.js'));
const tests = []; const t = (n, f) => tests.push([n, f]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- análise estática ----
const allJs = js + i18nSrc + early;
t('sem eval/Function/innerHTML/document.write/outerHTML/insertAdjacentHTML (script, i18n, early)', () =>
  assert(!/\b(eval|Function)\s*\(|new Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(allJs)));
t('sem escrita em storage/cookies e sem fetch/XHR/WebSocket/sendBeacon', () =>
  assert(!/\.setItem\(|indexedDB|document\.cookie\s*=[^=]|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|setAttribute\(\s*['"]style/.test(allJs)));
t('sem scripts/estilos inline, handlers on*, nem URLs externas de recursos', () => {
  assert(!/<script(?![^>]*src=)/i.test(html) && !/<style/i.test(html) && !/\sstyle=/i.test(html) && !/\son[a-z]+=/i.test(html));
  assert(!/(src|href)="https?:\/\/[^"]*"(?![^>]*target="_blank")/i.test(html.replace(/<a [^>]*target="_blank"[^>]*>/g, '')));
  assert(!/@import|url\(\s*['"]?https?:/i.test(css));
  [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].forEach((m) => assert(/^js\/[\w.-]+\.js$/.test(m[1]), m[1]));
});
t('links externos têm rel=noopener noreferrer', () => {
  const links = html.match(/<a [^>]*target="_blank"[^>]*>/g) || [];
  assert(links.length >= 5 && links.every((l) => /rel="noopener noreferrer"/.test(l)));
});
t('CSP presente no HTML', () => assert(/Content-Security-Policy/.test(html) && /script-src 'self'/.test(html) && /connect-src 'none'/.test(html)));

// ---- idiomas: cobertura completa ----
t('i18n: PT e EN têm exatamente as mesmas chaves', () => {
  const a = Object.keys(I18N.pt).sort(), b = Object.keys(I18N.en).sort();
  assert.deepStrictEqual(a.filter((k) => !b.includes(k)), [], 'faltam no EN'); assert.deepStrictEqual(b.filter((k) => !a.includes(k)), [], 'faltam no PT');
});
t('i18n: toda chave usada no HTML e no script existe nos dois idiomas', () => {
  const keys = new Set([...html.matchAll(/data-i="([^"]+)"/g)].map((m) => m[1]));
  [...html.matchAll(/data-ia="[^:"]+:([^"]+)"/g)].forEach((m) => keys.add(m[1]));
  [...js.matchAll(/\b(?:t|say)\('([\w.]+)'/g)].forEach((m) => !m[1].endsWith('.') && keys.add(m[1]));
  [...js.matchAll(/notify\('([\w.]+)'/g)].forEach((m) => { keys.add(m[1]); keys.add(m[1] + '.b'); });
  ['about', 'projects', 'skills', 'journey', 'terminal', 'contact', 'settings', 'privacy'].forEach((a) => { keys.add('app.' + a); keys.add('d.' + a); });
  ['projects', 'help', 'theme', 'privacy'].forEach((k) => keys.add('mis.' + k)); ['mont', 'dunas', 'relevo', 'none'].forEach((k) => keys.add('wp.' + k));
  require(path.join(pub, 'js/sistema.js')).CMDS.filter((c) => c !== 'date').forEach((c) => keys.add('c.' + c));
  assert(keys.size > 150, 'só ' + keys.size);
  keys.forEach((k) => ['pt', 'en'].forEach((l) => assert(k in I18N[l], l + ': ' + k)));
});
t('i18n: textos longos em EN não são cópia do PT', () => {
  Object.keys(I18N.pt).forEach((k) => { const p = I18N.pt[k], e = I18N.en[k];
    if (typeof p === 'string' && p.length > 25) assert(p !== e, 'sem tradução: ' + k); });
});

// ---- funções puras ----
const { run, safeUrl, CMDS } = require(path.join(pub, 'js/sistema.js'));
t('terminal: todos os comandos permitidos respondem em PT e EN', () => {
  CMDS.forEach((c) => ['pt', 'en'].forEach((l) => assert(!/não reconhecido|Unknown command/.test(run(c, l).lines.join()), c + ' ' + l)));
  assert(/Commands:/.test(run('help', 'en').lines[0]) && /Comandos:/.test(run('help', 'pt').lines[0]));
});
t('terminal: comandos perigosos e entradas hostis são rejeitados', () => {
  ['ls', 'rm -rf /', 'cat /etc/passwd', 'curl http://x.com', 'eval(1)', 'constructor', '__proto__', 'toString', 'hasOwnProperty',
   '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', 'help; ls', 'help && whoami', 'A'.repeat(5000), '', '   ', 'open http://evil.com', 'open  projects ; x']
    .forEach((c) => ['pt', 'en'].forEach((l) => { const r = run(c, l); assert(/não reconhecido|Unknown command/.test(r.lines.join()) && r.act === null, JSON.stringify(c.slice(0, 20))); }));
});
t('terminal: ignora maiúsculas e espaços extras em comandos válidos', () => assert(run('  OPEN   Projects ').act[1] === 'projects'));
t('URLs: aceita apenas os perfis HTTPS autorizados', () => {
  ['https://github.com/LucasCzx/', 'https://github.com/LucasCzx/Gerador-de-senha', 'https://www.linkedin.com/in/lucasczx/'].forEach((u) => assert(safeUrl(u), u));
  ['javascript:alert(1)', 'data:text/html,x', 'http://github.com/LucasCzx/', 'https://github.com.evil.com/LucasCzx/', 'https://evil.com/LucasCzx',
   'https://user@github.com/LucasCzx/', 'https://github.com:8443/LucasCzx/', 'https://github.com/OutraPessoa', 'vbscript:x', '//evil.com', '', 'https://linkedin.com/in/lucasczx/']
    .forEach((u) => assert(!safeUrl(u), u));
});

// ---- DOM real (jsdom) ----
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://lucas-os.onrender.com/' });
const { window } = dom; const d = window.document;
Object.defineProperty(window.navigator, 'language', { value: 'pt-BR', configurable: true });
window.matchMedia = window.matchMedia || (() => ({ matches: false }));
window.Element.prototype.scrollIntoView = function () { this.dataset.scrolled = '1'; };
window.eval(early); window.eval(i18nSrc); window.eval(js);
const $ = (s, r = d) => r.querySelector(s), $$ = (s) => [...d.querySelectorAll(s)];
const ev = (n, type, init = {}) => { const e = new window.MouseEvent(type, { bubbles: true, cancelable: true, ...init }); n.dispatchEvent(e); return e; };
const click = (n) => ev(n, 'click');
const key = (n, k, init = {}) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); n.dispatchEvent(e); return e; };
const alt = (code) => key(d.body, code, { code, altKey: true });
const type = (v) => { const i = $('#cmd'); i.value = v; key(i, 'Enter'); };
const setChk = (sel, v) => { const n = $(sel); n.checked = v; n.dispatchEvent(new window.Event('change', { bubbles: true })); };
const plainText = (s) => s.replace(/\*\*|`/g, '');
const root = d.documentElement;

t('boot: aparece com logotipo, progresso e status; idioma detectado (PT)', async () => {
  assert(!$('#boot').hidden && root.classList.contains('booting') && $('#boot .blogo'));
  await sleep(330); assert($('#bst').textContent === I18N.pt['b.1'], $('#bst').textContent);
  assert(parseFloat($('.bbar i').style.width) > 0 && +$('.bbar').getAttribute('aria-valuenow') > 0);
  assert(root.lang === 'pt-BR' && d.title === I18N.pt.title);
});
t('boot: troca de idioma no próprio boot e pula com qualquer tecla', async () => {
  click($('.blang [data-lang="en"]')); assert(root.lang === 'en' && $('#bst').textContent === I18N.en['b.1'] && !$('#boot').classList.contains('out'));
  click($('.blang [data-lang="pt"]')); assert(root.lang === 'pt-BR');
  d.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert(!root.classList.contains('booting') && $('#boot').classList.contains('out'));
  assert($('#w-about').classList.contains('open') && !root.classList.contains('plain'));
  await sleep(500); assert($('#boot').hidden);
});
t('notificações: boas-vindas em aviso e central; selo de não lidas; abrir marca como lidas', () => {
  assert($$('.toast').length === 1 && $('#nbadge').textContent === '2' && !$('#nbadge').hidden);
  click($('#bell')); assert(!$('#nc').hidden && $('#nbadge').hidden && $$('#nlist li').length === 2 && $('#nempty').hidden);
  assert($('#nlist').textContent.includes(I18N.pt['n.welcome']));
  click($('#nclear')); assert($$('#nlist li').length === 0 && !$('#nempty').hidden);
  key(d.body, 'Escape'); assert($('#nc').hidden);
});
t('janelas: animação de fechar e de abrir', async () => {
  click($('[data-open="skills"]')); const w = $('#w-skills');
  assert(w.classList.contains('open') && $$('.tb').length === 2);
  click(w.querySelector('[data-act="close"]')); assert(w.classList.contains('closing') && w.classList.contains('open'));
  await sleep(220); assert(!w.classList.contains('open') && !w.classList.contains('closing') && $$('.tb').length === 1);
});
t('configurações: desligar animações torna abrir/fechar imediato', () => {
  setChk('#s-anim', false); assert(d.body.classList.contains('noanim'));
  click($('[data-open="skills"]')); const w = $('#w-skills');
  click(w.querySelector('[data-act="min"]')); assert(w.classList.contains('min') && !w.classList.contains('on'));
  click($$('.tb')[1]); assert(!w.classList.contains('min') && w.classList.contains('on'));
  click(w.querySelector('[data-act="max"]')); assert(w.classList.contains('max'));
  click(w.querySelector('[data-act="close"]')); assert(!w.classList.contains('open') && $$('.tb').length === 1);
});
t('janelas: duplo clique maximiza; Esc fecha; foco volta à janela de baixo', () => {
  click($('[data-open="contact"]')); const w = $('#w-contact');
  ev($('.bar', w), 'dblclick'); assert(w.classList.contains('max')); ev($('.bar', w), 'dblclick'); assert(!w.classList.contains('max'));
  key(w, 'Escape'); assert(!w.classList.contains('open') && $('#w-about').classList.contains('on'));
});
t('janelas: cada uma tem 8 alças de redimensionar e botões nomeados', () => {
  $$('.win').forEach((w) => { assert(w.querySelectorAll('.rz').length === 8); w.querySelectorAll('.btns button').forEach((b) => assert(b.getAttribute('aria-label').length > 4)); });
});
t('terminal (DOM): XSS vira texto e não cria elementos', () => {
  click($('[data-open="terminal"]')); const before = d.querySelectorAll('*').length;
  type('<img src=x onerror=alert(1)>'); type('<script>window.pwned=1</script>');
  assert(!window.pwned && !$('#out img') && !$('#out script'));
  assert(d.querySelectorAll('*').length === before + 4);
  assert($('#out').textContent.includes('<img src=x'));
});
t('terminal (DOM): help conclui missão com notificação; clear limpa; exit fecha; open abre', () => {
  type('help'); assert($$('#mlist li.done').length === 1 && $('#nlist').textContent.includes(I18N.pt['mis.help']));
  type('open about'); assert($('#w-about').classList.contains('open'));
  type('clear'); assert($('#out').childElementCount === 0);
  type('exit'); assert(!$('#w-terminal').classList.contains('open'));
});
t('terminal (DOM): histórico (↑↓), Tab completa e limite de 200 linhas', () => {
  click($('[data-open="terminal"]')); type('whoami'); type('skills'); key($('#cmd'), 'ArrowUp'); assert($('#cmd').value === 'skills');
  key($('#cmd'), 'ArrowUp'); assert($('#cmd').value === 'whoami'); key($('#cmd'), 'ArrowDown'); key($('#cmd'), 'ArrowDown'); assert($('#cmd').value === '');
  $('#cmd').value = 'jour'; key($('#cmd'), 'Tab'); assert($('#cmd').value === 'journey'); $('#cmd').value = '';
  for (let i = 0; i < 300; i++) type('whoami'); assert($('#out').childElementCount <= 200);
});
t('botões dos apps: abrir app, rodar no terminal e copiar link (sem área de transferência → aviso)', async () => {
  click($('#w-about [data-open="projects"]')); assert($('#w-projects').classList.contains('open'));
  type('clear'); click($('#w-skills [data-run="skills"]')); assert($('#w-terminal').classList.contains('open') && $('#out').textContent.includes('Python'));
  const n0 = $$('#nlist li').length; click($('#p1 [data-copy]')); await sleep(20);
  assert($$('#nlist li').length === n0 + 1 && $('#nlist').textContent.includes(I18N.pt['n.copyfail']));
});
t('botões dos apps: copiar link funciona quando há área de transferência', async () => {
  let got = ''; Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async (x) => { got = x; } }, configurable: true });
  click($('#w-contact [data-copy]')); await sleep(20);
  assert(got === 'https://www.linkedin.com/in/lucasczx/' && $('#nlist').textContent.includes(I18N.pt['n.copied']));
});
t('links: navegação para URL não autorizada é bloqueada com aviso', () => {
  const a = d.createElement('a'); a.href = 'https://evil.com/x'; d.body.append(a);
  assert(ev(a, 'click').defaultPrevented && $('#nlist').textContent.includes(I18N.pt['n.blocked']));
  assert(!ev($('#w-contact a'), 'click').defaultPrevented);
});
t('explorador: alterna por clique e por setas', () => {
  click($('[data-show="p2"]')); assert($('#p2').classList.contains('sel') && !$('#p1').classList.contains('sel'));
  $('[data-show="p2"]').focus(); key($('[data-show="p2"]'), 'ArrowDown'); assert($('#p3').classList.contains('sel'));
});
t('verificação ao vivo de privacidade: tudo zerado e marcado', () => {
  click($('[data-open="privacy"]')); const x = $('#pchk').textContent;
  assert((x.match(/✓/g) || []).length === 3 && !/✗/.test(x) && /: 0/.test(x), x);
});
t('menu iniciar: busca ignora acentos, mostra vazio, Enter abre, Esc fecha', () => {
  click($('#launch')); const m = $('#menu'); assert(!m.hidden && d.activeElement === $('#msearch'));
  const vis = () => $$('.mi').filter((b) => !b.parentElement.hidden).map((b) => b.dataset.open);
  $('#msearch').value = 'configuracoes'; $('#msearch').dispatchEvent(new window.Event('input')); assert.deepStrictEqual(vis(), ['settings']);
  $('#msearch').value = 'zzz'; $('#msearch').dispatchEvent(new window.Event('input')); assert(vis().length === 0 && !$('#mnone').hidden);
  $('#msearch').value = 'jorn'; $('#msearch').dispatchEvent(new window.Event('input')); key($('#msearch'), 'Enter');
  assert(m.hidden && $('#w-journey').classList.contains('open'));
  click($('#launch')); key($('#msearch'), 'ArrowDown'); assert(d.activeElement === $$('.mi')[0]); key(d.activeElement, 'Escape'); assert(m.hidden && d.activeElement === $('#launch'));
});
t('menu de contexto: desktop, barra de título e taskbar; ignora texto das janelas', () => {
  let e = ev($('#desktop'), 'contextmenu'); assert(e.defaultPrevented && !$('#ctx').hidden && $$('#ctx button').length === 7);
  key($('#ctx button'), 'ArrowDown'); assert(d.activeElement === $$('#ctx button')[1]);
  key(d.body, 'Escape'); assert($('#ctx').hidden);
  e = ev($('#w-about .bar'), 'contextmenu'); assert(e.defaultPrevented && $$('#ctx button').length === 3);
  e = ev($('.tb'), 'contextmenu'); assert(e.defaultPrevented && $$('#ctx button').length === 3);
  e = ev($('#w-about .body'), 'contextmenu'); assert(!e.defaultPrevented);
  ev($('.ic'), 'contextmenu'); assert($$('#ctx button').length === 1); ev($('#desktop'), 'pointerdown'); assert($('#ctx').hidden);
  ev($('#desktop'), 'contextmenu'); click($$('#ctx button')[2]); assert($('#ctx').hidden && root.dataset.wall === 'dunas');
});
t('atalhos: Alt+1…8, A, N, M, X, W, D e L (e Alt sem combinação não age)', () => {
  assert(alt('Digit5').defaultPrevented && $('#w-terminal').classList.contains('on'));
  assert(alt('KeyA').defaultPrevented && !$('#menu').hidden); alt('KeyA'); assert($('#menu').hidden);
  alt('KeyX'); assert($('#w-terminal').classList.contains('max')); alt('KeyX'); assert(!$('#w-terminal').classList.contains('max'));
  alt('KeyM'); assert($('#w-terminal').classList.contains('min'));
  const open = $$('.win.open:not(.min)').length; alt('KeyD'); assert($$('.win.open:not(.min)').length === 0 && open > 0);
  alt('KeyD'); assert($$('.win.open:not(.min)').length === open);
  const a = $('.win.on').id; alt('KeyN'); assert($('.win.on').id !== a); const c = $$('.win.open').length; alt('KeyW'); assert($$('.win.open').length === c - 1);
  assert(!alt('KeyQ').defaultPrevented);
});
t('idioma EN: toda a interface muda (títulos, apps, menus, configurações, taskbar, terminal)', () => {
  alt('KeyL'); assert(root.lang === 'en' && d.title === I18N.en.title && $('#lcode').textContent === 'EN' && $('#s-lang').value === 'en');
  $$('[data-i]').forEach((n) => assert(n.textContent === plainText(I18N.en[n.dataset.i]), n.dataset.i + ': ' + n.textContent));
  $$('[data-ia]').forEach((n) => { const [a, k] = n.dataset.ia.split(':'); assert(n.getAttribute(a) === I18N.en[k], k); });
  $$('.tb').forEach((b) => assert(b.getAttribute('aria-label') === I18N.en['app.' + b.dataset.app]));
  assert($('#w-about .btns [data-act="close"]').getAttribute('aria-label').startsWith('Close'));
  assert($('#mlist').textContent.includes(I18N.en['mis.help']) && $('#nlist').textContent.includes(I18N.en['n.lang']));
  assert(!/[ãõçé]/.test($('#w-settings').textContent.replace(/MédioTech/g, '')), 'sobrou português nas configurações');
  type('help'); assert($('#out').lastChild.textContent.includes('skills, journey') && $$('#out div').some((x) => x.textContent.startsWith('Commands')));
  assert($('#a\\.p1, [data-i="a.p1"] strong').textContent === 'Lucas Carlos' && !$('[data-i="a.p1"]').textContent.includes('**'));
});
t('idioma: troca pelo seletor das configurações, pelo botão da barra, pelo menu e proteção contra valor inválido', () => {
  const sel = $('#s-lang'); sel.value = 'pt'; sel.dispatchEvent(new window.Event('change')); assert(root.lang === 'pt-BR' && $('#t-about').textContent === I18N.pt['app.about']);
  click($('#lang')); assert(root.lang === 'en'); click($('#launch')); click($('#mlang')); assert(root.lang === 'pt-BR');
  const b = d.createElement('button'); b.dataset.lang = '__proto__'; d.body.append(b); click(b); b.remove(); assert(root.lang === 'pt-BR');
});
t('configurações: tema, acento, papel de parede, texto, vidro, personagem, som e reset', () => {
  setChk('#s-light', true); assert(root.classList.contains('light'));
  click($('[data-acc="cy"]')); assert(root.dataset.accent === 'cy' && $('[data-acc="cy"]').getAttribute('aria-pressed') === 'true' && $('[data-acc="lime"]').getAttribute('aria-pressed') === 'false');
  click($('[data-wp="relevo"]')); assert($('#wu').getAttribute('href') === '#wp-relevo' && $('[data-wp="relevo"]').getAttribute('aria-pressed') === 'true');
  click($('[data-wp="none"]')); assert(root.classList.contains('nowall'));
  click($('[data-fs="2"]')); assert(root.style.getPropertyValue('--fs') === '1.25');
  setChk('#s-glass', false); assert(root.classList.contains('noglass')); setChk('#s-pet', false); assert($('#pet').hidden && $('#say').hidden);
  setChk('#s-sound', true);
  click($('#s-reset'));
  assert(!root.classList.contains('light') && !root.dataset.accent && root.dataset.wall === 'mont' && !root.classList.contains('nowall') && root.style.getPropertyValue('--fs') === '1'
    && !root.classList.contains('noglass') && !$('#pet').hidden && $('#s-anim').checked && !$('#s-sound').checked && root.lang === 'pt-BR');
  assert(!/(\d+)\s*\/\s*4/.test('') && $('#nlist').textContent.includes(I18N.pt['n.reset']));
});
t('missões e segredos: concluir tudo gera notificação final; segredos contam uma vez', () => {
  click($('#pet')); for (let i = 0; i < 4; i++) click($('#pet')); for (let i = 0; i < 3; i++) click($('#clock'));
  assert($('#scount').textContent === '2/2');
  click($('[data-open="projects"]')); setChk('#s-light', true); setChk('#s-light', false);
  assert($('#mcount').textContent === '4/4' && $('#mp').value === 4 && $('#nlist').textContent.includes(I18N.pt['n.all']));
});
t('visão convencional: ativa pelo botão, mostra tudo, esconde o terminal e volta', () => {
  click($('#plainbtn')); assert(root.classList.contains('plain') && $('#plainbtn').getAttribute('aria-pressed') === 'true' && $('#s-plain').checked);
  click($('#w-about [data-open="projects"]')); assert($('#w-projects').dataset.scrolled === '1');
  click($('#plainbtn')); assert(!root.classList.contains('plain'));
});
t('habilidades: Redes de Computadores está em "Estudando agora", não em "Na prática"', () => {
  const hs = $$('#w-skills h3'), chips = (i) => [...hs[i].nextElementSibling.children].map((x) => x.textContent);
  assert(!chips(0).includes('Redes de Computadores') && chips(1).includes('Redes de Computadores'));
  [['pt', 'Redes'], ['en', 'Networking']].forEach(([lg, w]) => { const c = I18N[lg]['c.skills']; assert(!c[0].includes(w) && c[1].includes(w)); });
});
t('privacidade: texto simples, sem jargão técnico, em PT e EN', () => {
  const bad = /CSP|eval|textContent|back-?end|HTTPS|IP\b|analytics|F12|Content Security/i;
  ['pt', 'en'].forEach((lg) => Object.keys(I18N[lg]).filter((k) => /^p\.[ls]\d$/.test(k)).forEach((k) => assert(!bad.test(I18N[lg][k]), lg + ' ' + k)));
});
t('calculadora: contas, encadeamento, divisão por zero, %, sinal e teclado', () => {
  const { calcInit, calcStep } = require(path.join(pub, 'js/sistema.js'));
  const seq = (ks) => ks.reduce(calcStep, calcInit());
  assert(seq(['1', '2', 'add', '3', 'eq']).cur === '15' && seq(['9', 'mul', '3', 'sub', '2', 'eq']).cur === '25');
  assert(seq(['0', '.', '1', 'add', '0', '.', '2', 'eq']).cur === '0.3' && seq(['8', 'div', '0', 'eq']).err === true);
  assert(seq(['5', '0', 'pct']).cur === '0.5' && seq(['7', 'sign']).cur === '-7' && seq(['1', '2', 'back']).cur === '1' && seq(['4', 'ac']).cur === '0');
  assert(seq(['8', 'div', '0', 'eq', '5']).cur === '5' && seq(['__proto__']).cur === '0');
  click($('[data-open="calc"]')); const w = $('#w-calc'); assert(w.classList.contains('open'));
  ['6', 'mul', '7', 'eq'].forEach((k) => click($('[data-k="' + k + '"]'))); assert($('#cdisp').textContent === '42');
  click($('[data-k="ac"]')); key(w, '2'); key(w, '+'); key(w, '3'); key(w, 'Enter'); assert($('#cdisp').textContent === '5');
  key(w, '1'); key(w, ',', {}); key(w, '5'); assert($('#cdisp').textContent === '1,5');
  click(w.querySelector('[data-act="close"]'));
});
t('jogo da velha: vitória, bloqueio, empate e partida na tela', async () => {
  const { tttCheck, tttAi } = require(path.join(pub, 'js/sistema.js'));
  assert(tttCheck(['x', 'x', 'x', '', '', '', '', '', '']).w === 'x' && tttCheck(['x', 'o', 'x', 'x', 'o', 'o', 'o', 'x', 'x']).w === 'd' && tttCheck(Array(9).fill('')).w === null);
  assert(tttAi(['o', 'o', '', 'x', 'x', '', '', '', '']) === 2 && tttAi(['x', 'x', '', '', 'o', '', '', '', '']) === 2 && tttAi(Array(9).fill('')) === 4);
  click($('[data-open="games"]')); const cells = () => $$('#tttb button');
  assert(cells().length === 9 && cells()[0].getAttribute('aria-label').includes('vazio'));
  click(cells()[0]); assert(cells()[0].textContent === 'X' && cells()[0].disabled); await sleep(420);
  assert(cells().filter((c) => c.textContent === 'O').length === 1);
  click($('#tttr')); assert(cells().every((c) => !c.textContent && !c.disabled));
});
t('memória: 12 cartas, pares combinam e erros desvirem', async () => {
  click($('[data-g="mem"]')); assert(!$('#g-mem').hidden && $('#g-ttt').hidden);
  const cs = () => $$('#memb button'); assert(cs().length === 12);
  const sy = {}; cs().forEach((c, i) => (sy[c.dataset.s] = sy[c.dataset.s] || []).push(i)); assert(Object.values(sy).every((a) => a.length === 2));
  const [a, b] = Object.values(sy)[0], x = Object.values(sy)[1][0];
  click(cs()[a]); click(cs()[b]); assert(cs()[a].classList.contains('ok') && $('#mems').textContent.includes('1/6'));
  click(cs()[x]); click(cs()[Object.values(sy)[2][0]]); await sleep(900); assert(!cs()[x].classList.contains('up') && cs()[x].textContent === '');
  Object.values(sy).forEach(([p, q]) => { if (!cs()[p].classList.contains('ok')) { click(cs()[p]); click(cs()[q]); } });
  assert($('#mems').textContent.includes('Parabéns'));
  click($('#w-games [data-act="close"]'));
});
t('contato: avisa que o LinkedIn pode pedir login', () => { assert(/LinkedIn/.test(I18N.pt['c.tip']) && /sign in/.test(I18N.en['c.tip']) && $('[data-i="c.tip"]')); });
t('reiniciar: fecha janelas, refaz o boot e reabre Sobre mim', async () => {
  click($('#launch')); click($('#mrestart'));
  assert(!$('#boot').hidden && $$('.win.open').length === 0 && $$('.tb').length === 0 && root.classList.contains('booting'));
  d.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  assert($('#w-about').classList.contains('open') && !root.classList.contains('booting')); await sleep(10);
});
t('armazenamento e cookies vazios após uso', () => {
  assert(window.localStorage.length === 0 && window.sessionStorage.length === 0 && d.cookie === '');
});
t('acessibilidade básica: lang, rótulos, janelas nomeadas, botões com nome, live regions', () => {
  assert(root.lang === 'pt-BR');
  $$('.win').forEach((w) => assert(w.getAttribute('aria-labelledby') && d.getElementById(w.getAttribute('aria-labelledby'))));
  $$('button').forEach((b) => assert(b.textContent.trim() || b.getAttribute('aria-label'), b.outerHTML.slice(0, 70)));
  assert($('label[for="cmd"]') && $('label[for="s-lang"]') && $('#toasts').getAttribute('aria-live') === 'polite' && $('#boot').getAttribute('role') === 'dialog');
  assert($$('.tb').every((b) => b.getAttribute('aria-label')));
});

// ---- identidade visual ----
t('ícones: todo <use> aponta para um <symbol> existente; cada app e controle tem ícone', () => {
  const ids = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...html.matchAll(/<use[^>]* href="#([^"]+)"/g)].map((m) => m[1]);
  assert(refs.length >= 40);
  refs.forEach((r) => assert(ids.has(r), 'símbolo ausente: ' + r));
  [...js.matchAll(/ico\('([\w-]+)'\)/g)].forEach((m) => assert(ids.has('i-' + m[1]), m[1]));
  ['about', 'projects', 'skills', 'journey', 'terminal', 'contact', 'settings', 'privacy', 'min', 'max', 'x', 'page', 'file', 'bell', 'globe', 'restart', 'search', 'desktop']
    .forEach((n) => assert(ids.has('i-' + n), n));
  ['mont', 'dunas', 'relevo'].forEach((n) => assert(ids.has('wp-' + n)));
  $$('.btns button').forEach((b) => assert(b.querySelector('svg use')));
});
t('logotipo: cores do símbolo iguais aos tokens lima/ciano do CSS', () => {
  const root0 = css.match(/:root\{([\s\S]*?)\}/)[1];
  const lime = root0.match(/--lime:(#\w{6})/)[1].toLowerCase(), cy = root0.match(/--cy:(#\w{6})/)[1].toLowerCase();
  const logo = html.match(/<symbol id="logo"[\s\S]*?<\/symbol>/)[0].toLowerCase();
  assert(logo.includes(lime) && logo.includes(cy));
});
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const tokens = (re) => Object.fromEntries([...css.match(re)[1].matchAll(/--([\w-]+):(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const dark = tokens(/:root\{([\s\S]*?)\}/), light = { ...dark, ...tokens(/^\.light\{([\s\S]*?)\}/m) };
const darkCy = { ...dark, ...tokens(/^html\[data-accent=cy\]\{([\s\S]*?)\}/m) }, lightCy = { ...light, ...tokens(/^html\.light\[data-accent=cy\]\{([\s\S]*?)\}/m) };
[['escuro', dark, 7], ['claro', light, 7], ['escuro + acento ciano', darkCy, 4.5], ['claro + acento ciano', lightCy, 4.5]].forEach(([nome, v, onl]) => t('contraste WCAG (' + nome + ')', () => {
  const need = [['ink', 'panel', 7], ['ink', 'panel2', 7], ['mut', 'panel', 4.5], ['mut', 'panel2', 4.5], ['mut', 'bg', 4.5], ['cyT', 'panel', 4.5],
    ['limeT', 'panel', 4.5], ['limeT', 'panel2', 3], ['onlime', 'lime', onl], ['ink', 'w2', 7], ['ink', 'w1', 7], ['lime', 'panel', 3]];
  need.forEach(([f, b, min]) => { const r = cr(v[f], v[b]); assert(r >= min, `${f} sobre ${b} = ${r.toFixed(2)} (mín. ${min})`); });
}));
t('contraste WCAG (terminal e boot, cores fixas)', () => {
  [['#d5dde1', '#0b0e10', 7], ['#b6e23c', '#0b0e10', 7], ['#5fd6e1', '#0b0e10', 7], ['#8a98a1', '#0b0e10', 4.5],
   ['#e7ebf0', '#080b0f', 7], ['#9aa6b5', '#080b0f', 4.5], ['#8a96a3', '#080b0f', 4.5], ['#c3ccd7', '#080b0f', 7], ['#a3e635', '#080b0f', 7]]
    .forEach(([f, b, m]) => assert(cr(f, b) >= m, f + ' sobre ' + b));
});
t('movimento reduzido: CSS desliga animações e o boot não depende delas para mostrar o logotipo', () => {
  assert(/prefers-reduced-motion:reduce\)\{\*\{animation:none!important/.test(css));
  assert(!/\.bl-(h|l)\{[^}]*stroke-dashoffset:\d/.test(css), 'logotipo ficaria invisível sem animação');
});

(async () => {
  let ok = 0;
  for (const [n, f] of tests) {
    try { await f(); ok++; console.log('OK  ', n); } catch (e) { console.log('FALHA', n, '\n     ', e.message); process.exitCode = 1; }
  }
  console.log(`\n${ok} de ${tests.length} testes passaram.`);
  window.close(); process.exit(process.exitCode || 0);
})();

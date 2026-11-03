"""Teste de ponta a ponta em Chromium real (CSP aplicada). Uso:
   pip install playwright && playwright install chromium
   (cd public && python3 -m http.server 8765 &) ; python3 testes/teste-no-navegador.py capturas"""
import sys, os
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else 'shots'; os.makedirs(out, exist_ok=True)
U = 'http://localhost:8765/index.html'; problems = []; reqs = []; done = []
def ok(msg): done.append(msg); print('OK  ', msg)
def box(pg, sel): return pg.locator(sel).first.bounding_box()
def drag(pg, x0, y0, x1, y1):
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=4); pg.mouse.move(x1, y1, steps=4); pg.mouse.up()
def watch(pg):
    pg.on('console', lambda m: m.type in ('error', 'warning') and problems.append(m.text))
    pg.on('pageerror', lambda e: problems.append(str(e))); pg.on('request', lambda r: reqs.append(r.url))
def inside(b, w, h): return b['x'] >= -1 and b['y'] >= -1 and b['x'] + b['width'] <= w + 1 and b['y'] + b['height'] <= h - 47

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---------- desktop ----------
    ctx = br.new_context(viewport={'width': 1366, 'height': 768}, locale='pt-BR'); pg = ctx.new_page(); watch(pg)
    pg.goto(U); pg.wait_for_timeout(1300)
    assert pg.locator('#boot').is_visible() and pg.locator('#desktop').evaluate("e=>getComputedStyle(e).visibility") == 'hidden'
    assert pg.locator('.bbar i').evaluate("e=>parseFloat(e.style.width)") > 0
    pg.screenshot(path=out + '/0-boot.png'); ok('boot visível, com logotipo e progresso, desktop escondido por baixo')
    pg.wait_for_selector('#boot', state='hidden', timeout=7000); pg.wait_for_timeout(400)
    assert pg.locator('#w-about.open').count() == 1 and pg.locator('.toast').count() >= 1
    pg.screenshot(path=out + '/1-desktop.png'); ok('boot termina sozinho e abre Sobre mim com aviso de boas-vindas')
    boxes = [pg.locator('.ic').nth(i).bounding_box() for i in range(8)]
    assert all(b and b['x'] >= 0 and b['y'] >= 0 and b['y'] + b['height'] <= 768 - 48 for b in boxes) and len({round(b['x']) for b in boxes}) == 1
    assert pg.evaluate('document.documentElement.scrollHeight <= innerHeight') and pg.evaluate('document.documentElement.scrollWidth <= innerWidth'); ok('8 ícones visíveis, sem rolagem')
    # arrastar
    b0 = box(pg, '#w-about'); drag(pg, b0['x'] + 150, b0['y'] + 16, b0['x'] + 300, b0['y'] + 116); b1 = box(pg, '#w-about')
    assert abs(b1['x'] - b0['x'] - 150) < 3 and abs(b1['y'] - b0['y'] - 100) < 3, (b0, b1); ok('arrastar pela barra de título')
    # redimensionar
    se = box(pg, '#w-about .rz[data-d=se]'); drag(pg, se['x'] + 8, se['y'] + 8, se['x'] + 148, se['y'] + 98); b2 = box(pg, '#w-about')
    assert b2['width'] - b1['width'] > 130 and b2['height'] - b1['height'] > 80 and abs(b2['x'] - b1['x']) < 2, (b1, b2); ok('redimensionar pelo canto inferior direito')
    w_ = box(pg, '#w-about .rz[data-d=w]'); drag(pg, w_['x'] + 3, w_['y'] + 40, w_['x'] + 3 - 60, w_['y'] + 40); b3 = box(pg, '#w-about')
    assert b3['width'] - b2['width'] > 50 and abs((b3['x'] + b3['width']) - (b2['x'] + b2['width'])) < 2; ok('redimensionar pela borda esquerda mantém a direita fixa')
    e_ = box(pg, '#w-about .rz[data-d=e]'); drag(pg, e_['x'] + 3, e_['y'] + 40, e_['x'] - 900, e_['y'] + 40); b4 = box(pg, '#w-about')
    assert 299 <= b4['width'] <= 302, b4; ok('largura mínima respeitada (300 px)')
    # encaixar nas bordas e maximizar
    bb = box(pg, '#w-about .bar'); drag(pg, bb['x'] + 60, bb['y'] + 14, 0, 300); s = box(pg, '#w-about')
    assert abs(s['width'] - 683) < 3 and abs(s['height'] - 720) < 3 and s['x'] < 1, s; pg.screenshot(path=out + '/2-encaixe.png'); ok('encaixar na metade esquerda ao arrastar até a borda')
    bb = box(pg, '#w-about .bar'); drag(pg, bb['x'] + 100, bb['y'] + 14, 600, 200); s = box(pg, '#w-about')
    assert s['width'] < 400, s; ok('arrastar uma janela encaixada devolve o tamanho original')
    pg.dblclick('#w-about .bar h2'); m = box(pg, '#w-about'); assert m['width'] >= 1365 and m['height'] >= 719; pg.dblclick('#w-about .bar h2'); assert box(pg, '#w-about')['width'] < 1300; ok('duplo clique maximiza e restaura')
    # menu de contexto
    pg.mouse.click(900, 400, button='right'); assert pg.locator('#ctx').is_visible() and pg.locator('#ctx button').count() == 7
    c = box(pg, '#ctx'); assert inside(c, 1366, 768); pg.screenshot(path=out + '/3-contexto.png')
    pg.keyboard.press('Escape'); assert not pg.locator('#ctx').is_visible()
    pg.mouse.click(900, 400, button='right'); pg.locator('#ctx button').nth(2).click(); assert pg.locator('#wu').get_attribute('href') == '#wp-dunas'; ok('menu de contexto no desktop dentro da tela; troca o papel de parede')
    bb = box(pg, '#w-about .bar'); pg.mouse.click(bb['x'] + 70, bb['y'] + 14, button='right'); assert pg.locator('#ctx button').count() == 3; pg.keyboard.press('Escape'); ok('menu de contexto na barra de título')
    # atalhos e menu iniciar
    pg.keyboard.press('Alt+a'); assert pg.locator('#menu').is_visible() and pg.evaluate('document.activeElement.id') == 'msearch'
    pg.keyboard.type('termi'); assert pg.locator('#menu .mi:visible').count() == 1; pg.screenshot(path=out + '/4-menu.png'); pg.keyboard.press('Enter')
    assert pg.locator('#w-terminal.open').count() == 1 and not pg.locator('#menu').is_visible(); ok('Alt+A, busca no menu iniciar e Enter abrem o Terminal')
    pg.keyboard.type('help'); pg.keyboard.press('Enter'); assert 'Comandos' in pg.locator('#out').inner_text(); pg.keyboard.press('Alt+3'); assert pg.locator('#w-skills.on').count() == 1
    pg.keyboard.press('Alt+d'); pg.wait_for_timeout(300); assert pg.locator('.win.open:not(.min)').count() == 0; pg.keyboard.press('Alt+d'); pg.wait_for_timeout(300); assert pg.locator('.win.open:not(.min)').count() >= 3; ok('Alt+1…8, terminal e mostrar/restaurar área de trabalho')
    n = pg.locator('.win.open').count(); pg.keyboard.press('Alt+w'); pg.wait_for_timeout(250); assert pg.locator('.win.open').count() == n - 1; pg.locator('.win.open [data-act=close]').first.click(); pg.wait_for_timeout(250); assert pg.locator('.win.open').count() == n - 2; ok('fechar com animação (atalho e botão)')
    # idioma
    pg.locator('#lang').click(); assert pg.evaluate('document.documentElement.lang') == 'en' and pg.locator('#t-about').inner_text() == 'About Me' and pg.locator('#lcode').inner_text() == 'EN'
    assert 'Open' in pg.locator('#launch').get_attribute('aria-label'); pg.screenshot(path=out + '/5-english.png'); ok('idioma EN pela barra de tarefas')
    for a in ['projects', 'skills', 'journey', 'contact', 'settings', 'privacy']:
        pg.keyboard.press('Alt+a'); pg.locator(f'#menu .mi[data-open={a}]').click()
    assert pg.locator('.win.open').count() == 6; pg.screenshot(path=out + '/6-todos-en.png'); ok('6 aplicativos abertos ao mesmo tempo (multitarefa)')
    # configurações reais
    pg.locator('#tbs .tb[data-app=settings]').click(); pg.wait_for_timeout(200)  # traz Configurações para a frente
    pg.locator('#s-lang').select_option('pt'); assert pg.locator('#t-settings').inner_text() == 'Configurações'; ok('idioma PT pelo seletor de Configurações')
    pg.locator('[data-acc=cy]').click()
    assert pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--lime').trim()") == '#22d3ee'; ok('acento ciano altera as cores do sistema')
    pg.locator('[data-fs="2"]').click(); assert pg.evaluate("getComputedStyle(document.documentElement).fontSize") == '20px'; pg.locator('[data-fs="0"]').click()
    pg.locator('#s-light').check(); assert pg.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(232, 236, 240)'; pg.screenshot(path=out + '/7-claro-ciano.png'); pg.locator('#s-light').uncheck(); ok('tamanho de texto e tema claro mudam de verdade')
    pg.locator('#s-glass').uncheck(); assert pg.evaluate("getComputedStyle(document.querySelector('#taskbar')).backdropFilter") == 'none'; pg.locator('#s-glass').check()
    pg.locator('#s-reset').click(); assert pg.evaluate("document.documentElement.dataset.accent") is None; ok('efeito de vidro e restaurar padrões')
    # notificações
    pg.locator('#bell').click(); assert pg.locator('#nc').is_visible() and pg.locator('#nlist li').count() >= 3; c = box(pg, '#nc'); assert inside(c, 1366, 768); pg.screenshot(path=out + '/8-notificacoes.png')
    pg.keyboard.press('Escape'); assert not pg.locator('#nc').is_visible(); ok('central de notificações abre e fecha, dentro da tela')
    # reiniciar
    pg.keyboard.press('Alt+a'); pg.locator('#mrestart').click(); pg.wait_for_timeout(500); assert pg.locator('#boot').is_visible() and pg.locator('.win.open').count() == 0
    pg.keyboard.press('Enter'); pg.wait_for_timeout(700); assert pg.locator('#w-about.open').count() == 1 and not pg.locator('#boot').is_visible(); ok('reiniciar refaz o boot e pular com tecla')
    ctx.close()

    # ---------- movimento reduzido ----------
    ctx = br.new_context(viewport={'width': 1366, 'height': 768}, locale='pt-BR', reduced_motion='reduce'); pg = ctx.new_page(); watch(pg)
    pg.goto(U); pg.wait_for_timeout(150); assert pg.locator('.blogo').is_visible() and pg.locator('.bl-h').evaluate("e=>getComputedStyle(e).strokeDashoffset") in ('0px', '0'); pg.screenshot(path=out + '/9-boot-reduzido.png')
    pg.wait_for_selector('#boot', state='hidden', timeout=3000); assert pg.evaluate("document.body.classList.contains('noanim')") and not pg.locator('#s-anim').is_checked(); ok('movimento reduzido: boot curto, logotipo visível, animações desligadas')
    ctx.close()

    # ---------- celular (toque) ----------
    ctx = br.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='en-US'); pg = ctx.new_page(); watch(pg)
    pg.goto(U); pg.wait_for_timeout(500); pg.screenshot(path=out + '/10-mobile-boot.png'); pg.locator('#boot').tap(); pg.wait_for_timeout(600)
    assert pg.evaluate('document.documentElement.lang') == 'en' and pg.locator('#t-about').inner_text() == 'About Me'; ok('idioma EN detectado pelo navegador')
    b = box(pg, '#w-about'); assert b['width'] >= 389 and b['height'] >= 780 - 49 - 1; pg.screenshot(path=out + '/11-mobile.png')
    pg.locator('#launch').tap(); assert inside(box(pg, '#menu'), 390, 780); pg.locator('#menu .mi[data-open=settings]').tap(); pg.wait_for_timeout(300)
    assert pg.locator('#w-settings.open').count() == 1 and pg.locator('.tb').count() == 2 and pg.evaluate('document.documentElement.scrollWidth <= innerWidth'); pg.screenshot(path=out + '/12-mobile-settings.png'); ok('celular: janelas em tela cheia, menu e configurações por toque')
    pg.locator('#bell').tap(); assert pg.locator('#nc').is_visible() and inside(box(pg, '#nc'), 390, 780); ok('celular: central de notificações')
    ctx.close()

    # ---------- vários tamanhos ----------
    for w, h in [(320, 568), (768, 1024), (844, 390), (1024, 768), (1920, 1080)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, locale='pt-BR'); pg = ctx.new_page(); watch(pg); pg.goto(U); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
        r = [pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), inside(box(pg, '#w-about'), w, h)]
        pg.keyboard.press('Alt+a'); r.append(inside(box(pg, '#menu'), w, h)); pg.keyboard.press('Escape')
        pg.locator('#bell').click(); r.append(inside(box(pg, '#nc'), w, h)); pg.keyboard.press('Escape')
        pg.keyboard.press('Alt+8'); pg.wait_for_timeout(300); r.append(inside(box(pg, '#w-privacy'), w, h)); r.append(box(pg, '#taskbar')['y'] + box(pg, '#taskbar')['height'] <= h + 1)
        assert all(r), (w, h, r); pg.screenshot(path=out + f'/r-{w}x{h}.png'); ctx.close()
    ok('responsivo em 320x568, 768x1024, 844x390, 1024x768 e 1920x1080 (janela, menu, notificações, taskbar)')
    br.close()
ext = [u for u in reqs if not u.startswith(('http://localhost', 'data:'))]
assert not ext, ext; assert not problems, problems
print(f'\nvisual OK: {len(done)} verificações em Chromium, sem erros de console/CSP e sem requisições externas')

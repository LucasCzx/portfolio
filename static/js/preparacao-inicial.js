'use strict';
// preparacao-inicial.js: prepara a tela antes de tudo carregar.
// Roda antes da primeira pintura: sai do modo "página simples" e mostra o boot sem piscar o desktop.
// O temporizador é uma rede de segurança: se sistema.js falhar, o boot não prende o visitante.
const r = document.documentElement;
r.classList.remove('plain'); r.classList.add('booting');
setTimeout(() => r.classList.remove('booting'), 10000);

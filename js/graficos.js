/* Gráficos simples em HTML/CSS (sem dependências) + tooltip compartilhado. */
(function () {
  'use strict';
  const R = (window.Radar = window.Radar || {});
  const esc = (s) => R.esc(s);
  const G = (R.g = {});

  G.legenda = function (itens) {
    return '<div class="legenda">' + itens.map((x) =>
      `<span><i style="background:${x.cor}"></i>${esc(x.rotulo)}</span>`).join('') + '</div>';
  };

  /* Barras horizontais: itens = [{ rotulo, valor, texto, cor, dica }] */
  G.barrasH = function (itens, opcoes) {
    opcoes = opcoes || {};
    const max = opcoes.max || Math.max.apply(null, itens.map((x) => x.valor)) || 1;
    return '<div class="barras-h">' + itens.map((x) => {
      const w = Math.max(0, (x.valor / max) * 100);
      return `<div class="rot">${esc(x.rotulo)}</div>` +
        `<div class="trilho" data-dica="${esc(x.dica || '')}"><div class="barra" style="width:${w}%;background:${x.cor || 'var(--s1)'}"></div></div>` +
        `<div class="val">${esc(x.texto)}</div>`;
    }).join('') + '</div>';
  };

  /* Barras 100% empilhadas: linhas = [{ rotulo, sub, segs: [{ fracao, cor, dica }] }] */
  G.empilhadas = function (linhas) {
    return '<div class="empilhadas">' + linhas.map((l) => {
      const segs = l.segs.filter((s) => s.fracao > 0).map((s) =>
        `<div class="seg" style="flex:${s.fracao} 1 0;background:${s.cor}" data-dica="${esc(s.dica)}"></div>`).join('');
      return `<div class="rot">${esc(l.rotulo)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</div>` +
        `<div class="pilha">${segs}</div>`;
    }).join('') + '</div>';
  };

  /* Colunas verticais: itens = [{ rotulo, valor, topo, cor, dica, vazio }] */
  G.colunas = function (itens, opcoes) {
    opcoes = opcoes || {};
    const max = Math.max.apply(null, itens.map((x) => x.valor)) || 1;
    const passo = opcoes.rotuloACada || 1;
    const cols = itens.map((x) => {
      if (x.vazio) {
        return `<div class="col vazio" data-dica="${esc(x.dica || '')}"><div class="barra"></div></div>`;
      }
      const h = Math.max(0.5, (x.valor / max) * 100);
      return `<div class="col" data-dica="${esc(x.dica || '')}">` +
        (opcoes.semTopo ? '' : `<span class="topo-val">${esc(x.topo || '')}</span>`) +
        `<div class="barra" style="height:${h}%;background:${x.cor || 'var(--s1)'}"></div></div>`;
    }).join('');
    const rots = itens.map((x, i) =>
      `<span>${i % passo === 0 ? esc(x.rotulo) : ''}</span>`).join('');
    return `<div class="colunas ${opcoes.classe || ''}">${cols}</div><div class="rotulos-x">${rots}</div>`;
  };

  /* Tooltip único, acionado por qualquer elemento com data-dica. */
  G.instalarDica = function () {
    const dica = document.getElementById('dica');
    let alvo = null;
    const posicionar = (ev) => {
      const pad = 14;
      const w = dica.offsetWidth, h = dica.offsetHeight;
      let x = ev.clientX + pad, y = ev.clientY + pad;
      if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
      if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
      dica.style.left = Math.max(8, x) + 'px';
      dica.style.top = Math.max(8, y) + 'px';
    };
    document.addEventListener('pointermove', (ev) => {
      const el = ev.target.closest ? ev.target.closest('[data-dica]') : null;
      if (!el || !el.getAttribute('data-dica')) {
        if (alvo) { dica.hidden = true; alvo = null; }
        return;
      }
      if (el !== alvo) {
        alvo = el;
        dica.textContent = el.getAttribute('data-dica');
        dica.hidden = false;
      }
      posicionar(ev);
    });
    document.addEventListener('pointerleave', () => { dica.hidden = true; alvo = null; });
    window.addEventListener('scroll', () => { dica.hidden = true; alvo = null; }, { passive: true });
  };
})();

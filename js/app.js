/* Inicialização: carrega o CSV, controla as abas e o seletor manual de arquivo. */
(function () {
  'use strict';
  const R = window.Radar;
  const estadoEl = document.getElementById('estado');
  const fonteEl = document.getElementById('fonte-dados');
  const botoes = Array.from(document.querySelectorAll('.abas [role="tab"]'));
  const renderizadas = {};
  let D = null;

  R.g.instalarDica();
  botoes.forEach((b) => { b.disabled = true; });

  function abrir(n, foco) {
    if (!D) return;
    n = String(n);
    if (!R.abas[n]) n = '1';
    botoes.forEach((b) => {
      const ativo = b.getAttribute('data-aba') === n;
      b.setAttribute('aria-selected', ativo);
      b.tabIndex = ativo ? 0 : -1;
      if (ativo && foco) b.focus();
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== 'aba-' + n; });
    const painel = document.getElementById('aba-' + n);
    if (!renderizadas[n]) {
      try {
        R.abas[n](D, painel);
      } catch (e) {
        console.error(e);
        painel.innerHTML = `<p class="erro">Erro ao montar esta aba: ${R.esc(e.message)}</p>`;
      }
      renderizadas[n] = true;
    } else if (R.mapa) {
      R.mapa.invalidar(painel);
    }
    if (location.hash !== '#analise-' + n) {
      try { history.replaceState(null, '', '#analise-' + n); } catch (e) { /* file:// em alguns navegadores */ }
    }
  }

  botoes.forEach((b, i) => {
    b.addEventListener('click', () => abrir(b.getAttribute('data-aba')));
    b.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % botoes.length;
      if (ev.key === 'ArrowLeft') j = (i - 1 + botoes.length) % botoes.length;
      if (ev.key === 'Home') j = 0;
      if (ev.key === 'End') j = botoes.length - 1;
      if (j != null) { ev.preventDefault(); abrir(botoes[j].getAttribute('data-aba'), true); }
    });
  });

  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#(?:analise|aba)-(\d)$/);
    if (m) abrir(m[1]);
  });

  function iniciar(carga) {
    const t0 = performance.now();
    D = R.interpretarCSV(carga.texto);
    if (!D.registros.length) throw new Error('O arquivo não possui registros válidos.');
    console.info(`Radar: ${D.registros.length} registros interpretados em ${Math.round(performance.now() - t0)} ms (${carga.origem})`);
    fonteEl.textContent = `Fonte: ${carga.origem.replace(/^data\//, '')} · ${R.int(D.registros.length)} linhas`;
    estadoEl.hidden = true;
    botoes.forEach((b) => { b.disabled = false; });
    const m = location.hash.match(/^#(?:analise|aba)-(\d)$/);
    abrir(m ? m[1] : '1');
    /* links antigos (#aba-N) fazem o navegador rolar até o painel de mesmo id */
    if (m) window.scrollTo(0, 0);
  }

  function mostrarSeletor(mensagem) {
    fonteEl.textContent = 'Nenhum arquivo carregado';
    estadoEl.hidden = false;
    estadoEl.innerHTML = `<p>${mensagem}</p>
      <label class="seletor">
        <strong>Selecione ou arraste o arquivo <code>volume-radar-trans.csv</code></strong><br>
        <input type="file" accept=".csv,text/csv" style="margin-top:10px">
      </label>`;
    const input = estadoEl.querySelector('input');
    const usar = (arquivo) => {
      if (!arquivo) return;
      estadoEl.innerHTML = '<p class="carregando">Lendo arquivo…</p>';
      R.lerArquivo(arquivo).then(iniciar).catch((e) => mostrarSeletor(`<span class="erro">${R.esc(e.message)}</span>`));
    };
    input.addEventListener('change', () => usar(input.files[0]));
    estadoEl.ondragover = (ev) => { ev.preventDefault(); estadoEl.classList.add('arrastando'); };
    estadoEl.ondragleave = () => estadoEl.classList.remove('arrastando');
    estadoEl.ondrop = (ev) => {
      ev.preventDefault();
      estadoEl.classList.remove('arrastando');
      usar(ev.dataTransfer.files[0]);
    };
  }

  R.carregarTexto().then((carga) => {
    if (!carga) {
      mostrarSeletor('Não foi possível carregar os dados automaticamente.');
      return;
    }
    try {
      iniciar(carga);
    } catch (e) {
      console.error(e);
      mostrarSeletor(`<span class="erro">${R.esc(e.message)}</span>`);
    }
  });
})();

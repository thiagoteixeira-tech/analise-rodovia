/* Renderização das cinco abas. Os textos interpretativos são gerados a partir dos números calculados. */
(function () {
  'use strict';
  const R = (window.Radar = window.Radar || {});
  const G = R.g;
  const esc = R.esc;
  const A = (R.abas = {});

  /* ---------------- helpers de apresentação ---------------- */

  const kmTxt = (km) => 'km ' + (Number.isInteger(km) ? R.int(km) : R.dec(km, 3));
  const eqTxt = (eq) => `${eq.id} (${kmTxt(eq.km)})`;
  const plural = (n, s, p) => R.int(n) + ' ' + (Math.round(n) === 1 ? s : p);

  function kpi(rotulo, valor, detalhe) {
    return `<div class="kpi"><div class="rotulo">${esc(rotulo)}</div><div class="valor">${valor}</div>` +
      (detalhe ? `<div class="detalhe">${detalhe}</div>` : '') + '</div>';
  }

  function cartao(titulo, corpo, subtitulo) {
    return `<div class="cartao"><h3>${esc(titulo)}</h3>` +
      (subtitulo ? `<p class="subtitulo">${subtitulo}</p>` : '') + corpo + '</div>';
  }

  function cabecalho(titulo, texto, pergunta) {
    return `<div class="cabecalho-aba"><h2>${esc(titulo)}</h2>` +
      (pergunta ? `<p class="pergunta">${pergunta}</p>` : '') +
      (texto ? `<p>${texto}</p>` : '') + '</div>';
  }

  function legendaTipos(D) {
    return G.legenda(D.tipos.map((t) => ({ rotulo: t.nome, cor: t.cor })));
  }

  function legendaVels(D) {
    return G.legenda(D.vels.map((v) => ({ rotulo: v.rotulo, cor: v.cor })));
  }

  /*
   * Tabela de composição percentual.
   * linhas: [{ rotulo, sub, total, por[], p[], classe }]
   * cols:   [{ rotulo }]
   */
  function tabelaComposicao(o) {
    const cab = `<tr><th>${esc(o.rotuloLinha)}</th>` +
      o.cols.map((c) => `<th class="num">${esc(c.rotulo)}</th>`).join('') +
      (o.semTotal ? '' : '<th class="num">Volume</th>') +
      (o.extraCab || '') + '</tr>';
    const linha = (l, tag) => {
      const celulas = l.p.map((p, i) => {
        const peq = o.pequeno ? o.pequeno(l, i) : false;
        return `<${tag} class="num${peq ? ' pequeno' : ''}"${peq ? ` data-dica="${esc(peq)}"` : ''}>${R.pct(p)}` +
          `<span class="abs">${R.int(l.por[i])}</span></${tag}>`;
      }).join('');
      return `<tr class="${l.classe || ''}"><${tag}>${esc(l.rotulo)}${l.marca || ''}` +
        (l.sub ? `<span class="abs">${esc(l.sub)}</span>` : '') + `</${tag}>${celulas}` +
        (o.semTotal ? '' : `<${tag} class="num">${R.int(l.total)}</${tag}>`) +
        (l.extra || '') + '</tr>';
    };
    return `<div class="tabela-rolagem"><table class="${o.mostrarAbs ? '' : 'sem-abs'}">` +
      `<thead>${cab}</thead><tbody>${o.linhas.map((l) => linha(l, 'td')).join('')}</tbody>` +
      (o.rodape ? `<tfoot>${linha(o.rodape, 'td')}</tfoot>` : '') + '</table></div>';
  }

  function segsTipos(D, p, por, prefixo) {
    return D.tipos.map((t, i) => ({
      fracao: p[i],
      cor: t.cor,
      dica: `${prefixo}\n${t.nome}: ${R.pct(p[i])} (${R.int(por[i])} veículos)`,
    }));
  }

  function segsVels(D, p, por, prefixo) {
    return D.vels.map((v, i) => ({
      fracao: p[i],
      cor: v.cor,
      dica: `${prefixo}\n${v.rotulo}: ${R.pctFino(p[i])} (${R.int(por[i])} veículos)`,
    }));
  }

  function segmentado(nome, opcoes, atual) {
    return `<div class="segmentado" role="group" data-controle="${nome}">` + opcoes.map((o) =>
      `<button type="button" data-valor="${esc(o.valor)}" aria-pressed="${o.valor === atual}">${esc(o.rotulo)}</button>`).join('') + '</div>';
  }

  function ligarSegmentado(el, nome, aoMudar) {
    el.querySelectorAll(`[data-controle="${nome}"] button`).forEach((b) => {
      b.addEventListener('click', () => aoMudar(b.getAttribute('data-valor')));
    });
  }

  /* Alterna um grupo segmentado sem re-renderizar a aba (usado nos controles dos mapas). */
  function ligarLocal(el, nome, aoMudar) {
    const botoes = el.querySelectorAll(`[data-controle="${nome}"] button`);
    botoes.forEach((b) => b.addEventListener('click', () => {
      botoes.forEach((x) => x.setAttribute('aria-pressed', x === b));
      aoMudar(b.getAttribute('data-valor'));
    }));
  }

  const NOTA_MAPA = '<p class="nota">Rodovias: traçado do OpenStreetMap embutido no sistema (aparece mesmo offline). O fundo cartográfico (Esri) precisa de internet; troque-o no botão de camadas, no canto superior direito. ' +
    'Símbolos sobrepostos são afastados automaticamente e ligados ao ponto real do radar por linha tracejada. Use os botões + e − para aproximar.</p>';

  const legendaRodovias = '<div class="legenda"><span><i class="legenda-linha"></i>BR-153</span><span><i class="legenda-linha outra"></i>Outras rodovias</span></div>';

  function cartaoMapa(id, titulo, subtitulo, topo, classe) {
    return cartao(titulo, (topo || '') + `<div class="mapa ${classe || ''}" id="${id}" role="img" aria-label="${esc(titulo)}"></div>` + NOTA_MAPA, subtitulo);
  }

  /* ======================================================================
   * ABA 1 — Caracterização do conjunto de dados
   * ==================================================================== */
  A[1] = function (D, el) {
    R.mapa.limpar(el);
    const c = R.caracterizar(D);
    const total = c.total;

    const kpis = '<div class="kpis">' +
      kpi('Período analisado', `${R.dataBR(c.ini)} – ${R.dataBR(c.fim)}`,
        `${plural(c.diasIntervalo, 'dia', 'dias')} no intervalo · ${plural(c.diasComDados, 'dia', 'dias')} com registro`) +
      kpi('Equipamentos', R.int(c.equipamentos.length), esc(c.equipamentos.map((e) => e.id).join(', '))) +
      kpi('Volume total registrado', R.int(total), `veículos em ${R.int(c.registros)} linhas do arquivo`) +
      kpi('Rodovia · UF', esc(c.rodovias.join(', ')) + ' · ' + esc(c.ufs.join(', ')),
        esc(c.concessionarias.join(', '))) +
      '</div>';

    const local = `<dl class="lista-def">
      <dt>Concessionária</dt><dd>${esc(c.concessionarias.join(', '))}</dd>
      <dt>Rodovia(s)</dt><dd>${esc(c.rodovias.join(', '))}</dd>
      <dt>Estado(s)</dt><dd>${esc(c.ufs.join(', '))}</dd>
      <dt>Município(s)</dt><dd>${esc(R.listaTexto(c.municipios))} (${c.municipios.length})</dd>
      <dt>Tipo de pista</dt><dd>${esc(c.pistas.join(', '))}</dd>
      <dt>Sentidos</dt><dd>${esc(c.sentidos.map((s) => s.chave).join(', '))}</dd>
      <dt>Faixas</dt><dd>${esc(c.faixas.map((s) => s.chave).join(', '))}</dd>
    </dl>`;

    const tabEq = '<div class="tabela-rolagem"><table><thead><tr>' +
      '<th>Equipamento</th><th class="num">km</th><th>Município</th><th>Coordenadas</th><th>Sentido</th><th>Faixa</th>' +
      '<th>Período com registro</th><th class="num">Dias</th><th class="num">Volume</th><th class="num">% do total</th>' +
      '</tr></thead><tbody>' + c.equipamentos.map((e) =>
        `<tr><td>${esc(e.id)}</td><td class="num">${R.dec(e.km, Number.isInteger(e.km) ? 0 : 3)}</td><td>${esc(e.municipio)}</td>` +
        `<td class="num">${R.dec(e.lat, 5)}, ${R.dec(e.lon, 5)}</td><td>${esc(e.sentidos.join(', '))}</td><td>${esc(e.faixas.join(', '))}</td>` +
        `<td>${R.dataBR(e.ini)} – ${R.dataBR(e.fim)}</td><td class="num">${R.int(e.dias)}</td>` +
        `<td class="num">${R.int(e.total)}</td><td class="num">${R.pct(e.total / total)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td colspan="7">Total</td><td class="num">${R.int(c.diasComDados)}</td><td class="num">${R.int(total)}</td><td class="num">100,0%</td></tr></tfoot></table></div>`;

    const barrasTipo = G.barrasH(D.tipos.map((t, i) => ({
      rotulo: t.nome,
      valor: c.porTipo[i],
      cor: t.cor,
      texto: `${R.pct(c.porTipo[i] / total)} · ${R.int(c.porTipo[i])}`,
      dica: `${t.nome}\n${R.int(c.porTipo[i])} veículos (${R.pct(c.porTipo[i] / total)})`,
    })));

    const tabVel = '<div class="tabela-rolagem"><table><thead><tr><th>Categoria</th><th>Rótulo no arquivo</th>' +
      '<th class="num">Volume</th><th class="num">% do total</th></tr></thead><tbody>' +
      D.vels.map((v, i) => `<tr><td>${esc(v.rotulo)}</td><td><code>${esc(v.brutos.map((b) => '"' + b + '"').join(', '))}</code></td>` +
        `<td class="num">${R.int(c.porVel[i])}</td><td class="num">${R.pctFino(c.porVel[i] / total)}</td></tr>`).join('') +
      '</tbody></table></div>' +
      '<p class="nota">Os rótulos de velocidade vêm truncados no arquivo (ex.: "81 - 100 K"); foram normalizados para exibição.</p>';

    const tabSimples = (titulo, itens) => '<div class="tabela-rolagem"><table><thead><tr>' +
      `<th>${esc(titulo)}</th><th class="num">Volume</th><th class="num">% do total</th></tr></thead><tbody>` +
      itens.map((x) => `<tr><td>${esc(x.chave)}</td><td class="num">${R.int(x.volume)}</td><td class="num">${R.pct(x.volume / total)}</td></tr>`).join('') +
      '</tbody></table></div>';

    const sentidosFaixas =
      '<div class="grade-2" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))">' +
      `<div>${tabSimples('Sentido', c.sentidos)}</div><div>${tabSimples('Faixa', c.faixas)}</div></div>` +
      `<div style="margin-top:14px">${tabSimples('Sentido · faixa', c.sentidoFaixa)}</div>`;

    /* Cobertura temporal */
    const diasNoMes = (aaaamm) => new Date(Date.UTC(+aaaamm.slice(0, 4), +aaaamm.slice(5, 7), 0)).getUTCDate();
    const colMeses = G.colunas(c.meses.map((m) => ({
      rotulo: m.mes.slice(5) === '01' ? m.mes.slice(0, 4) : '',
      valor: m.volume,
      vazio: m.volume === 0,
      cor: m.dias < diasNoMes(m.mes) ? 'var(--s2)' : 'var(--s1)',
      dica: m.volume
        ? `${R.mesBR(m.mes)}\n${R.int(m.volume)} veículos\n${plural(m.dias, 'dia', 'dias')} com registro · ${plural(m.eqs, 'equipamento', 'equipamentos')}`
        : `${R.mesBR(m.mes)}\nsem registros no arquivo`,
    })), { semTopo: true });

    const lacunas = c.intervalosAusentes.slice().sort((a, b) => b.dias - a.dias);
    const descLacuna = (x) => x.dias === 1 ? R.dataBR(x.ini) : `${R.dataBR(x.ini)} a ${R.dataBR(x.fim)} (${x.dias} dias)`;
    const parciais = c.equipamentos.filter((e) => e.ini > c.ini || e.fim < c.fim);
    const avisos = [];
    if (c.ausentes.length) {
      avisos.push(`<p><strong>${plural(c.ausentes.length, 'dia sem nenhum registro', 'dias sem nenhum registro')}</strong> no intervalo. ` +
        `Maiores lacunas: ${esc(lacunas.slice(0, 6).map(descLacuna).join('; '))}${lacunas.length > 6 ? '; …' : ''}.</p>`);
    }
    if (parciais.length) {
      avisos.push('<p><strong>Cobertura diferente entre equipamentos:</strong> ' + parciais.map((e) =>
        `${esc(e.id)} tem registros apenas de ${R.dataBR(e.ini)} a ${R.dataBR(e.fim)}`).join('; ') +
        '. Volumes totais por equipamento, portanto, não são diretamente comparáveis; as abas seguintes usam médias diárias quando necessário.</p>');
    }
    if (c.atipicos.length) {
      avisos.push(`<p><strong>${plural(c.atipicos.length, 'dia', 'dias')} com volume atípico</strong> (menos de 20% da mediana diária de ${R.int(c.medianaDiaria)} veículos), ` +
        `provavelmente com registro parcial: ${esc(c.atipicos.slice(0, 8).map((x) => `${R.dataBR(x.d)} (${R.int(x.total)})`).join(', '))}${c.atipicos.length > 8 ? ', …' : ''}.</p>`);
    }
    if (D.linhasInvalidas) avisos.push(`<p>${plural(D.linhasInvalidas, 'linha foi descartada', 'linhas foram descartadas')} por formato inválido.</p>`);

    el.innerHTML =
      cabecalho('Caracterização do conjunto de dados',
        'Visão geral do arquivo de volume de tráfego nos radares de controle de velocidade (Sistema de Informação de Rodovias – ANTT). Os dados são agregados por equipamento, data, sentido, faixa, categoria de velocidade e tipo de veículo.') +
      kpis +
      cartaoMapa('mapa-1', 'Mapa: rodovias e localização dos radares',
        `${c.equipamentos.length} radares na ${esc(c.rodovias.join(', '))} entre o ${kmTxt(Math.min.apply(null, c.equipamentos.map((e) => e.km)))} e o ${kmTxt(Math.max.apply(null, c.equipamentos.map((e) => e.km)))}. Clique em um radar para ver os detalhes.`,
        legendaRodovias + G.legenda([{ rotulo: 'Sentido crescente', cor: 'var(--s1)' }, { rotulo: 'Sentido decrescente', cor: 'var(--s2)' }]), 'mapa-grande') +
      '<div class="grade-2">' + cartao('Localização e abrangência', local) + cartao('Tipos de veículos', barrasTipo, `${D.tipos.length} tipos`) + '</div>' +
      cartao('Equipamentos', tabEq, `${c.equipamentos.length} radares, todos na pista ${esc(c.pistas.join('/').toLowerCase())}`) +
      '<div class="grade-2">' + cartao('Categorias de velocidade', tabVel, `${D.vels.length} categorias`) +
      cartao('Sentidos e faixas de passagem', sentidosFaixas) + '</div>' +
      cartao('Cobertura temporal: volume mensal',
        G.legenda([{ rotulo: 'Mês com registro em todos os dias', cor: 'var(--s1)' }, { rotulo: 'Mês com dias sem registro', cor: 'var(--s2)' }, { rotulo: 'Mês sem registros', cor: 'var(--grade)' }]) +
        colMeses + (avisos.length ? `<div class="aviso" style="margin-top:16px">${avisos.join('')}</div>` : ''));

    /* Mapa de localização */
    const m1 = R.mapa.criar(el.querySelector('#mapa-1'), D);
    m1.simbolos(c.equipamentos.map((e) => {
      const dist = R.mapa.distanciaRodovia(e.lat, e.lon);
      const cresc = e.sentidos.length === 1 && /^cresc/i.test(e.sentidos[0]);
      return {
        eq: e,
        r: 9,
        html: R.mapa.circulo(9, cresc ? 'var(--s1)' : 'var(--s2)'),
        rotulo: `${e.id} · ${kmTxt(e.km)}`,
        dica: `${e.id} · ${e.municipio}\n${kmTxt(e.km)} · ${e.sentidos.join('/')} · faixa ${e.faixas.join('/')}\n${R.int(e.total)} veículos (${R.dataBR(e.ini)} – ${R.dataBR(e.fim)})`,
        popup: `<strong>${esc(e.id)}</strong> · ${esc(e.rodovia)} ${esc(kmTxt(e.km))}<br>${esc(e.municipio)} – ${esc(e.uf)}<br>` +
          `Sentido: ${esc(e.sentidos.join(', '))} · Faixa: ${esc(e.faixas.join(', '))}<br>` +
          `Coordenadas: ${R.dec(e.lat, 5)}, ${R.dec(e.lon, 5)}<br>` +
          `Período: ${R.dataBR(e.ini)} – ${R.dataBR(e.fim)} (${R.int(e.dias)} dias)<br>` +
          `Volume: <strong>${R.int(e.total)}</strong> veículos (${R.pct(e.total / total)})` +
          (isFinite(dist) ? `<br><span style="color:var(--texto-mudo)">Distância ao traçado OSM da BR-153: ${dist < 1000 ? R.int(dist) + ' m' : R.dec(dist / 1000, 1) + ' km'}</span>` : ''),
      };
    }));
  };

  /* ======================================================================
   * ABA 2 — Tipo de veículo × velocidade
   * ==================================================================== */
  A[2] = function (D, el, estado) {
    estado = estado || { abs: 'sim' };
    const m = R.tipoPorVelocidade(D);
    const total = m.total;
    const limiar = Math.max(1000, total * 0.001);
    const presentes = m.linhas.filter((l) => l.total > 0);
    const robustas = presentes.filter((l) => l.total >= limiar);
    const pequenas = presentes.filter((l) => l.total < limiar);
    const marcaPeq = '<span class="marca-pequeno" title="Volume reduzido">volume pequeno</span>';

    /* Célula destacada: percentual alto (≥ 5%) sustentado por poucos veículos. */
    const celulaPequena = (l, i) =>
      l.total < limiar && l.p[i] >= 0.05
        ? `${R.pct(l.p[i])} de ${l.vel.rotulo} = apenas ${plural(l.por[i], 'veículo', 'veículos')} (de ${R.int(l.total)} na categoria)`
        : false;

    const tabela = tabelaComposicao({
      rotuloLinha: 'Velocidade',
      cols: D.tipos.map((t) => ({ rotulo: t.nome })),
      mostrarAbs: estado.abs === 'sim',
      linhas: presentes.map((l) => ({
        vel: l.vel,
        rotulo: l.vel.rotulo,
        marca: l.total < limiar ? marcaPeq : '',
        total: l.total,
        por: l.por,
        p: l.p,
        extra: `<td class="num">${R.pctFino(l.total / total)}</td><td class="num">${R.pct(l.p.reduce((a, b) => a + b, 0))}</td>`,
      })),
      extraCab: '<th class="num">% do volume total</th><th class="num">Soma</th>',
      rodape: {
        rotulo: 'Todas as categorias',
        total,
        por: m.totTipo,
        p: m.geral,
        extra: `<td class="num">100,0%</td><td class="num">${R.pct(m.geral.reduce((a, b) => a + b, 0))}</td>`,
      },
      pequeno: celulaPequena,
    });

    const grafico = legendaTipos(D) + G.empilhadas(presentes.map((l) => ({
      rotulo: l.vel.rotulo,
      sub: plural(l.total, 'veículo', 'veículos'),
      segs: segsTipos(D, l.p, l.por, l.vel.rotulo),
    })));

    /* ---------- interpretação ---------- */
    const dom = robustas.slice().sort((a, b) => b.total - a.total)[0];
    const desvio = (l) => Math.max.apply(null, l.p.map((p, i) => Math.abs(p - m.geral[i])));
    const maiorDesvio = robustas.slice().sort((a, b) => desvio(b) - desvio(a))[0];
    const estaveis = robustas.filter((l) => desvio(l) < 0.10);
    const instaveis = robustas.filter((l) => desvio(l) >= 0.10);
    const faixaTipo = (linhas, i) => {
      const ord = linhas.slice().sort((a, b) => a.p[i] - b.p[i]);
      return { min: ord[0], max: ord[ord.length - 1] };
    };

    const par = [];
    par.push(`<p>A categoria <strong>${esc(dom.vel.rotulo)}</strong> concentra <strong>${R.pct(dom.total / total)}</strong> de todos os veículos registrados. ` +
      `Por isso, a composição geral da frota (${D.tipos.map((t, i) => `${esc(t.nome)} ${R.pct(m.geral[i])}`).join(', ')}) ` +
      `é, na prática, a composição dessa faixa de velocidade, e as demais categorias devem ser comparadas com ela.</p>`);

    let veredito;
    if (!instaveis.length) {
      veredito = `<strong>Sim, de modo geral.</strong> Nas categorias com volume expressivo, nenhum tipo de veículo se afasta mais de 10 p.p. da composição geral (maior afastamento: ${R.pct(desvio(maiorDesvio))} em ${esc(maiorDesvio.vel.rotulo)}).`;
    } else {
      veredito = `<strong>Não inteiramente.</strong> A composição muda de forma marcante em ${esc(R.listaTexto(instaveis.map((l) => l.vel.rotulo)))}` +
        (estaveis.length ? `, enquanto em ${esc(R.listaTexto(estaveis.map((l) => l.vel.rotulo)))} ela permanece próxima da composição geral.` : '.');
    }

    const itens = [];
    /* Afastamentos relevantes por tipo, nas categorias robustas. */
    D.tipos.forEach((t, i) => {
      const fx = faixaTipo(robustas, i);
      const dif = fx.max.p[i] - m.geral[i];
      if (dif >= 0.05) {
        const fracaoDoTipo = fx.max.por[i] / m.totTipo[i];
        itens.push(`<li><strong>${esc(t.nome)}</strong> atinge ${R.pct(fx.max.p[i])} em ${esc(fx.max.vel.rotulo)}, contra ${R.pct(m.geral[i])} no conjunto (${R.pp(dif)}). ` +
          `${R.pct(fracaoDoTipo)} de todos os veículos "${esc(t.nome)}" do arquivo estão nessa categoria.</li>`);
      }
    });
    if (estaveis.length >= 2) {
      const descr = D.tipos.map((t, i) => {
        const fx = faixaTipo(estaveis, i);
        return `${esc(t.nome)} entre ${R.pct(fx.min.p[i])} e ${R.pct(fx.max.p[i])}`;
      });
      itens.push(`<li>Entre ${esc(R.listaTexto(estaveis.map((l) => l.vel.rotulo)))} a composição é relativamente estável: ${descr.join('; ')}.</li>`);
    }
    if (robustas.length >= 2) {
      const prim = robustas[0], ult = robustas[robustas.length - 1];
      const tend = D.tipos.map((t, i) => `${esc(t.nome)} ${R.pct(prim.p[i])} → ${R.pct(ult.p[i])}`);
      const monotonicos = D.tipos.filter((t, i) => {
        const dif = robustas.slice(1).map((l, k) => l.p[i] - robustas[k].p[i]);
        return dif.every((d) => d >= 0) || dif.every((d) => d <= 0);
      });
      const textoTend = robustas.length < 3
        ? ''
        : monotonicos.length === D.tipos.length
          ? 'Todos os tipos variam em um único sentido (só sobem ou só descem) à medida que a velocidade aumenta.'
          : monotonicos.length
            ? `Apenas ${esc(R.listaTexto(monotonicos.map((t) => t.nome)))} varia${monotonicos.length > 1 ? 'm' : ''} em um único sentido ao longo das categorias. Os demais tipos sobem e descem, sem tendência contínua.`
            : 'Nenhum tipo varia em um único sentido: as participações sobem e descem entre as categorias, sem tendência contínua à medida que a velocidade aumenta.';
      itens.push(`<li>Da menor (${esc(prim.vel.rotulo)}) à maior categoria com volume expressivo (${esc(ult.vel.rotulo)}): ${tend.join('; ')}. ${textoTend}</li>`);
    }

    const itensPeq = pequenas.map((l) => {
      const maior = l.p.indexOf(Math.max.apply(null, l.p));
      const altos = D.tipos.map((t, i) => ({ t, i })).filter((x) => l.p[x.i] >= 0.05 && x.i !== maior);
      return `<li><strong>${esc(l.vel.rotulo)}</strong>: ${plural(l.total, 'veículo', 'veículos')} em todo o período (${R.pctFino(l.total / total)} do total). ` +
        `Os ${R.pct(l.p[maior])} de ${esc(D.tipos[maior].nome)} correspondem a ${plural(l.por[maior], 'veículo', 'veículos')}` +
        (altos.length ? `; ${altos.map((x) => `${R.pct(l.p[x.i])} de ${esc(x.t.nome)} = ${plural(l.por[x.i], 'veículo', 'veículos')}`).join('; ')}` : '') +
        `. Aqui, cada veículo equivale a ${R.dec(100 / l.total, l.total > 1000 ? 3 : 1)} p.p.</li>`;
    });

    const interp = `<div class="interpretacao">
      <div class="resposta"><strong>A composição é semelhante entre as categorias?</strong><p>${veredito}</p></div>
      ${par.join('')}
      <ul>${itens.join('')}</ul>
      ${pequenas.length ? `<h4 style="margin:14px 0 6px">Percentuais altos com volumes absolutos pequenos</h4>
      <p>Categorias com menos de ${R.int(limiar)} veículos (0,1% do total) estão marcadas como <span class="marca-pequeno">volume pequeno</span>. Nelas os percentuais são instáveis: poucos veículos mudam a composição em vários pontos percentuais, e um percentual alto não indica um fenômeno relevante em termos de tráfego.</p>
      <ul>${itensPeq.join('')}</ul>` : ''}
      <p class="nota">O arquivo não informa por que a composição varia entre categorias. As diferenças acima descrevem apenas a distribuição registrada e não devem ser atribuídas a causas externas sem dados adicionais.</p>
    </div>`;

    el.innerHTML =
      cabecalho('Tipo de veículo × velocidade',
        'Participação percentual de cada tipo de veículo dentro de cada categoria de velocidade (cada linha soma ≈ 100%). Volume de todo o período e de todos os equipamentos.',
        'A composição dos tipos de veículos é semelhante entre as diferentes categorias de velocidade?') +
      `<div class="controles"><span>Exibição:</span>${segmentado('abs', [{ valor: 'sim', rotulo: '% + volume absoluto' }, { valor: 'nao', rotulo: 'Somente %' }], estado.abs)}</div>` +
      cartao('Participação por tipo de veículo em cada categoria de velocidade', tabela,
        'Células destacadas: percentual ≥ 5% em categoria de volume pequeno (passe o mouse para ver o número de veículos).') +
      cartao('Composição por categoria (100%)', grafico) +
      cartao('Interpretação', interp);

    ligarSegmentado(el, 'abs', (v) => A[2](D, el, { abs: v }));
  };

  /* ======================================================================
   * ABA 3 — Distribuição por ponto monitorado
   * ==================================================================== */
  A[3] = function (D, el, estado) {
    R.mapa.limpar(el);
    const comum = R.periodoComum(D);
    estado = estado || { periodo: 'completo' };
    const periodo = estado.periodo === 'comum' && comum ? comum : null;
    const p = R.porEquipamento(D, periodo);
    const L = p.linhas;
    const tot = p.total;

    const tabVol = '<div class="tabela-rolagem"><table><thead><tr><th>Equipamento</th><th class="num">km</th><th>Município</th><th>Sentido · faixa</th>' +
      '<th>Período</th><th class="num">Dias com registro</th><th class="num">Volume total</th><th class="num">% do volume</th><th class="num">Média diária</th></tr></thead><tbody>' +
      L.map((l) => {
        const sf = Array.from(new Set(D.registros.filter((r) => r.e === l.eq.i).map((r) => r.s + ' · ' + r.f)));
        return `<tr><td>${esc(l.eq.id)}</td><td class="num">${R.dec(l.eq.km, 0)}</td><td>${esc(l.eq.municipio)}</td><td>${esc(sf.join('; '))}</td>` +
          `<td>${R.dataBR(l.datasMin)} – ${R.dataBR(l.datasMax)}</td><td class="num">${R.int(l.dias)}</td><td class="num">${R.int(l.total)}</td>` +
          `<td class="num">${R.pct(l.total / tot)}</td><td class="num">${R.int(l.mediaDiaria)}</td></tr>`;
      }).join('') + '</tbody></table></div>';

    const barrasMedia = G.barrasH(L.map((l) => ({
      rotulo: eqTxt(l.eq),
      valor: l.mediaDiaria,
      cor: 'var(--s1)',
      texto: R.int(l.mediaDiaria) + ' veíc./dia',
      dica: `${l.eq.id} · ${l.eq.municipio}\nMédia diária: ${R.int(l.mediaDiaria)} veículos\nTotal: ${R.int(l.total)} em ${l.dias} dias`,
    })));

    const linhasComp = (campoP, campoPor) => L.map((l) => ({ rotulo: eqTxt(l.eq), sub: l.eq.municipio, total: l.total, por: l[campoPor], p: l[campoP] }));

    const tabTipo = tabelaComposicao({
      rotuloLinha: 'Equipamento',
      cols: D.tipos.map((t) => ({ rotulo: t.nome })),
      mostrarAbs: false,
      linhas: linhasComp('pTipo', 'porTipo'),
      rodape: { rotulo: 'Todos os equipamentos', total: tot, por: p.totTipo, p: p.geralTipo },
    });
    const grafTipo = legendaTipos(D) + G.empilhadas(L.map((l) => ({
      rotulo: eqTxt(l.eq), sub: l.eq.municipio, segs: segsTipos(D, l.pTipo, l.porTipo, eqTxt(l.eq)),
    })));

    const velsPresentes = D.vels.filter((v) => p.totVel[v.i] > 0);
    const tabVel = '<div class="tabela-rolagem"><table><thead><tr><th>Equipamento</th>' +
      velsPresentes.map((v) => `<th class="num">${esc(v.rotulo)}</th>`).join('') + '</tr></thead><tbody>' +
      L.map((l) => `<tr><td>${esc(eqTxt(l.eq))}</td>` + velsPresentes.map((v) =>
        `<td class="num" data-dica="${esc(`${l.eq.id} · ${v.rotulo}\n${R.int(l.porVel[v.i])} veículos`)}">${R.pctFino(l.pVel[v.i])}</td>`).join('') + '</tr>').join('') +
      '</tbody><tfoot><tr><td>Todos</td>' + velsPresentes.map((v) => `<td class="num">${R.pctFino(p.geralVel[v.i])}</td>`).join('') + '</tr></tfoot></table></div>';
    const grafVel = legendaVels(D) + G.empilhadas(L.map((l) => ({
      rotulo: eqTxt(l.eq), sub: l.eq.municipio, segs: segsVels(D, l.pVel, l.porVel, eqTxt(l.eq)),
    })));

    /* ---------- interpretação ---------- */
    const ordMedia = L.slice().sort((a, b) => b.mediaDiaria - a.mediaDiaria);
    const maiorV = ordMedia[0], menorV = ordMedia[ordMedia.length - 1];

    const difTipos = D.tipos.map((t, i) => {
      const o = L.slice().sort((a, b) => b.pTipo[i] - a.pTipo[i]);
      return { t, i, max: o[0], min: o[o.length - 1], amp: o[0].pTipo[i] - o[o.length - 1].pTipo[i] };
    }).sort((a, b) => b.amp - a.amp);

    const domVel = L.map((l) => {
      const k = l.pVel.indexOf(Math.max.apply(null, l.pVel));
      return { l, vel: D.vels[k], p: l.pVel[k] };
    });
    const ate50 = (l) => D.vels.reduce((s, v) => s + (v.max <= 50 ? l.pVel[v.i] : 0), 0);
    const acima80 = (l) => D.vels.reduce((s, v) => s + (v.min > 80 ? l.pVel[v.i] : 0), 0);
    const dominantesDiferentes = new Set(domVel.map((x) => x.vel.i)).size > 1;
    const heterogeneo = difTipos[0].amp >= 0.10 || dominantesDiferentes;

    const afirmacoes = [];
    afirmacoes.push(`<li><strong>Volume:</strong> ${esc(eqTxt(maiorV.eq))} tem a maior média diária (${R.int(maiorV.mediaDiaria)} veículos/dia) e ${esc(eqTxt(menorV.eq))} a menor (${R.int(menorV.mediaDiaria)}), uma razão de ${R.dec(maiorV.mediaDiaria / menorV.mediaDiaria, 1)} vezes. ` +
      `Ordem decrescente: ${esc(ordMedia.map((l) => l.eq.id).join(' > '))}.</li>`);
    difTipos.filter((d) => d.amp >= 0.03).forEach((d) => {
      afirmacoes.push(`<li><strong>${esc(d.t.nome)}:</strong> varia de ${R.pct(d.min.pTipo[d.i])} (${esc(d.min.eq.id)}) a ${R.pct(d.max.pTipo[d.i])} (${esc(d.max.eq.id)}), amplitude de ${R.dec(d.amp * 100, 1)} p.p.</li>`);
    });
    const ausentes = [];
    L.forEach((l) => D.tipos.forEach((t, i) => {
      if (l.porTipo[i] === 0 && p.totTipo[i] > 0) ausentes.push(`${esc(l.eq.id)} não registra nenhum veículo do tipo "${esc(t.nome)}"`);
    }));
    if (ausentes.length) {
      afirmacoes.push(`<li><strong>Tipos ausentes:</strong> ${ausentes.join('; ')} no período considerado. Pode ser ausência real ou uma limitação de classificação do equipamento. O arquivo não permite distinguir.</li>`);
    }
    afirmacoes.push('<li><strong>Velocidade:</strong> ' + domVel.map((x) =>
      `em ${esc(x.l.eq.id)} predomina ${esc(x.vel.rotulo)} (${R.pct(x.p)}; até 50 km/h: ${R.pct(ate50(x.l))}; acima de 80 km/h: ${R.pctFino(acima80(x.l))})`).join('; ') + '.</li>');

    const nota = [];
    nota.push('Cada equipamento registra um único sentido e uma única faixa (ver aba 5). As diferenças entre pontos também coincidem com diferenças de sentido/faixa, e o arquivo não permite separar esses efeitos.');
    const maxDias = Math.max.apply(null, L.map((x) => x.dias));
    const parciais = periodo ? [] : L.filter((l) => l.dias < 0.5 * maxDias);
    if (parciais.length) {
      nota.push(parciais.map((l) => `${esc(l.eq.id)} cobre apenas ${R.dataBR(l.datasMin)} – ${R.dataBR(l.datasMax)} (${R.int(l.dias)} dias)`).join('; ') +
        (comum ? '. Compare também no período comum (botão acima) para que todos os pontos sejam observados nas mesmas datas.' : '.'));
    }

    const interp = `<div class="interpretacao">
      <div class="resposta"><strong>Existem trechos com composição de tráfego diferente?</strong>
      <p>${heterogeneo
        ? `<strong>Sim.</strong> O perfil não é homogêneo entre os pontos monitorados: a maior diferença de composição está em <strong>${esc(difTipos[0].t.nome)}</strong> (${R.dec(difTipos[0].amp * 100, 1)} p.p. entre ${esc(difTipos[0].max.eq.id)} e ${esc(difTipos[0].min.eq.id)})` +
          (dominantesDiferentes ? ', e a categoria de velocidade predominante não é a mesma em todos os equipamentos.' : '.')
        : '<strong>Não de forma marcante.</strong> As participações por tipo variam menos de 10 p.p. entre os pontos, e a categoria de velocidade predominante é a mesma em todos.'}</p></div>
      <h4 style="margin:14px 0 6px">O que pode ser afirmado diretamente com base no arquivo</h4>
      <ul>${afirmacoes.join('')}</ul>
      <h4 style="margin:14px 0 6px">Limites da interpretação</h4>
      <ul>${nota.map((n) => `<li>${n}</li>`).join('')}
      <li>O arquivo não traz limite de velocidade, características geométricas, uso do solo ou eventos externos. Por isso não é possível afirmar <em>por que</em> um ponto tem mais veículos comerciais ou velocidades menores. Os dados mostram apenas <em>que</em> há diferença.</li>
      <li>As categorias de velocidade descrevem a passagem pelo radar (o ponto), não a velocidade ao longo do trecho.</li></ul>
    </div>`;

    const controles = comum
      ? `<div class="controles"><span>Período:</span>${segmentado('periodo', [
        { valor: 'completo', rotulo: 'Completo (todos os registros)' },
        { valor: 'comum', rotulo: `Comum a todos (${R.dataBR(comum.ini)} – ${R.dataBR(comum.fim)})` }], estado.periodo)}</div>`
      : '';

    el.innerHTML =
      cabecalho('Distribuição por ponto monitorado',
        'Comparação entre os equipamentos (quilômetros) quanto ao volume, à participação por tipo de veículo e à distribuição das categorias de velocidade.',
        'O perfil do tráfego é homogêneo ao longo dos diferentes pontos monitorados da rodovia?') +
      controles +
      cartao('Volume por equipamento', tabVol + '<div style="margin-top:16px">' + barrasMedia + '</div>',
        'A média diária (volume ÷ dias com registro) neutraliza a diferença de cobertura temporal entre equipamentos.') +
      cartaoMapa('mapa-3', 'Mapa: volume e composição por ponto monitorado',
        'Tamanho da rosca proporcional à média diária de veículos (área). As fatias mostram a composição do ponto.',
        `<div class="controles">${segmentado('mapa3', [{ valor: 'tipo', rotulo: 'Tipo de veículo' }, { valor: 'vel', rotulo: 'Categoria de velocidade' }], 'tipo')}</div>` +
        '<div id="mapa-3-legenda"></div>') +
      '<div class="grade-2">' + cartao('Participação por tipo de veículo', tabTipo) + cartao('Composição por tipo (100%)', grafTipo) + '</div>' +
      '<div class="grade-2">' + cartao('Distribuição das categorias de velocidade', tabVel) + cartao('Velocidades (100%)', grafVel) + '</div>' +
      cartao('Interpretação', interp);

    ligarSegmentado(el, 'periodo', (v) => A[3](D, el, { periodo: v }));

    /* Mapa de roscas */
    const m3 = R.mapa.criar(el.querySelector('#mapa-3'), D);
    const maxMedia = Math.max.apply(null, L.map((l) => l.mediaDiaria));
    const R_MAX = 36;
    const desenhar3 = (modo) => {
      const porVel = modo === 'vel';
      const cores = porVel ? D.vels.map((v) => v.cor) : D.tipos.map((t) => t.cor);
      const nomes = porVel ? D.vels.map((v) => v.rotulo) : D.tipos.map((t) => t.nome);
      m3.simbolos(L.map((l) => {
        const r = Math.round(R.mapa.raio(l.mediaDiaria, maxMedia, R_MAX, 13));
        const fr = porVel ? l.pVel : l.pTipo;
        const linhas = nomes.map((n, i) => ({ n, f: fr[i] })).filter((x) => x.f >= 0.001)
          .map((x) => `${x.n}: ${R.pct(x.f)}`).join('\n');
        return {
          eq: l.eq,
          r,
          html: R.mapa.rosca(fr, cores, r),
          rotulo: `${l.eq.id} · ${R.int(l.mediaDiaria)}/dia`,
          dica: `${eqTxt(l.eq)} · ${l.eq.municipio}\nMédia diária: ${R.int(l.mediaDiaria)} veículos\n${linhas}`,
        };
      }));
      el.querySelector('#mapa-3-legenda').innerHTML =
        (porVel ? legendaVels(D) : legendaTipos(D)) +
        R.mapa.legendaTamanho(R.mapa.valoresLegenda(maxMedia), maxMedia, R_MAX, (v) => R.int(v) + ' veíc./dia');
    };
    desenhar3('tipo');
    ligarLocal(el, 'mapa3', desenhar3);
  };

  /* ======================================================================
   * ABA 4 — Variação temporal (dia da semana)
   * ==================================================================== */
  A[4] = function (D, el, estado) {
    R.mapa.limpar(el);
    estado = estado || { equipamento: '', excluir: false };
    const s = R.semana(D, {
      equipamento: estado.equipamento === '' ? null : +estado.equipamento,
      excluirAtipicos: estado.excluir,
    });
    const dias = s.dias;
    const ordMedia = dias.slice().sort((a, b) => b.media - a.media);
    const maior = ordMedia[0], menor = ordMedia[ordMedia.length - 1];
    const maiorAum = s.transicoes.slice().sort((a, b) => b.variacao - a.variacao)[0];
    const fds = (w) => w === 0 || w === 6;

    const tabDias = '<div class="tabela-rolagem"><table><thead><tr><th>Dia da semana</th><th class="num">Nº de datas</th>' +
      '<th class="num">Volume acumulado</th><th class="num">Média diária</th><th class="num">Var. vs. dia anterior</th>' +
      D.tipos.map((t) => `<th class="num">Média ${esc(t.nome)}</th>`).join('') + '</tr></thead><tbody>' +
      dias.map((d, i) => {
        const tr = s.transicoes[(i + 6) % 7];
        const cl = d === maior || d === menor ? 'lider' : '';
        return `<tr class="${cl}"><td>${esc(d.nome)}${d === maior ? ' <span class="marca-pequeno">maior</span>' : d === menor ? ' <span class="marca-pequeno">menor</span>' : ''}</td>` +
          `<td class="num">${R.int(d.n)}</td><td class="num">${R.int(d.soma)}</td><td class="num">${R.int(d.media)}</td>` +
          `<td class="num">${R.variacao(tr.variacao)}</td>` +
          d.mediaTipo.map((v) => `<td class="num">${R.int(v)}</td>`).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="nota">Média diária = volume acumulado no dia da semana ÷ número de datas desse dia da semana com registro no período. Assim se evita a distorção causada por quantidades diferentes de cada dia da semana.</p>';

    const colDias = G.colunas(dias.map((d) => ({
      rotulo: d.curto,
      valor: d.media,
      topo: R.int(d.media),
      cor: fds(d.w) ? 'var(--s2)' : 'var(--s1)',
      dica: `${d.nome}\nMédia diária: ${R.int(d.media)} veículos\n${d.n} datas · acumulado ${R.int(d.soma)}`,
    })), { classe: 'colunas-largas' });

    const tabTrans = '<div class="tabela-rolagem"><table><thead><tr><th>Transição</th><th class="num">Total</th>' +
      D.tipos.map((t) => `<th class="num">${esc(t.nome)}</th>`).join('') + '</tr></thead><tbody>' +
      s.transicoes.map((t) => `<tr class="${t === maiorAum ? 'lider' : ''}"><td>${esc(t.de.curto)} → ${esc(t.para.curto)}</td><td class="num">${R.variacao(t.variacao)}</td>` +
        t.variacaoTipo.map((v) => `<td class="num">${R.variacao(v)}</td>`).join('') + '</tr>').join('') +
      '</tbody></table></div>';

    /* Úteis × fim de semana */
    const U = s.uteis, F = s.fds;
    const tabUF = '<div class="tabela-rolagem"><table><thead><tr><th>Tipo</th><th class="num">% dias úteis</th><th class="num">% fim de semana</th>' +
      '<th class="num">Diferença</th><th class="num">Média/dia úteis</th><th class="num">Média/dia fim de sem.</th><th class="num">Variação</th></tr></thead><tbody>' +
      D.tipos.map((t, i) => `<tr><td>${esc(t.nome)}</td><td class="num">${R.pct(U.pTipo[i])}</td><td class="num">${R.pct(F.pTipo[i])}</td>` +
        `<td class="num">${R.pp(F.pTipo[i] - U.pTipo[i])}</td><td class="num">${R.int(U.mediaTipo[i])}</td><td class="num">${R.int(F.mediaTipo[i])}</td>` +
        `<td class="num">${R.variacao(F.mediaTipo[i] / U.mediaTipo[i] - 1)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Total</td><td class="num">100,0%</td><td class="num">100,0%</td><td></td><td class="num">${R.int(U.media)}</td><td class="num">${R.int(F.media)}</td><td class="num">${R.variacao(F.media / U.media - 1)}</td></tr></tfoot></table></div>`;
    const grafUF = legendaTipos(D) + G.empilhadas([
      { rotulo: 'Dias úteis', sub: `${U.n} datas`, segs: segsTipos(D, U.pTipo, U.mediaTipo.map(Math.round), 'Dias úteis (média/dia)') },
      { rotulo: 'Fim de semana', sub: `${F.n} datas`, segs: segsTipos(D, F.pTipo, F.mediaTipo.map(Math.round), 'Fim de semana (média/dia)') },
    ].concat(dias.map((d) => ({ rotulo: d.nome, segs: segsTipos(D, d.pTipo, d.mediaTipo.map(Math.round), d.nome + ' (média/dia)') }))));

    /* Índice por tipo */
    const tabIdx = '<div class="tabela-rolagem"><table><thead><tr><th>Tipo</th>' + dias.map((d) => `<th class="num">${esc(d.curto)}</th>`).join('') +
      '</tr></thead><tbody>' + D.tipos.map((t, k) => {
        const linha = s.indices.map((x) => x[k]);
        const mx = Math.max.apply(null, linha), mn = Math.min.apply(null, linha);
        return `<tr><td>${esc(t.nome)}</td>` + linha.map((v) =>
          `<td class="num"${v === mx ? ' style="font-weight:700"' : v === mn ? ' style="color:var(--texto-mudo)"' : ''}>${R.dec(v * 100, 0)}</td>`).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="nota">Índice = média diária do tipo no dia ÷ média diária do tipo na semana × 100. Valor 100 = dia típico do próprio tipo. Negrito: maior índice; cinza: menor.</p>';

    /* Aumento para o dia de pico */
    const iPico = dias.indexOf(maior);
    const trPico = s.transicoes[(iPico + 6) % 7];
    const contrib = D.tipos.map((t, k) => ({
      t, k,
      antes: trPico.de.mediaTipo[k],
      depois: trPico.para.mediaTipo[k],
      delta: trPico.deltaTipo[k],
      var: trPico.variacaoTipo[k],
      partAumento: trPico.delta ? trPico.deltaTipo[k] / trPico.delta : NaN,
      partVolume: trPico.de.media ? trPico.de.mediaTipo[k] / trPico.de.media : NaN,
    }));
    const tabContrib = '<div class="tabela-rolagem"><table><thead><tr><th>Tipo</th>' +
      `<th class="num">Média ${esc(trPico.de.curto)}</th><th class="num">Média ${esc(trPico.para.curto)}</th><th class="num">Δ veículos/dia</th>` +
      `<th class="num">Variação</th><th class="num">% do aumento</th><th class="num">% do volume (${esc(trPico.de.curto)})</th></tr></thead><tbody>` +
      contrib.map((c) => `<tr><td>${esc(c.t.nome)}</td><td class="num">${R.int(c.antes)}</td><td class="num">${R.int(c.depois)}</td>` +
        `<td class="num">${c.delta >= 0 ? '+' : '−'}${R.int(Math.abs(c.delta))}</td><td class="num">${R.variacao(c.var)}</td>` +
        `<td class="num">${R.pct(c.partAumento)}</td><td class="num">${R.pct(c.partVolume)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Total</td><td class="num">${R.int(trPico.de.media)}</td><td class="num">${R.int(trPico.para.media)}</td>` +
      `<td class="num">${trPico.delta >= 0 ? '+' : '−'}${R.int(Math.abs(trPico.delta))}</td><td class="num">${R.variacao(trPico.variacao)}</td><td class="num">100,0%</td><td class="num">100,0%</td></tr></tfoot></table></div>`;

    /* ---------- respostas ---------- */
    const difUF = D.tipos.map((t, i) => ({ t, i, d: F.pTipo[i] - U.pTipo[i], v: F.mediaTipo[i] / U.mediaTipo[i] - 1 }))
      .filter((x) => U.mediaTipo[x.i] > 0)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const mudaPerfil = Math.abs(difUF[0].d) >= 0.02;
    const contribValidos = contrib.filter((c) => c.antes > 0);
    const vars = contribValidos.map((c) => c.var);
    const amplVar = Math.max.apply(null, vars) - Math.min.apply(null, vars);
    const lider = contrib.slice().sort((a, b) => b.delta - a.delta)[0];
    /* "Igualmente" = variações percentuais dos tipos a menos de 3 p.p. umas das outras. */
    const igual = amplVar < 0.03;
    const quedas = contribValidos.filter((c) => c.delta < 0);

    const respostas = `<div class="interpretacao">
      <div class="resposta"><strong>Maior volume médio diário</strong><p>${esc(maior.nome)}: ${R.int(maior.media)} veículos/dia (${R.variacao(maior.media / (dias.reduce((a, d) => a + d.media, 0) / 7) - 1)} em relação à média dos 7 dias).</p></div>
      <div class="resposta"><strong>Menor volume médio diário</strong><p>${esc(menor.nome)}: ${R.int(menor.media)} veículos/dia, ${R.variacao(menor.media / maior.media - 1)} em relação a ${esc(maior.nome.toLowerCase())}.</p></div>
      <div class="resposta"><strong>Maior aumento percentual entre dias consecutivos</strong><p>${esc(maiorAum.de.nome)} → ${esc(maiorAum.para.nome)}: ${R.variacao(maiorAum.variacao)} (de ${R.int(maiorAum.de.media)} para ${R.int(maiorAum.para.media)} veículos/dia).` +
        (() => {
          const seg = s.transicoes.filter((t) => t !== maiorAum).sort((a, b) => b.variacao - a.variacao)[0];
          return seg && seg.variacao > 0 ? ` O segundo maior é ${esc(seg.de.nome)} → ${esc(seg.para.nome)} (${R.variacao(seg.variacao)}).` : '';
        })() + `</p></div>
      <div class="resposta"><strong>O perfil de tipos muda entre dias úteis e fim de semana?</strong><p>${mudaPerfil
        ? `<strong>Sim.</strong> No fim de semana, ${difUF.filter((x) => Math.abs(x.d) >= 0.005).map((x) => `${esc(x.t.nome)} ${x.d > 0 ? 'ganha' : 'perde'} ${R.dec(Math.abs(x.d) * 100, 1)} p.p. de participação (${R.pct(U.pTipo[x.i])} → ${R.pct(F.pTipo[x.i])})`).join('; ')}. ` +
          `Em média diária, ${difUF.map((x) => `${esc(x.t.nome)} ${R.variacao(x.v)}`).join(', ')} no fim de semana em relação aos dias úteis.`
        : `<strong>Pouco.</strong> A maior diferença de participação é de ${R.dec(Math.abs(difUF[0].d) * 100, 1)} p.p. (${esc(difUF[0].t.nome)}).`}</p></div>
      <div class="resposta"><strong>O aumento ao final da semana é explicado igualmente por todas as categorias?</strong><p>Considerando a transição para o dia de maior média (${esc(trPico.de.nome)} → ${esc(trPico.para.nome)}, ${R.variacao(trPico.variacao)}): ${igual
        ? '<strong>Sim, aproximadamente.</strong> Todos os tipos crescem em proporções parecidas'
        : '<strong>Não.</strong> Os tipos variam em ritmos diferentes'} (${contribValidos.map((c) => `${esc(c.t.nome)} ${R.variacao(c.var)}`).join(', ')}). ` +
        `${esc(lider.t.nome)} responde por ${R.pct(lider.partAumento)} do aumento de ${R.int(trPico.delta)} veículos/dia, ${lider.partAumento > lider.partVolume + 0.02 ? 'embora represente apenas' : 'e representa'} ${R.pct(lider.partVolume)} do volume de ${esc(trPico.de.nome.toLowerCase())}` +
        (quedas.length && lider.partAumento > 1 ? `. A participação passa de 100% porque ${esc(R.listaTexto(quedas.map((c) => c.t.nome)))} ${quedas.length > 1 ? 'diminuem' : 'diminui'} nessa transição` : '') + `.</p></div>
    </div>`;

    const opcoesEq = '<option value="">Todos os equipamentos</option>' + D.equipamentos.map((e) =>
      `<option value="${e.i}"${String(e.i) === estado.equipamento ? ' selected' : ''}>${esc(eqTxt(e))} · ${esc(e.municipio)}</option>`).join('');

    const avisoCobertura = estado.equipamento === ''
      ? '<p class="nota">Com "todos os equipamentos", o total diário depende de quantos radares estavam ativos em cada data. Datas sem registro não entram na média. Use o seletor para conferir se o padrão se mantém em cada equipamento.</p>'
      : '';

    el.innerHTML =
      cabecalho('Variação temporal do tráfego',
        'Dia da semana derivado de <code>data_da_passagem</code>. Todas as comparações usam a média diária por dia da semana, e não a soma acumulada.',
        'Como o volume e a composição do tráfego variam ao longo da semana?') +
      `<div class="controles"><label>Equipamento <select data-controle="eq">${opcoesEq}</select></label>` +
      `<label><input type="checkbox" data-controle="excluir"${estado.excluir ? ' checked' : ''}> Excluir dias atípicos (${plural(s.atipicos.length, 'data', 'datas')} com volume &lt; 20% da mediana diária)</label></div>` +
      cartao('Respostas', respostas + avisoCobertura) +
      '<div class="grade-2">' +
      cartao('Volume médio diário por dia da semana', G.legenda([{ rotulo: 'Dia útil', cor: 'var(--s1)' }, { rotulo: 'Fim de semana', cor: 'var(--s2)' }]) + colDias) +
      cartao('Variação percentual entre dias consecutivos', tabTrans, 'Variação da média diária total e por tipo de veículo.') + '</div>' +
      cartao('Médias por dia da semana', tabDias) +
      '<div class="grade-2">' +
      cartao('Composição: dias úteis × fim de semana', tabUF) +
      cartao('Composição por dia (100%)', grafUF) + '</div>' +
      '<div class="grade-2">' +
      cartao(`Decomposição do aumento ${trPico.de.curto} → ${trPico.para.curto}`, tabContrib, 'Quanto cada tipo contribui para o aumento até o dia de maior volume.') +
      cartao('Índice semanal por tipo de veículo', tabIdx, 'Mostra se cada tipo segue o mesmo ritmo semanal.') + '</div>' +
      cartaoMapa('mapa-4', 'Mapa: variação do fim de semana em relação aos dias úteis',
        'Para cada radar: média diária no fim de semana ÷ média diária nos dias úteis − 1. Tamanho proporcional à magnitude da variação; cor indica o sinal.',
        `<div class="controles">${segmentado('mapa4', [{ valor: '-1', rotulo: 'Total' }].concat(D.tipos.map((t) => ({ valor: String(t.i), rotulo: t.nome }))), '-1')}</div>` +
        G.legenda([{ rotulo: 'Queda no fim de semana', cor: 'var(--s1)' }, { rotulo: 'Aumento no fim de semana', cor: 'var(--s8)' }]));

    el.querySelector('[data-controle="eq"]').addEventListener('change', (ev) =>
      A[4](D, el, { equipamento: ev.target.value, excluir: estado.excluir }));
    el.querySelector('[data-controle="excluir"]').addEventListener('change', (ev) =>
      A[4](D, el, { equipamento: estado.equipamento, excluir: ev.target.checked }));

    /* Mapa: variação fim de semana × dias úteis por equipamento */
    const porEq = D.equipamentos.map((e) => ({ e, s: R.semana(D, { equipamento: e.i, excluirAtipicos: estado.excluir }) }));
    const m4 = R.mapa.criar(el.querySelector('#mapa-4'), D);
    const desenhar4 = (valor) => {
      const k = +valor;
      const nome = k < 0 ? 'Total' : D.tipos[k].nome;
      const itens = porEq.map((x) => {
        const u = k < 0 ? x.s.uteis.media : x.s.uteis.mediaTipo[k];
        const f = k < 0 ? x.s.fds.media : x.s.fds.mediaTipo[k];
        return { x, u, f, v: u > 0 ? f / u - 1 : NaN };
      });
      const maxAbs = Math.max.apply(null, itens.filter((i) => isFinite(i.v)).map((i) => Math.abs(i.v))) || 1;
      m4.simbolos(itens.map((i) => {
        const r = isFinite(i.v) ? Math.round(R.mapa.raio(Math.abs(i.v), maxAbs, 30, 8)) : 6;
        return {
          eq: i.x.e,
          r,
          html: R.mapa.circulo(r, !isFinite(i.v) ? 'var(--grade)' : i.v < 0 ? 'var(--s1)' : 'var(--s8)'),
          rotulo: `${i.x.e.id} ${isFinite(i.v) ? R.variacao(i.v) : 's/ dados'}`,
          dica: `${eqTxt(i.x.e)} · ${nome}\nDias úteis: ${R.int(i.u)} /dia\nFim de semana: ${R.int(i.f)} /dia\nVariação: ${R.variacao(i.v)}`,
        };
      }));
    };
    desenhar4('-1');
    ligarLocal(el, 'mapa4', desenhar4);
  };

  /* ======================================================================
   * ABA 5 — Análise espacial e operacional
   * ==================================================================== */
  A[5] = function (D, el) {
    R.mapa.limpar(el);
    const o = R.operacional(D);
    const tot = o.total;

    const tabCombos = '<div class="tabela-rolagem"><table><thead><tr><th>Equipamento</th><th>Município</th><th>Sentido</th><th>Faixa</th>' +
      '<th class="num">Dias</th><th class="num">Volume</th><th class="num">Média diária</th></tr></thead><tbody>' +
      o.combos.linhas.map((l) => `<tr><td>${esc(eqTxt(l.eq))}</td><td>${esc(l.eq.municipio)}</td><td>${esc(l.sentido)}</td><td>${esc(l.faixa)}</td>` +
        `<td class="num">${R.int(l.dias)}</td><td class="num">${R.int(l.total)}</td><td class="num">${R.int(l.mediaDiaria)}</td></tr>`).join('') +
      '</tbody></table></div>';

    const grupoOp = (titulo, prefixo, g) => {
      const linhas = g.linhas;
      const tabVol = '<div class="tabela-rolagem"><table><thead><tr>' +
        `<th>${esc(titulo)}</th><th>Equipamentos</th><th class="num">Volume</th><th class="num">% do total</th><th class="num">Média diária*</th><th class="num">Média por radar-dia**</th><th class="num">&gt; 100 km/h</th></tr></thead><tbody>` +
        linhas.map((l) => `<tr><td>${esc(prefixo + l.chave)}</td><td>${esc(l.eqs.join(', '))}</td><td class="num">${R.int(l.total)}</td>` +
          `<td class="num">${R.pct(l.total / tot)}</td><td class="num">${R.int(l.mediaDiaria)}</td><td class="num">${R.int(l.mediaEqDia)}</td><td class="num">${R.int(l.acima100)} (${R.pctFino(l.acima100 / l.total)})</td></tr>`).join('') +
        '</tbody></table></div>';
      const tabTipo = tabelaComposicao({
        rotuloLinha: titulo,
        cols: D.tipos.map((t) => ({ rotulo: t.nome })),
        mostrarAbs: false,
        linhas: linhas.map((l) => ({ rotulo: prefixo + l.chave, total: l.total, por: l.porTipo, p: l.pTipo })),
      });
      const velsPres = D.vels.filter((v) => g.totVel[v.i] > 0);
      const tabVel = '<div class="tabela-rolagem"><table><thead><tr>' + `<th>${esc(titulo)}</th>` +
        velsPres.map((v) => `<th class="num">${esc(v.rotulo)}</th>`).join('') + '</tr></thead><tbody>' +
        linhas.map((l) => `<tr><td>${esc(prefixo + l.chave)}</td>` + velsPres.map((v) =>
          `<td class="num" data-dica="${esc(`${prefixo + l.chave} · ${v.rotulo}\n${R.int(l.porVel[v.i])} veículos`)}">${R.pctFino(l.pVel[v.i])}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>';
      const graf = legendaTipos(D) + G.empilhadas(linhas.map((l) => ({ rotulo: prefixo + l.chave, segs: segsTipos(D, l.pTipo, l.porTipo, prefixo + l.chave) }))) +
        '<div style="height:14px"></div>' + legendaVels(D) +
        G.empilhadas(linhas.map((l) => ({ rotulo: prefixo + l.chave, segs: segsVels(D, l.pVel, l.porVel, prefixo + l.chave) })));
      return cartao(`Por ${titulo.toLowerCase()}`,
        '<h4 style="margin:0 0 6px">Volume</h4>' + tabVol +
        '<h4 style="margin:16px 0 6px">Composição por tipo de veículo</h4>' + tabTipo +
        '<h4 style="margin:16px 0 6px">Distribuição das velocidades</h4>' + tabVel +
        '<div style="margin-top:16px">' + graf + '</div>' +
        '<p class="nota">* Média diária = volume ÷ datas com registro no grupo (soma os equipamentos do grupo). ** Média por radar-dia = volume ÷ combinações equipamento × data. Essa medida permite comparar grupos com números diferentes de radares.</p>');
    };

    /* Diferenças entre sentidos (texto) */
    const S = o.sentidos.linhas;
    const textoSentidos = (() => {
      if (S.length < 2) return '';
      const a = S[0], b = S[1];
      const difs = D.tipos.map((t, i) => ({ t, d: a.pTipo[i] - b.pTipo[i] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
      const ac80 = (l) => D.vels.reduce((s, v) => s + (v.min > 80 ? l.pVel[v.i] : 0), 0);
      const dom = (l) => { const k = l.pVel.indexOf(Math.max.apply(null, l.pVel)); return D.vels[k].rotulo + ' (' + R.pct(l.pVel[k]) + ')'; };
      return `<li><strong>Volume:</strong> ${esc(a.chave)} soma ${R.int(a.total)} veículos (${R.pct(a.total / tot)}, ${plural(a.eqs.length, 'equipamento', 'equipamentos')}) e ${esc(b.chave)} ${R.int(b.total)} (${R.pct(b.total / tot)}, ${plural(b.eqs.length, 'equipamento', 'equipamentos')}). ` +
        `Em média diária: ${R.int(a.mediaDiaria)} × ${R.int(b.mediaDiaria)}. Por radar-dia: ${R.int(a.mediaEqDia)} × ${R.int(b.mediaEqDia)}` +
        (a.eqs.length !== b.eqs.length ? '. A diferença no total reflete, em parte, o número de radares em cada sentido.' : '.') + '</li>' +
        `<li><strong>Composição:</strong> a maior diferença está em ${esc(difs[0].t.nome)}: ${R.pct(a.pTipo[difs[0].t.i])} (${esc(a.chave)}) × ${R.pct(b.pTipo[difs[0].t.i])} (${esc(b.chave)}).</li>` +
        `<li><strong>Velocidade:</strong> categoria predominante em ${esc(a.chave)}: ${esc(dom(a))}; em ${esc(b.chave)}: ${esc(dom(b))}. Acima de 80 km/h: ${R.pctFino(ac80(a))} × ${R.pctFino(ac80(b))}.</li>`;
    })();

    /* Sentido e faixa são equivalentes quando cada sentido usa uma única faixa (e vice-versa). */
    const faixaDoSentido = new Map();
    const sentidoDaFaixa = new Map();
    o.combos.linhas.forEach((l) => {
      faixaDoSentido.set(l.sentido, (faixaDoSentido.get(l.sentido) || new Set()).add(l.faixa));
      sentidoDaFaixa.set(l.faixa, (sentidoDaFaixa.get(l.faixa) || new Set()).add(l.sentido));
    });
    const sentidoDefineFaixa = Array.from(faixaDoSentido.values()).every((x) => x.size === 1) &&
      Array.from(sentidoDaFaixa.values()).every((x) => x.size === 1);
    faixaDoSentido.forEach((v, k) => faixaDoSentido.set(k, Array.from(v)[0]));

    const aviso = o.umSentidoFaixaPorEq
      ? `<div class="aviso"><p><strong>Atenção: sentido e faixa coincidem com o equipamento.</strong> Cada radar registra apenas um sentido e uma faixa: ` +
        o.combos.linhas.map((l) => `${esc(l.eq.id)} → ${esc(l.sentido)}, faixa ${esc(l.faixa)}`).join('; ') +
        '. Por isso, comparar sentidos ou faixas equivale a comparar grupos de equipamentos (pontos diferentes da rodovia). As diferenças observadas não podem ser atribuídas ao sentido ou à faixa isoladamente.</p></div>'
      : '';

    /* ---------- > 100 km/h ---------- */
    const velsAcima = D.vels.filter((v) => v.acima100);
    const lAbs = o.porAbs[0], lProp = o.porProp[0];
    const tabRank = '<div class="tabela-rolagem"><table><thead><tr><th>Equipamento</th><th>Período</th><th class="num">Volume total</th>' +
      velsAcima.map((v) => `<th class="num">${esc(v.rotulo)}</th>`).join('') +
      '<th class="num">&gt; 100 km/h</th><th class="num">Ranking absoluto</th><th class="num">Proporção</th><th class="num">Por 100 mil veíc.</th><th class="num">Ranking proporção</th></tr></thead><tbody>' +
      o.porAbs.map((x) => `<tr><td>${esc(eqTxt(x.eq))}</td><td>${R.dataBR(x.ini)} – ${R.dataBR(x.fim)}</td><td class="num">${R.int(x.total)}</td>` +
        x.porVelAcima.map((y) => `<td class="num">${R.int(y.volume)}</td>`).join('') +
        `<td class="num"><strong>${R.int(x.acima)}</strong></td><td class="num">${x.rankAbs}º</td>` +
        `<td class="num"><strong>${R.pctFino(x.prop)}</strong></td><td class="num">${R.dec(x.prop * 1e5, 1)}</td><td class="num">${x.rankProp}º</td></tr>`).join('') +
      `</tbody><tfoot><tr><td colspan="2">Todos</td><td class="num">${R.int(tot)}</td>` +
      velsAcima.map((v) => `<td class="num">${R.int(o.porAbs.reduce((s, x) => s + x.porVelAcima.find((y) => y.vel === v).volume, 0))}</td>`).join('') +
      `<td class="num">${R.int(o.totalAcima)}</td><td></td><td class="num">${R.pctFino(o.totalAcima / tot)}</td><td class="num">${R.dec((o.totalAcima / tot) * 1e5, 1)}</td><td></td></tr></tfoot></table></div>`;

    const barrasAbs = G.barrasH(o.porAbs.map((x) => ({
      rotulo: x.eq.id, valor: x.acima, cor: 'var(--s1)', texto: R.int(x.acima),
      dica: `${x.eq.id}\n${R.int(x.acima)} veículos acima de 100 km/h\nde ${R.int(x.total)} no total`,
    })));
    const barrasProp = G.barrasH(o.porProp.map((x) => ({
      rotulo: x.eq.id, valor: x.prop, cor: 'var(--s2)', texto: R.pctFino(x.prop),
      dica: `${x.eq.id}\n${R.pctFino(x.prop)} do próprio volume\n(${R.int(x.acima)} de ${R.int(x.total)})`,
    })));

    const mesmoLider = lAbs === lProp;
    const rankAbsTxt = o.porAbs.map((x) => x.eq.id).join(' > ');
    const rankPropTxt = o.porProp.map((x) => x.eq.id).join(' > ');
    const maxTotal = Math.max.apply(null, o.porAbs.map((x) => x.total));
    const menorTotal = o.porAbs.slice().sort((a, b) => a.total - b.total)[0];

    const explic = `<div class="interpretacao">
      <div class="resposta"><strong>Maior volume absoluto acima de 100 km/h</strong><p>${esc(eqTxt(lAbs.eq))}, em ${esc(lAbs.eq.municipio)}: <strong>${plural(lAbs.acima, 'veículo', 'veículos')}</strong> (${R.pct(lAbs.acima / o.totalAcima)} de todos os registros acima de 100 km/h do arquivo), o que equivale a ${R.pctFino(lAbs.prop)} do seu volume.</p></div>
      <div class="resposta"><strong>Maior proporção acima de 100 km/h em relação ao próprio volume</strong><p>${esc(eqTxt(lProp.eq))}, em ${esc(lProp.eq.municipio)}: <strong>${R.pctFino(lProp.prop)}</strong> (${R.dec(lProp.prop * 1e5, 1)} a cada 100 mil veículos; ${plural(lProp.acima, 'veículo', 'veículos')} de ${R.int(lProp.total)}).</p></div>
      <h4 style="margin:14px 0 6px">Por que os rankings ${mesmoLider ? 'podem diferir' : 'diferem'}</h4>
      <p>Ranking absoluto: ${esc(rankAbsTxt)}. Ranking por proporção: ${esc(rankPropTxt)}.${mesmoLider ? ' Neste arquivo o líder coincide, mas a ordem dos demais pode mudar.' : ''}</p>
      <ul>
        <li><strong>A quantidade absoluta mistura duas coisas:</strong> quantos veículos passam pelo ponto e com que frequência eles excedem 100 km/h. Um equipamento com muito tráfego acumula muitos casos mesmo com uma proporção baixa. ${esc(lAbs.eq.id)} registrou ${R.int(lAbs.total)} veículos, ${R.dec(lAbs.total / menorTotal.total, 0)} vezes o volume de ${esc(menorTotal.eq.id)}.</li>
        <li><strong>A proporção isola a frequência relativa:</strong> divide os casos pelo volume do próprio equipamento e permite comparar pontos com fluxos diferentes. É a medida adequada para responder "onde é mais comum passar acima de 100 km/h".</li>
        <li><strong>O denominador também depende da cobertura temporal:</strong> ${o.porAbs.filter((x) => x.dias < 0.5 * Math.max.apply(null, o.porAbs.map((y) => y.dias))).map((x) => `${esc(x.eq.id)} só tem ${R.int(x.dias)} dias de registro (${R.dataBR(x.ini)} – ${R.dataBR(x.fim)})`).join('; ') || 'os equipamentos têm números de dias de registro diferentes'}, o que reduz seu volume absoluto sem alterar necessariamente a proporção.</li>
        ${lProp.acima < 1000 ? `<li><strong>Numeradores e denominadores menores tornam a proporção menos estável:</strong> ${esc(lProp.eq.id)} tem ${plural(lProp.acima, 'veículo', 'veículos')} acima de 100 km/h em ${R.int(lProp.total)} veículos. Variações de algumas dezenas de registros mudam sua proporção de forma perceptível, enquanto o ranking absoluto é dominado pelos pontos de maior fluxo.</li>` : ''}
        ${lProp.dias < 0.5 * Math.max.apply(null, o.porAbs.map((y) => y.dias)) ? `<li><strong>Períodos diferentes:</strong> a proporção de ${esc(lProp.eq.id)} se refere a ${R.dataBR(lProp.ini)} – ${R.dataBR(lProp.fim)}, enquanto os demais equipamentos cobrem um período bem mais longo. A comparação de proporções supõe que o comportamento seja comparável entre esses períodos, o que o arquivo não permite verificar para esse ponto.</li>` : ''}
        <li>Por isso as duas medidas respondem a perguntas diferentes, uma sobre <em>quantidade de ocorrências</em> e outra sobre <em>intensidade relativa</em>, e não devem ser interpretadas como a mesma coisa. Nenhuma delas, sozinha, explica a causa das velocidades altas, porque o arquivo não traz limite de velocidade nem condições da via.</li>
      </ul>
      <p class="nota">Categorias consideradas "acima de 100 km/h": ${esc(velsAcima.map((v) => v.rotulo).join(', '))}. Elas somam ${R.int(o.totalAcima)} veículos, ${R.pctFino(o.totalAcima / tot)} do total (maior volume total de um equipamento: ${R.int(maxTotal)}).</p>
    </div>`;

    el.innerHTML =
      cabecalho('Análise espacial e operacional',
        'Comparação entre sentidos de circulação e faixas da pista (volume, composição e velocidades), seguida da análise de veículos acima de 100 km/h por equipamento.') +
      aviso +
      cartao('Combinações registradas (equipamento × sentido × faixa)', tabCombos) +
      '<div class="grade-2">' + grupoOp('Sentido', '', o.sentidos) + grupoOp('Faixa', 'Faixa ', o.faixas) + '</div>' +
      cartao('Diferenças entre sentidos', `<div class="interpretacao"><ul>${textoSentidos}</ul>` +
        (sentidoDefineFaixa ? `<p class="nota">Como faixa e sentido coincidem (${esc(Array.from(faixaDoSentido, ([s, f]) => `faixa ${f} = ${s.toLowerCase()}`).join('; '))}), as diferenças entre faixas são exatamente as mesmas.</p>` : '') + '</div>') +
      '<h2 style="margin:28px 0 12px">Veículos acima de 100 km/h por equipamento</h2>' +
      cartao('Ranking: quantidade absoluta × proporção', tabRank) +
      '<div class="grade-2">' + cartao('Quantidade absoluta (> 100 km/h)', barrasAbs) + cartao('Proporção do próprio volume (> 100 km/h)', barrasProp) + '</div>' +
      cartaoMapa('mapa-5', 'Mapa: veículos acima de 100 km/h por radar',
        'Compare as duas medidas no espaço: o tamanho do círculo muda conforme a métrica escolhida.',
        `<div class="controles">${segmentado('mapa5', [{ valor: 'abs', rotulo: 'Quantidade absoluta' }, { valor: 'prop', rotulo: 'Proporção do próprio volume' }], 'abs')}</div>` +
        '<div id="mapa-5-legenda"></div>') +
      cartao('Respostas e interpretação', explic);

    const m5 = R.mapa.criar(el.querySelector('#mapa-5'), D);
    const desenhar5 = (modo) => {
      const prop = modo === 'prop';
      const val = (x) => (prop ? x.prop : x.acima);
      const max = Math.max.apply(null, o.porAbs.map(val)) || 1;
      const fmt = (v) => (prop ? R.pctFino(v) : R.int(v) + ' veíc.');
      m5.simbolos(o.porAbs.map((x) => {
        const r = Math.round(R.mapa.raio(val(x), max, 34, 6));
        return {
          eq: x.eq,
          r,
          html: R.mapa.circulo(r, prop ? 'var(--s2)' : 'var(--s1)'),
          rotulo: `${x.eq.id} · ${fmt(val(x))}`,
          dica: `${eqTxt(x.eq)} · ${x.eq.municipio}\nAcima de 100 km/h: ${R.int(x.acima)} veículos (${x.rankAbs}º)\nProporção: ${R.pctFino(x.prop)} (${x.rankProp}º)\nVolume total: ${R.int(x.total)}`,
        };
      }));
      el.querySelector('#mapa-5-legenda').innerHTML = R.mapa.legendaTamanho(R.mapa.valoresLegenda(max), max, 34, fmt);
    };
    desenhar5('abs');
    ligarLocal(el, 'mapa5', desenhar5);
  };

  /* ======================================================================
   * ABA 6 — Painel interativo (estilo Power BI) + exportação e incorporação
   * ==================================================================== */

  /* Rótulo de velocidade no formato dos CSVs de powerbi/ ("<= 20 km/h", "21-50 km/h", "> 160 km/h"). */
  const velCSV = (v) => (v.min === 0 ? `<= ${v.max} km/h` : v.max === Infinity ? `> ${v.min - 1} km/h` : `${v.min}-${v.max} km/h`);

  function baixarCSV(nome, linhas) {
    const texto = '﻿' + linhas.map((l) => l.map((c) => {
      const s = String(c);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  A[6] = function (D, el) {
    R.mapa.limpar(el);
    const f = { ano: '', eqs: new Set(), tipos: new Set(), sentidos: new Set(), dias: new Set() };
    const sentidos = Array.from(new Set(D.registros.map((r) => r.s))).sort();
    const cfg = window.RADAR_CONFIG || {};

    const embed = cfg.powerBiUrl
      ? `<div class="pbi-embed"><iframe title="Relatório Power BI" src="${esc(cfg.powerBiUrl)}" allowfullscreen loading="lazy"></iframe></div>`
      : `<div class="aviso"><p><strong>Nenhum relatório configurado.</strong> Publique o relatório no Power BI e cole o link de incorporação em <code>js/config.js</code> (campo <code>powerBiUrl</code>). O passo a passo está em <code>powerbi/README.md</code>.</p></div>`;

    el.innerHTML =
      cabecalho('Painel interativo',
        'Painel no estilo Power BI: use as segmentações ou clique nas barras, colunas e círculos do mapa para filtrar todos os visuais. Clique de novo para remover o filtro. Em cada visual, os itens fora da seleção ficam esmaecidos.') +
      '<div class="cartao painel-filtros" id="p6-filtros"></div>' +
      '<div class="kpis" id="p6-kpis"></div>' +
      '<div class="grade-2">' +
      cartao('Volume mensal', '<div id="p6-mes"></div>') +
      cartao('Média diária por dia da semana', '<div id="p6-dia"></div>', 'Clique em um dia para filtrar.') + '</div>' +
      '<div class="grade-3">' +
      cartao('Volume por tipo de veículo', '<div id="p6-tipo"></div>', 'Clique para filtrar.') +
      cartao('Média diária por equipamento', '<div id="p6-eq"></div>', 'Clique para filtrar.') +
      cartao('Volume por sentido', '<div id="p6-sentido"></div>', 'Clique para filtrar.') + '</div>' +
      '<div class="grade-2">' +
      cartaoMapa('mapa-6', 'Mapa: volume por radar na seleção', 'Tamanho proporcional ao volume no filtro atual. Clique em um círculo para filtrar o equipamento.') +
      '<div>' + cartao('Distribuição por categoria de velocidade', '<div id="p6-vel"></div>') +
      cartao('Matriz: equipamento × tipo de veículo', '<div id="p6-matriz"></div>') + '</div></div>' +
      cartao('Exportar para o Power BI',
        '<div class="controles">' +
        '<button type="button" class="botao" data-exportar="fato">Exportar seleção (fato_volume.csv)</button>' +
        '<button type="button" class="botao secundario" data-exportar="dim_eq">dim_equipamento.csv</button>' +
        '<button type="button" class="botao secundario" data-exportar="dim_vel">dim_velocidade.csv</button>' +
        '</div>' +
        '<p>Os arquivos usam o mesmo formato da pasta <code>powerbi/</code> do projeto (UTF-8, separador <code>;</code>). Para montar o relatório, use ' +
        '<a href="powerbi/consultas.pq" download>consultas.pq</a> (Power Query), <a href="powerbi/medidas.dax" download>medidas.dax</a> (medidas DAX) e o guia ' +
        '<a href="powerbi/README.md" target="_blank" rel="noopener">powerbi/README.md</a>.</p>',
        'Gera CSVs do recorte filtrado acima, prontos para o modelo estrela (fato + dimensões).') +
      cartao('Relatório Power BI incorporado', embed);

    const m6 = R.mapa.criar(el.querySelector('#mapa-6'), D);
    const alternar = (conj, v) => { if (conj.has(v)) conj.delete(v); else conj.add(v); };

    function chips(rotulo, dim, itens) {
      return `<div class="grupo-filtro"><span class="rotulo-filtro">${esc(rotulo)}</span><div class="chips">` +
        itens.map((x) => `<button type="button" class="chip" data-f="${dim}" data-v="${esc(x.v)}" aria-pressed="${f[dim].has(x.v)}">${esc(x.rotulo)}</button>`).join('') +
        '</div></div>';
    }

    function render() {
      const p = R.painel(D, f);
      const algumFiltro = f.ano || f.eqs.size || f.tipos.size || f.sentidos.size || f.dias.size;

      el.querySelector('#p6-filtros').innerHTML =
        '<div class="filtros-linha">' +
        `<div class="grupo-filtro"><span class="rotulo-filtro">Ano</span><select data-f-ano><option value="">Todos</option>` +
        p.anos.map((a) => `<option${a === f.ano ? ' selected' : ''}>${a}</option>`).join('') + '</select></div>' +
        chips('Equipamento', 'eqs', D.equipamentos.map((e) => ({ v: e.i, rotulo: e.id }))) +
        chips('Tipo de veículo', 'tipos', D.tipos.map((t) => ({ v: t.i, rotulo: t.nome }))) +
        chips('Sentido', 'sentidos', sentidos.map((s) => ({ v: s, rotulo: s }))) +
        chips('Dia da semana', 'dias', R.ORDEM_SEMANA.map((w) => ({ v: w, rotulo: R.NOME_DIA_CURTO[w] }))) +
        `<button type="button" class="botao secundario" data-f="limpar"${algumFiltro ? '' : ' disabled'}>Limpar filtros</button>` +
        '</div>';

      el.querySelector('#p6-kpis').innerHTML =
        kpi('Volume', R.int(p.total), `${plural(p.dias, 'dia', 'dias')} com registro`) +
        kpi('Média diária', R.int(p.mediaDiaria), 'veículos por dia (todos os radares do filtro)') +
        kpi('Média por radar-dia', R.int(p.mediaRadarDia), `${R.int(p.radarDias)} combinações radar × dia`) +
        kpi('Acima de 100 km/h', R.int(p.acima), `${R.pctFino(p.total ? p.acima / p.total : 0)} · ${R.dec(p.total ? (p.acima / p.total) * 1e5 : 0, 1)} por 100 mil`);

      /* volume mensal */
      el.querySelector('#p6-mes').innerHTML = p.meses.length
        ? G.colunas(p.meses.map((m) => ({
          rotulo: m.mes.slice(5) === '01' || p.meses.length < 14 ? (p.meses.length < 14 ? R.mesBR(m.mes) : m.mes.slice(0, 4)) : '',
          valor: m.volume,
          dica: `${R.mesBR(m.mes)}\n${R.int(m.volume)} veículos`,
        })), { semTopo: true })
        : '<p class="nota">Sem registros na seleção.</p>';

      /* dia da semana */
      el.querySelector('#p6-dia').innerHTML = G.colunas(p.realceDia.map((d) => ({
        rotulo: R.NOME_DIA_CURTO[d.w],
        valor: d.media,
        topo: R.int(d.media),
        cor: d.w === 0 || d.w === 6 ? 'var(--s2)' : 'var(--s1)',
        apagado: f.dias.size > 0 && !f.dias.has(d.w),
        attrs: `data-f="dias" data-v="${d.w}" role="button" tabindex="0"`,
        dica: `${R.NOME_DIA[d.w]}\nMédia diária: ${R.int(d.media)}\n${d.n} datas`,
      })), { classe: 'colunas-largas' });

      const totTipo = p.realceTipo.reduce((a, b) => a + b, 0) || 1;
      el.querySelector('#p6-tipo').innerHTML = G.barrasH(D.tipos.map((t, i) => ({
        rotulo: t.nome,
        valor: p.realceTipo[i],
        cor: t.cor,
        texto: `${R.pct(p.realceTipo[i] / totTipo)} · ${R.int(p.realceTipo[i])}`,
        apagado: f.tipos.size > 0 && !f.tipos.has(t.i),
        attrs: `data-f="tipos" data-v="${t.i}" role="button" tabindex="0"`,
        dica: `${t.nome}\n${R.int(p.realceTipo[i])} veículos`,
      })));

      el.querySelector('#p6-eq').innerHTML = G.barrasH(D.equipamentos.map((e) => {
        const x = p.realceEq[e.i];
        return {
          rotulo: e.id,
          valor: x.media,
          cor: 'var(--s1)',
          texto: `${R.int(x.media)}/dia`,
          apagado: f.eqs.size > 0 && !f.eqs.has(e.i),
          attrs: `data-f="eqs" data-v="${e.i}" role="button" tabindex="0"`,
          dica: `${eqTxt(e)} · ${e.municipio}\nMédia diária: ${R.int(x.media)}\nVolume: ${R.int(x.total)} em ${x.dias} dias`,
        };
      }));

      const totS = p.realceSentido.reduce((a, b) => a + b.volume, 0) || 1;
      el.querySelector('#p6-sentido').innerHTML = G.barrasH(p.realceSentido.map((x) => ({
        rotulo: x.s,
        valor: x.volume,
        cor: 'var(--s7)',
        texto: `${R.pct(x.volume / totS)} · ${R.int(x.volume)}`,
        apagado: f.sentidos.size > 0 && !f.sentidos.has(x.s),
        attrs: `data-f="sentidos" data-v="${esc(x.s)}" role="button" tabindex="0"`,
        dica: `${x.s}\n${R.int(x.volume)} veículos`,
      })));

      el.querySelector('#p6-vel').innerHTML = G.barrasH(D.vels.map((v, i) => ({
        rotulo: v.rotulo,
        valor: p.porVel[i],
        cor: v.cor,
        texto: R.pctFino(p.total ? p.porVel[i] / p.total : 0),
        dica: `${v.rotulo}\n${R.int(p.porVel[i])} veículos`,
      })));

      el.querySelector('#p6-matriz').innerHTML = tabelaComposicao({
        rotuloLinha: 'Equipamento',
        cols: D.tipos.map((t) => ({ rotulo: t.nome })),
        mostrarAbs: false,
        linhas: D.equipamentos.filter((e) => p.porEqFiltrado[e.i] > 0).map((e) => ({
          rotulo: e.id,
          total: p.porEqFiltrado[e.i],
          por: p.matriz[e.i],
          p: p.matriz[e.i].map((v) => v / p.porEqFiltrado[e.i]),
        })),
        rodape: p.total ? { rotulo: 'Total', total: p.total, por: p.porTipo, p: p.porTipo.map((v) => v / p.total) } : null,
      });

      /* mapa */
      const maxV = Math.max.apply(null, p.realceEq.map((x) => x.total)) || 1;
      m6.simbolos(D.equipamentos.map((e) => {
        const x = p.realceEq[e.i];
        const apagado = f.eqs.size > 0 && !f.eqs.has(e.i);
        const r = Math.round(R.mapa.raio(x.total, maxV, 32, 7));
        return {
          eq: e,
          r,
          html: R.mapa.circulo(r, apagado || !x.total ? 'var(--eixo)' : 'var(--s1)'),
          rotulo: `${e.id} · ${R.int(x.media)}/dia`,
          dica: `${eqTxt(e)} · ${e.municipio}\nVolume: ${R.int(x.total)}\nMédia diária: ${R.int(x.media)}\nClique para filtrar`,
          aoClicar: () => { alternar(f.eqs, e.i); render(); },
        };
      }));
    }

    el.addEventListener('click', (ev) => {
      const exp = ev.target.closest('[data-exportar]');
      if (exp) { exportar(exp.getAttribute('data-exportar')); return; }
      const alvo = ev.target.closest('[data-f]');
      if (!alvo || !el.contains(alvo)) return;
      const dim = alvo.getAttribute('data-f');
      if (dim === 'limpar') {
        f.ano = '';
        ['eqs', 'tipos', 'sentidos', 'dias'].forEach((k) => f[k].clear());
      } else {
        const bruto = alvo.getAttribute('data-v');
        alternar(f[dim], dim === 'sentidos' ? bruto : +bruto);
      }
      render();
    });
    el.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-f][role="button"]')) {
        ev.preventDefault();
        ev.target.click();
      }
    });
    el.addEventListener('change', (ev) => {
      if (ev.target.matches('[data-f-ano]')) { f.ano = ev.target.value; render(); }
    });

    function exportar(qual) {
      if (qual === 'dim_eq') {
        baixarCSV('dim_equipamento.csv', [['equipamento', 'km', 'municipio', 'uf', 'rodovia', 'concessionaria', 'tipo_pista', 'latitude', 'longitude']]
          .concat(D.equipamentos.map((e) => [e.id, e.km, e.municipio, e.uf, e.rodovia, e.concessionaria, e.pista, e.lat, e.lon])));
      } else if (qual === 'dim_vel') {
        baixarCSV('dim_velocidade.csv', [['velocidade', 'ordem', 'km_h_min', 'km_h_max', 'acima_100']]
          .concat(D.vels.map((v, i) => [velCSV(v), i + 1, v.min, v.max === Infinity ? '' : v.max, v.acima100 ? 'Sim' : 'Não'])));
      } else {
        const linhas = [['data', 'equipamento', 'sentido', 'faixa', 'velocidade', 'tipo_veiculo', 'volume']];
        const rotV = D.vels.map(velCSV);
        D.registros.forEach((r) => {
          if (R.passaFiltro(r, f, null)) linhas.push([r.d, D.equipamentos[r.e].id, r.s, r.f, rotV[r.v], D.tipos[r.t].nome, r.q]);
        });
        baixarCSV('fato_volume.csv', linhas);
      }
    }

    render();
  };
})();

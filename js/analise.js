/* Agregações estatísticas usadas pelas abas. Nenhuma função aqui gera HTML. */
(function () {
  'use strict';
  const R = (window.Radar = window.Radar || {});

  const zeros = (n) => new Array(n).fill(0);
  const unicos = (arr) => Array.from(new Set(arr));

  /* Volume por chave de linha × índice de coluna (tipo ou velocidade). */
  function matriz(regs, chaveLinha, chaveCol, nCols) {
    const linhas = new Map();
    const totCol = zeros(nCols);
    let total = 0;
    for (const r of regs) {
      const a = chaveLinha(r);
      let l = linhas.get(a);
      if (!l) {
        l = { chave: a, total: 0, por: zeros(nCols), datas: new Set(), eqDias: new Set() };
        linhas.set(a, l);
      }
      const b = chaveCol(r);
      l.total += r.q;
      l.por[b] += r.q;
      l.datas.add(r.d);
      l.eqDias.add(r.e + '|' + r.d);
      totCol[b] += r.q;
      total += r.q;
    }
    return { linhas, totCol, total };
  }
  R.matriz = matriz;

  /* Perfil (volume, composição por tipo e por velocidade) de um subconjunto agrupado. */
  function perfis(D, regs, chave) {
    const mt = matriz(regs, chave, (r) => r.t, D.tipos.length);
    const mv = matriz(regs, chave, (r) => r.v, D.vels.length);
    const out = [];
    for (const [k, l] of mt.linhas) {
      const v = mv.linhas.get(k);
      const nd = l.datas.size;
      out.push({
        chave: k,
        total: l.total,
        dias: nd,
        mediaDiaria: nd ? l.total / nd : 0,
        /* média por equipamento-dia: comparável entre grupos com nº diferente de radares */
        mediaEqDia: l.eqDias.size ? l.total / l.eqDias.size : 0,
        porTipo: l.por,
        pTipo: l.por.map((x) => x / l.total),
        porVel: v.por,
        pVel: v.por.map((x) => x / l.total),
        acima100: v.por.reduce((s, x, i) => s + (D.vels[i].acima100 ? x : 0), 0),
        datasMin: Array.from(l.datas).sort()[0],
        datasMax: Array.from(l.datas).sort().pop(),
      });
    }
    return { linhas: out, total: mt.total, totTipo: mt.totCol, totVel: mv.totCol };
  }
  R.perfis = perfis;

  /* Totais por data (com composição por tipo). */
  function totaisDiarios(D, regs) {
    const m = new Map();
    for (const r of regs) {
      let x = m.get(r.d);
      if (!x) { x = { d: r.d, w: r.w, total: 0, porTipo: zeros(D.tipos.length) }; m.set(r.d, x); }
      x.total += r.q;
      x.porTipo[r.t] += r.q;
    }
    return Array.from(m.values()).sort((a, b) => (a.d < b.d ? -1 : 1));
  }

  /* ---------------- Aba 1 ---------------- */
  R.caracterizar = function (D) {
    const regs = D.registros;
    const datas = unicos(regs.map((r) => r.d)).sort();
    const ini = datas[0];
    const fim = datas[datas.length - 1];
    const DIA = 86400000;
    const diasIntervalo = Math.round((R.diaUTC(fim) - R.diaUTC(ini)) / DIA) + 1;
    const presentes = new Set(datas);
    const ausentes = [];
    for (let t = R.diaUTC(ini); t <= R.diaUTC(fim); t += DIA) {
      const iso = R.isoDeUTC(t);
      if (!presentes.has(iso)) ausentes.push(iso);
    }

    const porEq = perfis(D, regs, (r) => r.e);
    const sentidosEq = D.equipamentos.map(() => new Set());
    const faixasEq = D.equipamentos.map(() => new Set());
    for (const r of regs) { sentidosEq[r.e].add(r.s); faixasEq[r.e].add(r.f); }
    const equipamentos = D.equipamentos.map((eq) => {
      const p = porEq.linhas.find((l) => l.chave === eq.i);
      return Object.assign({}, eq, {
        total: p.total,
        dias: p.dias,
        ini: p.datasMin,
        fim: p.datasMax,
        sentidos: Array.from(sentidosEq[eq.i]).sort(),
        faixas: Array.from(faixasEq[eq.i]).sort(),
      });
    });

    const somaPor = (fn) => {
      const m = new Map();
      for (const r of regs) m.set(fn(r), (m.get(fn(r)) || 0) + r.q);
      return Array.from(m, ([chave, volume]) => ({ chave, volume }))
        .sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
    };

    const total = porEq.total;

    /* Volume mensal, para evidenciar lacunas e mudanças de cobertura. */
    const meses = new Map();
    for (const r of regs) {
      const k = r.d.slice(0, 7);
      let x = meses.get(k);
      if (!x) { x = { mes: k, volume: 0, eqs: new Set(), datas: new Set() }; meses.set(k, x); }
      x.volume += r.q;
      x.eqs.add(r.e);
      x.datas.add(r.d);
    }
    const listaMeses = [];
    for (let a = +ini.slice(0, 4), m = +ini.slice(5, 7); a * 100 + m <= +fim.slice(0, 4) * 100 + +fim.slice(5, 7); ) {
      const k = a + '-' + ('0' + m).slice(-2);
      const x = meses.get(k);
      listaMeses.push(x
        ? { mes: k, volume: x.volume, eqs: x.eqs.size, dias: x.datas.size }
        : { mes: k, volume: 0, eqs: 0, dias: 0 });
      if (++m > 12) { m = 1; a++; }
    }

    const diarios = totaisDiarios(D, regs);
    const med = R.mediana(diarios.map((x) => x.total));
    const atipicos = diarios.filter((x) => x.total < 0.2 * med);

    return {
      ini, fim, diasComDados: datas.length, diasIntervalo, ausentes,
      intervalosAusentes: R.intervalos(ausentes),
      equipamentos,
      concessionarias: unicos(D.equipamentos.map((e) => e.concessionaria)),
      rodovias: unicos(D.equipamentos.map((e) => e.rodovia)),
      ufs: unicos(D.equipamentos.map((e) => e.uf)),
      municipios: unicos(D.equipamentos.map((e) => e.municipio)),
      pistas: unicos(D.equipamentos.map((e) => e.pista)),
      porTipo: porEq.totTipo,
      porVel: porEq.totVel,
      sentidos: somaPor((r) => r.s),
      faixas: somaPor((r) => r.f),
      sentidoFaixa: somaPor((r) => r.s + ' · faixa ' + r.f),
      total,
      registros: regs.length,
      meses: listaMeses,
      medianaDiaria: med,
      atipicos,
    };
  };

  /* ---------------- Aba 2 ---------------- */
  R.tipoPorVelocidade = function (D) {
    const p = perfis(D, D.registros, (r) => r.v);
    const linhas = D.vels.map((v) => {
      const l = p.linhas.find((x) => x.chave === v.i);
      return l
        ? { vel: v, total: l.total, por: l.porTipo, p: l.pTipo }
        : { vel: v, total: 0, por: zeros(D.tipos.length), p: zeros(D.tipos.length) };
    });
    return {
      linhas,
      total: p.total,
      geral: p.totTipo.map((x) => x / p.total),
      totTipo: p.totTipo,
    };
  };

  /* ---------------- Aba 3 ---------------- */
  /* Período em que todos os equipamentos possuem registros. */
  R.periodoComum = function (D) {
    const ext = D.equipamentos.map(() => ({ ini: '9999', fim: '0000' }));
    for (const r of D.registros) {
      const x = ext[r.e];
      if (r.d < x.ini) x.ini = r.d;
      if (r.d > x.fim) x.fim = r.d;
    }
    const ini = ext.reduce((m, x) => (x.ini > m ? x.ini : m), '0000');
    const fim = ext.reduce((m, x) => (x.fim < m ? x.fim : m), '9999');
    return ini <= fim ? { ini, fim } : null;
  };

  R.porEquipamento = function (D, periodo) {
    const regs = periodo
      ? D.registros.filter((r) => r.d >= periodo.ini && r.d <= periodo.fim)
      : D.registros;
    const p = perfis(D, regs, (r) => r.e);
    p.linhas.forEach((l) => { l.eq = D.equipamentos[l.chave]; });
    p.linhas.sort((a, b) => a.eq.km - b.eq.km);
    p.geralTipo = p.totTipo.map((x) => x / p.total);
    p.geralVel = p.totVel.map((x) => x / p.total);
    return p;
  };

  /* ---------------- Aba 4 ---------------- */
  R.semana = function (D, opcoes) {
    let regs = D.registros;
    if (opcoes.equipamento != null) regs = regs.filter((r) => r.e === opcoes.equipamento);
    let diarios = totaisDiarios(D, regs);
    const med = R.mediana(diarios.map((x) => x.total));
    const atipicos = diarios.filter((x) => x.total < 0.2 * med);
    if (opcoes.excluirAtipicos) diarios = diarios.filter((x) => x.total >= 0.2 * med);

    const nT = D.tipos.length;
    const dias = R.ORDEM_SEMANA.map((w) => {
      const ds = diarios.filter((x) => x.w === w);
      const soma = ds.reduce((s, x) => s + x.total, 0);
      const somaTipo = zeros(nT);
      ds.forEach((x) => x.porTipo.forEach((v, i) => { somaTipo[i] += v; }));
      return {
        w,
        nome: R.NOME_DIA[w],
        curto: R.NOME_DIA_CURTO[w],
        n: ds.length,
        soma,
        media: ds.length ? soma / ds.length : 0,
        mediaTipo: somaTipo.map((v) => (ds.length ? v / ds.length : 0)),
        pTipo: somaTipo.map((v) => (soma ? v / soma : 0)),
      };
    });

    /* Transições entre dias consecutivos (inclui domingo → segunda). */
    const transicoes = dias.map((d, i) => {
      const prox = dias[(i + 1) % 7];
      return {
        de: d,
        para: prox,
        variacao: d.media ? prox.media / d.media - 1 : NaN,
        variacaoTipo: d.mediaTipo.map((v, k) => (v ? prox.mediaTipo[k] / v - 1 : NaN)),
        deltaTipo: d.mediaTipo.map((v, k) => prox.mediaTipo[k] - v),
        delta: prox.media - d.media,
      };
    });

    const grupo = (ws) => {
      const ds = diarios.filter((x) => ws.indexOf(x.w) >= 0);
      const soma = ds.reduce((s, x) => s + x.total, 0);
      const somaTipo = zeros(nT);
      ds.forEach((x) => x.porTipo.forEach((v, i) => { somaTipo[i] += v; }));
      return {
        n: ds.length,
        media: ds.length ? soma / ds.length : 0,
        mediaTipo: somaTipo.map((v) => (ds.length ? v / ds.length : 0)),
        pTipo: somaTipo.map((v) => (soma ? v / soma : 0)),
      };
    };

    /* Índice de cada tipo por dia: média do tipo no dia ÷ média do tipo nos 7 dias. */
    const mediaSemanalTipo = zeros(nT).map((_, k) => dias.reduce((s, d) => s + d.mediaTipo[k], 0) / 7);
    const indices = dias.map((d) => d.mediaTipo.map((v, k) => (mediaSemanalTipo[k] ? v / mediaSemanalTipo[k] : NaN)));

    return {
      dias,
      transicoes,
      uteis: grupo([1, 2, 3, 4, 5]),
      fds: grupo([0, 6]),
      indices,
      atipicos,
      mediana: med,
      nDias: diarios.length,
    };
  };

  /* ---------------- Aba 6 (painel com filtros) ---------------- */
  /*
   * filtro = { ano, eqs:Set, tipos:Set, sentidos:Set, dias:Set }
   * `ignorar` permite calcular um visual sem o filtro da própria dimensão
   * (como o realce do Power BI: barras não selecionadas ficam esmaecidas).
   */
  R.passaFiltro = function (r, f, ignorar) {
    if (f.ano && ignorar !== 'ano' && r.d.slice(0, 4) !== f.ano) return false;
    if (f.eqs.size && ignorar !== 'eqs' && !f.eqs.has(r.e)) return false;
    if (f.tipos.size && ignorar !== 'tipos' && !f.tipos.has(r.t)) return false;
    if (f.sentidos.size && ignorar !== 'sentidos' && !f.sentidos.has(r.s)) return false;
    if (f.dias.size && ignorar !== 'dias' && !f.dias.has(r.w)) return false;
    return true;
  };

  R.painel = function (D, f) {
    const nT = D.tipos.length, nV = D.vels.length, nE = D.equipamentos.length;
    const base = { total: 0, datas: new Set(), eqDias: new Set(), porTipo: zeros(nT), porVel: zeros(nV), acima: 0, meses: new Map(), matriz: D.equipamentos.map(() => zeros(nT)), porEqT: zeros(nE) };
    const porTipo = zeros(nT);
    const porEq = D.equipamentos.map(() => ({ total: 0, datas: new Set(), acima: 0 }));
    const porDia = new Map(R.ORDEM_SEMANA.map((w) => [w, { total: 0, datas: new Set() }]));
    const porSentido = new Map();
    const anos = new Set();

    for (const r of D.registros) {
      anos.add(r.d.slice(0, 4));
      if (R.passaFiltro(r, f, null)) {
        base.total += r.q;
        base.datas.add(r.d);
        base.eqDias.add(r.e + '|' + r.d);
        base.porTipo[r.t] += r.q;
        base.porVel[r.v] += r.q;
        base.matriz[r.e][r.t] += r.q;
        base.porEqT[r.e] += r.q;
        if (D.vels[r.v].acima100) base.acima += r.q;
        const mes = r.d.slice(0, 7);
        base.meses.set(mes, (base.meses.get(mes) || 0) + r.q);
      }
      /* visuais que realçam (não filtram) a própria dimensão */
      if (R.passaFiltro(r, f, 'tipos')) porTipo[r.t] += r.q;
      if (R.passaFiltro(r, f, 'eqs')) {
        const x = porEq[r.e];
        x.total += r.q; x.datas.add(r.d);
        if (D.vels[r.v].acima100) x.acima += r.q;
      }
      if (R.passaFiltro(r, f, 'dias')) {
        const x = porDia.get(r.w);
        x.total += r.q; x.datas.add(r.d);
      }
      if (R.passaFiltro(r, f, 'sentidos')) porSentido.set(r.s, (porSentido.get(r.s) || 0) + r.q);
    }

    return {
      total: base.total,
      dias: base.datas.size,
      radarDias: base.eqDias.size,
      mediaDiaria: base.datas.size ? base.total / base.datas.size : 0,
      mediaRadarDia: base.eqDias.size ? base.total / base.eqDias.size : 0,
      porTipo: base.porTipo,
      porVel: base.porVel,
      acima: base.acima,
      matriz: base.matriz,
      porEqFiltrado: base.porEqT,
      meses: Array.from(base.meses, ([mes, volume]) => ({ mes, volume })).sort((a, b) => (a.mes < b.mes ? -1 : 1)),
      realceTipo: porTipo,
      realceEq: porEq.map((x) => ({ total: x.total, dias: x.datas.size, media: x.datas.size ? x.total / x.datas.size : 0, acima: x.acima })),
      realceDia: R.ORDEM_SEMANA.map((w) => {
        const x = porDia.get(w);
        return { w, total: x.total, n: x.datas.size, media: x.datas.size ? x.total / x.datas.size : 0 };
      }),
      realceSentido: Array.from(porSentido, ([s, volume]) => ({ s, volume })).sort((a, b) => (a.s < b.s ? -1 : 1)),
      anos: Array.from(anos).sort(),
    };
  };

  /* ---------------- Aba 5 ---------------- */
  R.operacional = function (D) {
    const regs = D.registros;
    const sentidos = perfis(D, regs, (r) => r.s);
    const faixas = perfis(D, regs, (r) => r.f);
    const combos = perfis(D, regs, (r) => r.e + '|' + r.s + '|' + r.f);
    combos.linhas.forEach((l) => {
      const [e, s, f] = l.chave.split('|');
      l.eq = D.equipamentos[+e];
      l.sentido = s;
      l.faixa = f;
    });
    combos.linhas.sort((a, b) => a.eq.km - b.eq.km || (a.sentido < b.sentido ? -1 : 1) || (a.faixa < b.faixa ? -1 : 1));

    const eqsDe = (campo) => {
      const m = new Map();
      for (const l of combos.linhas) {
        const k = l[campo];
        if (!m.has(k)) m.set(k, new Set());
        m.get(k).add(l.eq.id);
      }
      return m;
    };
    const eqsSentido = eqsDe('sentido');
    const eqsFaixa = eqsDe('faixa');
    sentidos.linhas.forEach((l) => { l.eqs = Array.from(eqsSentido.get(l.chave) || []); });
    faixas.linhas.forEach((l) => { l.eqs = Array.from(eqsFaixa.get(l.chave) || []); });
    sentidos.linhas.sort((a, b) => (a.chave < b.chave ? -1 : 1));
    faixas.linhas.sort((a, b) => (a.chave < b.chave ? -1 : 1));

    const combosPorEq = new Map();
    combos.linhas.forEach((l) => combosPorEq.set(l.eq.id, (combosPorEq.get(l.eq.id) || 0) + 1));
    const umSentidoFaixaPorEq = Array.from(combosPorEq.values()).every((n) => n === 1);

    /* Ranking acima de 100 km/h. */
    const porEq = R.porEquipamento(D, null);
    const ranking = porEq.linhas.map((l) => ({
      eq: l.eq,
      total: l.total,
      dias: l.dias,
      ini: l.datasMin,
      fim: l.datasMax,
      acima: l.acima100,
      prop: l.total ? l.acima100 / l.total : 0,
      porVelAcima: D.vels.filter((v) => v.acima100).map((v) => ({ vel: v, volume: l.porVel[v.i] })),
      acimaPorDia: l.dias ? l.acima100 / l.dias : 0,
    }));
    const porAbs = ranking.slice().sort((a, b) => b.acima - a.acima);
    const porProp = ranking.slice().sort((a, b) => b.prop - a.prop);
    porAbs.forEach((x, i) => { x.rankAbs = i + 1; });
    porProp.forEach((x, i) => { x.rankProp = i + 1; });

    return {
      sentidos, faixas, combos, umSentidoFaixaPorEq,
      ranking: porAbs,
      porAbs, porProp,
      totalAcima: ranking.reduce((s, x) => s + x.acima, 0),
      total: porEq.total,
    };
  };
})();

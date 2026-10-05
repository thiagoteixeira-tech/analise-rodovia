/* Carregamento e normalização do CSV de volume dos radares (ANTT). */
(function () {
  'use strict';
  var R = (window.Radar = window.Radar || {});

  var CAMINHO_CSV = 'data/volume-radar-trans.csv';
  var CAMINHO_JS = 'data/volume-radar-trans.js';

  var CAMPOS = [
    'concessionaria', 'identificador', 'rodovia', 'uf', 'km_m', 'municipio',
    'tipo_de_pista', 'latitude', 'longitude', 'data_da_passagem',
    'sentido_da_passagem', 'faixa_da_passagem', 'velocidade',
    'tipo_de_veiculo', 'volume_total',
  ];

  var ORDEM_TIPOS = ['Passeio', 'Comercial', 'Moto', 'Não classificado'];

  /* O arquivo da ANTT vem em Latin-1/Windows-1252; aceitamos UTF-8 também. */
  R.decodificar = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var texto;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      texto = new TextDecoder('windows-1252').decode(bytes);
    }
    return texto.replace(/^﻿/, '');
  };

  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () { falha(new Error('Não foi possível carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  /*
   * Servido por HTTP (Vite/Vercel): lê o CSV com fetch.
   * Aberto do disco (file://): o navegador bloqueia fetch, então usamos a cópia
   * do CSV embutida em data/volume-radar-trans.js. Se nada funcionar, retorna
   * null e a interface oferece a seleção manual do arquivo.
   */
  R.carregarTexto = function () {
    var viaFetch = location.protocol === 'file:'
      ? Promise.reject(new Error('file://'))
      : fetch(CAMINHO_CSV).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        }).then(function (buf) {
          return { texto: R.decodificar(buf), origem: CAMINHO_CSV };
        });

    return viaFetch.catch(function () {
      if (window.RADAR_CSV) return { texto: window.RADAR_CSV, origem: CAMINHO_JS };
      return carregarScript(CAMINHO_JS).then(function () {
        if (!window.RADAR_CSV) throw new Error('vazio');
        return { texto: window.RADAR_CSV, origem: CAMINHO_JS };
      });
    }).catch(function () {
      return null;
    });
  };

  R.lerArquivo = function (arquivo) {
    return arquivo.arrayBuffer().then(function (buf) {
      return { texto: R.decodificar(buf), origem: arquivo.name };
    });
  };

  function dividir(linha, sep) {
    var out = [];
    var atual = '';
    var aspas = false;
    for (var i = 0; i < linha.length; i++) {
      var c = linha[i];
      if (aspas) {
        if (c === '"') {
          if (linha[i + 1] === '"') { atual += '"'; i++; } else aspas = false;
        } else atual += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { out.push(atual); atual = ''; }
      else atual += c;
    }
    out.push(atual);
    return out;
  }

  function numero(s) {
    s = (s || '').trim();
    if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    return parseFloat(s);
  }

  function dataISO(s) {
    s = s.trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return null;
  }

  /* As categorias de velocidade vêm truncadas no arquivo ("81 - 100 K", "101 - 120 "). */
  function normalizarVelocidade(bruto) {
    var t = bruto.trim();
    var n = (t.match(/\d+/g) || []).map(Number);
    if (/^</.test(t) && n.length) {
      return { rotulo: '≤ ' + n[0] + ' km/h', min: 0, max: n[0] };
    }
    if (/^>/.test(t) && n.length) {
      return { rotulo: '> ' + n[0] + ' km/h', min: n[0] + 1, max: Infinity };
    }
    if (n.length >= 2) {
      return { rotulo: n[0] + '–' + n[1] + ' km/h', min: n[0], max: n[1] };
    }
    return { rotulo: t || '(vazio)', min: Infinity, max: Infinity };
  }

  /*
   * Converte o texto do CSV no conjunto de dados normalizado:
   *  registros: { e, d, w, s, f, v, t, q }  (índices para equipamento,
   *  velocidade e tipo; d = data ISO; w = dia da semana; q = volume)
   */
  R.interpretarCSV = function (texto) {
    var linhas = texto.split(/\r?\n/);
    var sep = linhas[0].indexOf(';') >= 0 ? ';' : ',';
    var cab = dividir(linhas[0], sep).map(function (c) { return c.trim().toLowerCase(); });
    var idx = {};
    CAMPOS.forEach(function (c) { idx[c] = cab.indexOf(c); });
    var faltando = CAMPOS.filter(function (c) { return idx[c] < 0; });
    if (faltando.length) throw new Error('Colunas ausentes no CSV: ' + faltando.join(', '));

    var equipamentos = [];
    var eqPorId = {};
    var velPorBruto = {};
    var vels = [];
    var tipoPorNome = {};
    var tipos = [];
    var registros = [];
    var invalidas = 0;
    var semanaCache = {};

    for (var i = 1; i < linhas.length; i++) {
      var l = linhas[i];
      if (!l) continue;
      var c = dividir(l, sep);
      if (c.length < cab.length) { invalidas++; continue; }

      var d = dataISO(c[idx.data_da_passagem]);
      var q = numero(c[idx.volume_total]);
      if (!d || !isFinite(q)) { invalidas++; continue; }

      var id = c[idx.identificador].trim();
      var eq = eqPorId[id];
      if (!eq) {
        eq = eqPorId[id] = {
          i: equipamentos.length,
          id: id,
          concessionaria: c[idx.concessionaria].trim(),
          rodovia: c[idx.rodovia].trim(),
          uf: c[idx.uf].trim(),
          km: numero(c[idx.km_m]),
          municipio: c[idx.municipio].trim(),
          pista: c[idx.tipo_de_pista].trim(),
          lat: numero(c[idx.latitude]),
          lon: numero(c[idx.longitude]),
        };
        equipamentos.push(eq);
      }

      var vb = c[idx.velocidade];
      var v = velPorBruto[vb];
      if (v == null) {
        var nv = normalizarVelocidade(vb);
        var existente = vels.filter(function (x) { return x.rotulo === nv.rotulo; })[0];
        if (existente) v = existente.i;
        else { nv.i = vels.length; nv.brutos = []; vels.push(nv); v = nv.i; }
        vels[v].brutos.push(vb.trim());
        velPorBruto[vb] = v;
      }

      var tn = c[idx.tipo_de_veiculo].trim();
      var t = tipoPorNome[tn];
      if (t == null) { t = tipoPorNome[tn] = tipos.length; tipos.push({ i: t, nome: tn }); }

      var w = semanaCache[d];
      if (w == null) w = semanaCache[d] = new Date(R.diaUTC(d)).getUTCDay();

      registros.push({
        e: eq.i,
        d: d,
        w: w,
        s: c[idx.sentido_da_passagem].trim(),
        f: c[idx.faixa_da_passagem].trim(),
        v: v,
        t: t,
        q: q,
      });
    }

    /* Reordena velocidades (crescente) e tipos (ordem de referência). */
    var ordemV = vels.slice().sort(function (a, b) { return a.min - b.min || a.max - b.max; });
    var novoV = [];
    ordemV.forEach(function (x, k) { novoV[x.i] = k; x.i = k; });

    var volTipo = tipos.map(function () { return 0; });
    registros.forEach(function (r) { volTipo[r.t] += r.q; });
    var ordemT = tipos.slice().sort(function (a, b) {
      var ia = ORDEM_TIPOS.indexOf(a.nome), ib = ORDEM_TIPOS.indexOf(b.nome);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      return ia - ib || volTipo[b.i] - volTipo[a.i];
    });
    var novoT = [];
    ordemT.forEach(function (x, k) { novoT[x.i] = k; x.i = k; x.cor = 'var(--s' + (k + 1) + ')'; });

    registros.forEach(function (r) { r.v = novoV[r.v]; r.t = novoT[r.t]; });
    ordemV.forEach(function (x, k) {
      x.cor = 'var(--v' + Math.min(8, Math.round(1 + (k * 7) / Math.max(1, ordemV.length - 1))) + ')';
      x.acima100 = x.min > 100;
    });

    equipamentos.sort(function (a, b) { return a.km - b.km || (a.id < b.id ? -1 : 1); });
    var novoE = [];
    equipamentos.forEach(function (x, k) { novoE[x.i] = k; x.i = k; x.cor = 'var(--s' + ((k % 8) + 1) + ')'; });
    registros.forEach(function (r) { r.e = novoE[r.e]; });

    return {
      registros: registros,
      equipamentos: equipamentos,
      vels: ordemV,
      tipos: ordemT,
      linhasInvalidas: invalidas,
    };
  };
})();

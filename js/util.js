/* Utilitários de formatação e helpers compartilhados. */
(function () {
  'use strict';
  var R = (window.Radar = window.Radar || {});

  var fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var fmtCache = {};

  function fmtDec(casas) {
    if (!fmtCache[casas]) {
      fmtCache[casas] = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      });
    }
    return fmtCache[casas];
  }

  R.int = function (n) {
    return fmtInt.format(Math.round(n));
  };

  R.dec = function (n, casas) {
    return fmtDec(casas == null ? 1 : casas).format(n);
  };

  /* Percentual a partir de uma fração (0–1). */
  R.pct = function (fracao, casas) {
    if (!isFinite(fracao)) return '–';
    return fmtDec(casas == null ? 1 : casas).format(fracao * 100) + '%';
  };

  /* Percentual com casas adaptativas para valores muito pequenos. */
  R.pctFino = function (fracao) {
    if (!isFinite(fracao)) return '–';
    var p = fracao * 100;
    if (p === 0) return '0%';
    if (p < 0.0001) return '< ' + fmtDec(4).format(0.0001) + '%';
    if (p < 0.01) return fmtDec(4).format(p) + '%';
    if (p < 0.1) return fmtDec(3).format(p) + '%';
    if (p < 1) return fmtDec(2).format(p) + '%';
    return fmtDec(1).format(p) + '%';
  };

  /* Diferença em pontos percentuais com sinal. */
  R.pp = function (diffFracao, casas) {
    var v = diffFracao * 100;
    var s = fmtDec(casas == null ? 1 : casas).format(Math.abs(v));
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + ' p.p.';
  };

  R.variacao = function (fracao, casas) {
    if (!isFinite(fracao)) return '–';
    var v = fracao * 100;
    var s = fmtDec(casas == null ? 1 : casas).format(Math.abs(v));
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + '%';
  };

  R.esc = function (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /* 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
  R.dataBR = function (iso) {
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  };

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  R.mesBR = function (aaaamm) {
    return MESES[+aaaamm.slice(5, 7) - 1] + '/' + aaaamm.slice(2, 4);
  };

  /* Dias da semana na ordem segunda → domingo (índices de Date.getUTCDay). */
  R.ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
  R.NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  R.NOME_DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  R.diaUTC = function (iso) {
    return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  };

  R.isoDeUTC = function (ms) {
    return new Date(ms).toISOString().slice(0, 10);
  };

  /* Agrupa datas ISO ausentes em intervalos contíguos. */
  R.intervalos = function (isos) {
    var out = [];
    var DIA = 86400000;
    isos.forEach(function (iso) {
      var t = R.diaUTC(iso);
      var ult = out[out.length - 1];
      if (ult && t - ult.fimT === DIA) {
        ult.fim = iso;
        ult.fimT = t;
        ult.dias++;
      } else {
        out.push({ ini: iso, fim: iso, fimT: t, dias: 1 });
      }
    });
    return out;
  };

  R.listaTexto = function (itens) {
    if (itens.length <= 1) return itens.join('');
    return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
  };

  R.mediana = function (valores) {
    if (!valores.length) return 0;
    var v = valores.slice().sort(function (a, b) { return a - b; });
    var m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
})();

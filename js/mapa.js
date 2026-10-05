/*
 * Mapas (Leaflet): rodovias vetoriais (OpenStreetMap, embutidas em data/rodovias.js),
 * radares e camadas de símbolos (círculos proporcionais e roscas de composição).
 * Funciona sem internet: o fundo (tiles) falha silenciosamente, mas rodovias e símbolos aparecem.
 */
(function () {
  'use strict';
  const R = (window.Radar = window.Radar || {});
  const M = (R.mapa = {});
  const instancias = [];

  M.disponivel = () => typeof window.L !== 'undefined';

  const escuro = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  /* ---------- geometria dos símbolos ---------- */

  /* Raio proporcional à raiz (área proporcional ao valor). */
  M.raio = (valor, max, rMax, rMin) => Math.max(rMin || 5, (rMax || 30) * Math.sqrt(Math.max(0, valor) / (max || 1)));

  /* Rosca SVG: fracoes[] com cores[] (CSS). */
  M.rosca = function (fracoes, cores, r, espessura) {
    const ri = Math.max(0, r - (espessura || Math.max(6, r * 0.45)));
    const tot = fracoes.reduce((a, b) => a + b, 0) || 1;
    const p = (a, rad) => [(r + rad * Math.cos(a)).toFixed(2), (r + rad * Math.sin(a)).toFixed(2)];
    let a0 = -Math.PI / 2;
    let s = '';
    fracoes.forEach((f, i) => {
      if (f <= 0) return;
      const frac = f / tot;
      if (frac > 0.9999) {
        s += `<circle cx="${r}" cy="${r}" r="${(r + ri) / 2}" style="fill:none;stroke:${cores[i]};stroke-width:${r - ri}"/>`;
        return;
      }
      const a1 = a0 + frac * 2 * Math.PI;
      const g = a1 - a0 > Math.PI ? 1 : 0;
      const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r), [x2, y2] = p(a1, ri), [x3, y3] = p(a0, ri);
      s += `<path d="M${x0} ${y0}A${r} ${r} 0 ${g} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${g} 0 ${x3} ${y3}Z" style="fill:${cores[i]};stroke:var(--superficie);stroke-width:1"/>`;
      a0 = a1;
    });
    return `<svg width="${2 * r}" height="${2 * r}" viewBox="0 0 ${2 * r} ${2 * r}" aria-hidden="true">${s}</svg>`;
  };

  M.circulo = function (r, cor) {
    return `<svg width="${2 * r}" height="${2 * r}" viewBox="0 0 ${2 * r} ${2 * r}" aria-hidden="true">` +
      `<circle cx="${r}" cy="${r}" r="${r - 1}" style="fill:${cor};fill-opacity:.78;stroke:var(--superficie);stroke-width:2"/></svg>`;
  };

  /* ---------- criação do mapa ---------- */

  M.limpar = function (raiz) {
    for (let i = instancias.length - 1; i >= 0; i--) {
      const inst = instancias[i];
      if (!document.body.contains(inst.el) || (raiz && raiz.contains(inst.el))) {
        inst.map.remove();
        instancias.splice(i, 1);
      }
    }
  };

  M.invalidar = function (raiz) {
    instancias.forEach((inst) => { if (raiz.contains(inst.el)) inst.map.invalidateSize(); });
  };

  /*
   * Cria um mapa em `el` com as rodovias e os radares.
   * Retorna { map, simbolos(itens) } — itens: [{ eq, r, html, rotulo, dica, popup }]
   */
  M.criar = function (el, D, opcoes) {
    opcoes = opcoes || {};
    if (!M.disponivel()) {
      el.innerHTML = '<p class="nota">Biblioteca de mapas não carregada.</p>';
      return { simbolos() {} };
    }
    const L = window.L;
    const map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
    instancias.push({ el, map });

    /*
     * Fundo (precisa de internet). Os tiles do OpenStreetMap exigem cabeçalho Referer e
     * retornam "Access blocked" quando a página é aberta via file://. Por isso o padrão é
     * o Esri (sem chave e sem exigência de Referer); o OSM só é oferecido quando servido por HTTP.
     */
    const esri = (servico, nome) => L.tileLayer(
      `https://server.arcgisonline.com/ArcGIS/rest/services/${servico}/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19,
        className: servico === 'World_Imagery' ? 'fundo-satelite' : 'fundo-mapa',
        attribution: `Fundo: ${nome} &copy; Esri e colaboradores`,
      });
    const fundos = {
      'Ruas (Esri)': esri('World_Street_Map', 'Esri World Street Map'),
      'Topográfico (Esri)': esri('World_Topo_Map', 'Esri World Topo Map'),
      'Satélite (Esri)': esri('World_Imagery', 'Esri World Imagery'),
    };
    if (location.protocol !== 'file:') {
      fundos['OpenStreetMap'] = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'fundo-mapa',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
    }
    fundos['Sem fundo'] = L.layerGroup();
    fundos['Ruas (Esri)'].addTo(map);
    L.control.layers(fundos, null, { position: 'topright', collapsed: true }).addTo(map);

    /* Sem internet: avisa uma vez e mantém rodovias/radares vetoriais. */
    let falhas = 0;
    Object.values(fundos).forEach((camada) => camada.on && camada.on('tileerror', () => {
      if (++falhas === 6) {
        const aviso = L.control({ position: 'bottomleft' });
        aviso.onAdd = () => {
          const d = L.DomUtil.create('div', 'aviso-mapa');
          d.textContent = 'Fundo do mapa indisponível (sem internet?). Rodovias e radares continuam visíveis.';
          return d;
        };
        aviso.addTo(map);
      }
    }));

    /* Rodovias vetoriais. */
    const geo = window.RADAR_RODOVIAS;
    let camadaBR = null;
    if (geo) {
      const outras = L.geoJSON(geo, {
        filter: (f) => !f.properties.principal,
        style: { color: escuro() ? '#8a8880' : '#9b998f', weight: 2, opacity: 0.85 },
        interactive: false,
      }).addTo(map);
      camadaBR = L.geoJSON(geo, {
        filter: (f) => f.properties.principal,
        style: { color: escuro() ? '#ff8a5c' : '#d4471a', weight: 4.5, opacity: 0.95 },
        interactive: false,
      }).addTo(map);
      if (opcoes.rotulosRodovias !== false) {
        /* rótulo da BR-153 no meio do maior intervalo entre radares consecutivos (área livre) */
        const eqs = D.equipamentos.slice().sort((a, b) => a.km - b.km);
        let alvo = null, gap = -1;
        for (let i = 1; i < eqs.length; i++) {
          if (eqs[i].km - eqs[i - 1].km > gap) {
            gap = eqs[i].km - eqs[i - 1].km;
            alvo = [(eqs[i].lat + eqs[i - 1].lat) / 2, (eqs[i].lon + eqs[i - 1].lon) / 2];
          }
        }
        rotularRodovias(L, map, geo, alvo);
      }
      map.attributionControl.addAttribution('Rodovias: &copy; OpenStreetMap contributors (ODbL)');
      void outras;
    }

    /* Enquadramento: radares (+ trecho da BR-153 ao redor). */
    const pts = D.equipamentos.map((e) => [e.lat, e.lon]);
    const limites = L.latLngBounds(pts).pad(opcoes.margem == null ? 0.35 : opcoes.margem);
    map.fitBounds(limites);

    const camadaSimb = L.layerGroup().addTo(map);
    const camadaGuias = L.layerGroup().addTo(map);
    let itensAtuais = [];

    function simbolos(itens) {
      camadaSimb.clearLayers();
      camadaGuias.clearLayers();
      itensAtuais = itens.map((it) => {
        const lat = it.eq.lat, lon = it.eq.lon;
        const tam = 2 * it.r;
        const html = `<div class="simbolo" style="width:${tam}px;height:${tam}px" data-dica="${R.esc(it.dica || '')}">${it.html}` +
          (it.rotulo ? `<span class="simbolo-rotulo">${R.esc(it.rotulo)}</span>` : '') + '</div>';
        const marker = L.marker([lat, lon], {
          icon: L.divIcon({ className: 'simbolo-icone', html, iconSize: [tam, tam], iconAnchor: [it.r, it.r] }),
          keyboard: !!(it.popup || it.aoClicar),
          riseOnHover: true,
        }).addTo(camadaSimb);
        if (it.popup) marker.bindPopup(it.popup);
        if (it.aoClicar) marker.on('click', it.aoClicar);
        const guia = L.polyline([[lat, lon], [lat, lon]], { className: 'guia-simbolo', weight: 1.2, dashArray: '3 3', interactive: false });
        /* ponto exato do radar, mostrado quando o símbolo é deslocado */
        const ponto = L.circleMarker([lat, lon], { className: 'ponto-radar', radius: 3, weight: 1.5, fillOpacity: 1, interactive: false });
        return { it, marker, guia, ponto, latlng: L.latLng(lat, lon) };
      });
      afastar();
    }

    /* Afasta símbolos sobrepostos (em pixels) e liga cada um ao ponto real por uma linha-guia. */
    function afastar() {
      if (!itensAtuais.length) return;
      const ps = itensAtuais.map((x) => {
        const p = map.latLngToLayerPoint(x.latlng);
        return { x: p.x, y: p.y, ox: p.x, oy: p.y, r: x.it.r + (x.it.rotulo ? 14 : 2) };
      });
      for (let iter = 0; iter < 80; iter++) {
        let mexeu = false;
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            const min = a.r + b.r + 4;
            if (d < min) {
              if (d < 0.01) { dx = 1; dy = 0; d = 1; }
              const empurra = (min - d) / 2 + 0.5;
              a.x -= (dx / d) * empurra; a.y -= (dy / d) * empurra;
              b.x += (dx / d) * empurra; b.y += (dy / d) * empurra;
              mexeu = true;
            }
          }
        }
        if (!mexeu) break;
      }
      itensAtuais.forEach((x, k) => {
        const p = ps[k];
        const novo = map.layerPointToLatLng([p.x, p.y]);
        x.marker.setLatLng(novo);
        const deslocou = Math.hypot(p.x - p.ox, p.y - p.oy) > 3;
        if (deslocou) {
          x.guia.setLatLngs([x.latlng, novo]);
          x.guia.addTo(camadaGuias);
          x.ponto.addTo(camadaGuias);
        } else {
          camadaGuias.removeLayer(x.guia);
          camadaGuias.removeLayer(x.ponto);
        }
      });
    }

    map.on('zoomend', afastar);

    return { map, simbolos, camadaBR };
  };

  function rotularRodovias(L, map, geo, alvoPrincipal) {
    geo.features.forEach((f) => {
      let c = null;
      if (f.properties.principal && alvoPrincipal) {
        /* vértice da BR-153 mais próximo do ponto-alvo */
        let melhor = Infinity;
        f.geometry.coordinates.forEach((l) => l.forEach((p) => {
          const d = Math.hypot(p[1] - alvoPrincipal[0], p[0] - alvoPrincipal[1]);
          if (d < melhor) { melhor = d; c = p; }
        }));
      } else {
        /* ponto central da maior linha da rodovia */
        let maior = null, n = 0;
        f.geometry.coordinates.forEach((l) => { if (l.length > n) { n = l.length; maior = l; } });
        if (maior) c = maior[Math.floor(maior.length / 2)];
      }
      if (!c) return;
      L.marker([c[1], c[0]], {
        interactive: false,
        icon: L.divIcon({
          className: 'rotulo-rodovia' + (f.properties.principal ? ' principal' : ''),
          html: `<span>${R.esc(f.properties.ref)}</span>`,
          iconSize: null,
        }),
      }).addTo(map);
    });
  }

  /* Distância (m) de um ponto ao traçado da BR-153 embutido (aproximação equiretangular). */
  M.distanciaRodovia = function (lat, lon) {
    const geo = window.RADAR_RODOVIAS;
    if (!geo) return NaN;
    const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110540;
    let melhor = Infinity;
    geo.features.filter((f) => f.properties.principal).forEach((f) => {
      f.geometry.coordinates.forEach((linha) => {
        for (let i = 1; i < linha.length; i++) {
          const ax = (linha[i - 1][0] - lon) * kx, ay = (linha[i - 1][1] - lat) * ky;
          const bx = (linha[i][0] - lon) * kx, by = (linha[i][1] - lat) * ky;
          const dx = bx - ax, dy = by - ay;
          const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
          melhor = Math.min(melhor, Math.hypot(ax + t * dx, ay + t * dy));
        }
      });
    });
    return melhor;
  };

  /* Legenda de tamanho para círculos proporcionais. */
  M.legendaTamanho = function (valores, max, rMax, formatar) {
    return '<div class="legenda-tamanho">' + valores.map((v) => {
      const r = M.raio(v, max, rMax);
      return `<span><svg width="${2 * r + 2}" height="${2 * r + 2}" aria-hidden="true"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" style="fill:none;stroke:var(--texto-mudo);stroke-width:1"/></svg>${R.esc(formatar(v))}</span>`;
    }).join('') + '</div>';
  };

  /* Valores "redondos" para a legenda de tamanho. */
  M.valoresLegenda = function (max) {
    if (!(max > 0)) return [];
    const ordem = Math.pow(10, Math.floor(Math.log10(max)));
    const topo = [1, 2, 5, 10].map((m) => m * ordem).filter((v) => v <= max).pop() || max;
    return [topo, topo / 4].filter((v) => v > 0);
  };
})();

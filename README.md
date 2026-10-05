# analise-rodovia

Sistema web que analisa os dados dos radares de controle de velocidade da **BR-153 (Transbrasiliana)**. A fonte é o arquivo de volume de tráfego do Sistema de Informação de Rodovias da ANTT (`data/volume-radar-trans.csv`).

As análises ficam em cinco abas:

1. **Caracterização do conjunto de dados**: período, equipamentos, rodovia/UF/municípios, tipos de veículo, categorias de velocidade, sentidos, faixas, volume total e lacunas de cobertura.
2. **Tipo de veículo × velocidade**: participação percentual de cada tipo em cada categoria de velocidade, com destaque para percentuais altos sustentados por volumes pequenos.
3. **Pontos monitorados**: volume (total e média diária), composição por tipo e distribuição de velocidade por equipamento, com opção de usar o período comum a todos os equipamentos.
4. **Variação temporal**: médias diárias por dia da semana, transições entre dias, dias úteis × fim de semana e decomposição do aumento até o dia de pico, com filtro por equipamento.
5. **Espacial e operacional**: sentidos e faixas, e ranking de veículos acima de 100 km/h por quantidade absoluta e por proporção.

6. **Painel (Power BI)**: painel interativo no estilo Power BI, com segmentações (ano, equipamento, tipo, sentido, dia da semana), filtragem cruzada por clique, KPIs, mapa e matriz. Também exporta os dados filtrados em CSV para o Power BI e incorpora um relatório publicado (veja [powerbi/README.md](powerbi/README.md)).

Os textos interpretativos são gerados a partir dos números calculados no navegador. Nada está fixo no código.

### Power BI

A pasta [powerbi/](powerbi/) traz o modelo estrela pronto (`fato_volume.csv`, `dim_equipamento.csv`, `dim_velocidade.csv`), as consultas Power Query (`consultas.pq`), as medidas DAX (`medidas.dax`) e o passo a passo. Para mostrar o relatório publicado dentro do sistema, cole o link de incorporação em `js/config.js` (`powerBiUrl`).

### Mapas

- **Aba 1**: BR-153 e demais rodovias da região, com a localização de cada radar (cor = sentido; clique para ver os detalhes).
- **Aba 3**: roscas proporcionais à média diária, com a composição por tipo de veículo ou por categoria de velocidade.
- **Aba 4**: variação da média diária no fim de semana em relação aos dias úteis, por radar (total ou por tipo).
- **Aba 5**: veículos acima de 100 km/h por radar, alternando entre quantidade absoluta e proporção.

O traçado das rodovias vem do OpenStreetMap (© OpenStreetMap contributors, ODbL), obtido via Overpass API e simplificado em `data/rodovias.js`. Por isso as linhas e os radares aparecem mesmo offline. Só o fundo cartográfico depende de internet. O padrão é o Esri (Ruas, Topográfico ou Satélite, no botão de camadas). Os tiles do OpenStreetMap ficam disponíveis apenas quando o sistema é servido por HTTP, porque o servidor do OSM bloqueia ("Access blocked") páginas abertas via `file://`, que não enviam o cabeçalho Referer. A biblioteca Leaflet 1.9.4 fica em `vendor/leaflet/`.

## Como executar

### Localmente, sem instalar nada

Abra `index.html` direto no navegador (duplo clique). Nesse caso (`file://`) o navegador bloqueia a leitura do CSV via `fetch`. Por isso a aplicação usa `data/volume-radar-trans.js`, uma cópia do CSV embutida em JavaScript. Se esse arquivo não existir, a página pede que você selecione o CSV manualmente.

### Com Vite (desenvolvimento)

```bash
npm install
npm run dev
```

### Build e Vercel

```bash
npm run build     # gera dist/
npm run preview   # serve dist/ localmente
```

Na Vercel, importe o repositório. O `vercel.json` já define `npm run build` como comando de build e `dist` como diretório de saída.

### Atualizar os dados

1. Substitua `data/volume-radar-trans.csv` (separador `;`, Latin-1 ou UTF-8).
2. Rode `npm run dados` para regenerar `data/volume-radar-trans.js`, usado no modo `file://`.

## Estrutura

```
index.html            página e abas
css/style.css         estilos (tema claro/escuro)
js/util.js            formatação e utilitários
js/dados.js           carregamento e normalização do CSV
js/analise.js         agregações estatísticas
js/graficos.js        gráficos em HTML/CSS e tooltip
js/mapa.js            mapas (Leaflet): rodovias, radares, roscas e círculos proporcionais
vendor/leaflet/       biblioteca Leaflet (local, sem CDN)
js/abas.js            renderização e textos de cada aba
js/app.js             inicialização e navegação
data/                 CSV original, cópia em JS e traçado das rodovias (rodovias.js)
scripts/              gerador de data/volume-radar-trans.js
vite.config.js        build (copia js/, css/, data/ e vendor/ para dist/)
```

Os scripts são "clássicos" (sem `type="module"`) e não têm dependências. Por isso o mesmo `index.html` funciona tanto aberto do disco quanto servido pelo Vite/Vercel.

## Observações sobre os dados

- O arquivo vem em Latin-1, e os rótulos de velocidade estão truncados (ex.: `"81 - 100 K"`). Ambos são normalizados na leitura.
- Cada equipamento registra um único sentido e uma única faixa. Por isso, comparar sentidos ou faixas equivale a comparar grupos de equipamentos.
- O LE-89 só tem registros de 01/01/2022 a 01/06/2022, e há 64 dias sem nenhum registro (incluindo quase todo abril/2023).

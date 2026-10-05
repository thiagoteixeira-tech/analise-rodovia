# Power BI: radares BR-153

Arquivos prontos para montar no Power BI Desktop um relatório equivalente ao sistema web.

| Arquivo | Conteúdo |
|---|---|
| `fato_volume.csv` | 65.432 linhas: data, equipamento, sentido, faixa, velocidade (normalizada), tipo de veículo e volume |
| `dim_equipamento.csv` | km, município, UF, rodovia, concessionária, tipo de pista, latitude e longitude de cada radar |
| `dim_velocidade.csv` | categorias de velocidade com ordem, limites e indicador "acima de 100 km/h" |
| `consultas.pq` | Power Query (M) para carregar as três tabelas |
| `medidas.dax` | tabela `Calendario` e medidas (médias diárias, composição, > 100 km/h, variação semanal) |

Os CSVs usam UTF-8, separador `;` e ponto como separador decimal. As consultas M já fazem a conversão com a cultura `en-US`. O botão **Exportar seleção (CSV)**, na aba **6. Painel** do sistema web, gera um `fato_volume.csv` no mesmo formato só com os registros filtrados.

## Passo a passo

1. **Parâmetro.** Em *Transformar dados > Gerenciar parâmetros > Novo*, crie `PastaDados` (Texto) com o caminho desta pasta, terminando em `\`.
2. **Consultas.** Para cada bloco de `consultas.pq`, crie *Nova fonte > Consulta nula > Editor Avançado*, cole o bloco e dê à consulta o nome indicado (`fato_volume`, `dim_equipamento`, `dim_velocidade`). Clique em *Fechar e aplicar*.
3. **Calendário.** Em *Modelagem > Nova tabela*, cole a expressão `Calendario` de `medidas.dax`. Classifique `Dia da semana` por `Nº dia semana` e `Mês` por `Nº mês`.
4. **Relacionamentos** (exibição de Modelo, todos 1 → *, filtro em direção única):
   - `dim_equipamento[equipamento]` → `fato_volume[equipamento]`
   - `dim_velocidade[velocidade]` → `fato_volume[velocidade]`
   - `Calendario[Date]` → `fato_volume[data]`
5. **Ordenação e categorias.** Classifique `dim_velocidade[velocidade]` por `ordem`. Defina a categoria de dados de `latitude` e `longitude` como *Latitude* e *Longitude*.
6. **Medidas.** Crie as medidas de `medidas.dax` na tabela `fato_volume`. Formate `%…` como porcentagem e `Volume`/`Média…` como número inteiro.

## Páginas sugeridas (espelham as abas do sistema)

| Página | Visuais |
|---|---|
| 1. Caracterização | Cartões: `Volume`, `Dias com registro`, `Equipamentos`. Mapa (*Mapa* ou *Azure Maps*) com latitude/longitude de `dim_equipamento` e `Volume` no tamanho. Colunas de `Volume` por `Calendario[Ano-mês]`. |
| 2. Veículo × velocidade | Matriz: linhas `dim_velocidade[velocidade]`, colunas `tipo_veiculo`, valor `% do tipo no contexto`. Barras 100% empilhadas com o mesmo par. |
| 3. Pontos monitorados | Barras de `Média diária` por `equipamento_km`. Barras 100% de `tipo_veiculo` e de `velocidade` por equipamento. Mapa com gráfico de pizza (*legenda* = tipo de veículo). |
| 4. Variação temporal | Colunas de `Média diária` por `Calendario[Dia da semana]`. Tabela com `Variação vs dia anterior`. Matriz `tipo_veiculo` × `Dia da semana` com `Índice semanal`. Cartão `Variação fim de semana vs úteis`. |
| 5. Espacial e operacional | Matriz por `sentido` e `faixa` (`Volume`, `Média por radar-dia`). Tabela por equipamento com `Volume acima de 100 km/h`, `Ranking absoluto > 100`, `% acima de 100 km/h`, `Ranking proporção > 100`. |

Use segmentações de dados (*slicers*) de `Calendario[Ano]`, `dim_equipamento[equipamento]`, `fato_volume[tipo_veiculo]` e `fato_volume[sentido]` em todas as páginas (*Exibir > Sincronizar segmentações*).

## Incorporar o relatório no sistema web

1. No serviço do Power BI, publique o relatório e use *Arquivo > Inserir relatório > Publicar na Web (público)*, ou o link de *Site ou portal* da sua organização.
2. Copie o link do `<iframe>` (`https://app.powerbi.com/view?r=...`).
3. Cole em `js/config.js`, no campo `powerBiUrl`.
4. O relatório aparece na aba **6. Painel** do sistema.

> "Publicar na Web" torna o relatório público. Para dados restritos, use o link de incorporação seguro da organização: ele pede login.

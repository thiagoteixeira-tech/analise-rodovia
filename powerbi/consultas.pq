// =====================================================================
// Power Query (M) — Radares BR-153 (ANTT)
// Cole cada bloco em: Página Inicial > Transformar dados > Nova fonte >
// Consulta nula > Editor Avançado. Dê à consulta o nome indicado.
// =====================================================================

// ---------------------------------------------------------------------
// Parâmetro: PastaDados  (Gerenciar parâmetros > Novo parâmetro, tipo Texto)
// Valor de exemplo (termine com a barra invertida):
//   C:\Users\Aluno\Documents\GitHub\analise-rodovia\powerbi\
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Consulta: fato_volume
// ---------------------------------------------------------------------
let
    Fonte = Csv.Document(
        File.Contents(PastaDados & "fato_volume.csv"),
        [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars = true]),
    Tipos = Table.TransformColumnTypes(
        Cabecalhos,
        {
            {"data", type date},
            {"equipamento", type text},
            {"sentido", type text},
            {"faixa", type text},
            {"velocidade", type text},
            {"tipo_veiculo", type text},
            {"volume", Int64.Type}
        },
        "en-US"
    )
in
    Tipos

// ---------------------------------------------------------------------
// Consulta: dim_equipamento
// ---------------------------------------------------------------------
let
    Fonte = Csv.Document(
        File.Contents(PastaDados & "dim_equipamento.csv"),
        [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars = true]),
    Tipos = Table.TransformColumnTypes(
        Cabecalhos,
        {
            {"equipamento", type text},
            {"km", Int64.Type},
            {"municipio", type text},
            {"uf", type text},
            {"rodovia", type text},
            {"concessionaria", type text},
            {"tipo_pista", type text},
            {"latitude", type number},
            {"longitude", type number}
        },
        "en-US"
    ),
    Rotulo = Table.AddColumn(Tipos, "equipamento_km", each [equipamento] & " (km " & Text.From([km]) & ")", type text)
in
    Rotulo

// ---------------------------------------------------------------------
// Consulta: dim_velocidade
// ---------------------------------------------------------------------
let
    Fonte = Csv.Document(
        File.Contents(PastaDados & "dim_velocidade.csv"),
        [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars = true]),
    Tipos = Table.TransformColumnTypes(
        Cabecalhos,
        {
            {"velocidade", type text},
            {"ordem", Int64.Type},
            {"km_h_min", Int64.Type},
            {"km_h_max", Int64.Type},
            {"acima_100", type text}
        },
        "en-US"
    )
in
    Tipos

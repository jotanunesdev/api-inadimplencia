-- =============================================================================
-- 2026-04-22 — Fiadores / associados da venda
-- Script idempotente. Ja aplicado em producao.
-- Referencia: prd-dashboard-filtros-fiadores-alteracao-data/prd.md
-- =============================================================================

-- 1) Indice para acelerar o lookup por NUM_VENDA (N associados por venda).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_fat_associados_num_venda__NUM_VENDA'
      AND object_id = OBJECT_ID('DW.fat_associados_num_venda')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_fat_associados_num_venda__NUM_VENDA
        ON DW.fat_associados_num_venda (NUM_VENDA)
        INCLUDE (
            ID_ASSOCIADO,
            ID_RESERVA,
            ID_PESSOA,
            NOME,
            DOCUMENTO,
            DATA_CADASTRO,
            RENDA_FAMILIAR,
            TIPO_ASSOCIACAO,
            ENDERECO
        );
END
GO

-- 2) View consumida pela API (INNER JOIN garante que so retornamos
--    associados de vendas presentes no fato de inadimplencia).
CREATE OR ALTER VIEW DW.vw_fiadores_por_venda AS
SELECT
    a.NUM_VENDA,
    a.ID_ASSOCIADO,
    a.ID_RESERVA,
    a.ID_PESSOA,
    a.NOME,
    a.DOCUMENTO,
    a.DATA_CADASTRO,
    a.RENDA_FAMILIAR,
    a.TIPO_ASSOCIACAO,
    a.ENDERECO
FROM DW.fat_associados_num_venda a
INNER JOIN DW.fat_analise_inadimplencia_v4 f
        ON f.NUM_VENDA = a.NUM_VENDA;
GO

-- 3) Query de referencia usada pelo fiadoresModel.findByNumVenda.
-- SELECT ID_ASSOCIADO, ID_RESERVA, ID_PESSOA, NOME, DOCUMENTO,
--        DATA_CADASTRO, RENDA_FAMILIAR, TIPO_ASSOCIACAO, NUM_VENDA, ENDERECO
-- FROM   DW.vw_fiadores_por_venda
-- WHERE  NUM_VENDA = @numVenda
-- ORDER  BY DATA_CADASTRO DESC, NOME ASC;

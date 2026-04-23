const db = require('../config/db');
const { sql } = db;

const TABLE_FAT = 'DW.fat_analise_inadimplencia_v4';
const COL_SALDO = 'VALOR_TOTAL_EM_ABERTO';
const COL_INADIMPLENTE = 'VALOR_INADIMPLENTE';
const COL_STATUS_INADIMPLENCIA = 'INADIMPLENTE';
const TABLE_OC = 'dbo.OCORRENCIAS';
const TABLE_USU = 'dbo.USUARIO';
const TABLE_RESP = 'dbo.VENDA_RESPONSAVEL';

const EMPTY_RANGE = { hasRange: false, dataInicio: null, dataFim: null };

function normalizeRange(range) {
  if (!range || typeof range !== 'object') {
    return EMPTY_RANGE;
  }
  if (!range.hasRange) {
    return EMPTY_RANGE;
  }
  return {
    hasRange: true,
    dataInicio: range.dataInicio,
    dataFim: range.dataFim,
  };
}

function applyDateRangeInputs(request, range) {
  if (!range.hasRange) {
    return request;
  }
  return request
    .input('dataInicio', sql.Date, range.dataInicio)
    .input('dataFim', sql.Date, range.dataFim);
}

function buildDateRangeCondition(columnExpr, hasRange) {
  if (!hasRange) {
    return '';
  }
  return `AND ${columnExpr} BETWEEN @dataInicio AND @dataFim`;
}

function buildLatestAcaoApply(hasRange) {
  const extra = hasRange
    ? 'AND o.DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim'
    : '';
  return `
  OUTER APPLY (
    SELECT TOP 1 o.PROXIMA_ACAO
    FROM ${TABLE_OC} o
    WHERE o.NUM_VENDA_FK = f.NUM_VENDA
      AND o.PROXIMA_ACAO IS NOT NULL
      ${extra}
    ORDER BY o.DT_OCORRENCIA DESC, o.HORA_OCORRENCIA DESC, o.PROXIMA_ACAO DESC
  ) AS ultima_acao
`;
}

function buildInadimplenteCondition(alias = 'f') {
  return `UPPER(LTRIM(RTRIM(COALESCE(${alias}.${COL_STATUS_INADIMPLENCIA}, '')))) = 'SIM'`;
}

const FILTERED_SALES_SUBQUERY = `
  SELECT DISTINCT fat.NUM_VENDA
  FROM ${TABLE_FAT} fat
  WHERE ${buildInadimplenteCondition('fat')}
`;

// =============================================================================
// Endpoints NAO filtrados por periodo (comportamento inalterado)
// =============================================================================

async function kpis() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COUNT(*) AS TOTAL_VENDAS,
        COUNT(DISTINCT CPF_CNPJ) AS TOTAL_CLIENTES,
        SUM(CAST(${COL_SALDO} AS float)) AS TOTAL_SALDO,
        SUM(CAST(${COL_INADIMPLENTE} AS float)) AS TOTAL_INADIMPLENTE,
        CAST(
          CASE WHEN SUM(CAST(${COL_SALDO} AS float)) = 0 THEN 0
          ELSE (100.0 * SUM(CAST(${COL_INADIMPLENTE} AS float)) / SUM(CAST(${COL_SALDO} AS float)))
          END AS decimal(10,2)
        ) AS PERC_INADIMPLENTE
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}`
  );
  return result.recordset[0];
}

async function vendasPorResponsavel(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('fat.VENCIMENTO_MAIS_ANTIGO', range.hasRange);
  const nullCondition = range.hasRange ? 'AND fat.VENCIMENTO_MAIS_ANTIGO IS NOT NULL' : '';

  const result = await request.query(
    `SELECT
        u.NOME AS RESPONSAVEL,
        COUNT(vr_inad.NUM_VENDA_FK) AS TOTAL_VENDAS,
        u.COR_HEX
     FROM ${TABLE_USU} u
     LEFT JOIN (
       SELECT DISTINCT vr.NUM_VENDA_FK, vr.NOME_USUARIO_FK
       FROM ${TABLE_RESP} vr
       INNER JOIN ${TABLE_FAT} fat ON fat.NUM_VENDA = vr.NUM_VENDA_FK
       WHERE ${buildInadimplenteCondition('fat')}
         ${nullCondition}
         ${dateCondition}
     ) vr_inad ON vr_inad.NOME_USUARIO_FK = u.NOME
     GROUP BY u.NOME, u.COR_HEX
     ORDER BY TOTAL_VENDAS DESC`
  );
  return result.recordset;
}

async function todosResponsaveis() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT *
    FROM ${TABLE_RESP}`
  );
  return result.recordset;
}

async function inadimplenciaPorEmpreendimento() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(EMPREENDIMENTO, 'Nao informado') AS EMPREENDIMENTO,
        COUNT(*) AS TOTAL_VENDAS,
        SUM(CAST(${COL_SALDO} AS float)) AS TOTAL_SALDO,
        SUM(CAST(${COL_INADIMPLENTE} AS float)) AS TOTAL_INADIMPLENTE
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(EMPREENDIMENTO, 'Nao informado')
     ORDER BY TOTAL_SALDO DESC`
  );
  return result.recordset;
}

async function clientesPorEmpreendimento() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(EMPREENDIMENTO, 'Nao informado') AS EMPREENDIMENTO,
        COUNT(DISTINCT CPF_CNPJ) AS TOTAL_CLIENTES
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(EMPREENDIMENTO, 'Nao informado')
     ORDER BY TOTAL_CLIENTES DESC`
  );
  return result.recordset;
}

async function statusRepasse() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(STATUS_REPASSE, 'Nao informado') AS STATUS_REPASSE,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(STATUS_REPASSE, 'Nao informado')
     ORDER BY TOTAL DESC`
  );
  return result.recordset;
}

async function blocos() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(EMPREENDIMENTO, 'Nao informado') AS EMPREENDIMENTO,
        COALESCE(BLOCO, 'Nao informado') AS BLOCO,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(EMPREENDIMENTO, 'Nao informado'), COALESCE(BLOCO, 'Nao informado')
     ORDER BY TOTAL DESC`
  );
  return result.recordset;
}

async function unidades() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(EMPREENDIMENTO, 'Nao informado') AS EMPREENDIMENTO,
        COALESCE(UNIDADE, 'Nao informado') AS UNIDADE,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(EMPREENDIMENTO, 'Nao informado'), COALESCE(UNIDADE, 'Nao informado')
     ORDER BY TOTAL DESC`
  );
  return result.recordset;
}

async function usuariosAtivos() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        CASE WHEN ATIVO = 1 THEN 'Ativo' ELSE 'Inativo' END AS STATUS,
        COUNT(*) AS TOTAL
     FROM ${TABLE_USU}
     GROUP BY CASE WHEN ATIVO = 1 THEN 'Ativo' ELSE 'Inativo' END`
  );
  return result.recordset;
}

async function aging() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        CASE
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 0 AND 30 THEN '0-30'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 31 AND 90 THEN '31-90'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 91 AND 180 THEN '91-180'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) > 180 THEN '180+'
          ELSE '0-30'
        END AS FAIXA,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE VENCIMENTO_MAIS_ANTIGO IS NOT NULL
       AND ${buildInadimplenteCondition('f')}
       AND DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) >= 0
     GROUP BY
        CASE
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 0 AND 30 THEN '0-30'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 31 AND 90 THEN '31-90'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 91 AND 180 THEN '91-180'
          WHEN DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) > 180 THEN '180+'
          ELSE '0-30'
        END
     ORDER BY FAIXA`
  );
  return result.recordset;
}

async function parcelasInadimplentes() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(CAST(QTD_PARCELAS_INADIMPLENTES AS varchar(20)), 'Nao informado') AS QTD_PARCELAS,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY QTD_PARCELAS_INADIMPLENTES
     ORDER BY
        CASE WHEN QTD_PARCELAS_INADIMPLENTES IS NULL THEN 1 ELSE 0 END,
        QTD_PARCELAS_INADIMPLENTES`
  );
  return result.recordset;
}

async function parcelasDetalhes(qtdParcelas, isNull, limit) {
  const pool = await db.getPool();
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 200;

  const request = pool.request().input('limit', sql.Int, safeLimit);
  let whereClause = 'QTD_PARCELAS_INADIMPLENTES IS NULL';

  if (!isNull) {
    request.input('qtdParcelas', sql.Int, qtdParcelas);
    whereClause = 'QTD_PARCELAS_INADIMPLENTES = @qtdParcelas';
  }

  const latestApply = buildLatestAcaoApply(false);
  const result = await request.query(
    `SELECT TOP (@limit)
        CLIENTE,
        CPF_CNPJ,
        NUM_VENDA,
        EMPREENDIMENTO,
        BLOCO,
        UNIDADE,
        SCORE,
        CAST(${COL_SALDO} AS float) AS SALDO,
        CAST(${COL_INADIMPLENTE} AS float) AS VALOR_SOMENTE_INADIMPLENTE,
        QTD_PARCELAS_INADIMPLENTES,
        VENCIMENTO_MAIS_ANTIGO,
        STATUS_REPASSE,
        ultima_acao.PROXIMA_ACAO AS PROXIMA_ACAO,
        SUGESTAO
     FROM ${TABLE_FAT} f
     ${latestApply}
     WHERE ${buildInadimplenteCondition('f')}
       AND ${whereClause}
     ORDER BY CAST(${COL_SALDO} AS float) DESC`
  );
  return result.recordset;
}

async function scoreSaldo() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        SCORE,
        AVG(CAST(${COL_SALDO} AS float)) AS MEDIA_SALDO,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
       AND SCORE IS NOT NULL
     GROUP BY SCORE
     ORDER BY SCORE`
  );
  return result.recordset;
}

async function scoreSaldoDetalhes(score, limit) {
  const pool = await db.getPool();
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 200;
  const latestApply = buildLatestAcaoApply(false);

  const result = await pool
    .request()
    .input('score', sql.Float, score)
    .input('limit', sql.Int, safeLimit)
    .query(
      `SELECT TOP (@limit)
          CLIENTE,
          CPF_CNPJ,
          NUM_VENDA,
          EMPREENDIMENTO,
          BLOCO,
          UNIDADE,
          SCORE,
          CAST(${COL_SALDO} AS float) AS SALDO,
          CAST(${COL_INADIMPLENTE} AS float) AS VALOR_SOMENTE_INADIMPLENTE,
          QTD_PARCELAS_INADIMPLENTES,
          VENCIMENTO_MAIS_ANTIGO,
          STATUS_REPASSE,
          ultima_acao.PROXIMA_ACAO AS PROXIMA_ACAO,
          SUGESTAO
       FROM ${TABLE_FAT} f
       ${latestApply}
       WHERE ${buildInadimplenteCondition('f')}
         AND SCORE = @score
       ORDER BY CAST(${COL_SALDO} AS float) DESC`
    );
  return result.recordset;
}

async function saldoPorMesVencimento() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        DATEFROMPARTS(YEAR(VENCIMENTO_MAIS_ANTIGO), MONTH(VENCIMENTO_MAIS_ANTIGO), 1) AS MES,
        SUM(CAST(${COL_SALDO} AS float)) AS TOTAL_SALDO
     FROM ${TABLE_FAT} f
     WHERE VENCIMENTO_MAIS_ANTIGO IS NOT NULL
       AND ${buildInadimplenteCondition('f')}
     GROUP BY YEAR(VENCIMENTO_MAIS_ANTIGO), MONTH(VENCIMENTO_MAIS_ANTIGO)
     ORDER BY MES`
  );
  return result.recordset;
}

async function perfilRiscoEmpreendimento() {
  const pool = await db.getPool();
  const result = await pool.request().query(
    `SELECT
        COALESCE(EMPREENDIMENTO, 'Nao informado') AS EMPREENDIMENTO,
        COUNT(*) AS TOTAL_VENDAS,
        COUNT(DISTINCT CPF_CNPJ) AS TOTAL_CLIENTES,
        AVG(CAST(SCORE AS float)) AS MEDIA_SCORE,
        AVG(CAST(QTD_PARCELAS_INADIMPLENTES AS float)) AS MEDIA_PARCELAS,
        SUM(CAST(${COL_SALDO} AS float)) AS TOTAL_SALDO,
        SUM(CAST(${COL_INADIMPLENTE} AS float)) AS TOTAL_INADIMPLENTE
     FROM ${TABLE_FAT} f
     WHERE ${buildInadimplenteCondition('f')}
     GROUP BY COALESCE(EMPREENDIMENTO, 'Nao informado')
     ORDER BY EMPREENDIMENTO`
  );
  return result.recordset;
}

async function agingDetalhes(faixa, limit) {
  const pool = await db.getPool();

  let whereClause = '';
  switch (faixa) {
    case '0-30':
      whereClause = 'VENCIMENTO_MAIS_ANTIGO IS NOT NULL AND DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 0 AND 30';
      break;
    case '31-90':
      whereClause = 'VENCIMENTO_MAIS_ANTIGO IS NOT NULL AND DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 31 AND 90';
      break;
    case '91-180':
      whereClause = 'VENCIMENTO_MAIS_ANTIGO IS NOT NULL AND DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) BETWEEN 91 AND 180';
      break;
    case '180+':
      whereClause = 'VENCIMENTO_MAIS_ANTIGO IS NOT NULL AND DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) > 180';
      break;
    default:
      whereClause = '1 = 0';
      break;
  }

  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 200;

  const result = await pool.request()
    .input('limit', sql.Int, safeLimit)
    .query(
      `SELECT TOP (@limit)
          CLIENTE,
          CPF_CNPJ,
          NUM_VENDA,
          EMPREENDIMENTO,
          BLOCO,
          UNIDADE,
          VENCIMENTO_MAIS_ANTIGO,
          DATEDIFF(day, VENCIMENTO_MAIS_ANTIGO, GETDATE()) AS DIAS_ATRASO,
          CAST(${COL_SALDO} AS float) AS SALDO,
          CAST(${COL_INADIMPLENTE} AS float) AS VALOR_SOMENTE_INADIMPLENTE
       FROM ${TABLE_FAT} f
       WHERE ${buildInadimplenteCondition('f')}
         AND ${whereClause}
       ORDER BY DIAS_ATRASO DESC, VENCIMENTO_MAIS_ANTIGO ASC`
    );
  return result.recordset;
}

// =============================================================================
// Endpoints FILTRADOS por periodo (aceitam { hasRange, dataInicio, dataFim })
// =============================================================================

async function todasOcorrencias(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const whereFragment = range.hasRange
    ? `WHERE DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim`
    : '';
  const result = await request.query(
    `SELECT *
     FROM ${TABLE_OC}
     ${whereFragment}`
  );
  return result.recordset;
}

async function ocorrenciasPorUsuario(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT
        COALESCE(o.NOME_USUARIO_FK, 'Nao informado') AS USUARIO,
        COUNT(*) AS TOTAL,
        MAX(u.COR_HEX) AS COR_HEX
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     LEFT JOIN ${TABLE_USU} u ON u.NOME = o.NOME_USUARIO_FK
     ${whereFragment}
     GROUP BY COALESCE(o.NOME_USUARIO_FK, 'Nao informado')
     ORDER BY TOTAL DESC`
  );
  return result.recordset;
}

async function ocorrenciasPorVenda(limit, rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const topClause = limit ? `TOP (${limit})` : '';
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT ${topClause}
        NUM_VENDA_FK,
        COUNT(*) AS TOTAL
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     ${whereFragment}
     GROUP BY NUM_VENDA_FK
     ORDER BY TOTAL DESC`
  );
  return result.recordset;
}

async function ocorrenciasPorDia(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT
        DT_OCORRENCIA AS DATA,
        COUNT(*) AS TOTAL
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     ${whereFragment}
     GROUP BY DT_OCORRENCIA
     ORDER BY DATA`
  );
  return result.recordset;
}

async function ocorrenciasPorHora(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT
        DATEPART(HOUR, HORA_OCORRENCIA) AS HORA,
        COUNT(*) AS TOTAL
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     ${whereFragment}
     GROUP BY DATEPART(HOUR, HORA_OCORRENCIA)
     ORDER BY HORA`
  );
  return result.recordset;
}

async function ocorrenciasPorDiaHora(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT
        DT_OCORRENCIA AS DATA,
        DATEPART(HOUR, HORA_OCORRENCIA) AS HORA,
        COUNT(*) AS TOTAL
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     ${whereFragment}
     GROUP BY DT_OCORRENCIA, DATEPART(HOUR, HORA_OCORRENCIA)
     ORDER BY DATA, HORA`
  );
  return result.recordset;
}

async function proximasAcoesPorDia(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const latestApply = buildLatestAcaoApply(range.hasRange);
  const result = await request.query(
    `SELECT
        CONVERT(date, ultima_acao.PROXIMA_ACAO) AS DATA,
        COUNT(*) AS TOTAL
     FROM ${TABLE_FAT} f
     ${latestApply}
     WHERE ultima_acao.PROXIMA_ACAO IS NOT NULL
       AND ${buildInadimplenteCondition('f')}
     GROUP BY CONVERT(date, ultima_acao.PROXIMA_ACAO)
     ORDER BY DATA`
  );
  return result.recordset;
}

async function acoesDefinidas(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const latestApply = buildLatestAcaoApply(range.hasRange);
  const result = await request.query(
    `SELECT
        COUNT(*) AS TOTAL_VENDAS,
        SUM(CASE WHEN ultima_acao.PROXIMA_ACAO IS NOT NULL THEN 1 ELSE 0 END) AS COM_ACAO,
        SUM(CASE WHEN ultima_acao.PROXIMA_ACAO IS NULL THEN 1 ELSE 0 END) AS SEM_ACAO,
        CAST(
          CASE WHEN COUNT(*) = 0 THEN 0
          ELSE (100.0 * SUM(CASE WHEN ultima_acao.PROXIMA_ACAO IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*))
          END AS decimal(10,2)
        ) AS PERC_COM_ACAO
     FROM ${TABLE_FAT} f
     ${latestApply}
     WHERE ${buildInadimplenteCondition('f')}`
  );
  return result.recordset[0];
}

async function atendentesProximaAcao(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  const whereFragment = range.hasRange ? `WHERE 1 = 1 ${dateCondition}` : '';
  const result = await request.query(
    `SELECT
        COALESCE(o.NOME_USUARIO_FK, 'Nao informado') AS USUARIO,
        MAX(u.COR_HEX) AS COR_HEX,
        SUM(CASE WHEN o.PROXIMA_ACAO IS NOT NULL AND o.DT_OCORRENCIA >= DATEADD(day, -7, CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS ULT_7_DIAS,
        SUM(CASE WHEN o.PROXIMA_ACAO IS NOT NULL AND o.DT_OCORRENCIA >= DATEADD(day, -15, CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS ULT_15_DIAS,
        SUM(CASE WHEN o.PROXIMA_ACAO IS NOT NULL AND o.DT_OCORRENCIA >= DATEADD(day, -30, CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS ULT_30_DIAS,
        SUM(CASE WHEN o.PROXIMA_ACAO IS NOT NULL AND o.DT_OCORRENCIA >= DATEADD(month, -6, CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS ULT_6_MESES,
        SUM(CASE WHEN o.PROXIMA_ACAO IS NOT NULL AND o.DT_OCORRENCIA >= DATEADD(year, -1, CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS ULT_1_ANO
     FROM ${TABLE_OC} o
     INNER JOIN (
       ${FILTERED_SALES_SUBQUERY}
     ) vendas_inad ON vendas_inad.NUM_VENDA = o.NUM_VENDA_FK
     LEFT JOIN ${TABLE_USU} u ON u.NOME = o.NOME_USUARIO_FK
     ${whereFragment}
     GROUP BY COALESCE(o.NOME_USUARIO_FK, 'Nao informado')
     ORDER BY ULT_7_DIAS DESC, ULT_15_DIAS DESC, ULT_30_DIAS DESC`
  );
  return result.recordset;
}

module.exports = {
  kpis,
  vendasPorResponsavel,
  inadimplenciaPorEmpreendimento,
  clientesPorEmpreendimento,
  statusRepasse,
  blocos,
  unidades,
  usuariosAtivos,
  ocorrenciasPorUsuario,
  ocorrenciasPorVenda,
  ocorrenciasPorDia,
  ocorrenciasPorHora,
  ocorrenciasPorDiaHora,
  proximasAcoesPorDia,
  acoesDefinidas,
  aging,
  parcelasInadimplentes,
  scoreSaldo,
  saldoPorMesVencimento,
  perfilRiscoEmpreendimento,
  atendentesProximaAcao,
  agingDetalhes,
  parcelasDetalhes,
  scoreSaldoDetalhes,
  todasOcorrencias,
  todosResponsaveis,
};

const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');
const { getLastResultSet, withGlpiSchema } = require('../config/db');

let poolProvider = async () => require('../config/db').getPool();
let queryTimeoutMs = env.QUERY_TIMEOUT_MS;

function setPoolProvider(provider) {
  poolProvider = provider;
}

function setQueryTimeoutMs(value) {
  queryTimeoutMs = value;
}

function appendCondition(clauses, values, condition, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  clauses.push(condition);
  values.push(value);
}

const BASE_CUSTOS_SQL = `
  SELECT
    GT.id AS id,
    GT.tickets_id AS tickets_id,
    GPO.name AS grupo,
    GT.name AS titulo,
    GT.comment AS comment,
    GT.begin_date AS data_atendimento,
    ((GT.actiontime / 3600) * GT.cost_time) + GT.cost_fixed AS custo_total
  FROM glpi_ticketcosts GT
  INNER JOIN glpi.glpi_groups_tickets GPT
    ON GT.tickets_id = GPT.tickets_id
  INNER JOIN glpi.glpi_groups GPO
    ON GPT.groups_id = GPO.id
  WHERE (
    GPO.name LIKE '%DW%'
    OR GPO.name LIKE '%DECODIFICAR%'
    OR GPO.name LIKE '%ESSOLUCAO%'
  )`;

function buildCustosSql(filters = {}) {
  const clauses = ['BASE.custo_total <> 0'];
  const values = [];

  appendCondition(clauses, values, 'BASE.data_atendimento >= ?', filters.dataInicio);
  appendCondition(
    clauses,
    values,
    'BASE.data_atendimento < DATE_ADD(?, INTERVAL 1 DAY)',
    filters.dataFim
  );
  appendCondition(
    clauses,
    values,
    'BASE.grupo LIKE CONCAT("%", ?, "%")',
    filters.grupo
  );

  const sql = `
SELECT *
FROM (
${BASE_CUSTOS_SQL}
) BASE
WHERE 1=1
${clauses.map((clause) => `  AND ${clause}`).join('\n')}
ORDER BY BASE.data_atendimento DESC, BASE.id DESC`;

  return {
    sql,
    values,
  };
}

function isMysqlUnavailableError(err) {
  const code = String(err?.code ?? '');

  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    code.startsWith('ER_')
  );
}

function mapMysqlError(err) {
  if (isMysqlUnavailableError(err)) {
    return new AppError(503, 'Banco GLPI indisponivel.', 'DB_UNAVAILABLE', {
      mysqlCode: err?.code,
    });
  }

  return err;
}

async function listCustos(filters = {}) {
  const pool = await poolProvider();
  const { sql, values } = buildCustosSql(filters);

  try {
    const [results] = await pool.query({
      sql: withGlpiSchema(sql),
      values,
      timeout: queryTimeoutMs,
    });

    const rows = getLastResultSet(results);

    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    throw mapMysqlError(err);
  }
}

module.exports = {
  buildCustosSql,
  setPoolProvider,
  setQueryTimeoutMs,
  listCustos,
};

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

const BASE_CHAMADOS_SQL = `
SELECT
 ticket_jnc.id,
 ticket_jnc.tipo,
 ticket_jnc.titulo,
 ticket_jnc.data_abertura,
 ticket_jnc.data_fechamento,
 ticket_jnc.data_add_validacao,
 ticket_jnc.takeintoaccountdate,
 ticket_jnc.data_modificacao,
 CASE
  WHEN ticket_jnc.status = 1 THEN 'Novo'
  WHEN ticket_jnc.status = 2 THEN 'Atribuido'
  WHEN ticket_jnc.status = 3 THEN 'Planejado'
  WHEN ticket_jnc.status = 4 THEN 'BackLog'
  WHEN ticket_jnc.status = 5 THEN 'Em Validacao'
  WHEN ticket_jnc.status = 6 THEN 'Fechado'
  ELSE 'Nao Classificado'
 END AS status,
 ticket_jnc.solicitante,
 ticket_jnc.descricao_categoria,
 ticket_jnc.descricao_categoria_simples,
 CASE
  WHEN ticket_jnc.descricao_categoria LIKE '%Generalista de TI - Hardware%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sistemas - Framework%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Solicitação de acesso - Rede / Conectividade%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Solicitação de software - Instalação%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sistemas - Framework%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Solicitação de equipamentos - Periféricos%' THEN 'Infra'
  WHEN ticket_jnc.descricao_categoria LIKE '%Generalista de TI - Rede / Conectividade%' THEN 'Rede - Seguranca'
  WHEN ticket_jnc.descricao_categoria LIKE '%Segurança da informação%' THEN 'Rede - Seguranca'
  WHEN ticket_jnc.descricao_categoria LIKE '%Banco de dados%' THEN 'Rede - Seguranca'
  WHEN ticket_jnc.descricao_categoria LIKE '%Backup%' THEN 'Rede - Seguranca'
  WHEN ticket_jnc.descricao_categoria LIKE '%ERP RM%' THEN 'Sistemas ERP/Fluig'
  WHEN ticket_jnc.descricao_categoria LIKE '%Fluig - Framework%' THEN 'Sistemas ERP/Fluig'
  WHEN ticket_jnc.descricao_categoria LIKE '%Solicitação de acesso - Software / Sistemas%' THEN 'Sistemas ERP/Fluig'
  WHEN ticket_jnc.descricao_categoria LIKE '%BI%' THEN 'Business Intelligence'
  WHEN ticket_jnc.descricao_categoria LIKE '%agente de IA%' THEN 'Automacao - AI'
  WHEN ticket_jnc.descricao_categoria LIKE '%automação%' THEN 'Automacao - AI'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sustentação TI%' THEN 'Sustentacao TI'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sustentação Qualidade%' THEN 'Sustentação Qualidade'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sustentação Departamento Pessoal%' THEN 'Sustentação Departamento Pessoal'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sustentação Recursos Humanos%' THEN 'Sustentação Recursos Humanos'
  WHEN ticket_jnc.descricao_categoria LIKE '%Sustentação Inovação Tecnica%' THEN 'Sustentação Inovação Tecnica'
  ELSE 'Nao Classificado'
 END AS grupo_equipe,
 CASE
  WHEN glpi_users.name LIKE '%DW%' THEN 'DataWer'
  WHEN glpi_users.name LIKE '%ESSOLUCAO%' THEN 'ESSolucao'
  WHEN glpi_users.name LIKE '%DECODIFICAR%' THEN 'Decodificar'
  ELSE 'Jotanunes'
 END AS grupo_empresa,
 glpi_users.name nome_tecnico,
 ticket_jnc.time_to_resolve,
 ticket_jnc.time_to_own,
 ticket_jnc.begin_waiting_date,
 ticket_jnc.sla_waiting_duration,
 ticket_jnc.waiting_duration,
 ticket_jnc.close_delay_stat,
 ticket_jnc.takeintoaccount_delay_stat,
 ticket_jnc.is_deleted,
 ticket_jnc.localizacao,
 ticket_jnc.cidade,
 glpi_plugin_tag_tags.name etiqueta
FROM
(
 SELECT
  DISTINCT glpi_tickets.id id,
  glpi_tickets.entities_id entidade,
  CASE
   WHEN TEC.users_id IN (213, 241, 331, 342, 349) THEN 'Infra'
   WHEN TEC.users_id IN (13, 19, 134, 189, 202, 239, 240, 261) THEN 'Sistema'
   WHEN TEC.users_id IN (316) THEN 'BI'
  END AS grupo,
  CASE
   WHEN glpi_tickets.type = 1 THEN 'Incidente'
   ELSE 'Requisicao'
  END AS tipo,
  glpi_tickets.name titulo,
  glpi_tickets.date data_abertura,
  glpi_tickets.closedate data_fechamento,
  glpi_tickets.solvedate data_add_validacao,
  glpi_tickets.takeintoaccountdate,
  glpi_tickets.date_mod data_modificacao,
  glpi_tickets.status,
  glpi_users.name solicitante,
  glpi_tickets.itilcategories_id idcategoria,
  glpi_itilcategories.completename descricao_categoria,
  glpi_itilcategories.name descricao_categoria_simples,
  TEC.users_id id_tecnico,
  glpi_tickets.time_to_resolve,
  glpi_tickets.time_to_own,
  glpi_tickets.begin_waiting_date,
  glpi_tickets.sla_waiting_duration,
  glpi_tickets.waiting_duration,
  glpi_tickets.close_delay_stat,
  glpi_tickets.takeintoaccount_delay_stat,
  glpi_tickets.is_deleted,
  glpi_locations.name localizacao,
  glpi_locations.town cidade
 FROM
  glpi_tickets
 LEFT JOIN glpi_locations
  ON glpi_tickets.locations_id = glpi_locations.id
 LEFT JOIN glpi_itilcategories
  ON glpi_tickets.itilcategories_id = glpi_itilcategories.id
 LEFT JOIN glpi_users
  ON glpi_tickets.users_id_recipient = glpi_users.id
 LEFT JOIN (
  SELECT
   tickets_id,
   users_id
  FROM
   glpi_tickets_users
  WHERE
   glpi_tickets_users.type = 2
 ) TEC
  ON TEC.tickets_id = glpi_tickets.id
 WHERE glpi_tickets.is_deleted = 0
) ticket_jnc
LEFT JOIN glpi_users
 ON ticket_jnc.id_tecnico = glpi_users.id
LEFT JOIN glpi_plugin_tag_tagitems
 ON ticket_jnc.id = glpi_plugin_tag_tagitems.items_id
 AND glpi_plugin_tag_tagitems.itemtype = 'Ticket'
LEFT JOIN glpi_plugin_tag_tags
 ON glpi_plugin_tag_tags.id = glpi_plugin_tag_tagitems.plugin_tag_tags_id
WHERE glpi_users.name NOT LIKE ('priscilla.ribeiro')
 AND glpi_users.name NOT LIKE ('fabio.machado')`;

function appendCondition(clauses, values, condition, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  clauses.push(condition);
  values.push(value);
}

function buildChamadosSql(filters = {}) {
  const clauses = [];
  const values = [];

  appendCondition(clauses, values, 'ticket_jnc.data_abertura >= ?', filters.dataInicio);
  appendCondition(
    clauses,
    values,
    'ticket_jnc.data_abertura < DATE_ADD(?, INTERVAL 1 DAY)',
    filters.dataFim
  );

  if (Array.isArray(filters.status) && filters.status.length > 0) {
    const statusMap = new Map([
      ['Novo', 1],
      ['Atribuido', 2],
      ['Planejado', 3],
      ['BackLog', 4],
      ['Em Validacao', 5],
      ['Fechado', 6],
    ]);
    const statusValues = filters.status
      .map((status) => statusMap.get(status))
      .filter((value) => value !== undefined);

    if (statusValues.length > 0) {
      clauses.push(`ticket_jnc.status IN (${statusValues.map(() => '?').join(', ')})`);
      values.push(...statusValues);
    }
  }

  appendCondition(clauses, values, 'ticket_jnc.tipo = ?', filters.tipo);

  const sql = `
${BASE_CHAMADOS_SQL}
${clauses.length > 0 ? `
 AND ${clauses.join('\n AND ')}` : ''}
ORDER BY ticket_jnc.id`;

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

async function listChamados(filters = {}) {
  const pool = await poolProvider();
  const { sql, values } = buildChamadosSql(filters);

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
  buildChamadosSql,
  setPoolProvider,
  setQueryTimeoutMs,
  listChamados,
};

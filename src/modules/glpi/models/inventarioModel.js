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

function buildFilterClauses(filters = {}) {
  const clauses = [];
  const values = [];

  appendCondition(clauses, values, 'inventory.date_creation >= ?', filters.dataInicio);
  appendCondition(
    clauses,
    values,
    'inventory.date_creation < DATE_ADD(?, INTERVAL 1 DAY)',
    filters.dataFim
  );

  return {
    clauses,
    values,
  };
}

const BASE_INVENTARIO_SQL = `
SELECT
 gc.id
,
 gc.name AS ativo
,
 gc.serial
,
 gc.comment
,
 gl.name as localizacao 
,
 gl.town as cidade
,
 gl.state as estado
,
 gctype.name as tipo 
,
 gu.name as lotado_para
,
 gstates.name as status
,
 gc.date_creation
,
 gc.date_mod
,
 gc.last_inventory_update
,
 glpi.glpi_plugin_tag_tags.name etiqueta
,
 gcost.value AS custo
,
 'Computer' AS origem
FROM
 glpi.glpi_computers gc
LEFT JOIN glpi.glpi_locations gl
ON
 gc.entities_id = gl.entities_id
 AND gc.locations_id = gl.id
LEFT JOIN glpi.glpi_users gu 
 ON
 gc.users_id = gu.id
LEFT JOIN glpi.glpi_computertypes gctype
ON
 gc.computertypes_id = gctype.id
LEFT JOIN glpi.glpi_states gstates
ON
 gc.states_id = gstates.id
LEFT JOIN glpi.glpi_plugin_tag_tagitems
ON
 gc.id = glpi.glpi_plugin_tag_tagitems.items_id
 AND glpi.glpi_plugin_tag_tagitems.itemtype = 'Computer'
LEFT JOIN glpi.glpi_plugin_tag_tags
ON
 glpi.glpi_plugin_tag_tags.id = glpi.glpi_plugin_tag_tagitems.plugin_tag_tags_id
LEFT JOIN glpi.glpi_infocoms gcost 
ON
 gc.id = gcost.items_id 
 AND gcost.itemtype = 'Computer'
WHERE
 gc.is_deleted = 0
UNION ALL
SELECT
 gn.id
,
 gn.name AS ativo
,
 gn.otherserial AS serial
,
 gn.comment
,
 gl.name as localizacao
,
 gl.town as cidade
,
 gl.state as estado
,
 gnet.name AS tipo
,
 gu.name as lotado_para
,
 gstates.name as status
,
 gn.date_creation
,
 gn.date_mod
,
 gn.last_inventory_update
,
 glpi.glpi_plugin_tag_tags.name etiqueta
,
 gcost.value AS custo
,
 'NetworkEquipment' AS origem
FROM
 glpi.glpi_networkequipments gn
LEFT JOIN glpi.glpi_locations gl
ON
 gn.entities_id = gl.entities_id
 AND gn.locations_id = gl.id
LEFT JOIN glpi.glpi_users gu 
 ON
 gn.users_id = gu.id
LEFT JOIN glpi.glpi_networkequipmenttypes gnet
 ON
 gn.networkequipmenttypes_id = gnet.id
LEFT JOIN glpi.glpi_states gstates
ON
 gn.states_id = gstates.id
LEFT JOIN glpi.glpi_plugin_tag_tagitems
ON
 gn.id = glpi.glpi_plugin_tag_tagitems.items_id
 AND glpi.glpi_plugin_tag_tagitems.itemtype = 'NetworkEquipment'
LEFT JOIN glpi.glpi_plugin_tag_tags
ON
 glpi.glpi_plugin_tag_tags.id = glpi.glpi_plugin_tag_tagitems.plugin_tag_tags_id
LEFT JOIN glpi.glpi_infocoms gcost 
ON
 gn.id = gcost.items_id 
 AND gcost.itemtype = 'NetworkEquipment'
WHERE
 gn.is_deleted = 0
UNION ALL
SELECT
 gline.id
,
 gline.name AS ativo
,
 '' AS serial
,
 gline.comment
,
 gl.name AS localizacao
,
 gl.town as cidade
,
 gl.state as estado
,
 gctype.name as tipo 
,
 gu.name AS lotado_para
,
 gstates.name AS status
,
 gline.date_creation
,
 gline.date_mod
,
 '' AS last_inventory_update
,
 glpi.glpi_plugin_tag_tags.name etiqueta
,
 gcost.value AS custo
,
 'Line' AS origem
FROM
 glpi.glpi_lines gline
LEFT JOIN glpi.glpi_locations gl
ON
 gline.entities_id = gline.entities_id
 AND gline.locations_id = gl.id
 LEFT JOIN glpi.glpi_states gstates
ON
 gline.states_id = gstates.id
LEFT JOIN glpi.glpi_users gu 
 ON
 gline.users_id = gu.id
LEFT JOIN glpi.glpi_linetypes gctype
ON
 gline.linetypes_id = gctype.id
LEFT JOIN glpi.glpi_plugin_tag_tagitems
ON
 gline.id = glpi.glpi_plugin_tag_tagitems.items_id
 AND glpi.glpi_plugin_tag_tagitems.itemtype = 'Line'
LEFT JOIN glpi.glpi_plugin_tag_tags
ON
 glpi.glpi_plugin_tag_tags.id = glpi.glpi_plugin_tag_tagitems.plugin_tag_tags_id
LEFT JOIN glpi.glpi_infocoms gcost 
ON
 gline.id = gcost.items_id 
 AND gcost.itemtype = 'Line'
WHERE gline.is_deleted = 0`;

function buildInventarioSql(filters = {}) {
  const { clauses, values } = buildFilterClauses(filters);

  const origemMap = {
    computer: 'Computer',
    network: 'NetworkEquipment',
    line: 'Line',
  };

  appendCondition(clauses, values, 'inventory.origem = ?', origemMap[filters.tipoOrigem]);

  if (clauses.length === 0) {
    return {
      sql: BASE_INVENTARIO_SQL,
      values,
    };
  }

  return {
    sql: `
SELECT *
FROM (
${BASE_INVENTARIO_SQL}
) inventory
WHERE 1=1
${clauses.map((clause) => `  AND ${clause}`).join('\n')}`,
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

async function listInventario(filters = {}) {
  const pool = await poolProvider();
  const { sql, values } = buildInventarioSql(filters);

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
  buildInventarioSql,
  setPoolProvider,
  setQueryTimeoutMs,
  listInventario,
};

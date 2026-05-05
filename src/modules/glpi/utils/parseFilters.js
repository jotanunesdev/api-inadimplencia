const { AppError } = require('./AppError');

const CHAMADOS_STATUS = new Set([
  'Novo',
  'Atribuido',
  'Planejado',
  'BackLog',
  'Em Validacao',
  'Fechado',
]);

const CHAMADOS_TIPOS = new Set(['Incidente', 'Requisicao']);
const INVENTARIO_TIPOS_ORIGEM = new Set(['computer', 'network', 'line']);

function throwInvalidFilter(message, details) {
  throw new AppError(400, message, 'INVALID_FILTER', details);
}

function normalizeSingleValue(value) {
  if (Array.isArray(value)) {
    return normalizeSingleValue(value[0]);
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function parseDate(value, fieldName) {
  const normalized = normalizeSingleValue(value);

  if (!normalized) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throwInvalidFilter(`${fieldName} deve estar no formato YYYY-MM-DD.`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throwInvalidFilter(`${fieldName} invalido.`);
  }

  const isoDate = date.toISOString().slice(0, 10);
  if (isoDate !== normalized) {
    throwInvalidFilter(`${fieldName} invalido.`);
  }

  return normalized;
}

function assertDateRange(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) {
    return;
  }

  if (dataInicio > dataFim) {
    throwInvalidFilter('data_inicio nao pode ser maior que data_fim.');
  }
}

function parseEnumList(value, allowedValues, fieldName) {
  const normalized = normalizeSingleValue(value);

  if (!normalized) {
    return undefined;
  }

  const values = normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  const invalidValues = values.filter((item) => !allowedValues.has(item));
  if (invalidValues.length > 0) {
    throwInvalidFilter(`${fieldName} invalido.`, { invalidValues });
  }

  return values;
}

function assertNoWildcards(value, fieldName) {
  if (/[\%_]/.test(value)) {
    throwInvalidFilter(`${fieldName} nao pode conter os caracteres % ou _.`);
  }
}

function parseTipoOrigem(value) {
  const normalized = normalizeSingleValue(value).toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!INVENTARIO_TIPOS_ORIGEM.has(normalized)) {
    throwInvalidFilter('tipo_origem invalido.');
  }

  return normalized;
}

function parseGrupo(value) {
  const normalized = normalizeSingleValue(value);

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > 50) {
    throwInvalidFilter('grupo nao pode ultrapassar 50 caracteres.');
  }

  assertNoWildcards(normalized, 'grupo');

  return normalized;
}

function buildBaseFilters(query = {}) {
  const dataInicio = parseDate(query.data_inicio, 'data_inicio');
  const dataFim = parseDate(query.data_fim, 'data_fim');

  assertDateRange(dataInicio, dataFim);

  return {
    dataInicio,
    dataFim,
  };
}

function stripUndefined(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

function parseChamadosFilters(query = {}) {
  const base = buildBaseFilters(query);
  const status = parseEnumList(query.status, CHAMADOS_STATUS, 'status');
  const tipo = normalizeSingleValue(query.tipo);

  if (tipo && !CHAMADOS_TIPOS.has(tipo)) {
    throwInvalidFilter('tipo invalido.');
  }

  return stripUndefined({
    ...base,
    status,
    tipo: tipo || undefined,
  });
}

function parseInventarioFilters(query = {}) {
  const base = buildBaseFilters(query);
  const tipoOrigem = parseTipoOrigem(query.tipo_origem);

  return stripUndefined({
    ...base,
    tipoOrigem,
  });
}

function parseCustosFilters(query = {}) {
  const base = buildBaseFilters(query);
  const grupo = parseGrupo(query.grupo);

  return stripUndefined({
    ...base,
    grupo,
  });
}

module.exports = {
  parseChamadosFilters,
  parseInventarioFilters,
  parseCustosFilters,
  // helpers exportados para facilitar testes unitarios futuros
  parseDate,
  parseEnumList,
  assertNoWildcards,
  AppError,
};

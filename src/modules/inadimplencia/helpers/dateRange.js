const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function parseDateRange(query) {
  if (!query || typeof query !== 'object') {
    return { hasRange: false, dataInicio: null, dataFim: null };
  }

  const hasInicio = isPresent(query.dataInicio);
  const hasFim = isPresent(query.dataFim);

  if (!hasInicio && !hasFim) {
    return { hasRange: false, dataInicio: null, dataFim: null };
  }

  if (!hasInicio || !hasFim) {
    throw httpError(400, 'Informe dataInicio e dataFim em conjunto.');
  }

  const inicioStr = String(query.dataInicio).trim();
  const fimStr = String(query.dataFim).trim();

  if (!ISO_DATE_REGEX.test(inicioStr) || !ISO_DATE_REGEX.test(fimStr)) {
    throw httpError(400, 'Formato de data invalido. Use YYYY-MM-DD.');
  }

  const dataInicio = new Date(`${inicioStr}T00:00:00Z`);
  const dataFim = new Date(`${fimStr}T00:00:00Z`);

  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
    throw httpError(400, 'Data invalida.');
  }

  if (dataFim.getTime() < dataInicio.getTime()) {
    throw httpError(400, 'dataFim deve ser maior ou igual a dataInicio.');
  }

  return { hasRange: true, dataInicio, dataFim };
}

module.exports = {
  parseDateRange,
};

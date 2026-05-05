const { AppError } = require('../utils/AppError');
const { parseChamadosFilters } = require('../utils/parseFilters');
const { listChamados } = require('../models/chamadosModel');

let parseChamadosFiltersImpl = parseChamadosFilters;
let listChamadosImpl = listChamados;

function setChamadosDependencies(dependencies = {}) {
  if (typeof dependencies.parseChamadosFilters === 'function') {
    parseChamadosFiltersImpl = dependencies.parseChamadosFilters;
  }

  if (typeof dependencies.listChamados === 'function') {
    listChamadosImpl = dependencies.listChamados;
  }
}

function toErrorResponse(err) {
  if (err instanceof AppError || err?.statusCode) {
    return {
      statusCode: err.statusCode ?? 500,
      body: {
        error: err.message,
        code: err.code ?? 'APP_ERROR',
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }

  return null;
}

async function getChamados(req, res, next) {
  const startedAt = Date.now();

  try {
    const filters = parseChamadosFiltersImpl(req.query);
    const data = await listChamadosImpl(filters);

    console.log({
      module: 'glpi',
      endpoint: 'chamados',
      durationMs: Date.now() - startedAt,
      rowCount: data.length,
    });

    res.json({
      data,
      count: data.length,
      filters,
    });
  } catch (err) {
    const errorResponse = toErrorResponse(err);
    if (errorResponse) {
      res.status(errorResponse.statusCode).json(errorResponse.body);
      return;
    }

    next(err);
  }
}

module.exports = {
  getChamados,
  setChamadosDependencies,
};

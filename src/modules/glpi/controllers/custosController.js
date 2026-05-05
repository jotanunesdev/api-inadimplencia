const { AppError } = require('../utils/AppError');
const { parseCustosFilters } = require('../utils/parseFilters');
const { listCustos } = require('../models/custosModel');

let parseCustosFiltersImpl = parseCustosFilters;
let listCustosImpl = listCustos;

function setCustosDependencies(dependencies = {}) {
  if (typeof dependencies.parseCustosFilters === 'function') {
    parseCustosFiltersImpl = dependencies.parseCustosFilters;
  }

  if (typeof dependencies.listCustos === 'function') {
    listCustosImpl = dependencies.listCustos;
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

async function getCustos(req, res, next) {
  const startedAt = Date.now();

  try {
    const filters = parseCustosFiltersImpl(req.query);
    const data = await listCustosImpl(filters);

    console.log({
      module: 'glpi',
      endpoint: 'custos',
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
  getCustos,
  setCustosDependencies,
};

const { AppError } = require('../utils/AppError');
const { parseInventarioFilters } = require('../utils/parseFilters');
const { listInventario } = require('../models/inventarioModel');

let parseInventarioFiltersImpl = parseInventarioFilters;
let listInventarioImpl = listInventario;

function setInventarioDependencies(dependencies = {}) {
  if (typeof dependencies.parseInventarioFilters === 'function') {
    parseInventarioFiltersImpl = dependencies.parseInventarioFilters;
  }

  if (typeof dependencies.listInventario === 'function') {
    listInventarioImpl = dependencies.listInventario;
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

async function getInventario(req, res, next) {
  const startedAt = Date.now();

  try {
    const filters = parseInventarioFiltersImpl(req.query);
    const data = await listInventarioImpl(filters);

    console.log({
      module: 'glpi',
      endpoint: 'inventario',
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
  getInventario,
  setInventarioDependencies,
};

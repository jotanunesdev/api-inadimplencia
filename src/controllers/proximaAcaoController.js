const model = require('../models/proximaAcaoModel');

function parseNumVenda(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    return null;
  }
  return num;
}

async function getAll(req, res, next) {
  try {
    const data = await model.listAll();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNumVenda(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const data = await model.findByNumVenda(numVenda);
    if (!data) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    return res.status(400).json({
      error:
        'Registro de PROXIMA_ACAO deve ser feito via /ocorrencias. Endpoint somente leitura.',
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    return res.status(400).json({
      error:
        'Registro de PROXIMA_ACAO deve ser feito via /ocorrencias. Endpoint somente leitura.',
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    return res.status(400).json({
      error:
        'Registro de PROXIMA_ACAO deve ser feito via /ocorrencias. Endpoint somente leitura.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getByNumVenda,
  create,
  update,
  remove,
};

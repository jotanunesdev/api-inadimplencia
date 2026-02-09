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
    const numVenda = parseNumVenda(req.body.numVenda ?? req.body.NUM_VENDA);
    const proximaAcao = req.body.proximaAcao ?? req.body.PROXIMA_ACAO;

    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA e obrigatorio.' });
    }
    if (!proximaAcao || typeof proximaAcao !== 'string') {
      return res.status(400).json({ error: 'PROXIMA_ACAO e obrigatoria.' });
    }

    const data = await model.setByNumVenda(numVenda, proximaAcao.trim());
    if (!data) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    const proximaAcao = req.body.proximaAcao ?? req.body.PROXIMA_ACAO;

    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }
    if (!proximaAcao || typeof proximaAcao !== 'string') {
      return res.status(400).json({ error: 'PROXIMA_ACAO e obrigatoria.' });
    }

    const data = await model.setByNumVenda(numVenda, proximaAcao.trim());
    if (!data) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const data = await model.clearByNumVenda(numVenda);
    if (!data) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }

    res.json({ data });
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
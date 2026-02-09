const model = require('../models/responsavelModel');

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
    const data = await model.findAll();
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
      return res.status(404).json({ error: 'Responsavel nao encontrado.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.body.numVenda ?? req.body.NUM_VENDA_FK ?? req.body.NUM_VENDA);
    const nomeUsuario = req.body.nomeUsuario ?? req.body.NOME_USUARIO_FK ?? req.body.NOME;

    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }
    if (!nomeUsuario || typeof nomeUsuario !== 'string' || !nomeUsuario.trim()) {
      return res.status(400).json({ error: 'NOME_USUARIO_FK e obrigatorio.' });
    }

    const data = await model.upsert(numVenda, nomeUsuario.trim());
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    const nomeUsuario = req.body.nomeUsuario ?? req.body.NOME_USUARIO_FK ?? req.body.NOME;

    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }
    if (!nomeUsuario || typeof nomeUsuario !== 'string' || !nomeUsuario.trim()) {
      return res.status(400).json({ error: 'NOME_USUARIO_FK e obrigatorio.' });
    }

    const data = await model.upsert(numVenda, nomeUsuario.trim());
    if (!data) {
      return res.status(404).json({ error: 'Responsavel nao encontrado.' });
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

    const deleted = await model.remove(numVenda);
    if (!deleted) {
      return res.status(404).json({ error: 'Responsavel nao encontrado.' });
    }

    res.status(204).send();
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
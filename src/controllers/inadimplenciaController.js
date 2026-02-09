const model = require('../models/inadimplenciaModel');

async function getAll(req, res, next) {
  try {
    const data = await model.findAll();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByCpf(req, res, next) {
  try {
    const { cpf } = req.params;
    if (!cpf || typeof cpf !== 'string') {
      return res.status(400).json({ error: 'CPF e obrigatorio.' });
    }

    const data = await model.findByCpf(cpf.trim());
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNumVenda(req, res, next) {
  try {
    const { numVenda } = req.params;
    if (!numVenda || typeof numVenda !== 'string') {
      return res.status(400).json({ error: 'NUM_VENDA e obrigatorio.' });
    }

    const data = await model.findByNumVenda(numVenda.trim());
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getByCpf,
  getByNumVenda,
};

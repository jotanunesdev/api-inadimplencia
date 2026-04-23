const model = require('../models/fiadoresModel');

function parseNumVenda(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

function parseCpfDigits(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) {
    return null;
  }
  return digits;
}

async function getByNumVenda(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'numVenda invalido.' });
    }

    const data = await model.findByNumVenda(numVenda);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByCpf(req, res, next) {
  try {
    const cpfDigits = parseCpfDigits(req.params.cpf);
    if (!cpfDigits) {
      return res.status(400).json({ error: 'CPF invalido. Informe 11 ou 14 digitos.' });
    }

    const data = await model.findByCpf(cpfDigits);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getByNumVenda,
  getByCpf,
  // expostos para teste
  parseNumVenda,
  parseCpfDigits,
};

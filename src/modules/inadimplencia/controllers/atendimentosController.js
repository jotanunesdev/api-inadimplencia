const atendimentosModel = require('../models/atendimentosModel');
const inadimplenciaModel = require('../models/inadimplenciaModel');
const ocorrenciasModel = require('../models/ocorrenciasModel');
const responsavelModel = require('../models/responsavelModel');

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

async function create(req, res, next) {
  try {
    const numVendaRaw = req.body.numVenda ?? req.body.NUM_VENDA ?? req.body.NUM_VENDA_FK;
    const numVenda = parseNumVenda(numVendaRaw);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }

    const vendaRecords = await inadimplenciaModel.findByNumVenda(String(numVenda));
    if (!vendaRecords || vendaRecords.length === 0) {
      return res.status(404).json({ error: 'Venda nao encontrada.' });
    }

    const vendaSnapshot = vendaRecords[0];
    const responsavel = await responsavelModel.findByNumVenda(numVenda);
    const vendaSnapshotWithResponsavel = {
      ...vendaSnapshot,
      RESPONSAVEL: responsavel?.NOME_USUARIO_FK ?? null,
      NOME_USUARIO_FK: responsavel?.NOME_USUARIO_FK ?? null,
      COR_HEX: responsavel?.COR_HEX ?? null,
      RESPONSAVEL_COR_HEX: responsavel?.COR_HEX ?? null,
    };
    const atendimento = await atendimentosModel.createFromVenda(
      numVenda,
      vendaSnapshotWithResponsavel,
    );
    res.status(201).json({ data: atendimento });
  } catch (err) {
    next(err);
  }
}

async function getByProtocolo(req, res, next) {
  try {
    const { protocolo } = req.params;
    if (!protocolo || typeof protocolo !== 'string' || !protocolo.trim()) {
      return res.status(400).json({ error: 'PROTOCOLO invalido.' });
    }

    const atendimento = await atendimentosModel.findByProtocolo(protocolo.trim());
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    const ocorrencias = await ocorrenciasModel.findByProtocolo(protocolo.trim());
    res.json({
      data: {
        atendimento,
        venda: atendimento.VENDA_SNAPSHOT ?? null,
        ocorrencias,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getByCpf(req, res, next) {
  try {
    const { cpf } = req.params;
    if (!cpf || typeof cpf !== 'string' || !cpf.trim()) {
      return res.status(400).json({ error: 'CPF/CNPJ invalido.' });
    }

    const data = await atendimentosModel.findByCpf(cpf.trim());
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

    const data = await atendimentosModel.findByNumVenda(numVenda);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getByProtocolo,
  getByCpf,
  getByNumVenda,
};

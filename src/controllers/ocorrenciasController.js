const model = require('../models/ocorrenciasModel');

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function isGuid(value) {
  return typeof value === 'string' && GUID_REGEX.test(value);
}

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

function normalizeTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('T')) {
    const parts = trimmed.split('T');
    trimmed = parts[1] || '';
  }

  if (trimmed.includes(' ')) {
    trimmed = trimmed.split(' ')[0];
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '00');

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function getAll(req, res, next) {
  try {
    const data = await model.findAll();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isGuid(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const data = await model.findById(id);
    if (!data) {
      return res.status(404).json({ error: 'Ocorrencia nao encontrada.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByNumVenda(req, res, next) {
  try {
    const numVendaFk = parseNumVenda(req.params.numVenda);
    if (numVendaFk === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const data = await model.findByNumVenda(numVendaFk);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getByProtocolo(req, res, next) {
  try {
    const { protocolo } = req.params;
    if (!protocolo || typeof protocolo !== 'string') {
      return res.status(400).json({ error: 'PROTOCOLO invalido.' });
    }

    const trimmed = protocolo.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'PROTOCOLO invalido.' });
    }

    const data = await model.findByProtocolo(trimmed);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const numVendaRaw = req.body.numVenda ?? req.body.NUM_VENDA_FK;
    const nomeUsuario =
      req.body.nomeUsuario ??
      req.body.NOME_USUARIO_FK ??
      req.body.nome_usuario_fk ??
      null;
    const protocolo =
      req.body.protocolo ??
      req.body.PROTOCOLO ??
      req.body.protocolo_fk ??
      req.body.PROTOCOLO_FK ??
      null;
    const descricao = req.body.descricao ?? req.body.DESCRICAO ?? null;
    const statusOcorrencia =
      req.body.statusOcorrencia ??
      req.body.STATUS_OCORRENCIA ??
      req.body.status_ocorrencia ??
      req.body.status ??
      req.body.STATUS ??
      null;
    const dtOcorrencia =
      req.body.dtOcorrencia ??
      req.body.DT_OCORRENCIA ??
      req.body.dataOcorrencia ??
      req.body.DATA_OCORRENCIA;
    const horaOcorrencia =
      req.body.horaOcorrencia ??
      req.body.HORA_OCORRENCIA ??
      req.body.hora ??
      req.body.HORA;
    const proximaAcao = req.body.proximaAcao ?? req.body.PROXIMA_ACAO ?? null;

    const numVendaFk = parseNumVenda(numVendaRaw);
    if (numVendaFk === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }
    if (!nomeUsuario || typeof nomeUsuario !== 'string' || !nomeUsuario.trim()) {
      return res.status(400).json({ error: 'NOME_USUARIO_FK e obrigatorio.' });
    }
    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return res.status(400).json({ error: 'DESCRICAO e obrigatoria.' });
    }
    if (!statusOcorrencia || typeof statusOcorrencia !== 'string' || !statusOcorrencia.trim()) {
      return res.status(400).json({ error: 'STATUS_OCORRENCIA e obrigatorio.' });
    }
    if (!dtOcorrencia || typeof dtOcorrencia !== 'string') {
      return res.status(400).json({ error: 'DT_OCORRENCIA e obrigatoria.' });
    }
    if (!horaOcorrencia || typeof horaOcorrencia !== 'string') {
      return res.status(400).json({ error: 'HORA_OCORRENCIA e obrigatoria.' });
    }
    const normalizedHora = normalizeTime(horaOcorrencia);
    if (!normalizedHora) {
      return res.status(400).json({ error: 'HORA_OCORRENCIA invalida.' });
    }

    const data = await model.create({
      numVendaFk,
      nomeUsuario: nomeUsuario.trim(),
      protocolo: typeof protocolo === 'string' && protocolo.trim() ? protocolo.trim() : null,
      descricao: descricao.trim(),
      statusOcorrencia: statusOcorrencia.trim(),
      dtOcorrencia: dtOcorrencia.trim(),
      horaOcorrencia: normalizedHora,
      proximaAcao: typeof proximaAcao === 'string' ? proximaAcao.trim() : null,
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    if (!isGuid(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const numVendaRaw = req.body.numVenda ?? req.body.NUM_VENDA_FK;
    const nomeUsuario =
      req.body.nomeUsuario ??
      req.body.NOME_USUARIO_FK ??
      req.body.nome_usuario_fk ??
      null;
    const protocolo =
      req.body.protocolo ??
      req.body.PROTOCOLO ??
      req.body.protocolo_fk ??
      req.body.PROTOCOLO_FK ??
      null;
    const descricao = req.body.descricao ?? req.body.DESCRICAO ?? null;
    const statusOcorrencia =
      req.body.statusOcorrencia ??
      req.body.STATUS_OCORRENCIA ??
      req.body.status_ocorrencia ??
      req.body.status ??
      req.body.STATUS ??
      null;
    const dtOcorrencia =
      req.body.dtOcorrencia ??
      req.body.DT_OCORRENCIA ??
      req.body.dataOcorrencia ??
      req.body.DATA_OCORRENCIA;
    const horaOcorrencia =
      req.body.horaOcorrencia ??
      req.body.HORA_OCORRENCIA ??
      req.body.hora ??
      req.body.HORA;
    const proximaAcao = req.body.proximaAcao ?? req.body.PROXIMA_ACAO ?? null;

    const numVendaFk = parseNumVenda(numVendaRaw);
    if (numVendaFk === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }
    if (!nomeUsuario || typeof nomeUsuario !== 'string' || !nomeUsuario.trim()) {
      return res.status(400).json({ error: 'NOME_USUARIO_FK e obrigatorio.' });
    }
    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return res.status(400).json({ error: 'DESCRICAO e obrigatoria.' });
    }
    if (!statusOcorrencia || typeof statusOcorrencia !== 'string' || !statusOcorrencia.trim()) {
      return res.status(400).json({ error: 'STATUS_OCORRENCIA e obrigatorio.' });
    }
    if (!dtOcorrencia || typeof dtOcorrencia !== 'string') {
      return res.status(400).json({ error: 'DT_OCORRENCIA e obrigatoria.' });
    }
    if (!horaOcorrencia || typeof horaOcorrencia !== 'string') {
      return res.status(400).json({ error: 'HORA_OCORRENCIA e obrigatoria.' });
    }
    const normalizedHora = normalizeTime(horaOcorrencia);
    if (!normalizedHora) {
      return res.status(400).json({ error: 'HORA_OCORRENCIA invalida.' });
    }

    const data = await model.update(id, {
      numVendaFk,
      nomeUsuario: nomeUsuario.trim(),
      protocolo: typeof protocolo === 'string' && protocolo.trim() ? protocolo.trim() : null,
      descricao: descricao.trim(),
      statusOcorrencia: statusOcorrencia.trim(),
      dtOcorrencia: dtOcorrencia.trim(),
      horaOcorrencia: normalizedHora,
      proximaAcao: typeof proximaAcao === 'string' ? proximaAcao.trim() : null,
    });

    if (!data) {
      return res.status(404).json({ error: 'Ocorrencia nao encontrada.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    if (!isGuid(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const deleted = await model.remove(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Ocorrencia nao encontrada.' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  getByNumVenda,
  getByProtocolo,
  create,
  update,
  remove,
};

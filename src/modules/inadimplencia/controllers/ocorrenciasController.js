const { formToJSON } = require('axios');
const model = require('../models/ocorrenciasModel');
const { DateTime } = require('mssql');

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

function validateAndFormat(dateStr, timeStr) {
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;
  if (!/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(timeStr)) return null;


  return {
    date: cleanDate, 
    time: timeStr
  };
}

function formatarResposta(data) {
  if (!data) return null;
  
  const formatarItem = (item) => {
    const novoItem = { ...item };
    const d = item.DT_OCORRENCIA ?? item.DATA_OCORRENCIA;

    if (d instanceof Date) {
      const ano = d.getUTCFullYear();
      const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(d.getUTCDate()).padStart(2, '0'); 
      novoItem.DT_OCORRENCIA = `${ano}-${mes}-${dia}`;
    }

    if (item.HORA_OCORRENCIA instanceof Date) {
      const h = item.HORA_OCORRENCIA;
      const horas = String(h.getUTCHours()).padStart(2, '0');
      const minutos = String(h.getUTCMinutes()).padStart(2, '0');
      const segundos = String(h.getUTCSeconds()).padStart(2, '0');
      novoItem.HORA_OCORRENCIA = `${horas}:${minutos}:${segundos}`;
    }

    return novoItem;
  };
  return Array.isArray(data) ? data.map(formatarItem) : formatarItem(data);
}

async function getAll(req, res, next) {
  try {
    const data = await model.findAll();
    res.json({ data: formatarResposta(data) });
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
    const formatted = validateAndFormat(dtOcorrencia, horaOcorrencia);
    if (!formatted) {
      return res.status(400).json({ error: 'HORA_OCORRENCIA invalida.' });
    }

    const data = await model.create({
      numVendaFk,
      nomeUsuario: nomeUsuario.trim(),
      protocolo: typeof protocolo === 'string' && protocolo.trim() ? protocolo.trim() : null,
      descricao: descricao.trim(),
      statusOcorrencia: statusOcorrencia.trim(),
      dtOcorrencia: formatted.date,
      horaOcorrencia: formatted.time,
      proximaAcao: typeof proximaAcao === 'string' ? proximaAcao.trim() : null,
    });

    res.status(201).json({ data: formatarResposta(data) });
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
    const formatted = validateAndFormat(dtOcorrencia, horaOcorrencia);
    if (!formatted) {
      return res.status(400).json({ error: 'HORA_OCORRENCIA invalida.' });
    }

    const data = await model.update(id, {
      numVendaFk,
      nomeUsuario: nomeUsuario.trim(),
      protocolo: typeof protocolo === 'string' && protocolo.trim() ? protocolo.trim() : null,
      descricao: descricao.trim(),
      statusOcorrencia: statusOcorrencia.trim(),
      dtOcorrencia: formatted.date,
      horaOcorrencia: formatted.time,
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

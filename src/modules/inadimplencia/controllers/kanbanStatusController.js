const model = require('../models/kanbanStatusModel');
const atendimentosModel = require('../models/atendimentosModel');

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

function normalizeStatus(value) {
  if (!value) {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw === 'todo' || raw === 'a fazer' || raw === 'a_fazer' || raw === 'a-fazer') {
    return 'todo';
  }
  if (raw === 'inprogress' || raw === 'em andamento' || raw === 'em atendimento') {
    return 'inProgress';
  }
  if (raw === 'done' || raw === 'concluido' || raw === 'concluído') {
    return 'done';
  }
  return null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

async function getAll(req, res, next) {
  try {
    await expireAllTimedOut();
    const data = await model.findAll();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function upsert(req, res, next) {
  try {
    const numVenda = parseNumVenda(
      req.body.numVenda ?? req.body.NUM_VENDA_FK ?? req.body.NUM_VENDA
    );
    const proximaAcao = parseDateTime(
      req.body.proximaAcao ?? req.body.PROXIMA_ACAO ?? req.body.dataProximaAcao
    );
    const status = normalizeStatus(req.body.status ?? req.body.STATUS);
    const statusDate = parseDate(req.body.statusDate ?? req.body.STATUS_DATA ?? req.body.dataStatus);
    const nomeUsuario =
      req.body.nomeUsuario ?? req.body.NOME_USUARIO_FK ?? req.body.NOME_USUARIO;

    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA_FK e obrigatorio.' });
    }
    if (!proximaAcao) {
      return res.status(400).json({ error: 'PROXIMA_ACAO e obrigatorio.' });
    }
    if (!status) {
      return res.status(400).json({ error: 'STATUS invalido.' });
    }
    if (!statusDate) {
      return res.status(400).json({ error: 'STATUS_DATA e obrigatorio.' });
    }

    if (status === 'inProgress') {
      await expireTimedOutByNumVenda(numVenda);

      const active = await model.findActiveByNumVenda(numVenda);

      if (active) {
        const activeUser = String(active.NOME_USUARIO_FK ?? '').trim().toLowerCase();
        const currentUser = String(nomeUsuario ?? '').trim().toLowerCase();

        if (activeUser && currentUser && activeUser != currentUser){
          return res.status(409).json({
            error: `Atendimento ja está em andamento por ${active.NOME_USUARIO_FK}`
          });
        }

        return res.status(200).json({ data: active });
      }
    }

    const data = await model.upsert({
      numVenda,
      proximaAcao,
      status,
      statusDate,
      nomeUsuario: nomeUsuario ? String(nomeUsuario).trim() : null,
    });

    if (status === 'done' || status === 'todo') {
      const atendimentos = await atendimentosModel.findByNumVenda(numVenda);
      const latest = atendimentos[0] || null;

      if (latest?.PROTOCOLO) {
        await atendimentosModel.updateStatusProtocolo(latest.PROTOCOLO, false);
      }
    }


    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function expireTimedOutByNumVenda(numVenda) {
  const changed = await model.moveTimedOutToTodo(numVenda);
  if (!changed) return false;

  const atendimentos = await atendimentosModel.findByNumVenda(numVenda);
  const latest = atendimentos[0] || null;

  if (latest?.PROTOCOLO) {
    await atendimentosModel.updateStatusProtocolo(latest.PROTOCOLO, false);
  }

  return true;
}

async function expireAllTimedOut() {
  const rows = await model.findTimedOutInProgress();

  for (const row of rows) {[
    await expireTimedOutByNumVenda(row.NUM_VENDA_FK)
  ]}
}

module.exports = {
  getAll,
  upsert,
};

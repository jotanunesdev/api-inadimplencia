const model = require('../models/dashboardModel');

function parseLimit(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num <= 0) {
    return null;
  }
  return Math.min(num, 1000);
}

function parseNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return num;
}

function parseParcelas(value) {
  if (value === undefined || value === null) {
    return { isNull: true, qtd: null };
  }
  const raw = String(value).trim();
  if (!raw) {
    return { isNull: true, qtd: null };
  }
  const lowered = raw.toLowerCase();
  if (lowered.includes('nao') || lowered === 'null') {
    return { isNull: true, qtd: null };
  }
  const num = Number(raw);
  if (!Number.isInteger(num)) {
    return null;
  }
  return { isNull: false, qtd: num };
}

async function getKpis(req, res, next) {
  try {
    const data = await model.kpis();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getVendasPorResponsavel(req, res, next) {
  try {
    const data = await model.vendasPorResponsavel();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getInadimplenciaPorEmpreendimento(req, res, next) {
  try {
    const data = await model.inadimplenciaPorEmpreendimento();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getClientesPorEmpreendimento(req, res, next) {
  try {
    const data = await model.clientesPorEmpreendimento();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getStatusRepasse(req, res, next) {
  try {
    const data = await model.statusRepasse();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getBlocos(req, res, next) {
  try {
    const data = await model.blocos();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getUnidades(req, res, next) {
  try {
    const data = await model.unidades();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getUsuariosAtivos(req, res, next) {
  try {
    const data = await model.usuariosAtivos();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOcorrenciasPorUsuario(req, res, next) {
  try {
    const data = await model.ocorrenciasPorUsuario();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOcorrenciasPorVenda(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit);
    const data = await model.ocorrenciasPorVenda(limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOcorrenciasPorDia(req, res, next) {
  try {
    const data = await model.ocorrenciasPorDia();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOcorrenciasPorHora(req, res, next) {
  try {
    const data = await model.ocorrenciasPorHora();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getOcorrenciasPorDiaHora(req, res, next) {
  try {
    const data = await model.ocorrenciasPorDiaHora();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getProximasAcoesPorDia(req, res, next) {
  try {
    const data = await model.proximasAcoesPorDia();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAcoesDefinidas(req, res, next) {
  try {
    const data = await model.acoesDefinidas();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAging(req, res, next) {
  try {
    const data = await model.aging();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getParcelasInadimplentes(req, res, next) {
  try {
    const data = await model.parcelasInadimplentes();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getParcelasDetalhes(req, res, next) {
  try {
    const parsed = parseParcelas(req.query.qtd ?? req.query.parcelas);
    if (!parsed) {
      return res.status(400).json({ error: 'Quantidade de parcelas invalida.' });
    }

    const limit = parseLimit(req.query.limit) ?? 200;
    const data = await model.parcelasDetalhes(parsed.qtd, parsed.isNull, limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getScoreSaldo(req, res, next) {
  try {
    const data = await model.scoreSaldo();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getScoreSaldoDetalhes(req, res, next) {
  try {
    const score = parseNumber(req.query.score);
    if (score === null) {
      return res.status(400).json({ error: 'Score invalido.' });
    }

    const limit = parseLimit(req.query.limit) ?? 200;
    const data = await model.scoreSaldoDetalhes(score, limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getSaldoPorMesVencimento(req, res, next) {
  try {
    const data = await model.saldoPorMesVencimento();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getPerfilRiscoEmpreendimento(req, res, next) {
  try {
    const data = await model.perfilRiscoEmpreendimento();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAtendentesProximaAcao(req, res, next) {
  try {
    const data = await model.atendentesProximaAcao();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAgingDetalhes(req, res, next) {
  try {
    const faixa = String(req.query.faixa || '').trim();
    const allowed = ['0-30', '31-60', '61-90', '90+', 'Sem data'];

    if (!faixa || !allowed.includes(faixa)) {
      return res.status(400).json({ error: 'Faixa de aging invalida.' });
    }

    const limit = parseLimit(req.query.limit) ?? 200;
    const data = await model.agingDetalhes(faixa, limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getKpis,
  getVendasPorResponsavel,
  getInadimplenciaPorEmpreendimento,
  getClientesPorEmpreendimento,
  getStatusRepasse,
  getBlocos,
  getUnidades,
  getUsuariosAtivos,
  getOcorrenciasPorUsuario,
  getOcorrenciasPorVenda,
  getOcorrenciasPorDia,
  getOcorrenciasPorHora,
  getOcorrenciasPorDiaHora,
  getProximasAcoesPorDia,
  getAcoesDefinidas,
  getAging,
  getParcelasInadimplentes,
  getParcelasDetalhes,
  getScoreSaldo,
  getScoreSaldoDetalhes,
  getSaldoPorMesVencimento,
  getPerfilRiscoEmpreendimento,
  getAtendentesProximaAcao,
  getAgingDetalhes,
};

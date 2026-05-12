const service = require('../services/serasaPefinService');
const { maskDocument } = require('../services/serasaPefinPayloadBuilder');

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function isGuid(value) {
  return typeof value === 'string' && GUID_REGEX.test(value);
}

function isValidTransactionId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 64;
}

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

function parseArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeBlockedDocument(document) {
  if (!document || typeof document !== 'object') {
    return maskDocument(document);
  }

  const masked = { ...document };
  if (masked.documento) {
    masked.documento = maskDocument(masked.documento);
  }
  if (masked.document) {
    masked.document = maskDocument(masked.document);
  }
  if (masked.documentNumber) {
    masked.documentNumber = maskDocument(masked.documentNumber);
  }
  return masked;
}

function buildDomainErrorResponse(err) {
  const body = { error: err.message };

  if (err.code) {
    body.code = err.code;
  }

  if (Array.isArray(err.missingFields) && err.missingFields.length > 0) {
    body.missingFields = err.missingFields;
  }

  if (Array.isArray(err.blockedDocuments) && err.blockedDocuments.length > 0) {
    body.blockedDocuments = err.blockedDocuments.map(normalizeBlockedDocument);
  }

  return body;
}

function sendDomainError(res, err) {
  return res.status(err.statusCode).json(buildDomainErrorResponse(err));
}

async function getPreview(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const preview = await service.createPreview({ numVenda });
    res.json({ data: preview });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function postNegativacao(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const { operador, garantidoresSelecionados, overrides } = req.body || {};

    if (!operador || typeof operador !== 'string' || !operador.trim()) {
      return res.status(400).json({ error: 'OPERADOR e obrigatorio.' });
    }

    const selectedGuarantors = parseArray(garantidoresSelecionados);
    const parsedOverrides = typeof overrides === 'object' && overrides !== null ? overrides : {};

    const result = await service.requestNegativacao(
      {
        numVenda,
        operador: operador.trim(),
        garantidoresSelecionados: selectedGuarantors,
        overrides: parsedOverrides,
      },
      {}
    );

    res.status(201).json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function listNegativacoes(req, res, next) {
  try {
    const numVenda = parseNumVenda(req.params.numVenda);
    if (numVenda === null) {
      return res.status(400).json({ error: 'NUM_VENDA invalido.' });
    }

    const history = await service.listNegativacoesByVenda({ numVenda });
    res.json({ data: history });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function getNegativacaoById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isGuid(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const solicitation = await service.getNegativacaoById({ id });
    res.json({ data: solicitation });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function getAcompanhamentoByTransactionId(req, res, next) {
  try {
    const { transactionId } = req.params;
    if (!isValidTransactionId(transactionId)) {
      return res.status(400).json({ error: 'TRANSACTION_ID invalido.' });
    }

    const acompanhamento = await service.getAcompanhamentoByTransactionId({
      transactionId: transactionId.trim(),
    });
    res.json({ data: acompanhamento });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookInclusaoSucesso(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'inclusao/sucesso', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookInclusaoErro(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'inclusao/erro', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookAvalistaSucesso(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'avalista/sucesso', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookAvalistaErro(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'avalista/erro', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookBaixaSucesso(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'baixa/sucesso', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

async function handleWebhookBaixaErro(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    const result = await service.handleWebhook({ eventType: 'baixa/erro', payload });
    res.json({ data: result });
  } catch (err) {
    if (err.statusCode) {
      return sendDomainError(res, err);
    }
    next(err);
  }
}

module.exports = {
  getPreview,
  postNegativacao,
  listNegativacoes,
  getNegativacaoById,
  getAcompanhamentoByTransactionId,
  handleWebhookInclusaoSucesso,
  handleWebhookInclusaoErro,
  handleWebhookAvalistaSucesso,
  handleWebhookAvalistaErro,
  handleWebhookBaixaSucesso,
  handleWebhookBaixaErro,
};

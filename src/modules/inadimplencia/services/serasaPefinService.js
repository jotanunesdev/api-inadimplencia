const {
  findInadimplenciaByNumVenda,
  findGuarantorsByNumVenda,
  findActiveDuplicate,
  listHistoryByNumVenda,
  findById,
  findByTransactionId,
  createPendingSolicitations,
  markAsAwaitingReturn,
  markAsError,
  recordWebhookAndUpdateSolicitation,
} = require('../models/serasaPefinModel');
const {
  validatePreviewData,
  validateUatDocuments,
  validateValue,
  validateDateFormat,
  maskPayload,
  normalizeAddress,
  buildMainDebtPayload,
  buildGuarantorPayload,
  SERASA_CONSTANTS,
} = require('../services/serasaPefinPayloadBuilder');
const { env } = require('../config/env');
const {
  SERASA_PEFIN_STATUS,
  SERASA_PEFIN_TIPO_REGISTRO,
} = require('../constants/serasaPefin');
const { createSerasaPefinHttpClient } = require('./serasaPefinHttpClient');

const defaultModel = {
  findInadimplenciaByNumVenda,
  findGuarantorsByNumVenda,
  findActiveDuplicate,
  findByTransactionId,
  createPendingSolicitations,
  markAsAwaitingReturn,
  markAsError,
};

const FINAL_STATUSES = new Set([
  SERASA_PEFIN_STATUS.NEGATIVADO_SUCESSO,
  SERASA_PEFIN_STATUS.NEGATIVADO_ERRO,
  SERASA_PEFIN_STATUS.BAIXADO_SUCESSO,
  SERASA_PEFIN_STATUS.BAIXADO_ERRO,
]);

const defaultPayloadBuilder = {
  buildMainDebtPayload,
  buildGuarantorPayload,
  maskPayload,
};

function buildDomainError(message, statusCode, code, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function digitsOnly(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function extractInitialSerasaResponse(response) {
  const transactionId = normalizeString(response?.transactionId);

  if (!transactionId) {
    throw buildDomainError(
      'SERASA_PEFIN_RESPONSE_WITHOUT_TRANSACTION_ID',
      502,
      'SERASA_PEFIN_RESPONSE_WITHOUT_TRANSACTION_ID'
    );
  }

  return {
    transactionId,
    cadusKey: normalizeString(response?.cadusKey ?? response?.CADUS_KEY) || null,
    cadusSerie: normalizeString(response?.cadusSerie ?? response?.CADUS_SERIE) || null,
  };
}

function getGuarantorContext(guarantorParams, index) {
  const idAssociado = normalizeString(guarantorParams?.idAssociado) || `index-${index}`;

  return {
    index,
    idAssociado,
    tipoAssociacao: normalizeString(guarantorParams?.tipoAssociacao) || null,
  };
}

function prefixGuarantorField(field, context) {
  return `garantidores[${context.idAssociado}].${field}`;
}

function buildGuarantorValidationError(err, guarantorParams, index) {
  const context = getGuarantorContext(guarantorParams, index);
  const error = buildDomainError(
    err.message || 'ERRO_VALIDACAO_PAYLOAD_GARANTIDOR',
    err.statusCode || 400,
    err.code || 'SERASA_PEFIN_VALIDATION_ERROR',
    {
      participant: {
        tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR,
        ...context,
      },
    }
  );

  if (Array.isArray(err.missingFields) && err.missingFields.length > 0) {
    error.missingFields = err.missingFields.map((field) => prefixGuarantorField(field, context));
  }

  if (Array.isArray(err.blockedDocuments) && err.blockedDocuments.length > 0) {
    error.blockedDocuments = err.blockedDocuments.map((documento) => ({
      tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR,
      idAssociado: context.idAssociado,
      tipoAssociacao: context.tipoAssociacao,
      documento,
    }));
  }

  return error;
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return text.length >= 10 ? text.slice(0, 10) : text || null;
}

function maskDocument(document) {
  if (!document) {
    return '';
  }
  const normalized = digitsOnly(document);
  if (normalized.length <= 3) {
    return '***';
  }
  if (normalized.length <= 11) {
    return `${normalized.slice(0, 3)}.***.${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 2)}.***.${normalized.slice(-2)}`;
}

function formatSolicitationForHistory(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.ID,
    numVenda: row.NUM_VENDA_FK,
    tipoRegistro: row.TIPO_REGISTRO,
    idSolicitacaoPrincipal: row.ID_SOLICITACAO_PRINCIPAL,
    idAssociado: row.ID_ASSOCIADO,
    tipoAssociacao: row.TIPO_ASSOCIACAO,
    documentoDevedor: maskDocument(row.DOCUMENTO_DEVEDOR),
    documentoGarantidor: row.DOCUMENTO_GARANTIDOR ? maskDocument(row.DOCUMENTO_GARANTIDOR) : null,
    documentoCredor: maskDocument(row.DOCUMENTO_CREDOR),
    contractNumber: row.CONTRACT_NUMBER,
    categoryId: row.CATEGORY_ID,
    areaInformante: row.AREA_INFORMANTE,
    valor: row.VALOR,
    dataVencimento: normalizeDate(row.DATA_VENCIMENTO),
    status: row.STATUS,
    transactionId: row.TRANSACTION_ID,
    cadusKey: row.CADUS_KEY,
    cadusSerie: row.CADUS_SERIE,
    errorMessage: row.ERROR_MESSAGE,
    errorStatusCode: row.ERROR_STATUS_CODE,
    operador: row.OPERADOR,
    dtCriacao: row.DT_CRIACAO ? row.DT_CRIACAO.toISOString() : null,
    dtAtualizacao: row.DT_ATUALIZACAO ? row.DT_ATUALIZACAO.toISOString() : null,
  };
}

function formatSolicitationForDetail(row) {
  if (!row) {
    return null;
  }

  const history = formatSolicitationForHistory(row);
  
  let payloadAuditoria = null;
  let webhookPayload = null;

  try {
    if (row.PAYLOAD_AUDITORIA) {
      const parsed = typeof row.PAYLOAD_AUDITORIA === 'string' 
        ? JSON.parse(row.PAYLOAD_AUDITORIA) 
        : row.PAYLOAD_AUDITORIA;
      payloadAuditoria = maskPayload(parsed, { maskDocuments: true, maskFinancial: false });
    }
  } catch (err) {
    // If parsing fails, leave as null
  }

  try {
    if (row.WEBHOOK_PAYLOAD) {
      const parsed = typeof row.WEBHOOK_PAYLOAD === 'string' 
        ? JSON.parse(row.WEBHOOK_PAYLOAD) 
        : row.WEBHOOK_PAYLOAD;
      webhookPayload = maskPayload(parsed, { maskDocuments: true, maskFinancial: false });
    }
  } catch (err) {
    // If parsing fails, leave as null
  }

  return {
    ...history,
    payloadAuditoria,
    webhookPayload,
  };
}

function formatGuarantorForPreview(guarantor, validation) {
  if (!guarantor) {
    return null;
  }

  const address = validation?.addressNormalized || normalizeAddress(guarantor.address || guarantor.ENDERECO);
  
  return {
    idAssociado: guarantor.ID_ASSOCIADO,
    nome: normalizeString(guarantor.NOME),
    documento: maskDocument(guarantor.DOCUMENTO_GARANTIDOR || guarantor.DOCUMENTO),
    tipoAssociacao: normalizeString(guarantor.TIPO_ASSOCIACAO),
    endereco: address,
    elegivel: validation?.valid ?? false,
    missingFields: validation?.missingFields || [],
  };
}

function formatBlockedDocumentsForPreview(blockedDocuments) {
  return (blockedDocuments || []).map(maskDocument).filter(Boolean);
}

async function createPreview({ numVenda }, dependencies = {}) {
  const {
    model = defaultModel,
  } = dependencies;

  const venda = await model.findInadimplenciaByNumVenda(numVenda);

  if (!venda) {
    throw buildDomainError(
      'VENDA_NAO_ENCONTRADA_OU_NAO_INADIMPLENTE',
      404,
      'SERASA_PEFIN_VENDA_NOT_FOUND'
    );
  }

  const garantidores = await model.findGuarantorsByNumVenda(numVenda);

  // Prepare data for validation
  const inadimplenciaWithAddress = {
    ...venda,
    address: venda.address || venda.ENDERECO || null,
  };

  const garantidoresWithAddress = garantidores.map((g) => ({
    ...g,
    DOCUMENTO_GARANTIDOR: g.DOCUMENTO_GARANTIDOR || g.DOCUMENTO,
    address: g.address || g.ENDERECO || null,
  }));

  // Validate preview data
  const validation = validatePreviewData({
    inadimplencia: inadimplenciaWithAddress,
    garantidores: garantidoresWithAddress,
  });

  // Check for blocking conditions
  const blocks = [];

  // Check UAT document restriction
  const documentsToCheck = [venda.DOCUMENTO_DEVEDOR, env.SERASA_CREDITOR_DOCUMENT];
  const uatValidation = validateUatDocuments(documentsToCheck);
  if (!uatValidation.valid) {
    blocks.push({
      type: 'UAT_DOCUMENT_NOT_ALLOWED',
      message: 'Documento não autorizado para ambiente UAT',
      details: {
        blockedDocuments: formatBlockedDocumentsForPreview(uatValidation.blockedDocuments),
      },
    });
  }

  // Check value minimum
  if (!validateValue(venda.VALOR)) {
    blocks.push({
      type: 'VALUE_BELOW_MINIMUM',
      message: `Valor deve ser maior ou igual a R$ ${SERASA_CONSTANTS.MIN_VALUE.toFixed(2)}`,
      details: {
        valor: venda.VALOR,
        minValue: SERASA_CONSTANTS.MIN_VALUE,
      },
    });
  }

  // Check due date format
  if (!validateDateFormat(venda.DATA_VENCIMENTO)) {
    blocks.push({
      type: 'INVALID_DUE_DATE',
      message: 'Data de vencimento inválida',
      details: {
        dataVencimento: venda.DATA_VENCIMENTO,
      },
    });
  }

  // Check for active duplicate
  try {
    const duplicate = await model.findActiveDuplicate({
      numVenda: venda.NUM_VENDA,
      contractNumber: venda.CONTRACT_NUMBER,
      documentoDevedor: venda.DOCUMENTO_DEVEDOR,
      tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.PRINCIPAL,
    });

    if (duplicate) {
      blocks.push({
        type: 'ACTIVE_DUPLICATE',
        message: 'Já existe negativação ativa para esta venda',
        details: {
          existingId: duplicate.ID,
          existingStatus: duplicate.STATUS,
          transactionId: duplicate.TRANSACTION_ID,
        },
      });
    }
  } catch (err) {
    // If duplicate check fails, log but don't block preview
    // This allows the preview to still show data even if DB has issues
  }

  const guarantoresPreview = (validation.guarantorValidations || []).map((guarantorValidation) => {
    const guarantor = guarantorValidation.guarantor;
    const guarantorUatValidation = validateUatDocuments(guarantor?.DOCUMENTO_GARANTIDOR);
    const blockedDocuments = formatBlockedDocumentsForPreview(guarantorUatValidation.blockedDocuments);
    const preview = formatGuarantorForPreview(guarantor, {
      valid: guarantorValidation.valid && blockedDocuments.length === 0,
      addressNormalized: guarantorValidation.addressNormalized,
      missingFields: guarantorValidation.missingFields,
    });

    if (!preview) {
      return null;
    }

    if (blockedDocuments.length > 0) {
      preview.blockedDocuments = blockedDocuments;
    }

    return preview;
  }).filter(Boolean);

  // Build preview response
  const preview = {
    numVenda: venda.NUM_VENDA,
    cliente: normalizeString(venda.CLIENTE),
    empreendimento: normalizeString(venda.EMPREENDIMENTO),
    bloco: normalizeString(venda.BLOCO),
    unidade: normalizeString(venda.UNIDADE),
    documentoDevedor: maskDocument(venda.DOCUMENTO_DEVEDOR),
    documentoCredor: maskDocument(env.SERASA_CREDITOR_DOCUMENT),
    contractNumber: venda.CONTRACT_NUMBER,
    categoryId: SERASA_CONSTANTS.CATEGORY_ID,
    areaInformante: env.SERASA_AREA_INFORMANTE,
    valor: venda.VALOR,
    dataVencimento: normalizeDate(venda.DATA_VENCIMENTO),
    endereco: validation.addressNormalized || normalizeAddress(venda.address || venda.ENDERECO),
    garantidores: guarantoresPreview,
    missingFields: validation.principalMissingFields || validation.missingFields,
    blocks: blocks.length > 0 ? blocks : null,
    elegivel: validation.principalValid && blocks.length === 0,
  };

  return preview;
}

async function listNegativacoesByVenda({ numVenda }) {
  const history = await listHistoryByNumVenda(numVenda);
  return history.map(formatSolicitationForHistory);
}

async function getNegativacaoById({ id }) {
  const solicitation = await findById(id);

  if (!solicitation) {
    throw buildDomainError(
      'SOLICITACAO_NAO_ENCONTRADA',
      404,
      'SERASA_PEFIN_SOLICITACAO_NOT_FOUND'
    );
  }

  return formatSolicitationForDetail(solicitation);
}

async function getAcompanhamentoByTransactionId({ transactionId }, dependencies = {}) {
  const {
    model = defaultModel,
  } = dependencies;

  const solicitation = await model.findByTransactionId(transactionId);

  if (!solicitation) {
    throw buildDomainError(
      'SOLICITACAO_NAO_ENCONTRADA_PARA_TRANSACTION_ID',
      404,
      'SERASA_PEFIN_TRANSACTION_NOT_FOUND'
    );
  }

  const detail = formatSolicitationForDetail(solicitation);
  const finalizado = FINAL_STATUSES.has(detail.status);
  const aguardandoWebhook = detail.status === SERASA_PEFIN_STATUS.AGUARDANDO_RETORNO;

  return {
    ...detail,
    finalizado,
    aguardandoWebhook,
    mensagemAcompanhamento: finalizado
      ? 'Processamento finalizado pelo webhook da Serasa.'
      : 'Aguardando webhook da Serasa para concluir o processamento.',
  };
}

async function requestNegativacao({ numVenda, operador, garantidoresSelecionados = [], overrides = {} }, dependencies = {}) {
  const {
    httpClientFactory = createSerasaPefinHttpClient,
    model = defaultModel,
    payloadBuilder = defaultPayloadBuilder,
  } = dependencies;

  // Validate venda and get data
  const venda = await model.findInadimplenciaByNumVenda(numVenda);

  if (!venda) {
    throw buildDomainError(
      'VENDA_NAO_ENCONTRADA_OU_NAO_INADIMPLENTE',
      404,
      'SERASA_PEFIN_VENDA_NOT_FOUND'
    );
  }

  // Get all available guarantors
  const allGuarantors = await model.findGuarantorsByNumVenda(numVenda);

  // Filter selected guarantors
  const selectedGuarantors = allGuarantors.filter((g) =>
    garantidoresSelecionados.includes(g.ID_ASSOCIADO)
  );

  // Prepare data for principal
  const inadimplenciaWithAddress = {
    ...venda,
    address: venda.address || venda.ENDERECO || null,
  };

  const principalParams = {
    numVenda: venda.NUM_VENDA,
    tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.PRINCIPAL,
    documentoDevedor: venda.DOCUMENTO_DEVEDOR,
    documentoCredor: env.SERASA_CREDITOR_DOCUMENT,
    contractNumber: venda.CONTRACT_NUMBER,
    categoryId: overrides.categoryId || SERASA_CONSTANTS.CATEGORY_ID,
    areaInformante: overrides.areaInformante || env.SERASA_AREA_INFORMANTE,
    valor: venda.VALOR,
    value: venda.VALOR,
    dataVencimento: venda.DATA_VENCIMENTO,
    dueDate: venda.DATA_VENCIMENTO,
    operador,
    debtor: {
      documentNumber: venda.DOCUMENTO_DEVEDOR,
      name: venda.CLIENTE,
      address: inadimplenciaWithAddress.address,
    },
    creditor: {
      documentNumber: env.SERASA_CREDITOR_DOCUMENT,
    },
  };

  // Prepare guarantors params
  const guarantorsParams = selectedGuarantors.map((g) => ({
    numVenda: venda.NUM_VENDA,
    tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR,
    idAssociado: g.ID_ASSOCIADO,
    tipoAssociacao: g.TIPO_ASSOCIACAO,
    documentoGarantidor: g.DOCUMENTO_GARANTIDOR,
    documentoDevedor: venda.DOCUMENTO_DEVEDOR,
    documentoCredor: env.SERASA_CREDITOR_DOCUMENT,
    contractNumber: venda.CONTRACT_NUMBER,
    categoryId: overrides.categoryId || SERASA_CONSTANTS.CATEGORY_ID,
    areaInformante: overrides.areaInformante || env.SERASA_AREA_INFORMANTE,
    valor: venda.VALOR,
    value: venda.VALOR,
    dataVencimento: venda.DATA_VENCIMENTO,
    dueDate: venda.DATA_VENCIMENTO,
    operador,
    debtorDocument: venda.DOCUMENTO_DEVEDOR,
    guarantor: {
      documentNumber: g.DOCUMENTO_GARANTIDOR,
      name: g.NOME,
      address: g.address || g.ENDERECO || null,
    },
    creditor: {
      documentNumber: env.SERASA_CREDITOR_DOCUMENT,
    },
  }));

  // Build payload for principal (this will validate UAT documents and address)
  let principalPayload;
  try {
    principalPayload = payloadBuilder.buildMainDebtPayload(principalParams);
  } catch (err) {
    if (err.code === 'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED' || err.code === 'SERASA_PEFIN_MISSING_REQUIRED_FIELDS') {
      throw err;
    }
    throw buildDomainError(
      'ERRO_VALIDACAO_PAYLOAD_PRINCIPAL',
      400,
      'SERASA_PEFIN_VALIDATION_ERROR',
      { originalError: err.message }
    );
  }

  const guarantorPayloads = [];
  for (let i = 0; i < guarantorsParams.length; i++) {
    try {
      guarantorPayloads.push(payloadBuilder.buildGuarantorPayload(guarantorsParams[i]));
    } catch (err) {
      if (
        err.code === 'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED' ||
        err.code === 'SERASA_PEFIN_MISSING_REQUIRED_FIELDS'
      ) {
        throw buildGuarantorValidationError(err, guarantorsParams[i], i);
      }

      throw buildDomainError(
        'ERRO_VALIDACAO_PAYLOAD_GARANTIDOR',
        400,
        'SERASA_PEFIN_VALIDATION_ERROR',
        {
          participant: {
            tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR,
            ...getGuarantorContext(guarantorsParams[i], i),
          },
          originalError: err.message,
        }
      );
    }
  }

  // Persist local solicitations before calling Serasa
  let persistedSolicitations;
  try {
    persistedSolicitations = await model.createPendingSolicitations({
      principal: {
        numVenda: principalParams.numVenda,
        tipoRegistro: principalParams.tipoRegistro,
        documentoDevedor: principalParams.documentoDevedor,
        documentoCredor: principalParams.documentoCredor,
        contractNumber: principalParams.contractNumber,
        categoryId: principalParams.categoryId,
        areaInformante: principalParams.areaInformante,
        valor: principalParams.valor,
        dataVencimento: principalParams.dataVencimento,
        operador: principalParams.operador,
        payloadAuditoria: payloadBuilder.maskPayload(principalPayload, { maskDocuments: true, maskFinancial: false }),
      },
      guarantors: guarantorsParams.map((g, index) => ({
        numVenda: g.numVenda,
        tipoRegistro: g.tipoRegistro,
        idAssociado: g.idAssociado,
        tipoAssociacao: g.tipoAssociacao,
        documentoGarantidor: g.documentoGarantidor,
        documentoDevedor: g.documentoDevedor,
        documentoCredor: g.documentoCredor,
        contractNumber: g.contractNumber,
        categoryId: g.categoryId,
        areaInformante: g.areaInformante,
        valor: g.valor,
        dataVencimento: g.dataVencimento,
        operador: g.operador,
        payloadAuditoria: payloadBuilder.maskPayload(guarantorPayloads[index], { maskDocuments: true, maskFinancial: false }),
      })),
    });
  } catch (err) {
    if (err.code === 'SERASA_PEFIN_DUPLICATE_ACTIVE') {
      throw err;
    }
    throw buildDomainError(
      'ERRO_PERSISTENCIA_SOLICITACOES',
      500,
      'SERASA_PEFIN_PERSISTENCE_ERROR',
      { originalError: err.message }
    );
  }

  const httpClient = httpClientFactory();

  // Send principal debt
  let principalResponse;
  try {
    principalResponse = await httpClient.postDebt(principalPayload);
  } catch (err) {
    // Mark principal as error
    await model.markAsError({
      id: persistedSolicitations.principal.ID,
      errorMessage: err.message,
      errorStatusCode: err.statusCode || 500,
      payloadAuditoria: payloadBuilder.maskPayload(principalPayload, { maskDocuments: true, maskFinancial: false }),
    });

    throw buildDomainError(
      'ERRO_ENVIO_PRINCIPAL_SERASA',
      err.statusCode || 503,
      err.code || 'SERASA_PEFIN_HTTP_ERROR',
      { originalError: err.message }
    );
  }

  let principalAcceptedResponse;
  try {
    principalAcceptedResponse = extractInitialSerasaResponse(principalResponse);
  } catch (err) {
    await model.markAsError({
      id: persistedSolicitations.principal.ID,
      errorMessage: err.message,
      errorStatusCode: err.statusCode || 502,
      payloadAuditoria: payloadBuilder.maskPayload(principalPayload, { maskDocuments: true, maskFinancial: false }),
    });
    throw err;
  }

  // Update principal with transactionId and status
  const updatedPrincipal = await model.markAsAwaitingReturn({
    id: persistedSolicitations.principal.ID,
    transactionId: principalAcceptedResponse.transactionId,
    cadusKey: principalAcceptedResponse.cadusKey,
    cadusSerie: principalAcceptedResponse.cadusSerie,
    payloadAuditoria: payloadBuilder.maskPayload(principalPayload, { maskDocuments: true, maskFinancial: false }),
  });

  // Send guarantors sequentially
  const updatedGuarantors = [];

  for (let i = 0; i < persistedSolicitations.guarantors.length; i++) {
    const guarantor = persistedSolicitations.guarantors[i];
    const guarantorPayload = guarantorPayloads[i];

    try {
      const guarantorResponse = await httpClient.postGuarantor(guarantorPayload);
      const guarantorAcceptedResponse = extractInitialSerasaResponse(guarantorResponse);
      const updatedGuarantor = await model.markAsAwaitingReturn({
        id: guarantor.ID,
        transactionId: guarantorAcceptedResponse.transactionId,
        cadusKey: guarantorAcceptedResponse.cadusKey,
        cadusSerie: guarantorAcceptedResponse.cadusSerie,
        payloadAuditoria: payloadBuilder.maskPayload(guarantorPayload, { maskDocuments: true, maskFinancial: false }),
      });
      updatedGuarantors.push(updatedGuarantor || { ...guarantor, STATUS: SERASA_PEFIN_STATUS.AGUARDANDO_RETORNO });
    } catch (err) {
      // Mark this guarantor as error but don't fail the entire operation
      const erroredGuarantor = await model.markAsError({
        id: guarantor.ID,
        errorMessage: err.message,
        errorStatusCode: err.statusCode || 500,
        payloadAuditoria: payloadBuilder.maskPayload(guarantorPayload, { maskDocuments: true, maskFinancial: false }),
      });
      updatedGuarantors.push(erroredGuarantor || { ...guarantor, STATUS: SERASA_PEFIN_STATUS.NEGATIVADO_ERRO });
    }
  }

  // Return result
  return {
    principal: formatSolicitationForHistory(updatedPrincipal),
    garantidores: updatedGuarantors.map(formatSolicitationForHistory),
    mensagem: 'Solicitação enviada para Serasa. Aguardando retorno assíncrono.',
  };
}

async function handleWebhook({ eventType, payload }, dependencies = {}) {
  const {
    model = { recordWebhookAndUpdateSolicitation },
  } = dependencies;

  // Validate payload has uuid
  if (!payload || !payload.uuid) {
    throw buildDomainError(
      'PAYLOAD_SEM_UUID',
      400,
      'SERASA_PEFIN_PAYLOAD_MISSING_UUID'
    );
  }

  // Extract uuid as transactionId
  const transactionId = payload.uuid;

  // Map eventType to status
  const status = mapEventTypeToStatus(eventType);

  // Extract error details if present
  const errorMessage = payload.error?.message || null;
  const errorStatusCode = payload.error?.statusCode || null;

  // Call model to record webhook and update solicitation
  const result = await model.recordWebhookAndUpdateSolicitation({
    eventType,
    transactionId,
    status,
    payload,
    errorMessage,
    errorStatusCode,
  });

  return result;
}

function mapEventTypeToStatus(eventType) {
  if (!eventType) {
    throw buildDomainError(
      'EVENT_TYPE_INVALIDO',
      400,
      'SERASA_PEFIN_INVALID_EVENT_TYPE'
    );
  }

  const eventTypeLower = String(eventType).toLowerCase();
  const isBaixaEvent =
    eventTypeLower.includes('baixa') || eventTypeLower.includes('exclus');

  if (isBaixaEvent && eventTypeLower.includes('sucesso')) {
    return SERASA_PEFIN_STATUS.BAIXADO_SUCESSO;
  }

  if (isBaixaEvent && eventTypeLower.includes('erro')) {
    return SERASA_PEFIN_STATUS.BAIXADO_ERRO;
  }

  // Success events
  if (eventTypeLower.includes('sucesso')) {
    return SERASA_PEFIN_STATUS.NEGATIVADO_SUCESSO;
  }

  // Error events
  if (eventTypeLower.includes('erro')) {
    return SERASA_PEFIN_STATUS.NEGATIVADO_ERRO;
  }

  throw buildDomainError(
    'EVENT_TYPE_NAO_MAPEADO',
    400,
    'SERASA_PEFIN_UNMAPPED_EVENT_TYPE'
  );
}

module.exports = {
  createPreview,
  getAcompanhamentoByTransactionId,
  getNegativacaoById,
  listNegativacoesByVenda,
  requestNegativacao,
  handleWebhook,
  formatSolicitationForHistory,
  formatSolicitationForDetail,
  formatGuarantorForPreview,
};

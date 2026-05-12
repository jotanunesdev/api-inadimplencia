const { getPool, sql } = require('../config/db');
const {
  SERASA_PEFIN_STATUS,
  SERASA_PEFIN_TIPO_REGISTRO,
} = require('../constants/serasaPefin');

const TABLE_INADIMPLENCIA = 'DW.fat_analise_inadimplencia_v4';
const VIEW_GUARANTORS = 'DW.vw_fiadores_por_venda';
const TABLE_SOLICITATIONS = 'dbo.SERASA_PEFIN_SOLICITACOES';
const TABLE_WEBHOOKS = 'dbo.SERASA_PEFIN_WEBHOOKS';

const ACTIVE_STATUSES = [
  SERASA_PEFIN_STATUS.PENDENTE_ENVIO,
  SERASA_PEFIN_STATUS.ENVIADO_SERASA,
  SERASA_PEFIN_STATUS.AGUARDANDO_RETORNO,
];

const ACTIVE_STATUS_SQL = ACTIVE_STATUSES.map((status) => `'${status}'`).join(', ');

const SOLICITATION_COLUMNS = `
  ID,
  NUM_VENDA_FK,
  TIPO_REGISTRO,
  ID_SOLICITACAO_PRINCIPAL,
  ID_ASSOCIADO,
  TIPO_ASSOCIACAO,
  DOCUMENTO_DEVEDOR,
  DOCUMENTO_GARANTIDOR,
  DOCUMENTO_CREDOR,
  CONTRACT_NUMBER,
  CATEGORY_ID,
  AREA_INFORMANTE,
  VALOR,
  DATA_VENCIMENTO,
  STATUS,
  TRANSACTION_ID,
  CADUS_KEY,
  CADUS_SERIE,
  PAYLOAD_AUDITORIA,
  WEBHOOK_PAYLOAD,
  ERROR_MESSAGE,
  ERROR_STATUS_CODE,
  OPERADOR,
  DT_CRIACAO,
  DT_ATUALIZACAO
`;

const INSERTED_SOLICITATION_COLUMNS = SOLICITATION_COLUMNS
  .split(',')
  .map((column) => `INSERTED.${column.trim()}`)
  .join(',\n        ');

const WEBHOOK_COLUMNS = `
  ID,
  EVENT_TYPE,
  TRANSACTION_ID,
  PAYLOAD,
  MATCHED_SOLICITACAO_ID,
  PROCESSADO,
  MENSAGEM_ERRO,
  DT_RECEBIMENTO
`;

const INSERTED_WEBHOOK_COLUMNS = WEBHOOK_COLUMNS
  .split(',')
  .map((column) => `INSERTED.${column.trim()}`)
  .join(',\n        ');

function buildInadimplenteCondition(alias = 'f') {
  return `UPPER(LTRIM(RTRIM(COALESCE(${alias}.INADIMPLENTE, '')))) = 'SIM'`;
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

function nullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
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

function buildAddressLine(logradouro, endereco, numero) {
  const street = normalizeString(logradouro);
  const fallbackAddress = normalizeString(endereco);
  const number = normalizeString(numero);

  if (street && number) {
    return `${street}, ${number}`;
  }

  return street || fallbackAddress;
}

function normalizeDebtorAddress(row) {
  const address = {
    zipCode: normalizeString(row.CEP ?? row.cep ?? row.DEVEDOR_CEP),
    addressLine: buildAddressLine(
      row.LOGRADOURO ?? row.logradouro ?? row.DEVEDOR_LOGRADOURO,
      row.ENDERECO ?? row.endereco ?? row.DEVEDOR_ENDERECO,
      row.NUMERO ?? row.numero ?? row.DEVEDOR_NUMERO
    ),
    complement: normalizeString(row.COMPLEMENTO ?? row.complemento ?? row.DEVEDOR_COMPLEMENTO),
    district: normalizeString(row.BAIRRO ?? row.bairro ?? row.DEVEDOR_BAIRRO),
    city: normalizeString(
      row.CIDADE ?? row.MUNICIPIO ?? row.cidade ?? row.municipio ?? row.DEVEDOR_CIDADE
    ),
    state: normalizeString(
      row.UF ?? row.ESTADO ?? row.estado ?? row.uf ?? row.DEVEDOR_UF ?? row.DEVEDOR_ESTADO
    ),
    number: normalizeString(row.NUMERO ?? row.numero ?? row.DEVEDOR_NUMERO),
  };

  const hasAnyField = Object.values(address).some(Boolean);
  return hasAnyField ? address : null;
}

function jsonStringify(value, fallback = '{}') {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch (err) {
      return JSON.stringify({ value });
    }
  }

  try {
    return JSON.stringify(value);
  } catch (err) {
    return fallback;
  }
}

function buildDomainError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function ensureSafeInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw buildDomainError(`${fieldName}_INVALIDO`, 400, 'SERASA_PEFIN_INVALID_INPUT');
  }

  return parsed;
}

function normalizeInadimplenciaRow(row) {
  if (!row) {
    return null;
  }

  const numVenda = normalizeNumber(row.NUM_VENDA);
  const valor =
    normalizeNumber(row.VALOR_INADIMPLENTE) ??
    normalizeNumber(row.VALOR_TOTAL_EM_ABERTO) ??
    normalizeNumber(row.VALOR_TOTAL);

  return {
    ...row,
    NUM_VENDA: numVenda,
    DOCUMENTO_DEVEDOR: digitsOnly(row.CPF_CNPJ ?? row.DOCUMENTO_DEVEDOR),
    CONTRACT_NUMBER: numVenda === null ? '' : String(numVenda),
    VALOR: valor,
    DATA_VENCIMENTO: normalizeDate(row.DATA_VENCIMENTO ?? row.VENCIMENTO_MAIS_ANTIGO),
    address: normalizeDebtorAddress(row),
  };
}

function normalizeGuarantorRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    NUM_VENDA: normalizeNumber(row.NUM_VENDA),
    DOCUMENTO_GARANTIDOR: digitsOnly(row.DOCUMENTO ?? row.DOCUMENTO_GARANTIDOR),
    TIPO_ASSOCIACAO: normalizeString(row.TIPO_ASSOCIACAO).toUpperCase(),
  };
}

function normalizeSolicitationInput(input, defaults = {}) {
  const tipoRegistro = normalizeString(input.tipoRegistro ?? input.TIPO_REGISTRO ?? defaults.tipoRegistro);
  const numVenda = ensureSafeInteger(
    input.numVenda ?? input.NUM_VENDA_FK ?? defaults.numVenda,
    'NUM_VENDA'
  );
  const documentoDevedor = digitsOnly(
    input.documentoDevedor ?? input.DOCUMENTO_DEVEDOR ?? defaults.documentoDevedor
  );
  const documentoGarantidor = digitsOnly(
    input.documentoGarantidor ?? input.DOCUMENTO_GARANTIDOR ?? input.DOCUMENTO ?? defaults.documentoGarantidor
  );
  const valor = normalizeNumber(input.valor ?? input.VALOR ?? defaults.valor);

  const normalized = {
    numVenda,
    tipoRegistro,
    idSolicitacaoPrincipal: nullableString(
      input.idSolicitacaoPrincipal ??
      input.ID_SOLICITACAO_PRINCIPAL ??
      defaults.idSolicitacaoPrincipal
    ),
    idAssociado: nullableString(input.idAssociado ?? input.ID_ASSOCIADO ?? defaults.idAssociado),
    tipoAssociacao: nullableString(
      input.tipoAssociacao ?? input.TIPO_ASSOCIACAO ?? defaults.tipoAssociacao
    ),
    documentoDevedor,
    documentoGarantidor: documentoGarantidor || null,
    documentoCredor: digitsOnly(
      input.documentoCredor ?? input.DOCUMENTO_CREDOR ?? defaults.documentoCredor
    ),
    contractNumber: normalizeString(
      input.contractNumber ?? input.CONTRACT_NUMBER ?? defaults.contractNumber
    ),
    categoryId: normalizeString(input.categoryId ?? input.CATEGORY_ID ?? defaults.categoryId),
    areaInformante: normalizeString(
      input.areaInformante ?? input.AREA_INFORMANTE ?? defaults.areaInformante
    ),
    valor,
    dataVencimento: normalizeDate(
      input.dataVencimento ?? input.DATA_VENCIMENTO ?? defaults.dataVencimento
    ),
    status: normalizeString(input.status ?? input.STATUS ?? defaults.status),
    operador: normalizeString(input.operador ?? input.OPERADOR ?? defaults.operador),
    payloadAuditoria: input.payloadAuditoria ?? input.PAYLOAD_AUDITORIA ?? defaults.payloadAuditoria ?? {},
  };

  validateSolicitationInput(normalized);
  return normalized;
}

function validateSolicitationInput(input) {
  const missingFields = [];

  [
    ['tipoRegistro', input.tipoRegistro],
    ['documentoDevedor', input.documentoDevedor],
    ['documentoCredor', input.documentoCredor],
    ['contractNumber', input.contractNumber],
    ['categoryId', input.categoryId],
    ['areaInformante', input.areaInformante],
    ['dataVencimento', input.dataVencimento],
    ['status', input.status],
    ['operador', input.operador],
  ].forEach(([field, value]) => {
    if (!value) {
      missingFields.push(field);
    }
  });

  if (input.valor === null) {
    missingFields.push('valor');
  }

  if (
    input.tipoRegistro === SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR &&
    !input.documentoGarantidor
  ) {
    missingFields.push('documentoGarantidor');
  }

  if (
    input.tipoRegistro === SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR &&
    !input.idSolicitacaoPrincipal
  ) {
    missingFields.push('idSolicitacaoPrincipal');
  }

  if (missingFields.length > 0) {
    const error = buildDomainError(
      'SERASA_PEFIN_SOLICITACAO_INVALIDA',
      400,
      'SERASA_PEFIN_INVALID_SOLICITATION'
    );
    error.missingFields = missingFields;
    throw error;
  }
}

function buildDuplicateError(existing) {
  const error = buildDomainError(
    'SERASA_PEFIN_DUPLICATE_ACTIVE',
    409,
    'SERASA_PEFIN_DUPLICATE_ACTIVE'
  );
  error.existing = existing;
  return error;
}

async function createRequest(transaction) {
  if (transaction) {
    return new sql.Request(transaction);
  }

  const pool = await getPool();
  return pool.request();
}

async function findInadimplenciaByNumVenda(numVendaInput) {
  const numVenda = ensureSafeInteger(numVendaInput, 'NUM_VENDA');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(`
      SELECT TOP 1
        f.*,
        NULLIF(LTRIM(RTRIM(f.INADIMPLENTE)), '') AS INADIMPLENTE,
        CONVERT(varchar(10), f.VENCIMENTO_MAIS_ANTIGO, 23) AS DATA_VENCIMENTO,
        CAST(f.VALOR_TOTAL_EM_ABERTO AS float) AS VALOR_TOTAL,
        CAST(f.VALOR_INADIMPLENTE AS float) AS VALOR_SOMENTE_INADIMPLENTE
      FROM ${TABLE_INADIMPLENCIA} f
      WHERE f.NUM_VENDA = @numVenda
        AND ${buildInadimplenteCondition('f')}
    `);

  return normalizeInadimplenciaRow(result.recordset[0] || null);
}

async function findGuarantorsByNumVenda(numVendaInput) {
  const numVenda = ensureSafeInteger(numVendaInput, 'NUM_VENDA');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(`
      SELECT
        NUM_VENDA,
        ID_ASSOCIADO,
        ID_RESERVA,
        ID_PESSOA,
        NOME,
        DOCUMENTO,
        DATA_CADASTRO,
        RENDA_FAMILIAR,
        TIPO_ASSOCIACAO,
        ENDERECO
      FROM ${VIEW_GUARANTORS}
      WHERE NUM_VENDA = @numVenda
        AND UPPER(LTRIM(RTRIM(COALESCE(TIPO_ASSOCIACAO, '')))) COLLATE Latin1_General_CI_AI
          IN ('FIADOR', 'CONJUGE', 'CESSIONARIO', 'COOBRIGADO', 'CO-OBRIGADO', 'CO OBRIGADO')
      ORDER BY DATA_CADASTRO DESC, NOME ASC
    `);

  return result.recordset.map(normalizeGuarantorRow);
}

async function findActiveDuplicate(params, options = {}) {
  const normalizedParams = {
    numVenda: ensureSafeInteger(params.numVenda ?? params.NUM_VENDA_FK, 'NUM_VENDA'),
    contractNumber: normalizeString(params.contractNumber ?? params.CONTRACT_NUMBER),
    documentoDevedor: digitsOnly(params.documentoDevedor ?? params.DOCUMENTO_DEVEDOR),
    documentoGarantidor:
      digitsOnly(params.documentoGarantidor ?? params.DOCUMENTO_GARANTIDOR) || null,
    tipoRegistro: normalizeString(params.tipoRegistro ?? params.TIPO_REGISTRO),
  };
  const request = await createRequest(options.transaction);
  return findActiveDuplicateWithRequest(request, normalizedParams, { lock: Boolean(options.lock) });
}

async function findActiveDuplicateWithRequest(request, params, options = {}) {
  const lockHint = options.lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
  const result = await request
    .input('numVenda', sql.Int, params.numVenda)
    .input('contractNumber', sql.VarChar(20), params.contractNumber)
    .input('documentoDevedor', sql.VarChar(20), params.documentoDevedor)
    .input('documentoGarantidor', sql.VarChar(20), params.documentoGarantidor || null)
    .input('tipoRegistro', sql.VarChar(20), params.tipoRegistro)
    .query(`
      SELECT TOP 1
        ${SOLICITATION_COLUMNS}
      FROM ${TABLE_SOLICITATIONS} ${lockHint}
      WHERE NUM_VENDA_FK = @numVenda
        AND CONTRACT_NUMBER = @contractNumber
        AND DOCUMENTO_DEVEDOR = @documentoDevedor
        AND TIPO_REGISTRO = @tipoRegistro
        AND (
          (@documentoGarantidor IS NULL AND DOCUMENTO_GARANTIDOR IS NULL)
          OR DOCUMENTO_GARANTIDOR = @documentoGarantidor
        )
        AND STATUS IN (${ACTIVE_STATUS_SQL})
      ORDER BY DT_CRIACAO DESC
    `);

  return result.recordset[0] || null;
}

async function insertSolicitation(transaction, params) {
  const request = new sql.Request(transaction);
  const result = await request
    .input('numVenda', sql.Int, params.numVenda)
    .input('tipoRegistro', sql.VarChar(20), params.tipoRegistro)
    .input('idSolicitacaoPrincipal', sql.UniqueIdentifier, params.idSolicitacaoPrincipal)
    .input('idAssociado', sql.VarChar(64), params.idAssociado)
    .input('tipoAssociacao', sql.VarChar(64), params.tipoAssociacao)
    .input('documentoDevedor', sql.VarChar(20), params.documentoDevedor)
    .input('documentoGarantidor', sql.VarChar(20), params.documentoGarantidor)
    .input('documentoCredor', sql.VarChar(20), params.documentoCredor)
    .input('contractNumber', sql.VarChar(20), params.contractNumber)
    .input('categoryId', sql.VarChar(2), params.categoryId)
    .input('areaInformante', sql.VarChar(4), params.areaInformante)
    .input('valor', sql.Decimal(15, 2), params.valor)
    .input('dataVencimento', sql.Date, params.dataVencimento)
    .input('status', sql.VarChar(32), params.status)
    .input('payloadAuditoria', sql.NVarChar(sql.MAX), jsonStringify(params.payloadAuditoria))
    .input('operador', sql.VarChar(255), params.operador)
    .query(`
      INSERT INTO ${TABLE_SOLICITATIONS} (
        NUM_VENDA_FK,
        TIPO_REGISTRO,
        ID_SOLICITACAO_PRINCIPAL,
        ID_ASSOCIADO,
        TIPO_ASSOCIACAO,
        DOCUMENTO_DEVEDOR,
        DOCUMENTO_GARANTIDOR,
        DOCUMENTO_CREDOR,
        CONTRACT_NUMBER,
        CATEGORY_ID,
        AREA_INFORMANTE,
        VALOR,
        DATA_VENCIMENTO,
        STATUS,
        PAYLOAD_AUDITORIA,
        OPERADOR
      )
      OUTPUT
        ${INSERTED_SOLICITATION_COLUMNS}
      VALUES (
        @numVenda,
        @tipoRegistro,
        @idSolicitacaoPrincipal,
        @idAssociado,
        @tipoAssociacao,
        @documentoDevedor,
        @documentoGarantidor,
        @documentoCredor,
        @contractNumber,
        @categoryId,
        @areaInformante,
        @valor,
        @dataVencimento,
        @status,
        @payloadAuditoria,
        @operador
      )
    `);

  return result.recordset[0] || null;
}

async function createPendingSolicitations({ principal, guarantors = [] }) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const principalParams = normalizeSolicitationInput(principal, {
      tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.PRINCIPAL,
      status: SERASA_PEFIN_STATUS.PENDENTE_ENVIO,
    });
    const principalDuplicate = await findActiveDuplicate(principalParams, {
      transaction,
      lock: true,
    });

    if (principalDuplicate) {
      throw buildDuplicateError(principalDuplicate);
    }

    const principalRow = await insertSolicitation(transaction, principalParams);
    const guarantorRows = [];

    for (const guarantor of guarantors) {
      const guarantorParams = normalizeSolicitationInput(guarantor, {
        ...principalParams,
        tipoRegistro: SERASA_PEFIN_TIPO_REGISTRO.GARANTIDOR,
        idSolicitacaoPrincipal: principalRow.ID,
        status: SERASA_PEFIN_STATUS.PENDENTE_ENVIO,
      });
      const guarantorDuplicate = await findActiveDuplicate(guarantorParams, {
        transaction,
        lock: true,
      });

      if (guarantorDuplicate) {
        throw buildDuplicateError(guarantorDuplicate);
      }

      guarantorRows.push(await insertSolicitation(transaction, guarantorParams));
    }

    await transaction.commit();
    return {
      principal: principalRow,
      guarantors: guarantorRows,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function updateSendStatusById({ id, status, transactionId, cadusKey, cadusSerie, payloadAuditoria }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('status', sql.VarChar(32), status)
    .input('transactionId', sql.VarChar(64), nullableString(transactionId))
    .input('cadusKey', sql.VarChar(64), nullableString(cadusKey))
    .input('cadusSerie', sql.VarChar(64), nullableString(cadusSerie))
    .input('payloadAuditoria', sql.NVarChar(sql.MAX), jsonStringify(payloadAuditoria))
    .query(`
      UPDATE ${TABLE_SOLICITATIONS}
      SET STATUS = @status,
          TRANSACTION_ID = @transactionId,
          CADUS_KEY = @cadusKey,
          CADUS_SERIE = @cadusSerie,
          PAYLOAD_AUDITORIA = @payloadAuditoria,
          ERROR_MESSAGE = NULL,
          ERROR_STATUS_CODE = NULL,
          DT_ATUALIZACAO = SYSUTCDATETIME()
      OUTPUT
        ${INSERTED_SOLICITATION_COLUMNS}
      WHERE ID = @id
    `);

  return result.recordset[0] || null;
}

function markAsSentToSerasa({ id, payloadAuditoria }) {
  return updateSendStatusById({
    id,
    status: SERASA_PEFIN_STATUS.ENVIADO_SERASA,
    payloadAuditoria,
  });
}

function markAsAwaitingReturn({ id, transactionId, cadusKey, cadusSerie, payloadAuditoria }) {
  return updateSendStatusById({
    id,
    status: SERASA_PEFIN_STATUS.AGUARDANDO_RETORNO,
    transactionId,
    cadusKey,
    cadusSerie,
    payloadAuditoria,
  });
}

async function markAsError({ id, errorMessage, errorStatusCode, payloadAuditoria }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('status', sql.VarChar(32), SERASA_PEFIN_STATUS.NEGATIVADO_ERRO)
    .input('errorMessage', sql.NVarChar(1000), nullableString(errorMessage))
    .input('errorStatusCode', sql.Int, errorStatusCode ?? null)
    .input('payloadAuditoria', sql.NVarChar(sql.MAX), jsonStringify(payloadAuditoria))
    .query(`
      UPDATE ${TABLE_SOLICITATIONS}
      SET STATUS = @status,
          ERROR_MESSAGE = @errorMessage,
          ERROR_STATUS_CODE = @errorStatusCode,
          PAYLOAD_AUDITORIA = @payloadAuditoria,
          DT_ATUALIZACAO = SYSUTCDATETIME()
      OUTPUT
        ${INSERTED_SOLICITATION_COLUMNS}
      WHERE ID = @id
    `);

  return result.recordset[0] || null;
}

async function updateWebhookResultByTransactionId(params, options = {}) {
  const request = await createRequest(options.transaction);
  const result = await request
    .input('transactionId', sql.VarChar(64), params.transactionId)
    .input('status', sql.VarChar(32), params.status)
    .input('webhookPayload', sql.NVarChar(sql.MAX), jsonStringify(params.webhookPayload))
    .input('errorMessage', sql.NVarChar(1000), nullableString(params.errorMessage))
    .input('errorStatusCode', sql.Int, params.errorStatusCode ?? null)
    .query(`
      UPDATE ${TABLE_SOLICITATIONS}
      SET STATUS = @status,
          WEBHOOK_PAYLOAD = @webhookPayload,
          ERROR_MESSAGE = @errorMessage,
          ERROR_STATUS_CODE = @errorStatusCode,
          DT_ATUALIZACAO = SYSUTCDATETIME()
      OUTPUT
        ${INSERTED_SOLICITATION_COLUMNS}
      WHERE TRANSACTION_ID = @transactionId
    `);

  return result.recordset[0] || null;
}

async function findByTransactionIdForUpdate(transaction, transactionId) {
  const request = new sql.Request(transaction);
  const result = await request
    .input('transactionId', sql.VarChar(64), transactionId)
    .query(`
      SELECT TOP 1
        ${SOLICITATION_COLUMNS}
      FROM ${TABLE_SOLICITATIONS} WITH (UPDLOCK, HOLDLOCK)
      WHERE TRANSACTION_ID = @transactionId
      ORDER BY DT_ATUALIZACAO DESC
    `);

  return result.recordset[0] || null;
}

async function registerWebhook(
  {
    eventType,
    transactionId,
    payload,
    matchedSolicitacaoId = null,
    processado = false,
    mensagemErro = null,
  },
  options = {}
) {
  const request = await createRequest(options.transaction);
  const result = await request
    .input('eventType', sql.VarChar(64), eventType)
    .input('transactionId', sql.VarChar(64), nullableString(transactionId))
    .input('payload', sql.NVarChar(sql.MAX), jsonStringify(payload))
    .input('matchedSolicitacaoId', sql.UniqueIdentifier, matchedSolicitacaoId)
    .input('processado', sql.Bit, Boolean(processado))
    .input('mensagemErro', sql.NVarChar(1000), nullableString(mensagemErro))
    .query(`
      INSERT INTO ${TABLE_WEBHOOKS} (
        EVENT_TYPE,
        TRANSACTION_ID,
        PAYLOAD,
        MATCHED_SOLICITACAO_ID,
        PROCESSADO,
        MENSAGEM_ERRO
      )
      OUTPUT
        ${INSERTED_WEBHOOK_COLUMNS}
      VALUES (
        @eventType,
        @transactionId,
        @payload,
        @matchedSolicitacaoId,
        @processado,
        @mensagemErro
      )
    `);

  return result.recordset[0] || null;
}

async function recordWebhookAndUpdateSolicitation({
  eventType,
  transactionId,
  status,
  payload,
  errorMessage = null,
  errorStatusCode = null,
}) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const solicitation = transactionId
      ? await findByTransactionIdForUpdate(transaction, transactionId)
      : null;

    if (!solicitation) {
      const webhook = await registerWebhook(
        {
          eventType,
          transactionId,
          payload,
          matchedSolicitacaoId: null,
          processado: false,
          mensagemErro: 'SOLICITACAO_NAO_ENCONTRADA',
        },
        { transaction }
      );

      await transaction.commit();
      return {
        matched: false,
        solicitation: null,
        webhook,
      };
    }

    const updatedSolicitation = await updateWebhookResultByTransactionId(
      {
        transactionId,
        status,
        webhookPayload: payload,
        errorMessage,
        errorStatusCode,
      },
      { transaction }
    );
    const webhook = await registerWebhook(
      {
        eventType,
        transactionId,
        payload,
        matchedSolicitacaoId: solicitation.ID,
        processado: true,
        mensagemErro: null,
      },
      { transaction }
    );

    await transaction.commit();
    return {
      matched: true,
      solicitation: updatedSolicitation,
      webhook,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function listHistoryByNumVenda(numVendaInput) {
  const numVenda = ensureSafeInteger(numVendaInput, 'NUM_VENDA');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(`
      SELECT
        ${SOLICITATION_COLUMNS}
      FROM ${TABLE_SOLICITATIONS}
      WHERE NUM_VENDA_FK = @numVenda
      ORDER BY DT_CRIACAO DESC, TIPO_REGISTRO ASC
    `);

  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      SELECT TOP 1
        ${SOLICITATION_COLUMNS}
      FROM ${TABLE_SOLICITATIONS}
      WHERE ID = @id
    `);

  return result.recordset[0] || null;
}

async function findByTransactionId(transactionIdInput) {
  const transactionId = normalizeString(transactionIdInput);

  if (!transactionId) {
    throw buildDomainError(
      'TRANSACTION_ID_INVALIDO',
      400,
      'SERASA_PEFIN_INVALID_INPUT'
    );
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('transactionId', sql.VarChar(64), transactionId)
    .query(`
      SELECT TOP 1
        ${SOLICITATION_COLUMNS}
      FROM ${TABLE_SOLICITATIONS}
      WHERE TRANSACTION_ID = @transactionId
      ORDER BY DT_ATUALIZACAO DESC
    `);

  return result.recordset[0] || null;
}

module.exports = {
  createPendingSolicitations,
  findActiveDuplicate,
  findById,
  findByTransactionId,
  findGuarantorsByNumVenda,
  findInadimplenciaByNumVenda,
  listHistoryByNumVenda,
  markAsAwaitingReturn,
  markAsError,
  markAsSentToSerasa,
  recordWebhookAndUpdateSolicitation,
  registerWebhook,
  updateWebhookResultByTransactionId,
};

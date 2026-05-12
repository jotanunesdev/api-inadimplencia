let restoreDb = () => {};

function createDbMock(queryResponses = []) {
  const requests = [];
  const transactions = [];
  const responseQueue = [...queryResponses];

  const sql = {
    Bit: 'Bit',
    Date: 'Date',
    Decimal: jest.fn((precision, scale) => ({ type: 'Decimal', precision, scale })),
    Int: 'Int',
    ISOLATION_LEVEL: { SERIALIZABLE: 'SERIALIZABLE' },
    MAX: 'MAX',
    NVarChar: jest.fn((length) => ({ type: 'NVarChar', length })),
    UniqueIdentifier: 'UniqueIdentifier',
    VarChar: jest.fn((length) => ({ type: 'VarChar', length })),
  };

  function createRequest(context) {
    const request = {
      context,
      inputs: [],
      queryText: '',
      input: jest.fn((name, type, value) => {
        request.inputs.push({ name, type, value });
        return request;
      }),
      query: jest.fn(async (text) => {
        request.queryText = text;
        requests.push(request);
        const response = responseQueue.length > 0
          ? responseQueue.shift()
          : { recordset: [], rowsAffected: [0] };
        return typeof response === 'function'
          ? response({ request, requests, text })
          : response;
      }),
    };

    return request;
  }

  const Transaction = jest.fn(function Transaction(pool) {
    this.pool = pool;
    this.begin = jest.fn(async () => undefined);
    this.commit = jest.fn(async () => undefined);
    this.rollback = jest.fn(async () => undefined);
    transactions.push(this);
  });

  const Request = jest.fn(function Request(context) {
    return createRequest(context);
  });

  sql.Transaction = Transaction;
  sql.Request = Request;

  const pool = {
    request: jest.fn(() => createRequest(pool)),
  };
  const getPool = jest.fn(async () => pool);

  return { getPool, pool, requests, responseQueue, sql, transactions };
}

function inputValue(request, name) {
  return request.inputs.find((input) => input.name === name)?.value;
}

async function loadModel(queryResponses = []) {
  const dbMock = createDbMock(queryResponses);
  jest.resetModules();
  jest.doMock('../config/db', () => ({
    getPool: dbMock.getPool,
    sql: dbMock.sql,
  }));

  restoreDb = () => {
    jest.dontMock('../config/db');
    jest.resetModules();
  };

  const model = require('./serasaPefinModel.js');
  return { model, dbMock };
}

const principalInput = {
  numVenda: 12345,
  documentoDevedor: '11122233344',
  documentoCredor: '12345678000190',
  contractNumber: '12345',
  categoryId: 'FI',
  areaInformante: '0001',
  valor: 2500.75,
  dataVencimento: '2026-05-10',
  operador: 'operador.teste',
  payloadAuditoria: { tipo: 'principal' },
};

const guarantorInput = {
  idAssociado: 'A-1',
  tipoAssociacao: 'FIADOR',
  documentoGarantidor: '55566677788',
  payloadAuditoria: { tipo: 'garantidor' },
};

describe('serasaPefinModel', () => {
  afterEach(() => {
    restoreDb();
    restoreDb = () => {};
    jest.clearAllMocks();
  });

  it('consulta venda inadimplente por NUM_VENDA com filtro global e retorno normalizado', async () => {
    const { model, dbMock } = await loadModel([
      {
        recordset: [
          {
            NUM_VENDA: 12345,
            CLIENTE: 'Cliente Teste',
            CPF_CNPJ: '111.222.333-44',
            INADIMPLENTE: 'SIM',
            VALOR_INADIMPLENTE: '2500.75',
            VALOR_TOTAL_EM_ABERTO: '3000.00',
            VENCIMENTO_MAIS_ANTIGO: new Date('2026-05-10T00:00:00.000Z'),
            CEP: '01310-100',
            LOGRADOURO: 'Av. Paulista',
            NUMERO: '1000',
            COMPLEMENTO: 'Conj. 101',
            BAIRRO: 'Bela Vista',
            CIDADE: 'Sao Paulo',
            UF: 'SP',
          },
        ],
      },
    ]);

    const result = await model.findInadimplenciaByNumVenda(12345);

    const [request] = dbMock.requests;
    expect(inputValue(request, 'numVenda')).toBe(12345);
    expect(request.queryText).toContain('DW.fat_analise_inadimplencia_v4');
    expect(request.queryText).not.toContain('DW.dim_pessoa_cv');
    expect(request.queryText).toContain('f.*');
    expect(request.queryText).toContain("UPPER(LTRIM(RTRIM(COALESCE(f.INADIMPLENTE, '')))) = 'SIM'");
    expect(result).toMatchObject({
      NUM_VENDA: 12345,
      CLIENTE: 'Cliente Teste',
      DOCUMENTO_DEVEDOR: '11122233344',
      CONTRACT_NUMBER: '12345',
      VALOR: 2500.75,
      DATA_VENCIMENTO: '2026-05-10',
      address: {
        zipCode: '01310-100',
        addressLine: 'Av. Paulista, 1000',
        complement: 'Conj. 101',
        district: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        number: '1000',
      },
    });
  });

  it('consulta garantidores elegiveis por venda filtrando tipos permitidos', async () => {
    const { model, dbMock } = await loadModel([
      {
        recordset: [
          {
            NUM_VENDA: 12345,
            ID_ASSOCIADO: 'A-1',
            NOME: 'Fiador Teste',
            DOCUMENTO: '555.666.777-88',
            TIPO_ASSOCIACAO: 'FIADOR',
          },
        ],
      },
    ]);

    const result = await model.findGuarantorsByNumVenda(12345);

    const [request] = dbMock.requests;
    expect(inputValue(request, 'numVenda')).toBe(12345);
    expect(request.queryText).toContain('DW.vw_fiadores_por_venda');
    expect(request.queryText).toContain("'FIADOR'");
    expect(request.queryText).toContain("'CONJUGE'");
    expect(request.queryText).toContain("'CESSIONARIO'");
    expect(request.queryText).toContain("'COOBRIGADO'");
    expect(result).toEqual([
      expect.objectContaining({
        ID_ASSOCIADO: 'A-1',
        DOCUMENTO_GARANTIDOR: '55566677788',
        TIPO_ASSOCIACAO: 'FIADOR',
      }),
    ]);
  });

  it('cria solicitacao principal e garantidores em transacao serializable com dedupe bloqueante', async () => {
    const { model, dbMock } = await loadModel([
      { recordset: [] },
      { recordset: [{ ID: 'principal-id', TIPO_REGISTRO: 'PRINCIPAL' }] },
      { recordset: [] },
      {
        recordset: [
          {
            ID: 'guarantor-id',
            ID_SOLICITACAO_PRINCIPAL: 'principal-id',
            TIPO_REGISTRO: 'GARANTIDOR',
          },
        ],
      },
    ]);

    const result = await model.createPendingSolicitations({
      principal: principalInput,
      guarantors: [guarantorInput],
    });

    const [transaction] = dbMock.transactions;
    expect(transaction.begin).toHaveBeenCalledWith(dbMock.sql.ISOLATION_LEVEL.SERIALIZABLE);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();

    const [principalDedupeRequest, principalInsertRequest, guarantorDedupeRequest, guarantorInsertRequest] =
      dbMock.requests;
    expect(principalDedupeRequest.queryText).toContain('WITH (UPDLOCK, HOLDLOCK)');
    expect(principalDedupeRequest.queryText).toContain('STATUS IN');
    expect(principalInsertRequest.queryText).toContain('INSERT INTO dbo.SERASA_PEFIN_SOLICITACOES');
    expect(inputValue(principalInsertRequest, 'documentoGarantidor')).toBeNull();
    expect(guarantorDedupeRequest.queryText).toContain('WITH (UPDLOCK, HOLDLOCK)');
    expect(inputValue(guarantorInsertRequest, 'idSolicitacaoPrincipal')).toBe('principal-id');
    expect(inputValue(guarantorInsertRequest, 'documentoGarantidor')).toBe('55566677788');
    expect(result).toEqual({
      principal: { ID: 'principal-id', TIPO_REGISTRO: 'PRINCIPAL' },
      guarantors: [
        {
          ID: 'guarantor-id',
          ID_SOLICITACAO_PRINCIPAL: 'principal-id',
          TIPO_REGISTRO: 'GARANTIDOR',
        },
      ],
    });
  });

  it('faz rollback e retorna erro de dominio quando ja existe duplicidade ativa', async () => {
    const { model, dbMock } = await loadModel([
      { recordset: [{ ID: 'duplicado-id', STATUS: 'AGUARDANDO_RETORNO' }] },
    ]);

    await expect(
      model.createPendingSolicitations({
        principal: principalInput,
        guarantors: [],
      })
    ).rejects.toMatchObject({
      code: 'SERASA_PEFIN_DUPLICATE_ACTIVE',
      statusCode: 409,
    });

    const [transaction] = dbMock.transactions;
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(dbMock.requests).toHaveLength(1);
  });

  it('atualiza envio aceito pela Serasa com transactionId e status aguardando retorno', async () => {
    const { model, dbMock } = await loadModel([
      {
        recordset: [
          {
            ID: 'principal-id',
            STATUS: 'AGUARDANDO_RETORNO',
            TRANSACTION_ID: 'tx-123',
            CADUS_KEY: 'cadus-key',
            CADUS_SERIE: 'cadus-serie',
          },
        ],
      },
    ]);

    const result = await model.markAsAwaitingReturn({
      id: 'principal-id',
      transactionId: 'tx-123',
      cadusKey: 'cadus-key',
      cadusSerie: 'cadus-serie',
      payloadAuditoria: { transactionId: 'tx-123' },
    });

    const [request] = dbMock.requests;
    expect(request.queryText).toContain('TRANSACTION_ID = @transactionId');
    expect(request.queryText).toContain('CADUS_KEY = @cadusKey');
    expect(request.queryText).toContain('CADUS_SERIE = @cadusSerie');
    expect(inputValue(request, 'status')).toBe('AGUARDANDO_RETORNO');
    expect(inputValue(request, 'payloadAuditoria')).toBe('{"transactionId":"tx-123"}');
    expect(result).toMatchObject({ ID: 'principal-id', TRANSACTION_ID: 'tx-123' });
  });

  it('atualiza resultado por transactionId recebido no webhook', async () => {
    const { model, dbMock } = await loadModel([
      {
        recordset: [
          {
            ID: 'principal-id',
            STATUS: 'NEGATIVADO_ERRO',
            TRANSACTION_ID: 'tx-erro',
            ERROR_MESSAGE: 'Documento invalido',
            ERROR_STATUS_CODE: 422,
          },
        ],
      },
    ]);

    const result = await model.updateWebhookResultByTransactionId({
      transactionId: 'tx-erro',
      status: 'NEGATIVADO_ERRO',
      webhookPayload: { uuid: 'tx-erro', error: { message: 'Documento invalido' } },
      errorMessage: 'Documento invalido',
      errorStatusCode: 422,
    });

    const [request] = dbMock.requests;
    expect(request.queryText).toContain('WHERE TRANSACTION_ID = @transactionId');
    expect(request.queryText).toContain('WEBHOOK_PAYLOAD = @webhookPayload');
    expect(inputValue(request, 'transactionId')).toBe('tx-erro');
    expect(inputValue(request, 'status')).toBe('NEGATIVADO_ERRO');
    expect(inputValue(request, 'errorStatusCode')).toBe(422);
    expect(result).toMatchObject({ ID: 'principal-id', STATUS: 'NEGATIVADO_ERRO' });
  });

  it('consulta solicitacao por transactionId para acompanhamento operacional', async () => {
    const { model, dbMock } = await loadModel([
      {
        recordset: [
          {
            ID: 'principal-id',
            STATUS: 'AGUARDANDO_RETORNO',
            TRANSACTION_ID: 'tx-acompanhamento',
          },
        ],
      },
    ]);

    const result = await model.findByTransactionId('tx-acompanhamento');

    const [request] = dbMock.requests;
    expect(request.queryText).toContain('WHERE TRANSACTION_ID = @transactionId');
    expect(request.queryText).toContain('ORDER BY DT_ATUALIZACAO DESC');
    expect(inputValue(request, 'transactionId')).toBe('tx-acompanhamento');
    expect(result).toMatchObject({
      ID: 'principal-id',
      STATUS: 'AGUARDANDO_RETORNO',
      TRANSACTION_ID: 'tx-acompanhamento',
    });
  });

  it('registra webhook sem solicitacao correspondente sem quebrar o processamento', async () => {
    const { model, dbMock } = await loadModel([
      { recordset: [] },
      {
        recordset: [
          {
            ID: 'webhook-id',
            TRANSACTION_ID: 'tx-sem-match',
            MATCHED_SOLICITACAO_ID: null,
            PROCESSADO: 0,
            MENSAGEM_ERRO: 'SOLICITACAO_NAO_ENCONTRADA',
          },
        ],
      },
    ]);

    const result = await model.recordWebhookAndUpdateSolicitation({
      eventType: 'inclusao.sucesso',
      transactionId: 'tx-sem-match',
      status: 'NEGATIVADO_SUCESSO',
      payload: { uuid: 'tx-sem-match' },
    });

    const [transaction] = dbMock.transactions;
    expect(transaction.begin).toHaveBeenCalledWith(dbMock.sql.ISOLATION_LEVEL.SERIALIZABLE);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();

    const [findRequest, webhookInsertRequest] = dbMock.requests;
    expect(findRequest.queryText).toContain('WITH (UPDLOCK, HOLDLOCK)');
    expect(webhookInsertRequest.queryText).toContain('INSERT INTO dbo.SERASA_PEFIN_WEBHOOKS');
    expect(inputValue(webhookInsertRequest, 'matchedSolicitacaoId')).toBeNull();
    expect(inputValue(webhookInsertRequest, 'processado')).toBe(false);
    expect(inputValue(webhookInsertRequest, 'mensagemErro')).toBe('SOLICITACAO_NAO_ENCONTRADA');
    expect(result).toEqual({
      matched: false,
      solicitation: null,
      webhook: {
        ID: 'webhook-id',
        TRANSACTION_ID: 'tx-sem-match',
        MATCHED_SOLICITACAO_ID: null,
        PROCESSADO: 0,
        MENSAGEM_ERRO: 'SOLICITACAO_NAO_ENCONTRADA',
      },
    });
  });
});

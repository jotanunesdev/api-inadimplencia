// Import the service to test helper functions
const service = require('./serasaPefinService');
const { env } = require('../config/env');

const validAddress = {
  zipCode: '01310-100',
  addressLine: 'Av. Paulista',
  district: 'Bela Vista',
  city: 'Sao Paulo',
  state: 'SP',
};

function buildSolicitationRow(overrides = {}) {
  return {
    ID: overrides.ID || 'solicitation-id',
    NUM_VENDA_FK: 20988,
    TIPO_REGISTRO: overrides.TIPO_REGISTRO || 'PRINCIPAL',
    DOCUMENTO_DEVEDOR: '00001209523',
    DOCUMENTO_GARANTIDOR: overrides.DOCUMENTO_GARANTIDOR || null,
    DOCUMENTO_CREDOR: '43557445000180',
    CONTRACT_NUMBER: '20988',
    CATEGORY_ID: 'FI',
    AREA_INFORMANTE: '0001',
    VALOR: 1000,
    DATA_VENCIMENTO: '2026-05-11',
    STATUS: overrides.STATUS || 'PENDENTE_ENVIO',
    TRANSACTION_ID: overrides.TRANSACTION_ID || null,
    CADUS_KEY: overrides.CADUS_KEY || null,
    CADUS_SERIE: overrides.CADUS_SERIE || null,
    OPERADOR: 'joao.silva',
    ...overrides,
  };
}

function buildRequestNegativacaoDependencies({ debtResponse, guarantorResponse } = {}) {
  const principalRow = buildSolicitationRow({ ID: 'principal-id' });
  const guarantorRow = buildSolicitationRow({
    ID: 'guarantor-id',
    TIPO_REGISTRO: 'GARANTIDOR',
    ID_ASSOCIADO: 'ASSOC001',
    TIPO_ASSOCIACAO: 'FIADOR',
    DOCUMENTO_GARANTIDOR: '07420565899',
  });

  const model = {
    findInadimplenciaByNumVenda: jest.fn().mockResolvedValue({
      NUM_VENDA: 20988,
      DOCUMENTO_DEVEDOR: '00001209523',
      CLIENTE: 'Joao Silva',
      CONTRACT_NUMBER: '20988',
      VALOR: 1000,
      DATA_VENCIMENTO: '2026-05-11',
      address: validAddress,
    }),
    findGuarantorsByNumVenda: jest.fn().mockResolvedValue([
      {
        ID_ASSOCIADO: 'ASSOC001',
        TIPO_ASSOCIACAO: 'FIADOR',
        DOCUMENTO_GARANTIDOR: '07420565899',
        NOME: 'Maria Santos',
        address: validAddress,
      },
    ]),
    createPendingSolicitations: jest.fn().mockResolvedValue({
      principal: principalRow,
      guarantors: [guarantorRow],
    }),
    markAsAwaitingReturn: jest.fn().mockImplementation(async ({ id, transactionId, cadusKey, cadusSerie }) => {
      const baseRow = id === 'principal-id' ? principalRow : guarantorRow;
      return {
        ...baseRow,
        STATUS: 'AGUARDANDO_RETORNO',
        TRANSACTION_ID: transactionId,
        CADUS_KEY: cadusKey,
        CADUS_SERIE: cadusSerie,
      };
    }),
    markAsError: jest.fn().mockImplementation(async ({ id, errorMessage, errorStatusCode }) => {
      const baseRow = id === 'principal-id' ? principalRow : guarantorRow;
      return {
        ...baseRow,
        STATUS: 'NEGATIVADO_ERRO',
        ERROR_MESSAGE: errorMessage,
        ERROR_STATUS_CODE: errorStatusCode,
      };
    }),
  };

  const httpClient = {
    postDebt: jest.fn().mockResolvedValue(debtResponse ?? {
      transactionId: 'transaction-principal',
      cadusKey: 'cadus-principal',
      cadusSerie: 'serie-principal',
    }),
    postGuarantor: jest.fn().mockResolvedValue(guarantorResponse ?? {
      transactionId: 'transaction-guarantor',
      CADUS_KEY: 'legacy-cadus-guarantor',
      CADUS_SERIE: 'legacy-serie-guarantor',
    }),
  };

  const payloadBuilder = {
    buildMainDebtPayload: jest.fn().mockReturnValue({ kind: 'main-debt' }),
    buildGuarantorPayload: jest.fn().mockReturnValue({ kind: 'guarantor' }),
    maskPayload: jest.fn((payload) => payload),
  };

  return {
    model,
    httpClient,
    payloadBuilder,
    dependencies: {
      model,
      httpClientFactory: () => httpClient,
      payloadBuilder,
    },
  };
}

function buildPrevalidationDependencies({ guarantorOverrides = {} } = {}) {
  const principalRow = buildSolicitationRow({ ID: 'principal-id' });
  const guarantorRow = buildSolicitationRow({
    ID: 'guarantor-id',
    TIPO_REGISTRO: 'GARANTIDOR',
    ID_ASSOCIADO: 'ASSOC001',
    TIPO_ASSOCIACAO: 'FIADOR',
    DOCUMENTO_GARANTIDOR: guarantorOverrides.DOCUMENTO_GARANTIDOR || '07420565899',
  });

  const model = {
    findInadimplenciaByNumVenda: jest.fn().mockResolvedValue({
      NUM_VENDA: 20988,
      DOCUMENTO_DEVEDOR: '00001209523',
      CLIENTE: 'Joao Silva',
      CONTRACT_NUMBER: '20988',
      VALOR: 1000,
      DATA_VENCIMENTO: '2026-05-11',
      address: validAddress,
    }),
    findGuarantorsByNumVenda: jest.fn().mockResolvedValue([
      {
        ID_ASSOCIADO: 'ASSOC001',
        TIPO_ASSOCIACAO: 'FIADOR',
        DOCUMENTO_GARANTIDOR: '07420565899',
        NOME: 'Maria Santos',
        address: validAddress,
        ...guarantorOverrides,
      },
    ]),
    createPendingSolicitations: jest.fn().mockResolvedValue({
      principal: principalRow,
      guarantors: [guarantorRow],
    }),
    markAsAwaitingReturn: jest.fn().mockImplementation(async ({ id, transactionId, cadusKey, cadusSerie }) => {
      const baseRow = id === 'principal-id' ? principalRow : guarantorRow;
      return {
        ...baseRow,
        STATUS: 'AGUARDANDO_RETORNO',
        TRANSACTION_ID: transactionId,
        CADUS_KEY: cadusKey,
        CADUS_SERIE: cadusSerie,
      };
    }),
    markAsError: jest.fn().mockImplementation(async ({ id, errorMessage, errorStatusCode }) => {
      const baseRow = id === 'principal-id' ? principalRow : guarantorRow;
      return {
        ...baseRow,
        STATUS: 'NEGATIVADO_ERRO',
        ERROR_MESSAGE: errorMessage,
        ERROR_STATUS_CODE: errorStatusCode,
      };
    }),
  };

  const httpClient = {
    postDebt: jest.fn().mockResolvedValue({
      transactionId: 'transaction-principal',
      cadusKey: 'cadus-principal',
      cadusSerie: 'serie-principal',
    }),
    postGuarantor: jest.fn().mockResolvedValue({
      transactionId: 'transaction-guarantor',
      cadusKey: 'cadus-guarantor',
      cadusSerie: 'serie-guarantor',
    }),
  };
  const httpClientFactory = jest.fn(() => httpClient);

  return {
    model,
    httpClient,
    httpClientFactory,
    dependencies: {
      model,
      httpClientFactory,
    },
  };
}

describe('serasaPefinService - Helper Functions', () => {
  describe('requestNegativacao', () => {
    beforeEach(() => {
      env.SERASA_CREDITOR_DOCUMENT = '43557445000180';
      env.SERASA_AREA_INFORMANTE = '0001';
      env.SERASA_UAT_ENABLED = true;
    });

    it('deve persistir transactionId documentado para principal e garantidor', async () => {
      const { dependencies, model } = buildRequestNegativacaoDependencies();

      const result = await service.requestNegativacao(
        {
          numVenda: 20988,
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC001'],
        },
        dependencies
      );

      expect(model.markAsAwaitingReturn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: 'principal-id',
          transactionId: 'transaction-principal',
          cadusKey: 'cadus-principal',
          cadusSerie: 'serie-principal',
        })
      );
      expect(model.markAsAwaitingReturn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: 'guarantor-id',
          transactionId: 'transaction-guarantor',
          cadusKey: 'legacy-cadus-guarantor',
          cadusSerie: 'legacy-serie-guarantor',
        })
      );
      expect(result.principal).toMatchObject({
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-principal',
        cadusKey: 'cadus-principal',
        cadusSerie: 'serie-principal',
      });
      expect(result.garantidores[0]).toMatchObject({
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-guarantor',
        cadusKey: 'legacy-cadus-guarantor',
        cadusSerie: 'legacy-serie-guarantor',
      });
    });

    it('deve repassar documentoCredor preenchido ao persistir principal e garantidores', async () => {
      const { dependencies, model } = buildRequestNegativacaoDependencies();

      await service.requestNegativacao(
        {
          numVenda: 20988,
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC001'],
        },
        dependencies
      );

      expect(model.createPendingSolicitations).toHaveBeenCalledWith({
        principal: expect.objectContaining({
          documentoCredor: '43557445000180',
        }),
        guarantors: [
          expect.objectContaining({
            documentoCredor: '43557445000180',
          }),
        ],
      });
    });

    it('deve falhar explicitamente quando resposta inicial principal vier sem transactionId', async () => {
      const { dependencies, model } = buildRequestNegativacaoDependencies({
        debtResponse: { cadusKey: 'cadus-sem-transaction' },
      });

      await expect(
        service.requestNegativacao(
          {
            numVenda: 20988,
            operador: 'joao.silva',
            garantidoresSelecionados: [],
          },
          dependencies
        )
      ).rejects.toThrow('SERASA_PEFIN_RESPONSE_WITHOUT_TRANSACTION_ID');

      expect(model.markAsAwaitingReturn).not.toHaveBeenCalled();
      expect(model.markAsError).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'principal-id',
          errorStatusCode: 502,
        })
      );
    });

    it('deve validar garantidor selecionado antes de persistir e antes de chamar postDebt', async () => {
      const { dependencies, model, httpClient, httpClientFactory } = buildPrevalidationDependencies({
        guarantorOverrides: {
          address: {
            zipCode: '01310-100',
          },
        },
      });

      await expect(
        service.requestNegativacao(
          {
            numVenda: 20988,
            operador: 'joao.silva',
            garantidoresSelecionados: ['ASSOC001'],
          },
          dependencies
        )
      ).rejects.toMatchObject({
        code: 'SERASA_PEFIN_MISSING_REQUIRED_FIELDS',
        missingFields: expect.arrayContaining([
          'garantidores[ASSOC001].guarantor.address.addressLine',
          'garantidores[ASSOC001].guarantor.address.city',
        ]),
        participant: expect.objectContaining({
          tipoRegistro: 'GARANTIDOR',
          idAssociado: 'ASSOC001',
        }),
      });

      expect(model.createPendingSolicitations).not.toHaveBeenCalled();
      expect(httpClientFactory).not.toHaveBeenCalled();
      expect(httpClient.postDebt).not.toHaveBeenCalled();
      expect(httpClient.postGuarantor).not.toHaveBeenCalled();
    });

    it('deve bloquear documento UAT de garantidor selecionado antes de chamar postDebt', async () => {
      const { dependencies, model, httpClient, httpClientFactory } = buildPrevalidationDependencies({
        guarantorOverrides: {
          DOCUMENTO_GARANTIDOR: '12345678901',
        },
      });

      await expect(
        service.requestNegativacao(
          {
            numVenda: 20988,
            operador: 'joao.silva',
            garantidoresSelecionados: ['ASSOC001'],
          },
          dependencies
        )
      ).rejects.toMatchObject({
        code: 'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED',
        blockedDocuments: [
          expect.objectContaining({
            tipoRegistro: 'GARANTIDOR',
            idAssociado: 'ASSOC001',
            documento: '12345678901',
          }),
        ],
      });

      expect(model.createPendingSolicitations).not.toHaveBeenCalled();
      expect(httpClientFactory).not.toHaveBeenCalled();
      expect(httpClient.postDebt).not.toHaveBeenCalled();
      expect(httpClient.postGuarantor).not.toHaveBeenCalled();
    });

    it('deve prevalidar payloads antes da persistencia e enviar garantidor depois do principal', async () => {
      const { dependencies, model, httpClient, payloadBuilder } = buildRequestNegativacaoDependencies();

      await service.requestNegativacao(
        {
          numVenda: 20988,
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC001'],
        },
        dependencies
      );

      expect(payloadBuilder.buildMainDebtPayload).toHaveBeenCalledTimes(1);
      expect(payloadBuilder.buildGuarantorPayload).toHaveBeenCalledTimes(1);
      expect(payloadBuilder.buildGuarantorPayload.mock.invocationCallOrder[0]).toBeLessThan(
        model.createPendingSolicitations.mock.invocationCallOrder[0]
      );
      expect(model.createPendingSolicitations.mock.invocationCallOrder[0]).toBeLessThan(
        httpClient.postDebt.mock.invocationCallOrder[0]
      );
      expect(httpClient.postDebt.mock.invocationCallOrder[0]).toBeLessThan(
        httpClient.postGuarantor.mock.invocationCallOrder[0]
      );
    });

    it('deve manter principal aguardando retorno quando HTTP do garantidor falhar depois do envio', async () => {
      const { dependencies, httpClient, model } = buildRequestNegativacaoDependencies();
      const guarantorError = new Error('Falha Serasa garantidor');
      guarantorError.statusCode = 503;
      httpClient.postGuarantor.mockRejectedValue(guarantorError);

      const result = await service.requestNegativacao(
        {
          numVenda: 20988,
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC001'],
        },
        dependencies
      );

      expect(result.principal).toMatchObject({
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-principal',
      });
      expect(result.garantidores[0]).toMatchObject({
        status: 'NEGATIVADO_ERRO',
        errorMessage: 'Falha Serasa garantidor',
        errorStatusCode: 503,
      });
      expect(model.markAsError).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'guarantor-id',
          errorMessage: 'Falha Serasa garantidor',
          errorStatusCode: 503,
        })
      );
    });
  });

  describe('getAcompanhamentoByTransactionId', () => {
    it('deve retornar acompanhamento aguardando webhook quando status nao e final', async () => {
      const model = {
        findByTransactionId: jest.fn().mockResolvedValue(
          buildSolicitationRow({
            STATUS: 'AGUARDANDO_RETORNO',
            TRANSACTION_ID: 'transaction-pendente',
          })
        ),
      };

      const result = await service.getAcompanhamentoByTransactionId(
        { transactionId: 'transaction-pendente' },
        { model }
      );

      expect(model.findByTransactionId).toHaveBeenCalledWith('transaction-pendente');
      expect(result).toMatchObject({
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-pendente',
        finalizado: false,
        aguardandoWebhook: true,
        mensagemAcompanhamento: 'Aguardando webhook da Serasa para concluir o processamento.',
      });
    });

    it('deve retornar acompanhamento finalizado quando webhook ja atualizou status final', async () => {
      const model = {
        findByTransactionId: jest.fn().mockResolvedValue(
          buildSolicitationRow({
            STATUS: 'NEGATIVADO_ERRO',
            TRANSACTION_ID: 'transaction-finalizado',
            ERROR_MESSAGE: 'Documento invalido',
            ERROR_STATUS_CODE: 400,
          })
        ),
      };

      const result = await service.getAcompanhamentoByTransactionId(
        { transactionId: 'transaction-finalizado' },
        { model }
      );

      expect(result).toMatchObject({
        status: 'NEGATIVADO_ERRO',
        transactionId: 'transaction-finalizado',
        errorMessage: 'Documento invalido',
        errorStatusCode: 400,
        finalizado: true,
        aguardandoWebhook: false,
        mensagemAcompanhamento: 'Processamento finalizado pelo webhook da Serasa.',
      });
    });

    it('deve retornar 404 quando transactionId nao existe na base local', async () => {
      const model = {
        findByTransactionId: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.getAcompanhamentoByTransactionId(
          { transactionId: 'transaction-inexistente' },
          { model }
        )
      ).rejects.toMatchObject({
        code: 'SERASA_PEFIN_TRANSACTION_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('formatSolicitationForHistory', () => {
    it('deve formatar solicitacao para historico com documentos mascarados', () => {
      const row = {
        ID: 'uuid-123',
        NUM_VENDA_FK: 12345,
        TIPO_REGISTRO: 'PRINCIPAL',
        DOCUMENTO_DEVEDOR: '00001209523',
        DOCUMENTO_GARANTIDOR: '07420565899',
        STATUS: 'AGUARDANDO_RETORNO',
        TRANSACTION_ID: 'transaction-123',
        PAYLOAD_AUDIT: '{"documento":"00001209523"}',
      };

      const result = service.formatSolicitationForHistory(row);

      expect(result).toMatchObject({
        id: 'uuid-123',
        numVenda: 12345,
        tipoRegistro: 'PRINCIPAL',
        documentoDevedor: expect.any(String),
        documentoGarantidor: expect.any(String),
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-123',
      });
    });

    it('deve retornar null para row null', () => {
      const result = service.formatSolicitationForHistory(null);
      expect(result).toBeNull();
    });
  });

  describe('formatSolicitationForDetail', () => {
    it('deve formatar solicitacao para detalhe com payloads sanitizados', () => {
      const row = {
        ID: 'uuid-123',
        NUM_VENDA_FK: 12345,
        TIPO_REGISTRO: 'PRINCIPAL',
        DOCUMENTO_DEVEDOR: '00001209523',
        STATUS: 'AGUARDANDO_RETORNO',
        TRANSACTION_ID: 'transaction-123',
        PAYLOAD_ENVIO: '{"documento":"00001209523","senha":"secret"}',
        PAYLOAD_RETORNO: '{"status":"ok"}',
        ERROR_MESSAGE: null,
        ERROR_STATUS_CODE: null,
      };

      const result = service.formatSolicitationForDetail(row);

      expect(result).toMatchObject({
        id: 'uuid-123',
        numVenda: 12345,
        tipoRegistro: 'PRINCIPAL',
        documentoDevedor: expect.any(String),
        status: 'AGUARDANDO_RETORNO',
        transactionId: 'transaction-123',
        errorMessage: null,
        errorStatusCode: null,
      });
    });

    it('deve retornar null para row null', () => {
      const result = service.formatSolicitationForDetail(null);
      expect(result).toBeNull();
    });
  });

  describe('formatGuarantorForPreview', () => {
    it('deve formatar garantidor para preview', () => {
      const guarantor = {
        ID_ASSOCIADO: 'ASSOC001',
        NOME: 'Maria Santos',
        DOCUMENTO_GARANTIDOR: '07420565899',
        TIPO_ASSOCIACAO: 'FIADOR',
      };

      const result = service.formatGuarantorForPreview(guarantor);

      expect(result).toMatchObject({
        idAssociado: 'ASSOC001',
        nome: 'Maria Santos',
        tipoAssociacao: 'FIADOR',
      });
    });

    it('deve retornar null para guarantor null', () => {
      const result = service.formatGuarantorForPreview(null);
      expect(result).toBeNull();
    });
  });

  describe('createPreview', () => {
    beforeEach(() => {
      env.SERASA_CREDITOR_DOCUMENT = '43557445000180';
      env.SERASA_AREA_INFORMANTE = '0001';
      env.SERASA_UAT_ENABLED = true;
    });

    it('deve manter a divida principal elegivel quando garantidor nao selecionado tem campos faltantes', async () => {
      const model = {
        findInadimplenciaByNumVenda: jest.fn().mockResolvedValue({
          NUM_VENDA: 20988,
          DOCUMENTO_DEVEDOR: '00001209523',
          CLIENTE: 'Joao Silva',
          EMPREENDIMENTO: 'Residencial Flores',
          BLOCO: 'A',
          UNIDADE: '101',
          CONTRACT_NUMBER: '20988',
          VALOR: 1000,
          DATA_VENCIMENTO: '2026-05-11',
          address: validAddress,
        }),
        findGuarantorsByNumVenda: jest.fn().mockResolvedValue([
          {
            ID_ASSOCIADO: 'ASSOC001',
            TIPO_ASSOCIACAO: 'FIADOR',
            DOCUMENTO_GARANTIDOR: '07420565899',
            NOME: 'Maria Santos',
            address: {
              zipCode: '01310-100',
            },
          },
        ]),
        findActiveDuplicate: jest.fn().mockResolvedValue(null),
      };

      const preview = await service.createPreview({ numVenda: 20988 }, { model });

      expect(preview.elegivel).toBe(true);
      expect(preview.missingFields).toEqual([]);
      expect(preview.garantidores).toHaveLength(1);
      expect(preview.garantidores[0]).toMatchObject({
        idAssociado: 'ASSOC001',
        elegivel: false,
        missingFields: expect.arrayContaining([
          'address.addressLine',
          'address.district',
          'address.city',
          'address.state',
        ]),
      });
    });

    it('deve preservar missingFields distintos por garantidor no preview', async () => {
      const model = {
        findInadimplenciaByNumVenda: jest.fn().mockResolvedValue({
          NUM_VENDA: 20988,
          DOCUMENTO_DEVEDOR: '00001209523',
          CLIENTE: 'Joao Silva',
          CONTRACT_NUMBER: '20988',
          VALOR: 1000,
          DATA_VENCIMENTO: '2026-05-11',
          address: validAddress,
        }),
        findGuarantorsByNumVenda: jest.fn().mockResolvedValue([
          {
            ID_ASSOCIADO: 'ASSOC001',
            TIPO_ASSOCIACAO: 'FIADOR',
            DOCUMENTO_GARANTIDOR: '07420565899',
            NOME: 'Maria Santos',
            address: {
              zipCode: '01310-100',
              district: 'Bela Vista',
              city: 'Sao Paulo',
              state: 'SP',
            },
          },
          {
            ID_ASSOCIADO: 'ASSOC002',
            TIPO_ASSOCIACAO: 'CONJUGE',
            DOCUMENTO_GARANTIDOR: null,
            NOME: 'Jose Santos',
            address: validAddress,
          },
        ]),
        findActiveDuplicate: jest.fn().mockResolvedValue(null),
      };

      const preview = await service.createPreview({ numVenda: 20988 }, { model });

      expect(preview.garantidores).toEqual([
        expect.objectContaining({
          idAssociado: 'ASSOC001',
          elegivel: false,
          missingFields: ['address.addressLine'],
        }),
        expect.objectContaining({
          idAssociado: 'ASSOC002',
          elegivel: false,
          missingFields: ['DOCUMENTO_GARANTIDOR'],
        }),
      ]);
    });
  });

  describe('handleWebhook', () => {
    let mockRecordWebhookAndUpdateSolicitation;

    beforeEach(() => {
      mockRecordWebhookAndUpdateSolicitation = {
        recordWebhookAndUpdateSolicitation: jest.fn(),
      };
    });

    it('deve processar webhook de sucesso principal e atualizar status', async () => {
      const eventType = 'inclusao_sucesso';
      const payload = {
        uuid: 'transaction-uuid-123',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        cadusKey: 'CADUS123',
        cadusSerie: 'SERIE456',
        debtType: 'PEFIN',
        creditorArea: 'SP',
        categoryId: 'FI',
        error: null,
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'NEGATIVADO_SUCESSO',
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      const result = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'inclusao_sucesso',
        transactionId: 'transaction-uuid-123',
        status: 'NEGATIVADO_SUCESSO',
        payload,
        errorMessage: null,
        errorStatusCode: null,
      });

      expect(result).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });
    });

    it('deve processar webhook de erro principal e persistir mensagem e statusCode', async () => {
      const eventType = 'inclusao_erro';
      const payload = {
        uuid: 'transaction-uuid-456',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        cadusKey: 'CADUS123',
        cadusSerie: 'SERIE456',
        debtType: 'PEFIN',
        creditorArea: 'SP',
        categoryId: 'FI',
        error: {
          message: 'Documento inválido',
          statusCode: 400,
        },
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'NEGATIVADO_ERRO',
          ERROR_MESSAGE: 'Documento inválido',
          ERROR_STATUS_CODE: 400,
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      const result = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'inclusao_erro',
        transactionId: 'transaction-uuid-456',
        status: 'NEGATIVADO_ERRO',
        payload,
        errorMessage: 'Documento inválido',
        errorStatusCode: 400,
      });

      expect(result).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });
    });

    it('deve processar webhook de sucesso garantidor', async () => {
      const eventType = 'avalista_sucesso';
      const payload = {
        uuid: 'transaction-uuid-789',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        cadusKey: 'CADUS123',
        cadusSerie: 'SERIE456',
        debtType: 'PEFIN',
        creditorArea: 'SP',
        categoryId: 'FI',
        error: null,
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'NEGATIVADO_SUCESSO',
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      const result = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'avalista_sucesso',
        transactionId: 'transaction-uuid-789',
        status: 'NEGATIVADO_SUCESSO',
        payload,
        errorMessage: null,
        errorStatusCode: null,
      });

      expect(result).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });
    });

    it('deve processar webhook de erro garantidor', async () => {
      const eventType = 'avalista_erro';
      const payload = {
        uuid: 'transaction-uuid-999',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        cadusKey: 'CADUS123',
        cadusSerie: 'SERIE456',
        debtType: 'PEFIN',
        creditorArea: 'SP',
        categoryId: 'FI',
        error: {
          message: 'Garantidor não encontrado',
          statusCode: 404,
        },
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'NEGATIVADO_ERRO',
          ERROR_MESSAGE: 'Garantidor não encontrado',
          ERROR_STATUS_CODE: 404,
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      const result = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'avalista_erro',
        transactionId: 'transaction-uuid-999',
        status: 'NEGATIVADO_ERRO',
        payload,
        errorMessage: 'Garantidor não encontrado',
        errorStatusCode: 404,
      });

      expect(result).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });
    });

    it('deve processar webhook de baixa com sucesso e mapear status de baixa', async () => {
      const eventType = 'baixa/sucesso';
      const payload = {
        uuid: 'transaction-baixa-123',
        contract: '12345',
        error: null,
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'BAIXADO_SUCESSO',
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'baixa/sucesso',
        transactionId: 'transaction-baixa-123',
        status: 'BAIXADO_SUCESSO',
        payload,
        errorMessage: null,
        errorStatusCode: null,
      });
    });

    it('deve processar webhook de baixa com erro e mapear status de baixa', async () => {
      const eventType = 'baixa/erro';
      const payload = {
        uuid: 'transaction-baixa-456',
        contract: '12345',
        error: {
          message: 'Baixa nao encontrada',
          statusCode: 404,
        },
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'BAIXADO_ERRO',
          ERROR_MESSAGE: 'Baixa nao encontrada',
          ERROR_STATUS_CODE: 404,
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'baixa/erro',
        transactionId: 'transaction-baixa-456',
        status: 'BAIXADO_ERRO',
        payload,
        errorMessage: 'Baixa nao encontrada',
        errorStatusCode: 404,
      });
    });

    it('deve processar webhook sem match e registrar para investigação', async () => {
      const eventType = 'inclusao_sucesso';
      const payload = {
        uuid: 'transaction-uuid-not-found',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        cadusKey: 'CADUS123',
        cadusSerie: 'SERIE456',
        debtType: 'PEFIN',
        creditorArea: 'SP',
        categoryId: 'FI',
        error: null,
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: false,
        solicitation: null,
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: false,
          MENSAGEM_ERRO: 'SOLICITACAO_NAO_ENCONTRADA',
        },
      });

      const result = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledWith({
        eventType: 'inclusao_sucesso',
        transactionId: 'transaction-uuid-not-found',
        status: 'NEGATIVADO_SUCESSO',
        payload,
        errorMessage: null,
        errorStatusCode: null,
      });

      expect(result).toMatchObject({
        matched: false,
        solicitation: null,
        webhook: expect.any(Object),
      });
    });

    it('deve retornar erro quando payload não tem uuid', async () => {
      const eventType = 'inclusao_sucesso';
      const payload = {
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        error: null,
      };

      await expect(
        service.handleWebhook({ eventType, payload }, { model: mockRecordWebhookAndUpdateSolicitation })
      ).rejects.toThrow('PAYLOAD_SEM_UUID');
    });

    it('deve ser idempotente ao processar webhook repetido', async () => {
      const eventType = 'inclusao_sucesso';
      const payload = {
        uuid: 'transaction-uuid-123',
        debtorDocument: '00001209523',
        creditorDocument: '62173620000180',
        contract: '12345',
        debtValue: 1000.00,
        debtDate: '2026-05-11',
        error: null,
      };

      mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation.mockResolvedValue({
        matched: true,
        solicitation: {
          ID: 'solicitation-uuid',
          STATUS: 'NEGATIVADO_SUCESSO',
        },
        webhook: {
          ID: 'webhook-uuid',
          PROCESSADO: true,
        },
      });

      const result1 = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );
      const result2 = await service.handleWebhook(
        { eventType, payload },
        { model: mockRecordWebhookAndUpdateSolicitation }
      );

      expect(result1).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });

      expect(result2).toMatchObject({
        matched: true,
        solicitation: expect.any(Object),
        webhook: expect.any(Object),
      });

      expect(mockRecordWebhookAndUpdateSolicitation.recordWebhookAndUpdateSolicitation).toHaveBeenCalledTimes(2);
    });
  });
});

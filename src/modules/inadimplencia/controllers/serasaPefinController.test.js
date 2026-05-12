const service = require('../services/serasaPefinService');
const controller = require('./serasaPefinController');

jest.mock('../services/serasaPefinService');

describe('serasaPefinController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreview', () => {
    it('should return preview data for valid numVenda', async () => {
      const mockPreview = {
        numVenda: 20988,
        cliente: 'João Silva',
        elegivel: true,
      };
      service.createPreview.mockResolvedValue(mockPreview);

      const req = { params: { numVenda: '20988' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getPreview(req, res, next);

      expect(service.createPreview).toHaveBeenCalledWith({ numVenda: 20988 });
      expect(res.json).toHaveBeenCalledWith({ data: mockPreview });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid numVenda', async () => {
      const req = { params: { numVenda: 'invalid' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getPreview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'NUM_VENDA invalido.' });
      expect(service.createPreview).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when service throws domain error with statusCode', async () => {
      const error = new Error('Venda não encontrada');
      error.statusCode = 404;
      service.createPreview.mockRejectedValue(error);

      const req = { params: { numVenda: '99999' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getPreview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Venda não encontrada' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should delegate unexpected errors to next', async () => {
      const error = new Error('Unexpected database error');
      service.createPreview.mockRejectedValue(error);

      const req = { params: { numVenda: '20988' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getPreview(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('postNegativacao', () => {
    it('should create negativacao with valid data', async () => {
      const mockResult = {
        principal: { id: 'uuid-1', status: 'AGUARDANDO_RETORNO' },
        garantidores: [],
        mensagem: 'Solicitação enviada para Serasa.',
      };
      service.requestNegativacao.mockResolvedValue(mockResult);

      const req = {
        params: { numVenda: '20988' },
        body: {
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC-001'],
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(service.requestNegativacao).toHaveBeenCalledWith(
        {
          numVenda: 20988,
          operador: 'joao.silva',
          garantidoresSelecionados: ['ASSOC-001'],
          overrides: {},
        },
        {}
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid numVenda', async () => {
      const req = {
        params: { numVenda: 'invalid' },
        body: { operador: 'joao.silva' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'NUM_VENDA invalido.' });
      expect(service.requestNegativacao).not.toHaveBeenCalled();
    });

    it('should return 400 when operador is missing', async () => {
      const req = {
        params: { numVenda: '20988' },
        body: { garantidoresSelecionados: ['ASSOC-001'] },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'OPERADOR e obrigatorio.' });
      expect(service.requestNegativacao).not.toHaveBeenCalled();
    });

    it('should parse garantidoresSelecionados from JSON string', async () => {
      const mockResult = { principal: {}, garantidores: [], mensagem: '' };
      service.requestNegativacao.mockResolvedValue(mockResult);

      const req = {
        params: { numVenda: '20988' },
        body: {
          operador: 'joao.silva',
          garantidoresSelecionados: '["ASSOC-001", "ASSOC-002"]',
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(service.requestNegativacao).toHaveBeenCalledWith(
        expect.objectContaining({
          garantidoresSelecionados: ['ASSOC-001', 'ASSOC-002'],
        }),
        {}
      );
    });

    it('should include missingFields when service returns a validation domain error', async () => {
      const error = new Error('SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES');
      error.statusCode = 400;
      error.code = 'SERASA_PEFIN_MISSING_REQUIRED_FIELDS';
      error.missingFields = ['debtor.address.zipCode', 'debtor.address.city'];
      service.requestNegativacao.mockRejectedValue(error);

      const req = {
        params: { numVenda: '20988' },
        body: { operador: 'joao.silva' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES',
        code: 'SERASA_PEFIN_MISSING_REQUIRED_FIELDS',
        missingFields: ['debtor.address.zipCode', 'debtor.address.city'],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should include code and masked blockedDocuments for domain errors', async () => {
      const error = new Error('SERASA_PEFIN_DOCUMENTO_NAO_AUTORIZADO_UAT');
      error.statusCode = 400;
      error.code = 'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED';
      error.blockedDocuments = [
        '12345678901',
        {
          tipoRegistro: 'GARANTIDOR',
          idAssociado: 'ASSOC001',
          documento: '12345678000190',
        },
      ];
      service.requestNegativacao.mockRejectedValue(error);

      const req = {
        params: { numVenda: '20988' },
        body: { operador: 'joao.silva' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'SERASA_PEFIN_DOCUMENTO_NAO_AUTORIZADO_UAT',
        code: 'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED',
        blockedDocuments: [
          '123.***.01',
          {
            tipoRegistro: 'GARANTIDOR',
            idAssociado: 'ASSOC001',
            documento: '12.***.90',
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should delegate unexpected errors to next', async () => {
      const error = new Error('Unexpected error');
      service.requestNegativacao.mockRejectedValue(error);

      const req = {
        params: { numVenda: '20988' },
        body: { operador: 'joao.silva' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.postNegativacao(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listNegativacoes', () => {
    it('should return history for valid numVenda', async () => {
      const mockHistory = [
        { id: 'uuid-1', status: 'NEGATIVADO_SUCESSO' },
        { id: 'uuid-2', status: 'AGUARDANDO_RETORNO' },
      ];
      service.listNegativacoesByVenda.mockResolvedValue(mockHistory);

      const req = { params: { numVenda: '20988' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.listNegativacoes(req, res, next);

      expect(service.listNegativacoesByVenda).toHaveBeenCalledWith({ numVenda: 20988 });
      expect(res.json).toHaveBeenCalledWith({ data: mockHistory });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid numVenda', async () => {
      const req = { params: { numVenda: 'invalid' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.listNegativacoes(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'NUM_VENDA invalido.' });
      expect(service.listNegativacoesByVenda).not.toHaveBeenCalled();
    });
  });

  describe('getNegativacaoById', () => {
    it('should return solicitation for valid GUID', async () => {
      const mockSolicitation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'NEGATIVADO_SUCESSO',
      };
      service.getNegativacaoById.mockResolvedValue(mockSolicitation);

      const req = {
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getNegativacaoById(req, res, next);

      expect(service.getNegativacaoById).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockSolicitation });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid GUID', async () => {
      const req = { params: { id: 'invalid-guid' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getNegativacaoById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ID invalido.' });
      expect(service.getNegativacaoById).not.toHaveBeenCalled();
    });

    it('should return 404 when solicitation not found', async () => {
      const error = new Error('Solicitação não encontrada');
      error.statusCode = 404;
      service.getNegativacaoById.mockRejectedValue(error);

      const req = {
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getNegativacaoById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Solicitação não encontrada' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getAcompanhamentoByTransactionId', () => {
    it('should return acompanhamento for valid transactionId', async () => {
      const mockAcompanhamento = {
        transactionId: 'f1d11b18-b459-4f11-97a8-8143a6c392e4',
        status: 'NEGATIVADO_SUCESSO',
        finalizado: true,
        aguardandoWebhook: false,
      };
      service.getAcompanhamentoByTransactionId.mockResolvedValue(mockAcompanhamento);

      const req = {
        params: { transactionId: 'f1d11b18-b459-4f11-97a8-8143a6c392e4' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getAcompanhamentoByTransactionId(req, res, next);

      expect(service.getAcompanhamentoByTransactionId).toHaveBeenCalledWith({
        transactionId: 'f1d11b18-b459-4f11-97a8-8143a6c392e4',
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockAcompanhamento });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid transactionId', async () => {
      const req = { params: { transactionId: 'x'.repeat(65) } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getAcompanhamentoByTransactionId(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'TRANSACTION_ID invalido.' });
      expect(service.getAcompanhamentoByTransactionId).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when transactionId is not found', async () => {
      const error = new Error('SOLICITACAO_NAO_ENCONTRADA_PARA_TRANSACTION_ID');
      error.statusCode = 404;
      error.code = 'SERASA_PEFIN_TRANSACTION_NOT_FOUND';
      service.getAcompanhamentoByTransactionId.mockRejectedValue(error);

      const req = { params: { transactionId: 'transaction-not-found' } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.getAcompanhamentoByTransactionId(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'SOLICITACAO_NAO_ENCONTRADA_PARA_TRANSACTION_ID',
        code: 'SERASA_PEFIN_TRANSACTION_NOT_FOUND',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookInclusaoSucesso', () => {
    it('should handle webhook with valid payload', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-123', status: 'success' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookInclusaoSucesso(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'inclusao/sucesso',
        payload: { uuid: 'transaction-123', status: 'success' },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid payload', async () => {
      const req = { body: null };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookInclusaoSucesso(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payload invalido.' });
      expect(service.handleWebhook).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookInclusaoErro', () => {
    it('should handle webhook error with valid payload', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-123', error: { message: 'Validation failed' } },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookInclusaoErro(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'inclusao/erro',
        payload: { uuid: 'transaction-123', error: { message: 'Validation failed' } },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });
  });

  describe('handleWebhookAvalistaSucesso', () => {
    it('should handle avalista success webhook', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-456', status: 'success' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookAvalistaSucesso(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'avalista/sucesso',
        payload: { uuid: 'transaction-456', status: 'success' },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });
  });

  describe('handleWebhookAvalistaErro', () => {
    it('should handle avalista error webhook', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-456', error: { message: 'Guarantor validation failed' } },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookAvalistaErro(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'avalista/erro',
        payload: { uuid: 'transaction-456', error: { message: 'Guarantor validation failed' } },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });
  });

  describe('handleWebhookBaixaSucesso', () => {
    it('should handle baixa success webhook', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-baixa-123', status: 'success' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookBaixaSucesso(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'baixa/sucesso',
        payload: { uuid: 'transaction-baixa-123', status: 'success' },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });
  });

  describe('handleWebhookBaixaErro', () => {
    it('should handle baixa error webhook', async () => {
      const mockResult = { processed: true };
      service.handleWebhook.mockResolvedValue(mockResult);

      const req = {
        body: { uuid: 'transaction-baixa-456', error: { message: 'Baixa nao encontrada' } },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await controller.handleWebhookBaixaErro(req, res, next);

      expect(service.handleWebhook).toHaveBeenCalledWith({
        eventType: 'baixa/erro',
        payload: { uuid: 'transaction-baixa-456', error: { message: 'Baixa nao encontrada' } },
      });
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });
  });
});

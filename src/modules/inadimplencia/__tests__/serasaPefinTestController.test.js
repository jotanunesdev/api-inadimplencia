// Mock dependencies before requiring the controller
jest.mock('../services/serasaPefinHttpClient');
jest.mock('../services/serasaPefinService');

const {
  testAuth,
  testDebt,
  simulateWebhook,
  listTestDocuments,
} = require('../controllers/serasaPefinTestController');

describe('serasaPefinTestController', () => {
  let req, res, next;
  let httpClientMock;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default httpClient mock
    const { createSerasaPefinHttpClient } = require('../services/serasaPefinHttpClient');
    httpClientMock = {
      isConfigured: jest.fn(() => false),
      getBearerToken: jest.fn(),
      postDebt: jest.fn(),
    };
    createSerasaPefinHttpClient.mockReturnValue(httpClientMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testAuth', () => {
    it('deve retornar 403 em ambiente de produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await testAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint de teste bloqueado em produção.' });
      expect(next).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 503 quando Serasa não configurado', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await testAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Serasa PEFIN não configurado.',
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('testDebt', () => {
    it('deve retornar 403 em ambiente de produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      req.body = { documento: '168.816.700-52' };

      await testDebt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando documento não fornecido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = {};

      await testDebt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'DOCUMENTO é obrigatório para teste de envio.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando documento não autorizado', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = { documento: '123.456.789-00' };

      await testDebt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Documento não autorizado para teste.',
          allowedDocuments: expect.any(Array),
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 503 quando Serasa não configurado', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = { documento: '168.816.700-52' };

      await testDebt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Serasa PEFIN não configurado.',
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('simulateWebhook', () => {
    it('deve retornar 403 em ambiente de produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      req.body = { transactionId: 'test-uuid', eventType: 'inclusao/sucesso' };

      await simulateWebhook(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando transactionId não fornecido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = { eventType: 'inclusao/sucesso' };

      await simulateWebhook(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'TRANSACTION_ID é obrigatório.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando eventType inválido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = { transactionId: 'test-uuid', eventType: 'invalid' };

      await simulateWebhook(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EVENT_TYPE invalido.',
          allowedTypes: expect.any(Array),
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve processar webhook com eventType válido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      req.body = { transactionId: 'test-uuid', eventType: 'inclusao/sucesso' };

      const { handleWebhook } = require('../services/serasaPefinService');
      handleWebhook.mockResolvedValue({ processed: true });

      await simulateWebhook(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            processed: true,
            transactionId: 'test-uuid',
            eventType: 'inclusao/sucesso',
          }),
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('listTestDocuments', () => {
    it('deve retornar 403 em ambiente de produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await listTestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar lista de documentos em ambiente de desenvolvimento', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await listTestDocuments(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        data: {
          documentos: expect.any(Array),
          total: expect.any(Number),
          fonte: 'Massa de teste de homologação Serasa PEFIN',
        },
      });

      const response = res.json.mock.calls[0][0];
      expect(response.data.documentos.length).toBeGreaterThan(0);
      expect(response.data.documentos[0]).toHaveProperty('documento');
      expect(response.data.documentos[0]).toHaveProperty('descricao');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});

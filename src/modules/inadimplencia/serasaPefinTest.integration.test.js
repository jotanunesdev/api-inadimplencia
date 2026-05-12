const request = require('supertest');
const express = require('express');
const serasaPefinTestRoutes = require('./routes/serasaPefinTestRoutes');

describe('Serasa PEFIN Test Endpoints Integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/serasa-pefin/testes', serasaPefinTestRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /serasa-pefin/testes/auth', () => {
    it('deve retornar 403 em produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/serasa-pefin/testes/auth');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 503 quando não configurado em desenvolvimento', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/serasa-pefin/testes/auth');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Serasa PEFIN não configurado.',
      });

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('GET /serasa-pefin/testes/documentos', () => {
    it('deve retornar 403 em produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/serasa-pefin/testes/documentos');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar lista de documentos em desenvolvimento', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/serasa-pefin/testes/documentos');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          documentos: expect.any(Array),
          total: expect.any(Number),
          fonte: 'Massa de teste de homologação Serasa PEFIN',
        },
      });

      expect(response.body.data.documentos.length).toBeGreaterThan(0);
      expect(response.body.data.documentos[0]).toHaveProperty('documento');
      expect(response.body.data.documentos[0]).toHaveProperty('descricao');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('POST /serasa-pefin/testes/debt', () => {
    it('deve retornar 403 em produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/serasa-pefin/testes/debt')
        .send({ documento: '168.816.700-52' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando documento não fornecido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/serasa-pefin/testes/debt')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'DOCUMENTO é obrigatório para teste de envio.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando documento não autorizado', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/serasa-pefin/testes/debt')
        .send({ documento: '123.456.789-00' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Documento não autorizado para teste.',
        allowedDocuments: expect.any(Array),
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 503 quando não configurado', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/serasa-pefin/testes/debt')
        .send({ documento: '168.816.700-52' });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'Serasa PEFIN não configurado.',
      });

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('POST /serasa-pefin/testes/webhook/simular', () => {
    it('deve retornar 403 em produção', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({ transactionId: 'test-uuid', eventType: 'inclusao/sucesso' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Endpoint de teste bloqueado em produção.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando transactionId não fornecido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({ eventType: 'inclusao/sucesso' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'TRANSACTION_ID é obrigatório.' });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve retornar 400 quando eventType inválido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({ transactionId: 'test-uuid', eventType: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'EVENT_TYPE invalido.',
        allowedTypes: expect.any(Array),
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve processar webhook simulado com eventType válido', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock handleWebhook to return success
      const service = require('./services/serasaPefinService');
      jest.spyOn(service, 'handleWebhook').mockResolvedValue({ processed: true });

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({ transactionId: 'test-uuid', eventType: 'inclusao/sucesso' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          processed: true,
          transactionId: 'test-uuid',
          eventType: 'inclusao/sucesso',
        },
      });

      service.handleWebhook.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve processar webhook simulado com erro', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const service = require('./services/serasaPefinService');
      jest.spyOn(service, 'handleWebhook').mockResolvedValue({ processed: true });

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({
          transactionId: 'test-uuid',
          eventType: 'inclusao/erro',
          error: { message: 'Erro simulado', statusCode: 500 },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          processed: true,
          transactionId: 'test-uuid',
          eventType: 'inclusao/erro',
        },
      });

      service.handleWebhook.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('deve processar webhook simulado de baixa', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const service = require('./services/serasaPefinService');
      jest.spyOn(service, 'handleWebhook').mockResolvedValue({ processed: true });

      const response = await request(app)
        .post('/serasa-pefin/testes/webhook/simular')
        .send({ transactionId: 'test-uuid-baixa', eventType: 'baixa/sucesso' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: {
          processed: true,
          transactionId: 'test-uuid-baixa',
          eventType: 'baixa/sucesso',
        },
      });

      service.handleWebhook.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});

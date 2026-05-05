import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

function makeSimpleModule() {
  return {
    router: express.Router(),
    openapi: {
      openapi: '3.0.3',
      info: {
        version: '1.0.0',
      },
      tags: [],
      paths: {},
    },
  };
}

function makeGlpiModule() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return {
    router,
    openapi: {
      openapi: '3.0.3',
      info: {
        version: '1.0.0',
      },
      tags: [{ name: 'GLPI', description: 'Endpoints do modulo GLPI' }],
      paths: {
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'Health check do modulo GLPI',
            responses: {
              '200': { description: 'Sucesso' },
            },
          },
        },
        '/chamados': {
          get: {
            tags: ['Chamados'],
            summary: 'Lista chamados do GLPI',
            responses: {
              '200': { description: 'Sucesso' },
            },
          },
        },
        '/inventario': {
          get: {
            tags: ['Inventario'],
            summary: 'Lista inventario do GLPI',
            responses: {
              '200': { description: 'Sucesso' },
            },
          },
        },
        '/custos': {
          get: {
            tags: ['Custos'],
            summary: 'Lista custos do GLPI',
            responses: {
              '200': { description: 'Sucesso' },
            },
          },
        },
      },
      components: {
        schemas: {
          EnvelopeResposta: {},
          Chamado: {},
          InventarioItem: {},
          Custo: {},
          Erro: {},
        },
      },
    },
  };
}

vi.mock('../../modules/inadimplencia', () => ({
  createInadimplenciaModule: vi.fn(() => makeSimpleModule()),
}));

vi.mock('../../modules/treinamento', () => ({
  createTreinamentoModule: vi.fn(async () => makeSimpleModule()),
}));

vi.mock('../../modules/fluig', () => ({
  createFluigModule: vi.fn(() => makeSimpleModule()),
}));

vi.mock('../../modules/pm2', () => ({
  createPm2Module: vi.fn(() => ({
    ...makeSimpleModule(),
    attachRealtimeServer: vi.fn(),
  })),
}));

vi.mock('../../modules/m365', () => ({
  createM365Module: vi.fn(async () => makeSimpleModule()),
}));

vi.mock('../../modules/estoque-online', () => ({
  createEstoqueOnlineModule: vi.fn(async () => makeSimpleModule()),
}));

vi.mock('../../modules/glpi', () => ({
  createGlpiModule: vi.fn(() => makeGlpiModule()),
}));

vi.mock('../../modules/auth', () => ({
  createAuthModule: vi.fn(async () => makeSimpleModule()),
}));

vi.mock('../../modules/rm', () => ({
  createRmModule: vi.fn(async () => makeSimpleModule()),
}));

vi.mock('../../modules/entrada-nota-fiscal', () => ({
  createEntradaNotaFiscalModule: vi.fn(async () => makeSimpleModule()),
}));

async function loadCreateApp() {
  vi.resetModules();
  const module = await import('../../../app.js');
  return module.createApp;
}

describe('glpi/app wireup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expõe o GLPI no app principal e no swagger unificado', async () => {
    const createApp = await loadCreateApp();
    const app = await createApp({
      inadimplenciaModule: makeSimpleModule(),
      treinamentoModule: makeSimpleModule(),
      fluigModule: makeSimpleModule(),
      pm2Module: {
        ...makeSimpleModule(),
        attachRealtimeServer: vi.fn(),
      },
      m365Module: makeSimpleModule(),
      estoqueOnlineModule: makeSimpleModule(),
      glpiModule: makeGlpiModule(),
      authModule: makeSimpleModule(),
      rmModule: makeSimpleModule(),
      entradaNotaFiscalModule: makeSimpleModule(),
    });

    const healthResponse = await request(app).get('/glpi/health').expect(200);
    expect(healthResponse.body).toEqual({ status: 'ok' });

    const glpiOpenapiResponse = await request(app).get('/docs-json/glpi').expect(200);
    expect(glpiOpenapiResponse.body).toMatchObject({
      openapi: '3.0.3',
      info: {
        version: '1.0.0',
      },
    });
    expect(Object.keys(glpiOpenapiResponse.body.paths)).toEqual(
      expect.arrayContaining(['/health', '/chamados', '/inventario', '/custos'])
    );

    const unifiedResponse = await request(app).get('/docs-json').expect(200);
    expect(Object.keys(unifiedResponse.body.paths)).toEqual(
      expect.arrayContaining([
        '/glpi/health',
        '/glpi/chamados',
        '/glpi/inventario',
        '/glpi/custos',
      ])
    );
    expect(unifiedResponse.body.components).toBeTruthy();
    expect(unifiedResponse.body.components.schemas).toMatchObject({
      EnvelopeResposta: expect.any(Object),
      Chamado: expect.any(Object),
      InventarioItem: expect.any(Object),
      Custo: expect.any(Object),
      Erro: expect.any(Object),
    });
  }, 15000);
});

import express from 'express';
import { createRequire } from 'node:module';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GLPI_ENV_KEYS = [
  'GLPI_ENABLED',
  'GLPI_DB_HOST',
  'GLPI_DB_PORT',
  'GLPI_DB_USER',
  'GLPI_DB_PASSWORD',
  'GLPI_DB_NAME',
  'GLPI_CORS_ORIGIN',
  'GLPI_QUERY_TIMEOUT_MS',
];

const originalEnv = Object.fromEntries(
  GLPI_ENV_KEYS.map((key) => [key, process.env[key]])
);

const glpiTestState = vi.hoisted(() => {
  const state = {
    chamadosRows: [],
    inventarioRows: [],
    custosRows: [],
    chamadosPool: {
      query: vi.fn(async () => [[state.chamadosRows], []]),
    },
    inventarioPool: {
      query: vi.fn(async () => [[state.inventarioRows], []]),
    },
    custosPool: {
      query: vi.fn(async () => [[state.custosRows], []]),
    },
  };

  return state;
});

function applyEnv(overrides = {}) {
  const nextEnv = {
    GLPI_ENABLED: 'true',
    GLPI_DB_HOST: 'localhost',
    GLPI_DB_PORT: '3306',
    GLPI_DB_USER: 'glpi_readonly',
    GLPI_DB_PASSWORD: 'secret',
    GLPI_DB_NAME: 'glpi',
    GLPI_CORS_ORIGIN: 'https://portal.exemplo.local',
    GLPI_QUERY_TIMEOUT_MS: '30000',
    ...overrides,
  };

  GLPI_ENV_KEYS.forEach((key) => {
    if (nextEnv[key] === undefined || nextEnv[key] === null) {
      delete process.env[key];
      return;
    }

    process.env[key] = String(nextEnv[key]);
  });
}

function restoreEnv() {
  GLPI_ENV_KEYS.forEach((key) => {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });
}

async function loadCreateGlpiModule() {
  vi.resetModules();
  const require = createRequire(import.meta.url);
  const module = require('../index.js');
  return module.createGlpiModule;
}

async function createApp() {
  const require = createRequire(import.meta.url);
  const createGlpiModule = await loadCreateGlpiModule();
  const envModule = require('../config/env.js');
  const chamadosModel = require('../models/chamadosModel.js');
  const inventarioModel = require('../models/inventarioModel.js');
  const custosModel = require('../models/custosModel.js');
  const ensureConfigured = require('../middlewares/ensureConfigured.js');
  const env = envModule.buildEnv(process.env);

  chamadosModel.setPoolProvider(async () => glpiTestState.chamadosPool);
  inventarioModel.setPoolProvider(async () => glpiTestState.inventarioPool);
  custosModel.setPoolProvider(async () => glpiTestState.custosPool);
  ensureConfigured.setEnsureConfiguredDependencies({ env });

  const app = express();
  const glpiModule = createGlpiModule({ env });

  app.use('/glpi', glpiModule.router);

  return {
    app,
    glpiModule,
  };
}

describe('glpi/integration', () => {
  beforeEach(() => {
    applyEnv();
    glpiTestState.chamadosRows = [];
    glpiTestState.inventarioRows = [];
    glpiTestState.custosRows = [];
    glpiTestState.chamadosPool.query.mockClear();
    glpiTestState.inventarioPool.query.mockClear();
    glpiTestState.custosPool.query.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('retorna 200 nos tres endpoints e expõe o openapi da fábrica', async () => {
    const { app, glpiModule } = await createApp();

    expect(glpiModule.openapi).toMatchObject({
      openapi: '3.0.3',
    });

    glpiTestState.chamadosRows = [{ id: 11, titulo: 'Chamado GLPI' }];
    let response = await request(app).get('/glpi/chamados').expect(200);

    expect(response.body).toEqual({
      data: [{ id: 11, titulo: 'Chamado GLPI' }],
      count: 1,
      filters: {},
    });

    glpiTestState.inventarioRows = [{ id: 22, ativo: 'Notebook' }];
    response = await request(app).get('/glpi/inventario').expect(200);

    expect(response.body).toEqual({
      data: [{ id: 22, ativo: 'Notebook' }],
      count: 1,
      filters: {},
    });

    glpiTestState.custosRows = [{ id: 33, grupo: 'DW' }];
    response = await request(app).get('/glpi/custos').expect(200);

    expect(response.body).toEqual({
      data: [{ id: 33, grupo: 'DW' }],
      count: 1,
      filters: {},
    });
  });

  it('retorna 400 para filtro de data invalido', async () => {
    const { app } = await createApp();

    const response = await request(app)
      .get('/glpi/chamados')
      .query({ data_inicio: '2025-02-10', data_fim: '2025-02-01' })
      .expect(400);

    expect(response.body).toEqual({
      error: 'data_inicio nao pode ser maior que data_fim.',
      code: 'INVALID_FILTER',
    });
  });

  it('retorna 503 quando o modulo esta desabilitado', async () => {
    applyEnv({ GLPI_ENABLED: 'false' });

    const { app } = await createApp();

    const response = await request(app).get('/glpi/custos').expect(503);

    expect(response.body).toEqual({
      error: 'Modulo GLPI desabilitado.',
      code: 'GLPI_DISABLED',
    });
  });

  it('bloqueia origem nao permitida com 403 FORBIDDEN_ORIGIN', async () => {
    const { app } = await createApp();

    const response = await request(app)
      .get('/glpi/inventario')
      .set('Origin', 'https://evil.example')
      .expect(403);

    expect(response.body).toEqual({
      error: 'Origem nao permitida.',
      code: 'FORBIDDEN_ORIGIN',
    });
  });
});

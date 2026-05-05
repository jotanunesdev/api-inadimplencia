import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => {
  const config = vi.fn();

  return {
    default: { config },
    config,
  };
});

async function loadEnv() {
  vi.resetModules();

  const module = await import('../config/env.js');

  return {
    buildEnv: module.buildEnv,
    restore() {},
  };
}

describe('glpi/config/env', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('carrega a configuração completa e normaliza CORS_ORIGIN em array minúsculo', async () => {
    const { buildEnv } = await loadEnv();

    const env = buildEnv({
      GLPI_ENABLED: 'false',
      GLPI_DB_HOST: 'localhost',
      GLPI_DB_PORT: '3310',
      GLPI_DB_USER: 'glpi_readonly',
      GLPI_DB_PASSWORD: 'secret',
      GLPI_DB_NAME: 'glpi',
      GLPI_QUERY_TIMEOUT_MS: '45000',
      GLPI_CORS_ORIGIN: 'HTTPS://Portal.Exemplo.Local, https://BI.Exemplo.Local ',
    });

    expect(env).toMatchObject({
      DB_HOST: 'localhost',
      DB_PORT: 3310,
      DB_USER: 'glpi_readonly',
      DB_PASSWORD: 'secret',
      DB_NAME: 'glpi',
      CORS_ORIGIN: 'HTTPS://Portal.Exemplo.Local, https://BI.Exemplo.Local ',
      CORS_ORIGINS: ['https://portal.exemplo.local', 'https://bi.exemplo.local'],
      CORS_ALLOW_ALL: false,
      QUERY_TIMEOUT_MS: 45000,
      ENABLED: false,
      missingRequired: [],
      isConfigured: true,
    });
  });

  it('marca GLPI como não configurado quando falta GLPI_DB_HOST', async () => {
    const { buildEnv } = await loadEnv();

    const env = buildEnv({
      GLPI_DB_USER: 'glpi_readonly',
      GLPI_DB_PASSWORD: 'secret',
      GLPI_DB_NAME: 'glpi',
    });

    expect(env.isConfigured).toBe(false);
    expect(env.missingRequired).toContain('GLPI_DB_HOST');
  });

  it('marca GLPI como não configurado quando falta GLPI_DB_PASSWORD', async () => {
    const { buildEnv } = await loadEnv();

    const env = buildEnv({
      GLPI_DB_HOST: 'localhost',
      GLPI_DB_USER: 'glpi_readonly',
      GLPI_DB_NAME: 'glpi',
    });

    expect(env.isConfigured).toBe(false);
    expect(env.missingRequired).toContain('GLPI_DB_PASSWORD');
  });
});

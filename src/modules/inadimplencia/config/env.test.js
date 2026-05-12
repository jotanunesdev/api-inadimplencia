import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => {
  const config = vi.fn();

  return {
    default: { config },
    config,
  };
});

async function loadEnvModule() {
  vi.resetModules();
  return import('./env.js');
}

describe('inadimplencia/config/env - Serasa PEFIN', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('carrega configuracao Serasa completa com nomes sem prefixo INAD_', async () => {
    const { buildEnv } = await loadEnvModule();

    const env = buildEnv({
      INAD_SERASA_ENVIRONMENT: 'uat',
      INAD_SERASA_AUTH_URL: 'https://serasa.example/auth',
      INAD_SERASA_DEBT_URL: 'https://serasa.example/debt',
      INAD_SERASA_GUARANTOR_URL: 'https://serasa.example/guarantor',
      INAD_SERASA_CLIENT_ID: 'client-id',
      INAD_SERASA_CLIENT_SECRET: 'client-secret',
      INAD_SERASA_CREDITOR_DOCUMENT: '12345678000190',
      INAD_SERASA_AREA_INFORMANTE: '0001',
      INAD_SERASA_HTTP_TIMEOUT_MS: '25000',
      INAD_SERASA_UAT_ENABLED: 'true',
    });

    expect(env).toMatchObject({
      SERASA_ENVIRONMENT: 'uat',
      SERASA_AUTH_URL: 'https://serasa.example/auth',
      SERASA_DEBT_URL: 'https://serasa.example/debt',
      SERASA_GUARANTOR_URL: 'https://serasa.example/guarantor',
      SERASA_CLIENT_ID: 'client-id',
      SERASA_CLIENT_SECRET: 'client-secret',
      SERASA_CREDITOR_DOCUMENT: '12345678000190',
      SERASA_AREA_INFORMANTE: '0001',
      SERASA_HTTP_TIMEOUT_MS: 25000,
      SERASA_UAT_ENABLED: true,
      SERASA_IS_CONFIGURED: true,
      SERASA_MISSING_REQUIRED: [],
    });
    expect(env.INAD_SERASA_CLIENT_SECRET).toBeUndefined();
  });

  it('mantem credenciais, documento do credor e area informante como obrigatorios', async () => {
    const { buildEnv } = await loadEnvModule();

    const env = buildEnv({
      INAD_SERASA_ENVIRONMENT: 'uat',
    });

    expect(env.SERASA_IS_CONFIGURED).toBe(false);
    expect(env.SERASA_MISSING_REQUIRED).toEqual([
      'INAD_SERASA_CLIENT_ID',
      'INAD_SERASA_CLIENT_SECRET',
      'INAD_SERASA_CREDITOR_DOCUMENT',
      'INAD_SERASA_AREA_INFORMANTE',
    ]);
  });

  it('aplica defaults UAT apenas para URLs publicas da tech spec', async () => {
    const { buildEnv } = await loadEnvModule();

    const env = buildEnv({
      INAD_SERASA_ENVIRONMENT: 'uat',
      INAD_SERASA_CLIENT_ID: 'client-id',
      INAD_SERASA_CLIENT_SECRET: 'client-secret',
      INAD_SERASA_CREDITOR_DOCUMENT: '12345678000190',
      INAD_SERASA_AREA_INFORMANTE: '0001',
    });

    expect(env.SERASA_AUTH_URL).toBe(
      'https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login'
    );
    expect(env.SERASA_DEBT_URL).toBe('https://api.serasa.dev/collection/debt/');
    expect(env.SERASA_GUARANTOR_URL).toBe(
      'https://api.serasa.dev/collection/debt/guarantor'
    );
    expect(env.SERASA_IS_CONFIGURED).toBe(true);
  });

  it('exige URLs explicitas quando defaults UAT estao desabilitados', async () => {
    const { buildEnv } = await loadEnvModule();

    const env = buildEnv({
      INAD_SERASA_ENVIRONMENT: 'production',
      INAD_SERASA_CLIENT_ID: 'client-id',
      INAD_SERASA_CLIENT_SECRET: 'client-secret',
      INAD_SERASA_CREDITOR_DOCUMENT: '12345678000190',
      INAD_SERASA_AREA_INFORMANTE: '0001',
    });

    expect(env.SERASA_USE_UAT_DEFAULTS).toBe(false);
    expect(env.SERASA_MISSING_REQUIRED).toEqual([
      'INAD_SERASA_AUTH_URL',
      'INAD_SERASA_DEBT_URL',
      'INAD_SERASA_GUARANTOR_URL',
    ]);
    expect(env.SERASA_IS_CONFIGURED).toBe(false);
  });
});

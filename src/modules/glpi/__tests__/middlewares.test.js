import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadMiddlewares() {
  vi.resetModules();
  return await import('../middlewares/ensureConfigured.js');
}

async function loadErrorHandler() {
  vi.resetModules();
  return await import('../middlewares/errorHandler.js');
}

describe('glpi/middlewares', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('ensureConfigured retorna 503 quando modulo esta desconfigurado', async () => {
    const { ensureConfigured, setEnsureConfiguredDependencies } = await loadMiddlewares();

    setEnsureConfiguredDependencies({
      env: {
        ENABLED: true,
        isConfigured: false,
        missingRequired: ['GLPI_DB_HOST'],
      },
    });

    const req = {};
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    ensureConfigured(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Modulo GLPI nao configurado.',
      code: 'GLPI_NOT_CONFIGURED',
      missingRequired: ['GLPI_DB_HOST'],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('ensureConfigured retorna 503 quando o modulo esta desabilitado', async () => {
    const { ensureConfigured, setEnsureConfiguredDependencies } = await loadMiddlewares();

    setEnsureConfiguredDependencies({
      env: {
        ENABLED: false,
        isConfigured: true,
        missingRequired: [],
      },
    });

    const req = {};
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    ensureConfigured(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Modulo GLPI desabilitado.',
      code: 'GLPI_DISABLED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('ensureConfigured chama next quando o modulo esta pronto', async () => {
    const { ensureConfigured, setEnsureConfiguredDependencies } = await loadMiddlewares();

    setEnsureConfiguredDependencies({
      env: {
        ENABLED: true,
        isConfigured: true,
        missingRequired: [],
      },
    });

    const next = vi.fn();

    ensureConfigured({}, { status: vi.fn(), json: vi.fn() }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('errorHandler mapeia ECONNREFUSED para 503 DB_UNAVAILABLE', async () => {
    const { errorHandler } = await loadErrorHandler();

    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
      code: 'ECONNREFUSED',
    });
    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Banco GLPI indisponivel.',
      code: 'DB_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

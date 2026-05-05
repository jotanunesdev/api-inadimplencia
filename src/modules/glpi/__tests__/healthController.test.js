import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadController() {
  vi.resetModules();
  return await import('../controllers/healthController.js');
}

describe('glpi/controllers/healthController', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('retorna health ok quando configurado, habilitado e com banco acessivel', async () => {
    const { getHealth, setHealthDependencies } = await loadController();

    setHealthDependencies({
      env: {
        ENABLED: true,
        isConfigured: true,
        missingRequired: [],
      },
      pingPool: vi.fn().mockResolvedValue(true),
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getHealth({}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        configured: true,
        enabled: true,
        missingRequired: [],
        dbReachable: true,
      })
    );
  });

  it('retorna health degradado quando o banco nao responde', async () => {
    const { getHealth, setHealthDependencies } = await loadController();

    setHealthDependencies({
      env: {
        ENABLED: true,
        isConfigured: true,
        missingRequired: ['GLPI_DB_HOST'],
      },
      pingPool: vi.fn().mockResolvedValue(false),
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getHealth({}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        configured: true,
        enabled: true,
        missingRequired: ['GLPI_DB_HOST'],
        dbReachable: false,
      })
    );
  });
});

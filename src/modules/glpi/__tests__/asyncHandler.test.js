import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAsyncHandler() {
  vi.resetModules();
  return await import('../utils/asyncHandler.js');
}

describe('glpi/utils/asyncHandler', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('executa handlers assicronos resolvidos', async () => {
    const { asyncHandler } = await loadAsyncHandler();
    const req = {};
    const res = { json: vi.fn() };
    const next = vi.fn();
    const handler = asyncHandler(async (_req, response) => {
      response.json({ ok: true });
    });

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('encaminha rejeicoes async para next', async () => {
    const { asyncHandler } = await loadAsyncHandler();
    const error = new Error('falha async');
    const req = {};
    const res = {};
    const next = vi.fn();
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('encaminha erros sincronos para next', async () => {
    const { asyncHandler } = await loadAsyncHandler();
    const error = new Error('falha sync');
    const req = {};
    const res = {};
    const next = vi.fn();
    const handler = asyncHandler(() => {
      throw error;
    });

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadController() {
  vi.resetModules();
  return await import('../controllers/custosController.js');
}

describe('glpi/controllers/custosController', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('retorna data, count e filters com payload normalizado', async () => {
    const { getCustos, setCustosDependencies } = await loadController();
    const parseCustosFilters = vi.fn().mockReturnValue({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
      grupo: 'DW',
    });
    const listCustos = vi.fn().mockResolvedValue([
      { id: 1, titulo: 'Primeiro custo' },
      { id: 2, titulo: 'Segundo custo' },
    ]);

    setCustosDependencies({
      parseCustosFilters,
      listCustos,
    });

    const req = { query: { data_inicio: '2025-01-01', data_fim: '2025-01-31', grupo: 'DW' } };
    const res = {
      json: vi.fn(),
    };
    const next = vi.fn();

    await getCustos(req, res, next);

    expect(parseCustosFilters).toHaveBeenCalledWith(req.query);
    expect(listCustos).toHaveBeenCalledWith({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
      grupo: 'DW',
    });
    expect(res.json).toHaveBeenCalledWith({
      data: [
        { id: 1, titulo: 'Primeiro custo' },
        { id: 2, titulo: 'Segundo custo' },
      ],
      count: 2,
      filters: {
        dataInicio: '2025-01-01',
        dataFim: '2025-01-31',
        grupo: 'DW',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga erro de filtro inválido como resposta 400', async () => {
    const { getCustos, setCustosDependencies } = await loadController();
    const filterError = Object.assign(new Error('grupo nao pode conter os caracteres % ou _.'), {
      statusCode: 400,
      code: 'INVALID_FILTER',
    });

    setCustosDependencies({
      parseCustosFilters: () => {
        throw filterError;
      },
      listCustos: vi.fn(),
    });

    const req = { query: { grupo: 'DW%' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await getCustos(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'grupo nao pode conter os caracteres % ou _.',
      code: 'INVALID_FILTER',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga erro estruturado do model como resposta apropriada', async () => {
    const { getCustos, setCustosDependencies } = await loadController();
    const error = Object.assign(new Error('Banco GLPI indisponivel.'), {
      statusCode: 503,
      code: 'DB_UNAVAILABLE',
    });

    setCustosDependencies({
      parseCustosFilters: vi.fn().mockReturnValue({}),
      listCustos: vi.fn().mockRejectedValue(error),
    });

    const req = { query: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await getCustos(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Banco GLPI indisponivel.',
      code: 'DB_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('encaminha erros inesperados para next', async () => {
    const { getCustos, setCustosDependencies } = await loadController();
    const error = new Error('falha inesperada');

    setCustosDependencies({
      parseCustosFilters: vi.fn().mockReturnValue({}),
      listCustos: vi.fn().mockRejectedValue(error),
    });

    const req = { query: {} };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await getCustos(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

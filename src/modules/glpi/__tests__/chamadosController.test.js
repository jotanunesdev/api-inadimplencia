import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadController() {
  vi.resetModules();
  return await import('../controllers/chamadosController.js');
}

describe('glpi/controllers/chamadosController', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('retorna data, count e filters com payload normalizado', async () => {
    const { getChamados, setChamadosDependencies } = await loadController();
    const parseChamadosFilters = vi.fn().mockReturnValue({
      dataInicio: '2025-01-01',
      status: ['Novo', 'Fechado'],
    });
    const listChamados = vi.fn().mockResolvedValue([
      { id: 1, titulo: 'Primeiro' },
      { id: 2, titulo: 'Segundo' },
    ]);

    setChamadosDependencies({
      parseChamadosFilters,
      listChamados,
    });

    const req = { query: { data_inicio: '2025-01-01' } };
    const res = {
      json: vi.fn(),
    };
    const next = vi.fn();

    await getChamados(req, res, next);

    expect(parseChamadosFilters).toHaveBeenCalledWith(req.query);
    expect(listChamados).toHaveBeenCalledWith({
      dataInicio: '2025-01-01',
      status: ['Novo', 'Fechado'],
    });
    expect(res.json).toHaveBeenCalledWith({
      data: [
        { id: 1, titulo: 'Primeiro' },
        { id: 2, titulo: 'Segundo' },
      ],
      count: 2,
      filters: {
        dataInicio: '2025-01-01',
        status: ['Novo', 'Fechado'],
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga erro de filtro inválido como resposta 400', async () => {
    const { getChamados, setChamadosDependencies } = await loadController();
    const filterError = Object.assign(new Error('data invalida'), {
      statusCode: 400,
      code: 'INVALID_FILTER',
    });

    setChamadosDependencies({
      parseChamadosFilters: () => {
        throw filterError;
      },
      listChamados: vi.fn(),
    });

    const req = { query: { data_inicio: 'invalida' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await getChamados(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'data invalida',
      code: 'INVALID_FILTER',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('encaminha erros inesperados para next', async () => {
    const { getChamados, setChamadosDependencies } = await loadController();
    const error = new Error('falha inesperada');

    setChamadosDependencies({
      parseChamadosFilters: vi.fn().mockReturnValue({}),
      listChamados: vi.fn().mockRejectedValue(error),
    });

    const req = { query: {} };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await getChamados(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

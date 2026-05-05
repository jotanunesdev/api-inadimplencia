import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadController() {
  vi.resetModules();
  return await import('../controllers/inventarioController.js');
}

describe('glpi/controllers/inventarioController', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('retorna data, count e filters com payload normalizado', async () => {
    const { getInventario, setInventarioDependencies } = await loadController();
    const parseInventarioFilters = vi.fn().mockReturnValue({
      dataInicio: '2024-01-01',
      tipoOrigem: 'computer',
    });
    const listInventario = vi.fn().mockResolvedValue([
      { id: 1, ativo: 'Notebook' },
      { id: 2, ativo: 'Impressora' },
    ]);

    setInventarioDependencies({
      parseInventarioFilters,
      listInventario,
    });

    const req = { query: { data_inicio: '2024-01-01', tipo_origem: 'computer' } };
    const res = {
      json: vi.fn(),
    };
    const next = vi.fn();

    await getInventario(req, res, next);

    expect(parseInventarioFilters).toHaveBeenCalledWith(req.query);
    expect(listInventario).toHaveBeenCalledWith({
      dataInicio: '2024-01-01',
      tipoOrigem: 'computer',
    });
    expect(res.json).toHaveBeenCalledWith({
      data: [
        { id: 1, ativo: 'Notebook' },
        { id: 2, ativo: 'Impressora' },
      ],
      count: 2,
      filters: {
        dataInicio: '2024-01-01',
        tipoOrigem: 'computer',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga erro de filtro inválido como resposta 400', async () => {
    const { getInventario, setInventarioDependencies } = await loadController();
    const filterError = Object.assign(new Error('tipo_origem invalido.'), {
      statusCode: 400,
      code: 'INVALID_FILTER',
    });

    setInventarioDependencies({
      parseInventarioFilters: () => {
        throw filterError;
      },
      listInventario: vi.fn(),
    });

    const req = { query: { tipo_origem: 'invalido' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await getInventario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tipo_origem invalido.',
      code: 'INVALID_FILTER',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga erro estruturado do model como resposta apropriada', async () => {
    const { getInventario, setInventarioDependencies } = await loadController();
    const error = Object.assign(new Error('Banco GLPI indisponivel.'), {
      statusCode: 503,
      code: 'DB_UNAVAILABLE',
    });

    setInventarioDependencies({
      parseInventarioFilters: vi.fn().mockReturnValue({}),
      listInventario: vi.fn().mockRejectedValue(error),
    });

    const req = { query: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await getInventario(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Banco GLPI indisponivel.',
      code: 'DB_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('encaminha erros inesperados para next', async () => {
    const { getInventario, setInventarioDependencies } = await loadController();
    const error = new Error('falha inesperada');

    setInventarioDependencies({
      parseInventarioFilters: vi.fn().mockReturnValue({}),
      listInventario: vi.fn().mockRejectedValue(error),
    });

    const req = { query: {} };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await getInventario(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModel({ rows = [], reject = null, timeout = 12345 } = {}) {
  vi.resetModules();

  const module = await import('../models/custosModel.js');
  const query = vi.fn();

  if (reject) {
    query.mockRejectedValue(reject);
  } else {
    query.mockResolvedValue([[rows], []]);
  }

  module.setPoolProvider(async () => ({
    query,
  }));
  module.setQueryTimeoutMs(timeout);

  return {
    ...module,
    query,
  };
}

describe('glpi/models/custosModel', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('monta a SQL base sem filtros opcionais', async () => {
    const { buildCustosSql } = await loadModel();

    const { sql, values } = buildCustosSql({});

    expect(values).toEqual([]);
    expect(sql).toContain('FROM (');
    expect(sql).toContain('GT.begin_date AS data_atendimento');
    expect(sql).toContain('((GT.actiontime / 3600) * GT.cost_time) + GT.cost_fixed AS custo_total');
    expect(sql).toContain('INNER JOIN glpi.glpi_groups_tickets GPT');
    expect(sql).toContain('INNER JOIN glpi.glpi_groups GPO');
    expect(sql).toContain('GPO.name LIKE');
    expect(sql).toContain('BASE.custo_total <> 0');
    expect(sql).toContain('ORDER BY BASE.data_atendimento DESC, BASE.id DESC');
    expect(sql).not.toContain('BASE.data_atendimento >= ?');
    expect(sql).not.toContain('BASE.data_atendimento < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(sql).not.toContain('BASE.grupo LIKE CONCAT');
  });

  it('aplica periodo e grupo na query externa sem interpolar valores', async () => {
    const { buildCustosSql } = await loadModel();

    const { sql, values } = buildCustosSql({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
      grupo: 'DW',
    });

    expect(sql).toContain('BASE.data_atendimento >= ?');
    expect(sql).toContain('BASE.data_atendimento < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(sql).toContain('BASE.grupo LIKE CONCAT');
    expect(values).toEqual(['2025-01-01', '2025-01-31', 'DW']);
  });

  it('executa a query com timeout configurado', async () => {
    const { listCustos, query } = await loadModel({
      rows: [{ id: 1, titulo: 'Servico' }],
      timeout: 45000,
    });

    const rows = await listCustos({
      dataInicio: '2025-01-01',
      grupo: 'DW',
    });

    expect(rows).toEqual([{ id: 1, titulo: 'Servico' }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatchObject({
      sql: expect.stringContaining('USE glpi;'),
      timeout: 45000,
      values: ['2025-01-01', 'DW'],
    });
    expect(query.mock.calls[0][0].sql).toContain('SELECT *');
    expect(query.mock.calls[0][0].sql).toContain('FROM (');
    expect(query.mock.calls[0][0].sql).toContain('GT.begin_date AS data_atendimento');
    expect(query.mock.calls[0][0].sql).toContain(
      '((GT.actiontime / 3600) * GT.cost_time) + GT.cost_fixed AS custo_total'
    );
  });

  it('mapeia erro do mysql para AppError 503', async () => {
    const mysqlError = Object.assign(new Error('connect refused'), {
      code: 'ECONNREFUSED',
    });
    const { listCustos } = await loadModel({ reject: mysqlError });

    await expect(listCustos({})).rejects.toMatchObject({
      statusCode: 503,
      code: 'DB_UNAVAILABLE',
      message: 'Banco GLPI indisponivel.',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModel({ rows = [], reject = null, timeout = 12345 } = {}) {
  vi.resetModules();

  const module = await import('../models/inventarioModel.js');
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

describe('glpi/models/inventarioModel', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('monta UNION ALL das 3 fontes sem tipoOrigem', async () => {
    const { buildInventarioSql } = await loadModel();

    const { sql, values } = buildInventarioSql({});

    expect(values).toEqual([]);
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('glpi.glpi_computers gc');
    expect(sql).toContain('glpi.glpi_networkequipments gn');
    expect(sql).toContain('glpi.glpi_lines gline');
    expect(sql).toContain("'Computer' AS origem");
    expect(sql).toContain("'NetworkEquipment' AS origem");
    expect(sql).toContain("'Line' AS origem");
  });

  it('aplica periodo em todas as fontes quando nao ha tipoOrigem', async () => {
    const { buildInventarioSql } = await loadModel();

    const { sql, values } = buildInventarioSql({
      dataInicio: '2024-01-01',
      dataFim: '2024-01-31',
    });

    expect(sql).toContain('inventory.date_creation >= ?');
    expect(sql).toContain('inventory.date_creation < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(sql).toContain('WHERE 1=1');
    expect(values).toEqual(['2024-01-01', '2024-01-31']);
  });

  it('aplica tipoOrigem como filtro externo sobre o inventario unificado', async () => {
    const { buildInventarioSql } = await loadModel();

    const { sql, values } = buildInventarioSql({
      tipoOrigem: 'network',
      dataInicio: '2024-01-01',
    });

    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('inventory.origem = ?');
    expect(sql).toContain('glpi.glpi_networkequipments gn');
    expect(sql).toContain('glpi.glpi_computers gc');
    expect(sql).toContain('glpi.glpi_lines gline');
    expect(values).toEqual(['2024-01-01', 'NetworkEquipment']);
  });

  it('executa a query com timeout configurado', async () => {
    const { listInventario, query } = await loadModel({
      rows: [{ id: 1, ativo: 'Notebook' }],
      timeout: 45000,
    });

    const rows = await listInventario({
      tipoOrigem: 'computer',
      dataInicio: '2024-01-01',
    });

    expect(rows).toEqual([{ id: 1, ativo: 'Notebook' }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatchObject({
      sql: expect.stringContaining('USE glpi;'),
      timeout: 45000,
      values: ['2024-01-01', 'Computer'],
    });
    expect(query.mock.calls[0][0].sql).toContain('glpi.glpi_computers gc');
    expect(query.mock.calls[0][0].sql).toContain('UNION ALL');
  });

  it('mapeia erro do mysql para AppError 503', async () => {
    const mysqlError = Object.assign(new Error('connect refused'), {
      code: 'ECONNREFUSED',
    });
    const { listInventario } = await loadModel({ reject: mysqlError });

    await expect(listInventario({})).rejects.toMatchObject({
      statusCode: 503,
      code: 'DB_UNAVAILABLE',
      message: 'Banco GLPI indisponivel.',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModel({ rows = [], reject = null, timeout = 12345 } = {}) {
  vi.resetModules();

  const module = await import('../models/chamadosModel.js');
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

describe('glpi/models/chamadosModel', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('monta a SQL base sem filtros opcionais', async () => {
    const { buildChamadosSql } = await loadModel();

    const { sql, values } = buildChamadosSql({});

    expect(values).toEqual([]);
    expect(sql).toContain('ticket_jnc.id');
    expect(sql).toContain('ticket_jnc.data_abertura');
    expect(sql).toContain("WHERE glpi_users.name NOT LIKE ('priscilla.ribeiro')");
    expect(sql).toContain("AND glpi_users.name NOT LIKE ('fabio.machado')");
    expect(sql).toContain('ORDER BY ticket_jnc.id');
    expect(sql).not.toContain('ticket_jnc.data_abertura >= ?');
    expect(sql).not.toContain('ticket_jnc.data_abertura < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(sql).not.toContain('ticket_jnc.status IN (?)');
    expect(sql).not.toContain('ticket_jnc.tipo = ?');
  });

  it('aplica apenas o filtro de período', async () => {
    const { buildChamadosSql } = await loadModel();

    const { sql, values } = buildChamadosSql({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
    });

    expect(sql).toContain('ticket_jnc.data_abertura >= ?');
    expect(sql).toContain('ticket_jnc.data_abertura < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(values).toEqual(['2025-01-01', '2025-01-31']);
  });

  it('aplica apenas a lista de status', async () => {
    const { buildChamadosSql } = await loadModel();

    const { sql, values } = buildChamadosSql({
      status: ['Novo', 'Atribuido', 'Fechado'],
    });

    expect(sql).toContain('ticket_jnc.status IN (?, ?, ?)');
    expect(values).toEqual([1, 2, 6]);
  });

  it('combina periodo, status e tipo sem interpolar valores', async () => {
    const { buildChamadosSql } = await loadModel();

    const { sql, values } = buildChamadosSql({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
      status: ['Novo', 'Fechado'],
      tipo: 'Incidente',
    });

    expect(sql).toContain('ticket_jnc.data_abertura >= ?');
    expect(sql).toContain('ticket_jnc.data_abertura < DATE_ADD(?, INTERVAL 1 DAY)');
    expect(sql).toContain('ticket_jnc.status IN (?, ?)');
    expect(sql).toContain('ticket_jnc.tipo = ?');
    expect(values).toEqual(['2025-01-01', '2025-01-31', 1, 6, 'Incidente']);
  });

  it('executa a query com timeout configurado', async () => {
    const { listChamados, query } = await loadModel({
      rows: [{ id: 1, titulo: 'Chamado teste' }],
      timeout: 45000,
    });

    const rows = await listChamados({
      dataInicio: '2025-01-01',
    });

    expect(rows).toEqual([{ id: 1, titulo: 'Chamado teste' }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatchObject({
      sql: expect.stringContaining('USE glpi;'),
      timeout: 45000,
      values: ['2025-01-01'],
    });
    expect(query.mock.calls[0][0].sql).toContain('ticket_jnc.id');
    expect(query.mock.calls[0][0].sql).toContain('ORDER BY ticket_jnc.id');
  });

  it('mapeia erro do mysql para AppError 503', async () => {
    const mysqlError = Object.assign(new Error('connect refused'), {
      code: 'ECONNREFUSED',
    });
    const { listChamados } = await loadModel({ reject: mysqlError });

    await expect(listChamados({})).rejects.toMatchObject({
      statusCode: 503,
      code: 'DB_UNAVAILABLE',
      message: 'Banco GLPI indisponivel.',
    });
  });
});

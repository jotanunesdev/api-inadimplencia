import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadParseFilters() {
  vi.resetModules();
  return await import('../utils/parseFilters.js');
}

async function expectInvalidFilter(fn) {
  try {
    fn();
    throw new Error('expected function to throw');
  } catch (error) {
    expect(error).toMatchObject({
      statusCode: 400,
      code: 'INVALID_FILTER',
    });
  }
}

describe('glpi/utils/parseFilters', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('retorna objeto vazio quando nao ha filtros nos chamados', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    expect(parseChamadosFilters({})).toEqual({});
  });

  it('retorna objeto vazio quando nao ha filtros no inventario', async () => {
    const { parseInventarioFilters } = await loadParseFilters();

    expect(parseInventarioFilters({})).toEqual({});
  });

  it('retorna objeto vazio quando nao ha filtros nos custos', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    expect(parseCustosFilters({})).toEqual({});
  });

  it('aceita data_inicio valida nos chamados', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    expect(parseChamadosFilters({ data_inicio: '2025-01-01' })).toEqual({
      dataInicio: '2025-01-01',
    });
  });

  it('aceita intervalo valido de datas nos chamados', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    expect(
      parseChamadosFilters({ data_inicio: '2025-01-01', data_fim: '2025-01-31' })
    ).toEqual({
      dataInicio: '2025-01-01',
      dataFim: '2025-01-31',
    });
  });

  it('rejeita data em formato invalido', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseChamadosFilters({ data_inicio: '2025/01/01' }));
  });

  it('rejeita intervalo invertido de datas', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    await expectInvalidFilter(() =>
      parseChamadosFilters({ data_inicio: '2025-02-01', data_fim: '2025-01-31' })
    );
  });

  it('aceita lista de status valida nos chamados', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    expect(
      parseChamadosFilters({ status: 'Novo, Atribuido,Fechado' })
    ).toEqual({
      status: ['Novo', 'Atribuido', 'Fechado'],
    });
  });

  it('rejeita status desconhecido', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseChamadosFilters({ status: 'Novo,Invalido' }));
  });

  it.each(['Incidente', 'Requisicao'])('aceita tipo valido %s nos chamados', async (tipo) => {
    const { parseChamadosFilters } = await loadParseFilters();

    expect(parseChamadosFilters({ tipo })).toEqual({ tipo });
  });

  it('rejeita tipo invalido nos chamados', async () => {
    const { parseChamadosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseChamadosFilters({ tipo: 'BUG' }));
  });

  it.each(['computer', 'network', 'line'])('aceita tipo_origem valido %s no inventario', async (tipoOrigem) => {
    const { parseInventarioFilters } = await loadParseFilters();

    expect(parseInventarioFilters({ tipo_origem: tipoOrigem })).toEqual({
      tipoOrigem,
    });
  });

  it('rejeita tipo_origem invalido no inventario', async () => {
    const { parseInventarioFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseInventarioFilters({ tipo_origem: 'computer1' }));
  });

  it('trima e aceita grupo valido nos custos', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    expect(parseCustosFilters({ grupo: '  DW suporte  ' })).toEqual({
      grupo: 'DW suporte',
    });
  });

  it('aceita grupo com tamanho maximo de 50 caracteres', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    expect(parseCustosFilters({ grupo: 'a'.repeat(50) })).toEqual({
      grupo: 'a'.repeat(50),
    });
  });

  it('rejeita grupo com curinga de porcentagem', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseCustosFilters({ grupo: 'DW%' }));
  });

  it('rejeita grupo com curinga de underscore', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseCustosFilters({ grupo: 'DW_01' }));
  });

  it('rejeita grupo acima do limite de tamanho', async () => {
    const { parseCustosFilters } = await loadParseFilters();

    await expectInvalidFilter(() => parseCustosFilters({ grupo: 'a'.repeat(51) }));
  });
});

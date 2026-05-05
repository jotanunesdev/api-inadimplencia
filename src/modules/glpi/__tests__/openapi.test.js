import { describe, expect, it } from 'vitest';

async function loadOpenapi() {
  const module = await import('../docs/openapi.js');
  return module.default ?? module;
}

describe('glpi/docs/openapi', () => {
  it('exporta um documento OpenAPI 3.0 valido com os contratos obrigatorios', async () => {
    const openapi = await loadOpenapi();

    expect(openapi).toBeTruthy();
    expect(openapi.openapi).toMatch(/^3\.0\.\d+$/);
    expect(openapi.info).toMatchObject({
      title: 'API GLPI - JotaNunes',
      version: '1.0.0',
    });
    expect(openapi.info.description).toContain('CORS');
    expect(openapi.info.description).toContain('JWT');

    expect(openapi.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: '/glpi' }),
        expect.objectContaining({ url: 'http://localhost:4010/glpi' }),
      ])
    );

    expect(openapi.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Health' }),
        expect.objectContaining({ name: 'Chamados' }),
        expect.objectContaining({ name: 'Inventario' }),
        expect.objectContaining({ name: 'Custos' }),
      ])
    );

    expect(openapi.paths).toBeTruthy();
    expect(Object.keys(openapi.paths).sort()).toEqual([
      '/chamados',
      '/custos',
      '/health',
      '/inventario',
    ]);

    for (const pathName of Object.keys(openapi.paths)) {
      const definition = openapi.paths[pathName];
      expect(Object.keys(definition).sort()).toEqual(['get']);
      expect(definition.post).toBeUndefined();
      expect(definition.put).toBeUndefined();
      expect(definition.patch).toBeUndefined();
      expect(definition.delete).toBeUndefined();
    }

    expect(openapi.components).toBeTruthy();
    expect(openapi.components.schemas).toMatchObject({
      Chamado: expect.any(Object),
      InventarioItem: expect.any(Object),
      Custo: expect.any(Object),
      EnvelopeResposta: expect.any(Object),
      Erro: expect.any(Object),
    });
    expect(openapi.components.responses).toMatchObject({
      BadRequest: expect.any(Object),
      Forbidden: expect.any(Object),
      ServiceUnavailable: expect.any(Object),
    });
    expect(openapi.components.securitySchemes).toEqual({});
  });
});

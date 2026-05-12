import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const swaggerSpec = require('./swagger.js');

describe('inadimplencia swagger', () => {
  it('documenta erros acionaveis nos endpoints Serasa PEFIN', () => {
    const serasaPaths = [
      '/serasa-pefin/vendas/{numVenda}/preview',
      '/serasa-pefin/vendas/{numVenda}/negativacoes',
      '/serasa-pefin/negativacoes/{id}',
      '/serasa-pefin/acompanhamento/{transactionId}',
      '/serasa-pefin/webhooks/inclusao/sucesso',
      '/serasa-pefin/webhooks/inclusao/erro',
      '/serasa-pefin/webhooks/avalista/sucesso',
      '/serasa-pefin/webhooks/avalista/erro',
    ];

    for (const path of serasaPaths) {
      for (const operation of Object.values(swaggerSpec.paths[path])) {
        expect(operation.responses['400']).toMatchObject({
          content: {
            'application/json': {
              schema: {
                properties: expect.objectContaining({
                  code: expect.any(Object),
                  missingFields: expect.any(Object),
                  blockedDocuments: expect.any(Object),
                }),
              },
              examples: expect.objectContaining({
                missingFields: expect.any(Object),
                blockedDocuments: expect.any(Object),
              }),
            },
          },
        });
      }
    }
  });
});

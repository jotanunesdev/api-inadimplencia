const jsonContent = {
  'application/json': {
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

const errorResponse = {
  description: 'Erro',
  content: jsonContent,
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API Estoque Online',
    version: '1.0.0',
    description:
      'Modulo para leitura da tabela dw.fat_estoque_online e CRUD do campo ESTOQUEMIN.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health', description: 'Health check do modulo Estoque Online' },
    { name: 'EstoqueOnline', description: 'Leitura e manutencao de estoque minimo' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check do modulo Estoque Online',
        responses: {
          '200': { description: 'Modulo configurado', content: jsonContent },
          '503': { description: 'Modulo sem configuracao ou coluna indisponivel', content: jsonContent },
        },
      },
    },
    '/items': {
      get: {
        tags: ['EstoqueOnline'],
        summary: 'Lista todos os registros de estoque, excluindo NOMEFANTASIA iniciada por (NAO USAR)',
        responses: {
          '200': { description: 'Registros listados com sucesso', content: jsonContent },
          '500': errorResponse,
        },
      },
    },
    '/items/{codigoPrd}/{codFilial}/{codLoc}': {
      get: {
        tags: ['EstoqueOnline'],
        summary: 'Busca um registro especifico da tabela de estoque',
        parameters: [
          { name: 'codigoPrd', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codFilial', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codLoc', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Registro encontrado', content: jsonContent },
          '404': errorResponse,
        },
      },
    },
    '/items/{codigoPrd}/{codFilial}/{codLoc}/estoque-min': {
      post: {
        tags: ['EstoqueOnline'],
        summary: 'Cria o valor de ESTOQUEMIN para um registro existente',
        parameters: [
          { name: 'codigoPrd', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codFilial', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codLoc', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  estoqueMin: {
                    type: 'number',
                    example: 150,
                  },
                },
                required: ['estoqueMin'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'ESTOQUEMIN criado com sucesso', content: jsonContent },
          '404': errorResponse,
          '409': errorResponse,
          '503': errorResponse,
        },
      },
      put: {
        tags: ['EstoqueOnline'],
        summary: 'Atualiza o valor de ESTOQUEMIN para um registro existente',
        parameters: [
          { name: 'codigoPrd', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codFilial', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codLoc', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  estoqueMin: {
                    type: 'number',
                    example: 150,
                  },
                },
                required: ['estoqueMin'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'ESTOQUEMIN atualizado com sucesso', content: jsonContent },
          '404': errorResponse,
          '503': errorResponse,
        },
      },
      delete: {
        tags: ['EstoqueOnline'],
        summary: 'Remove o valor de ESTOQUEMIN de um registro existente',
        parameters: [
          { name: 'codigoPrd', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codFilial', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'codLoc', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'ESTOQUEMIN removido com sucesso', content: jsonContent },
          '404': errorResponse,
          '503': errorResponse,
        },
      },
    },
  },
};

export default openapi;

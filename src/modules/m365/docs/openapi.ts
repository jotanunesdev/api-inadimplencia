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
    title: 'API Microsoft 365',
    version: '1.0.0',
    description:
      'Modulo para integrar com Microsoft Graph, listar usuarios da organizacao e obter fotos de perfil.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health', description: 'Health checks do modulo M365' },
    { name: 'M365', description: 'Usuarios e fotos do Microsoft 365 via Graph' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check do modulo M365',
        responses: {
          '200': {
            description: 'Modulo configurado',
            content: jsonContent,
          },
          '503': {
            description: 'Modulo sem configuracao obrigatoria',
            content: jsonContent,
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['M365'],
        summary: 'Lista todos os usuarios da organizacao Microsoft 365',
        parameters: [
          {
            name: 'includePhoto',
            in: 'query',
            required: false,
            schema: {
              type: 'boolean',
              default: false,
            },
            description: 'Quando true, busca a foto de cada usuario separadamente.',
          },
          {
            name: 'department',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Filtra usuarios por departamento.',
          },
          {
            name: 'accountEnabled',
            in: 'query',
            required: false,
            schema: {
              type: 'boolean',
            },
            description: 'Filtra usuarios ativos ou desativados.',
          },
        ],
        responses: {
          '200': {
            description: 'Usuarios listados com sucesso',
            content: jsonContent,
          },
          '400': errorResponse,
          '401': errorResponse,
          '403': errorResponse,
          '429': errorResponse,
          '500': errorResponse,
          '502': errorResponse,
          '504': errorResponse,
        },
      },
    },
    '/users/lookup/{username}': {
      get: {
        tags: ['M365'],
        summary: 'Busca um usuario do Microsoft 365 pelo username corporativo',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Username do usuario, sem dominio.',
          },
          {
            name: 'includePhoto',
            in: 'query',
            required: false,
            schema: {
              type: 'boolean',
              default: true,
            },
            description: 'Quando true, tenta anexar a foto do usuario na resposta.',
          },
        ],
        responses: {
          '200': {
            description: 'Usuario localizado com sucesso',
            content: jsonContent,
          },
          '400': errorResponse,
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '429': errorResponse,
          '500': errorResponse,
          '502': errorResponse,
          '504': errorResponse,
        },
      },
    },
    '/users/{id}/photo': {
      get: {
        tags: ['M365'],
        summary: 'Busca apenas a foto de perfil de um usuario',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID do usuario no Microsoft Graph.',
          },
        ],
        responses: {
          '200': {
            description: 'Foto obtida com sucesso',
            content: jsonContent,
          },
          '400': errorResponse,
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '429': errorResponse,
          '500': errorResponse,
          '502': errorResponse,
          '504': errorResponse,
        },
      },
    },
  },
};

export default openapi;

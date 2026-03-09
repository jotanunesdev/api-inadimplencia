const jsonResponse = {
  '200': {
    description: 'Sucesso',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  },
};

const pathParam = (name, description, example) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: {
    type: 'integer',
  },
  example,
});

module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'API PM2',
    version: '1.0.0',
    description: 'Documentacao do modulo de monitoramento e controle do PM2.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health', description: 'Monitoramento' },
    { name: 'PM2', description: 'Monitoramento e controle de instancias PM2' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check do modulo PM2',
        responses: jsonResponse,
      },
    },
    '/overview': {
      get: {
        tags: ['PM2'],
        summary: 'Resumo completo do servidor e das instancias PM2',
        responses: jsonResponse,
      },
    },
    '/ws-info': {
      get: {
        tags: ['PM2'],
        summary: 'Metadados do websocket de metricas em tempo real',
        description: 'Retorna o caminho do websocket, o evento emitido e o intervalo de atualizacao.',
        responses: jsonResponse,
      },
    },
    '/stream': {
      get: {
        tags: ['PM2'],
        summary: 'Stream SSE de metricas em tempo real',
        description:
          'Mantem a conexao aberta e envia eventos pm2.metrics continuamente como fallback para ambientes sem suporte a websocket.',
        responses: {
          '200': {
            description: 'Stream SSE iniciado com sucesso',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    '/processes': {
      get: {
        tags: ['PM2'],
        summary: 'Lista todas as instancias PM2 identificadas no servidor',
        responses: jsonResponse,
      },
    },
    '/processes/{id}': {
      get: {
        tags: ['PM2'],
        summary: 'Detalha uma instancia PM2',
        parameters: [pathParam('id', 'ID da instancia no PM2', 0)],
        responses: jsonResponse,
      },
      delete: {
        tags: ['PM2'],
        summary: 'Exclui uma instancia PM2',
        parameters: [pathParam('id', 'ID da instancia no PM2', 0)],
        responses: jsonResponse,
      },
    },
    '/processes/{id}/actions/update': {
      post: {
        tags: ['PM2'],
        summary: 'Atualiza uma instancia PM2 via git pull e restart',
        description:
          'Executa a sequencia: pm2 stop <id> && git pull origin master && pm2 restart <id> --update-env.',
        parameters: [pathParam('id', 'ID da instancia no PM2', 0)],
        responses: jsonResponse,
      },
    },
    '/processes/{id}/actions/reload': {
      post: {
        tags: ['PM2'],
        summary: 'Executa reload em uma instancia PM2',
        parameters: [pathParam('id', 'ID da instancia no PM2', 0)],
        responses: jsonResponse,
      },
    },
    '/processes/{id}/actions/pause': {
      post: {
        tags: ['PM2'],
        summary: 'Pausa uma instancia PM2',
        description: 'A pausa e executada via pm2 stop <id>.',
        parameters: [pathParam('id', 'ID da instancia no PM2', 0)],
        responses: jsonResponse,
      },
    },
  },
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API Fluig Audit',
    version: '1.0.0',
    description: 'Modulo para receber auditoria do Fluig e enviar e-mail por SMTP.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Fluig', description: 'Auditoria do Fluig' }],
  paths: {
    '/health': {
      get: {
        tags: ['Fluig'],
        summary: 'Health check do modulo Fluig',
        responses: {
          '200': {
            description: 'Sucesso',
          },
        },
      },
    },
    '/audit': {
      post: {
        tags: ['Fluig'],
        summary: 'Recebe auditoria do Fluig e envia e-mail',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subject', 'content', 'meta'],
                properties: {
                  subject: { type: 'string', example: 'ALERTA FLUIG: Documento publicado' },
                  content: {
                    type: 'string',
                    example: 'Ola Gustavo,\nHouve uma nova publicacao no Fluig.\n',
                  },
                  meta: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                      group: { type: 'string', example: 'TECNOLOGIA E INFORMACAO' },
                      userId: { type: 'string', example: 'wffluig' },
                      userName: { type: 'string', example: 'Nome' },
                      userEmail: { type: 'string', example: 'email@dominio' },
                      docId: { type: 'string', example: '123' },
                      docVersion: { type: 'string', example: '1000' },
                      timestamp: { type: 'string', example: '2026-03-06 10:36:56' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Evento aceito',
          },
          '400': {
            description: 'Erro de validacao',
          },
          '500': {
            description: 'Falha no envio do e-mail',
          },
        },
      },
    },
  },
};

module.exports = openapi;

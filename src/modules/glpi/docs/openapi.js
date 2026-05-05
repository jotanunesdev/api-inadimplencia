function buildJsonResponseSchema(refName) {
  return {
    allOf: [
      {
        $ref: '#/components/schemas/EnvelopeResposta',
      },
      {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: `#/components/schemas/${refName}`,
            },
          },
        },
      },
    ],
  };
}

function buildQueryDateParam(name, description, example) {
  return {
    name,
    in: 'query',
    required: false,
    description,
    schema: {
      type: 'string',
      format: 'date',
      example,
    },
  };
}

function buildErrorResponse(description) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/Erro',
        },
      },
    },
  };
}

function buildEnvelopeResponse(refName) {
  return {
    description: 'Sucesso',
    content: {
      'application/json': {
        schema: buildJsonResponseSchema(refName),
      },
    },
  };
}

const standardErrorResponses = {
  '400': buildErrorResponse('Requisicao invalida'),
  '403': buildErrorResponse('Origem nao permitida'),
  '503': buildErrorResponse('Modulo GLPI indisponivel'),
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API GLPI - JotaNunes',
    version: '1.0.0',
    description:
      'Modulo GLPI da api-inadimplencia. Este contrato e protegido por allowlist de CORS e nao utiliza JWT, API key ou sessao.',
    contact: {
      name: 'TI JotaNunes',
    },
  },
  servers: [
    {
      url: '/glpi',
      description: 'Prefixo padrao na api-inadimplencia',
    },
    {
      url: 'http://localhost:4010/glpi',
      description: 'Instancia standalone do modulo em desenvolvimento',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check do modulo GLPI' },
    { name: 'Chamados', description: 'Endpoints de chamados do GLPI' },
    { name: 'Inventario', description: 'Endpoints de inventario do GLPI' },
    { name: 'Custos', description: 'Endpoints de custos do GLPI' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check do modulo GLPI',
        responses: {
          '200': {
            description: 'Modulo saudavel',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    configured: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    missingRequired: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    dbReachable: { type: 'boolean' },
                    timestamp: { type: 'string' },
                  },
                  required: [
                    'status',
                    'configured',
                    'enabled',
                    'missingRequired',
                    'dbReachable',
                    'timestamp',
                  ],
                },
              },
            },
          },
          ...standardErrorResponses,
        },
      },
    },
    '/chamados': {
      get: {
        tags: ['Chamados'],
        summary: 'Lista chamados do GLPI',
        parameters: [
          buildQueryDateParam(
            'data_inicio',
            'Data inicial do filtro aplicado sobre data_abertura no formato YYYY-MM-DD.',
            '2025-01-01'
          ),
          buildQueryDateParam(
            'data_fim',
            'Data final do filtro aplicado sobre data_abertura no formato YYYY-MM-DD.',
            '2025-12-31'
          ),
          {
            name: 'status',
            in: 'query',
            required: false,
            description:
              'Lista CSV de status textuais permitidos. Exemplo: Novo,Fechado. O filtro usa comparacao exata com os status traduzidos pela consulta.',
            style: 'form',
            explode: false,
            schema: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['Novo', 'Atribuido', 'Planejado', 'BackLog', 'Em Validacao', 'Fechado'],
              },
            },
          },
          {
            name: 'tipo',
            in: 'query',
            required: false,
            description: 'Tipo do chamado retornado pela consulta oficial.',
            schema: {
              type: 'string',
              enum: ['Incidente', 'Requisicao'],
            },
          },
        ],
        responses: {
          '200': buildEnvelopeResponse('Chamado'),
          ...standardErrorResponses,
        },
      },
    },
    '/inventario': {
      get: {
        tags: ['Inventario'],
        summary: 'Lista inventario consolidado do GLPI',
        parameters: [
          buildQueryDateParam(
            'data_inicio',
            'Data inicial do filtro aplicado sobre date_creation no formato YYYY-MM-DD.',
            '2025-01-01'
          ),
          buildQueryDateParam(
            'data_fim',
            'Data final do filtro aplicado sobre date_creation no formato YYYY-MM-DD.',
            '2025-12-31'
          ),
          {
            name: 'tipo_origem',
            in: 'query',
            required: false,
            description:
              'Filtra uma unica fonte do inventario. Valores aceitos: computer, network ou line.',
            schema: {
              type: 'string',
              enum: ['computer', 'network', 'line'],
            },
          },
        ],
        responses: {
          '200': buildEnvelopeResponse('InventarioItem'),
          ...standardErrorResponses,
        },
      },
    },
    '/custos': {
      get: {
        tags: ['Custos'],
        summary: 'Lista custos lançados em chamados do GLPI',
        parameters: [
          buildQueryDateParam(
            'data_inicio',
            'Data inicial do filtro aplicado sobre data_atendimento no formato YYYY-MM-DD.',
            '2025-01-01'
          ),
          buildQueryDateParam(
            'data_fim',
            'Data final do filtro aplicado sobre data_atendimento no formato YYYY-MM-DD.',
            '2025-12-31'
          ),
          {
            name: 'grupo',
            in: 'query',
            required: false,
            description:
              'Substrato case-insensitive aplicado sobre o nome do grupo. Limite de 50 caracteres.',
            schema: {
              type: 'string',
              maxLength: 50,
              example: 'DW',
            },
          },
        ],
        responses: {
          '200': buildEnvelopeResponse('Custo'),
          ...standardErrorResponses,
        },
      },
    },
  },
  components: {
    schemas: {
      EnvelopeResposta: {
        type: 'object',
        required: ['data', 'count', 'filters'],
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
          count: {
            type: 'integer',
            minimum: 0,
            example: 0,
          },
          filters: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      Chamado: {
        type: 'object',
        required: [
          'id',
          'tipo',
          'titulo',
          'data_abertura',
          'data_fechamento',
          'data_add_validacao',
          'takeintoaccountdate',
          'data_modificacao',
          'status',
          'solicitante',
          'descricao_categoria',
          'descricao_categoria_simples',
          'grupo_equipe',
          'grupo_empresa',
          'nome_tecnico',
          'time_to_resolve',
          'time_to_own',
          'begin_waiting_date',
          'sla_waiting_duration',
          'waiting_duration',
          'close_delay_stat',
          'takeintoaccount_delay_stat',
          'is_deleted',
          'localizacao',
          'cidade',
          'etiqueta',
        ],
        properties: {
          id: { type: 'integer', example: 12345 },
          tipo: { type: 'string', enum: ['Incidente', 'Requisicao'] },
          titulo: { type: 'string', example: 'Sem acesso ao sistema' },
          data_abertura: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 08:30:00',
          },
          data_fechamento: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 10:30:00',
          },
          data_add_validacao: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 09:15:00',
          },
          takeintoaccountdate: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 08:45:00',
          },
          data_modificacao: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 10:40:00',
          },
          status: {
            type: 'string',
            enum: ['Novo', 'Atribuido', 'Planejado', 'BackLog', 'Em Validacao', 'Fechado'],
          },
          solicitante: { type: 'string', example: 'Joao Silva' },
          descricao_categoria: { type: 'string', example: 'Rede / Internet' },
          descricao_categoria_simples: { type: 'string', example: 'Rede / Internet' },
          grupo_equipe: { type: 'string', example: 'Infra' },
          grupo_empresa: { type: 'string', example: 'DataWer' },
          nome_tecnico: { type: 'string', example: 'Maria Souza' },
          time_to_resolve: { type: 'integer', nullable: true, example: 120 },
          time_to_own: { type: 'integer', nullable: true, example: 90 },
          begin_waiting_date: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 08:50:00',
          },
          sla_waiting_duration: { type: 'integer', nullable: true, example: 0 },
          waiting_duration: { type: 'integer', nullable: true, example: 0 },
          close_delay_stat: { type: 'integer', nullable: true, example: 0 },
          takeintoaccount_delay_stat: { type: 'integer', nullable: true, example: 0 },
          is_deleted: { type: 'integer', example: 0 },
          localizacao: { type: 'string', example: 'Matriz / TI' },
          cidade: { type: 'string', example: 'Teresina' },
          etiqueta: { type: 'string', example: 'VPN, Urgente' },
        },
      },
      InventarioItem: {
        type: 'object',
        required: [
          'id',
          'ativo',
          'serial',
          'comment',
          'localizacao',
          'cidade',
          'estado',
          'tipo',
          'lotado_para',
          'status',
          'date_creation',
          'date_mod',
          'last_inventory_update',
          'etiqueta',
          'custo',
          'origem',
        ],
        properties: {
          id: { type: 'integer', example: 1001 },
          ativo: { type: 'string', example: 'Notebook Dell Latitude' },
          serial: { type: 'string', example: 'ABC123XYZ' },
          comment: { type: 'string', example: 'Patrimonio 001' },
          localizacao: { type: 'string', example: 'Filial Centro' },
          cidade: { type: 'string', example: 'Teresina' },
          estado: { type: 'string', example: 'PI' },
          tipo: { type: 'string', example: 'Notebook' },
          lotado_para: { type: 'string', example: 'Carlos Lima' },
          status: { type: 'string', example: 'Em uso' },
          date_creation: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-04-10 09:15:00',
          },
          date_mod: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 11:00:00',
          },
          last_inventory_update: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-01 11:30:00',
          },
          etiqueta: { type: 'string', example: 'TAG-001' },
          custo: { type: 'number', nullable: true, example: 3500.5 },
          origem: { type: 'string', enum: ['Computer', 'NetworkEquipment', 'Line'] },
        },
      },
      Custo: {
        type: 'object',
        required: ['id', 'tickets_id', 'grupo', 'titulo', 'comment', 'data_atendimento', 'custo_total'],
        properties: {
          id: { type: 'integer', example: 2001 },
          tickets_id: { type: 'integer', example: 12345 },
          grupo: { type: 'string', example: 'DW - Atendimento' },
          titulo: { type: 'string', example: 'Chamado com custo' },
          comment: { type: 'string', example: 'Horas adicionais cobradas' },
          data_atendimento: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
            example: '2025-05-02 14:45:00',
          },
          custo_total: { type: 'number', nullable: true, example: 150.75 },
        },
      },
      Erro: {
        type: 'object',
        required: ['error', 'code'],
        properties: {
          error: { type: 'string', example: 'Mensagem de erro' },
          code: { type: 'string', example: 'INVALID_FILTER' },
          missingRequired: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    responses: {
      BadRequest: buildErrorResponse('Requisicao invalida'),
      Forbidden: buildErrorResponse('Origem nao permitida'),
      ServiceUnavailable: buildErrorResponse('Modulo GLPI indisponivel'),
    },
    securitySchemes: {},
  },
};

module.exports = openapi;

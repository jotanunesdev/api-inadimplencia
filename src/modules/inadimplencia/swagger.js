const jsonResponse = {
  200: {
    description: "Sucesso",
    content: {
      "application/json": {
        schema: {
          oneOf: [
            { type: "object", additionalProperties: true },
            { type: "array", items: {} },
          ],
        },
      },
    },
  },
};

const genericRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

const serasaPefinActionableErrorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "string",
      example: "SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES",
    },
    code: {
      type: "string",
      example: "SERASA_PEFIN_MISSING_REQUIRED_FIELDS",
    },
    missingFields: {
      type: "array",
      items: { type: "string" },
      example: ["debtor.address.zipCode", "debtor.address.city"],
    },
    blockedDocuments: {
      type: "array",
      description: "Documentos mascarados quando bloqueados por regra operacional, como massa UAT.",
      items: {
        oneOf: [
          { type: "string", example: "123.***.01" },
          {
            type: "object",
            additionalProperties: true,
            properties: {
              tipoRegistro: { type: "string", example: "GARANTIDOR" },
              idAssociado: { type: "string", example: "ASSOC001" },
              documento: { type: "string", example: "12.***.90" },
            },
          },
        ],
      },
    },
  },
};

const serasaPefinActionableErrorResponse = {
  description: "Erro operacional acionavel",
  content: {
    "application/json": {
      schema: serasaPefinActionableErrorSchema,
      examples: {
        missingFields: {
          summary: "Campos obrigatorios ausentes",
          value: {
            error: "SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES",
            code: "SERASA_PEFIN_MISSING_REQUIRED_FIELDS",
            missingFields: ["debtor.address.zipCode", "debtor.address.city"],
          },
        },
        blockedDocuments: {
          summary: "Documento bloqueado em UAT",
          value: {
            error: "SERASA_PEFIN_DOCUMENTO_NAO_AUTORIZADO_UAT",
            code: "SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED",
            blockedDocuments: [
              "123.***.01",
              {
                tipoRegistro: "GARANTIDOR",
                idAssociado: "ASSOC001",
                documento: "12.***.90",
              },
            ],
          },
        },
      },
    },
  },
};

const serasaPefinResponses = {
  ...jsonResponse,
  400: serasaPefinActionableErrorResponse,
  404: {
    description: "Recurso Serasa PEFIN nao encontrado",
    content: {
      "application/json": {
        schema: serasaPefinActionableErrorSchema,
        example: {
          error: "VENDA_NAO_ENCONTRADA_OU_NAO_INADIMPLENTE",
          code: "SERASA_PEFIN_VENDA_NOT_FOUND",
        },
      },
    },
  },
};

// Catalogo informativo dos scripts de ocorrencia aceitos em STATUS_OCORRENCIA.
// O backend continua aceitando qualquer string; este enum serve apenas
// para documentar no Swagger os valores sincronizados com o frontend
// (ver src/shared/constants/occurrence.ts do projeto jnc_inadimplencia).
const OCCURRENCE_STATUS_ENUM = [
  "Promessa de pagamento",
  "Confirmar pagamento",
  "Negociação em andamento",
  "Cobrança ativa (telefonema)",
  "Cobrança via WhatsApp",
  "Verificar leitura AR (Comprovante de leitura)",
  "Acompanhar prazo de notificação (Prazo de resolução)",
  "Retorno agendado com o cliente",
  "Alerta de risco de distrato",
  "Contrato em Processo Jurídico",
  "Aguardando Assinatura",
  "Alteração de Data",
];

const ocorrenciaRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          NUM_VENDA_FK: { type: "integer", example: 20988 },
          NOME_USUARIO_FK: { type: "string", example: "joao.silva" },
          DESCRICAO: { type: "string" },
          STATUS_OCORRENCIA: {
            type: "string",
            description:
              "Script/status da ocorrencia. Os valores abaixo sao os sugeridos " +
              "pelo frontend; o backend aceita qualquer string.",
            enum: OCCURRENCE_STATUS_ENUM,
            example: "Alteração de Data",
          },
          DT_OCORRENCIA: {
            type: "string",
            format: "date",
            example: "2026-04-22",
          },
          HORA_OCORRENCIA: { type: "string", example: "14:30:00" },
          PROXIMA_ACAO: { type: "string", format: "date-time" },
          PROTOCOLO: { type: "string" },
        },
      },
    },
  },
};

const responsavelRequestSchema = {
  type: "object",
  required: ["nomeUsuario", "adminUserCode"],
  properties: {
    nomeUsuario: {
      type: "string",
      description: "Nome do operador que recebera a venda.",
      example: "joao.silva",
    },
    adminUserCode: {
      type: "string",
      description:
        "USER_CODE do usuario admin logado que esta realizando a atribuicao.",
      example: "wffluig",
    },
  },
};


const responsavelCreateRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['numVenda', 'nomeUsuario', 'adminUserCode'],
        properties: {
          numVenda: {
            type: 'integer',
            description: 'Numero da venda que sera atribuida.',
            example: 12345,
          },
          ...responsavelRequestSchema.properties,
        },
      },
      example: {
        numVenda: 12345,
        nomeUsuario: 'joao.silva',
        adminUserCode: 'wffluig',
      },
    },
  },
};

const dateRangeParams = [
  {
    name: "dataInicio",
    in: "query",
    required: false,
    description:
      "Data inicial do filtro (YYYY-MM-DD). Deve ser informada em conjunto com dataFim.",
    schema: { type: "string", format: "date" },
    example: "2026-04-01",
  },
  {
    name: "dataFim",
    in: "query",
    required: false,
    description:
      "Data final do filtro (YYYY-MM-DD). Deve ser informada em conjunto com dataInicio.",
    schema: { type: "string", format: "date" },
    example: "2026-04-15",
  },
];

const responsavelUpdateRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: responsavelRequestSchema,
      example: {
        nomeUsuario: "maria.souza",
        adminUserCode: "wffluig",
      },
    },
  },
};

const pathParam = (name, description, example) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
  example,
});

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "API Inadimplência",
    version: "1.0.0",
    description: "Documentação da API de Inadimplência.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health", description: "Monitoramento" },
    { name: "Inadimplencia", description: "Dados de inadimplência" },
    { name: "ProximasAcoes", description: "Próximas ações" },
    { name: "Ocorrencias", description: "Ocorrências" },
    { name: "Usuarios", description: "Usuários" },
    { name: "Responsaveis", description: "Responsáveis" },
    { name: "Dashboard", description: "Indicadores e agregações" },
    { name: "KanbanStatus", description: "Status do Kanban" },
    { name: "Atendimentos", description: "Atendimentos" },
    { name: "Relatorios", description: "Relatórios" },
    { name: "Fiadores", description: "Fiadores/associados da venda" },
    { name: "SerasaPefin", description: "Integração Serasa PEFIN para negativação" },
    { name: "SerasaPefinTest", description: "Endpoints de teste para integração Serasa PEFIN (apenas desenvolvimento/homologação)" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: jsonResponse,
      },
    },
    "/inadimplencia": {
      get: {
        tags: ["Inadimplencia"],
        summary: "Lista inadimplências",
        responses: jsonResponse,
      },
    },
    "/inadimplencia/cpf/{cpf}": {
      get: {
        tags: ["Inadimplencia"],
        summary: "Busca inadimplência por CPF",
        parameters: [pathParam("cpf", "CPF do cliente", "00000000000")],
        responses: jsonResponse,
      },
    },
    "/inadimplencia/num-venda/{numVenda}": {
      get: {
        tags: ["Inadimplencia"],
        summary: "Busca inadimplência por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
    },
    "/inadimplencia/responsavel/{nome}": {
      get: {
        tags: ["Inadimplencia"],
        summary: "Busca inadimplencia por responsavel",
        parameters: [pathParam("nome", "Nome do responsavel", "joao")],
        responses: jsonResponse,
      },
    },
    "/inadimplencia/cliente/{nomeCliente}": {
      get: {
        tags: ["Inadimplencia"],
        summary: "Busca inadimplencia por nome do cliente",
        parameters: [pathParam("nomeCliente", "Nome do cliente", "joao")],
        responses: jsonResponse,
      },
    },
    "/proximas-acoes": {
      get: {
        tags: ["ProximasAcoes"],
        summary: "Lista próximas ações",
        responses: jsonResponse,
      },
      post: {
        tags: ["ProximasAcoes"],
        summary: "Cria próxima ação",
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    "/proximas-acoes/{numVenda}": {
      get: {
        tags: ["ProximasAcoes"],
        summary: "Busca próxima ação por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
      put: {
        tags: ["ProximasAcoes"],
        summary: "Atualiza próxima ação por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ["ProximasAcoes"],
        summary: "Remove próxima ação por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
    },
    "/ocorrencias": {
      get: {
        tags: ["Ocorrencias"],
        summary: "Lista ocorrências",
        responses: jsonResponse,
      },
      post: {
        tags: ["Ocorrencias"],
        summary: "Cria ocorrência",
        requestBody: ocorrenciaRequestBody,
        responses: jsonResponse,
      },
    },
    "/ocorrencias/num-venda/{numVenda}": {
      get: {
        tags: ["Ocorrencias"],
        summary: "Busca ocorrências por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
    },
    "/ocorrencias/protocolo/{protocolo}": {
      get: {
        tags: ["Ocorrencias"],
        summary: "Busca ocorrência por protocolo",
        parameters: [pathParam("protocolo", "Número do protocolo", "PROT-001")],
        responses: jsonResponse,
      },
    },
    "/ocorrencias/{id}": {
      get: {
        tags: ["Ocorrencias"],
        summary: "Busca ocorrência por ID",
        parameters: [pathParam("id", "ID da ocorrência", "1")],
        responses: jsonResponse,
      },
      put: {
        tags: ["Ocorrencias"],
        summary: "Atualiza ocorrência por ID",
        parameters: [pathParam("id", "ID da ocorrência", "1")],
        requestBody: ocorrenciaRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ["Ocorrencias"],
        summary: "Remove ocorrência por ID",
        parameters: [pathParam("id", "ID da ocorrência", "1")],
        responses: jsonResponse,
      },
    },
    "/usuarios": {
      get: {
        tags: ["Usuarios"],
        summary: "Lista usuários",
        responses: jsonResponse,
      },
      post: {
        tags: ["Usuarios"],
        summary: "Cria usuário",
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    "/usuarios/{nome}": {
      get: {
        tags: ["Usuarios"],
        summary: "Busca usuário por nome",
        parameters: [pathParam("nome", "Nome do usuário", "joao.silva")],
        responses: jsonResponse,
      },
      put: {
        tags: ["Usuarios"],
        summary: "Atualiza usuário por nome",
        parameters: [pathParam("nome", "Nome do usuário", "joao.silva")],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ["Usuarios"],
        summary: "Remove usuário por nome",
        parameters: [pathParam("nome", "Nome do usuário", "joao.silva")],
        responses: jsonResponse,
      },
    },
    "/responsaveis": {
      get: {
        tags: ["Responsaveis"],
        summary: "Lista responsáveis",
        responses: jsonResponse,
      },
      post: {
        tags: ["Responsaveis"],
        summary: "Cria responsável",
        requestBody: responsavelCreateRequestBody,
        responses: jsonResponse,
      },
    },
    "/responsaveis/{numVenda}": {
      get: {
        tags: ["Responsaveis"],
        summary: "Busca responsável por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
      put: {
        tags: ["Responsaveis"],
        summary: "Atualiza responsável por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        requestBody: responsavelUpdateRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ["Responsaveis"],
        summary: "Remove responsável por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
    },
    "/dashboard/kpis": {
      get: {
        tags: ["Dashboard"],
        summary: "KPIs do dashboard",
        responses: jsonResponse,
      },
    },
    "/dashboard/vendas-por-responsavel": {
      get: {
        tags: ["Dashboard"],
        summary: "Vendas por responsável",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/inadimplencia-por-empreendimento": {
      get: {
        tags: ["Dashboard"],
        summary: "Inadimplência por empreendimento",
        responses: jsonResponse,
      },
    },
    "/dashboard/clientes-por-empreendimento": {
      get: {
        tags: ["Dashboard"],
        summary: "Clientes por empreendimento",
        responses: jsonResponse,
      },
    },
    "/dashboard/status-repasse": {
      get: {
        tags: ["Dashboard"],
        summary: "Status de repasse",
        responses: jsonResponse,
      },
    },
    "/dashboard/blocos": {
      get: {
        tags: ["Dashboard"],
        summary: "Blocos",
        responses: jsonResponse,
      },
    },
    "/dashboard/unidades": {
      get: {
        tags: ["Dashboard"],
        summary: "Unidades",
        responses: jsonResponse,
      },
    },
    "/dashboard/usuarios-ativos": {
      get: {
        tags: ["Dashboard"],
        summary: "Usuários ativos",
        responses: jsonResponse,
      },
    },
    "/dashboard/responsaveis": {
      get: {
        tags: ["Dashboard"],
        summary: "Todos responsáveis",
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias-por-usuario": {
      get: {
        tags: ["Dashboard"],
        summary: "Ocorrências por usuário",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias-por-venda": {
      get: {
        tags: ["Dashboard"],
        summary: "Ocorrências por venda",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias-por-dia": {
      get: {
        tags: ["Dashboard"],
        summary: "Ocorrências por dia",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias-por-hora": {
      get: {
        tags: ["Dashboard"],
        summary: "Ocorrências por hora",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias-por-dia-hora": {
      get: {
        tags: ["Dashboard"],
        summary: "Ocorrências por dia e hora",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/ocorrencias": {
      get: {
        tags: ["Dashboard"],
        summary: "Todas as ocorrências",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/proximas-acoes-por-dia": {
      get: {
        tags: ["Dashboard"],
        summary: "Próximas ações por dia",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/acoes-definidas": {
      get: {
        tags: ["Dashboard"],
        summary: "Ações definidas",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/aging": {
      get: {
        tags: ["Dashboard"],
        summary: "Aging",
        responses: jsonResponse,
      },
    },
    "/dashboard/parcelas-inadimplentes": {
      get: {
        tags: ["Dashboard"],
        summary: "Parcelas inadimplentes",
        responses: jsonResponse,
      },
    },
    "/dashboard/parcelas-detalhes": {
      get: {
        tags: ["Dashboard"],
        summary: "Detalhes de parcelas",
        responses: jsonResponse,
      },
    },
    "/dashboard/score-saldo": {
      get: {
        tags: ["Dashboard"],
        summary: "Score saldo",
        responses: jsonResponse,
      },
    },
    "/dashboard/score-saldo-detalhes": {
      get: {
        tags: ["Dashboard"],
        summary: "Detalhes do score saldo",
        responses: jsonResponse,
      },
    },
    "/dashboard/saldo-por-mes-vencimento": {
      get: {
        tags: ["Dashboard"],
        summary: "Saldo por mês de vencimento",
        responses: jsonResponse,
      },
    },
    "/dashboard/perfil-risco-empreendimento": {
      get: {
        tags: ["Dashboard"],
        summary: "Perfil de risco por empreendimento",
        responses: jsonResponse,
      },
    },
    "/dashboard/atendentes-proxima-acao": {
      get: {
        tags: ["Dashboard"],
        summary: "Atendentes por próxima ação",
        parameters: dateRangeParams,
        responses: jsonResponse,
      },
    },
    "/dashboard/aging-detalhes": {
      get: {
        tags: ["Dashboard"],
        summary: "Detalhes do aging",
        responses: jsonResponse,
      },
    },
    "/kanban-status": {
      get: {
        tags: ["KanbanStatus"],
        summary: "Lista status do Kanban",
        responses: jsonResponse,
      },
      post: {
        tags: ["KanbanStatus"],
        summary: "Cria ou atualiza status do Kanban",
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    "/atendimentos/cpf/{cpf}": {
      get: {
        tags: ["Atendimentos"],
        summary: "Busca atendimentos por CPF",
        parameters: [pathParam("cpf", "CPF do cliente", "00000000000")],
        responses: jsonResponse,
      },
    },
    "/atendimentos/num-venda/{numVenda}": {
      get: {
        tags: ["Atendimentos"],
        summary: "Busca atendimentos por número da venda",
        parameters: [pathParam("numVenda", "Número da venda", "12345")],
        responses: jsonResponse,
      },
    },
    "/atendimentos/protocolo/{protocolo}": {
      get: {
        tags: ["Atendimentos"],
        summary: "Busca atendimentos por protocolo",
        parameters: [pathParam("protocolo", "Número do protocolo", "PROT-001")],
        responses: jsonResponse,
      },
    },
    "/atendimentos/cliente/{nomeCliente}": {
      get: {
        tags: ["Atendimentos"],
        summary: "Busca atendimento por nome do cliente",
        parameters: [pathParam("nomeCliente", "Nome do cliente", "joao")],
        responses: jsonResponse,
      },
    },
    "/atendimentos": {
      post: {
        tags: ["Atendimentos"],
        summary: "Cria atendimento",
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    "/relatorios/ficha-financeira": {
      get: {
        tags: ["Relatorios"],
        summary: "Relatório de ficha financeira",
        responses: jsonResponse,
      },
    },
    "/fiadores/num-venda/{numVenda}": {
      get: {
        tags: ["Fiadores"],
        summary: "Lista fiadores/associados de uma venda",
        parameters: [pathParam("numVenda", "Número da venda", "20988")],
        responses: jsonResponse,
      },
    },
    "/fiadores/cpf/{cpf}": {
      get: {
        tags: ["Fiadores"],
        summary: "Lista fiadores cujo DOCUMENTO bate com o CPF/CNPJ informado",
        parameters: [
          pathParam(
            "cpf",
            "CPF (11 dígitos) ou CNPJ (14 dígitos)",
            "60142340553",
          ),
        ],
        responses: jsonResponse,
      },
    },
    "/serasa-pefin/vendas/{numVenda}/preview": {
      get: {
        tags: ["SerasaPefin"],
        summary: "Preview de dados para negativação PEFIN",
        parameters: [
          pathParam("numVenda", "Número da venda", "20988"),
        ],
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/vendas/{numVenda}/negativacoes": {
      get: {
        tags: ["SerasaPefin"],
        summary: "Histórico de negativações por venda",
        parameters: [
          pathParam("numVenda", "Número da venda", "20988"),
        ],
        responses: serasaPefinResponses,
      },
      post: {
        tags: ["SerasaPefin"],
        summary: "Solicitar negativação PEFIN (divida principal + garantidores)",
        parameters: [
          pathParam("numVenda", "Número da venda", "20988"),
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["operador"],
                properties: {
                  operador: {
                    type: "string",
                    description: "Nome do operador solicitando a negativação",
                    example: "joao.silva",
                  },
                  garantidoresSelecionados: {
                    type: "array",
                    items: { type: "string" },
                    description: "IDs dos associados selecionados para envio como garantidores",
                    example: ["ASSOC-001", "ASSOC-002"],
                  },
                  overrides: {
                    type: "object",
                    description: "Overrides opcionais para categoryId e areaInformante",
                    properties: {
                      categoryId: { type: "string", example: "FI" },
                      areaInformante: { type: "string", example: "1234" },
                    },
                  },
                },
              },
              example: {
                operador: "joao.silva",
                garantidoresSelecionados: ["ASSOC-001", "ASSOC-002"],
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/negativacoes/{id}": {
      get: {
        tags: ["SerasaPefin"],
        summary: "Detalhe técnico-operacional de uma negativação",
        parameters: [pathParam("id", "ID da solicitação (GUID)", "123e4567-e89b-12d3-a456-426614174000")],
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/acompanhamento/{transactionId}": {
      get: {
        tags: ["SerasaPefin"],
        summary: "Acompanha processamento por transactionId/uuid",
        description:
          "Consulta o status interno atualizado pelos webhooks da Serasa. O transactionId do envio inicial corresponde ao uuid recebido no webhook.",
        parameters: [
          pathParam(
            "transactionId",
            "Transaction ID retornado pela Serasa no envio inicial",
            "f1d11b18-b459-4f11-97a8-8143a6c392e4"
          ),
        ],
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/inclusao/sucesso": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para sucesso de inclusão de divida principal",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitação",
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/inclusao/erro": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para erro de inclusão de divida principal",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitação",
                  },
                  error: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      statusCode: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/avalista/sucesso": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para sucesso de inclusão de avalista/fiador",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitação",
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/avalista/erro": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para erro de inclusão de avalista/fiador",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitação",
                  },
                  error: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      statusCode: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/baixa/sucesso": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para sucesso de baixa/exclusao de divida",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitacao de baixa",
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/webhooks/baixa/erro": {
      post: {
        tags: ["SerasaPefin"],
        summary: "Webhook Serasa para erro de baixa/exclusao de divida",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  uuid: {
                    type: "string",
                    description: "Transaction ID da solicitacao de baixa",
                  },
                  error: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      statusCode: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: serasaPefinResponses,
      },
    },
    "/serasa-pefin/testes/auth": {
      get: {
        tags: ["SerasaPefinTest"],
        summary: "Testa autenticação com credenciais Serasa configuradas",
        description: "Endpoint de teste para validar autenticação. Bloqueado em produção.",
        responses: {
          200: {
            description: "Autenticação bem-sucedida",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        authenticated: { type: "boolean" },
                        tokenPrefix: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          403: {
            description: "Bloqueado em ambiente de produção",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
          503: {
            description: "Serasa PEFIN não configurado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    missingRequired: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/serasa-pefin/testes/debt": {
      post: {
        tags: ["SerasaPefinTest"],
        summary: "Envia negativação de teste usando documento da massa de teste",
        description: "Endpoint de teste para envio de negativação com documento autorizado. Bloqueado em produção.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["documento"],
                properties: {
                  documento: {
                    type: "string",
                    description: "Documento da massa de teste Serasa",
                    example: "168.816.700-52",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Negativação de teste enviada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        transactionId: { type: "string" },
                        cadusKey: { type: "string" },
                        cadusSerie: { type: "string" },
                        documento: { type: "string" },
                        descricao: { type: "string" },
                        mensagem: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Documento inválido ou não autorizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    allowedDocuments: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          403: {
            description: "Bloqueado em ambiente de produção",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/serasa-pefin/testes/webhook/simular": {
      post: {
        tags: ["SerasaPefinTest"],
        summary: "Simula webhook de sucesso ou erro manualmente",
        description: "Endpoint de teste para simular webhooks e validar conciliação. Bloqueado em produção.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["transactionId", "eventType"],
                properties: {
                  transactionId: {
                    type: "string",
                    description: "Transaction ID da solicitação",
                  },
                  eventType: {
                    type: "string",
                    enum: ["inclusao/sucesso", "inclusao/erro", "avalista/sucesso", "avalista/erro"],
                    description: "Tipo de evento do webhook",
                  },
                  error: {
                    type: "object",
                    description: "Detalhes do erro (apenas para eventos de erro)",
                    properties: {
                      message: { type: "string" },
                      statusCode: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Webhook simulado processado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        processed: { type: "boolean" },
                        transactionId: { type: "string" },
                        eventType: { type: "string" },
                        result: { type: "object" },
                        mensagem: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Parâmetros inválidos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    allowedTypes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          403: {
            description: "Bloqueado em ambiente de produção",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/serasa-pefin/testes/documentos": {
      get: {
        tags: ["SerasaPefinTest"],
        summary: "Lista documentos autorizados pela Serasa para homologação",
        description: "Retorna a massa de teste de homologação Serasa PEFIN. Bloqueado em produção.",
        responses: {
          200: {
            description: "Lista de documentos autorizados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        documentos: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              documento: { type: "string" },
                              descricao: { type: "string" },
                            },
                          },
                        },
                        total: { type: "integer" },
                        fonte: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          403: {
            description: "Bloqueado em ambiente de produção",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = swaggerSpec;
